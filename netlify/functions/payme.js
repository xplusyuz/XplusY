/**
 * Netlify Function: Payme/Paycom JSON-RPC endpoint (FULL, Firestore-backed)
 * Endpoint URL after deploy:
 *   https://<your-site>.netlify.app/.netlify/functions/payme
 *
 * =========================
 *  NETLIFY ENV VARS REQUIRED
 * =========================
 * PAYME_LOGIN          (default: "Paycom")
 * PAYME_KEY            (Payme "key/password" for auth. For test put TEST key, for prod put PROD key)
 *
 * FIREBASE_SERVICE_ACCOUNT_JSON
 *   - Firebase service account JSON as a single-line JSON string.
 *   - Example: {"type":"service_account",...}
 *
 * OPTIONAL:
 * FIREBASE_DATABASE_URL (if you use RTDB; not required for Firestore)
 *
 * =========================
 *  FIRESTORE SCHEMA (minimal)
 * =========================
 * /orders/{orderId}
 *   - totalUZS: number   (order amount in UZS)
 *   - status: "pending" | "paid" | "cancelled" | ...
 *   - payme: { state, transactionId, paidAt }
 *
 * /payme_transactions/{txId}
 *   - orderId, amountTiyin, state, createTime, performTime, cancelTime, reason
 *
 * =========================
 *  NOTES
 * =========================
 * - Payme sends amount in TIYIN (UZS * 100).
 * - We enforce:
 *   - order exists
 *   - amount matches order.totalUZS
 *   - order not already paid (unless same tx idempotent)
 * - Transactions timeouts:
 *   - If a created transaction is not performed within 12 hours, we reject perform.
 */

const admin = require("firebase-admin");

// ---------- Firebase Admin init ----------
function initAdmin() {
  if (admin.apps.length) return;

  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saRaw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saRaw);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

function db() {
  initAdmin();
  return admin.firestore();
}

// ---------- Helpers ----------
function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function ok(id, result) {
  return json(200, { jsonrpc: "2.0", id, result });
}

function rpcError(id, code, message, data = null) {
  const err = { code, message };
  if (data !== null) err.data = data;
  return json(200, { jsonrpc: "2.0", id: id ?? null, error: err });
}

function parseBasicAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  try {
    const b64 = authHeader.slice(6).trim();
    const raw = Buffer.from(b64, "base64").toString("utf8");
    const idx = raw.indexOf(":");
    if (idx < 0) return null;
    return { login: raw.slice(0, idx), key: raw.slice(idx + 1) };
  } catch {
    return null;
  }
}

function requireAuth(event) {
  const creds = parseBasicAuth(event.headers.authorization || event.headers.Authorization);
  const wantLogin = process.env.PAYME_LOGIN || "Paycom";
  const wantKey = process.env.PAYME_KEY || "";

  if (!wantKey) return { ok: false, why: "server_misconfigured" };
  if (!creds) return { ok: false, why: "no_auth" };
  if (creds.login !== wantLogin || creds.key !== wantKey) return { ok: false, why: "bad_auth" };
  return { ok: true };
}

// Payme states:
// 1  - created
// 2  - performed
// -1 - cancelled (before perform)
// -2 - cancelled (after perform)

const TX_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

async function getOrder(orderId) {
  const ref = db().collection("orders").doc(String(orderId));
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, data: snap.data() };
}

function amountMatches(orderData, amountTiyin) {
  const totalUZS = Number(orderData?.totalUZS ?? orderData?.amountUZS ?? orderData?.total ?? NaN);
  if (!Number.isFinite(totalUZS)) return false;
  const expected = Math.round(totalUZS * 100);
  return Number(amountTiyin) === expected;
}

async function getTx(txId) {
  const ref = db().collection("payme_transactions").doc(String(txId));
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, data: snap.data() };
}

async function upsertTxCreate({ txId, orderId, amountTiyin, createTime }) {
  const ref = db().collection("payme_transactions").doc(String(txId));
  await db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (snap.exists) {
      // keep existing
      return;
    }
    t.set(ref, {
      orderId: String(orderId),
      amountTiyin: Number(amountTiyin),
      state: 1,
      createTime: Number(createTime),
      performTime: 0,
      cancelTime: 0,
      reason: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  const snap2 = await ref.get();
  return { ref, data: snap2.data() };
}

async function markOrderPaid(orderRef, txId) {
  await orderRef.set(
    {
      status: "paid",
      payme: {
        state: 2,
        transactionId: String(txId),
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );
}

// ---------- Handler ----------
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
  }

  const auth = requireAuth(event);
  if (!auth.ok) {
    // Payme docs: wrong auth => -32504
    return rpcError(null, -32504, "Insufficient privilege");
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = body.params || {};
  if (!method) return rpcError(id, -32600, "Invalid Request");

  const account = params.account || {};
  const orderId = account.order_id ?? account.orderId ?? account.oid ?? null;

  try {
    switch (method) {
      case "CheckPerformTransaction": {
        if (!orderId) return rpcError(id, -31050, "Order not found");

        const order = await getOrder(orderId);
        if (!order) return rpcError(id, -31050, "Order not found");

        const amountTiyin = params.amount;
        if (!amountMatches(order.data, amountTiyin)) return rpcError(id, -31001, "Incorrect amount");

        // if already paid, allow=false? Payme typically returns allow=false with error
        if (order.data?.status === "paid") return rpcError(id, -31052, "Order already paid");

        return ok(id, { allow: true });
      }

      case "CreateTransaction": {
        if (!orderId) return rpcError(id, -31050, "Order not found");
        const txId = params.id;
        if (!txId) return rpcError(id, -32602, "Invalid params");

        const order = await getOrder(orderId);
        if (!order) return rpcError(id, -31050, "Order not found");

        const amountTiyin = params.amount;
        if (!amountMatches(order.data, amountTiyin)) return rpcError(id, -31001, "Incorrect amount");

        if (order.data?.status === "paid") {
          // idempotency: if this tx already marked, allow returning existing tx state if matches
          const txExisting = await getTx(txId);
          if (txExisting) {
            return ok(id, {
              create_time: txExisting.data.createTime,
              transaction: String(txId),
              state: txExisting.data.state,
            });
          }
          return rpcError(id, -31052, "Order already paid");
        }

        const createTime = Number(params.time ?? Date.now());
        const tx = await getTx(txId);
        if (tx) {
          // If tx exists but for different order => error
          if (String(tx.data.orderId) !== String(orderId)) return rpcError(id, -31050, "Order not found");
          return ok(id, {
            create_time: tx.data.createTime,
            transaction: String(txId),
            state: tx.data.state,
          });
        }

        const created = await upsertTxCreate({ txId, orderId, amountTiyin, createTime });

        // store link on order (optional)
        await order.ref.set(
          { payme: { state: 1, transactionId: String(txId) } },
          { merge: true }
        );

        return ok(id, {
          create_time: created.data.createTime,
          transaction: String(txId),
          state: created.data.state,
        });
      }

      case "PerformTransaction": {
        const txId = params.id;
        if (!txId) return rpcError(id, -32602, "Invalid params");

        const tx = await getTx(txId);
        if (!tx) return rpcError(id, -31003, "Transaction not found");

        if (tx.data.state === 2) {
          return ok(id, {
            transaction: String(txId),
            perform_time: tx.data.performTime,
            state: tx.data.state,
          });
        }

        if (tx.data.state < 0) return rpcError(id, -31008, "Transaction is cancelled");

        // timeout check
        const now = Date.now();
        if (now - Number(tx.data.createTime) > TX_TIMEOUT_MS) {
          // cancel as -1 (before perform)
          await tx.ref.set({ state: -1, cancelTime: now, reason: 4 }, { merge: true });
          return rpcError(id, -31007, "Transaction timeout");
        }

        const order = await getOrder(tx.data.orderId);
        if (!order) return rpcError(id, -31050, "Order not found");

        // if order already paid but different tx => error
        if (order.data?.status === "paid" && order.data?.payme?.transactionId !== String(txId)) {
          return rpcError(id, -31052, "Order already paid");
        }

        // perform
        await db().runTransaction(async (t) => {
          const txSnap = await t.get(tx.ref);
          if (!txSnap.exists) throw new Error("tx disappeared");
          const cur = txSnap.data();

          if (cur.state === 2) return;

          const performTime = Date.now();
          t.set(
            tx.ref,
            { state: 2, performTime, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
          );
          t.set(
            order.ref,
            {
              status: "paid",
              payme: { state: 2, transactionId: String(txId), paidAt: admin.firestore.FieldValue.serverTimestamp() },
            },
            { merge: true }
          );
        });

        const tx2 = await getTx(txId);
        return ok(id, {
          transaction: String(txId),
          perform_time: tx2.data.performTime,
          state: tx2.data.state,
        });
      }

      case "CancelTransaction": {
        const txId = params.id;
        const reason = params.reason ?? null;
        if (!txId) return rpcError(id, -32602, "Invalid params");

        const tx = await getTx(txId);
        if (!tx) return rpcError(id, -31003, "Transaction not found");

        if (tx.data.state === -1 || tx.data.state === -2) {
          return ok(id, {
            transaction: String(txId),
            cancel_time: tx.data.cancelTime,
            state: tx.data.state,
          });
        }

        const cancelTime = Date.now();
        const nextState = tx.data.state === 1 ? -1 : -2;

        await tx.ref.set(
          { state: nextState, cancelTime, reason, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );

        // optional: mark order cancelled if it was not paid
        if (nextState === -1) {
          const order = await getOrder(tx.data.orderId);
          if (order && order.data?.status !== "paid") {
            await order.ref.set({ status: "cancelled" }, { merge: true });
          }
        }

        return ok(id, {
          transaction: String(txId),
          cancel_time: cancelTime,
          state: nextState,
        });
      }

      case "CheckTransaction": {
        const txId = params.id;
        if (!txId) return rpcError(id, -32602, "Invalid params");

        const tx = await getTx(txId);
        if (!tx) return rpcError(id, -31003, "Transaction not found");

        return ok(id, {
          create_time: tx.data.createTime,
          perform_time: tx.data.performTime,
          cancel_time: tx.data.cancelTime,
          transaction: String(txId),
          state: tx.data.state,
          reason: tx.data.reason ?? null,
        });
      }

      case "GetStatement": {
        // Return performed transactions in [from, to]
        const from = Number(params.from);
        const to = Number(params.to);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return rpcError(id, -32602, "Invalid params");

        const qs = await db()
          .collection("payme_transactions")
          .where("state", "==", 2)
          .where("performTime", ">=", from)
          .where("performTime", "<=", to)
          .get();

        const list = qs.docs.map((d) => {
          const t = d.data();
          return {
            id: d.id,
            time: t.performTime,
            amount: t.amountTiyin,
            account: { order_id: t.orderId },
            create_time: t.createTime,
            perform_time: t.performTime,
            cancel_time: t.cancelTime,
            state: t.state,
            reason: t.reason ?? null,
          };
        });

        return ok(id, { transactions: list });
      }

      default:
        return rpcError(id, -32601, "Method not found");
    }
  } catch (e) {
    return rpcError(id, -32000, "Server error", String(e?.message || e));
  }
};

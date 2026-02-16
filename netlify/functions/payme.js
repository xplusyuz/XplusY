/**
 * Netlify Function: /.netlify/functions/payme
 * Payme/Paycom Merchant API (JSON-RPC) — PRODUCTION-GRADE
 *
 * ✅ Fixes 502/SyntaxError by never throwing on bad JSON; always returns JSON-RPC response.
 * ✅ Supports: CheckPerformTransaction, CreateTransaction, PerformTransaction,
 *            CancelTransaction, CheckTransaction, GetStatement
 * ✅ Stores transactions in Firestore: payme_transactions/{txId}
 * ✅ Validates order existence in Firestore: orders/{orderId} (with optional fallback by field "omId")
 *
 * ENV required (Netlify → Site settings → Environment variables):
 * - PAYME_KEY: sandbox test_key or production key
 * - FIREBASE_SERVICE_ACCOUNT: Firebase service account JSON (ONE LINE string)
 *
 * ORDER schema (minimal):
 * - orders/{orderId}
 *   - amountTiyin (preferred int) OR amount (UZS number)
 *   - status: "pending" | "paid" | "canceled" (optional)
 *   - type: "order" | "topup" (optional)
 *   - uid/userId (optional, only for topup auto-balance increment)
 *
 * USER schema (optional, if type === "topup"):
 * - users/{uid}
 *   - balanceTiyin (int)
 */

const admin = require("firebase-admin");

/** ---------- helpers ---------- */
function jsonResponse(payload) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

function paymeError(code, message, data = null, id = null) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message: { uz: message, ru: message, en: message },
      data,
    },
  };
}

function paymeResult(result, id = null) {
  return { jsonrpc: "2.0", id, result };
}

function toNumberSafe(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function nowMs() {
  return Date.now();
}

function parseBodySafe(event) {
  if (!event) return null;

  // Some environments might already parse JSON
  if (typeof event.body === "object" && event.body !== null) return event.body;

  const raw = event.body;
  if (raw == null) return null;
  if (typeof raw !== "string") return null;

  // try raw JSON
  try {
    return JSON.parse(raw);
  } catch (_) {}

  // try URI-decoded JSON (sometimes comes encoded)
  try {
    const decoded = decodeURIComponent(raw);
    return JSON.parse(decoded);
  } catch (_) {}

  return null;
}

function extractAuthKey(headers) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[k.toLowerCase()] = v;

  // Payme usually: Authorization: Basic base64("Paycom:<key>")
  const auth = h["authorization"];
  if (auth && typeof auth === "string" && auth.toLowerCase().startsWith("basic ")) {
    const b64 = auth.slice(6).trim();
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      const parts = decoded.split(":");
      if (parts.length >= 2) {
        const user = parts[0];
        const key = parts.slice(1).join(":");
        return { user, key };
      }
    } catch (_) {}
  }

  // Fallback: X-Auth
  const xAuth = h["x-auth"];
  if (xAuth && typeof xAuth === "string") return { user: "X-Auth", key: xAuth };

  return null;
}

function normalizeAccount(params) {
  const acc = (params && params.account) || {};
  // Support multiple possible keys (sandbox UI / legacy)
  const orderId =
    acc.order_id ||
    acc.orderId ||
    acc.orders_id ||
    acc.ordersId ||
    acc.omId ||
    acc.omID ||
    null;

  return { orderId: orderId != null ? String(orderId) : null, raw: acc };
}

function initFirebase() {
  if (admin.apps.length) return;

  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saRaw) throw new Error("FIREBASE_SERVICE_ACCOUNT env is missing");

  let sa;
  try {
    sa = JSON.parse(saRaw);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }

  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}

async function getOrderById(db, orderId) {
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (snap.exists) return { ref, snap };

  // Optional fallback: if you store order id as field (omId)
  const q = await db.collection("orders").where("omId", "==", orderId).limit(1).get();
  if (!q.empty) {
    const doc = q.docs[0];
    return { ref: doc.ref, snap: doc };
  }
  return null;
}

function expectedAmountTiyin(orderSnap) {
  const d = orderSnap.data() || {};

  const aT = toNumberSafe(d.amountTiyin);
  if (aT != null) return Math.round(aT);

  const a = toNumberSafe(d.amount);
  if (a != null) return Math.round(a * 100);

  return null; // not enforce if missing
}

function clampStatementRange(from, to) {
  const f = toNumberSafe(from);
  const t = toNumberSafe(to);
  if (f == null || t == null) return null;

  // Safety: max 31 days
  const maxRange = 31 * 24 * 60 * 60 * 1000;
  if (t - f > maxRange) return { from: t - maxRange, to: t };
  return { from: f, to: t };
}

/** ---------- handler ---------- */
exports.handler = async (event) => {
  const PAYME_KEY = process.env.PAYME_KEY;

  const body = parseBodySafe(event);
  if (!body || typeof body !== "object") {
    // JSON parse error (do NOT crash -> avoid 502)
    return jsonResponse(paymeError(-32700, "Invalid JSON", "parse_error", null));
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = body.params || {};

  // Auth
  if (!PAYME_KEY) {
    return jsonResponse(paymeError(-32400, "Server env PAYME_KEY missing", "server_config", id));
  }

  const auth = extractAuthKey(event.headers || {});
  if (!auth || !auth.key || auth.key !== PAYME_KEY) {
    return jsonResponse(paymeError(-32504, "Unauthorized", "auth", id));
  }

  // Firebase
  let db;
  try {
    initFirebase();
    db = admin.firestore();
  } catch (e) {
    return jsonResponse(paymeError(-32400, "Internal server error", String(e.message || e), id));
  }

  try {
    switch (method) {
      case "CheckPerformTransaction": {
        const amount = toNumberSafe(params.amount);
        const { orderId } = normalizeAccount(params);

        if (!orderId) return jsonResponse(paymeError(-31050, "Account not found", "order_id", id));
        if (amount == null || amount <= 0) return jsonResponse(paymeError(-31001, "Invalid amount", "amount", id));

        const found = await getOrderById(db, orderId);
        if (!found) return jsonResponse(paymeError(-31050, "Account not found", "order", id));

        const exp = expectedAmountTiyin(found.snap);
        if (exp != null && Math.round(amount) !== exp) {
          return jsonResponse(paymeError(-31001, "Invalid amount", "amount_mismatch", id));
        }

        const status = (found.snap.data() || {}).status;
        if (status === "paid") {
          return jsonResponse(paymeError(-31050, "Account not found", "already_paid", id));
        }

        return jsonResponse(paymeResult({ allow: true }, id));
      }

      case "CreateTransaction": {
        const amount = toNumberSafe(params.amount);
        const { orderId, raw } = normalizeAccount(params);
        const time = toNumberSafe(params.time);
        const txId = params.id != null ? String(params.id) : null;

        if (!orderId) return jsonResponse(paymeError(-31050, "Account not found", "order_id", id));
        if (!txId) return jsonResponse(paymeError(-31099, "Transaction id missing", "id", id));
        if (amount == null || amount <= 0) return jsonResponse(paymeError(-31001, "Invalid amount", "amount", id));
        if (time == null) return jsonResponse(paymeError(-31099, "Time missing", "time", id));

        const found = await getOrderById(db, orderId);
        if (!found) return jsonResponse(paymeError(-31050, "Account not found", "order", id));

        const exp = expectedAmountTiyin(found.snap);
        if (exp != null && Math.round(amount) !== exp) {
          return jsonResponse(paymeError(-31001, "Invalid amount", "amount_mismatch", id));
        }

        const txRef = db.collection("payme_transactions").doc(txId);
        const txSnap = await txRef.get();

        if (txSnap.exists) {
          const tx = txSnap.data() || {};
          if (tx.state === 1) {
            return jsonResponse(paymeResult({ create_time: tx.createTime, transaction: txId, state: 1 }, id));
          }
          if (tx.state === 2) {
            return jsonResponse(
              paymeResult({ create_time: tx.createTime, perform_time: tx.performTime, transaction: txId, state: 2 }, id)
            );
          }
          if (tx.state < 0) {
            return jsonResponse(paymeError(-31008, "Transaction cancelled", "cancelled", id));
          }
        }

        const createTime = nowMs();
        await txRef.set(
          {
            transactionId: txId,
            orderId,
            amount: Math.round(amount),
            state: 1,
            time: Math.round(time),
            createTime,
            account: raw,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return jsonResponse(paymeResult({ create_time: createTime, transaction: txId, state: 1 }, id));
      }

      case "PerformTransaction": {
        const txId = params.id != null ? String(params.id) : null;
        if (!txId) return jsonResponse(paymeError(-31099, "Transaction id missing", "id", id));

        const txRef = db.collection("payme_transactions").doc(txId);
        const txSnap = await txRef.get();
        if (!txSnap.exists) return jsonResponse(paymeError(-31003, "Transaction not found", "transaction", id));

        const tx = txSnap.data() || {};

        if (tx.state === 2) {
          return jsonResponse(paymeResult({ transaction: txId, perform_time: tx.performTime, state: 2 }, id));
        }
        if (tx.state < 0) {
          return jsonResponse(paymeError(-31008, "Transaction cancelled", "cancelled", id));
        }

        const performTime = nowMs();

        await db.runTransaction(async (t) => {
          const orderFound = await getOrderById(db, tx.orderId);
          if (!orderFound) throw new Error("order_not_found");

          const orderSnap = await t.get(orderFound.ref);
          const order = orderSnap.data() || {};

          // Update order once
          if (order.status !== "paid") {
            t.set(orderFound.ref, { status: "paid", paidAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

            // Optional balance topup
            const type = order.type;
            const uid = order.uid || order.userId;
            if (type === "topup" && uid) {
              t.set(
                db.collection("users").doc(String(uid)),
                {
                  balanceTiyin: admin.firestore.FieldValue.increment(tx.amount),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            }
          }

          t.set(
            txRef,
            {
              state: 2,
              performTime,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });

        return jsonResponse(paymeResult({ transaction: txId, perform_time: performTime, state: 2 }, id));
      }

      case "CancelTransaction": {
        const txId = params.id != null ? String(params.id) : null;
        const reason = params.reason != null ? params.reason : null;
        if (!txId) return jsonResponse(paymeError(-31099, "Transaction id missing", "id", id));

        const txRef = db.collection("payme_transactions").doc(txId);
        const txSnap = await txRef.get();
        if (!txSnap.exists) return jsonResponse(paymeError(-31003, "Transaction not found", "transaction", id));

        const tx = txSnap.data() || {};
        if (tx.state < 0) {
          return jsonResponse(paymeResult({ transaction: txId, cancel_time: tx.cancelTime, state: tx.state }, id));
        }

        const cancelTime = nowMs();
        const newState = tx.state === 2 ? -2 : -1;

        await db.runTransaction(async (t) => {
          const orderFound = await getOrderById(db, tx.orderId);
          if (orderFound) {
            const orderSnap = await t.get(orderFound.ref);
            const order = orderSnap.data() || {};

            if (newState === -1) {
              if (order.status !== "paid") {
                t.set(orderFound.ref, { status: "canceled", canceledAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
              }
            } else {
              t.set(
                orderFound.ref,
                { paymeReversalRequested: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
                { merge: true }
              );
            }
          }

          t.set(
            txRef,
            {
              state: newState,
              cancelTime,
              reason,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        });

        return jsonResponse(paymeResult({ transaction: txId, cancel_time: cancelTime, state: newState }, id));
      }

      case "CheckTransaction": {
        const txId = params.id != null ? String(params.id) : null;
        if (!txId) return jsonResponse(paymeError(-31099, "Transaction id missing", "id", id));

        const txSnap = await db.collection("payme_transactions").doc(txId).get();
        if (!txSnap.exists) return jsonResponse(paymeError(-31003, "Transaction not found", "transaction", id));

        const tx = txSnap.data() || {};
        return jsonResponse(
          paymeResult(
            {
              create_time: tx.createTime || 0,
              perform_time: tx.performTime || 0,
              cancel_time: tx.cancelTime || 0,
              transaction: txId,
              state: tx.state,
              reason: tx.reason ?? null,
            },
            id
          )
        );
      }

      case "GetStatement": {
        const range = clampStatementRange(params.from, params.to);
        if (!range) return jsonResponse(paymeError(-31099, "Invalid range", "from/to", id));

        const q = await db
          .collection("payme_transactions")
          .where("createTime", ">=", range.from)
          .where("createTime", "<=", range.to)
          .limit(500)
          .get();

        const transactions = q.docs.map((d) => {
          const tx = d.data() || {};
          return {
            id: tx.transactionId || d.id,
            time: tx.time || tx.createTime || 0,
            amount: tx.amount || 0,
            account: tx.account || {},
            create_time: tx.createTime || 0,
            perform_time: tx.performTime || 0,
            cancel_time: tx.cancelTime || 0,
            transaction: tx.transactionId || d.id,
            state: tx.state,
            reason: tx.reason ?? null,
          };
        });

        return jsonResponse(paymeResult({ transactions }, id));
      }

      default:
        return jsonResponse(paymeError(-32601, "Method not found", String(method), id));
    }
  } catch (e) {
    return jsonResponse(paymeError(-32400, "Internal server error", String(e.message || e), id));
  }
};

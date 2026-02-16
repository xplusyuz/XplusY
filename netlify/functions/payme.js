/**
 * Netlify Function: /.netlify/functions/payme
 * OrzuMall Payme (Paycom) Merchant API — API-only (Checkout EMAS)
 *
 * ✅ Faqat KASSA_ID + KEY bilan ishlaydi (Checkout/Web-kassa talab qilinmaydi).
 * ✅ Payme serveri shu endpointga JSON-RPC yuboradi.
 * ✅ Sandbox tester orqali Create/Perform/Cancel test qilsa bo‘ladi.
 *
 * ENV:
 * - PAYME_KEY  (test_key yoki prod_key)
 * - FIREBASE_SERVICE_ACCOUNT (JSON, one-line)
 * Optional:
 * - PAYME_ALLOW_NO_AUTH=1  (faqat sandbox testlarda Authorization kelmasa ham qabul qilish uchun)
 */

const admin = require("firebase-admin");

function initFirebase() {
  if (admin.apps.length) return;

  // Recommended: store service account as Base64 to avoid multiline/env escaping issues on Netlify.
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  let sa;

  try {
    if (b64 && b64.trim()) {
      const jsonText = Buffer.from(b64.trim(), "base64").toString("utf8");
      sa = JSON.parse(jsonText);
    } else if (raw && raw.trim()) {
      // First try normal JSON.parse
      try {
        sa = JSON.parse(raw);
      } catch (e) {
        // If Netlify/UI inserted real newlines, repair by escaping them
        const repaired = raw.replace(/?
/g, "\n");
        sa = JSON.parse(repaired);
      }
    } else {
      throw new Error("FIREBASE_SERVICE_ACCOUNT(_B64) env missing");
    }
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT invalid: " + (e.message || e));
  }

  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}
  catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT invalid JSON"); }

  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

function resp(payload) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

function paymeResult(result, id) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function paymeError(code, message, data, id) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message: { uz: message, ru: message, en: message },
      data: data ?? null,
    },
  };
}

function parseBody(event) {
  if (!event || event.body == null) return null;
  if (typeof event.body === "object") return event.body;
  if (typeof event.body !== "string") return null;

  try { return JSON.parse(event.body); } catch (_) {}
  // fallback: urlencoded json
  try { return JSON.parse(decodeURIComponent(event.body)); } catch (_) {}
  return null;
}

// Payme odatda Authorization: Basic base64("Paycom:<KEY>")
function extractKey(headers = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[String(k).toLowerCase()] = v;

  const auth = h["authorization"];
  if (auth && typeof auth === "string" && auth.toLowerCase().startsWith("basic ")) {
    const b64 = auth.slice(6).trim();
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      if (idx !== -1) return decoded.slice(idx + 1);
    } catch (_) {}
  }

  // Some tools send X-Auth
  const x = h["x-auth"];
  if (typeof x === "string" && x.trim()) return x.trim();

  return null;
}

function normalizeAccount(params) {
  const acc = (params && params.account) || {};
  // Support different keys used in various UIs
  const orderId =
    acc.order_id ??
    acc.orderId ??
    acc.orders_id ??
    acc.ordersId ??
    acc.omId ??
    acc.omID ??
    null;

  return {
    orderId: orderId != null ? String(orderId) : null,
    raw: acc,
  };
}

function toNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function expectedAmountTiyin(orderSnap) {
  const d = orderSnap.data() || {};
  const aT = toNum(d.amountTiyin);
  if (aT != null) return Math.round(aT);
  const a = toNum(d.amount); // UZS
  if (a != null) return Math.round(a * 100);
  const total = toNum(d.totalUZS);
  if (total != null) return Math.round(total * 100);
  return null; // do not enforce if not provided
}

async function getOrder(db, orderId) {
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (snap.exists) return { ref, snap };

  // optional fallback by field
  const q = await db.collection("orders").where("omId", "==", orderId).limit(1).get();
  if (!q.empty) {
    const doc = q.docs[0];
    return { ref: doc.ref, snap: doc };
  }
  return null;
}

exports.handler = async (event) => {
  const body = parseBody(event);
  if (!body || typeof body !== "object") {
    return resp(paymeError(-32700, "Invalid JSON", "parse_error", null));
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = body.params || {};

  // Auth
  const serverKey = process.env.PAYME_KEY;
  const allowNoAuth = String(process.env.PAYME_ALLOW_NO_AUTH || "") === "1";
  const reqKey = extractKey(event.headers || {});
  if (!serverKey) return resp(paymeError(-32400, "Server PAYME_KEY missing", "server_config", id));

  if (!allowNoAuth) {
    if (!reqKey || reqKey !== serverKey) {
      return resp(paymeError(-32504, "Unauthorized", "auth", id));
    }
  }

  try {
    initFirebase();
    const db = admin.firestore();

    switch (method) {
      case "CheckPerformTransaction": {
        const amount = toNum(params.amount);
        const { orderId } = normalizeAccount(params);

        if (!orderId) return resp(paymeError(-31050, "Account not found", "order_id", id));
        if (amount == null || amount <= 0) return resp(paymeError(-31001, "Invalid amount", "amount", id));

        const found = await getOrder(db, orderId);
        if (!found) return resp(paymeError(-31050, "Account not found", "order", id));

        const exp = expectedAmountTiyin(found.snap);
        if (exp != null && Math.round(amount) !== exp) {
          return resp(paymeError(-31001, "Invalid amount", "amount_mismatch", id));
        }

        const status = (found.snap.data() || {}).status;
        if (status === "paid") {
          return resp(paymeError(-31050, "Account not found", "already_paid", id));
        }

        return resp(paymeResult({ allow: true }, id));
      }

      case "CreateTransaction": {
        const amount = toNum(params.amount);
        const { orderId, raw } = normalizeAccount(params);
        const time = toNum(params.time);
        const txId = params.id != null ? String(params.id) : null;

        if (!orderId) return resp(paymeError(-31050, "Account not found", "order_id", id));
        if (!txId) return resp(paymeError(-31099, "Transaction id missing", "id", id));
        if (amount == null || amount <= 0) return resp(paymeError(-31001, "Invalid amount", "amount", id));
        if (time == null) return resp(paymeError(-31099, "Time missing", "time", id));

        const found = await getOrder(db, orderId);
        if (!found) return resp(paymeError(-31050, "Account not found", "order", id));

        const exp = expectedAmountTiyin(found.snap);
        if (exp != null && Math.round(amount) !== exp) {
          return resp(paymeError(-31001, "Invalid amount", "amount_mismatch", id));
        }

        const txRef = db.collection("payme_transactions").doc(txId);
        const txSnap = await txRef.get();

        if (txSnap.exists) {
          const tx = txSnap.data() || {};
          if (tx.state === 1) {
            return resp(paymeResult({ create_time: tx.createTime || 0, transaction: txId, state: 1 }, id));
          }
          if (tx.state === 2) {
            return resp(paymeResult({ create_time: tx.createTime || 0, perform_time: tx.performTime || 0, transaction: txId, state: 2 }, id));
          }
          if (tx.state < 0) {
            return resp(paymeError(-31008, "Transaction cancelled", "cancelled", id));
          }
        }

        const createTime = Date.now();
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

        await found.ref.set({ status: "pending_payment", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

        return resp(paymeResult({ create_time: createTime, transaction: txId, state: 1 }, id));
      }

      case "PerformTransaction": {
        const txId = params.id != null ? String(params.id) : null;
        if (!txId) return resp(paymeError(-31099, "Transaction id missing", "id", id));

        const txRef = db.collection("payme_transactions").doc(txId);
        const txSnap = await txRef.get();
        if (!txSnap.exists) return resp(paymeError(-31003, "Transaction not found", "transaction", id));

        const tx = txSnap.data() || {};
        if (tx.state === 2) {
          return resp(paymeResult({ transaction: txId, perform_time: tx.performTime || 0, state: 2 }, id));
        }
        if (tx.state < 0) return resp(paymeError(-31008, "Transaction cancelled", "cancelled", id));

        const performTime = Date.now();

        await db.runTransaction(async (t) => {
          const found = await getOrder(db, tx.orderId);
          if (!found) throw new Error("order_not_found");

          const orderSnap = await t.get(found.ref);
          const order = orderSnap.data() || {};

          if (order.status !== "paid") {
            const paidPatch = { status: "paid", paidAt: admin.firestore.FieldValue.serverTimestamp() };
            // 1) mark global order paid
            t.set(found.ref, paidPatch, { merge: true });

            // 2) also mark user subcollection order paid (profile history)
            const ouid = (order.uid || order.userId || null);
            if (ouid) {
              const userOrderRef = db.collection("users").doc(String(ouid)).collection("orders").doc(String(found.ref.id));
              t.set(userOrderRef, paidPatch, { merge: true });
            }

            // 3) TOPUP/DEPOSIT: credit balance (UZS) when orderType == "topup"
            const ot = (order.orderType || order.type || "").toString().toLowerCase();
            if (ouid && (ot === "topup" || ot === "deposit")) {
              const addUZS = Number(order.totalUZS ?? Math.floor((tx.amount || 0) / 100)) || 0;
              if (addUZS > 0) {
                const userRef = db.collection("users").doc(String(ouid));
                t.set(userRef, { balanceUZS: admin.firestore.FieldValue.increment(addUZS), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
              }
            }
          }

          t.set(txRef, { state: 2, performTime, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });

        return resp(paymeResult({ transaction: txId, perform_time: performTime, state: 2 }, id));
      }

      case "CancelTransaction": {
        const txId = params.id != null ? String(params.id) : null;
        const reason = params.reason != null ? params.reason : null;
        if (!txId) return resp(paymeError(-31099, "Transaction id missing", "id", id));

        const txRef = db.collection("payme_transactions").doc(txId);
        const txSnap = await txRef.get();
        if (!txSnap.exists) return resp(paymeError(-31003, "Transaction not found", "transaction", id));

        const tx = txSnap.data() || {};
        if (tx.state < 0) {
          return resp(paymeResult({ transaction: txId, cancel_time: tx.cancelTime || 0, state: tx.state }, id));
        }

        const cancelTime = Date.now();
        const newState = tx.state === 2 ? -2 : -1;

        await db.runTransaction(async (t) => {
          const found = await getOrder(db, tx.orderId);
          if (found) {
            const os = await t.get(found.ref);
            const od = os.data() || {};
            if (newState === -1 && od.status !== "paid") {
              t.set(found.ref, { status: "canceled", canceledAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            } else if (newState === -2) {
              t.set(found.ref, { paymeReversalRequested: true }, { merge: true });
            }
          }
          t.set(txRef, { state: newState, cancelTime, reason, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        });

        return resp(paymeResult({ transaction: txId, cancel_time: cancelTime, state: newState }, id));
      }

      case "CheckTransaction": {
        const txId = params.id != null ? String(params.id) : null;
        if (!txId) return resp(paymeError(-31099, "Transaction id missing", "id", id));

        const txRef = db.collection("payme_transactions").doc(txId);
        const txSnap = await txRef.get();
        if (!txSnap.exists) return resp(paymeError(-31003, "Transaction not found", "transaction", id));

        const tx = txSnap.data() || {};
        return resp(
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

      default:
        return resp(paymeError(-32601, "Method not found", String(method), id));
    }
  } catch (e) {
    return resp(paymeError(-32400, "Internal server error", String(e.message || e), id));
  }
};

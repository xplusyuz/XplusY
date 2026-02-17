// netlify/functions/payme.js
const admin = require("firebase-admin");

function initFirebase() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64");
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  admin.initializeApp({ credential: admin.credential.cert(json) });
}
function db() { initFirebase(); return admin.firestore(); }

function rpcError(code, message, data = null) {
  return { error: { code, message: { ru: message, uz: message, en: message }, data } };
}
function rpcOk(result) { return { result }; }

function parseAuth(h) {
  if (!h || !h.startsWith("Basic ")) return null;
  const b64 = h.slice(6).trim();
  let decoded = "";
  try { decoded = Buffer.from(b64, "base64").toString("utf8"); } catch { return null; }
  const i = decoded.indexOf(":");
  if (i < 0) return null;
  return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
}

const ERR_AUTH = -32504;
const ERR_METHOD = -32601;
const ERR_PARAMS = -32602;

const ERR_CANNOT_PERFORM = -31050;
const ERR_TX_NOT_FOUND = -31003;
const ERR_TX_EXISTS = -31051;
const ERR_COULD_NOT_PERFORM = -31008;

const STATE_CREATED = 1;
const STATE_PERFORMED = 2;
const STATE_CANCELED = -1;

const TIMEOUT_MS = 12 * 60 * 1000; // 12 min

const now = () => Date.now();
const isInt = (n) => Number.isInteger(n);

function getTopupId(params) {
  const acc = params?.account;
  return acc?.order_id || acc?.topup_id || acc?.topupId || acc?.orderId || null;
}
function getAmount(params) { return params?.amount; }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    // --- AUTH ---
    const auth = parseAuth(event.headers.authorization || event.headers.Authorization);
    const env = (process.env.PAYME_ENV || "test").toLowerCase();
    const expectedKey = env === "prod" ? process.env.PAYME_PROD_KEY : process.env.PAYME_TEST_KEY;
    if (!auth || auth.user !== "Paycom" || auth.pass !== expectedKey) {
      return { statusCode: 200, body: JSON.stringify(rpcError(ERR_AUTH, "Неверная авторизация")) };
    }

    // --- JSON-RPC ---
    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 200, body: JSON.stringify(rpcError(-32600, "Invalid JSON")) }; }

    const { method, params, id } = body;
    if (!method) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(-32600, "Invalid Request") }) };

    const firestore = db();

    async function loadTopup(topupId) {
      const ref = firestore.collection("topups").doc(String(topupId));
      const snap = await ref.get();
      if (!snap.exists) return null;
      return { ref, data: snap.data() };
    }

    async function loadTx(txId) {
      const ref = firestore.collection("payme_tx").doc(String(txId));
      const snap = await ref.get();
      if (!snap.exists) return null;
      return { ref, data: snap.data() };
    }

    // ---------------- CheckPerformTransaction ----------------
    if (method === "CheckPerformTransaction") {
      const topupId = getTopupId(params);
      const amount = getAmount(params);

      if (!topupId || !isInt(amount) || amount <= 0) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };
      }

      const topup = await loadTopup(topupId);
      if (!topup) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Topup not found", "order_id") }) };

      if (topup.data.status === "paid") {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Already paid", "status") }) };
      }

      if (!isInt(topup.data.amountTiyin) || topup.data.amountTiyin !== amount) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ allow: true }) }) };
    }

    // ---------------- CreateTransaction ----------------
    if (method === "CreateTransaction") {
      const topupId = getTopupId(params);
      const amount = getAmount(params);
      const paymeTxId = params?.id;
      const create_time = params?.time;

      if (!topupId || !paymeTxId || !isInt(amount) || amount <= 0 || !isInt(create_time)) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };
      }

      const topup = await loadTopup(topupId);
      if (!topup) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Topup not found", "order_id") }) };

      if (topup.data.status === "paid") {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Already paid", "status") }) };
      }

      if (!isInt(topup.data.amountTiyin) || topup.data.amountTiyin !== amount) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      const txRef = firestore.collection("payme_tx").doc(String(paymeTxId));
      const txSnap = await txRef.get();

      if (txSnap.exists) {
        const tx = txSnap.data();
        // boshqa topup uchun bo‘lsa xato
        if (tx.topupId !== String(topupId) || tx.amount !== amount) {
          return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_TX_EXISTS, "Transaction already exists") }) };
        }
        // expired
        if (tx.state === STATE_CREATED && now() - tx.create_time > TIMEOUT_MS) {
          return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Transaction expired", "time") }) };
        }
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ create_time: tx.create_time, transaction: String(tx.id), state: tx.state }) }) };
      }

      await firestore.runTransaction(async (t) => {
        const fresh = await t.get(txRef);
        if (fresh.exists) return;

        t.set(txRef, {
          id: String(paymeTxId),
          topupId: String(topupId),
          uid: topup.data.uid || null,
          amount,
          state: STATE_CREATED,
          create_time,
          perform_time: 0,
          cancel_time: 0,
          reason: 0,
        });

        // topupni pending bo‘lib tursin
        if (topup.data.status !== "pending") {
          t.set(topup.ref, { status: "pending" }, { merge: true });
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ id, ...rpcOk({ create_time, transaction: String(paymeTxId), state: STATE_CREATED }) }),
      };
    }

    // ---------------- PerformTransaction (VERIFY) ----------------
    if (method === "PerformTransaction") {
      const paymeTxId = params?.id;
      if (!paymeTxId) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };

      const tx = await loadTx(paymeTxId);
      if (!tx) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }) };

      // idempotent
      if (tx.data.state === STATE_PERFORMED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(tx.data.id), perform_time: tx.data.perform_time, state: tx.data.state }) }) };
      }
      if (tx.data.state === STATE_CANCELED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_COULD_NOT_PERFORM, "Transaction canceled") }) };
      }
      if (now() - tx.data.create_time > TIMEOUT_MS) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Transaction expired", "time") }) };
      }

      const topup = await loadTopup(tx.data.topupId);
      if (!topup) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Topup not found", "order_id") }) };

      if (topup.data.status === "paid") {
        // agar topup paid bo‘lsa ham tx ni performed qilib qaytaramiz (idempotentga yaqin)
        const pt = tx.data.perform_time || now();
        if (tx.data.state !== STATE_PERFORMED) {
          await tx.ref.set({ state: STATE_PERFORMED, perform_time: pt }, { merge: true });
        }
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(paymeTxId), perform_time: pt, state: STATE_PERFORMED }) }) };
      }

      // amount must match
      if (!isInt(topup.data.amountTiyin) || topup.data.amountTiyin !== tx.data.amount) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      const performTime = now();

      // ATOMIK: topup=paid + user balance += amount + tx performed
      await firestore.runTransaction(async (t) => {
        const freshTx = await t.get(tx.ref);
        const cur = freshTx.data();
        if (cur.state === STATE_PERFORMED) return;
        if (cur.state === STATE_CANCELED) throw new Error("canceled");
        if (now() - cur.create_time > TIMEOUT_MS) throw new Error("expired");

        const topupRef = topup.ref;
        const topupSnap = await t.get(topupRef);
        if (!topupSnap.exists) throw new Error("topup missing");
        const top = topupSnap.data();

        if (top.status === "paid") {
          t.set(tx.ref, { state: STATE_PERFORMED, perform_time: top.paidAt ? performTime : performTime }, { merge: true });
          return;
        }

        // user balance increment
        const userRef = firestore.collection("users").doc(String(top.uid));
        t.set(userRef, { balanceTiyin: admin.firestore.FieldValue.increment(cur.amount) }, { merge: true });

        // mark paid
        t.set(topupRef, { status: "paid", paidAt: admin.firestore.FieldValue.serverTimestamp(), paymeTransactionId: String(paymeTxId) }, { merge: true });

        // mark tx performed
        t.set(tx.ref, { state: STATE_PERFORMED, perform_time: performTime }, { merge: true });
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(paymeTxId), perform_time: performTime, state: STATE_PERFORMED }) }) };
    }

    // ---------------- CancelTransaction ----------------
    if (method === "CancelTransaction") {
      const paymeTxId = params?.id;
      const reason = params?.reason;
      if (!paymeTxId || !isInt(reason)) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };

      const tx = await loadTx(paymeTxId);
      if (!tx) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }) };

      if (tx.data.state === STATE_CANCELED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(paymeTxId), cancel_time: tx.data.cancel_time, state: tx.data.state }) }) };
      }

      const cancelTime = now();

      await db().runTransaction(async (t) => {
        const fresh = await t.get(tx.ref);
        const cur = fresh.data();

        const topup = await loadTopup(cur.topupId);

        // paid bo‘lsa refund siyosatga bog‘liq — hozir topupni cancel qilmaymiz
        if (topup && topup.data.status !== "paid") {
          t.set(topup.ref, { status: "canceled", canceledAt: admin.firestore.FieldValue.serverTimestamp(), cancelReason: reason }, { merge: true });
        }

        t.set(tx.ref, { state: STATE_CANCELED, cancel_time: cancelTime, reason }, { merge: true });
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(paymeTxId), cancel_time: cancelTime, state: STATE_CANCELED }) }) };
    }

    // ---------------- CheckTransaction ----------------
    if (method === "CheckTransaction") {
      const paymeTxId = params?.id;
      if (!paymeTxId) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };

      const tx = await loadTx(paymeTxId);
      if (!tx) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }) };

      const txx = tx.data;
      return {
        statusCode: 200,
        body: JSON.stringify({
          id,
          ...rpcOk({
            create_time: txx.create_time,
            perform_time: txx.perform_time || 0,
            cancel_time: txx.cancel_time || 0,
            transaction: String(txx.id),
            state: txx.state,
            reason: txx.reason || 0,
          }),
        }),
      };
    }

    // ---------------- GetStatement ----------------
    if (method === "GetStatement") {
      const from = params?.from, to = params?.to;
      if (!isInt(from) || !isInt(to)) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };

      const snap = await db()
        .collection("payme_tx")
        .where("create_time", ">=", from)
        .where("create_time", "<=", to)
        .get();

      const transactions = snap.docs.map((d) => {
        const tx = d.data();
        return {
          id: String(tx.id),
          time: tx.create_time,
          amount: tx.amount,
          account: { order_id: tx.topupId },
          create_time: tx.create_time,
          perform_time: tx.perform_time || 0,
          cancel_time: tx.cancel_time || 0,
          transaction: String(tx.id),
          state: tx.state,
          reason: tx.reason || 0,
        };
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transactions }) }) };
    }

    // Unknown method
    return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_METHOD, "Method not found") }) };

  } catch (e) {
    return { statusCode: 200, body: JSON.stringify(rpcError(-32400, "Internal error", String(e?.message || e))) };
  }
};

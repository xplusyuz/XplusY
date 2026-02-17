const admin = require("firebase-admin");

function initFirebase() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 || process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!b64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64");
  let json;
  try {
    // support either raw json or base64 json
    if (b64.trim().startsWith("{")) json = JSON.parse(b64);
    else json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch (e) {
    throw new Error("Bad FIREBASE_SERVICE_ACCOUNT_B64");
  }
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

const TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const now = () => Date.now();
const isInt = (n) => Number.isInteger(n);

function getAccountId(params) {
  const acc = params?.account;
  return acc?.order_id || acc?.orderId || acc?.topup_id || acc?.topupId || null;
}
function getAmount(params) { return params?.amount; } // tiyin

async function loadBusinessDoc(firestore, id) {
  // Support both: orders/{id} OR topups/{id}
  const oRef = firestore.collection("orders").doc(String(id));
  const oSnap = await oRef.get();
  if (oSnap.exists) return { type: "order", ref: oRef, data: oSnap.data() };

  const tRef = firestore.collection("topups").doc(String(id));
  const tSnap = await tRef.get();
  if (tSnap.exists) return { type: "topup", ref: tRef, data: tSnap.data() };

  return null;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    // AUTH
    const auth = parseAuth(event.headers.authorization || event.headers.Authorization);
    const env = (process.env.PAYME_ENV || "test").toLowerCase();
    const expectedKey =
      (env === "prod" ? process.env.PAYME_PROD_KEY : process.env.PAYME_TEST_KEY) ||
      process.env.PAYME_KEY || // backward compat
      process.env.PAYME_KEY_TEST || "";

    if (!auth || auth.user !== "Paycom" || auth.pass !== expectedKey) {
      return { statusCode: 200, body: JSON.stringify(rpcError(ERR_AUTH, "Неверная авторизация")) };
    }

    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return { statusCode: 200, body: JSON.stringify(rpcError(-32600, "Invalid JSON")) }; }

    const { method, params, id } = body || {};
    if (!method) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(-32600, "Invalid Request") }) };

    const firestore = db();

    const txCol = firestore.collection("payme_tx");
    const txById = (txId) => txCol.doc(String(txId));

    // CheckPerformTransaction
    if (method === "CheckPerformTransaction") {
      const accountId = getAccountId(params);
      const amount = getAmount(params);
      if (!accountId || !isInt(amount) || amount <= 0) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };
      }

      const doc = await loadBusinessDoc(firestore, accountId);
      if (!doc) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Order not found", "order_id") }) };

      const status = doc.data.status;
      if (status === "paid") return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Already paid", "status") }) };

      const expected = doc.data.amountTiyin ?? (isInt(doc.data.totalUZS) ? Math.round(doc.data.totalUZS * 100) : null);
      if (!isInt(expected) || expected !== amount) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ allow: true }) }) };
    }

    // CreateTransaction
    if (method === "CreateTransaction") {
      const accountId = getAccountId(params);
      const amount = getAmount(params);
      const paymeTxId = params?.id;
      const create_time = params?.time;

      if (!accountId || !paymeTxId || !isInt(amount) || amount <= 0 || !isInt(create_time)) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };
      }

      const doc = await loadBusinessDoc(firestore, accountId);
      if (!doc) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Order not found", "order_id") }) };

      if (doc.data.status === "paid") {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Already paid", "status") }) };
      }

      const expected = doc.data.amountTiyin ?? (isInt(doc.data.totalUZS) ? Math.round(doc.data.totalUZS * 100) : null);
      if (!isInt(expected) || expected !== amount) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      const txRef = txById(paymeTxId);
      const txSnap = await txRef.get();

      if (txSnap.exists) {
        const tx = txSnap.data();
        if (tx.accountId !== String(accountId) || tx.amount !== amount) {
          return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_TX_EXISTS, "Transaction already exists") }) };
        }
        if (tx.state === STATE_CREATED && now() - tx.create_time > TIMEOUT_MS) {
          return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Transaction expired", "time") }) };
        }
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ create_time: tx.create_time, transaction: String(tx.id), state: tx.state }) }) };
      }

      await firestore.runTransaction(async (t) => {
        const fresh = await t.get(txRef);
        if (fresh.exists) return;

        // mark pending
        if (doc.data.status !== "pending_payment") {
          t.set(doc.ref, { status: "pending_payment", paymePendingAt: now() }, { merge: true });
        }

        t.set(txRef, {
          id: String(paymeTxId),
          accountId: String(accountId),
          uid: doc.data.uid || null,
          amount,
          state: STATE_CREATED,
          create_time,
          perform_time: 0,
          cancel_time: 0,
          reason: 0,
        });
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ create_time, transaction: String(paymeTxId), state: STATE_CREATED }) }) };
    }

    // PerformTransaction (VERIFY)
    if (method === "PerformTransaction") {
      const paymeTxId = params?.id;
      if (!paymeTxId) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };

      const txRef = txById(paymeTxId);
      const txSnap = await txRef.get();
      if (!txSnap.exists) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }) };
      const tx = txSnap.data();

      if (tx.state === STATE_PERFORMED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(tx.id), perform_time: tx.perform_time, state: tx.state }) }) };
      }
      if (tx.state === STATE_CANCELED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_COULD_NOT_PERFORM, "Transaction canceled") }) };
      }
      if (now() - tx.create_time > TIMEOUT_MS) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Transaction expired", "time") }) };
      }

      const doc = await loadBusinessDoc(firestore, tx.accountId);
      if (!doc) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Order not found", "order_id") }) };

      const expected = doc.data.amountTiyin ?? (isInt(doc.data.totalUZS) ? Math.round(doc.data.totalUZS * 100) : null);
      if (!isInt(expected) || expected !== tx.amount) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      const performTime = now();

      await firestore.runTransaction(async (t) => {
        const freshTx = await t.get(txRef);
        const cur = freshTx.data();
        if (cur.state === STATE_PERFORMED) return;
        if (cur.state === STATE_CANCELED) throw new Error("canceled");
        if (now() - cur.create_time > TIMEOUT_MS) throw new Error("expired");

        const docSnap = await t.get(doc.ref);
        if (!docSnap.exists) throw new Error("order_missing");
        const curDoc = docSnap.data();

        if (curDoc.status !== "paid") {
          // If this is a TOPUP order, credit user balance (tiyin)
          const isTopup = (curDoc.orderType === "topup") || (doc.type === "topup");
          if (isTopup && curDoc.uid) {
            const userRef = firestore.collection("users").doc(String(curDoc.uid));
            t.set(userRef, { balanceTiyin: admin.firestore.FieldValue.increment(cur.amount) }, { merge: true });
          }

          // Mark paid
          t.set(doc.ref, {
            status: "paid",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            paymeTransactionId: String(paymeTxId),
          }, { merge: true });
        }

        t.set(txRef, { state: STATE_PERFORMED, perform_time: performTime }, { merge: true });
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(paymeTxId), perform_time: performTime, state: STATE_PERFORMED }) }) };
    }

    // CancelTransaction
    if (method === "CancelTransaction") {
      const paymeTxId = params?.id;
      const reason = params?.reason;
      if (!paymeTxId || !isInt(reason)) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };

      const txRef = txById(paymeTxId);
      const txSnap = await txRef.get();
      if (!txSnap.exists) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }) };

      const tx = txSnap.data();
      if (tx.state === STATE_CANCELED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(paymeTxId), cancel_time: tx.cancel_time, state: tx.state }) }) };
      }

      const cancelTime = now();

      await firestore.runTransaction(async (t) => {
        const fresh = await t.get(txRef);
        const cur = fresh.data();
        const doc = await loadBusinessDoc(firestore, cur.accountId);

        // If not paid yet, mark canceled
        if (doc) {
          const docSnap = await t.get(doc.ref);
          if (docSnap.exists) {
            const d = docSnap.data();
            if (d.status !== "paid") {
              t.set(doc.ref, { status: "canceled", canceledAt: admin.firestore.FieldValue.serverTimestamp(), cancelReason: reason }, { merge: true });
            }
          }
        }

        t.set(txRef, { state: STATE_CANCELED, cancel_time: cancelTime, reason }, { merge: true });
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transaction: String(paymeTxId), cancel_time: cancelTime, state: STATE_CANCELED }) }) };
    }

    // CheckTransaction
    if (method === "CheckTransaction") {
      const paymeTxId = params?.id;
      if (!paymeTxId) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };

      const txSnap = await txById(paymeTxId).get();
      if (!txSnap.exists) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }) };
      const tx = txSnap.data();

      return {
        statusCode: 200,
        body: JSON.stringify({
          id,
          ...rpcOk({
            create_time: tx.create_time,
            perform_time: tx.perform_time || 0,
            cancel_time: tx.cancel_time || 0,
            transaction: String(tx.id),
            state: tx.state,
            reason: tx.reason || 0,
          }),
        }),
      };
    }

    // GetStatement
    if (method === "GetStatement") {
      const from = params?.from, to = params?.to;
      if (!isInt(from) || !isInt(to)) return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_PARAMS, "Invalid params") }) };

      const snap = await txCol.where("create_time", ">=", from).where("create_time", "<=", to).get();
      const transactions = snap.docs.map((d) => {
        const txx = d.data();
        return {
          id: String(txx.id),
          time: txx.create_time,
          amount: txx.amount,
          account: { order_id: txx.accountId },
          create_time: txx.create_time,
          perform_time: txx.perform_time || 0,
          cancel_time: txx.cancel_time || 0,
          transaction: String(txx.id),
          state: txx.state,
          reason: txx.reason || 0,
        };
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...rpcOk({ transactions }) }) };
    }

    return { statusCode: 200, body: JSON.stringify({ id, ...rpcError(ERR_METHOD, "Method not found") }) };

  } catch (e) {
    return { statusCode: 200, body: JSON.stringify(rpcError(-32400, "Internal error", String(e?.message || e))) };
  }
};

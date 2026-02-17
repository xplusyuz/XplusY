/* netlify/functions/payme.js */
const admin = require("firebase-admin");

function getFirestore() {
  if (!admin.apps.length) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!b64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64");

    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    admin.initializeApp({ credential: admin.credential.cert(json) });
  }
  return admin.firestore();
}

function paymeError(code, message, data = null) {
  return {
    error: { code, message: { ru: message, uz: message, en: message }, data },
  };
}

function ok(result) {
  return { result };
}

function parseAuth(header) {
  // Payme: Basic base64("Paycom:<key>")
  if (!header || !header.startsWith("Basic ")) return null;
  const b64 = header.slice(6).trim();
  let decoded = "";
  try {
    decoded = Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return null;
  }
  // decoded = "Paycom:test_key"
  const idx = decoded.indexOf(":");
  if (idx < 0) return null;
  return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
}

function nowMs() {
  return Date.now();
}

function isInt(n) {
  return Number.isInteger(n);
}

// Payme states: 1=created, 2=performed, -1=canceled
const STATE_CREATED = 1;
const STATE_PERFORMED = 2;
const STATE_CANCELED = -1;

// Payme standard errors (amaliyotda ishlatiladiganlar)
const ERR_AUTH = -32504;          // Unauthorized
const ERR_RPC = -32600;           // Invalid Request
const ERR_METHOD = -32601;        // Method not found
const ERR_INVALID_PARAMS = -32602;// Invalid params

// Biznes errorlari (ko‘p integratsiyada ishlatiladi)
const ERR_CANNOT_PERFORM = -31050;   // Transaction cannot be performed
const ERR_TRANSACTION_NOT_FOUND = -31003;
const ERR_TRANSACTION_ALREADY_EXISTS = -31051;
const ERR_COULD_NOT_PERFORM = -31008;

const PAYME_TIMEOUT_MS = 12 * 60 * 1000; // 12 daqiqa (ko‘pincha 12 min)
function isExpired(create_time) {
  return nowMs() - create_time > PAYME_TIMEOUT_MS;
}

// Sizning biznes: orderId yoki topupId
function getAccountOrderId(params) {
  // Payme odatda params.account.order_id yuboradi (siz xohlagan nom)
  const acc = params && params.account;
  if (!acc) return null;
  return acc.order_id || acc.orderId || acc.topup_id || acc.topupId || null;
}

// Amount: Payme tiyin yuboradi (UZS*100)
function normalizeAmount(params) {
  const a = params && params.amount;
  return a;
}

exports.handler = async (event) => {
  try {
    // Only POST
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Auth check
    const auth = parseAuth(event.headers.authorization || event.headers.Authorization);
    const env = (process.env.PAYME_ENV || "test").toLowerCase();
    const expectedKey = env === "prod" ? process.env.PAYME_PROD_KEY : process.env.PAYME_TEST_KEY;

    if (!auth || auth.user !== "Paycom" || auth.pass !== expectedKey) {
      return {
        statusCode: 200,
        body: JSON.stringify(paymeError(ERR_AUTH, "Неверная авторизация")),
      };
    }

    // Parse JSON-RPC
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 200, body: JSON.stringify(paymeError(ERR_RPC, "Invalid JSON")) };
    }

    const { method, params, id } = body || {};
    if (!method || typeof method !== "string") {
      return { statusCode: 200, body: JSON.stringify(paymeError(ERR_RPC, "Invalid Request")) };
    }

    const db = getFirestore();

    // Helper: load order/topup
    async function loadBusinessDoc(orderId) {
      // Sizda orderlar bo‘lishi mumkin:
      // /orders/{orderId}
      // yoki balans topup: /topups/{orderId}
      // Hozir order sifatida tekshiramiz, topup bo‘lsa keyin moslab olasiz.
      const ref = db.collection("orders").doc(orderId);
      const snap = await ref.get();
      if (snap.exists) return { type: "order", ref, data: snap.data() };

      const ref2 = db.collection("topups").doc(orderId);
      const snap2 = await ref2.get();
      if (snap2.exists) return { type: "topup", ref: ref2, data: snap2.data() };

      return null;
    }

    // ==== METHODS ====

    // 1) CheckPerformTransaction
    if (method === "CheckPerformTransaction") {
      const orderId = getAccountOrderId(params);
      const amount = normalizeAmount(params);

      if (!orderId || !isInt(amount) || amount <= 0) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_INVALID_PARAMS, "Invalid params") }) };
      }

      const doc = await loadBusinessDoc(orderId);
      if (!doc) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Order not found", "order_id") }) };
      }

      // ✅ Biznes qoidasi: order allaqachon paid bo‘lsa — qayta to‘lab bo‘lmaydi
      if (doc.data.status === "paid") {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Already paid", "status") }) };
      }

      // ✅ Amount check (MUHIM!)
      // Sizning orderda amountUZS yoki amountTiyin bo‘lishi mumkin.
      // Tavsiya: orders.amountTiyin saqlang.
      const expected = doc.data.amountTiyin ?? (isInt(doc.data.amountUZS) ? doc.data.amountUZS * 100 : null);
      if (!isInt(expected)) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Order amount missing", "amount") }) };
      }
      if (amount !== expected) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      return { statusCode: 200, body: JSON.stringify({ id, ...ok({ allow: true }) }) };
    }

    // 2) CreateTransaction
    if (method === "CreateTransaction") {
      const orderId = getAccountOrderId(params);
      const amount = normalizeAmount(params);
      const transactionId = params && params.id;
      const create_time = params && params.time; // Payme ms

      if (!orderId || !transactionId || !isInt(amount) || amount <= 0 || !isInt(create_time)) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_INVALID_PARAMS, "Invalid params") }) };
      }

      // order check
      const doc = await loadBusinessDoc(orderId);
      if (!doc) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Order not found", "order_id") }) };
      }
      if (doc.data.status === "paid") {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Already paid", "status") }) };
      }

      const expected = doc.data.amountTiyin ?? (isInt(doc.data.amountUZS) ? doc.data.amountUZS * 100 : null);
      if (!isInt(expected) || amount !== expected) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      const txRef = db.collection("payme_tx").doc(String(transactionId));
      const txSnap = await txRef.get();

      // Idempotency: Agar tx bor bo‘lsa, holatiga qarab qaytaradi
      if (txSnap.exists) {
        const tx = txSnap.data();
        // expired bo‘lsa yaratishga ruxsat yo‘q (Payme’da odatda cancel qaytadi)
        if (tx.state === STATE_CREATED && isExpired(tx.create_time)) {
          return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Transaction expired", "time") }) };
        }

        // Agar boshqa orderga tegishli bo‘lsa – xato
        if (tx.orderId !== orderId || tx.amount !== amount) {
          return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_TRANSACTION_ALREADY_EXISTS, "Transaction already exists") }) };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            id,
            ...ok({
              create_time: tx.create_time,
              transaction: String(tx.id),
              state: tx.state,
            }),
          }),
        };
      }

      // Create new tx
      await db.runTransaction(async (t) => {
        const txSnap2 = await t.get(txRef);
        if (txSnap2.exists) return;

        // order statusni "pending_payment" qilish (ixtiyoriy)
        if (doc.data.status !== "pending_payment") {
          t.set(doc.ref, { status: "pending_payment", paymePendingAt: nowMs() }, { merge: true });
        }

        t.set(txRef, {
          id: String(transactionId),
          orderId,
          uid: doc.data.uid || null,
          amount,
          state: STATE_CREATED,
          create_time,
          perform_time: 0,
          cancel_time: 0,
          reason: 0,
          merchantTransId: orderId,
        });
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          id,
          ...ok({
            create_time,
            transaction: String(transactionId),
            state: STATE_CREATED,
          }),
        }),
      };
    }

    // 3) PerformTransaction  (ASOSIY VERIFY)
    if (method === "PerformTransaction") {
      const transactionId = params && params.id;
      if (!transactionId) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_INVALID_PARAMS, "Invalid params") }) };
      }

      const txRef = db.collection("payme_tx").doc(String(transactionId));
      const txSnap = await txRef.get();
      if (!txSnap.exists) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_TRANSACTION_NOT_FOUND, "Transaction not found") }) };
      }

      const tx = txSnap.data();

      // Allaqachon performed bo‘lsa — idempotent qaytaradi
      if (tx.state === STATE_PERFORMED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...ok({ transaction: String(tx.id), perform_time: tx.perform_time, state: tx.state }) }) };
      }

      // canceled bo‘lsa — perform bo‘lmaydi
      if (tx.state === STATE_CANCELED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_COULD_NOT_PERFORM, "Transaction canceled") }) };
      }

      // expired
      if (tx.state === STATE_CREATED && isExpired(tx.create_time)) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Transaction expired", "time") }) };
      }

      // Order/topup tekshirish
      const doc = await loadBusinessDoc(tx.orderId);
      if (!doc) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Order not found", "order_id") }) };
      }

      // amount must match
      const expected = doc.data.amountTiyin ?? (isInt(doc.data.amountUZS) ? doc.data.amountUZS * 100 : null);
      if (!isInt(expected) || expected !== tx.amount) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_CANNOT_PERFORM, "Invalid amount", "amount") }) };
      }

      // Transactional perform: tx=performed + order=paid (yoki topup=done) — atomik
      const performTime = nowMs();

      await db.runTransaction(async (t) => {
        const freshTx = await t.get(txRef);
        if (!freshTx.exists) throw new Error("tx missing");
        const cur = freshTx.data();

        if (cur.state === STATE_PERFORMED) return; // idempotent
        if (cur.state === STATE_CANCELED) throw new Error("canceled");
        if (isExpired(cur.create_time)) throw new Error("expired");

        // order paid qilish
        t.set(doc.ref, { status: "paid", paidAt: performTime, paymeTransactionId: String(transactionId) }, { merge: true });

        // (Agar topup bo‘lsa) user balance oshirishni shu yerda qiling:
        // if (doc.type === "topup") { ... t.update(userRef, { balanceTiyin: admin.firestore.FieldValue.increment(cur.amount) }) }

        t.set(txRef, { state: STATE_PERFORMED, perform_time: performTime }, { merge: true });
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ id, ...ok({ transaction: String(transactionId), perform_time: performTime, state: STATE_PERFORMED }) }),
      };
    }

    // 4) CancelTransaction
    if (method === "CancelTransaction") {
      const transactionId = params && params.id;
      const reason = params && params.reason;

      if (!transactionId || !isInt(reason)) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_INVALID_PARAMS, "Invalid params") }) };
      }

      const txRef = db.collection("payme_tx").doc(String(transactionId));
      const txSnap = await txRef.get();
      if (!txSnap.exists) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_TRANSACTION_NOT_FOUND, "Transaction not found") }) };
      }
      const tx = txSnap.data();

      // allaqachon canceled
      if (tx.state === STATE_CANCELED) {
        return { statusCode: 200, body: JSON.stringify({ id, ...ok({ transaction: String(tx.id), cancel_time: tx.cancel_time, state: tx.state }) }) };
      }

      const cancelTime = nowMs();

      await db.runTransaction(async (t) => {
        const freshTx = await t.get(txRef);
        const cur = freshTx.data();

        // performed bo‘lsa ham cancel bo‘lishi mumkin (biznes qoidaga bog‘liq),
        // lekin orderni ham canceled qilish kerak. Siz xohlasangiz performedni cancel qilishni bloklashingiz ham mumkin.
        const doc = await loadBusinessDoc(cur.orderId);

        if (doc) {
          // Agar paid bo‘lsa va siz refund logikasiz bekor qilishni xohlamasangiz, shu yerda xatoga qaytaring.
          // Hozir esa order statusini canceled qilamiz:
          t.set(doc.ref, { status: "canceled", canceledAt: cancelTime, cancelReason: reason }, { merge: true });
        }

        t.set(txRef, { state: STATE_CANCELED, cancel_time: cancelTime, reason }, { merge: true });
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...ok({ transaction: String(transactionId), cancel_time: cancelTime, state: STATE_CANCELED }) }) };
    }

    // 5) CheckTransaction
    if (method === "CheckTransaction") {
      const transactionId = params && params.id;
      if (!transactionId) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_INVALID_PARAMS, "Invalid params") }) };
      }

      const txSnap = await db.collection("payme_tx").doc(String(transactionId)).get();
      if (!txSnap.exists) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_TRANSACTION_NOT_FOUND, "Transaction not found") }) };
      }
      const tx = txSnap.data();

      return {
        statusCode: 200,
        body: JSON.stringify({
          id,
          ...ok({
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

    // 6) GetStatement
    if (method === "GetStatement") {
      const from = params && params.from;
      const to = params && params.to;
      if (!isInt(from) || !isInt(to)) {
        return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_INVALID_PARAMS, "Invalid params") }) };
      }

      // Firestore query (create_time range)
      const snap = await db
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
          account: { order_id: tx.orderId },
          create_time: tx.create_time,
          perform_time: tx.perform_time || 0,
          cancel_time: tx.cancel_time || 0,
          transaction: String(tx.id),
          state: tx.state,
          reason: tx.reason || 0,
        };
      });

      return { statusCode: 200, body: JSON.stringify({ id, ...ok({ transactions }) }) };
    }

    // Unknown method
    return { statusCode: 200, body: JSON.stringify({ id, ...paymeError(ERR_METHOD, "Method not found") }) };
  } catch (e) {
    // Fail-safe: Payme JSON-RPC doim JSON qaytarishi kerak
    return { statusCode: 200, body: JSON.stringify(paymeError(-32400, "Internal error", String(e && e.message ? e.message : e))) };
  }
};

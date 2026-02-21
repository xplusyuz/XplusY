/**
 * Netlify Function: Payme Billing + Verify (automatic balance top-up)
 *
 * Requirements (ENV):
 *  - PAYME_KEY                         (merchant API key/password)
 *  - FIREBASE_SERVICE_ACCOUNT_B64      (base64 JSON service account)
 *
 * Optional (ENV):
 *  - PAYME_MIN_TOPUP_UZS               (default 1000)
 *
 * Account fields:
 *  - account.user_id  => numeric user id (1000+)
 */
const admin = require("firebase-admin");

function json(statusCode, obj, headers = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
    body: JSON.stringify(obj),
  };
}

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;
  const rawB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 || "";
  if (!rawB64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64");
  const b64 = String(rawB64).replace(/\s+/g, "");
  const jsonString = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(jsonString);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return admin;
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
}

function parseBasicAuth(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return null;
  const m = authHeader.match(/^Basic\s+(.+)$/i);
  if (!m) return null;
  try {
    const decoded = Buffer.from(m[1], "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return { user: decoded, pass: "" };
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function authValid(headers) {
  const key = process.env.PAYME_KEY;
  if (!key) return false;
  const parsed = parseBasicAuth(headers.authorization || headers.Authorization);
  if (!parsed) return false;
  const login = (parsed.user || "").toLowerCase();
  const userOk = login === "paycom" || login === "payme";
  return userOk && parsed.pass === key;
}

function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function err(id, code, message, data = null) {
  const out = { jsonrpc: "2.0", id, error: { code, message } };
  if (data !== null) out.error.data = data;
  return out;
}

const MSG = {
  ACCOUNT_NOT_FOUND: { uz: "Hisob topilmadi", ru: "Счет не найден", en: "Account not found" },
  INVALID_AMOUNT: { uz: "Noto‘g‘ri summa", ru: "Неверная сумма", en: "Invalid amount" },
  TX_NOT_FOUND: { uz: "Tranzaksiya topilmadi", ru: "Транзакция не найдена", en: "Transaction not found" },
  CANNOT_CANCEL: { uz: "Bekor qilib bo‘lmaydi", ru: "Нельзя отменить", en: "Cannot cancel" },
  INTERNAL: { uz: "Server xatosi", ru: "Внутренняя ошибка", en: "Internal error" },
};

function asInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(200, { ok: true, note: "Payme JSON-RPC endpoint. POST only." });
  }

  const body = parseBody(event);

  // Paycom/Payme sandbox expects JSON-RPC error with HTTP 200 (not 401).
  if (!authValid(event.headers || {})) {
    return json(200, {
      jsonrpc: "2.0",
      id: body && typeof body.id !== "undefined" ? body.id : null,
      error: { code: -32504, message: "Unauthorized" }
    }, { "Content-Type": "application/json" });
  }

  if (!body || !body.method) {
    return json(200, err(body?.id ?? null, -32600, MSG.INTERNAL, "bad_request"));
  }

  const { id, method, params } = body;
  const account = (params && params.account) || {};
  const userIdRaw = account.user_id ?? account.userId ?? null;
  const userNumericId = String(userIdRaw || "").trim();
  const amountTiyin = asInt(params?.amount);
  const minTopup = asInt(process.env.PAYME_MIN_TOPUP_UZS || "1000");
  const minTiyin = Number.isFinite(minTopup) ? minTopup * 100 : 1000 * 100;

  try {
    initFirebase();
    const db = admin.firestore();

    // Helpers
    const getUidByNumericId = async (numericId) => {
      const ref = db.collection("users_by_numeric").doc(String(numericId));
      const snap = await ref.get();
      if (!snap.exists) return null;
      const d = snap.data() || {};
      return d.uid || null;
    };

    const txRefByPaymeId = (paymeId) => db.collection("payme_transactions").doc(String(paymeId));

    // Payme method handlers
    switch (method) {
      case "CheckPerformTransaction": {
        if (!userNumericId) return json(200, err(id, -31050, MSG.ACCOUNT_NOT_FOUND));
        if (!Number.isFinite(amountTiyin) || amountTiyin < minTiyin) return json(200, err(id, -31001, MSG.INVALID_AMOUNT));

        const uid = await getUidByNumericId(userNumericId);
        if (!uid) return json(200, err(id, -31050, MSG.ACCOUNT_NOT_FOUND));

        return json(200, ok(id, { allow: true }));
      }

      case "CreateTransaction": {
        const paymeId = String(params?.id || "").trim();
        const time = asInt(params?.time);

        if (!paymeId) return json(200, err(id, -31003, MSG.TX_NOT_FOUND));
        if (!userNumericId) return json(200, err(id, -31050, MSG.ACCOUNT_NOT_FOUND));
        if (!Number.isFinite(amountTiyin) || amountTiyin < minTiyin) return json(200, err(id, -31001, MSG.INVALID_AMOUNT));

        const uid = await getUidByNumericId(userNumericId);
        if (!uid) return json(200, err(id, -31050, MSG.ACCOUNT_NOT_FOUND));

        const ref = txRefByPaymeId(paymeId);
        const snap = await ref.get();
        if (snap.exists) {
          const t = snap.data() || {};
          // If already created/performed, return existing create_time
          return json(200, ok(id, { create_time: t.create_time ?? time ?? Date.now(), transaction: paymeId, state: t.state ?? 1 }));
        }

        const createTime = Number.isFinite(time) ? time : Date.now();
        await ref.set({
          payme_id: paymeId,
          userNumericId: String(userNumericId),
          uid,
          amount: amountTiyin,
          state: 1,
          create_time: createTime,
          perform_time: null,
          cancel_time: null,
          reason: null,
          orderType: "topup",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return json(200, ok(id, { create_time: createTime, transaction: paymeId, state: 1 }));
      }

      case "PerformTransaction": {
        const paymeId = String(params?.id || "").trim();
        if (!paymeId) return json(200, err(id, -31003, MSG.TX_NOT_FOUND));

        const ref = txRefByPaymeId(paymeId);

        const res = await db.runTransaction(async (tx) => {
          const tSnap = await tx.get(ref);
          if (!tSnap.exists) {
            throw Object.assign(new Error("tx_not_found"), { code: -31003 });
          }
          const t = tSnap.data() || {};
          if (t.state === 2) {
            return { perform_time: t.perform_time ?? Date.now(), transaction: paymeId, state: 2 };
          }
          if (t.state && t.state < 0) {
            throw Object.assign(new Error("cannot_perform"), { code: -31008 });
          }

          const uid = t.uid;
          const amount = asInt(t.amount);
          if (!uid) throw Object.assign(new Error("account_not_found"), { code: -31050 });

          const userRef = db.collection("users").doc(uid);
          const uSnap = await tx.get(userRef);
          if (!uSnap.exists) throw Object.assign(new Error("account_not_found"), { code: -31050 });
          const u = uSnap.data() || {};
          const bal = asInt(u.balanceUZS || 0);
          const addUZS = Math.trunc(amount / 100);

          // credit balance (UZS)
          tx.set(userRef, { balanceUZS: (Number.isFinite(bal) ? bal : 0) + addUZS, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

          const performTime = Date.now();
          tx.set(ref, { state: 2, perform_time: performTime, performedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

          // Also create a topup order (for history)
          const orderId = `topup_${paymeId}`;
          const orderRef = db.collection("orders").doc(orderId);
          tx.set(orderRef, {
            orderId,
            uid,
            numericId: t.userNumericId || null,
            userName: u.name || null,
            userPhone: u.phone || null,
            status: "paid",
            items: [],
            totalUZS: addUZS,
            amountTiyin: amount,
            provider: "payme",
            shipping: null,
            orderType: "topup",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: "payme",
          }, { merge: true });

          // user subcollection
          const userOrderRef = userRef.collection("orders").doc(orderId);
          tx.set(userOrderRef, {
            orderId,
            uid,
            numericId: t.userNumericId || null,
            userName: u.name || null,
            userPhone: u.phone || null,
            status: "paid",
            items: [],
            totalUZS: addUZS,
            amountTiyin: amount,
            provider: "payme",
            shipping: null,
            orderType: "topup",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: "payme",
          }, { merge: true });

          return { perform_time: performTime, transaction: paymeId, state: 2 };
        });

        return json(200, ok(id, res));
      }

      case "CancelTransaction": {
        const paymeId = String(params?.id || "").trim();
        const reason = params?.reason ?? null;
        if (!paymeId) return json(200, err(id, -31003, MSG.TX_NOT_FOUND));

        const ref = txRefByPaymeId(paymeId);
        const snap = await ref.get();
        if (!snap.exists) return json(200, err(id, -31003, MSG.TX_NOT_FOUND));
        const t = snap.data() || {};

        if (t.state === 2) {
          // Do not auto-refund here; require manual refund flow
          return json(200, err(id, -31007, MSG.CANNOT_CANCEL, "performed"));
        }

        const cancelTime = Date.now();
        await ref.set({ state: -1, cancel_time: cancelTime, reason }, { merge: true });
        return json(200, ok(id, { cancel_time: cancelTime, transaction: paymeId, state: -1 }));
      }

      case "CheckTransaction": {
        const paymeId = String(params?.id || "").trim();
        if (!paymeId) return json(200, err(id, -31003, MSG.TX_NOT_FOUND));
        const snap = await txRefByPaymeId(paymeId).get();
        if (!snap.exists) return json(200, err(id, -31003, MSG.TX_NOT_FOUND));
        const t = snap.data() || {};
        return json(200, ok(id, {
          create_time: t.create_time ?? null,
          perform_time: t.perform_time ?? null,
          cancel_time: t.cancel_time ?? null,
          transaction: paymeId,
          state: t.state ?? null,
          reason: t.reason ?? null,
        }));
      }

      default:
        return json(200, err(id, -32601, { uz: "Noma'lum metod", ru: "Неизвестный метод", en: "Method not found" }));
    }
  } catch (e) {
    const code = e?.code;
    if (code === -31003) return json(200, err(body?.id ?? null, -31003, MSG.TX_NOT_FOUND));
    if (code === -31050) return json(200, err(body?.id ?? null, -31050, MSG.ACCOUNT_NOT_FOUND));
    if (code === -31008) return json(200, err(body?.id ?? null, -31008, MSG.INTERNAL, "cancelled"));
    return json(200, err(body?.id ?? null, -32400, MSG.INTERNAL, String(e?.message || "server")));
  }
};

/**
 * Netlify Function: Payme JSON-RPC (Billing + Verify)
 * OrzuMall: balans top-up (orderType="topup") + optional checkout orders.
 *
 * ENV:
 *  - PAYME_KEY
 *  - FIREBASE_SERVICE_ACCOUNT_B64
 * Optional:
 *  - PAYME_MIN_TOPUP_UZS (default 1000)
 *
 * Payme amount is in TIYIN.
 *
 * Account fields supported:
 *  - account.user_id   (required)  => user's numericId (1000+)
 *  - account.order_id  (recommended) => unique order/bill id created before redirect to Payme
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
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
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
  const out = { jsonrpc: "2.0", id, error: { code, message: String(message || "Error") } };
  if (data !== null) out.error.data = data;
  return out;
}

function asInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

// Payme standard error texts (string only)
const MSG_RU = {
  UNAUTHORIZED: "Unauthorized",
  BAD_REQUEST: "Неверный запрос",
  ACCOUNT_NOT_FOUND: "Неверный счет",
  INVALID_AMOUNT: "Неверная сумма",
  TX_NOT_FOUND: "Транзакция не найдена",
  CANNOT_PERFORM: "Невозможно выполнить транзакцию",
  CANNOT_CANCEL: "Нельзя отменить",
  METHOD_NOT_FOUND: "Метод не найден",
  INTERNAL: "Внутренняя ошибка",
};

// Payme: transaction expires after 12 hours (common requirement)
const TX_TTL_MS = 12 * 60 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(200, { ok: true, note: "Payme JSON-RPC endpoint. POST only." });
  }

  const body = parseBody(event);

  // Payme sandbox expects HTTP 200 even for auth errors.
  if (!authValid(event.headers || {})) {
    return json(200, {
      jsonrpc: "2.0",
      id: body && typeof body.id !== "undefined" ? body.id : null,
      error: { code: -32504, message: MSG_RU.UNAUTHORIZED },
    });
  }

  if (!body || !body.method) {
    return json(200, err(body?.id ?? null, -32600, MSG_RU.BAD_REQUEST, "bad_request"));
  }

  const { id, method, params } = body;
  const account = (params && params.account) || {};

  const userIdRaw = account.user_id ?? account.userId ?? null;
  const userNumericId = String(userIdRaw || "").trim();

  const orderIdRaw = account.order_id ?? account.orderId ?? account.bill_id ?? account.billId ?? null;
  const orderId = orderIdRaw != null ? String(orderIdRaw).trim() : "";

  const amountTiyin = asInt(params?.amount);

  const minTopup = asInt(process.env.PAYME_MIN_TOPUP_UZS || "1000");
  const minTiyin = Number.isFinite(minTopup) ? minTopup * 100 : 1000 * 100;

  try {
    initFirebase();
    const db = admin.firestore();

    const getUidByNumericId = async (numericId) => {
      const ref = db.collection("users_by_numeric").doc(String(numericId));
      const snap = await ref.get();
      if (!snap.exists) return null;
      const d = snap.data() || {};
      return d.uid || null;
    };

    const txRefByPaymeId = (paymeId) => db.collection("payme_transactions").doc(String(paymeId));

    const loadOrderForVerify = async () => {
      // If orderId is provided, we validate existence + expected amount.
      if (orderId) {
        const oref = db.collection("orders").doc(orderId);
        const os = await oref.get();
        if (!os.exists) return { ok: false, code: -31050, message: MSG_RU.ACCOUNT_NOT_FOUND };
        const o = os.data() || {};

        // derive expected amount in tiyins
        const expected =
          Number.isFinite(asInt(o.amountTiyin)) ? asInt(o.amountTiyin)
          : Number.isFinite(Number(o.totalUZS)) ? Math.trunc(Number(o.totalUZS) * 100)
          : NaN;

        if (!Number.isFinite(expected) || expected <= 0) {
          return { ok: false, code: -31001, message: MSG_RU.INVALID_AMOUNT, data: "bad_expected_amount" };
        }

        // order must be pending
        const status = String(o.status || "").toLowerCase();
        if (status === "paid" || status === "canceled" || status === "refunded") {
          return { ok: false, code: -31050, message: MSG_RU.ACCOUNT_NOT_FOUND, data: "order_closed" };
        }

        // user id must match if present in order
        const oNumeric = o.numericId != null ? String(o.numericId) : "";
        if (oNumeric && userNumericId && oNumeric !== String(userNumericId)) {
          return { ok: false, code: -31050, message: MSG_RU.ACCOUNT_NOT_FOUND, data: "user_mismatch" };
        }

        return { ok: true, orderRef: oref, order: o, expectedAmount: expected };
      }

      // Legacy topup (no orderId): allow any amount >= min and existing user.
      if (!userNumericId) return { ok: false, code: -31050, message: MSG_RU.ACCOUNT_NOT_FOUND };
      if (!Number.isFinite(amountTiyin) || amountTiyin < minTiyin) return { ok: false, code: -31001, message: MSG_RU.INVALID_AMOUNT };

      const uid = await getUidByNumericId(userNumericId);
      if (!uid) return { ok: false, code: -31050, message: MSG_RU.ACCOUNT_NOT_FOUND };
      return { ok: true, uid, expectedAmount: amountTiyin, orderRef: null, order: null };
    };

    switch (method) {
      case "CheckPerformTransaction": {
        const v = await loadOrderForVerify();
        if (!v.ok) return json(200, err(id, v.code, v.message, v.data ?? null));

        // strict amount check when orderId is used
        if (orderId) {
          if (!Number.isFinite(amountTiyin) || amountTiyin !== v.expectedAmount) {
            return json(200, err(id, -31001, MSG_RU.INVALID_AMOUNT, "amount_mismatch"));
          }
        }
        return json(200, ok(id, { allow: true }));
      }

      case "CreateTransaction": {
        const paymeId = String(params?.id || "").trim();
        const time = asInt(params?.time);

        if (!paymeId) return json(200, err(id, -31003, MSG_RU.TX_NOT_FOUND));
        if (!userNumericId) return json(200, err(id, -31050, MSG_RU.ACCOUNT_NOT_FOUND));

        const v = await loadOrderForVerify();
        if (!v.ok) return json(200, err(id, v.code, v.message, v.data ?? null));

        if (orderId) {
          if (!Number.isFinite(amountTiyin) || amountTiyin !== v.expectedAmount) {
            return json(200, err(id, -31001, MSG_RU.INVALID_AMOUNT, "amount_mismatch"));
          }
        }

        const uid = v.uid || (await getUidByNumericId(userNumericId));
        if (!uid) return json(200, err(id, -31050, MSG_RU.ACCOUNT_NOT_FOUND));

        const ref = txRefByPaymeId(paymeId);
        const snap = await ref.get();
        if (snap.exists) {
          const t = snap.data() || {};
          return json(200, ok(id, { create_time: t.create_time ?? time ?? Date.now(), transaction: paymeId, state: t.state ?? 1 }));
        }

        const createTime = Number.isFinite(time) ? time : Date.now();

        await ref.set({
          payme_id: paymeId,
          orderId: orderId || null,
          userNumericId: String(userNumericId),
          uid,
          amount: Number.isFinite(amountTiyin) ? amountTiyin : v.expectedAmount,
          state: 1,
          create_time: createTime,
          perform_time: null,
          cancel_time: null,
          reason: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return json(200, ok(id, { create_time: createTime, transaction: paymeId, state: 1 }));
      }

      case "PerformTransaction": {
        const paymeId = String(params?.id || "").trim();
        if (!paymeId) return json(200, err(id, -31003, MSG_RU.TX_NOT_FOUND));

        const ref = txRefByPaymeId(paymeId);

        const res = await db.runTransaction(async (tx) => {
          const tSnap = await tx.get(ref);
          if (!tSnap.exists) throw Object.assign(new Error("tx_not_found"), { code: -31003 });

          const t = tSnap.data() || {};

          // already performed
          if (t.state === 2) {
            return { perform_time: t.perform_time ?? Date.now(), transaction: paymeId, state: 2 };
          }

          // canceled
          if (t.state && t.state < 0) throw Object.assign(new Error("cannot_perform"), { code: -31008 });

          const createTime = asInt(t.create_time) || Date.now();
          if (Date.now() - createTime > TX_TTL_MS) {
            // expire
            tx.set(ref, { state: -1, cancel_time: Date.now(), reason: 4 }, { merge: true });
            throw Object.assign(new Error("expired"), { code: -31008 });
          }

          const uid = t.uid;
          const amount = asInt(t.amount);
          const tOrderId = t.orderId ? String(t.orderId) : "";

          if (!uid) throw Object.assign(new Error("account_not_found"), { code: -31050 });

          const userRef = db.collection("users").doc(uid);
          const uSnap = await tx.get(userRef);
          if (!uSnap.exists) throw Object.assign(new Error("account_not_found"), { code: -31050 });
          const u = uSnap.data() || {};

          // If orderId provided - validate order and mark paid.
          let orderType = "topup";
          if (tOrderId) {
            const orderRef = db.collection("orders").doc(tOrderId);
            const oSnap = await tx.get(orderRef);
            if (!oSnap.exists) throw Object.assign(new Error("account_not_found"), { code: -31050 });

            const o = oSnap.data() || {};
            orderType = String(o.orderType || "checkout");

            const expected =
              Number.isFinite(asInt(o.amountTiyin)) ? asInt(o.amountTiyin)
              : Number.isFinite(Number(o.totalUZS)) ? Math.trunc(Number(o.totalUZS) * 100)
              : NaN;

            if (!Number.isFinite(expected) || expected !== amount) throw Object.assign(new Error("invalid_amount"), { code: -31001 });

            const status = String(o.status || "").toLowerCase();
            if (status === "paid") {
              // idempotent - do not double apply
            } else {
              tx.set(orderRef, {
                status: "paid",
                provider: "payme",
                paymeId,
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });

              // mirror to user subcollection
              const userOrderRef = userRef.collection("orders").doc(tOrderId);
              tx.set(userOrderRef, {
                status: "paid",
                provider: "payme",
                paymeId,
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
            }
          }

          // Balans credit only for topup orders (or if no orderId = topup)
          if (!tOrderId || orderType === "topup") {
            const bal = Number(u.balanceUZS || 0);
            const addUZS = Math.trunc(amount / 100);
            tx.set(userRef, {
              balanceUZS: (Number.isFinite(bal) ? bal : 0) + addUZS,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          }

          const performTime = Date.now();
          tx.set(ref, { state: 2, perform_time: performTime, performedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

          return { perform_time: performTime, transaction: paymeId, state: 2 };
        });

        return json(200, ok(id, res));
      }

      case "CancelTransaction": {
        const paymeId = String(params?.id || "").trim();
        const reason = asInt(params?.reason);
        if (!paymeId) return json(200, err(id, -31003, MSG_RU.TX_NOT_FOUND));

        const ref = txRefByPaymeId(paymeId);

        const res = await db.runTransaction(async (tx) => {
          const s = await tx.get(ref);
          if (!s.exists) throw Object.assign(new Error("tx_not_found"), { code: -31003 });
          const t = s.data() || {};

          const uid = t.uid || null;
          const amount = asInt(t.amount);
          const tOrderId = t.orderId ? String(t.orderId) : "";
          const now = Date.now();

          // cancel before perform
          if (t.state === 1) {
            tx.set(ref, { state: -1, cancel_time: now, reason: Number.isFinite(reason) ? reason : null }, { merge: true });

            if (tOrderId && uid) {
              const userRef = db.collection("users").doc(uid);
              const orderRef = db.collection("orders").doc(tOrderId);
              tx.set(orderRef, { status: "canceled", cancelReason: Number.isFinite(reason) ? reason : null, canceledAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
              tx.set(userRef.collection("orders").doc(tOrderId), { status: "canceled", cancelReason: Number.isFinite(reason) ? reason : null, canceledAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
            return { cancel_time: now, transaction: paymeId, state: -1 };
          }

          // cancel after perform (refund)
          if (t.state === 2) {
            if (!uid) throw Object.assign(new Error("account_not_found"), { code: -31050 });

            const userRef = db.collection("users").doc(uid);
            const uSnap = await tx.get(userRef);
            if (!uSnap.exists) throw Object.assign(new Error("account_not_found"), { code: -31050 });
            const u = uSnap.data() || {};

            // If topup: rollback balance
            // If checkout: just mark order refunded (no balance change here)
            let orderType = "topup";
            if (tOrderId) {
              const orderRef = db.collection("orders").doc(tOrderId);
              const oSnap = await tx.get(orderRef);
              if (oSnap.exists) {
                const o = oSnap.data() || {};
                orderType = String(o.orderType || "checkout");
                tx.set(orderRef, { status: "refunded", refundReason: Number.isFinite(reason) ? reason : null, refundedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                tx.set(userRef.collection("orders").doc(tOrderId), { status: "refunded", refundReason: Number.isFinite(reason) ? reason : null, refundedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
              }
            }

            if (!tOrderId || orderType === "topup") {
              const bal = Number(u.balanceUZS || 0);
              const subUZS = Math.trunc(amount / 100);
              tx.set(userRef, {
                balanceUZS: (Number.isFinite(bal) ? bal : 0) - subUZS,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
            }

            // state -2 means canceled after completion
            tx.set(ref, { state: -2, cancel_time: now, reason: Number.isFinite(reason) ? reason : null }, { merge: true });
            return { cancel_time: now, transaction: paymeId, state: -2 };
          }

          // already canceled
          return { cancel_time: t.cancel_time ?? null, transaction: paymeId, state: t.state ?? null };
        });

        return json(200, ok(id, res));
      }

      case "CheckTransaction": {
        const paymeId = String(params?.id || "").trim();
        if (!paymeId) return json(200, err(id, -31003, MSG_RU.TX_NOT_FOUND));

        const snap = await txRefByPaymeId(paymeId).get();
        if (!snap.exists) return json(200, err(id, -31003, MSG_RU.TX_NOT_FOUND));
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
        return json(200, err(id, -32601, MSG_RU.METHOD_NOT_FOUND));
    }
  } catch (e) {
    const code = e?.code;
    const rid = body?.id ?? null;
    if (code === -31001) return json(200, err(rid, -31001, MSG_RU.INVALID_AMOUNT));
    if (code === -31003) return json(200, err(rid, -31003, MSG_RU.TX_NOT_FOUND));
    if (code === -31050) return json(200, err(rid, -31050, MSG_RU.ACCOUNT_NOT_FOUND));
    if (code === -31008) return json(200, err(rid, -31008, MSG_RU.CANNOT_PERFORM, "expired_or_canceled"));
    return json(200, err(rid, -32400, MSG_RU.INTERNAL, String(e?.message || "server")));
  }
};

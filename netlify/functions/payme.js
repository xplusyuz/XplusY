/**
 * OrzuMall — Payme/Paycom JSON-RPC endpoint (Netlify Functions) — Professional Firestore-backed version
 *
 * Required ENV (Netlify → Site settings → Environment variables):
 *   - PAYME_KEY  : Payme merchant key (test/prod). BasicAuth password for "Paycom:<PAYME_KEY>"
 *   - FIREBASE_SERVICE_ACCOUNT : Firebase service account JSON (one-line JSON) OR base64 JSON
 * Optional ENV:
 *   - FIREBASE_PROJECT_ID : if your service account JSON doesn't include project_id (rare)
 *   - PAYME_TX_TIMEOUT_MS : default 43200000 (12 hours)
 *
 * Firestore:
 *   - orders/{orderId} must exist before payment and contain total amount in UZS (prefer: totalUZS)
 *     Supported fields: totalUZS, amountUZS, amount, total, sumUZS
 *   - payme_transactions/{paymeId} is created/updated by this function
 *
 * Notes:
 *   - Payme sends amount in TIYIN (1 so'm = 100 tiyin)
 *   - Always respond HTTP 200 with JSON-RPC result/error
 */

const admin = require("firebase-admin");

// -------------------- helpers --------------------
function jsonResponse(obj) {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

function nowMs() { return Date.now(); }

function errorObj(code, data, msgUz, msgRu, msgEn) {
  return {
    error: {
      code,
      message: {
        uz: msgUz || "Xatolik",
        ru: msgRu || "Ошибка",
        en: msgEn || "Error",
      },
      data: data || null,
    },
  };
}

function parseBasicAuth(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return null;
  const m = authHeader.match(/^Basic\s+(.+)$/i);
  if (!m) return null;
  try {
    const decoded = Buffer.from(m[1], "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function normalizeBody(event) {
  if (!event || event.body == null) return null;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getOrderIdFromParams(params) {
  const acc = (params && params.account) || {};
  return (
    acc.order_id ||
    acc.orders_id ||
    acc.orderId ||
    acc.orderid ||
    acc.order ||
    acc.id ||
    null
  );
}

function toInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : NaN;
}

function uzsToTiyin(uzs) {
  // avoid float issues
  const n = Number(uzs);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

// -------------------- firebase init --------------------
let _db = null;

function parseServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) return null;

  // 1) direct JSON
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try { return JSON.parse(raw); } catch { /* fallthrough */ }
  }

  // 2) base64 JSON
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
    if (decoded.startsWith("{") && decoded.endsWith("}")) {
      return JSON.parse(decoded);
    }
  } catch { /* ignore */ }

  // 3) sometimes env stores JSON with escaped quotes
  try {
    const fixed = raw.replace(/\\"/g, '"');
    if (fixed.startsWith("{") && fixed.endsWith("}")) return JSON.parse(fixed);
  } catch { /* ignore */ }

  return null;
}

function getDbOrThrow() {
  if (_db) return _db;

  const sa = parseServiceAccount();
  if (!sa) throw new Error("FIREBASE_SERVICE_ACCOUNT env is missing/invalid");

  if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID,
    });
  }

  _db = admin.firestore();
  return _db;
}

// -------------------- constants --------------------
const STATE_CREATED = 1;
const STATE_PERFORMED = 2;
const STATE_CANCELLED = -1;
const STATE_CANCELLED_AFTER_PERFORM = -2;

// Common Payme errors
const ERR_INVALID_AMOUNT = -31001;
const ERR_ORDER_NOT_FOUND = -31050;
const ERR_TX_NOT_FOUND = -31003;
const ERR_CANNOT_PERFORM = -31008;
const ERR_CANNOT_CANCEL = -31007;
const ERR_SYSTEM = -32400;
const ERR_INSUFFICIENT_PRIV = -32504;

// -------------------- Firestore helpers --------------------
function pickOrderTotalUZS(order) {
  const candidates = ["totalUZS", "amountUZS", "amount", "total", "sumUZS"];
  for (const k of candidates) {
    const v = order && order[k];
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function getOrder(db, orderId) {
  const ref = db.doc(`orders/${orderId}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, data: snap.data() || {}, orderId };
}

async function getTx(db, paymeId) {
  const ref = db.doc(`payme_transactions/${paymeId}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, data: snap.data() || {} };
}

async function upsertTx(db, paymeId, patch) {
  const ref = db.doc(`payme_transactions/${paymeId}`);
  await ref.set(
    { paymeId, ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  const snap = await ref.get();
  return { ref, data: snap.data() || {} };
}

// Validate account + amount against Firestore order
async function validateAccountAndAmount(db, params) {
  const amount = toInt(params?.amount || 0);
  const orderId = String(getOrderIdFromParams(params) || "").trim();

  if (!orderId || orderId.length < 3) {
    return { ok: false, err: errorObj(ERR_ORDER_NOT_FOUND, "order_id", "Buyurtma topilmadi", "Счёт не найден", "Account not found") };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, err: errorObj(ERR_INVALID_AMOUNT, "amount", "Noto‘g‘ri summa", "Неверная сумма", "Incorrect amount") };
  }

  const orderObj = await getOrder(db, orderId);
  if (!orderObj) {
    return { ok: false, err: errorObj(ERR_ORDER_NOT_FOUND, "order_id", "Buyurtma topilmadi", "Счёт не найден", "Account not found") };
  }

  const totalUZS = pickOrderTotalUZS(orderObj.data);
  if (totalUZS == null) {
    // If order exists but total missing -> treat as cannot perform (your data bug)
    return { ok: false, err: errorObj(ERR_CANNOT_PERFORM, "order_total_missing", "Buyurtma summasi topilmadi", "Сумма заказа не найдена", "Order amount missing") };
  }

  const expected = uzsToTiyin(totalUZS);
  if (!Number.isFinite(expected) || expected <= 0) {
    return { ok: false, err: errorObj(ERR_CANNOT_PERFORM, "order_total_invalid", "Buyurtma summasi noto‘g‘ri", "Неверная сумма заказа", "Invalid order amount") };
  }

  if (amount !== expected) {
    return { ok: false, err: errorObj(ERR_INVALID_AMOUNT, "amount", "Noto‘g‘ri summa", "Неверная сумма", "Incorrect amount") };
  }

  return { ok: true, amount, expected, orderObj };
}

// -------------------- handler --------------------
exports.handler = async (event) => {
  const req = normalizeBody(event);
  const rpcId = (req && req.id !== undefined) ? req.id : null;

  try {
    if (!req || req.jsonrpc !== "2.0" || !req.method) {
      return jsonResponse({
        jsonrpc: "2.0",
        id: rpcId,
        ...errorObj(ERR_ORDER_NOT_FOUND, "invalid_request", "Noto‘g‘ri so‘rov", "Неверный запрос", "Invalid request"),
      });
    }

    // --- AUTH ---
    const authHeader = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
    const auth = parseBasicAuth(authHeader);
    const key = (process.env.PAYME_KEY || "").trim();
    const okAuth = auth && auth.user === "Paycom" && auth.pass === key;

    if (!okAuth) {
      return jsonResponse({
        jsonrpc: "2.0",
        id: rpcId,
        ...errorObj(ERR_INSUFFICIENT_PRIV, "unauthorized", "Avtorizatsiya xato", "Неверная авторизация", "Unauthorized"),
      });
    }

    const db = getDbOrThrow();
    const method = req.method;
    const params = req.params || {};

    const txTimeoutMs = toInt(process.env.PAYME_TX_TIMEOUT_MS || 43200000); // 12 hours

    // ===== CheckPerformTransaction =====
    if (method === "CheckPerformTransaction") {
      const v = await validateAccountAndAmount(db, params);
      if (!v.ok) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...v.err });

      const order = v.orderObj.data || {};
      if (String(order.status || "") === "paid") {
        return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_CANNOT_PERFORM, "order_paid", "Buyurtma allaqachon to‘langan", "Заказ уже оплачен", "Order already paid") });
      }

      return jsonResponse({ jsonrpc: "2.0", id: rpcId, result: { allow: true } });
    }

    // ===== CreateTransaction =====
    if (method === "CreateTransaction") {
      const paymeId = String(params?.id || "").trim();
      const time = toInt(params?.time || 0);

      if (!paymeId) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_TX_NOT_FOUND, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });

      const v = await validateAccountAndAmount(db, params);
      if (!v.ok) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...v.err });

      const order = v.orderObj.data || {};
      if (String(order.status || "") === "paid") {
        return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_CANNOT_PERFORM, "order_paid", "Buyurtma allaqachon to‘langan", "Заказ уже оплачен", "Order already paid") });
      }

      const existing = await getTx(db, paymeId);
      if (existing) {
        const tx = existing.data || {};
        return jsonResponse({
          jsonrpc: "2.0",
          id: rpcId,
          result: {
            create_time: toInt(tx.create_time || tx.createTime || nowMs()),
            transaction: String(tx.transaction || paymeId),
            state: (tx.state === undefined ? STATE_CREATED : tx.state),
            receivers: null,
          },
        });
      }

      const create_time = nowMs();

      await upsertTx(db, paymeId, {
        transaction: paymeId,
        orderId: v.orderObj.orderId,
        uid: order.uid || order.userId || null,
        amount: v.amount,
        time,
        create_time,
        perform_time: 0,
        cancel_time: 0,
        state: STATE_CREATED,
        reason: null,
      });

      await v.orderObj.ref.set(
        {
          status: "pending_payment",
          payment: {
            provider: "payme",
            status: "pending",
            amount: v.amount,
            orderId: v.orderObj.orderId,
          },
          payme: { id: paymeId, state: STATE_CREATED, create_time, amount: v.amount },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return jsonResponse({
        jsonrpc: "2.0",
        id: rpcId,
        result: { create_time, transaction: paymeId, state: STATE_CREATED, receivers: null },
      });
    }

    // ===== PerformTransaction =====
    if (method === "PerformTransaction") {
      const paymeId = String(params?.id || "").trim();
      if (!paymeId) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_TX_NOT_FOUND, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });

      const txObj = await getTx(db, paymeId);
      if (!txObj) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_TX_NOT_FOUND, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });

      const tx = txObj.data || {};

      // if already performed
      if (tx.state === STATE_PERFORMED) {
        return jsonResponse({
          jsonrpc: "2.0",
          id: rpcId,
          result: { transaction: String(tx.transaction || paymeId), perform_time: toInt(tx.perform_time || nowMs()), state: STATE_PERFORMED },
        });
      }

      // if cancelled
      if (tx.state === STATE_CANCELLED || tx.state === STATE_CANCELLED_AFTER_PERFORM) {
        return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_CANNOT_PERFORM, "cancelled", "Tranzaksiya bekor qilingan", "Транзакция отменена", "Transaction cancelled") });
      }

      // timeout from create_time
      const createTime = toInt(tx.create_time || 0);
      if (!Number.isFinite(createTime) || createTime <= 0) {
        return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_CANNOT_PERFORM, "tx_invalid", "Tranzaksiya ma'lumoti xato", "Данные транзакции неверны", "Invalid transaction data") });
      }
      if (Number.isFinite(txTimeoutMs) && txTimeoutMs > 0 && (nowMs() - createTime) > txTimeoutMs) {
        // mark cancelled due to timeout
        const cancel_time = nowMs();
        await upsertTx(db, paymeId, { state: STATE_CANCELLED, cancel_time, reason: "timeout" });
        return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_CANNOT_PERFORM, "timeout", "Tranzaksiya muddati tugagan", "Время транзакции истекло", "Transaction expired") });
      }

      // (Optional) re-check order and amount consistency
      const orderId = String(tx.orderId || "").trim();
      if (!orderId) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_CANNOT_PERFORM, "order_id_missing", "Buyurtma topilmadi", "Счёт не найден", "Account not found") });

      const orderObj = await getOrder(db, orderId);
      if (!orderObj) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_ORDER_NOT_FOUND, "order_id", "Buyurtma topilmadi", "Счёт не найден", "Account not found") });

      const totalUZS = pickOrderTotalUZS(orderObj.data);
      const expected = uzsToTiyin(totalUZS);
      if (!Number.isFinite(expected) || expected <= 0) {
        return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_CANNOT_PERFORM, "order_total_invalid", "Buyurtma summasi noto‘g‘ri", "Неверная сумма заказа", "Invalid order amount") });
      }
      if (toInt(tx.amount) !== expected) {
        return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_INVALID_AMOUNT, "amount", "Noto‘g‘ri summa", "Неверная сумма", "Incorrect amount") });
      }

      const perform_time = nowMs();
      await upsertTx(db, paymeId, { state: STATE_PERFORMED, perform_time });

      await orderObj.ref.set(
        {
          status: "paid",
          payment: {
            provider: "payme",
            status: "paid",
            amount: expected,
            paidAt: perform_time,
            paymeId,
          },
          payme: { ...(orderObj.data.payme || {}), id: paymeId, state: STATE_PERFORMED, perform_time, amount: expected },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return jsonResponse({
        jsonrpc: "2.0",
        id: rpcId,
        result: { transaction: String(tx.transaction || paymeId), perform_time, state: STATE_PERFORMED },
      });
    }

    // ===== CancelTransaction =====
    if (method === "CancelTransaction") {
      const paymeId = String(params?.id || "").trim();
      const reason = (params?.reason !== undefined) ? params.reason : null;

      if (!paymeId) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_TX_NOT_FOUND, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });

      const txObj = await getTx(db, paymeId);
      if (!txObj) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_TX_NOT_FOUND, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });

      const tx = txObj.data || {};
      const cancel_time = nowMs();

      // Already cancelled
      if (tx.state === STATE_CANCELLED || tx.state === STATE_CANCELLED_AFTER_PERFORM) {
        return jsonResponse({
          jsonrpc: "2.0",
          id: rpcId,
          result: { transaction: String(tx.transaction || paymeId), cancel_time: toInt(tx.cancel_time || cancel_time), state: tx.state },
        });
      }

      // If performed -> cancel after perform (state -2)
      const newState = (tx.state === STATE_PERFORMED) ? STATE_CANCELLED_AFTER_PERFORM : STATE_CANCELLED;

      await upsertTx(db, paymeId, { state: newState, cancel_time, reason });

      const orderId = String(tx.orderId || "").trim();
      if (orderId) {
        const orderObj = await getOrder(db, orderId);
        if (orderObj) {
          await orderObj.ref.set(
            {
              status: newState === STATE_CANCELLED_AFTER_PERFORM ? "refund_pending" : "cancelled",
              payment: {
                provider: "payme",
                status: newState === STATE_CANCELLED_AFTER_PERFORM ? "cancelled_after_perform" : "cancelled",
                paymeId,
                reason,
                cancelAt: cancel_time,
              },
              payme: { ...(orderObj.data.payme || {}), id: paymeId, state: newState, cancel_time },
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      return jsonResponse({
        jsonrpc: "2.0",
        id: rpcId,
        result: { transaction: String(tx.transaction || paymeId), cancel_time, state: newState },
      });
    }

    // ===== CheckTransaction =====
    if (method === "CheckTransaction") {
      const paymeId = String(params?.id || "").trim();
      if (!paymeId) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_TX_NOT_FOUND, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });

      const txObj = await getTx(db, paymeId);
      if (!txObj) return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_TX_NOT_FOUND, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });

      const tx = txObj.data || {};
      return jsonResponse({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          transaction: String(tx.transaction || paymeId),
          state: tx.state ?? STATE_CREATED,
          create_time: toInt(tx.create_time || 0) || 0,
          perform_time: toInt(tx.perform_time || 0) || 0,
          cancel_time: toInt(tx.cancel_time || 0) || 0,
          reason: tx.reason ?? null,
        },
      });
    }

    // ===== GetStatement =====
    if (method === "GetStatement") {
      const from = toInt(params?.from || 0);
      const to = toInt(params?.to || 0);

      if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0 || to < from) {
        return jsonResponse({ jsonrpc: "2.0", id: rpcId, ...errorObj(ERR_SYSTEM, "range", "Noto‘g‘ri oraliq", "Неверный диапазон", "Invalid range") });
      }

      const snap = await db
        .collection("payme_transactions")
        .where("create_time", ">=", from)
        .where("create_time", "<=", to)
        .limit(500)
        .get();

      const transactions = [];
      snap.forEach((d) => {
        const tx = d.data() || {};
        transactions.push({
          id: String(tx.paymeId || d.id),
          time: toInt(tx.time || tx.create_time || 0) || 0,
          amount: toInt(tx.amount || 0) || 0,
          account: { order_id: String(tx.orderId || "") },
          create_time: toInt(tx.create_time || 0) || 0,
          perform_time: toInt(tx.perform_time || 0) || 0,
          cancel_time: toInt(tx.cancel_time || 0) || 0,
          transaction: String(tx.transaction || d.id),
          state: tx.state ?? STATE_CREATED,
          reason: tx.reason ?? null,
        });
      });

      return jsonResponse({ jsonrpc: "2.0", id: rpcId, result: { transactions } });
    }

    // ===== ChangePassword =====
    if (method === "ChangePassword") {
      return jsonResponse({ jsonrpc: "2.0", id: rpcId, result: { success: true } });
    }

    // Unknown method
    return jsonResponse({
      jsonrpc: "2.0",
      id: rpcId,
      ...errorObj(ERR_SYSTEM, "method", "Metod topilmadi", "Метод не найден", "Method not found"),
    });

  } catch (e) {
    return jsonResponse({
      jsonrpc: "2.0",
      id: rpcId,
      ...errorObj(ERR_SYSTEM, String(e && e.message ? e.message : e), "Server xatosi", "Внутренняя ошибка", "Internal server error"),
    });
  }
};

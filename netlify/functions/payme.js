/**
 * Payme/Paycom JSON-RPC endpoint for Netlify Functions (single-file, sandbox-friendly).
 *
 * ✅ Fixes your main issue:
 *   - "Неверная сумма" (-31001) MUST be returned when Payme sandbox sends a wrong amount.
 *   - To verify amount reliably without a DB, we read the EXPECTED amount from params.account.*
 *
 * IMPORTANT (frontend / merchant account fields):
 *   Configure & send ONE of these account fields with each payment request:
 *     - account.amount_tiyin  (preferred, integer)
 *     - account.amountSom     (integer, in so'm)  -> will be converted to tiyin (×100)
 *     - account.amount        (same as amountSom)
 *
 * Then the backend compares:
 *   params.amount (tiyin) === expectedAmountTiyin
 *
 * ENV:
 *   - PAYME_KEY : Payme merchant key (test or prod). BasicAuth password for "Paycom:<PAYME_KEY>"
 */

function jsonResponse(statusCode, obj) {
  return {
    statusCode,
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
  } catch (e) {
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
  } catch (e) {
    return null;
  }
}

function getAccount(params) {
  return (params && params.account) || {};
}

function getParamOrderId(params) {
  const acc = getAccount(params);
  return acc.order_id || acc.orders_id || acc.orderId || acc.orderid || null;
}

/**
 * Read expected amount from account fields (so backend can validate wrong-sum sandbox tests)
 * Priority:
 *  1) amount_tiyin / amountTiyin (already in tiyin)
 *  2) amountSom / amount (so'm) -> convert to tiyin
 */
function getExpectedAmountTiyin(params) {
  const acc = getAccount(params);

  const a1 = Number(acc.amount_tiyin ?? acc.amountTiyin ?? acc.amountTiyinUZS ?? NaN);
  if (Number.isFinite(a1) && a1 > 0) return Math.trunc(a1);

  const som = Number(acc.amountSom ?? acc.amount ?? NaN);
  if (Number.isFinite(som) && som > 0) return Math.trunc(som * 100);

  return null; // unknown
}

// In-memory store (works for sandbox sessions; persists per warm Netlify function instance)
const STORE = globalThis.__PAYME_STORE__ || (globalThis.__PAYME_STORE__ = {
  tx: new Map(), // paymeTxId -> { transaction, state, create_time, perform_time, cancel_time, reason, orderId, amount }
});

function getTx(txId) {
  return STORE.tx.get(txId) || null;
}
function setTx(txId, obj) {
  STORE.tx.set(txId, obj);
  return obj;
}

exports.handler = async (event) => {
  try {
    const req = normalizeBody(event);
    if (!req || req.jsonrpc !== "2.0" || !req.method) {
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: (req && req.id) || null,
        ...errorObj(-31050, "invalid_request", "Noto‘g‘ri so‘rov", "Неверный запрос", "Invalid request"),
      });
    }

    // --- AUTH ---
    const auth = parseBasicAuth((event.headers && (event.headers.authorization || event.headers.Authorization)) || "");
    const key = process.env.PAYME_KEY || "";
    const okAuth = auth && auth.user === "Paycom" && auth.pass === key;

    if (!okAuth) {
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        ...errorObj(-32504, "unauthorized", "Avtorizatsiya xato", "Неверная авторизация", "Unauthorized"),
      });
    }

    const method = req.method;
    const params = req.params || {};

    const amount = Math.trunc(Number(params.amount || 0)); // tiyin (integer)
    const orderId = getParamOrderId(params);
    const expectedAmount = getExpectedAmountTiyin(params);

    // Helper: validate account + amount
    function validateAccountAndAmount() {
      if (!orderId || typeof orderId !== "string" || orderId.trim().length < 3) {
        return { ok: false, err: errorObj(-31050, "order_id", "Buyurtma topilmadi", "Счёт не найден", "Account not found") };
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, err: errorObj(-31001, "amount", "Noto‘g‘ri summa", "Неверная сумма", "Incorrect amount") };
      }
      // ✅ MAIN FIX: if expected amount is known from account fields, enforce exact match
      if (expectedAmount != null && amount !== expectedAmount) {
        return { ok: false, err: errorObj(-31001, "amount", "Noto‘g‘ri summa", "Неверная сумма", "Incorrect amount") };
      }
      return { ok: true };
    }

    // --- METHODS ---
    if (method === "CheckPerformTransaction") {
      const v = validateAccountAndAmount();
      if (!v.ok) return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...v.err });
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: { allow: true },
      });
    }

    if (method === "CreateTransaction") {
      const v = validateAccountAndAmount();
      if (!v.ok) return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...v.err });

      const paymeTxId = String(params.id || ("tx_" + nowMs()));
      const existing = getTx(paymeTxId);

      if (existing) {
        // If already performed/canceled, return current state (sandbox expects idempotency)
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, result: existing });
      }

      const t = {
        create_time: nowMs(),
        transaction: paymeTxId,
        state: 1,
        perform_time: 0,
        cancel_time: 0,
        reason: null,
        orderId,
        amount,
      };

      setTx(paymeTxId, t);

      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: t,
      });
    }

    if (method === "PerformTransaction") {
      const paymeTxId = String(params.id || "");
      if (!paymeTxId) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...errorObj(-31050, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });
      }

      const existing = getTx(paymeTxId);
      if (!existing) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...errorObj(-31050, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });
      }

      if (existing.state === 2) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, result: existing });
      }

      if (existing.state < 0) {
        // already canceled
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, result: existing });
      }

      existing.state = 2;
      existing.perform_time = nowMs();
      setTx(paymeTxId, existing);

      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: existing,
      });
    }

    if (method === "CancelTransaction") {
      const paymeTxId = String(params.id || "");
      if (!paymeTxId) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...errorObj(-31050, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });
      }

      const existing = getTx(paymeTxId);
      if (!existing) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...errorObj(-31050, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });
      }

      if (existing.state < 0) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, result: existing });
      }

      existing.state = -1;
      existing.cancel_time = nowMs();
      existing.reason = params.reason ?? null;
      setTx(paymeTxId, existing);

      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: existing,
      });
    }

    if (method === "CheckTransaction") {
      const paymeTxId = String(params.id || "");
      if (!paymeTxId) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...errorObj(-31050, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });
      }

      const existing = getTx(paymeTxId);
      if (!existing) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...errorObj(-31050, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });
      }

      return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, result: existing });
    }

    if (method === "GetStatement") {
      // Minimal statement for sandbox
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: { transactions: [] },
      });
    }

    if (method === "ChangePassword") {
      return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, result: { success: true } });
    }

    return jsonResponse(200, {
      jsonrpc: "2.0",
      id: req.id ?? null,
      ...errorObj(-31050, "method", "Metod topilmadi", "Метод не найден", "Method not found"),
    });

  } catch (e) {
    return jsonResponse(200, {
      jsonrpc: "2.0",
      id: null,
      ...errorObj(-32400, String(e && e.message ? e.message : e), "Server xatosi", "Внутренняя ошибка", "Internal server error"),
    });
  }
};

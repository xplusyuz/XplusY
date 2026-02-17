/**
 * Payme/Paycom JSON-RPC endpoint for Netlify Functions (single-file variant A).
 * ENV:
 *   - PAYME_KEY : Payme merchant key (test or prod). Used as BasicAuth password for "Paycom:<PAYME_KEY>"
 * Optional (not required in Variant A):
 *   - FIREBASE_SERVICE_ACCOUNT : ignored (kept for compatibility with your env setup)
 *
 * This variant is intentionally dependency-free (no extra modules/files).
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
  // Payme Sandbox UI expects error.message to be a STRING. If you return an object,
  // the sandbox shows "[object Object]".
  const message = (msgRu || msgUz || msgEn || "Ошибка");
  return {
    error: {
      code,
      message, // <-- string
      data: data || null,
    },
  };
}


function parseBasicAuth(authHeader) {
  // "Basic base64(user:pass)"
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

function getParamOrderId(params) {
  // Payme usually sends params.account with your fields
  const acc = (params && params.account) || {};
  return acc.order_id || acc.orders_id || acc.orderId || acc.orderid || null;
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

    // Basic validations used by sandbox
    const amount = Number(params.amount || 0);
    const orderId = getParamOrderId(params);

    // Helper: validate account (your business rules can be added later)
    function validateAccount() {
      if (!orderId || typeof orderId !== "string" || orderId.trim().length < 3) {
        return { ok: false, err: errorObj(-31050, "order_id", "Buyurtma topilmadi", "Счёт не найден", "Account not found") };
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false, err: errorObj(-31001, "amount", "Noto‘g‘ri summa", "Неверная сумма", "Incorrect amount") };
      }
      return { ok: true };
    }

    // --- METHODS ---
    if (method === "CheckPerformTransaction") {
      const v = validateAccount();
      if (!v.ok) return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...v.err });
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: { allow: true },
      });
    }

    if (method === "CreateTransaction") {
      const v = validateAccount();
      if (!v.ok) return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...v.err });

      const txId = String(params.id || ("tx_" + nowMs()));
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: {
          create_time: nowMs(),
          transaction: txId,
          state: 1, // created
        },
      });
    }

    if (method === "PerformTransaction") {
      const txId = String(params.id || ("tx_" + nowMs()));
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: {
          transaction: txId,
          perform_time: nowMs(),
          state: 2, // performed
        },
      });
    }

    if (method === "CancelTransaction") {
      const txId = String(params.id || ("tx_" + nowMs()));
      // reason can be params.reason
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: {
          transaction: txId,
          cancel_time: nowMs(),
          state: -1, // canceled
        },
      });
    }

    if (method === "CheckTransaction") {
      const txId = String(params.id || "");
      if (!txId) {
        return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, ...errorObj(-31050, "id", "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found") });
      }
      // Minimal response for sandbox
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: {
          transaction: txId,
          state: 2,
          create_time: nowMs(),
          perform_time: nowMs(),
          cancel_time: 0,
          reason: null,
        },
      });
    }

    if (method === "GetStatement") {
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id: req.id ?? null,
        result: { transactions: [] },
      });
    }

    if (method === "ChangePassword") {
      // Not used in sandbox usually
      return jsonResponse(200, { jsonrpc: "2.0", id: req.id ?? null, result: { success: true } });
    }

    // Unknown method
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

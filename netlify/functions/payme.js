/**
 * Netlify Function: Payme/Paycom JSON-RPC endpoint
 * Endpoint URL after deploy:
 *   https://<your-site>.netlify.app/.netlify/functions/payme
 *
 * Env vars required:
 *   PAYME_LOGIN  (e.g. "Paycom")
 *   PAYME_KEY    (the key/password Payme gives you)
 *
 * IMPORTANT:
 * This is a minimal, activation/sandbox-friendly implementation.
 * It uses in-memory storage (not persistent). For real production,
 * store transactions in Firestore/DB.
 */

const transactions = global.__PAYME_TX__ || (global.__PAYME_TX__ = new Map());

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function rpcError(id, code, message, data = null) {
  // Payme expects JSON-RPC 2.0 error object
  const err = { code, message };
  if (data !== null) err.data = data;
  return json(200, { jsonrpc: "2.0", id: id ?? null, error: err });
}

function ok(id, result) {
  return json(200, { jsonrpc: "2.0", id, result });
}

function parseBasicAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  try {
    const b64 = authHeader.slice(6).trim();
    const raw = Buffer.from(b64, "base64").toString("utf8");
    const idx = raw.indexOf(":");
    if (idx < 0) return null;
    return { login: raw.slice(0, idx), key: raw.slice(idx + 1) };
  } catch {
    return null;
  }
}

function requireAuth(event) {
  const creds = parseBasicAuth(event.headers.authorization || event.headers.Authorization);
  const wantLogin = process.env.PAYME_LOGIN || "";
  const wantKey = process.env.PAYME_KEY || "";
  if (!wantLogin || !wantKey) return { ok: false, why: "server_misconfigured" };
  if (!creds) return { ok: false, why: "no_auth" };
  if (creds.login !== wantLogin || creds.key !== wantKey) return { ok: false, why: "bad_auth" };
  return { ok: true };
}

// Payme states:
// 1  - created
// 2  - performed
// -1 - cancelled (before perform)
// -2 - cancelled (after perform)

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: "Method Not Allowed" };
  }

  const auth = requireAuth(event);
  if (!auth.ok) {
    // According to Payme docs, wrong auth => 32504
    return rpcError(null, -32504, "Insufficient privilege");
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = body.params || {};

  if (!method) return rpcError(id, -32600, "Invalid Request");

  // Helpers for account/order_id
  const account = params.account || {};
  const orderId = account.order_id ?? account.orderId ?? null;

  try {
    switch (method) {
      case "CheckPerformTransaction": {
        // Minimal: always allow.
        // Production: verify orderId exists + amount matches order total.
        if (!orderId) return rpcError(id, -31050, "Order not found");
        return ok(id, { allow: true });
      }

      case "CreateTransaction": {
        if (!orderId) return rpcError(id, -31050, "Order not found");

        const txId = params.id; // Payme transaction id
        if (!txId) return rpcError(id, -32602, "Invalid params");

        const existing = transactions.get(txId);
        if (existing) {
          // If already created, return same
          return ok(id, {
            create_time: existing.create_time,
            transaction: txId,
            state: existing.state,
          });
        }

        const now = Date.now();
        const create_time = params.time ?? now;

        // Minimal: create tx with state=1
        const tx = {
          order_id: String(orderId),
          create_time,
          perform_time: 0,
          cancel_time: 0,
          state: 1,
          reason: null,
        };
        transactions.set(txId, tx);

        return ok(id, {
          create_time: tx.create_time,
          transaction: txId,
          state: tx.state,
        });
      }

      case "PerformTransaction": {
        const txId = params.id;
        if (!txId) return rpcError(id, -32602, "Invalid params");
        const tx = transactions.get(txId);
        if (!tx) return rpcError(id, -31003, "Transaction not found");

        if (tx.state === 2) {
          return ok(id, {
            transaction: txId,
            perform_time: tx.perform_time,
            state: tx.state,
          });
        }

        if (tx.state < 0) return rpcError(id, -31008, "Transaction is cancelled");

        tx.state = 2;
        tx.perform_time = Date.now();

        return ok(id, {
          transaction: txId,
          perform_time: tx.perform_time,
          state: tx.state,
        });
      }

      case "CancelTransaction": {
        const txId = params.id;
        const reason = params.reason ?? null;
        if (!txId) return rpcError(id, -32602, "Invalid params");
        const tx = transactions.get(txId);
        if (!tx) return rpcError(id, -31003, "Transaction not found");

        if (tx.state === 1) tx.state = -1;
        else if (tx.state === 2) tx.state = -2;

        tx.cancel_time = Date.now();
        tx.reason = reason;

        return ok(id, {
          transaction: txId,
          cancel_time: tx.cancel_time,
          state: tx.state,
        });
      }

      case "CheckTransaction": {
        const txId = params.id;
        if (!txId) return rpcError(id, -32602, "Invalid params");
        const tx = transactions.get(txId);
        if (!tx) return rpcError(id, -31003, "Transaction not found");

        return ok(id, {
          create_time: tx.create_time,
          perform_time: tx.perform_time,
          cancel_time: tx.cancel_time,
          transaction: txId,
          state: tx.state,
          reason: tx.reason,
        });
      }

      case "GetStatement": {
        // Production: return list of performed transactions within period
        // Minimal: empty
        return ok(id, { transactions: [] });
      }

      default:
        return rpcError(id, -32601, "Method not found");
    }
  } catch (e) {
    return rpcError(id, -32000, "Server error", String(e?.message || e));
  }
};
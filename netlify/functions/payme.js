/**
 * Payme (Paycom) Merchant API endpoint for Netlify Functions.
 *
 * Endpoint URL to set in Payme Business cabinet:
 *   https://xplusy.netlify.app/.netlify/functions/payme
 *
 * Required Netlify environment variables:
 *   PAYME_KASSA_KEY              - Payme "kassa key" password (Basic Auth password)
 *   FIREBASE_SERVICE_ACCOUNT_JSON - Firebase service account JSON (stringified)
 *
 * Firestore:
 *   orders/{orderId}  where orderId == account.order_id (digits only)
 *   payme_transactions/{paymeTransId}
 *
 * NOTE: This is a practical MVP implementation. You can extend strict checks/timeouts if needed.
 */

const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env");
  }
  const sa = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}

function json(obj) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function paymeError(id, code, message, data) {
  return json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message: { ru: message, uz: message, en: message },
      data: data ?? null,
    },
  });
}

function ok(id, result) {
  return json({ jsonrpc: "2.0", id: id ?? null, result });
}

function parseBasicAuth(authHeader) {
  if (!authHeader) return null;
  const h = String(authHeader);
  if (!h.startsWith("Basic ")) return null;
  const b64 = h.slice(6);
  const raw = Buffer.from(b64, "base64").toString("utf8"); // "login:password"
  const idx = raw.indexOf(":");
  if (idx < 0) return null;
  return { login: raw.slice(0, idx), password: raw.slice(idx + 1) };
}

exports.handler = async (event) => {
  // Payme uses POST JSON-RPC
  if (event.httpMethod !== "POST") {
    return json({ ok: true, note: "Payme endpoint. Use POST JSON-RPC." });
  }

  // Basic Auth check (password is the important part for Payme)
  const auth = parseBasicAuth(event.headers.authorization || event.headers.Authorization);
  const expected = process.env.PAYME_KASSA_KEY;
  if (!expected) {
    return paymeError(null, -32504, "Server misconfigured (PAYME_KASSA_KEY missing)", "authorization");
  }
  if (!auth || auth.password !== expected) {
    return paymeError(null, -32504, "Unauthorized", "authorization");
  }

  let req;
  try {
    req = JSON.parse(event.body || "{}");
  } catch (e) {
    return paymeError(null, -32700, "Parse error", "body");
  }

  const { id, method, params } = req || {};

  try {
    initAdmin();
    const db = admin.firestore();

    const orderId = params?.account?.order_id ? String(params.account.order_id) : null;
    const amount = Number(params?.amount || 0); // tiyin
    const paymeTransId = params?.id ? String(params.id) : null;
    const now = Date.now();

    // Helpers
    async function getOrder(orderIdStr) {
      const ref = db.collection("orders").doc(orderIdStr);
      const snap = await ref.get();
      return { ref, snap, data: snap.exists ? snap.data() : null };
    }

    if (method === "CheckPerformTransaction") {
      if (!orderId) return paymeError(id, -31050, "Order not found", "account.order_id");
      const { data } = await getOrder(orderId);
      if (!data) return paymeError(id, -31050, "Order not found", "order_id");

      if (data.status === "paid") return paymeError(id, -31050, "Already paid", "order_id");
      if (Number(data.amountTiyin) !== amount) return paymeError(id, -31001, "Invalid amount", "amount");

      return ok(id, { allow: true });
    }

    if (method === "CreateTransaction") {
      if (!orderId) return paymeError(id, -31050, "Order not found", "account.order_id");
      if (!paymeTransId) return paymeError(id, -31003, "Transaction id missing", "id");

      const { data } = await getOrder(orderId);
      if (!data) return paymeError(id, -31050, "Order not found", "order_id");
      if (Number(data.amountTiyin) !== amount) return paymeError(id, -31001, "Invalid amount", "amount");

      const time = Number(params?.time || now);

      const transRef = db.collection("payme_transactions").doc(paymeTransId);
      const transSnap = await transRef.get();
      if (transSnap.exists) {
        const t = transSnap.data();
        // If already created, return the same state
        return ok(id, {
          create_time: Number(t.create_time || time),
          transaction: paymeTransId,
          state: Number(t.state || 1),
        });
      }

      await transRef.set({
        orderId,
        amount,
        create_time: time,
        state: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ok(id, { create_time: time, transaction: paymeTransId, state: 1 });
    }

    if (method === "PerformTransaction") {
      if (!paymeTransId) return paymeError(id, -31003, "Transaction not found", "id");

      const transRef = db.collection("payme_transactions").doc(paymeTransId);
      const transSnap = await transRef.get();
      if (!transSnap.exists) return paymeError(id, -31003, "Transaction not found", "id");

      const t = transSnap.data();
      const oId = String(t.orderId || orderId || "");
      if (!oId) return paymeError(id, -31050, "Order not found", "order_id");

      const orderRef = db.collection("orders").doc(oId);

      await db.runTransaction(async (tx) => {
        const oSnap = await tx.get(orderRef);
        if (!oSnap.exists) throw new Error("Order not found");
        const o = oSnap.data();
        if (o.status === "paid") return;

        // amount safety
        if (Number(o.amountTiyin) !== Number(t.amount)) {
          throw new Error("Invalid amount");
        }

        tx.update(orderRef, {
          status: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          paymeTransId,
        });
        tx.update(transRef, { state: 2, perform_time: now });
      });

      return ok(id, { transaction: paymeTransId, state: 2, perform_time: now });
    }

    if (method === "CheckTransaction") {
      if (!paymeTransId) return paymeError(id, -31003, "Transaction not found", "id");
      const transSnap = await db.collection("payme_transactions").doc(paymeTransId).get();
      if (!transSnap.exists) return paymeError(id, -31003, "Transaction not found", "id");
      const t = transSnap.data();
      return ok(id, {
        create_time: Number(t.create_time || 0),
        perform_time: Number(t.perform_time || 0),
        cancel_time: Number(t.cancel_time || 0),
        transaction: paymeTransId,
        state: Number(t.state || 1),
        reason: t.reason ?? null,
      });
    }

    if (method === "CancelTransaction") {
      if (!paymeTransId) return paymeError(id, -31003, "Transaction not found", "id");
      const reason = params?.reason ?? null;

      const transRef = db.collection("payme_transactions").doc(paymeTransId);
      const transSnap = await transRef.get();
      if (!transSnap.exists) return paymeError(id, -31003, "Transaction not found", "id");
      const t = transSnap.data();

      await transRef.set({ state: -1, cancel_time: now, reason }, { merge: true });

      // Also mark order as canceled (optional)
      if (t.orderId) {
        await db.collection("orders").doc(String(t.orderId)).set(
          { status: "canceled", canceledAt: admin.firestore.FieldValue.serverTimestamp(), cancelReason: reason },
          { merge: true }
        );
      }

      return ok(id, { transaction: paymeTransId, state: -1, cancel_time: now });
    }

    return paymeError(id, -32601, "Method not found", "method");
  } catch (e) {
    return paymeError(req?.id ?? null, -32400, String(e?.message || "RPC error"), "server");
  }
};

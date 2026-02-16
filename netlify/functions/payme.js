/**
 * Netlify Function: /.netlify/functions/payme
 * Payme/Paycom Merchant API (JSON-RPC)
 *
 * ✅ Sandbox/Test: set PAYME_KEY + KASSA_ID + FIREBASE_SERVICE_ACCOUNT (JSON)
 * ✅ Production: just replace PAYME_KEY (and if needed KASSA_ID) in Netlify env vars.
 *
 * Endpoint URL you give Payme: https://YOUR-SITE/.netlify/functions/payme
 */

const admin = require("firebase-admin");

let _inited = false;
function initAdmin(){
  if(_inited) return;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if(sa){
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(sa)),
    });
  }else{
    // If you deploy in an environment with default credentials (rare on Netlify), this may work.
    admin.initializeApp();
  }
  _inited = true;
}

function json(statusCode, obj){
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(obj),
  };
}

// Basic Auth: "Paycom:KEY"  (Payme docs)
function authOk(headers){
  const key = (process.env.PAYME_KEY || "").toString().trim();
  const auth = (headers.authorization || headers.Authorization || "").toString();
  if(!key) return { ok:false, err:"PAYME_KEY env not set" };
  if(!auth.startsWith("Basic ")) return { ok:false, err:"Missing Basic auth" };
  const b64 = auth.slice(6).trim();
  let decoded = "";
  try{ decoded = Buffer.from(b64, "base64").toString("utf8"); }catch(e){}
  // Accept both "Paycom:key" and "paycom:key"
  const ok = decoded === `Paycom:${key}` || decoded === `paycom:${key}`;
  return ok ? { ok:true } : { ok:false, err:"Invalid Basic auth" };
}

// Payme error helper (JSON-RPC)
function rpcError(id, code, message, data){
  const err = { code, message };
  if(data !== undefined) err.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error: err };
}
function rpcResult(id, result){
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function nowMs(){ return Date.now(); }

// Payme states: 1-created, 2-performed, -1-canceled after create, -2-canceled after perform
// Reason codes are per Payme docs (we store as-is)
async function getOrder(db, orderId){
  const ref = db.collection("orders").doc(String(orderId));
  const snap = await ref.get();
  if(!snap.exists) return { exists:false, ref, data:null };
  return { exists:true, ref, data: snap.data() || {} };
}

exports.handler = async (event) => {
  // Preflight
  if(event.httpMethod === "OPTIONS"){
    return json(200, { ok:true });
  }
  if(event.httpMethod !== "POST"){
    return json(405, { error: "Method Not Allowed" });
  }

  // Auth check
  const a = authOk(event.headers || {});
  if(!a.ok){
    return json(200, rpcError(null, -32504, "Unauthorized", a.err));
  }

  let payload;
  try{
    payload = JSON.parse(event.body || "{}");
  }catch(e){
    return json(200, rpcError(null, -32700, "Parse error"));
  }

  const { id, method, params } = payload || {};
  if(!method){
    return json(200, rpcError(id, -32600, "Invalid Request"));
  }

  initAdmin();
  const db = admin.firestore();

  try{
    // ===== CheckPerformTransaction =====
    if(method === "CheckPerformTransaction"){
      const amount = Number(params?.amount || 0); // tiyin
      const orderId = params?.account?.order_id ?? params?.account?.orderId ?? params?.account?.id;
      if(!orderId) return json(200, rpcError(id, -31050, "Order ID required"));

      const ord = await getOrder(db, orderId);
      if(!ord.exists) return json(200, rpcError(id, -31050, "Order not found"));

      const expected = Number(ord.data.amountTiyin || Math.round(Number(ord.data.totalUZS||0) * 100) || 0);
      if(expected <= 0) return json(200, rpcError(id, -31050, "Order amount missing"));
      if(amount !== expected){
        return json(200, rpcError(id, -31001, "Incorrect amount", { expected, got: amount }));
      }

      // Allow only if not already paid/canceled
      const st = (ord.data.status || "").toString();
      const paySt = (ord.data.payment?.status || "").toString();
      if(st === "paid" || paySt === "paid"){
        return json(200, rpcError(id, -31050, "Already paid"));
      }
      if(st.includes("cancel")){
        return json(200, rpcError(id, -31050, "Order canceled"));
      }

      return json(200, rpcResult(id, { allow: true }));
    }

    // Common: transactionId and orderId
    if(["CreateTransaction","PerformTransaction","CancelTransaction","CheckTransaction"].includes(method)){
      const transactionId = String(params?.id || "");
      if(!transactionId) return json(200, rpcError(id, -31003, "Transaction ID required"));
      const txRef = db.collection("payme_transactions").doc(transactionId);

      // ===== CreateTransaction =====
      if(method === "CreateTransaction"){
        const amount = Number(params?.amount || 0);
        const orderId = params?.account?.order_id ?? params?.account?.orderId ?? params?.account?.id;
        if(!orderId) return json(200, rpcError(id, -31050, "Order ID required"));

        const ord = await getOrder(db, orderId);
        if(!ord.exists) return json(200, rpcError(id, -31050, "Order not found"));

        const expected = Number(ord.data.amountTiyin || Math.round(Number(ord.data.totalUZS||0) * 100) || 0);
        if(amount !== expected){
          return json(200, rpcError(id, -31001, "Incorrect amount", { expected, got: amount }));
        }

        const existing = await txRef.get();
        if(existing.exists){
          const tx = existing.data() || {};
          // If already created/performed, return same
          return json(200, rpcResult(id, {
            create_time: tx.create_time,
            perform_time: tx.perform_time || 0,
            cancel_time: tx.cancel_time || 0,
            transaction: transactionId,
            state: tx.state,
            reason: tx.reason ?? null
          }));
        }

        const create_time = nowMs();
        await txRef.set({
          transaction: transactionId,
          order_id: String(orderId),
          amount,
          state: 1,
          reason: null,
          create_time,
          perform_time: 0,
          cancel_time: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Mark order as pending payment (safe)
        await ord.ref.set({
          status: ord.data.status || "pending_payment",
          provider: "payme",
          payment: {
            ...(ord.data.payment || {}),
            status: "created",
            transaction: transactionId,
            amountTiyin: amount,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge:true });

        return json(200, rpcResult(id, {
          create_time,
          perform_time: 0,
          cancel_time: 0,
          transaction: transactionId,
          state: 1
        }));
      }

      // ===== PerformTransaction =====
      if(method === "PerformTransaction"){
        const snap = await txRef.get();
        if(!snap.exists) return json(200, rpcError(id, -31003, "Transaction not found"));
        const tx = snap.data() || {};
        if(tx.state === 2){
          return json(200, rpcResult(id, {
            transaction: transactionId,
            perform_time: tx.perform_time,
            state: 2
          }));
        }
        if(tx.state < 0){
          return json(200, rpcError(id, -31008, "Transaction canceled"));
        }
        const perform_time = nowMs();
        await txRef.set({
          state: 2,
          perform_time,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge:true });

        // Update order: PAID
        const ord = await getOrder(db, tx.order_id);
        if(ord.exists){
          await ord.ref.set({
            status: "paid",
            payment: {
              ...(ord.data.payment || {}),
              status: "paid",
              transaction: transactionId,
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge:true });
        }

        return json(200, rpcResult(id, {
          transaction: transactionId,
          perform_time,
          state: 2
        }));
      }

      // ===== CancelTransaction =====
      if(method === "CancelTransaction"){
        const reason = params?.reason ?? null;
        const snap = await txRef.get();
        if(!snap.exists) return json(200, rpcError(id, -31003, "Transaction not found"));
        const tx = snap.data() || {};
        if(tx.state < 0){
          return json(200, rpcResult(id, {
            transaction: transactionId,
            cancel_time: tx.cancel_time,
            state: tx.state
          }));
        }
        const cancel_time = nowMs();
        const newState = (tx.state === 2) ? -2 : -1;
        await txRef.set({
          state: newState,
          reason,
          cancel_time,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge:true });

        const ord = await getOrder(db, tx.order_id);
        if(ord.exists){
          await ord.ref.set({
            status: "canceled",
            payment: {
              ...(ord.data.payment || {}),
              status: "canceled",
              transaction: transactionId,
              canceledAt: admin.firestore.FieldValue.serverTimestamp(),
              reason: reason ?? null
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge:true });
        }

        return json(200, rpcResult(id, {
          transaction: transactionId,
          cancel_time,
          state: newState
        }));
      }

      // ===== CheckTransaction =====
      if(method === "CheckTransaction"){
        const snap = await txRef.get();
        if(!snap.exists) return json(200, rpcError(id, -31003, "Transaction not found"));
        const tx = snap.data() || {};
        return json(200, rpcResult(id, {
          create_time: tx.create_time,
          perform_time: tx.perform_time || 0,
          cancel_time: tx.cancel_time || 0,
          transaction: transactionId,
          state: tx.state,
          reason: tx.reason ?? null
        }));
      }
    }

    // ===== GetStatement =====
    if(method === "GetStatement"){
      const from = Number(params?.from || 0);
      const to = Number(params?.to || 0);
      if(!from || !to) return json(200, rpcError(id, -32602, "from/to required"));
      const q = await db.collection("payme_transactions")
        .where("create_time", ">=", from)
        .where("create_time", "<=", to)
        .get();
      const transactions = q.docs.map(d=>{
        const tx = d.data()||{};
        return {
          id: tx.transaction,
          time: tx.create_time,
          amount: tx.amount,
          account: { order_id: tx.order_id },
          create_time: tx.create_time,
          perform_time: tx.perform_time || 0,
          cancel_time: tx.cancel_time || 0,
          transaction: tx.transaction,
          state: tx.state,
          reason: tx.reason ?? null
        };
      });
      return json(200, rpcResult(id, { transactions }));
    }

    // Unknown method
    return json(200, rpcError(id, -32601, "Method not found"));
  }catch(e){
    console.error("payme fn error", e);
    return json(200, rpcError(payload?.id ?? null, -32000, "Server error", e?.message || String(e)));
  }
};

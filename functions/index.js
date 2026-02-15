const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ type: "*/*" })); // Payme sends text/json

// ===== Config =====
// Use firebase functions config OR env vars (set in Cloud Functions)
function getCfg(key, def=""){ return (process.env[key] || def).toString().trim(); }
const PAYME_LOGIN = getCfg("PAYME_LOGIN");
const PAYME_KEY   = getCfg("PAYME_KEY"); // password/key
const TG_BOT_TOKEN = getCfg("TG_BOT_TOKEN");
const TG_ADMIN_CHAT_ID = getCfg("TG_ADMIN_CHAT_ID");

function basicAuthOk(req){
  const hdr = (req.headers.authorization || "").toString();
  if(!hdr.startsWith("Basic ")) return false;
  const b64 = hdr.slice(6).trim();
  let decoded = "";
  try{ decoded = Buffer.from(b64, "base64").toString("utf8"); }catch(e){ return false; }
  const [login, pass] = decoded.split(":");
  if(!login || !pass) return false;
  return login === PAYME_LOGIN && pass === PAYME_KEY;
}

function rpcError(code, message, data=null){
  // Payme expects JSON-RPC 2.0 style error object
  return { error: { code, message: { ru: message, uz: message, en: message }, data } };
}

// Payme transaction states: 1(created), 2(performed), -1(cancelled), -2(cancelled after perform)
const STATE_CREATED = 1;
const STATE_PERFORMED = 2;
const STATE_CANCELLED = -1;
const STATE_CANCELLED_AFTER_PERFORM = -2;

// Errors per Payme docs (common set)
const ERR_INVALID_AMOUNT = -31001;
const ERR_ORDER_NOT_FOUND = -31050; // -31050..-31099 are account errors
const ERR_TX_NOT_FOUND = -31003;
const ERR_CANNOT_PERFORM = -31008;
const ERR_CANNOT_CANCEL = -31007; // commonly used
const ERR_SYSTEM = -32400;
const ERR_INSUFFICIENT_PRIV = -32504;

async function sendTelegram(html){
  if(!TG_BOT_TOKEN || !TG_ADMIN_CHAT_ID) return;
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  const params = new URLSearchParams({
    chat_id: TG_ADMIN_CHAT_ID,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: "true",
  });
  try{
    // Node18 global fetch
    await fetch(url, { method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"}, body: params.toString() });
  }catch(e){}
}

function esc(s){ return String(s ?? "").replace(/[<>&]/g, c=>({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c])); }
function orderPaidHtml(order){
  return [
    `<b>✅ TO'LOV TASDIQLANDI (PAYME)</b>`,
    `Buyurtma ID: <code>${esc(order.orderId || order.id || "")}</code>`,
    order.omId ? `User ID: <b>${esc(order.omId)}</b>` : "",
    order.userName ? `Ism: <b>${esc(order.userName)}</b>` : "",
    order.userPhone ? `Tel: <b>${esc(order.userPhone)}</b>` : "",
    order.totalUZS != null ? `Summa: <b>${Number(order.totalUZS).toLocaleString()} so'm</b>` : "",
    `Status: <b>PAID</b>`,
  ].filter(Boolean).join("\n");
}

async function getOrderByAccount(account){
  // We use account.order_id as primary
  const orderId = (account && (account.order_id || account.orderId || account.order || account.id)) ? String(account.order_id || account.orderId || account.order || account.id) : "";
  if(!orderId) return null;
  const ref = db.doc(`orders/${orderId}`);
  const snap = await ref.get();
  if(!snap.exists) return null;
  return { ref, data: snap.data() || {}, orderId };
}

function uzsToTiyin(uzs){
  const n = Number(uzs || 0);
  // avoid float issues
  return Math.round(n * 100);
}

async function upsertPaymeTx(paymeId, patch){
  const ref = db.doc(`payme_transactions/${paymeId}`);
  await ref.set({ paymeId, ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  const snap = await ref.get();
  return { ref, data: snap.data() || {} };
}

app.post("/payme", async (req, res) => {
  // Per protocol: always HTTP 200 (even on errors) citeturn1view0
  try{
    if(!PAYME_LOGIN || !PAYME_KEY){
      return res.status(200).json(rpcError(ERR_SYSTEM, "PAYME credentials not configured"));
    }
    if(!basicAuthOk(req)){
      // insufficient privileges citeturn4view0
      return res.status(200).json(rpcError(ERR_INSUFFICIENT_PRIV, "Insufficient privileges"));
    }

    const { method, params, id } = req.body || {};
    const rpcId = (id === undefined) ? 0 : id;

    // ===== CheckPerformTransaction =====
    if(method === "CheckPerformTransaction"){
      const amount = Number(params?.amount || 0);
      const orderObj = await getOrderByAccount(params?.account);
      if(!orderObj) return res.status(200).json({ id: rpcId, ...rpcError(ERR_ORDER_NOT_FOUND, "Order not found", "account.order_id") }); 
      const order = orderObj.data;
      const expected = uzsToTiyin(order.totalUZS);
      if(amount !== expected) return res.status(200).json({ id: rpcId, ...rpcError(ERR_INVALID_AMOUNT, "Invalid amount") }); 
      if(String(order.status||"") === "paid") return res.status(200).json({ id: rpcId, ...rpcError(ERR_CANNOT_PERFORM, "Order already paid") });
      return res.status(200).json({ id: rpcId, result: { allow: true } });
    }

    // ===== CreateTransaction =====
    if(method === "CreateTransaction"){
      const paymeId = String(params?.id || "");
      const amount = Number(params?.amount || 0);
      const time = Number(params?.time || 0);

      const orderObj = await getOrderByAccount(params?.account);
      if(!orderObj) return res.status(200).json({ id: rpcId, ...rpcError(ERR_ORDER_NOT_FOUND, "Order not found", "account.order_id") }); citeturn1view1
      const order = orderObj.data;

      const expected = uzsToTiyin(order.totalUZS);
      if(amount !== expected) return res.status(200).json({ id: rpcId, ...rpcError(ERR_INVALID_AMOUNT, "Invalid amount") }); citeturn1view1

      // Create or return existing tx
      const txSnap = await db.doc(`payme_transactions/${paymeId}`).get();
      if(txSnap.exists){
        const tx = txSnap.data() || {};
        return res.status(200).json({
          id: rpcId,
          result: {
            create_time: tx.create_time || tx.createTime || Date.now(),
            transaction: tx.transaction || paymeId,
            state: tx.state ?? STATE_CREATED,
            receivers: null
          }
        });
      }

      // Store tx in Firestore (permanent storage recommended) citeturn1view1
      const create_time = Date.now();
      await upsertPaymeTx(paymeId, {
        transaction: paymeId,
        orderId: orderObj.orderId,
        uid: order.uid || null,
        amount,
        time,
        create_time,
        state: STATE_CREATED,
      });

      // Mark order pending_payment
      await orderObj.ref.set({
        status: "pending_payment",
        payme: { id: paymeId, state: STATE_CREATED, create_time },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return res.status(200).json({
        id: rpcId,
        result: { create_time, transaction: paymeId, state: STATE_CREATED, receivers: null }
      });
    }

    // ===== PerformTransaction =====
    if(method === "PerformTransaction"){
      const paymeId = String(params?.id || "");
      const txRef = db.doc(`payme_transactions/${paymeId}`);
      const txSnap = await txRef.get();
      if(!txSnap.exists) return res.status(200).json({ id: rpcId, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }); 
      const tx = txSnap.data() || {};

      if(tx.state === STATE_PERFORMED){
        return res.status(200).json({ id: rpcId, result: { transaction: tx.transaction || paymeId, perform_time: tx.perform_time || tx.performTime || Date.now(), state: STATE_PERFORMED } });
      }
      if(tx.state !== STATE_CREATED){
        return res.status(200).json({ id: rpcId, ...rpcError(ERR_CANNOT_PERFORM, "Cannot perform transaction") }); 
      }

      const orderRef = db.doc(`orders/${tx.orderId}`);
      const orderSnap = await orderRef.get();
      if(!orderSnap.exists) return res.status(200).json({ id: rpcId, ...rpcError(ERR_ORDER_NOT_FOUND, "Order not found", "account.order_id") });

      const order = orderSnap.data() || {};
      // Amount check again
      if(Number(tx.amount) !== uzsToTiyin(order.totalUZS)){
        return res.status(200).json({ id: rpcId, ...rpcError(ERR_INVALID_AMOUNT, "Invalid amount") });
      }

      const perform_time = Date.now();

      // Atomic update: tx + order
      await db.runTransaction(async (t)=>{
        const txS = await t.get(txRef);
        if(!txS.exists) throw new Error("tx_missing");
        const cur = txS.data() || {};
        if(cur.state === STATE_PERFORMED) return;

        t.set(txRef, { state: STATE_PERFORMED, perform_time, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });

        t.set(orderRef, {
          status: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          payme: { ...(order.payme||{}), id: paymeId, state: STATE_PERFORMED, perform_time },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge:true });

        // If this is a BALANCE TOPUP order, credit user's wallet
        if(String(order.orderType||"") === "topup" && order.uid){
          const uref = db.doc(`users/${order.uid}`);
          const usnap = await t.get(uref);
          const udata = usnap.exists ? (usnap.data()||{}) : {};
          const bal = Number(udata.balanceUZS||0) || 0;
          const add = Number(order.totalUZS||0) || 0;
          t.set(uref, {
            balanceUZS: bal + add,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge:true });

          t.set(orderRef, {
            creditedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge:true });
        }
      });

      // Server-side Telegram notify on PAID (best practice)
      await sendTelegram(orderPaidHtml({ ...order, orderId: tx.orderId }));

      return res.status(200).json({ id: rpcId, result: { transaction: tx.transaction || paymeId, perform_time, state: STATE_PERFORMED } });
    }

    // ===== CancelTransaction =====
    if(method === "CancelTransaction"){
      const paymeId = String(params?.id || "");
      const reason = params?.reason ?? null;

      const txRef = db.doc(`payme_transactions/${paymeId}`);
      const txSnap = await txRef.get();
      if(!txSnap.exists) return res.status(200).json({ id: rpcId, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }); citeturn0search8
      const tx = txSnap.data() || {};

      if(tx.state === STATE_CANCELLED || tx.state === STATE_CANCELLED_AFTER_PERFORM){
        return res.status(200).json({ id: rpcId, result: { transaction: tx.transaction || paymeId, cancel_time: tx.cancel_time || Date.now(), state: tx.state, reason: tx.reason ?? reason } });
      }

      const cancel_time = Date.now();
      const newState = (tx.state === STATE_PERFORMED) ? STATE_CANCELLED_AFTER_PERFORM : STATE_CANCELLED;

      await txRef.set({ state: newState, cancel_time, reason: reason ?? null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });

      // Update order
      if(tx.orderId){
        await db.doc(`orders/${tx.orderId}`).set({
          status: (newState === STATE_CANCELLED_AFTER_PERFORM) ? "refunded" : "cancelled",
          payme: { ...(tx.payme||{}), id: paymeId, state: newState, cancel_time, reason },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge:true });
      }

      return res.status(200).json({ id: rpcId, result: { transaction: tx.transaction || paymeId, cancel_time, state: newState, reason: reason ?? null } });
    }

    // ===== CheckTransaction =====
    if(method === "CheckTransaction"){
      const paymeId = String(params?.id || "");
      const txSnap = await db.doc(`payme_transactions/${paymeId}`).get();
      if(!txSnap.exists) return res.status(200).json({ id: rpcId, ...rpcError(ERR_TX_NOT_FOUND, "Transaction not found") }); citeturn0search5
      const tx = txSnap.data() || {};
      return res.status(200).json({
        id: rpcId,
        result: {
          create_time: tx.create_time || 0,
          perform_time: tx.perform_time || 0,
          cancel_time: tx.cancel_time || 0,
          transaction: tx.transaction || paymeId,
          state: tx.state ?? STATE_CREATED,
          reason: tx.reason ?? null
        }
      });
    }

    // ===== GetStatement (optional minimal) =====
    if(method === "GetStatement"){
      // For simplicity, return empty. You can implement if needed.
      return res.status(200).json({ id: rpcId, result: { transactions: [] } });
    }

    return res.status(200).json({ id: rpcId, ...rpcError(ERR_SYSTEM, "Unknown method") });

  }catch(e){
    return res.status(200).json(rpcError(ERR_SYSTEM, "System error"));
  }
});

exports.paymeMerchantApi = functions.region("asia-northeast1").https.onRequest(app);

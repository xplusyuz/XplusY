/**
 * Secure Telegram notifications (Netlify Function)
 *
 * ENV:
 *  - ORDER_BOT_TOKEN (preferred) or TELEGRAM_BOT_TOKEN or TG_BOT_TOKEN
 *  - TELEGRAM_ADMIN_CHAT_ID
 *  - FIREBASE_SERVICE_ACCOUNT_B64
 */
const admin = require("firebase-admin");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
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


async function verifyUserByPassHash(uid, passHash){
  try{
    initFirebase();
    const snap = await admin.firestore().doc(`users/${String(uid||'')}`).get();
    if(!snap.exists) return null;
    const d = snap.data() || {};
    if(String(d.passHash||'') && String(d.passHash) === String(passHash||'')){
      return { uid: String(uid) };
    }
    return null;
  }catch(e){
    console.warn("verifyUserByPassHash failed", e);
    return null;
  }
}

function parseBody(event) {
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : (event.body || "");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getBearer(event) {
  const h = event.headers || {};
  const a = h.authorization || h.Authorization || "";
  const m = String(a).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function tgEscape(s){ return String(s ?? "").replace(/[<>&]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c])); }

function fmtUZS(n){
  const x = Number(n||0);
  if(!Number.isFinite(x)) return "0";
  try { return x.toLocaleString("ru-RU"); } catch { return String(Math.round(x)); }
}

function buildOrderCreatedHTML(o){
  const items = Array.isArray(o.items) ? o.items : [];
  const itemLines = items.slice(0, 8).map((it)=>{
    const title = tgEscape(it.title || it.name || it.productTitle || "Mahsulot");
    const qty = Number(it.qty || it.count || 1) || 1;
    const sku = tgEscape(it.sku || it.variantKey || it.key || "");
    const price = Number(it.priceUZS || it.price || 0) || 0;
    const tail = [sku ? `<code>${sku}</code>` : "", price ? `${fmtUZS(price)} so'm` : ""].filter(Boolean).join(" · ");
    return `• ${title} ×${qty}${tail ? ` <i>(${tail})</i>` : ""}`;
  });
  const more = items.length > 8 ? `<i>... yana ${items.length-8} ta</i>` : "";
  const addr = o.shipping && o.shipping.addressText ? tgEscape(o.shipping.addressText) : "";
  const pay = tgEscape(o.provider || "");
  const sum = fmtUZS(o.totalUZS||0);

  return [
    `<b>🛒 Yangi buyurtma!</b>`,
    `Buyurtma ID: <code>${tgEscape(o.orderId || o.id || "")}</code>`,
    o.uid ? `UID: <code>${tgEscape(o.uid)}</code>` : "",
    o.numericId ? `User ID: <b>${tgEscape(o.numericId)}</b>` : "",
    o.userName ? `Ism: <b>${tgEscape(o.userName)}</b>` : "",
    o.userPhone ? `Tel: <b>${tgEscape(o.userPhone)}</b>` : "",
    (o.region || o.shipping?.region) ? `Viloyat: <b>${tgEscape(o.region || o.shipping?.region)}</b>` : "",
    (o.district || o.shipping?.district) ? `Tuman: <b>${tgEscape(o.district || o.shipping?.district)}</b>` : "",
    (o.post || o.shipping?.post) ? `Pochta: <b>${tgEscape(o.post || o.shipping?.post)}</b>` : "",
    pay ? `To'lov: <b>${pay}</b>` : "",
    `Summa: <b>${sum} so'm</b>`,
    addr ? `Manzil: <i>${addr}</i>` : "",
    "",
    `<b>📦 Mahsulotlar:</b>`,
    ...itemLines,
    more,
  ].filter(Boolean).join("\n");
}

async function sendTelegram(botToken, chatId, html){
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data || data.ok !== true){
    const err = data && data.description ? data.description : `telegram_http_${res.status}`;
    throw new Error(err);
  }
  return true;
}

exports.handler = async (event) => {
  try{
    if ((event.httpMethod || "").toUpperCase() !== "POST") {
      return json(405, { ok:false, error:"Method Not Allowed" });
    }

    const body = parseBody(event) || {};
    const ev = String(body.event || "");
    const orderId = String(body.orderId || "").trim();
    if (ev !== "order_created" || orderId.length < 3) {
      return json(400, { ok:false, error:"bad_request" });
    }

    const token = getBearer(event);

    let decoded = null;
    if(token){
      initFirebase();
      decoded = await admin.auth().verifyIdToken(token);
    }

    if(!decoded){
      // Fallback (no Firebase Auth): verify by uid+passHash in body
      if(body && body.uid && body.passHash){
        decoded = await verifyUserByPassHash(body.uid, body.passHash);
      }
    }

    if(!decoded) return json(401, { ok:false, error:"unauthorized" });
const uid = decoded && decoded.uid ? String(decoded.uid) : "";
    if(!uid) return json(401, { ok:false, error:"invalid_token" });

    const botToken = (process.env.ORDER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "").trim();
    const adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
    if(botToken.length < 10 || adminChatId.length < 3){
      return json(500, { ok:false, error:"telegram_env_missing" });
    }

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if(!orderSnap.exists) return json(404, { ok:false, error:"order_not_found" });
    const o = orderSnap.data() || {};

    // Only allow caller to notify about THEIR order
    if(String(o.uid||"") !== uid) return json(403, { ok:false, error:"forbidden" });

    // Deduplicate: one message per uid+orderId+event
    const logRef = db.collection("telegram_logs").doc(`${uid}_${orderId}_${ev}`);
    let already = false;
    await db.runTransaction(async (t)=>{
      const s = await t.get(logRef);
      if(s.exists){ already = true; return; }
      t.set(logRef, { uid, orderId, event: ev, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    if(already){
      return json(200, { ok:true, dedup:true });
    }

    // Build html server-side (ignore any client-provided html)
    const html = buildOrderCreatedHTML({ ...o, orderId });

    // Send admin notification
    await sendTelegram(botToken, adminChatId.trim(), html);

    // Optional: send user notification if their chat id exists in profile/order
    const userChatId = String(o.userTgChatId || o.telegramChatId || o.tgChatId || "").trim();
    if(userChatId.length >= 3){
      try{ await sendTelegram(botToken, userChatId, html); }catch(_e){}
    }

    return json(200, { ok:true });
  }catch(e){
    return json(500, { ok:false, error: String(e && e.message ? e.message : e) });
  }
};

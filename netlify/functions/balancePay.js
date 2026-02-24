/**
 * Netlify Function: Pay with internal balance (secure)
 *
 * POST JSON:
 *  { items, totalUZS, shipping }
 *
 * Headers:
 *  Authorization: Bearer <Firebase ID token>
 *
 * ENV:
 *  - FIREBASE_SERVICE_ACCOUNT_B64
 */
const admin = require("firebase-admin");

function tgEscape(s){ return String(s ?? "").replace(/[<>&]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c])); }
function fmtUZS(n){
  const x = Number(n||0);
  if(!Number.isFinite(x)) return "0";
  try { return x.toLocaleString("ru-RU"); } catch { return String(Math.round(x)); }
}
function buildOrderPaidHTML(o){
  const items = Array.isArray(o.items) ? o.items : [];
  const itemLines = items.slice(0, 8).map((it)=>{
    const title = tgEscape(it.title || it.name || it.productTitle || "Mahsulot");
    const qty = Number(it.qty || it.count || 1) || 1;
    const price = Number(it.priceUZS || it.price || 0) || 0;
    return `• ${title} ×${qty}${price ? ` <i>(${fmtUZS(price)} so'm)</i>` : ""}`;
  });
  const more = items.length > 8 ? `<i>... yana ${items.length-8} ta</i>` : "";
  const addr = o.shipping?.addressText ? tgEscape(o.shipping.addressText) : "";
  return [
    `<b>✅ Balans orqali to‘landi!</b>`,
    `Buyurtma ID: <code>${tgEscape(o.orderId||"")}</code>`,
    o.numericId ? `User ID: <b>${tgEscape(o.numericId)}</b>` : "",
    o.userName ? `Ism: <b>${tgEscape(o.userName)}</b>` : "",
    o.userPhone ? `Tel: <b>${tgEscape(o.userPhone)}</b>` : "",
    o.region ? `Viloyat: <b>${tgEscape(o.region)}</b>` : "",
    o.district ? `Tuman: <b>${tgEscape(o.district)}</b>` : "",
    o.post ? `Pochta: <b>${tgEscape(o.post)}</b>` : "",
    `Summa: <b>${fmtUZS(o.totalUZS||0)} so'm</b>`,
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
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data || data.ok !== true){
    const err = data && data.description ? data.description : `telegram_http_${res.status}`;
    throw new Error(err);
  }
  return true;
}


function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
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

function getBearer(headers) {
  const h = headers.authorization || headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(200, { ok: true });

  try {
    initFirebase();
    const db = admin.firestore();

    const token = getBearer(event.headers || {});
    if (!token) return json(401, { ok: false, error: "missing_token" });

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = JSON.parse(event.body || "{}");
    const items = Array.isArray(body.items) ? body.items : [];
    const totalUZS = Math.trunc(Number(body.totalUZS || 0));
    const shipping = body.shipping || null;

    if (!totalUZS || totalUZS <= 0) return json(400, { ok: false, error: "bad_total" });

    const orderId = (body.orderId && String(body.orderId).trim()) || String(Date.now());

    const result = await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new Error("no_user");
      const u = uSnap.data() || {};
      const bal = Math.trunc(Number(u.balanceUZS || 0));
      if (bal < totalUZS) throw new Error("insufficient_balance");

      tx.set(userRef, { balanceUZS: bal - totalUZS, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      const numericId = u.numericId != null ? String(u.numericId) : null;
      const userName = u.name || null;
      const userPhone = u.phone || null;
      const userTgChatId = u.telegramChatId || u.tgChatId || null;
      const firstName = u.firstName || null;
      const lastName = u.lastName || null;
      const region = u.region || null;
      const district = u.district || null;
      const post = u.post || null;

      const shippingFinal = (() => {
        const s = shipping && typeof shipping === "object" ? { ...shipping } : {};
        if(!s.region && region) s.region = region;
        if(!s.district && district) s.district = district;
        if(!s.post && post) s.post = post;
        if(!s.addressText){
          const at = [s.region, s.district, s.post].filter(Boolean).join(" / ");
          if(at) s.addressText = at;
        }
        return Object.keys(s).length ? s : null;
      })();

      const order = {
        orderId,
        uid,
        numericId,
        userName,
        userPhone,
        userTgChatId,
        status: "paid",
        firstName,
        lastName,
        region,
        district,
        post,
        items,
        totalUZS,
        amountTiyin: null,
        provider: "balance",
        shipping: shippingFinal,
        orderType: "checkout",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "web",
      };

      tx.set(db.collection("orders").doc(orderId), order, { merge: true });
      tx.set(db.collection("users").doc(uid).collection("orders").doc(orderId), order, { merge: true });

      return { orderId };
    });

    // Telegram notify (ORDER bot) for balance-paid checkout
    try{
      const botToken = (process.env.ORDER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "").trim();
      const adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
      if(botToken.length > 10 && adminChatId.length >= 3){
        const orderSnap = await db.collection("orders").doc(result.orderId).get();
        const o = orderSnap.exists ? (orderSnap.data() || {}) : {};
        const html = buildOrderPaidHTML({ ...o, orderId: result.orderId });
        await sendTelegram(botToken, adminChatId, html);
        const userChatId = String(o.userTgChatId || o.telegramChatId || o.tgChatId || "").trim();
        if(userChatId.length >= 3){
          try{ await sendTelegram(botToken, userChatId, html); }catch(_e){}
        }
      }
    }catch(_e){}

    return json(200, { ok: true, ...result });
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("insufficient_balance")) return json(400, { ok: false, error: "insufficient_balance" });
    return json(500, { ok: false, error: "server", message: msg });
  }
};

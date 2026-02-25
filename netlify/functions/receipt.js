/**
 * receipt.js
 * Netlify Function: receive base64 receipt (image/pdf) and forward to Telegram (no Firebase Storage).
 *
 * ENV:
 *  - TOPUP_BOT_TOKEN (preferred) or TG_BOT_TOKEN or TELEGRAM_BOT_TOKEN
 *  - TELEGRAM_ADMIN_CHAT_ID
 * Optional auth:
 *  - FIREBASE_SERVICE_ACCOUNT_B64  (base64 of service account JSON) => verifies Authorization: Bearer <Firebase ID token>
 *  - RECEIPT_UPLOAD_SECRET        => if service account not provided, requires header x-upload-secret
 */

function json(statusCode, body, extraHeaders={}){
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function safeText(s, max=500){
  s = String(s ?? '').trim();
  if(s.length > max) s = s.slice(0, max-1) + '…';
  return s;
}

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;');
}

function decodeB64ToBuffer(b64){
  // remove data URL prefix if present
  const cleaned = String(b64||'').replace(/^data:.*?;base64,/i,'');
  return Buffer.from(cleaned, 'base64');
}

async function verifyFirebaseIdToken(idToken){
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if(!b64) return null;

  let admin;
  try{
    const saJson = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    admin = require('firebase-admin');
    if(!admin.apps.length){
      admin.initializeApp({ credential: admin.credential.cert(saJson) });
    }
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  }catch(e){
    console.warn('verifyIdToken failed', e);
    return null;
  }
}

async function sendTelegramDocument({token, chatId, captionHtml, fileName, mimeType, buffer}){
  const url = `https://api.telegram.org/bot${token}/sendDocument`;

  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', captionHtml);
  form.append('parse_mode', 'HTML');
  form.append('document', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), fileName || 'receipt');

  const res = await fetch(url, { method:'POST', body: form });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data || data.ok !== true){
    const msg = data?.description || 'telegram_send_failed';
    throw new Error(msg);
  }
  return data.result;
}

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== 'POST'){
      return json(405, { ok:false, error:'method_not_allowed' });
    }

    const token = (process.env.TOPUP_BOT_TOKEN || process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
    if(!token || !chatId){
      return json(500, { ok:false, error:'missing_telegram_env' });
    }

    const authz = event.headers?.authorization || event.headers?.Authorization || '';
    const secret = event.headers?.['x-upload-secret'] || event.headers?.['X-Upload-Secret'] || '';

    // Auth:
    // - If FIREBASE_SERVICE_ACCOUNT_B64 exists => require valid Firebase ID token
    // - Else if RECEIPT_UPLOAD_SECRET exists => require x-upload-secret
    const needFirebase = !!process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    const needSecret = !needFirebase && !!process.env.RECEIPT_UPLOAD_SECRET;

    let actor = null;
    if(needFirebase){
      const m = String(authz).match(/^Bearer\s+(.+)$/i);
      const idToken = m ? m[1] : '';
      if(!idToken) return json(401, { ok:false, error:'missing_bearer_token' });
      actor = await verifyFirebaseIdToken(idToken);
      if(!actor) return json(401, { ok:false, error:'invalid_token' });
    }else if(needSecret){
      if(!secret || secret !== process.env.RECEIPT_UPLOAD_SECRET){
        return json(401, { ok:false, error:'invalid_secret' });
      }
    }

    const body = JSON.parse(event.body || '{}');
    const {
      kind,
      reqId,
      amountUZS,
      payerFirst,
      payerLast,
      payerCardLast4,
      payerCardMasked,
      adminCardNumber,
      adminCardHolder,
      numericId,
      fileName,
      mimeType,
      fileB64
    } = body || {};

    if(!fileB64) return json(400, { ok:false, error:'missing_file' });

    const buf = decodeB64ToBuffer(fileB64);
    const maxBytes = 20 * 1024 * 1024;
    if(buf.length > maxBytes){
      return json(413, { ok:false, error:'file_too_large' });
    }

    const uid = actor?.uid || null;
    const email = actor?.email || null;

    const caption = [
      `<b>🧾 Balans to‘ldirish so‘rovi</b>`,
      reqId ? `\n<b>So‘rov ID:</b> <code>${escapeHtml(reqId)}</code>` : '',
      numericId ? `\n<b>User ID:</b> <code>${escapeHtml(numericId)}</code>` : '',
      uid ? `\n<b>UID:</b> <code>${escapeHtml(uid)}</code>` : '',
      email ? `\n<b>Email:</b> ${escapeHtml(email)}` : '',
      `\n<b>Summa:</b> <b>${escapeHtml(String(amountUZS||''))}</b> so‘m`,
      (payerFirst||payerLast) ? `\n<b>Ism:</b> ${escapeHtml((payerFirst||'') + ' ' + (payerLast||''))}` : '',
      payerCardMasked ? `\n<b>Yuborgan karta:</b> ${escapeHtml(payerCardMasked)}` : (payerCardLast4 ? `\n<b>Yuborgan karta:</b> **** ${escapeHtml(payerCardLast4)}` : ''),
      adminCardNumber ? `\n<b>Admin karta:</b> ${escapeHtml(String(adminCardNumber))}` : '',
      adminCardHolder ? `\n<b>Karta egasi:</b> ${escapeHtml(String(adminCardHolder))}` : '',
      kind ? `\n<b>Type:</b> ${escapeHtml(String(kind))}` : ''
    ].filter(Boolean).join('');

    const result = await sendTelegramDocument({
      token,
      chatId,
      captionHtml: caption,
      fileName: safeText(fileName || 'receipt', 80),
      mimeType: mimeType || 'application/octet-stream',
      buffer: buf
    });

    return json(200, { ok:true, messageId: result?.message_id || null });
  }catch(e){
    console.error('receipt fn error', e);
    return json(500, { ok:false, error: String(e?.message || e) });
  }
};

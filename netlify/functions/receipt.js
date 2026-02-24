/**
<<<<<<< HEAD
 * Receipt upload -> Telegram (NO Firebase Storage)
 *
 * Client sends JSON:
 *  {
 *    orderType: "topup"|"checkout"|"other",
 *    amountUZS: number,
 *    card: string,
 *    fullName: string,
 *    note: string,
 *    fileName: string,
 *    mimeType: string,
 *    fileB64: string  // base64 of the file bytes
 *  }
 *
 * Security:
 *  - If Authorization: Bearer <Firebase ID token> is provided AND FIREBASE_SERVICE_ACCOUNT_B64 exists,
 *    we verify the token and include uid/email in the message.
 *  - Otherwise, you can allow uploads by setting RECEIPT_UPLOAD_SECRET and sending header:
 *      x-upload-secret: <secret>
=======
 * receipt.js
 * Netlify Function: receive base64 receipt (image/pdf) and forward to Telegram (no Firebase Storage).
>>>>>>> 19aee9b0573feb32b3e808e15f94e52ec2dac3a5
 *
 * ENV:
 *  - TELEGRAM_BOT_TOKEN
 *  - TELEGRAM_ADMIN_CHAT_ID
<<<<<<< HEAD
 *  - FIREBASE_SERVICE_ACCOUNT_B64 (optional, only needed for verifying Firebase ID tokens)
 *  - RECEIPT_UPLOAD_SECRET (optional fallback)
 */

const admin = require('firebase-admin');

function json(statusCode, obj){
  return { statusCode, headers: { 'content-type':'application/json; charset=utf-8' }, body: JSON.stringify(obj) };
}

function getBearer(event){
  const h = event.headers || {};
  const a = h.authorization || h.Authorization || '';
  const m = String(a).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function parseBody(event){
  try{
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : (event.body || '');
    return JSON.parse(raw);
  }catch{ return null; }
}

function initFirebaseIfPossible(){
  if (admin.apps && admin.apps.length) return admin;
  const rawB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 || '';
  if(!rawB64) return null;
  const b64 = String(rawB64).replace(/\s+/g,'');
  const jsonString = Buffer.from(b64, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(jsonString);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}

function fmtUZS(n){
  const x = Number(n||0);
  if(!Number.isFinite(x)) return '0';
  try{ return x.toLocaleString('ru-RU'); }catch{ return String(Math.round(x)); }
}

function cleanStr(s, max=200){
  return String(s ?? '').trim().replace(/\s+/g,' ').slice(0,max);
}

async function tgSendDocument({botToken, chatId, buffer, fileName, mimeType, caption}){
  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  form.append('chat_id', chatId);
  form.append('document', blob, fileName || 'receipt');
  if(caption) form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  form.append('disable_content_type_detection', 'false');
=======
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
>>>>>>> 19aee9b0573feb32b3e808e15f94e52ec2dac3a5

  const res = await fetch(url, { method:'POST', body: form });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data || data.ok !== true){
<<<<<<< HEAD
    const err = data && data.description ? data.description : `telegram_http_${res.status}`;
    throw new Error(err);
  }
  return true;
=======
    const msg = data?.description || 'telegram_send_failed';
    throw new Error(msg);
  }
  return data.result;
>>>>>>> 19aee9b0573feb32b3e808e15f94e52ec2dac3a5
}

exports.handler = async (event) => {
  try{
<<<<<<< HEAD
    if ((event.httpMethod || '').toUpperCase() !== 'POST') return json(405, { ok:false, error:'Method Not Allowed' });

    const botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim();
    if(botToken.length < 10 || adminChatId.length < 3) return json(500, { ok:false, error:'telegram_env_missing' });

    // auth (firebase token OR secret)
    const bearer = getBearer(event);
    const firebaseAdmin = initFirebaseIfPossible();

    let actor = { uid: null, email: null };
    if(bearer && firebaseAdmin){
      try{
        const decoded = await firebaseAdmin.auth().verifyIdToken(bearer);
        actor.uid = decoded?.uid ? String(decoded.uid) : null;
        actor.email = decoded?.email ? String(decoded.email) : null;
      }catch(_e){
        return json(401, { ok:false, error:'invalid_token' });
      }
    } else {
      const secret = (process.env.RECEIPT_UPLOAD_SECRET || '').trim();
      if(secret){
        const h = event.headers || {};
        const got = String(h['x-upload-secret'] || h['X-Upload-Secret'] || '').trim();
        if(got !== secret) return json(401, { ok:false, error:'unauthorized' });
      } else {
        // No firebase verify and no secret => reject to avoid public abuse
        return json(401, { ok:false, error:'auth_required', hint:'Set FIREBASE_SERVICE_ACCOUNT_B64 + send Bearer token, or set RECEIPT_UPLOAD_SECRET.' });
      }
    }

    const body = parseBody(event) || {};
    const fileB64 = String(body.fileB64 || '').trim();
    const fileName = cleanStr(body.fileName || 'receipt.jpg', 120);
    const mimeType = cleanStr(body.mimeType || 'image/jpeg', 80);
    const orderType = cleanStr(body.orderType || 'topup', 30);
    const amountUZS = Number(body.amountUZS || 0) || 0;
    const card = cleanStr(body.card || '', 60);
    const fullName = cleanStr(body.fullName || '', 80);
    const note = cleanStr(body.note || '', 400);

    if(!fileB64 || fileB64.length < 20) return json(400, { ok:false, error:'missing_file' });
    if(amountUZS <= 0) return json(400, { ok:false, error:'bad_amount' });

    // decode base64
    let buffer;
    try{ buffer = Buffer.from(fileB64, 'base64'); }
    catch{ return json(400, { ok:false, error:'bad_base64' }); }

    // caption (Telegram limit is small, keep concise)
    const lines = [];
    lines.push(`<b>🧾 To'lov cheki</b>`);
    lines.push(`Turi: <b>${orderType}</b>`);
    lines.push(`Summa: <b>${fmtUZS(amountUZS)} so'm</b>`);
    if(card) lines.push(`Karta: <code>${card}</code>`);
    if(fullName) lines.push(`Ism: <b>${fullName}</b>`);
    if(actor.uid) lines.push(`UID: <code>${actor.uid}</code>`);
    if(actor.email) lines.push(`Email: <code>${actor.email}</code>`);
    if(note) lines.push(`Izoh: ${note}`);
    const caption = lines.join('\n').slice(0, 900);

    await tgSendDocument({
      botToken,
      chatId: adminChatId,
      buffer,
      fileName,
      mimeType,
      caption,
    });

    return json(200, { ok:true });
  }catch(e){
=======
    if(event.httpMethod !== 'POST'){
      return json(405, { ok:false, error:'method_not_allowed' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
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
>>>>>>> 19aee9b0573feb32b3e808e15f94e52ec2dac3a5
    return json(500, { ok:false, error: String(e?.message || e) });
  }
};

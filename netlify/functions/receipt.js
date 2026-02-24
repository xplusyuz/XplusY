/**
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
 *
 * ENV:
 *  - TELEGRAM_BOT_TOKEN
 *  - TELEGRAM_ADMIN_CHAT_ID
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

  const res = await fetch(url, { method:'POST', body: form });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data || data.ok !== true){
    const err = data && data.description ? data.description : `telegram_http_${res.status}`;
    throw new Error(err);
  }
  return true;
}

exports.handler = async (event) => {
  try{
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
    return json(500, { ok:false, error: String(e?.message || e) });
  }
};

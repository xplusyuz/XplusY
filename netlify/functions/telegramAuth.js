import crypto from "crypto";
import admin from "firebase-admin";

function json(statusCode, obj){
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function safeStr(v){
  return (v ?? "").toString();
}

function verifyTelegramAuth(tgUser, botToken){
  const { hash, ...rest } = tgUser || {};
  if(!hash) return false;

  const keys = Object.keys(rest).sort();
  const dataCheckString = keys.map(k => `${k}=${rest[k]}`).join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return hmac === hash;
}

function loadServiceAccount(){
  // Netlify env: FIREBASE_SERVICE_ACCOUNT_BASE64
  // v2: accepts either base64 OR raw JSON string.
  const raw = safeStr(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64).trim();
  if(!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env");

  // Remove whitespace/newlines to be robust for base64 pasted with breaks
  const compact = raw.replace(/\s+/g, "");

  let obj = null;

  // If it looks like JSON, parse directly
  if(compact.startsWith("{") && compact.endsWith("}")){
    obj = JSON.parse(raw); // keep original raw (might include spaces/newlines)
  } else {
    // base64 decode
    const decoded = Buffer.from(compact, "base64").toString("utf-8").trim();
    if(!decoded.startsWith("{")) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON");
    }
    obj = JSON.parse(decoded);
  }

  if(!obj || typeof obj !== "object"){
    throw new Error("Service account JSON parse failed");
  }

  // Validate required fields
  const pid = obj.project_id || obj.projectId;
  const email = obj.client_email || obj.clientEmail;
  const key = obj.private_key || obj.privateKey;

  if(!pid || !email || !key){
    throw new Error("Service account missing project_id/client_email/private_key");
  }

  // Normalize for firebase-admin
  return {
    projectId: pid,
    clientEmail: email,
    privateKey: safeStr(key).replace(/\\n/g, "\n"),
  };
}

function initAdmin(){
  if(admin.apps.length) return;

  const sa = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

export async function handler(event){
  try{
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const botToken = safeStr(process.env.TG_BOT_TOKEN).trim();
    if(!botToken) return json(500, { error: "Missing TG_BOT_TOKEN env" });

    const body = JSON.parse(event.body || "{}");
    const tgUser = body.tgUser;

    if(!tgUser?.id) return json(400, { error: "tgUser missing" });

    const ok = verifyTelegramAuth(tgUser, botToken);
    if(!ok) return json(401, { error: "Telegram auth verify failed" });

    // auth_date freshness (<= 24h)
    const authDate = Number(tgUser.auth_date || 0) * 1000;
    if(!authDate || (Date.now() - authDate) > 24 * 60 * 60 * 1000){
      return json(401, { error: "Auth expired" });
    }

    initAdmin();

    const uid = `tg_${tgUser.id}`;
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim();
    const photoURL = tgUser.photo_url || undefined;

    try{
      await admin.auth().getUser(uid);
      await admin.auth().updateUser(uid, {
        displayName: displayName || undefined,
        photoURL,
      });
    } catch(e){
      await admin.auth().createUser(uid, {
        uid,
        displayName: displayName || "Telegram User",
        photoURL,
      });
    }

    const customToken = await admin.auth().createCustomToken(uid, {
      provider: "telegram",
      tg: { id: tgUser.id, username: tgUser.username || null }
    });

    return json(200, { customToken });

  } catch(err){
    return json(500, {
      error: "Function error",
      details: err?.message || String(err)
    });
  }
}

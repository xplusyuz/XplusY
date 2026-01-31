import crypto from "crypto";
import admin from "firebase-admin";

function json(statusCode, obj){
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function safeStr(v){ return (v ?? "").toString(); }

function verifyTelegramAuth(tgUser, botToken){
  const { hash, ...rest } = tgUser || {};
  if(!hash) return false;

  const keys = Object.keys(rest).sort();
  const dataCheckString = keys.map(k => `${k}=${rest[k]}`).join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return hmac === hash;
}

function tryParseJSONMaybeQuoted(s){
  const t = safeStr(s).trim();
  if(!t) return null;
  if(t.startsWith("{") && t.endsWith("}")){
    return JSON.parse(t);
  }
  if((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))){
    const unq = t.slice(1,-1);
    const restored = unq.replace(/\\n/g, "\n").replace(/\"/g, '"');
    if(restored.trim().startsWith("{")) return JSON.parse(restored);
  }
  return null;
}

function loadServiceAccount(){
  const rawB64 = safeStr(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64).trim();
  const rawJson = safeStr(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT).trim();

  let obj = null;
  let mode = "";

  if(rawJson){
    obj = tryParseJSONMaybeQuoted(rawJson);
    if(obj) mode = "raw_json";
  }

  if(!obj){
    if(!rawB64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env (yoki FIREBASE_SERVICE_ACCOUNT_JSON)");
    const compact = rawB64.replace(/\s+/g, "");
    const decoded = Buffer.from(compact, "base64").toString("utf-8").trim();
    obj = tryParseJSONMaybeQuoted(decoded);
    if(!obj) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 decode/parse failed (base64 JSON emas yoki buzilgan)");
    mode = "base64";
  }

  const pid = obj.project_id || obj.projectId;
  const email = obj.client_email || obj.clientEmail;
  const key = obj.private_key || obj.privateKey;

  const missing = [];
  if(!pid) missing.push("project_id");
  if(!email) missing.push("client_email");
  if(!key) missing.push("private_key");
  if(missing.length){
    throw new Error(`Service account missing: ${missing.join(", ")} (mode=${mode})`);
  }

  return {
    projectId: pid,
    clientEmail: email,
    privateKey: safeStr(key).replace(/\\n/g, "\n"),
  };
}

function initAdmin(){
  if(admin.apps.length) return;
  const cred = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

export async function handler(event){
  let stage = "start";
  try{
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const botToken = safeStr(process.env.TG_BOT_TOKEN).trim();
    if(!botToken) return json(500, { error: "Missing TG_BOT_TOKEN env", details: "Netlify ENV'da TG_BOT_TOKEN yo'q" });

    const body = JSON.parse(event.body || "{}");
    const tgUser = body.tgUser;

    if(!tgUser?.id) return json(400, { error: "tgUser missing" });

    const ok = verifyTelegramAuth(tgUser, botToken);
    if(!ok) return json(401, { error: "Telegram auth verify failed" });

    const authDate = Number(tgUser.auth_date || 0) * 1000;
    if(!authDate || (Date.now() - authDate) > 24 * 60 * 60 * 1000){
      return json(401, { error: "Auth expired" });
    }

    initAdmin();

const uid = `tg_${tgUser.id}`;
const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim();
const photoURL = tgUser.photo_url || "";

// Safer: only pass defined properties to updateUser/createUser
const update = {};
if (displayName) update.displayName = displayName;
if (photoURL) update.photoURL = photoURL;

let stage = "getUser";
try{
  stage = "getUser";
  await admin.auth().getUser(uid);

  if(Object.keys(update).length){
    stage = "updateUser";
    await admin.auth().updateUser(uid, update);
  }
} catch(e){
  // If user doesn't exist -> create
  stage = "createUser";
  const create = { uid, displayName: displayName || "Telegram User" };
  if (photoURL) create.photoURL = photoURL;
  await admin.auth().createUser(create);
}

stage = "createCustomToken";
const customToken = await admin.auth().createCustomToken(uid, {
  provider: "telegram",
  tg: { id: tgUser.id, username: tgUser.username || null }
});

return json(200, { customToken });

  } catch(err){
    return json(500, {
      error: "Function error",
      stage,
      details: err?.message || String(err),
      envHints: {
        hasTG_BOT_TOKEN: !!safeStr(process.env.TG_BOT_TOKEN).trim(),
        hasFIREBASE_SERVICE_ACCOUNT_BASE64: !!safeStr(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64).trim(),
        hasFIREBASE_SERVICE_ACCOUNT_JSON: !!safeStr(process.env.FIREBASE_SERVICE_ACCOUNT_JSON).trim() || !!safeStr(process.env.FIREBASE_SERVICE_ACCOUNT).trim(),
      }
    });
  }
}

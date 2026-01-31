import crypto from "crypto";
import admin from "firebase-admin";

function json(statusCode, obj){
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
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

function initAdmin(){
  if(admin.apps.length) return;

  // Netlify ENV (sizning namingiz):
  // - FIREBASE_SERVICE_ACCOUNT_BASE64
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if(!b64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env");

  const saJson = Buffer.from(b64, "base64").toString("utf-8");
  const cred = JSON.parse(saJson);

  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

export async function handler(event){
  try{
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const botToken = process.env.TG_BOT_TOKEN;
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
    const additionalClaims = {
      provider: "telegram",
      tg: { id: tgUser.id, username: tgUser.username || null }
    };

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

    const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
    return json(200, { customToken });

  } catch(err){
    return json(500, { error: err?.message || "Server error" });
  }
}

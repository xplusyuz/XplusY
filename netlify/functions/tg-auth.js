const crypto = require("crypto");
const admin = require("firebase-admin");

function getServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!b64) throw new Error("No FIREBASE_SERVICE_ACCOUNT_BASE64");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

function timingSafeEq(a, b) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function telegramVerify(tg, botToken) {
  const { hash, ...rest } = tg || {};
  if (!hash) return false;

  const checkString = Object.keys(rest)
    .filter((k) => rest[k] !== undefined && rest[k] !== null && `${rest[k]}` !== "")
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  return timingSafeEq(hmac, hash);
}

let inited = false;
function initAdmin() {
  if (inited) return;
  admin.initializeApp({ credential: admin.credential.cert(getServiceAccount()) });
  inited = true;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    const BOT_TOKEN = process.env.TG_BOT_TOKEN;
    if (!BOT_TOKEN) throw new Error("No TG_BOT_TOKEN");

    const body = JSON.parse(event.body || "{}");
    const tg = body.tg || body;

    // 1) Telegram signature check
    if (!telegramVerify(tg, BOT_TOKEN)) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: "Telegram hash invalid" }) };
    }

    // 2) auth_date expiry (24h)
    const authDate = Number(tg.auth_date || 0);
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || now - authDate > 24 * 3600) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: "Auth expired" }) };
    }

    initAdmin();

    // 3) Firebase Auth user
    const uid = `tg:${tg.id}`;

    // (ixtiyoriy) Auth profilini ham update qilamiz
    const displayName = [tg.first_name, tg.last_name].filter(Boolean).join(" ").trim();
    const photoURL = tg.photo_url || "";

    // Ensure auth user exists & update profile
    try {
      await admin.auth().getUser(uid);
      await admin.auth().updateUser(uid, {
        displayName: displayName || undefined,
        photoURL: photoURL || undefined,
      });
    } catch (e) {
      // not found -> create
      await admin.auth().createUser({
        uid,
        displayName: displayName || undefined,
        photoURL: photoURL || undefined,
      });
    }

    // 4) Firestore users/{uid}
    const userRef = admin.firestore().doc(`users/${uid}`);
    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      const base = {
        uid,
        provider: "telegram",
        tg: {
          id: tg.id,
          username: tg.username || "",
          first_name: tg.first_name || "",
          last_name: tg.last_name || "",
          photo_url: tg.photo_url || "",
          auth_date: authDate,
        },
        profile: {
          name: displayName || tg.username || `User ${tg.id}`,
          avatar: photoURL || "",
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!snap.exists) {
        tx.set(userRef, {
          ...base,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          role: "user",
          status: "active",
        });
      } else {
        // createdAt ni saqlab qolamiz
        tx.set(userRef, base, { merge: true });
      }
    });

    // 5) customToken beramiz
    const customToken = await admin.auth().createCustomToken(uid, {
      provider: "telegram",
      tg_id: String(tg.id),
      username: tg.username || "",
    });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, uid, customToken }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: e.message || "Server error" }),
    };
  }
};

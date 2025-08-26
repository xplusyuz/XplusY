const crypto = require("crypto");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

function checkTelegramAuth(data, botToken) {
  const authData = { ...data };
  const hash = authData.hash;
  delete authData.hash;

  const checkString = Object.keys(authData)
    .sort()
    .map((k) => `${k}=${authData[k]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  return hmac === hash;
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    if (!checkTelegramAuth(body, process.env.BOT_TOKEN)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Invalid Telegram login" }) };
    }

    const uid = `telegram:${body.id}`;
    const token = await admin.auth().createCustomToken(uid, {
      username: body.username,
      first_name: body.first_name,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ token }),
    };
  } catch (err) {
    console.error("Auth error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};

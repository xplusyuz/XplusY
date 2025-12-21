const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FB_PROJECT_ID,
      clientEmail: process.env.FB_CLIENT_EMAIL,
      privateKey: process.env.FB_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

exports.handler = async (event) => {
  const path = event.path.replace("/.netlify/functions/api", "");
  const method = event.httpMethod;

  // 🟢 Auto register (ID + parol)
  if (path === "/auth/register" && method === "POST") {
    const id = Math.floor(100000 + Math.random() * 900000).toString();
    const password = Math.random().toString(36).slice(-8);

    await db.collection("users").doc(id).set({
      id,
      password,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id, password }),
    };
  }

  // 🔵 Login
  if (path === "/auth/login" && method === "POST") {
    const { id, password } = JSON.parse(event.body);

    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists || doc.data().password !== password) {
      return { statusCode: 401, body: "Login xato" };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  }

  return { statusCode: 404, body: "Not found" };
};

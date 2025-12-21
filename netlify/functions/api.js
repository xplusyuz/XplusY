import admin from "firebase-admin";

// ================= INIT =================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_KEY)
    )
  });
}

const db = admin.firestore();

// ================= HANDLER =================
export async function handler(event) {
  const path = event.path.replace("/.netlify/functions/api", "");
  const method = event.httpMethod;

  try {

    // ========= AUTO REGISTER (1 BOSISH) =========
    if (path === "/auth/register" && method === "POST") {
      const loginId = genId();
      const password = genPassword();

      const user = {
        loginId,
        password,
        role: "user",
        createdAt: Date.now()
      };

      const ref = await db.collection("users").add(user);

      await db.collection("sessions").doc(ref.id).set({
        userId: ref.id,
        createdAt: Date.now()
      });

      return ok({
        sessionId: ref.id,
        loginId,
        password
      });
    }

    // ========= LOGIN =========
    if (path === "/auth/login" && method === "POST") {
      const { id, password } = JSON.parse(event.body || "{}");

      const snap = await db.collection("users")
        .where("loginId", "==", id)
        .limit(1)
        .get();

      if (snap.empty) return err("ID topilmadi");

      const doc = snap.docs[0];
      if (doc.data().password !== password) {
        return err("Parol noto‘g‘ri");
      }

      await db.collection("sessions").doc(doc.id).set({
        userId: doc.id,
        createdAt: Date.now()
      });

      return ok({ sessionId: doc.id });
    }

    // ========= SESSION =========
    if (path.startsWith("/auth/session/") && method === "GET") {
      const sid = path.split("/").pop();

      const s = await db.collection("sessions").doc(sid).get();
      if (!s.exists) return err("Session yo‘q");

      const u = await db.collection("users").doc(s.data().userId).get();
      if (!u.exists) return err("User yo‘q");

      return ok({ user: u.data() });
    }

    // ========= PASSWORD UPDATE =========
    if (path === "/user/password" && method === "POST") {
      const { sessionId, oldPassword, newPassword } =
        JSON.parse(event.body || "{}");

      const s = await db.collection("sessions").doc(sessionId).get();
      if (!s.exists) return err("Session yo‘q");

      const uRef = db.collection("users").doc(s.data().userId);
      const u = await uRef.get();

      if (u.data().password !== oldPassword) {
        return err("Eski parol noto‘g‘ri");
      }

      await uRef.update({ password: newPassword });
      return ok("Parol yangilandi");
    }

    // ========= CONTENT (BANNER + CARD) =========
    if (path.startsWith("/content") && method === "GET") {
      const page = new URLSearchParams(event.queryStringParameters).get("page");

      const snap = await db.collection("content")
        .where("page", "==", page)
        .orderBy("order")
        .get();

      return ok(
        snap.docs.map(d => d.data())
      );
    }

    return err("Endpoint topilmadi");

  } catch (e) {
    console.error(e);
    return err("Server xatosi");
  }
}

// ================= HELPERS =================
function genId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function genPassword(len = 8) {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

function ok(data) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

function err(msg) {
  return {
    statusCode: 400,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: msg })
  };
}

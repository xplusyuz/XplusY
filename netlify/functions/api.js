import admin from "firebase-admin";

// 🔐 Firebase init
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_KEY)
    )
  });
}

const db = admin.firestore();

export async function handler(event) {
  const path = event.path.replace("/.netlify/functions/api", "");
  const method = event.httpMethod;

  try {
    const usersCol = db.collection("foydalanuvchilar");

    // ================= LOGIN =================
    if (path === "/auth/login" && method === "POST") {
      const { id, password } = JSON.parse(event.body);

      const snap = await usersCol
        .where("loginId", "==", id)
        .limit(1)
        .get();

      if (snap.empty) {
        return json(404, { error: "Bunday ID topilmadi" });
      }

      const doc = snap.docs[0];
      const user = doc.data();

      if (user.password !== password) {
        return json(401, { error: "Parol noto‘g‘ri" });
      }

      const sessionId = doc.id;

      return json(200, {
        sessionId,
        user: {
          id: doc.id,
          docId: doc.id,
          data: user
        }
      });
    }

    // ================= REGISTER =================
    if (path === "/auth/register" && method === "POST") {
      const loginId = Math.floor(100000 + Math.random() * 900000).toString();
      const password = generatePassword(8);

      const newUser = {
        loginId,
        password,
        fullName: "",
        birthDate: "",
        region: "",
        district: "",
        points: 0,
        rank: "Yangi foydalanuvchi",
        bestScore: 0,
        role: "user",
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const docRef = await usersCol.add(newUser);

      return json(200, {
        sessionId: docRef.id,
        loginId,
        password,
        user: {
          id: docRef.id,
          docId: docRef.id,
          data: newUser
        }
      });
    }

    // ================= SESSION =================
    if (path.startsWith("/auth/session/") && method === "GET") {
      const sessionId = path.split("/").pop();

      const doc = await usersCol.doc(sessionId).get();

      if (!doc.exists) {
        return json(404, { error: "Session not found" });
      }

      return json(200, {
        user: {
          id: doc.id,
          docId: doc.id,
          data: doc.data()
        }
      });
    }

    return json(404, { error: "Endpoint not found" });

  } catch (e) {
    console.error("API xatosi:", e);
    return json(500, { error: "Server xatosi" });
  }
}

// ================= HELPERS =================
function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

function generatePassword(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

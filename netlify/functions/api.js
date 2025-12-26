// netlify/functions/api.js
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  // Netlify’da faqat ENV orqali service account JSON ishlatiladi
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON topilmadi. Netlify Environment variables ga service account JSON ni qo‘ying."
    );
  }
  const svc = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(data),
  };
}

function getBearer(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function verifyToken(event) {
  const token = getBearer(event);
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  initFirebaseAdmin();
  const db = admin.firestore();

  const rawPath = event.path || "";
  const path = rawPath.replace("/.netlify/functions/api", "");
  const method = event.httpMethod;

  try {
    // ========================= REGISTER =========================
    // POST /auth/register
    if (path === "/auth/register" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { password, password2, firstName, lastName, birthDate } = body;

      if (!password || !password2 || !firstName || !lastName || !birthDate) {
        return json(400, { error: "Barcha maydonlarni to‘ldiring." });
      }
      if (password !== password2) {
        return json(400, { error: "Parollar mos emas." });
      }
      if (String(password).length < 6) {
        return json(400, { error: "Parol kamida 6 ta belgidan iborat bo‘lsin." });
      }

      const countersRef = db.collection("meta").doc("counters");

      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(countersRef);
        let nextUserId = 1000;

        if (snap.exists && typeof snap.data().nextUserId === "number") {
          nextUserId = snap.data().nextUserId;
        } else {
          // birinchi marta yaratilsa
          tx.set(countersRef, { nextUserId: 1000 }, { merge: true });
        }

        // ID ni bandligini tekshiramiz
        const userDocRef = db.collection("users").doc(String(nextUserId));
        const userSnap = await tx.get(userDocRef);
        if (userSnap.exists) {
          throw new Error("ID kolliziya. Qayta urinib ko‘ring.");
        }

        const passwordHash = await bcrypt.hash(password, 10);

        tx.set(userDocRef, {
          id: nextUserId,
          passwordHash,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          birthDate: String(birthDate),
          points: 0,
          balance: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: null,
        });

        tx.set(countersRef, { nextUserId: nextUserId + 1 }, { merge: true });

        return { id: nextUserId };
      });

      return json(200, { ok: true, id: result.id });
    }

    // ========================= LOGIN =========================
    // POST /auth/login
    if (path === "/auth/login" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { id, password } = body;

      if (!id || !password) return json(400, { error: "ID va parol kerak." });

      const userRef = db.collection("users").doc(String(id));
      const snap = await userRef.get();
      if (!snap.exists) return json(404, { error: "Bunday ID topilmadi." });

      const u = snap.data();
      const ok = await bcrypt.compare(password, u.passwordHash || "");
      if (!ok) return json(401, { error: "Parol noto‘g‘ri." });

      await userRef.set(
        { lastLoginAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );

      const token = jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: "14d" });

      return json(200, {
        ok: true,
        token,
        user: {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          birthDate: u.birthDate,
          points: u.points ?? 0,
          balance: u.balance ?? 0,
        },
      });
    }

    // ========================= ME =========================
    // GET /auth/me
    if (path === "/auth/me" && method === "GET") {
      const payload = verifyToken(event);
      if (!payload) return json(401, { error: "Token yo‘q yoki yaroqsiz." });

      const userRef = db.collection("users").doc(String(payload.id));
      const snap = await userRef.get();
      if (!snap.exists) return json(404, { error: "User topilmadi." });

      const u = snap.data();
      return json(200, {
        ok: true,
        user: {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          birthDate: u.birthDate,
          points: u.points ?? 0,
          balance: u.balance ?? 0,
        },
      });
    }

    return json(404, { error: "Not found" });
  } catch (e) {
    return json(500, { error: e.message || "Server error" });
  }
};

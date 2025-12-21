const admin = require("firebase-admin");
const crypto = require("crypto");

function initAdmin() {
  if (admin.apps.length) return;
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
function db() { initAdmin(); return admin.firestore(); }

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}
const ok = (b) => json(200, b);
const bad = (msg, code = 400) => json(code, { error: msg });

function pathOf(event) {
  return (event.path || "").replace(/^\/\.netlify\/functions\/api/, "") || "/";
}

function getSid(event) {
  const h = event.headers || {};
  const sid = (h["x-session-id"] || h["X-Session-Id"] || "").trim();
  const auth = (h["authorization"] || h["Authorization"] || "").trim();
  if (sid) return sid;
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

// 6 xonali random ID
function randomLoginId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function randomPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#%";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function pickUser(u) {
  return {
    id: u.id,
    loginId: u.id,                 // doc id
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    region: u.region || "",
    district: u.district || "",
    birthdate: u.birthdate || "",  // "YYYY-MM-DD"
    points: u.points || 0,
    updatedAt: u.updatedAt || null
  };
}

async function findUserBySession(fire, sid) {
  const now = Date.now();
  const qs = await fire.collection("users")
    .where("sessionId", "==", sid)
    .limit(1)
    .get();
  if (qs.empty) return null;

  const doc = qs.docs[0];
  const u = doc.data();
  const exp = u.sessionExp ? u.sessionExp.toMillis?.() ?? u.sessionExp : 0;
  if (exp && exp < now) return null;

  return { id: doc.id, ...u };
}

exports.handler = async (event) => {
  const method = event.httpMethod || "GET";
  if (method === "OPTIONS") return ok({ ok: true });

  try {
    const fire = db();
    const p = pathOf(event);

    // health
    if (p === "/" && method === "GET") {
      return ok({ ok: true, name: "LeaderMath API (users-only)", time: new Date().toISOString() });
    }

    // ✅ REGISTER (auto ID + parol)
    if (p === "/auth/register" && method === "POST") {
      // ID collision bo‘lsa qayta urinamiz
      let loginId = "";
      for (let i = 0; i < 20; i++) {
        const cand = randomLoginId();
        const snap = await fire.collection("users").doc(cand).get();
        if (!snap.exists) { loginId = cand; break; }
      }
      if (!loginId) return bad("ID yaratib bo‘lmadi. Qayta urinib ko‘ring.", 500);

      const password = randomPassword(10);
      const sid = crypto.randomUUID();
      const days = parseInt(process.env.SESSION_DAYS || "30", 10);
      const exp = admin.firestore.Timestamp.fromMillis(Date.now() + days * 86400000);

      const doc = {
        id: loginId,          // doc id bilan bir xil
        password,             // ⚠️ oddiy (xohlasangiz keyin hash qilamiz)
        firstName: "",
        lastName: "",
        region: "",
        district: "",
        birthdate: "",
        points: 0,
        sessionId: sid,
        sessionExp: exp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await fire.collection("users").doc(loginId).set(doc);

      return ok({
        loginId,
        password,
        sessionId: sid,
        user: pickUser(doc)
      });
    }

    // ✅ LOGIN
    if (p === "/auth/login" && method === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      const id = String(body.id || "").trim();
      const password = String(body.password || "").trim();

      if (id.length !== 6) return bad("ID 6 xonali bo‘lsin", 400);

      const snap = await fire.collection("users").doc(id).get();
      if (!snap.exists) return bad("Bunday ID topilmadi", 404);

      const u = snap.data();
      if ((u.password || "") !== password) return bad("Parol noto‘g‘ri", 401);

      const sid = crypto.randomUUID();
      const days = parseInt(process.env.SESSION_DAYS || "30", 10);
      const exp = admin.firestore.Timestamp.fromMillis(Date.now() + days * 86400000);

      await fire.collection("users").doc(id).set({
        sessionId: sid,
        sessionExp: exp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const u2 = (await fire.collection("users").doc(id).get()).data();
      return ok({ sessionId: sid, user: pickUser({ id, ...u2 }) });
    }

    // ✅ ME (session bilan)
    if (p === "/auth/me" && method === "GET") {
      const sid = getSid(event);
      if (!sid) return bad("Session kerak. Qayta kiring.", 401);

      const u = await findUserBySession(fire, sid);
      if (!u) return bad("Session topilmadi yoki tugagan. Qayta kiring.", 401);

      return ok({ user: pickUser(u) });
    }

    // ✅ LOGOUT
    if (p === "/auth/logout" && method === "POST") {
      const sid = getSid(event);
      if (!sid) return ok({ ok: true });

      const u = await findUserBySession(fire, sid);
      if (u) {
        await fire.collection("users").doc(u.id).set({
          sessionId: admin.firestore.FieldValue.delete(),
          sessionExp: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      return ok({ ok: true });
    }

    // ✅ CHANGE PASSWORD
    if (p === "/auth/password" && method === "POST") {
      const sid = getSid(event);
      if (!sid) return bad("Session kerak", 401);

      const u = await findUserBySession(fire, sid);
      if (!u) return bad("Session topilmadi", 401);

      const body = event.body ? JSON.parse(event.body) : {};
      const currentPassword = String(body.currentPassword || "").trim();
      const newPassword = String(body.newPassword || "").trim();
      if (newPassword.length < 6) return bad("Yangi parol kamida 6 belgi", 400);
      if ((u.password || "") !== currentPassword) return bad("Joriy parol noto‘g‘ri", 401);

      await fire.collection("users").doc(u.id).set({
        password: newPassword,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return ok({ ok: true });
    }

    // ✅ USER PATCH
    if (p === "/user/me" && method === "PATCH") {
      const sid = getSid(event);
      if (!sid) return bad("Session kerak", 401);

      const u = await findUserBySession(fire, sid);
      if (!u) return bad("Session topilmadi", 401);

      const body = event.body ? JSON.parse(event.body) : {};
      const patch = {
        firstName: String(body.firstName || u.firstName || "").trim(),
        lastName: String(body.lastName || u.lastName || "").trim(),
        region: String(body.region || u.region || "").trim(),
        district: String(body.district || u.district || "").trim(),
        birthdate: String(body.birthdate || u.birthdate || "").trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await fire.collection("users").doc(u.id).set(patch, { merge: true });
      const u2 = (await fire.collection("users").doc(u.id).get()).data();
      return ok({ user: pickUser({ id: u.id, ...u2 }) });
    }

    return bad("Endpoint topilmadi", 404);
  } catch (e) {
    console.error(e);
    return json(500, { error: "Server xatosi", detail: String(e.message || e) });
  }
};

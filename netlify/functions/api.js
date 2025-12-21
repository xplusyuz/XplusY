const admin = require("firebase-admin");
const crypto = require("crypto");

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  };
}
const json = (statusCode, body) => ({ statusCode, headers: corsHeaders(), body: JSON.stringify(body) });

const b64u = (buf) =>
  Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function jwtSign(payload, secret, expSec = 60 * 60 * 24 * 30) {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + expSec }));
  const sig = b64u(crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
function jwtVerify(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const sig = b64u(crypto.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest());
  if (sig !== parts[2]) return null;
  const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

function getSessionIdFromReq(event) {
  const a = event.headers.authorization || event.headers.Authorization || "";
  if (a.startsWith("Bearer ")) return a.slice(7);
  // compatibility: allow ?sessionId=
  try {
    const u = new URL("https://x.local" + (event.rawUrl ? new URL(event.rawUrl).pathname + (new URL(event.rawUrl).search||"") : (event.path||"")));
    const sid = u.searchParams.get("sessionId");
    if (sid) return sid;
  } catch {}
  return null;
}

function initAdmin() {
  if (admin.apps.length) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) throw new Error("FIREBASE_SERVICE_ACCOUNT env yo‘q");
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svc)) });
}
function secret() {
  return process.env.APP_JWT_SECRET || "dev_secret_change_me";
}

function makeId(len = 6) {
  const A = "0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += A[Math.floor(Math.random() * A.length)];
  return out;
}
function pwWarn(pw) {
  const w = [];
  if (pw.length <= 3) w.push("Maxfiy so‘z juda qisqa (4+ tavsiya).");
  if (/^\d+$/.test(pw)) w.push("Faqat raqam — juda oson.");
  if (/^[a-zA-Z]+$/.test(pw)) w.push("Faqat harf — kuchsiz.");
  if (!/[A-Z]/.test(pw) && !/[a-z]/.test(pw)) w.push("Harf bo‘lsa yaxshiroq.");
  return w;
}

async function getUserBySession(db, sessionId) {
  const p = jwtVerify(sessionId, secret());
  if (!p?.uid) return null;
  const snap = await db.collection("users").doc(p.uid).get();
  if (!snap.exists) return null;
  return snap.data();
}

function publicUser(u) {
  return {
    loginId: u.id,
    id: u.id,
    points: u.points || 0,
    avatarUrl: u.avatarUrl || "",
    profile: u.profile || {},
    profileCompleted: !!u.profileCompleted,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    initAdmin();
    const db = admin.firestore();

    const path = (event.path || "").replace("/.netlify/functions/api", "");
    const method = event.httpMethod;

    // --- AUTH REGISTER (AUTO) ---
    if (path === "/auth/register" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      // if UI doesn't send password, generate 8 chars
      let password = (body.password ?? "").toString();
      if (!password) password = makeId(8); // 8 chars mixed
      if (password.length < 1 || password.length > 20) return json(400, { error: "Parol 1..20 bo‘lsin" });

      // unique id
      let id = "";
      for (let i = 0; i < 20; i++) {
        id = makeId(6);
        const exists = await db.collection("users").doc(id).get();
        if (!exists.exists) break;
        if (i === 19) return json(500, { error: "ID yaratib bo‘lmadi" });
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const passHash = sha256Hex(salt + password);

      const userDoc = {
        id,
        salt,
        passHash,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        points: 0,
        avatarUrl: "",
        profile: {},
        profileCompleted: false,
      };
      await db.collection("users").doc(id).set(userDoc);

      const sessionId = jwtSign({ uid: id }, secret());
      return json(200, {
        sessionId,
        loginId: id,
        password,
        user: publicUser(userDoc),
        warnings: pwWarn(password),
      });
    }

    // --- AUTH LOGIN ---
    if (path === "/auth/login" && method === "POST") {
      const { id, password } = JSON.parse(event.body || "{}");
      const uid = String(id || "").trim().toUpperCase();
      const pw = String(password || "");

      if (!uid || !pw) return json(400, { error: "ID va parol kerak" });

      const snap = await db.collection("users").doc(uid).get();
      if (!snap.exists) return json(404, { error: "Not found" });

      const u = snap.data();
      const ok = sha256Hex((u.salt || "") + pw) === u.passHash;
      if (!ok) return json(401, { error: "Parol noto‘g‘ri" });

      const sessionId = jwtSign({ uid }, secret());
      return json(200, { sessionId, user: publicUser(u) });
    }

    // --- AUTH SESSION CHECK ---
    if (path.startsWith("/auth/session/") && method === "GET") {
      const sessionId = decodeURIComponent(path.split("/").pop() || "");
      const u = await getUserBySession(db, sessionId);
      if (!u) return json(401, { valid: false, error: "Token yo‘q" });
      return json(200, { valid: true, user: publicUser(u) });
    }

    // --- USER GET/UPDATE ---
    if (path.startsWith("/user/")) {
      const parts = path.split("/").filter(Boolean); // ["user", "{sessionId}", ...]
      const sessionId = decodeURIComponent(parts[1] || "");
      const u = await getUserBySession(db, sessionId);
      if (!u) return json(401, { error: "Token yo‘q" });

      const uid = u.id;

      if (parts.length === 2 && method === "GET") {
        return json(200, { user: publicUser(u) });
      }

      if (parts.length === 2 && method === "PATCH") {
        const b = JSON.parse(event.body || "{}");
        const profile = {
          firstName: String(b.firstName || u.profile?.firstName || "").trim(),
          lastName: String(b.lastName || u.profile?.lastName || "").trim(),
          birthDate: String(b.birthDate || u.profile?.birthDate || "").trim(),
          region: String(b.region || u.profile?.region || "").trim(),
          district: String(b.district || u.profile?.district || "").trim(),
        };
        const done = !!(profile.firstName && profile.lastName && profile.birthDate && profile.region && profile.district);
        await db.collection("users").doc(uid).update({ profile, profileCompleted: done });
        const fresh = (await db.collection("users").doc(uid).get()).data();
        return json(200, { ok: true, user: publicUser(fresh) });
      }

      if (parts[2] === "avatar" && method === "POST") {
        const b = JSON.parse(event.body || "{}");
        const avatarUrl = String(b.avatarUrl || b.url || "").trim();
        await db.collection("users").doc(uid).update({ avatarUrl });
        const fresh = (await db.collection("users").doc(uid).get()).data();
        return json(200, { ok: true, user: publicUser(fresh) });
      }

      if (parts[2] === "password" && method === "POST") {
        const b = JSON.parse(event.body || "{}");
        const newPassword = String(b.newPassword || b.password || "").trim();
        if (newPassword.length < 1 || newPassword.length > 20) return json(400, { error: "Parol 1..20 bo‘lsin" });
        const salt = crypto.randomBytes(16).toString("hex");
        const passHash = sha256Hex(salt + newPassword);
        await db.collection("users").doc(uid).update({ salt, passHash });
        return json(200, { ok: true, warnings: pwWarn(newPassword) });
      }
    }

    // --- NAV (static from Firestore configs/nav, fallback demo) ---
    if (path === "/nav" && method === "GET") {
      const doc = await db.collection("configs").doc("nav").get();
      if (doc.exists) return json(200, doc.data());
      return json(200, {
        version: 1,
        nav: [
          { id: "home", label: "Bosh sahifa", icon: "🏠", sectionId: "home" },
          { id: "courses", label: "Kurslar", icon: "📚", sectionId: "courses" },
          { id: "tests", label: "Testlar", icon: "🧠", sectionId: "tests" },
        ],
        sections: {
          home: { title: "Bosh sahifa", chips: [{ id: "all", label: "Hammasi" }], items: [] },
          courses: { title: "Kurslar", chips: [{ id: "all", label: "Hammasi" }], items: [] },
          tests: { title: "Testlar", chips: [{ id: "all", label: "Hammasi" }], items: [] },
        },
      });
    }

    // --- RANKING ---
    if ((path === "/ranking" || path === "/rank") && method === "GET") {
      const top = await db.collection("users").orderBy("points", "desc").limit(50).get();
      const items = top.docs.map((d, i) => {
        const u = d.data();
        const name = `${u?.profile?.firstName || ""} ${u?.profile?.lastName || ""}`.trim() || u.id;
        return { place: i + 1, id: u.id, name, points: u.points || 0, avatarUrl: u.avatarUrl || "" };
      });
      return json(200, { items });
    }

    return json(404, { error: "Not found" });
  } catch (e) {
    return json(500, { error: e.message || "Server error" });
  }
};

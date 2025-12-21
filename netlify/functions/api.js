const admin = require("firebase-admin");
const crypto = require("crypto");

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(data),
  };
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJWT(payload, secret, expSec = 60 * 60 * 24 * 14) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + expSec };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(full));
  const sig = b64url(crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

function verifyJWT(token, secret) {
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const sig = b64url(crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest());
  if (sig !== s) return null;
  const payload = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  return payload;
}

function initAdmin() {
  if (admin.apps.length) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) throw new Error("FIREBASE_SERVICE_ACCOUNT env yo‘q");
  const cred = JSON.parse(svc);
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

function makeId(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function passwordWarnings(pw) {
  const w = [];
  if (pw.length < 4) w.push("Maxfiy so‘z juda qisqa (4+ tavsiya).");
  if (/^\d+$/.test(pw)) w.push("Faqat raqam — juda oson taxmin qilinadi.");
  if (/^[a-zA-Z]+$/.test(pw)) w.push("Faqat harf — kuchsiz bo‘lishi mumkin.");
  if (!/[A-Z]/.test(pw) && !/[0-9]/.test(pw) && pw.length < 8) w.push("Kuchliroq qilish: harf+raqam aralashtir.");
  return w;
}

async function getUser(db, id) {
  const ref = db.collection("users").doc(id);
  const snap = await ref.get();
  return { ref, snap, data: snap.exists ? snap.data() : null };
}

function authIdFromReq(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const secret = process.env.APP_JWT_SECRET || "dev_secret_change_me";
  const payload = verifyJWT(token, secret);
  return payload?.uid || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  try {
    initAdmin();
    const db = admin.firestore();

    const path = (event.path || "").replace("/.netlify/functions/api", "");
    const method = event.httpMethod;

    if (path === "/auth/login-step1" && method === "POST") {
      const { id } = JSON.parse(event.body || "{}");
      if (!id) return json(400, { error: "ID kerak" });
      const { snap } = await getUser(db, id.trim().toUpperCase());
      return json(200, { exists: snap.exists });
    }

    if (path === "/auth/new" && method === "POST") {
      const { password } = JSON.parse(event.body || "{}");
      const pw = (password ?? "").toString();
      if (pw.length < 1 || pw.length > 20) return json(400, { error: "Maxfiy so‘z 1..20 bo‘lsin" });

      let id = "";
      for (let i = 0; i < 8; i++) {
        id = makeId(6);
        const { snap } = await getUser(db, id);
        if (!snap.exists) break;
        if (i === 7) return json(500, { error: "ID yaratib bo‘lmadi, qayta urinib ko‘r" });
      }

      const warn = passwordWarnings(pw);
      await db.collection("users").doc(id).set({
        id,
        passHash: sha256(pw),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        points: 0,
        avatarUrl: "",
        profile: {},
        profileCompleted: false,
      });

      const secret = process.env.APP_JWT_SECRET || "dev_secret_change_me";
      const token = signJWT({ uid: id }, secret);

      return json(200, { id, token, warnings: warn });
    }

    if (path === "/auth/login" && method === "POST") {
      const { id, password } = JSON.parse(event.body || "{}");
      const uid = (id || "").toString().trim().toUpperCase();
      const pw = (password || "").toString();
      if (!uid || !pw) return json(400, { error: "ID va maxfiy so‘z kerak" });

      const { data } = await getUser(db, uid);
      if (!data) return json(404, { error: "Bunday ID topilmadi" });

      if (data.passHash !== sha256(pw)) return json(401, { error: "Maxfiy so‘z noto‘g‘ri" });

      const secret = process.env.APP_JWT_SECRET || "dev_secret_change_me";
      const token = signJWT({ uid }, secret);
      return json(200, { token });
    }

    if (path === "/me" && method === "GET") {
      const uid = authIdFromReq(event);
      if (!uid) return json(401, { error: "Token yo‘q" });

      const { data } = await getUser(db, uid);
      if (!data) return json(404, { error: "User topilmadi" });

      let age = null;
      const bd = data?.profile?.birthDate;
      if (bd) {
        const d = new Date(bd);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          age = now.getFullYear() - d.getFullYear();
          const m = now.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        }
      }

      return json(200, {
        id: data.id,
        points: data.points || 0,
        avatarUrl: data.avatarUrl || "",
        profile: data.profile || {},
        profileCompleted: !!data.profileCompleted,
        age,
      });
    }

    if (path === "/me/profile" && method === "POST") {
      const uid = authIdFromReq(event);
      if (!uid) return json(401, { error: "Token yo‘q" });

      const { firstName, lastName, birthDate, region, district } = JSON.parse(event.body || "{}");
      const profile = {
        firstName: (firstName || "").trim(),
        lastName: (lastName || "").trim(),
        birthDate: (birthDate || "").trim(),
        region: (region || "").trim(),
        district: (district || "").trim(),
      };

      if (!profile.firstName || !profile.lastName || !profile.birthDate || !profile.region || !profile.district) {
        return json(400, { error: "Barcha maydonlar majburiy" });
      }

      await db.collection("users").doc(uid).update({ profile, profileCompleted: true });
      return json(200, { ok: true });
    }

    if (path === "/me/avatar" && method === "POST") {
      const uid = authIdFromReq(event);
      if (!uid) return json(401, { error: "Token yo‘q" });

      const { avatarUrl } = JSON.parse(event.body || "{}");
      const url = (avatarUrl || "").toString().trim();
      await db.collection("users").doc(uid).update({ avatarUrl: url });
      return json(200, { ok: true });
    }

    if (path === "/app" && method === "GET") {
      const appSnap = await db.collection("configs").doc("app").get();
      const app = appSnap.exists ? appSnap.data() : { version: 1, nav: [] };

      const sectionIds = [...new Set((app.nav || []).map(n => n.sectionId).filter(Boolean))];
      const sections = {};
      for (const sid of sectionIds) {
        const sSnap = await db.collection("sections").doc(sid).get();
        sections[sid] = sSnap.exists ? sSnap.data() : { title: sid, chips: [{ id: "all", label: "Hammasi" }], items: [] };
      }

      return json(200, { version: app.version || 1, nav: app.nav || [], sections });
    }

    if (path === "/rank" && method === "GET") {
      const top = await db.collection("users").orderBy("points", "desc").limit(50).get();
      const items = top.docs.map((d, i) => {
        const u = d.data();
        return {
          place: i + 1,
          id: u.id,
          name: `${u?.profile?.firstName || "?"} ${u?.profile?.lastName || ""}`.trim(),
          points: u.points || 0,
          avatarUrl: u.avatarUrl || "",
        };
      });
      return json(200, { items });
    }

    return json(404, { error: "Not found" });
  } catch (e) {
    return json(500, { error: e.message || "Server error" });
  }
};

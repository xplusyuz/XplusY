// netlify/functions/api.js
// LeaderMath.uz — Netlify Function API (Firebase Admin SDK)
// Endpoints (all JSON):
//  POST /auth/register            -> {id, password, token, user}
//  POST /auth/login               -> {id, password} -> {token, user}
//  GET  /me                       -> {user}
//  PUT  /me/profile               -> {profile fields..., avatarBase64?} -> {user}
//  GET  /content/cards            -> {cards:[...]}
//  (optional admin) POST/PUT/DELETE /admin/cards (requires admin user)
//
// Notes:
// - Passwords are hashed (bcrypt).
// - Auth uses JWT (Authorization: Bearer <token>)

const { admin, initAdmin } = require("./_firebaseAdmin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const USERS_COL = "users";
const CARDS_COL = "content_cards";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function ok(body) { return json(200, body); }
function bad(msg, code=400) { return json(code, { error: msg }); }

function parsePath(event) {
  const base = "/.netlify/functions/api";
  const p = (event.path || "").startsWith(base) ? event.path.slice(base.length) : event.path;
  return p || "/";
}

function getAuthToken(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "14d" });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function makeUserPublic(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

async function requireUser(event, db) {
  const token = getAuthToken(event);
  if (!token) throw new Error("NO_AUTH");
  let decoded;
  try { decoded = verifyToken(token); } catch (e) { throw new Error("BAD_TOKEN"); }
  const uid = decoded?.uid;
  if (!uid) throw new Error("BAD_TOKEN");

  const ref = db.collection(USERS_COL).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("NO_USER");
  const user = snap.data();
  return { uid, user, ref };
}

function genId() {
  // LM-XXXXXX
  const n = Math.floor(Math.random() * 900000) + 100000;
  return "LM-" + String(n);
}

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i=0;i<10;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function profileComplete(p) {
  return !!(p?.name && p?.phone && p?.role && p?.region && p?.district && p?.avatarUrl);
}

async function uploadAvatarBase64(bucket, uid, avatarBase64) {
  // avatarBase64: data URL or raw base64
  if (!avatarBase64) return null;

  let base64 = avatarBase64;
  let contentType = "image/png";
  const m = avatarBase64.match(/^data:(.+);base64,(.*)$/);
  if (m) { contentType = m[1]; base64 = m[2]; }

  const buf = Buffer.from(base64, "base64");
  if (buf.length > 2.5 * 1024 * 1024) throw new Error("AVATAR_TOO_LARGE");

  const ext = contentType.includes("jpeg") ? "jpg" : (contentType.includes("webp") ? "webp" : "png");
  const path = `avatars/${uid}.${ext}`;
  const file = bucket.file(path);

  await file.save(buf, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  // Make public URL (works if bucket allows public read on that object).
  // If you prefer private, you can use signed URLs.
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  initAdmin();
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const path = parsePath(event);
  const method = event.httpMethod;

  try {
    // ---------------- AUTH: register ----------------
    if (path === "/auth/register" && method === "POST") {
      const body = JSON.parse(event.body || "{}");

      // Optional: accept custom ID? We'll always auto-generate unique.
      const password = genPassword();

      // Generate unique id doc
      let uid = null;
      for (let i=0;i<50;i++) {
        const cand = genId();
        const snap = await db.collection(USERS_COL).doc(cand).get();
        if (!snap.exists) { uid = cand; break; }
      }
      if (!uid) return bad("ID yaratib bo‘lmadi, qayta urinib ko‘ring.");

      const passwordHash = await bcrypt.hash(password, 10);
      const now = Date.now();

      const user = {
        id: uid,
        passwordHash,
        createdAt: now,
        isAdmin: false,
        profile: {
          name: "",
          phone: "",
          role: "",
          class: "",
          region: "",
          district: "",
          school: "",
          avatarUrl: "",
        },
      };

      await db.collection(USERS_COL).doc(uid).set(user);

      const token = signToken({ uid });
      return ok({ id: uid, password, token, user: makeUserPublic(user) });
    }

    // ---------------- AUTH: login ----------------
    if (path === "/auth/login" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const id = String(body.id || "").trim();
      const password = String(body.password || "");

      if (!id || !password) return bad("ID va parol kerak.");

      const snap = await db.collection(USERS_COL).doc(id).get();
      if (!snap.exists) return bad("Bunday ID topilmadi.", 404);

      const user = snap.data();
      const okPw = await bcrypt.compare(password, user.passwordHash || "");
      if (!okPw) return bad("Parol noto‘g‘ri.", 401);

      const token = signToken({ uid: id });
      return ok({ token, user: makeUserPublic(user) });
    }

    // ---------------- ME ----------------
    if (path === "/me" && method === "GET") {
      const { user } = await requireUser(event, db);
      return ok({ user: makeUserPublic(user), profileComplete: profileComplete(user.profile) });
    }

    // ---------------- PROFILE UPDATE ----------------
    if (path === "/me/profile" && method === "PUT") {
      const { uid, user, ref } = await requireUser(event, db);
      const body = JSON.parse(event.body || "{}");

      const nextProfile = {
        name: String(body.name || "").trim(),
        phone: String(body.phone || "").trim(),
        role: String(body.role || "").trim(),
        class: String(body.class || "").trim(),
        region: String(body.region || "").trim(),
        district: String(body.district || "").trim(),
        school: String(body.school || "").trim(),
        avatarUrl: user?.profile?.avatarUrl || "",
      };

      // Avatar upload (optional)
      if (body.avatarBase64) {
        const url = await uploadAvatarBase64(bucket, uid, String(body.avatarBase64));
        nextProfile.avatarUrl = url;
      }

      // Validate required
      if (!nextProfile.name || !nextProfile.phone || !nextProfile.role || !nextProfile.region || !nextProfile.district || !nextProfile.avatarUrl) {
        return bad("Majburiy maydonlar to‘liq emas.");
      }

      await ref.set({ profile: nextProfile, updatedAt: Date.now() }, { merge: true });
      const snap2 = await ref.get();
      return ok({ user: makeUserPublic(snap2.data()), profileComplete: profileComplete(nextProfile) });
    }

    // ---------------- CONTENT: cards (public read) ----------------
    if (path === "/content/cards" && method === "GET") {
      const q = await db.collection(CARDS_COL).orderBy("order", "asc").get();
      const cards = q.docs.map(d => ({ id: d.id, ...d.data() }));
      return ok({ cards });
    }

    // ---------------- ADMIN: cards CRUD ----------------
    if (path.startsWith("/admin/cards")) {
      const { uid, user } = await requireUser(event, db);
      if (!user?.isAdmin) return bad("Admin emas.", 403);

      // POST /admin/cards -> create
      if (path === "/admin/cards" && method === "POST") {
        const body = JSON.parse(event.body || "{}");
        const doc = {
          title: String(body.title || "").trim(),
          desc: String(body.desc || "").trim(),
          cat: String(body.cat || "").trim(),
          badge: String(body.badge || "").trim(),
          icon: String(body.icon || "").trim(),
          href: String(body.href || "").trim(),
          img: String(body.img || "").trim(),
          order: Number(body.order ?? 0),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        if (!doc.title) return bad("title kerak");
        const ref = await db.collection(CARDS_COL).add(doc);
        return ok({ id: ref.id });
      }

      // PUT /admin/cards/:id -> update
      const m = path.match(/^\/admin\/cards\/([^\/]+)$/);
      if (m && method === "PUT") {
        const id = m[1];
        const body = JSON.parse(event.body || "{}");
        const patch = { ...body, updatedAt: Date.now() };
        await db.collection(CARDS_COL).doc(id).set(patch, { merge: true });
        return ok({ ok: true });
      }

      // DELETE /admin/cards/:id
      if (m && method === "DELETE") {
        const id = m[1];
        await db.collection(CARDS_COL).doc(id).delete();
        return ok({ ok: true });
      }

      return bad("Admin route topilmadi", 404);
    }

    return bad("Route topilmadi", 404);

  } catch (e) {
    const msg = String(e?.message || e);

    if (msg === "NO_AUTH") return bad("Avval login qiling.", 401);
    if (msg === "BAD_TOKEN") return bad("Token yaroqsiz. Qayta login qiling.", 401);
    if (msg === "NO_USER") return bad("User topilmadi. Qayta login qiling.", 401);
    if (msg === "AVATAR_TOO_LARGE") return bad("Avatar juda katta (2.5MB dan kichik bo‘lsin).", 413);

    return json(500, { error: "Server xatosi", detail: msg });
  }
};

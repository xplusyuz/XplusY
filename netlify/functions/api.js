// netlify/functions/api.js
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ADMIN_EMAIL = "sohibjonmath@gmail.com";
const MENU_DOC_PATH = { col: "configs", doc: "spa_menu" };

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
function getPath(event) { return (event.path || "").replace("/.netlify/functions/api", "") || "/"; }
function generateLoginId6(){
  return String(Math.floor(100000 + Math.random()*900000));
}

function nowISO() { return new Date().toISOString(); }

function initFirebaseAdmin() {
  if (admin.apps.length) return;
  const svc = ((process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON) || process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!svc) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env");
  const cred = admin.credential.cert(JSON.parse(svc));
  admin.initializeApp({ credential: cred, storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined });
}

function signSession(payload) {
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) throw new Error("Missing SESSION_JWT_SECRET env");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}
function verifySessionToken(token) {
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) throw new Error("Missing SESSION_JWT_SECRET env");
  return jwt.verify(token, secret);
}
function getBearer(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}
async function authRequired(event) {
  const token = getBearer(event);
  if (!token) throw new Error("Unauthorized");
  return verifySessionToken(token); // {uid, provider, email?, loginId?}
}
async function adminRequired(event) {
  const sess = await authRequired(event);
  const adminEmail = (String(process.env.ADMIN_EMAIL || "") || ADMIN_EMAIL).toLowerCase();
  const ok = (sess.isAdmin === true) || (sess.provider === "admin") || (sess.email && sess.email.toLowerCase() === adminEmail);
  if (!ok) throw new Error("Admin only");
  return sess;
}

function genLoginId() {
  const n = Math.floor(10000 + Math.random() * 90000);
  return `LM-${n}`;
}
function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

function safeExt(ext) {
  const e = (ext || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ["png","jpg","jpeg","webp"].includes(e) ? e : "png";
}
function contentTypeForExt(ext) {
  const e = safeExt(ext);
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "webp") return "image/webp";
  return "image/png";
}

exports.handler = async (event) => {
  try {
    initFirebaseAdmin();
    const db = admin.firestore();
    function getBucket(){
  let b = String(process.env.FIREBASE_STORAGE_BUCKET || "");
  if(!b){
    // infer: <projectId>.appspot.com
    try{ const pid = admin.app().options.projectId; if(pid) b = pid + ".appspot.com"; }catch(e){}
  }
  if(!b) throw new Error("Storage bucket topilmadi. Netlify env FIREBASE_STORAGE_BUCKET ni qo‘ying.");
  return admin.storage().bucket(b);
}

const path = getPath(event);
    const method = event.httpMethod;

    const usersCol = db.collection("users");
    const menuDoc = db.collection(MENU_DOC_PATH.col).doc(MENU_DOC_PATH.doc);

    // ===== AUTH: One-click register =====
    if (path === "/auth/register" && method === "POST") {
      let loginId;
      for (let i = 0; i < 12; i++) {
        const candidate = genLoginId();
        const snap = await usersCol.doc(candidate).get();
        if (!snap.exists) { loginId = candidate; break; }
      }
      if (!loginId) return json(500, { error: "Try again" });

      const password = genPassword();
      const hash = await bcrypt.hash(password, 10);

      const user = {
        uid: loginId,
        provider: "password",
        loginId,
        passHash: hash,
        email: "",
        photoURL: "",
        points: 0,
        profile: { firstName:"", lastName:"", birthdate:"", region:"", district:"" },
        createdAt: nowISO(),
        updatedAt: nowISO()
      };
      await usersCol.doc(loginId).set(user, { merge: false });

      const token = signSession({ uid: loginId, provider: "password", loginId });
      return json(200, { loginId, password, token });
    }

    // ===== AUTH: ID+Password login =====
    if (path === "/auth/login" && method === "POST") {
      const { loginId, password } = JSON.parse(event.body || "{}");
      if (!loginId || !password) return json(400, { error: "loginId & password required" });

      const snap = await usersCol.doc(loginId).get();
      if (!snap.exists) return json(404, { error: "Bunday ID topilmadi" });
      const u = snap.data();

      if (!u.passHash) return json(400, { error: "Bu user parol bilan emas" });

      const ok = await bcrypt.compare(password, u.passHash);
      if (!ok) return json(401, { error: "Parol noto‘g‘ri" });

      const token = signSession({ uid: u.uid, provider: "password", loginId: u.loginId });
      return json(200, { token });
    }


    // ===== AUTH: Admin login (email + ADMIN_PASSWORD) =====
    if (path === "/auth/adminLogin" && method === "POST") {
      const { email, password } = JSON.parse(event.body || "{}");
      const adminEmail = (String(process.env.ADMIN_EMAIL || "") || ADMIN_EMAIL).toLowerCase();
      const adminPass = String(process.env.ADMIN_PASSWORD || "");
      if (!adminPass) return json(500, { error: "Missing ADMIN_PASSWORD env" });

      const em = String(email || "").toLowerCase().trim();
      if (em !== adminEmail) return json(403, { error: "Admin email noto‘g‘ri" });
      if (String(password || "") !== adminPass) return json(401, { error: "Admin parol noto‘g‘ri" });

      // Ensure admin user doc exists
      const uid = "admin_" + adminEmail.replace(/[^a-z0-9]/g, "_");
      const ref = usersCol.doc(uid);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          uid,
          provider: "admin",
          loginId: adminEmail,
          email: adminEmail,
          photoURL: "",
          points: 0,
          profile: { firstName:"Sohibjon", lastName:"", birthdate:"", region:"", district:"" },
          createdAt: nowISO(),
          updatedAt: nowISO()
        });
      } else {
        await ref.set({ provider:"admin", email: adminEmail, updatedAt: nowISO() }, { merge: true });
      }

      const token = signSession({ uid, provider: "admin", email: adminEmail, isAdmin: true });
      return json(200, { token });
    }



    // ===== AUTH: Admin via Firebase Google ID token =====
    if (path === "/auth/adminGoogle" && method === "POST") {
      const { idToken } = JSON.parse(event.body || "{}");
      if (!idToken) return json(400, { error: "Missing idToken" });

      const adminEmail = (String(process.env.ADMIN_EMAIL || "") || ADMIN_EMAIL).toLowerCase();

      // Verify Firebase ID token using Admin SDK
      const decoded = await auth.verifyIdToken(idToken);
      const email = String(decoded.email || "").toLowerCase();
      if (email !== adminEmail) return json(403, { error: "Admin only" });

      const uid = decoded.uid || ("admin_" + adminEmail.replace(/[^a-z0-9]/g, "_"));
      const ref = usersCol.doc(uid);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          uid,
          provider: "admin",
          loginId: adminEmail,
          email: adminEmail,
          photoURL: decoded.picture || "",
          points: 0,
          profile: { firstName: decoded.name || "Admin", lastName:"", birthdate:"", region:"", district:"" },
          createdAt: nowISO(),
          updatedAt: nowISO()
        });
      } else {
        await ref.set({ provider:"admin", email: adminEmail, photoURL: decoded.picture || "", updatedAt: nowISO() }, { merge: true });
      }

      const token = signSession({ uid, provider: "admin", email: adminEmail, isAdmin: true });
      return json(200, { token });
    }


    // ===== ME =====
    if (path === "/me" && method === "GET") {
      const sess = await authRequired(event);
      const snap = await usersCol.doc(sess.uid).get();
      if (!snap.exists) return json(404, { error: "User not found" });
      const u = snap.data();
      delete u.passHash;
      return json(200, u);
    }

    // ===== Update profile (+ optional password change) =====
    if (path === "/me/profile" && method === "PUT") {
      const sess = await authRequired(event);
      const body = JSON.parse(event.body || "{}");
      const profile = body.profile || {};
      const newPassword = body.newPassword || null;

      const ref = usersCol.doc(sess.uid);
      const snap = await ref.get();
      if (!snap.exists) return json(404, { error: "User not found" });
      const u = snap.data();

      const upd = {
        profile: {
          firstName: (profile.firstName || "").trim(),
          lastName: (profile.lastName || "").trim(),
          birthdate: profile.birthdate || "",
          region: profile.region || "",
          district: (profile.district || "").trim()
        },
        updatedAt: nowISO()
      };

      if (u.provider === "password") {
        if (!newPassword || newPassword.length < 6) return json(400, { error: "New password min 6" });
        upd.passHash = await bcrypt.hash(newPassword, 10);
      }

      await ref.set(upd, { merge: true });
      const out = (await ref.get()).data();
      delete out.passHash;
      return json(200, out);
    }

    // ===== Avatar: signed upload URL =====
    if (path === "/me/avatarUploadUrl" && method === "POST") {
      const sess = await authRequired(event);
      const body = JSON.parse(event.body || "{}");
      const ext = safeExt(body.ext || "png");
      const contentType = body.contentType || contentTypeForExt(ext);

      const objectPath = `avatars/${sess.uid}.${ext}`;
      const file = getBucket().file(objectPath);

      const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 10 * 60 * 1000, // 10 min
        contentType
      });

      return json(200, { uploadUrl, path: objectPath, contentType });
    }

    // ===== Avatar: finalize => set download token + store photoURL in user doc =====
    if (path === "/me/avatarFinalize" && method === "POST") {
      const sess = await authRequired(event);
      const body = JSON.parse(event.body || "{}");
      const objectPath = body.path;
      if (!objectPath || !objectPath.startsWith("avatars/")) return json(400, { error: "Invalid path" });

      const file = getBucket().file(objectPath);

      // Ensure file exists
      const [exists] = await file.exists();
      if (!exists) return json(404, { error: "File not found" });

      // Create stable download token (Firebase style)
      const token = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

      await file.setMetadata({
        metadata: { firebaseStorageDownloadTokens: token },
        cacheControl: "public, max-age=31536000"
      });

      const bucketName = bucket.name;
      const encodedPath = encodeURIComponent(objectPath);
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

      await usersCol.doc(sess.uid).set({ photoURL: downloadURL, updatedAt: nowISO() }, { merge: true });

      const outSnap = await usersCol.doc(sess.uid).get();
      const out = outSnap.data();
      delete out.passHash;
      return json(200, out);
    }

    // ===== MENU (for logged-in) =====
    if (path === "/menu" && method === "GET") {
      await authRequired(event);
      const snap = await menuDoc.get();
      const data = snap.exists ? snap.data() : { items: [] };
      return json(200, { items: data.items || [] });
    }

    // ===== ADMIN: set all menu items (keeps order) =====
    if (path === "/admin/menuSetAll" && method === "POST") {
      await adminRequired(event);
      const body = JSON.parse(event.body || "{}");
      const items = Array.isArray(body.items) ? body.items : [];
      // basic sanitize
      const cleaned = items.map(it => ({
        id: String(it.id || "").trim(),
        title: String(it.title || "").trim(),
        mode: it.mode === "custom" ? "custom" : "builder",
        baseHref: String(it.baseHref || "").trim(),
        builder: it.mode === "builder" ? (it.builder || {banners:[],cards:[]}) : undefined,
        htmlUrl: it.mode === "custom" ? String(it.htmlUrl || "").trim() : undefined,
        cssUrl: it.mode === "custom" ? String(it.cssUrl || "").trim() : undefined,
        jsUrl: it.mode === "custom" ? String(it.jsUrl || "").trim() : undefined,
        inlineHtml: it.mode === "custom" ? (it.inlineHtml || "") : undefined,
        inlineCss: it.mode === "custom" ? (it.inlineCss || "") : undefined,
        inlineJs: it.mode === "custom" ? (it.inlineJs || "") : undefined,
      })).filter(it => it.id && it.title);

      await menuDoc.set({ items: cleaned, updatedAt: nowISO() }, { merge: true });
      return json(200, { ok: true });
    }

    return json(404, { error: "Not found", path, method });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    const code = /Unauthorized/i.test(msg) ? 401 : (/Admin only/i.test(msg) ? 403 : 500);
    return json(code, { error: msg });
  }
};

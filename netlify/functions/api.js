// netlify/functions/api.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  try { return event.body ? JSON.parse(event.body) : {}; }
  catch { return null; }
}

function getBearer(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function initAdmin() {
  if (admin.apps.length) return;
  const b64 = requireEnv("FIREBASE_SERVICE_ACCOUNT_BASE64");
  let saJson;
  try {
    const raw = Buffer.from(b64, "base64").toString("utf8");
    saJson = JSON.parse(raw);
  } catch (e) {
    throw new Error("ENV: SERVICE_ACCOUNT_JSON xato. Base64 JSON noto‘g‘ri.");
  }
  admin.initializeApp({
    credential: admin.credential.cert(saJson),
  });
}

function signToken(loginId) {
  const secret = requireEnv("JWT_SECRET");
  return jwt.sign({ sub: loginId }, secret, { expiresIn: "30d" });
}

function verifyToken(token) {
  const secret = requireEnv("JWT_SECRET");
  return jwt.verify(token, secret);
}

function randDigits(n=6){
  let s="";
  for(let i=0;i<n;i++) s += Math.floor(Math.random()*10);
  return s.replace(/^0/,"1");
}
function randPassword(len=8){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let s="";
  for(let i=0;i<len;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

async function nextCounter(tx, ref, field, start=1) {
  const snap = await tx.get(ref);
  let cur = start;
  if (snap.exists && typeof snap.get(field)==="number") cur = snap.get(field);
  const next = cur + 1;
  tx.set(ref, { [field]: next }, { merge:true });
  return cur;
}

async function handleAuthRegister(db) {
  const users = db.collection("users");
  const metaRef = db.collection("meta").doc("counters");
  const res = await db.runTransaction(async (tx) => {
    const n = await nextCounter(tx, metaRef, "nextLoginId", 100000);
    const loginId = String(n).padStart(6,"0");
    const password = randPassword(8);
    const passwordHash = await bcrypt.hash(password, 10);
    const userRef = users.doc(loginId);
    const userSnap = await tx.get(userRef);
    if (userSnap.exists) {
      // very rare, just bump again
      const n2 = await nextCounter(tx, metaRef, "nextLoginId", n+1);
      const loginId2 = String(n2).padStart(6,"0");
      const password2 = randPassword(8);
      const hash2 = await bcrypt.hash(password2, 10);
      tx.set(users.doc(loginId2), {
        loginId: loginId2,
        // Ko'rinadigan ID: faqat raqam (LM- prefiksi yo'q)
        publicId: loginId2,
        passwordHash: hash2,
        mustChangePassword: true,
        profileComplete: false,
        firstName: "",
        lastName: "",
        birthdate: "",
        points: 0,
        balance: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge:false });
      return { loginId: loginId2, password: password2 };
    }
    tx.set(userRef, {
      loginId,
      // Ko'rinadigan ID: faqat raqam (LM- prefiksi yo'q)
      publicId: loginId,
      passwordHash,
      mustChangePassword: true,
      profileComplete: false,
      firstName: "",
      lastName: "",
      birthdate: "",
      points: 0,
      balance: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge:false });
    return { loginId, password };
  });
  const token = signToken(res.loginId);
  return { token, loginId: res.loginId, password: res.password };
}

async function handleAuthLogin(db, body) {
  const { loginId, password } = body || {};
  if (!loginId || !password) return { error: "loginId va password kerak" , status:400};
  // LM-000001 kabi format ham kiritilsa qabul qilamiz
  const normId = String(loginId).trim().replace(/^LM\s*[-_]?/i, "").replace(/[^0-9]/g, "");
  if (!normId) return { error: "ID noto‘g‘ri", status:400 };
  const snap = await db.collection("users").doc(normId).get();
  if (!snap.exists) return { error: "Bunday ID topilmadi", status:404};
  const data = snap.data();
  const ok = await bcrypt.compare(password, data.passwordHash || "");
  if (!ok) return { error: "Parol noto‘g‘ri", status:401};
  const token = signToken(normId);
  return { token, user: publicUser(data) };
}

function publicUser(u){
  return {
    loginId: u.loginId,
    // UI uchun LM- prefikssiz ko‘rsatamiz
    publicId: u.publicId || String(u.loginId),
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    birthdate: u.birthdate || "",
    profileComplete: !!u.profileComplete,
    mustChangePassword: !!u.mustChangePassword,
    points: Number(u.points||0),
    balance: Number(u.balance||0),
    avatarUrl: u.avatarUrl || "",
  };
}

async function handleAuthMe(db, loginId){
  const snap = await db.collection("users").doc(loginId).get();
  if (!snap.exists) return null;
  return publicUser(snap.data());
}

async function handleChangePassword(db, loginId, body){
  const { newPassword } = body || {};
  if (!newPassword || String(newPassword).length < 6) return { error: "Yangi parol kamida 6 ta belgidan iborat bo‘lsin", status:400 };
  const hash = await bcrypt.hash(String(newPassword), 10);
  await db.collection("users").doc(loginId).set({
    passwordHash: hash,
    mustChangePassword: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge:true });
  return { ok:true };
}

async function handleUpdateProfile(db, loginId, body){
  const { firstName, lastName, birthdate } = body || {};
  if (!firstName || !lastName || !birthdate) return { error: "Ism, familiya va tug‘ilgan sana majburiy", status:400 };
  await db.collection("users").doc(loginId).set({
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    birthdate: String(birthdate),
    profileComplete: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge:true });
  return { ok:true };
}

async function handleLeaderboard(db, limit=20){
  limit = Math.max(1, Math.min(100, Number(limit||20)));
  const q = await db.collection("users")
    .orderBy("points","desc")
    .orderBy("updatedAt","desc")
    .limit(limit)
    .get();
  const rows = [];
  q.forEach(doc=>{
    const u = doc.data()||{};
    rows.push({
      loginId: u.loginId || doc.id,
      publicId: u.publicId || ("LM-" + String(u.loginId||doc.id).padStart(6,"0")),
      name: ((u.firstName||"") + " " + (u.lastName||"")).trim() || "Foydalanuvchi",
      points: Number(u.points||0),
      balance: Number(u.balance||0),
      avatarUrl: u.avatarUrl || "",
    });
  });
  return { items: rows };
}

async function handleGetComments(db, limit=20){
  limit = Math.max(1, Math.min(50, Number(limit||20)));
  const q = await db.collection("comments")
    .orderBy("createdAt","desc")
    .limit(limit)
    .get();
  const items=[];
  q.forEach(doc=>{
    const c=doc.data()||{};
    items.push({
      id: doc.id,
      text: c.text || "",
      name: c.name || "Foydalanuvchi",
      loginId: c.loginId || "",
      createdAt: c.createdAt ? c.createdAt.toDate().toISOString() : "",
    });
  });
  return { items };
}

async function handlePostComment(db, loginId, body){
  const { text } = body || {};
  const t = String(text||"").trim();
  if (!t) return { error:"Izoh bo‘sh bo‘lishi mumkin emas", status:400 };
  if (t.length > 400) return { error:"Izoh 400 belgidan oshmasin", status:400 };
  const u = await handleAuthMe(db, loginId);
  const name = ((u?.firstName||"") + " " + (u?.lastName||"")).trim() || "Foydalanuvchi";
  const ref = await db.collection("comments").add({
    text: t,
    loginId,
    name,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok:true, id: ref.id };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json(200, { ok:true });

  try {
    initAdmin();
    const db = admin.firestore();

    const qs = event.queryStringParameters || {};
    const raw = qs.path ? decodeURIComponent(qs.path) : "";
    // Normalize path so both "auth/login" and "/auth/login" work
    const [pathnameRaw, query] = raw.split("?");
    const pathname = String(pathnameRaw || "").replace(/^\/+/, "");
    const qparams = {};
    if (query) {
      for (const part of query.split("&")) {
        const [k,v] = part.split("=");
        if (k) qparams[decodeURIComponent(k)] = decodeURIComponent(v||"");
      }
    }

    const body = parseBody(event);
    if (body === null) return json(400, { error:"JSON noto‘g‘ri" });

    // auth protected routes
    const token = getBearer(event) || (body && body.token) || "";
    const decoded = token ? (()=>{ try { return verifyToken(token); } catch { return null; } })() : null;
    const loginId = decoded?.sub ? String(decoded.sub) : null;

    // Routing
    if (pathname === "auth/register" && event.httpMethod === "POST") {
      const r = await handleAuthRegister(db);
      return json(200, r);
    }
    if (pathname === "auth/login" && event.httpMethod === "POST") {
      const r = await handleAuthLogin(db, body);
      if (r?.error) return json(r.status||400, { error:r.error });
      return json(200, r);
    }
    if (pathname === "auth/me" && event.httpMethod === "GET") {
      if (!loginId) return json(401, { error:"Token yo‘q" });
      const u = await handleAuthMe(db, loginId);
      if (!u) return json(404, { error:"User topilmadi" });
      return json(200, { user: u });
    }
    if (pathname === "auth/change-password" && event.httpMethod === "POST") {
      if (!loginId) return json(401, { error:"Token yo‘q" });
      const r = await handleChangePassword(db, loginId, body);
      if (r?.error) return json(r.status||400, { error:r.error });
      return json(200, r);
    }
    if (pathname === "auth/update-profile" && event.httpMethod === "POST") {
      if (!loginId) return json(401, { error:"Token yo‘q" });
      const r = await handleUpdateProfile(db, loginId, body);
      if (r?.error) return json(r.status||400, { error:r.error });
      return json(200, r);
    }

    if (pathname === "leaderboard" && event.httpMethod === "GET") {
      const r = await handleLeaderboard(db, qparams.limit || qs.limit || 20);
      return json(200, r);
    }
    if (pathname === "comments" && event.httpMethod === "GET") {
      const r = await handleGetComments(db, qparams.limit || qs.limit || 20);
      return json(200, r);
    }
    if (pathname === "comments" && event.httpMethod === "POST") {
      if (!loginId) return json(401, { error:"Token yo‘q" });
      const r = await handlePostComment(db, loginId, body);
      if (r?.error) return json(r.status||400, { error:r.error });
      return json(200, r);
    }

    return json(404, { error:"Endpoint topilmadi", path: pathname });

  } catch (e) {
    return json(500, { error: "Server xatosi", detail: String(e.message||e) });
  }
};

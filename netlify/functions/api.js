// netlify/functions/api.js
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function initAdmin(){
  if(admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if(!b64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env");
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  admin.initializeApp({ credential: admin.credential.cert(json) });
}
function db(){ initAdmin(); return admin.firestore(); }

function json(statusCode, body){
  return {
    statusCode,
    headers: {
      "Content-Type":"application/json",
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Headers":"Content-Type, Authorization",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}
const ok = (b)=>json(200,b);
const bad = (m,c=400)=>json(c,{error:m});

function parsePath(event){
  const p = event.path || "";
  if(p.includes("/.netlify/functions/api")) return p.split("/.netlify/functions/api")[1] || "/";
  if(p.startsWith("/api")) return p.slice(4) || "/";
  return "/";
}

function getToken(event){
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/.exec(h);
  return m ? m[1] : "";
}
function requireAuth(event){
  const token = getToken(event);
  if(!token){
    const err = new Error("Auth token yo‘q");
    err.statusCode = 401;
    throw err;
  }
  const secret = process.env.JWT_SECRET;
  if(!secret){
    const err = new Error("Missing JWT_SECRET env");
    err.statusCode = 500;
    throw err;
  }
  try{
    return jwt.verify(token, secret);
  }catch(e){
    const err = new Error("Token noto‘g‘ri yoki muddati tugagan");
    err.statusCode = 401;
    throw err;
  }
}
function isValidDOB(dob){
  const m = /^(\d{2}):(\d{2}):(\d{4})$/.exec(String(dob||"").trim());
  if(!m) return false;
  const dd = +m[1], mm = +m[2], yy = +m[3];
  if(yy < 1900 || yy > new Date().getFullYear()) return false;
  if(mm < 1 || mm > 12) return false;
  const dim = new Date(yy, mm, 0).getDate();
  return dd >= 1 && dd <= dim;
}

async function nextLoginId(){
  const ref = db().doc("meta/counters");
  const out = await db().runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    let next = 10000;
    if(snap.exists && typeof snap.data().nextLoginId === "number") next = snap.data().nextLoginId;
    next += 1;
    tx.set(ref, { nextLoginId: next }, { merge:true });
    return next;
  });
  return String(out);
}
async function userByLoginId(loginId){
  const snap = await db().collection("users").doc(String(loginId)).get();
  if(!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}
function signToken(payload){
  const secret = process.env.JWT_SECRET;
  if(!secret) throw new Error("Missing JWT_SECRET env");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

exports.handler = async (event) => {
  try{
    if(event.httpMethod === "OPTIONS") return ok({});

    const path = parsePath(event);
    const method = event.httpMethod;

    if(path === "/auth/signup" && method === "POST"){
      const body = JSON.parse(event.body || "{}");
      const { firstName, lastName, dob, region, district, password, avatar } = body;

      if(!firstName) return bad("Ism majburiy.");
      if(!lastName) return bad("Familiya majburiy.");
      if(!isValidDOB(dob)) return bad("Tug‘ilgan sana DD:MM:YYYY bo‘lsin.");
      if(!region) return bad("Viloyat majburiy.");
      if(!district) return bad("Tuman majburiy.");
      if(!password || String(password).length < 6) return bad("Parol kamida 6 bo‘lsin.");
      if(!avatar) return bad("Avatar majburiy.");

      const loginId = await nextLoginId();
      const passHash = await bcrypt.hash(String(password), 10);

      const doc = {
        loginId,
        passHash,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        dob: String(dob).trim(),
        region: String(region).trim(),
        district: String(district).trim(),
        avatar: String(avatar).trim(),
        points: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db().collection("users").doc(loginId).set(doc);

      const token = signToken({ loginId, uid: loginId });
      return ok({ token, loginId });
    }

    if(path === "/auth/login" && method === "POST"){
      const body = JSON.parse(event.body || "{}");
      const { loginId, password } = body;
      if(!loginId || !password) return bad("ID va parol majburiy.");

      const u = await userByLoginId(String(loginId).trim());
      if(!u) return bad("Bunday ID topilmadi.", 404);

      const okPass = await bcrypt.compare(String(password), u.passHash || "");
      if(!okPass) return bad("Parol noto‘g‘ri.", 401);

      const token = signToken({ loginId: u.loginId, uid: u.loginId });
      return ok({ token });
    }

    if(path === "/auth/me" && method === "GET"){
      const auth = requireAuth(event);
      const u = await userByLoginId(auth.loginId);
      if(!u) return bad("User topilmadi", 404);
      const { passHash, ...safe } = u;
      return ok({ user: safe });
    }

    if(path === "/profile/update" && method === "POST"){
      const auth = requireAuth(event);
      const body = JSON.parse(event.body || "{}");
      const { firstName, lastName, dob, region, district, avatar } = body;

      if(!firstName) return bad("Ism majburiy.");
      if(!lastName) return bad("Familiya majburiy.");
      if(!isValidDOB(dob)) return bad("Tug‘ilgan sana DD:MM:YYYY bo‘lsin.");
      if(!region) return bad("Viloyat majburiy.");
      if(!district) return bad("Tuman majburiy.");
      if(!avatar) return bad("Avatar majburiy.");

      const ref = db().collection("users").doc(auth.loginId);
      await ref.set({
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        dob: String(dob).trim(),
        region: String(region).trim(),
        district: String(district).trim(),
        avatar: String(avatar).trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge:true });

      return ok({ ok:true });
    }

    if(path === "/leaderboard" && method === "GET"){
      requireAuth(event);
      const snap = await db().collection("users").orderBy("points","desc").limit(30).get();
      const rows = snap.docs.map(d=>{
        const x = d.data();
        return {
          loginId: x.loginId,
          name: `${x.firstName || ""} ${x.lastName || ""}`.trim() || ("ID " + x.loginId),
          points: x.points || 0
        };
      });
      return ok({ rows });
    }

    return bad("Not found", 404);
  }catch(e){
    const code = (typeof e?.statusCode === "number") ? e.statusCode : 500;
    return bad(e.message || "Server xato", code);
  }
};

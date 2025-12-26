// netlify/functions/api.js

function safeRequire(name){
  try{ return { mod: require(name) }; }
  catch(e){ return { error: `Missing dependency: ${name}. Netlify build did not install node_modules? (${e.message})` }; }
}

function initAdmin(){

  const r = safeRequire("firebase-admin");
  if(r.error) throw new Error(r.error);
  const admin = r.mod;
  if(admin.apps.length) return;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if(!b64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env");
  const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  admin.initializeApp({ credential: admin.credential.cert(json) });
}
function db(){
  // firebase-admin is required lazily inside initAdmin, but we need the module here too
  const r = safeRequire("firebase-admin");
  if(r.error) throw new Error(r.error);
  const admin = r.mod;
  initAdmin();
  return admin.firestore();
}

function json(statusCode, body){
  return {
    statusCode,
    headers:{
      "Content-Type":"application/json",
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Headers":"Content-Type, Authorization",
      "Access-Control-Allow-Methods":"GET,POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}
function ok(body){ return json(200, body); }
function err(status, message){ return json(status, { error: message }); }

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
  if(!token) return { ok:false, status:401, error:"Auth token yo‘q" };
  const secret = process.env.JWT_SECRET;
  if(!secret) return { ok:false, status:500, error:"Missing JWT_SECRET env" };
  try{
    const payload = jwt.verify(token, secret);
    return { ok:true, payload };
  }catch{
    return { ok:false, status:401, error:"Token yaroqsiz" };
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
    let next = 999; // so first becomes 1000
    if(snap.exists && typeof snap.data().nextLoginId === "number"){
      next = snap.data().nextLoginId;
    }
    next += 1;
    tx.set(ref, { nextLoginId: next }, { merge:true });
    return next;
  });
  return String(out);
}

function signToken(payload){
  const secret = process.env.JWT_SECRET;
  if(!secret) throw new Error("Missing JWT_SECRET env");
  return jwt.sign(payload, secret, { expiresIn:"60d" });
}

// Password reveal feature: encrypt password with AES-256-GCM (server key)
function encKey(){
  const b64 = process.env.PASS_ENC_KEY_BASE64;
  if(!b64) throw new Error("Missing PASS_ENC_KEY_BASE64 env");
  const key = Buffer.from(b64, "base64");
  if(key.length !== 32) throw new Error("PASS_ENC_KEY_BASE64 must be 32 bytes base64");
  return key;
}
function encryptPassword(plain){
  const iv = crypto.randomBytes(12);
  const key = encKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64"); // iv(12)+tag(16)+ciphertext
}
function decryptPassword(b64){
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0,12);
  const tag = buf.subarray(12,28);
  const enc = buf.subarray(28);
  const key = encKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

async function getUser(loginId){
  const snap = await db().collection("users").doc(String(loginId)).get();
  if(!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

exports.handler = async (event) => {
  try{
    if(event.httpMethod === "OPTIONS") return ok({});

    // Lightweight diagnostics endpoint (works even if firebase deps/env are missing)
    if(parsePath(event) === "/diag" && event.httpMethod === "GET"){
      const missing = [];
      ["FIREBASE_SERVICE_ACCOUNT_BASE64","JWT_SECRET","PASS_ENC_KEY_BASE64"].forEach(k=>{
        if(!process.env[k]) missing.push(k);
      });
      return ok({
        ok:true,
        missing_env: missing,
        note: "If missing_env is empty but you still get 500, check Netlify build logs for missing node_modules."
      });
    }


    const path = parsePath(event);
    const method = event.httpMethod;

    const rb = safeRequire("bcryptjs"); if(rb.error) throw new Error(rb.error); const bcrypt = rb.mod;
    const rj = safeRequire("jsonwebtoken"); if(rj.error) throw new Error(rj.error); const jwt = rj.mod;
    const rc = safeRequire("crypto"); if(rc.error) throw new Error(rc.error); const crypto = rc.mod;
    // firebase-admin module (for timestamps) loaded lazily:
    const ra = safeRequire("firebase-admin"); if(ra.error) throw new Error(ra.error); const admin = ra.mod;

    if(path === "/auth/signup" && method === "POST"){
      const body = JSON.parse(event.body || "{}");
      const { password, firstName, lastName, dob } = body;

      if(!password || String(password).length < 6) return err(400, "Parol kamida 6 bo‘lsin.");
      if(!firstName) return err(400, "Ism majburiy.");
      if(!lastName)  return err(400, "Familiya majburiy.");
      if(!isValidDOB(dob)) return err(400, "Tug‘ilgan sana DD:MM:YYYY bo‘lsin.");

      const loginId = await nextLoginId();
      const passHash = await bcrypt.hash(String(password), 10);
      const passEnc  = encryptPassword(String(password));

      const doc = {
        loginId,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        dob: String(dob).trim(),
        passHash,
        passEnc,
        points: 0,
        balance: 0,
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
      if(!loginId || !password) return err(400, "ID va parol majburiy.");

      const u = await getUser(String(loginId).trim());
      if(!u) return err(404, "Bunday ID topilmadi.");

      const okPass = await bcrypt.compare(String(password), u.passHash || "");
      if(!okPass) return err(401, "Parol noto‘g‘ri.");

      const token = signToken({ loginId: u.loginId, uid: u.loginId });
      return ok({ token });
    }

    if(path === "/auth/me" && method === "GET"){
      const a = requireAuth(event);
      if(!a.ok) return err(a.status, a.error);

      const u = await getUser(a.payload.loginId);
      if(!u) return err(404, "User topilmadi.");

      const createdAtText = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString("uz-UZ") : "";
      const safe = {
        loginId: u.loginId,
        firstName: u.firstName,
        lastName: u.lastName,
        dob: u.dob,
        points: u.points || 0,
        balance: u.balance || 0,
        createdAtText
      };
      return ok({ user: safe });
    }

    if(path === "/profile/password" && method === "GET"){
      const a = requireAuth(event);
      if(!a.ok) return err(a.status, a.error);

      const u = await getUser(a.payload.loginId);
      if(!u) return err(404, "User topilmadi.");
      if(!u.passEnc) return err(400, "Password saqlanmagan.");

      const plain = decryptPassword(u.passEnc);
      return ok({ password: plain });
    }

    return err(404, "Not found");
  }catch(e){
    return err(500, e.message || "Server xato");
  }
};
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function json(statusCode, obj){
  return { statusCode, headers: { "Content-Type":"application/json" }, body: JSON.stringify(obj) };
}

function getEnv(name, fallback=""){
  return process.env[name] || fallback;
}

function getDb(){
  if(admin.apps.length) return admin.firestore();
  const b64 = getEnv("FIREBASE_SERVICE_ACCOUNT_BASE64");
  if(!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 yo‘q (Netlify env ga qo‘ying)");
  const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

const JWT_SECRET = getEnv("JWT_SECRET", "dev_secret_change_me");

function signToken(loginId){
  return jwt.sign({ sub: loginId }, JWT_SECRET, { expiresIn: "30d" });
}

function verifyToken(token){
  return jwt.verify(token, JWT_SECRET);
}

function getBearer(event){
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function scryptHash(password, salt){
  const buf = crypto.scryptSync(password, salt, 32);
  return buf.toString("hex");
}

async function nextLoginId(db){
  const counterRef = db.doc("meta/counters");
  const out = await db.runTransaction(async (tx)=>{
    const snap = await tx.get(counterRef);
    const data = snap.exists ? snap.data() : {};
    const cur = Number(data?.users ?? 0);
    const next = cur + 1;
    tx.set(counterRef, { users: next }, { merge:true });
    const loginId = "LM-" + String(next).padStart(6,"0");
    return loginId;
  });
  return out;
}

async function getUser(db, loginId){
  const ref = db.collection("users").doc(loginId);
  const snap = await ref.get();
  return snap.exists ? { ref, data: snap.data() } : null;
}

function pickPublic(u){
  return {
    loginId: u.loginId,
    name: u.name || "",
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    birthdate: u.birthdate || "",
    profileComplete: !!u.profileComplete,
    points: u.points ?? 0,
    balance: u.balance ?? 0,
    createdAt: u.createdAt || null
  };
}

export const handler = async (event) => {
  try{
    const db = getDb();
    let qpath = (event.queryStringParameters?.path || "").replace(/^\/+/,"");
    if(!qpath){
      const p = (event.path || "").replace(/^.*\/\.netlify\/functions\/api\/?/,"");
      qpath = String(p||"").replace(/^\/+/,"");
    }
    const path = "/" + qpath;
    const method = event.httpMethod;

    // ===== HEALTH =====
    if(path === "/health") return json(200, { ok:true });

    // ===== REGISTER AUTO =====
    if(path === "/auth/register" && method === "POST"){
      const loginId = await nextLoginId(db);
      const password = (Math.random().toString(36).slice(2,8) + "A!").slice(0,10);
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = scryptHash(password, salt);

      const user = {
        loginId,
        salt,
        passwordHash,
        name:"",
        firstName:"",
        lastName:"",
        birthdate:"",
        profileComplete:false,
        points:0,
        balance:0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await db.collection("users").doc(loginId).set(user, { merge:false });

      const token = signToken(loginId);
      return json(200, { ok:true, loginId, password, token });
    }

    // ===== LOGIN =====
    if(path === "/auth/login" && method === "POST"){
      const body = JSON.parse(event.body || "{}");
      const loginId = String(body.loginId || "").trim();
      const password = String(body.password || "");
      if(!loginId || !password) return json(400, { error:"ID va Parol kerak" });

      const found = await getUser(db, loginId);
      if(!found) return json(404, { error:"Bunday ID topilmadi" });
      const u = found.data;

      const hash = scryptHash(password, u.salt);
      if(hash !== u.passwordHash) return json(401, { error:"Parol noto‘g‘ri" });

      const token = signToken(loginId);
      return json(200, { ok:true, token, user: pickPublic(u) });
    }

    // ===== ME =====
    if(path === "/auth/me" && method === "GET"){
      const token = getBearer(event);
      if(!token) return json(401, { error:"Token yo‘q" });
      const payload = verifyToken(token);
      const loginId = payload.sub;
      const found = await getUser(db, loginId);
      if(!found) return json(401, { error:"User topilmadi" });
      return json(200, { ok:true, user: pickPublic(found.data) });
    }

    // ===== CHANGE PASSWORD =====
    if(path === "/auth/change-password" && method === "POST"){
      const token = getBearer(event);
      if(!token) return json(401, { error:"Token yo‘q" });
      const payload = verifyToken(token);
      const loginId = payload.sub;

      const body = JSON.parse(event.body || "{}");
      const newPassword = String(body.newPassword || "");
      if(newPassword.length < 6) return json(400, { error:"Yangi parol kamida 6 belgi" });

      const found = await getUser(db, loginId);
      if(!found) return json(401, { error:"User topilmadi" });

      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = scryptHash(newPassword, salt);

      await found.ref.update({ salt, passwordHash, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return json(200, { ok:true });
    }

    // ===== UPDATE PROFILE =====
    if(path === "/auth/update-profile" && method === "POST"){
      const token = getBearer(event);
      if(!token) return json(401, { error:"Token yo‘q" });
      const payload = verifyToken(token);
      const loginId = payload.sub;

      const body = JSON.parse(event.body || "{}");
      const firstName = String(body.firstName || "").trim();
      const lastName  = String(body.lastName  || "").trim();
      const birthdate = String(body.birthdate || "").trim();
      if(firstName.length < 2) return json(400, { error:"Ism kamida 2 harf" });
      if(lastName.length < 2) return json(400, { error:"Familiya kamida 2 harf" });
      if(!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return json(400, { error:"Tug‘ilgan sana noto‘g‘ri" });

      const found = await getUser(db, loginId);
      if(!found) return json(401, { error:"User topilmadi" });

      const name = (firstName + " " + lastName).trim();
      await found.ref.update({
        firstName, lastName, birthdate, name,
        profileComplete:true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const fresh = (await found.ref.get()).data();
      return json(200, { ok:true, user: pickPublic(fresh) });
    }

    return json(404, { error:"Endpoint topilmadi", path, method });
  }catch(e){
    return json(500, { error: e.message || "Server error" });
  }
};

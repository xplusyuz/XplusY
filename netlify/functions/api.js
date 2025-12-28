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
  if(!b64) throw new Error("ENV: FIREBASE_SERVICE_ACCOUNT_BASE64 yo‘q");
  let jsonText = "";
  try{
    jsonText = Buffer.from(b64, "base64").toString("utf-8");
  }catch(_){
    throw new Error("ENV: FIREBASE_SERVICE_ACCOUNT_BASE64 base64 emas");
  }
  let serviceAccount;
  try{
    serviceAccount = JSON.parse(jsonText);
  }catch(e){
    const head = (jsonText||"").slice(0,80).replace(/\s+/g," ");
    throw new Error("ENV: SERVICE_ACCOUNT JSON xato. Boshi: " + head);
  }
  if(!serviceAccount.client_email || !serviceAccount.private_key){
    throw new Error("ENV: SERVICE_ACCOUNT maydonlari yetishmaydi (client_email/private_key)");
  }
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
      let payload;
      try{ payload = verifyToken(token); }catch(e){ return json(401, { error:"Token yaroqsiz" }); }
      const loginId = payload.sub;
      const found = await getUser(db, loginId);
      if(!found) return json(401, { error:"User topilmadi" });
      return json(200, { ok:true, user: pickPublic(found.data) });
    }

    // ===== CHANGE PASSWORD =====
    if(path === "/auth/change-password" && method === "POST"){
      const token = getBearer(event);
      if(!token) return json(401, { error:"Token yo‘q" });
      let payload;
      try{ payload = verifyToken(token); }catch(e){ return json(401, { error:"Token yaroqsiz" }); }
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
      let payload;
      try{ payload = verifyToken(token); }catch(e){ return json(401, { error:"Token yaroqsiz" }); }
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


    // ===== Leaderboard (public) =====
    if(path === "leaderboard" && method === "GET"){
      try{
        const snap = await db.collection("foydalanuvchilar")
          .orderBy("points","desc")
          .limit(20)
          .get();
        const items = snap.docs.map(d => pickPublic(d.data()));
        return json(200, { items });
      }catch(e){
        return json(500, { error:"Leaderboard error", message: e.message });
      }
    }

    // ===== Comments =====
    // GET public (latest 30)
    if(path === "comments" && method === "GET"){
      try{
        const snap = await db.collection("comments")
          .orderBy("createdAt","desc")
          .limit(30)
          .get();
        const items = snap.docs.map(d=>{
          const c = d.data() || {};
          const createdAt = c.createdAt && typeof c.createdAt.toMillis === "function"
            ? c.createdAt.toMillis()
            : (c.createdAt || null);
          return {
            loginId: c.loginId || "",
            name: c.name || "",
            text: c.text || "",
            createdAt
          };
        });
        return json(200, { items });
      }catch(e){
        // collection may not exist yet
        return json(200, { items: [] });
      }
    }

    // POST requires JWT (same token as other endpoints)
    if(path === "comments" && method === "POST"){
      const auth = event.headers.authorization || event.headers.Authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if(!token) return json(401, { error:"Token yo‘q" });

      let decoded;
      try{
        decoded = verifyToken(token);
      }catch(e){
        return json(401, { error:"Token noto‘g‘ri" });
      }

      const body = JSON.parse(event.body || "{}");
      const text = String(body.text || "").trim().slice(0, 140);
      if(!text) return json(400, { error:"Izoh bo‘sh" });

      try{
        const userDoc = await db.collection("foydalanuvchilar").doc(decoded.loginId).get();
        const u = userDoc.exists ? userDoc.data() : {};
        await db.collection("comments").add({
          loginId: decoded.loginId,
          name: u?.name || "",
          text,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Comment error", message: e.message });
      }
    }

    return json(404, { error:"Endpoint topilmadi", path, method });
  }catch(e){
    return json(500, { error: e.message || "Server error" });
  }
};

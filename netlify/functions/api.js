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
    avatarId: u.avatarId ?? null,
    profileComplete: !!u.profileComplete,
    points: u.points ?? 0,
    balance: u.balance ?? 0,
    createdAt: u.createdAt || null
  };
}

function toMillis(ts){
  return (ts && typeof ts.toMillis === "function") ? ts.toMillis() : (ts || null);
}

function parseBody(event){
  try{ return JSON.parse(event.body || "{}"); }
  catch(_){ return {}; }
}

// ===== Tests helpers =====
function safeStr(x, max=200){
  const s = String(x ?? "");
  return s.length > max ? s.slice(0,max) : s;
}

function parseMillis(v){
  if(v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if(!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function withinWindow(nowMs, startAt, endAt){
  const s = toMillis(startAt);
  const e = toMillis(endAt);
  if(s && nowMs < s) return { ok:false, reason:"not_started", startAt:s, endAt:e };
  if(e && nowMs > e) return { ok:false, reason:"ended", startAt:s, endAt:e };
  return { ok:true, startAt:s, endAt:e };
}

function sanitizeTestForClient(t){
  // Do NOT send correct answers to client.
  const out = {
    id: t.id || "",
    code: t.code || t.id || "",
    title: t.title || "",
    grade: t.grade || "",
    examType: t.examType || "",
    mode: t.mode || "open",
    access: t.mode === 'challenge' ? 'code' : 'open',
    startAt: toMillis(t.startAt),
    endAt: toMillis(t.endAt),
    durationSec: Number(t.durationSec || 0) || 0,
    questionCount: Array.isArray(t.questions) ? t.questions.length : Number(t.questionCount||0),
    folder: t.folder || (t.code || t.id || ""),
    shuffleQuestions: t.shuffleQuestions !== false,
    shuffleOptions: t.shuffleOptions !== false,
    questions: Array.isArray(t.questions) ? t.questions.map((q, i)=>({
      i,
      type: q.type || 'mcq',
      points: Number(q.points||1) || 1,
      img: safeStr(q.img || q.image || (String(i+1)+'.png'), 120),
      // options for mcq
      options: Array.isArray(q.options) ? q.options.map(o=>safeStr(o, 120)) : [],
    })) : []
  };
  return out;
}

function scoreTest(test, answers){
  const qs = Array.isArray(test.questions) ? test.questions : [];
  const ans = Array.isArray(answers) ? answers : [];
  let score = 0;
  let correct = 0;
  let wrong = 0;
  const detail = [];
  for(let i=0;i<qs.length;i++){
    const q = qs[i] || {};
    const pts = Number(q.points||1) || 1;
    const a = ans[i];
    let ok = false;
    if((q.type||'mcq') === 'open'){
      const list = Array.isArray(q.answers) ? q.answers : [];
      const na = String(a ?? '').trim().toLowerCase().replace(/\s+/g,'');
      ok = list.some(x => String(x ?? '').trim().toLowerCase().replace(/\s+/g,'') === na);
    }else{
      ok = (String(a ?? '') === String(q.correct ?? ''));
    }
    if(ok){ score += pts; correct++; }
    else { wrong++; }
    detail.push({ i, ok, pts });
  }
  return { score, correct, wrong, total: qs.length, detail };
}

async function isAdminUser(db, loginId){
  const envList = String(getEnv("ADMIN_LOGIN_IDS", "")).split(",").map(s=>s.trim()).filter(Boolean);
  if(envList.includes(loginId)) return true;
  // Hard allow by admin email loginId (Google admin flow)
  if(String(loginId).toLowerCase() === 'sohibjonmath@gmail.com') return true;
  try{
    const snap = await db.collection("users").doc(loginId).get();
    if(!snap.exists) return false;
    const u = snap.data() || {};
    return u.role === "admin" || u.isAdmin === true;
  }catch(_){
    return false;
  }
}

// ===== Admin notifications (global tracking for read receipts) =====
// Collection: admin_notifications/{globalId}
// Subcollection: reads/{loginId}
async function recordAdminRead(db, globalId, loginId){
  if(!globalId) return;
  const gref = db.collection("admin_notifications").doc(globalId);
  const rref = gref.collection("reads").doc(loginId);
  // Only write once; don't break if it already exists.
  await db.runTransaction(async (tx)=>{
    const rs = await tx.get(rref);
    if(rs.exists) return;
    tx.set(rref, { loginId, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:false });
    tx.set(gref, { readCount: admin.firestore.FieldValue.increment(1) }, { merge:true });
  });
}

async function deleteSubcollection(db, parentRef, subName, batchSize=400){
  // Deletes docs in parentRef.collection(subName) in batches.
  while(true){
    const snap = await parentRef.collection(subName).limit(batchSize).get();
    if(snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d=>batch.delete(d.ref));
    await batch.commit();
  }
}

async function deleteCommentCascade(db, commentId){
  const commentRef = db.collection("comments").doc(commentId);
  await deleteSubcollection(db, commentRef, "likes", 450);
  await deleteSubcollection(db, commentRef, "replies", 450);
  await commentRef.delete();
}

function requireToken(event){
  const token = getBearer(event);
  if(!token) return { ok:false, error: json(401, { error:"Token yo‘q" }) };
  let payload;
  try{ payload = verifyToken(token); }
  catch(_){ return { ok:false, error: json(401, { error:"Token yaroqsiz" }) }; }
  return { ok:true, loginId: payload.sub, token };
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
      const avatarIdRaw = body.avatarId;
      const avatarId = (avatarIdRaw === undefined || avatarIdRaw === null || avatarIdRaw === "")
        ? undefined
        : Math.max(1, Math.min(999, Number(avatarIdRaw)));
      if(firstName.length < 2) return json(400, { error:"Ism kamida 2 harf" });
      if(lastName.length < 2) return json(400, { error:"Familiya kamida 2 harf" });
      if(!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return json(400, { error:"Tug‘ilgan sana noto‘g‘ri" });

      const found = await getUser(db, loginId);
      if(!found) return json(401, { error:"User topilmadi" });

      const name = (firstName + " " + lastName).trim();
      await found.ref.update({
        firstName, lastName, birthdate, name,
        ...(avatarId ? { avatarId } : {}),
        profileComplete:true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const fresh = (await found.ref.get()).data();
      return json(200, { ok:true, user: pickPublic(fresh) });
    }

    // ===== Set Avatar (token) =====
    if(path === "/auth/set-avatar" && method === "POST"){
      const token = getBearer(event);
      if(!token) return json(401, { error:"Token yo‘q" });
      let payload;
      try{ payload = verifyToken(token); }catch(_){ return json(401, { error:"Token yaroqsiz" }); }
      const loginId = payload.sub;

      const body = parseBody(event);
      const avatarId = Math.max(1, Math.min(999, Number(body.avatarId||0)));
      if(!avatarId) return json(400, { error:"avatarId noto‘g‘ri" });

      const found = await getUser(db, loginId);
      if(!found) return json(401, { error:"User topilmadi" });

      await found.ref.update({
        avatarId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      const fresh = (await found.ref.get()).data();
      return json(200, { ok:true, user: pickPublic(fresh) });
    }


    // ===== Leaderboard (public) =====
    if(path === "/leaderboard" && method === "GET"){
      try{
        const limit = Math.max(1, Math.min(200, Number(event.queryStringParameters?.limit || 20)));
        const cursor = String(event.queryStringParameters?.cursor || "").trim();

        // users are stored in "users" (created by /auth/register)
        let q = db.collection("users").orderBy("points","desc");
        if(cursor){
          try{
            const cdoc = await db.collection("users").doc(cursor).get();
            if(cdoc.exists) q = q.startAfter(cdoc);
          }catch(_){ /* ignore invalid cursor */ }
        }
        const snap = await q.limit(limit).get();
        const items = snap.docs.map(d => pickPublic(d.data()));
        const nextCursor = (snap.size === limit && snap.docs.length) ? snap.docs[snap.docs.length-1].id : null;
        return json(200, { items, nextCursor });
      }catch(e){
        return json(500, { error:"Leaderboard error", message: e.message });
      }
    }

    // ===== Comments =====
    // GET public (latest N, paging with cursor=lastDocId)
    if(path === "/comments" && method === "GET"){
      try{
        const withReplies = String(event.queryStringParameters?.replies || "") === "1";
        const limitReplies = Math.max(0, Math.min(20, Number(event.queryStringParameters?.limitReplies || 3)));
        const limit = Math.max(1, Math.min(100, Number(event.queryStringParameters?.limit || 30)));
        const cursor = String(event.queryStringParameters?.cursor || "").trim();

        let q = db.collection("comments").orderBy("createdAt","desc");
        if(cursor){
          try{
            const cdoc = await db.collection("comments").doc(cursor).get();
            if(cdoc.exists) q = q.startAfter(cdoc);
          }catch(_){ /* ignore invalid cursor */ }
        }

        const snap = await q.limit(limit).get();
        const items = [];
        for(const d of snap.docs){
          const c = d.data() || {};
          const item = {
            id: d.id,
            loginId: c.loginId || "",
            name: c.name || "",
            text: c.text || "",
            createdAt: toMillis(c.createdAt),
            likeCount: Number(c.likeCount || 0),
            replyCount: Number(c.replyCount || 0),
            edited: !!c.edited,
          };
          if(withReplies && limitReplies>0){
            try{
              const rs = await db.collection("comments").doc(d.id)
                .collection("replies")
                .orderBy("createdAt","desc")
                .limit(limitReplies)
                .get();
              item.replies = rs.docs.map(rd=>{
                const r = rd.data() || {};
                return {
                  id: rd.id,
                  loginId: r.loginId || "",
                  name: r.name || "",
                  text: r.text || "",
                  createdAt: toMillis(r.createdAt)
                };
              }).reverse();
            }catch(_){ item.replies = []; }
          }
          items.push(item);
        }
        const nextCursor = (snap.size === limit && snap.docs.length) ? snap.docs[snap.docs.length-1].id : null;
        return json(200, { items, nextCursor });
      }catch(e){
        // collection may not exist yet
        return json(200, { items: [] });
      }
    }

    // POST requires JWT (same token as other endpoints)
    if(path === "/comments" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;

      const body = parseBody(event);
      const text = String(body.text || "").trim().slice(0, 140);
      if(!text) return json(400, { error:"Izoh bo‘sh" });

      try{
        const loginId = auth.loginId;
        const userDoc = await db.collection("users").doc(loginId).get();
        const u = userDoc.exists ? userDoc.data() : {};
        await db.collection("comments").add({
          loginId,
          name: (u && (u.name || u.fullName)) || "",
          text,
          likeCount: 0,
          replyCount: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Comment error", message: e.message });
      }
    }

    // ===== Comment likes =====
    // POST (auth) toggle like: {commentId}
    if(path === "/comments/like" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      const body = parseBody(event);
      const commentId = String(body.commentId || "").trim();
      if(!commentId) return json(400, { error:"commentId kerak" });

      const commentRef = db.collection("comments").doc(commentId);
      const likeRef = commentRef.collection("likes").doc(auth.loginId);

      try{
        const out = await db.runTransaction(async (tx)=>{
          const cs = await tx.get(commentRef);
          if(!cs.exists) throw new Error("Izoh topilmadi");
          const cur = Number(cs.data()?.likeCount || 0);
          const ls = await tx.get(likeRef);
          if(ls.exists){
            tx.delete(likeRef);
            const next = Math.max(0, cur - 1);
            tx.set(commentRef, { likeCount: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
            return { liked:false, likeCount: next };
          }else{
            tx.set(likeRef, {
              loginId: auth.loginId,
              commentId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge:false });
            const next = cur + 1;
            tx.set(commentRef, { likeCount: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
            return { liked:true, likeCount: next };
          }
        });
        return json(200, { ok:true, ...out });
      }catch(e){
        return json(500, { error:"Like error", message: e.message });
      }
    }

    // GET (auth) list liked comment ids
    if(path === "/comments/liked" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      try{
        const snap = await db.collectionGroup("likes")
          .where("loginId","==", auth.loginId)
          .orderBy("createdAt","desc")
          .limit(500)
          .get();
        const ids = [];
        for(const d of snap.docs){
          const v = d.data() || {};
          if(v.commentId) ids.push(String(v.commentId));
        }
        return json(200, { ok:true, ids });
      }catch(e){
        return json(200, { ok:true, ids: [] });
      }
    }

    // ===== Comment replies =====
    // Replies list (public)
    // GET: /comments/replies?commentId=...&limit=20
    // POST: {commentId, limit}
    if(path === "/comments/replies" && (method === "GET" || method === "POST")){
      const body = method === "POST" ? parseBody(event) : {};
      const commentId = String((method === "POST" ? body.commentId : event.queryStringParameters?.commentId) || "").trim();
      const limitRaw = method === "POST" ? body.limit : event.queryStringParameters?.limit;
      const limit = Math.max(1, Math.min(50, Number(limitRaw || 20)));
      if(!commentId) return json(400, { error:"commentId kerak" });
      try{
        const rs = await db.collection("comments").doc(commentId)
          .collection("replies")
          .orderBy("createdAt","asc")
          .limit(limit)
          .get();
        const items = rs.docs.map(rd=>{
          const r = rd.data() || {};
          return {
            id: rd.id,
            loginId: r.loginId || "",
            name: r.name || "",
            text: r.text || "",
            createdAt: toMillis(r.createdAt)
          };
        });
        return json(200, { items });
      }catch(_){
        return json(200, { items: [] });
      }
    }

    // POST (auth) create reply: {commentId,text}
    if(path === "/comments/reply" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      const body = parseBody(event);
      const commentId = String(body.commentId || "").trim();
      const text = String(body.text || "").trim().slice(0, 160);
      if(!commentId) return json(400, { error:"commentId kerak" });
      if(!text) return json(400, { error:"Javob bo‘sh" });

      try{
        const userDoc = await db.collection("users").doc(auth.loginId).get();
        const u = userDoc.exists ? userDoc.data() : {};
        const name = (u && (u.name || u.fullName)) || "";
        const commentRef = db.collection("comments").doc(commentId);
        const repliesRef = commentRef.collection("replies");

        await db.runTransaction(async (tx)=>{
          const cs = await tx.get(commentRef);
          if(!cs.exists) throw new Error("Izoh topilmadi");
          tx.set(repliesRef.doc(), {
            loginId: auth.loginId,
            name,
            text,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge:false });
          const cur = Number(cs.data()?.replyCount || 0);
          tx.set(commentRef, {
            replyCount: cur + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge:true });
        });
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Reply error", message: e.message });
      }
    }

    // ===== Comment update/delete (owner or admin) =====
    if(path === "/comments/update" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      const body = parseBody(event);
      const commentId = String(body.commentId || "").trim();
      const text = String(body.text || "").trim().slice(0, 140);
      if(!commentId) return json(400, { error:"commentId kerak" });
      if(!text) return json(400, { error:"Izoh bo‘sh" });
      try{
        const ref = db.collection("comments").doc(commentId);
        const snap = await ref.get();
        if(!snap.exists) return json(404, { error:"Izoh topilmadi" });
        const c = snap.data() || {};
        const isOwner = String(c.loginId||"") === String(auth.loginId);
        const isAdm = await isAdminUser(db, auth.loginId);
        if(!isOwner && !isAdm) return json(403, { error:"Ruxsat yo‘q" });
        await ref.set({
          text,
          edited: true,
          editedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge:true });
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Update error", message: e.message });
      }
    }    if(path === "/auth/google" && method === "POST"){
      const body = parseBody(event);
      const idToken = String(body.idToken || "");
      if(!idToken) return json(400, { error:"idToken kerak" });
      try{
        const decoded = await admin.auth().verifyIdToken(idToken);
        const email = String(decoded.email || "").toLowerCase();
        if(email !== "sohibjonmath@gmail.com"){
          return json(403, { error:"Admin email mos emas" });
        }
        const token = signToken({
          loginId: email,
          name: decoded.name || "Sohibjon",
          role: "admin",
          provider: "google",
          uid: decoded.uid || ""
        });
        return json(200, { token, loginId: email, name: decoded.name || "Sohibjon", role:"admin" });
      }catch(e){
        return json(401, { error:"Google token noto‘g‘ri", message: e.message });
      }
    }

    if(path === "/comments/delete" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      const body = parseBody(event);
      const commentId = String(body.commentId || "").trim();
      if(!commentId) return json(400, { error:"commentId kerak" });
      try{
        const ref = db.collection("comments").doc(commentId);
        const snap = await ref.get();
        if(!snap.exists) return json(404, { error:"Izoh topilmadi" });
        const c = snap.data() || {};
        const isOwner = String(c.loginId||"") === String(auth.loginId);
        const isAdm = await isAdminUser(db, auth.loginId);
        if(!isOwner && !isAdm) return json(403, { error:"Ruxsat yo‘q" });
        await deleteCommentCascade(db, commentId);
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Delete error", message: e.message });
      }
    }

    // ===== Notifications (per-user inbox) =====
    if(path === "/notifications" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      try{
        const limit = Math.max(1, Math.min(50, Number(event.queryStringParameters?.limit || 20)));
        const cursor = String(event.queryStringParameters?.cursor || "").trim();
        const col = db.collection("users").doc(auth.loginId).collection("notifications");
        let q = col.orderBy("createdAt","desc");
        if(cursor){
          try{
            const cdoc = await col.doc(cursor).get();
            if(cdoc.exists) q = q.startAfter(cdoc);
          }catch(_){ }
        }
        const snap = await q.limit(limit).get();
        const items = snap.docs.map(d=>{
          const n = d.data() || {};
          return {
            id: d.id,
            title: n.title || "",
            body: n.body || "",
            type: n.type || "info",
            read: !!n.read,
            createdAt: toMillis(n.createdAt)
          };
        });
        const nextCursor = (snap.size === limit && snap.docs.length) ? snap.docs[snap.docs.length-1].id : null;
        // lightweight unread count (cap 2000)
        const unreadSnap = await col.where("read","==", false).limit(2000).get();
        const unreadCount = unreadSnap.size;
        return json(200, { items, nextCursor, unreadCount });
      }catch(e){
        return json(500, { error:"Notifications error", message: e.message });
      }
    }

    if(path === "/notifications/unread-count" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      try{
        const col = db.collection("users").doc(auth.loginId).collection("notifications");
        const unreadSnap = await col.where("read","==", false).limit(2000).get();
        return json(200, { ok:true, unreadCount: unreadSnap.size });
      }catch(_){
        return json(200, { ok:true, unreadCount: 0 });
      }
    }

    if(path === "/notifications/read" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      const body = parseBody(event);
      const id = String(body.id || "").trim();
      const all = body.all === true;
      const col = db.collection("users").doc(auth.loginId).collection("notifications");
      try{
        if(all){
          // mark up to 2000 unread as read
          while(true){
            const snap = await col.where("read","==", false).limit(450).get();
            if(snap.empty) break;
            const batch = db.batch();
            snap.docs.forEach(d=>{
              const n = d.data() || {};
              batch.set(d.ref, { read:true, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
              // If this notification was sent by admin (has globalId), record read receipt (best-effort).
              if(n.globalId){
                const gref = db.collection("admin_notifications").doc(String(n.globalId));
                const rref = gref.collection("reads").doc(auth.loginId);
                batch.set(rref, { loginId: auth.loginId, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
                batch.set(gref, { readCount: admin.firestore.FieldValue.increment(1) }, { merge:true });
              }
            });
            await batch.commit();
          }
          return json(200, { ok:true });
        }
        if(!id) return json(400, { error:"id kerak" });
        // transaction to avoid double-count on read receipts
        await db.runTransaction(async (tx)=>{
          const nref = col.doc(id);
          const ns = await tx.get(nref);
          if(!ns.exists) return;
          const n = ns.data() || {};
          if(n.read === true) return;
          tx.set(nref, { read:true, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
          const gid = n.globalId ? String(n.globalId) : "";
          if(gid){
            const gref = db.collection("admin_notifications").doc(gid);
            const rref = gref.collection("reads").doc(auth.loginId);
            const rs = await tx.get(rref);
            if(!rs.exists){
              tx.set(rref, { loginId: auth.loginId, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:false });
              tx.set(gref, { readCount: admin.firestore.FieldValue.increment(1) }, { merge:true });
            }
          }
        });
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Read error", message: e.message });
      }
    }

    if(path === "/notifications/delete" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      const body = parseBody(event);
      const id = String(body.id || "").trim();
      if(!id) return json(400, { error:"id kerak" });
      try{
        await db.collection("users").doc(auth.loginId).collection("notifications").doc(id).delete();
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Delete notif error", message: e.message });
      }
    }

    // ===== Admin (users / comments / notifications) =====
    if(path === "/admin/me" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      const ok = await isAdminUser(db, auth.loginId);
      if(!ok) return json(403, { error:"Admin emas" });
      return json(200, { ok:true, loginId: auth.loginId });
    }

    if(path === "/admin/users" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      if(!(await isAdminUser(db, auth.loginId))) return json(403, { error:"Admin emas" });
      try{
        const limit = Math.max(1, Math.min(100, Number(event.queryStringParameters?.limit || 40)));
        const cursor = String(event.queryStringParameters?.cursor || "").trim();
        const qstr = String(event.queryStringParameters?.q || "").trim();
        if(qstr && /^LM-\d{6}$/.test(qstr)){
          const s = await db.collection("users").doc(qstr).get();
          if(!s.exists) return json(200, { items: [], nextCursor: null });
          return json(200, { items: [pickPublic(s.data())], nextCursor: null });
        }
        let q = db.collection("users").orderBy("createdAt","desc");
        if(cursor){
          try{
            const cdoc = await db.collection("users").doc(cursor).get();
            if(cdoc.exists) q = q.startAfter(cdoc);
          }catch(_){ }
        }
        const snap = await q.limit(limit).get();
        const items = snap.docs.map(d=>pickPublic(d.data()));
        const nextCursor = (snap.size === limit && snap.docs.length) ? snap.docs[snap.docs.length-1].id : null;
        // client-side filter by name if q provided
        const out = qstr ? items.filter(u=>String(u.name||"").toLowerCase().includes(qstr.toLowerCase()) || String(u.loginId||"").includes(qstr)) : items;
        return json(200, { items: out, nextCursor });
      }catch(e){
        return json(500, { error:"Users error", message: e.message });
      }
    }

    if(path === "/admin/comments" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      if(!(await isAdminUser(db, auth.loginId))) return json(403, { error:"Admin emas" });
      try{
        const limit = Math.max(1, Math.min(100, Number(event.queryStringParameters?.limit || 50)));
        const cursor = String(event.queryStringParameters?.cursor || "").trim();
        let q = db.collection("comments").orderBy("createdAt","desc");
        if(cursor){
          try{
            const cdoc = await db.collection("comments").doc(cursor).get();
            if(cdoc.exists) q = q.startAfter(cdoc);
          }catch(_){ }
        }
        const snap = await q.limit(limit).get();
        const items = snap.docs.map(d=>{
          const c = d.data() || {};
          return {
            id: d.id,
            loginId: c.loginId || "",
            name: c.name || "",
            text: c.text || "",
            likeCount: Number(c.likeCount||0),
            replyCount: Number(c.replyCount||0),
            createdAt: toMillis(c.createdAt),
            edited: !!c.edited,
          };
        });
        const nextCursor = (snap.size === limit && snap.docs.length) ? snap.docs[snap.docs.length-1].id : null;
        return json(200, { items, nextCursor });
      }catch(e){
        return json(500, { error:"Admin comments error", message: e.message });
      }
    }

    if(path === "/admin/comments/delete" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      if(!(await isAdminUser(db, auth.loginId))) return json(403, { error:"Admin emas" });
      const body = parseBody(event);
      const commentId = String(body.commentId || "").trim();
      if(!commentId) return json(400, { error:"commentId kerak" });
      try{
        await deleteCommentCascade(db, commentId);
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Admin delete error", message: e.message });
      }
    }

    if(path === "/admin/notify" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      if(!(await isAdminUser(db, auth.loginId))) return json(403, { error:"Admin emas" });
      const body = parseBody(event);
      const audience = String(body.audience || "all");
      const title = String(body.title || "").trim().slice(0, 60);
      const msg = String(body.body || "").trim().slice(0, 240);
      const loginId = String(body.loginId || "").trim();
      const loginIds = Array.isArray(body.loginIds) ? body.loginIds.map(x=>String(x||"").trim()).filter(Boolean) : [];
      if(!title || !msg) return json(400, { error:"Sarlavha va matn kerak" });

      // Create global notification for tracking (read receipts, history)
      const globalRef = db.collection("admin_notifications").doc();
      const globalId = globalRef.id;
      const notif = {
        title,
        body: msg,
        type: String(body.type || "info"),
        read: false,
        globalId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.loginId,
      };

      const globalDoc = {
        id: globalId,
        title,
        body: msg,
        type: String(body.type || "info"),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.loginId,
        audience,
        targetCount: 0,
        readCount: 0,
      };

      async function writeToUsers(ids){
        let wrote = 0;
        for(let i=0;i<ids.length;i+=450){
          const part = ids.slice(i,i+450);
          const batch = db.batch();
          part.forEach(uid=>{
            const ref = db.collection("users").doc(uid).collection("notifications").doc();
            batch.set(ref, notif, { merge:false });
          });
          await batch.commit();
          wrote += part.length;
        }
        return wrote;
      }

      try{
        let targets = [];
        if(audience === "single"){
          if(!loginId) return json(400, { error:"loginId kerak" });
          targets = [loginId];
        }else if(audience === "selected"){
          if(!loginIds.length) return json(400, { error:"loginIds kerak" });
          targets = loginIds;
        }else{
          // all users (iterate)
          let cursor = null;
          while(true){
            let q = db.collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(450);
            if(cursor) q = q.startAfter(cursor);
            const snap = await q.get();
            if(snap.empty) break;
            const ids = snap.docs.map(d=>d.id);
            await writeToUsers(ids);
            cursor = snap.docs[snap.docs.length-1];
          }
          await globalRef.set({ ...globalDoc, audience:"all" }, { merge:true });
          // targetCount for all: approximate with a count query (best effort)
          try{
            const cs = await db.collection("users").count().get();
            await globalRef.set({ targetCount: cs.data().count || 0 }, { merge:true });
          }catch(_){ }
          return json(200, { ok:true, audience:"all", globalId });
        }
        const wrote = await writeToUsers(targets);
        await globalRef.set({ ...globalDoc, targetCount: wrote }, { merge:true });
        return json(200, { ok:true, wrote, audience, globalId });
      }catch(e){
        return json(500, { error:"Notify error", message: e.message });
      }
    }

    if(path === "/admin/notifications/sent" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      if(!(await isAdminUser(db, auth.loginId))) return json(403, { error:"Admin emas" });
      try{
        const limit = Math.max(1, Math.min(100, Number(event.queryStringParameters?.limit || 30)));
        const cursor = String(event.queryStringParameters?.cursor || "").trim();
        const col = db.collection("admin_notifications");
        let q = col.orderBy("createdAt","desc");
        if(cursor){
          try{
            const cdoc = await col.doc(cursor).get();
            if(cdoc.exists) q = q.startAfter(cdoc);
          }catch(_){ }
        }
        const snap = await q.limit(limit).get();
        const items = snap.docs.map(d=>{
          const n = d.data() || {};
          return {
            id: d.id,
            title: n.title || "",
            body: n.body || "",
            type: n.type || "info",
            audience: n.audience || "",
            targetCount: Number(n.targetCount||0),
            readCount: Number(n.readCount||0),
            createdAt: toMillis(n.createdAt),
            createdBy: n.createdBy || "",
          };
        });
        const nextCursor = (snap.size === limit && snap.docs.length) ? snap.docs[snap.docs.length-1].id : null;
        return json(200, { items, nextCursor });
      }catch(e){
        return json(500, { error:"Sent notifs error", message: e.message });
      }
    }

    if(path === "/admin/notifications/reads" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      if(!(await isAdminUser(db, auth.loginId))) return json(403, { error:"Admin emas" });
      try{
        const globalId = String(event.queryStringParameters?.globalId || "").trim();
        if(!globalId) return json(400, { error:"globalId kerak" });
        const limit = Math.max(1, Math.min(200, Number(event.queryStringParameters?.limit || 100)));
        const snap = await db.collection("admin_notifications").doc(globalId).collection("reads")
          .orderBy("readAt","desc").limit(limit).get();
        const items = snap.docs.map(d=>{
          const r = d.data() || {};
          return { loginId: r.loginId || d.id, readAt: toMillis(r.readAt) };
        });
        return json(200, { items });
      }catch(e){
        return json(500, { error:"Reads error", message: e.message });
      }
    }

    // =====================
    // TESTS / CHALLENGES API
    // Collection: tests/{id}
    // Submissions: tests/{id}/submissions/{loginId}
    // =====================

    if(path === "/tests/list" && method === "GET"){
      try{
        const mode = String(event.queryStringParameters?.mode || "").trim(); // open|challenge|all
        const grade = String(event.queryStringParameters?.grade || "").trim();
        const examType = String(event.queryStringParameters?.examType || "").trim();
        const limit = Math.max(1, Math.min(100, Number(event.queryStringParameters?.limit || 30)));

        let q = db.collection("tests").orderBy("updatedAt","desc");
        if(mode && mode !== "all") q = q.where("mode","==", mode);
        if(grade) q = q.where("grade","==", grade);
        if(examType) q = q.where("examType","==", examType);
        const snap = await q.limit(limit).get();

        const now = Date.now();
        const items = snap.docs.map(d=>{
          const t = d.data() || {};
          const w = withinWindow(now, t.startAt, t.endAt);
          return {
            id: d.id,
            code: t.code || d.id,
            title: t.title || "",
            grade: t.grade || "",
            examType: t.examType || "",
            mode: t.mode || "open",
            folder: t.folder || (t.code || d.id),
            questionCount: Array.isArray(t.questions) ? t.questions.length : Number(t.questionCount||0),
            durationSec: Number(t.durationSec||0) || 0,
            startAt: w.startAt,
            endAt: w.endAt,
            status: (t.mode === 'challenge') ? (w.ok ? 'active' : w.reason) : 'open'
          };
        });
        return json(200, { items });
      }catch(e){
        return json(500, { error:"Tests list error", message: e.message });
      }
    }

    if(path === "/tests/get" && method === "GET"){
      try{
        const id = String(event.queryStringParameters?.id || "").trim();
        if(!id) return json(400, { error:"id kerak" });
        const code = String(event.queryStringParameters?.code || "").trim();

        const ref = db.collection("tests").doc(id);
        const snap = await ref.get();
        if(!snap.exists) return json(404, { error:"Test topilmadi" });
        const t = { id: snap.id, ...(snap.data()||{}) };

        if(String(t.mode||'open') === 'challenge'){
          const w = withinWindow(Date.now(), t.startAt, t.endAt);
          if(!w.ok) return json(403, { error: w.reason === 'not_started' ? "Challenge hali boshlanmagan" : "Challenge yakunlangan", startAt:w.startAt, endAt:w.endAt });
          if(!code || String(code) !== String(t.accessCode||"")) return json(403, { error:"Kirish kodi noto‘g‘ri" });
        }

        return json(200, { test: sanitizeTestForClient(t) });
      }catch(e){
        return json(500, { error:"Tests get error", message: e.message });
      }
    }

    if(path === "/tests/submit" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      try{
        const body = parseBody(event);
        const id = String(body.id || "").trim();
        const answers = Array.isArray(body.answers) ? body.answers : [];
        const timeSpentSec = Math.max(0, Math.min(24*3600, Number(body.timeSpentSec||0) || 0));
        if(!id) return json(400, { error:"id kerak" });

        const ref = db.collection("tests").doc(id);
        const snap = await ref.get();
        if(!snap.exists) return json(404, { error:"Test topilmadi" });
        const t = { id: snap.id, ...(snap.data()||{}) };

        // window check for challenge
        if(String(t.mode||'open') === 'challenge'){
          const w = withinWindow(Date.now(), t.startAt, t.endAt);
          if(!w.ok) return json(403, { error: w.reason === 'not_started' ? "Challenge hali boshlanmagan" : "Challenge yakunlangan" });
        }

        const res = scoreTest(t, answers);
        const subRef = ref.collection('submissions').doc(auth.loginId);

        await db.runTransaction(async (tx)=>{
          const prev = await tx.get(subRef);
          if(prev.exists) throw new Error("Siz bu testni avval topshirgansiz");
          tx.set(subRef, {
            loginId: auth.loginId,
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            score: res.score,
            correct: res.correct,
            wrong: res.wrong,
            total: res.total,
            timeSpentSec,
            answers
          }, { merge:false });

          // points only for challenge
          if(String(t.mode||'open') === 'challenge'){
            const uref = db.collection('users').doc(auth.loginId);
            tx.set(uref, { points: admin.firestore.FieldValue.increment(res.score) }, { merge:true });
          }
        });

        return json(200, { ok:true, result: { score: res.score, correct: res.correct, wrong: res.wrong, total: res.total } });
      }catch(e){
        const msg = e.message || "Submit error";
        return json(400, { error: msg });
      }
    }

    if(path === "/admin/tests/upsert" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      if(!(await isAdminUser(db, auth.loginId))) return json(403, { error:"Admin emas" });
      try{
        const body = parseBody(event);
        const t = body.test || body;
        const id = safeStr(t.id || t.code || "", 80).replace(/\s+/g,'').trim();
        if(!id) return json(400, { error:"test.id yoki test.code kerak" });

        // minimal validation
        const testDoc = {
          code: safeStr(t.code || id, 80),
          title: safeStr(t.title || "", 140),
          grade: safeStr(t.grade || "", 40),
          examType: safeStr(t.examType || "", 40),
          mode: (t.mode === 'challenge') ? 'challenge' : 'open',
          folder: safeStr(t.folder || (t.code || id), 120),
          accessCode: safeStr(t.accessCode || "", 80),
          durationSec: Number(t.durationSec||0) || 0,
          shuffleQuestions: t.shuffleQuestions !== false,
          shuffleOptions: t.shuffleOptions !== false,
          startAt: t.startAtMs ? admin.firestore.Timestamp.fromMillis(parseMillis(t.startAtMs)) : (t.startAt ? t.startAt : null),
          endAt: t.endAtMs ? admin.firestore.Timestamp.fromMillis(parseMillis(t.endAtMs)) : (t.endAt ? t.endAt : null),
          prizes: (t.prizes && typeof t.prizes === 'object') ? t.prizes : null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: auth.loginId,
        };
        if(!t.createdAt) testDoc.createdAt = admin.firestore.FieldValue.serverTimestamp();

        const qs = Array.isArray(t.questions) ? t.questions : [];
        testDoc.questions = qs.map((q,i)=>({
          type: (q.type === 'open') ? 'open' : 'mcq',
          points: Number(q.points||1) || 1,
          img: safeStr(q.img || q.image || (String(i+1)+'.png'), 120),
          options: Array.isArray(q.options) ? q.options.map(o=>safeStr(o,120)) : [],
          correct: safeStr(q.correct || "", 120),
          answers: Array.isArray(q.answers) ? q.answers.map(a=>safeStr(a,120)) : []
        }));
        testDoc.questionCount = testDoc.questions.length;

        await db.collection('tests').doc(id).set(testDoc, { merge:true });
        return json(200, { ok:true, id });
      }catch(e){
        return json(500, { error:"Upsert error", message: e.message });
      }
    }

    
    // ==================== GAMES: SUBMIT (user-only + points delta) ====================
    // Writes ONLY into: users/{loginId}.games.{gameId} and users/{loginId}.points
    // Does NOT write any global "games" collection.
        // ==================== GAMES: SUBMIT (user-only + points delta) ====================
    // Writes ONLY into: users/{loginId}.games.{gameId} and users/{loginId}.points
    // Does NOT write any global "games" collection.
    // ✅ Idempotent: for test_* gameIds, pointsDelta is applied only once per user per gameId.
    if(path === "/games/submit" && method === "POST"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;

      try{
        const body = parseBody(event);
        const gameId = String(body.gameId || "").trim() || "game001";
        const xp = Math.max(0, Math.floor(Number(body.xp || 0) || 0));
        const pointsDeltaIn = Math.max(0, Math.floor(Number(body.pointsDelta || 0) || 0));
        const ts = Date.now();

        const userRef = db.collection("users").doc(auth.loginId);

        // ✅ Rule: only "test_*" should be one-time points (open tests)
        const isOnce = gameId.startsWith("test_");

        let appliedDelta = 0;
        let alreadyApplied = false;

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(userRef);
          const data = snap.exists ? (snap.data() || {}) : {};

          const games = (data.games && typeof data.games === "object") ? data.games : {};
          const g = (games && games[gameId]) ? (games[gameId] || {}) : {};

          const prevBest = Math.max(0, Math.floor(Number(g.bestXp || 0) || 0));
          const bestXp = Math.max(prevBest, xp);

          // ✅ idempotency check
          const prevOnce = !!g.pointsOnceApplied;

          if(pointsDeltaIn > 0){
            if(isOnce){
              if(prevOnce){
                appliedDelta = 0;
                alreadyApplied = true;
              }else{
                appliedDelta = pointsDeltaIn;
                alreadyApplied = false;
              }
            }else{
              // non-test games: always apply
              appliedDelta = pointsDeltaIn;
              alreadyApplied = false;
            }
          }

          const updates = {
            games: {
              [gameId]: {
                bestXp,
                lastXp: xp,
                lastPlayedAt: ts,
                plays: admin.firestore.FieldValue.increment(1),

                ...(isOnce && appliedDelta > 0
                  ? { pointsOnceApplied: true, pointsOnceAppliedAt: ts }
                  : {})
              }
            }
          };

          tx.set(userRef, updates, { merge:true });

          if(appliedDelta > 0){
            tx.set(userRef, { points: admin.firestore.FieldValue.increment(appliedDelta) }, { merge:true });
          }
        });

        return json(200, {
          ok:true,
          gameId,
          xp,
          pointsDeltaRequested: pointsDeltaIn,
          pointsDeltaApplied: appliedDelta,
          alreadyApplied
        });
      }catch(e){
        return json(400, { error: e.message || "Submit game error" });
      }
    }



    // ==================== GAMES: LEADERBOARD (bestXp from users/{uid}.games.{gameId}.bestXp) ====================
    if(path === "/games/leaderboard" && method === "GET"){
      const auth = requireToken(event);
      if(!auth.ok) return auth.error;
      try{
        const gameId = String(event.queryStringParameters?.gameId || "game001").trim() || "game001";
        const limitRaw = Number(event.queryStringParameters?.limit || 20) || 20;
        const limit = Math.max(1, Math.min(100, Math.floor(limitRaw)));

        const field = `games.${gameId}.bestXp`;
        const snap = await db.collection("users")
          .orderBy(field, "desc")
          .limit(limit)
          .get();

        const rows = [];
        snap.forEach(doc => {
          const d = doc.data() || {};
          const g = (d.games && d.games[gameId]) ? d.games[gameId] : {};
          rows.push({
            loginId: doc.id,
            name: d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim(),
            firstName: d.firstName || "",
            lastName: d.lastName || "",
            numericId: d.numericId || null,
            bestXp: Number(g.bestXp || 0) || 0,
            points: Number(d.points || 0) || 0,
          });
        });

        // ensure sort by bestXp desc (in case missing fields behave oddly)
        rows.sort((a,b)=> (b.bestXp||0)-(a.bestXp||0));

        return json(200, { ok:true, gameId, limit, rows });
      }catch(e){
        return json(400, { error: e.message || "Leaderboard error" });
      }
    }


return json(404, { error:"Endpoint topilmadi", path, method });
  }catch(e){
    return json(500, { error: e.message || "Server error" });
  }
};
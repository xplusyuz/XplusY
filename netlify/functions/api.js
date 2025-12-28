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

function toMillis(ts){
  return (ts && typeof ts.toMillis === "function") ? ts.toMillis() : (ts || null);
}

function parseBody(event){
  try{ return JSON.parse(event.body || "{}"); }
  catch(_){ return {}; }
}

async function isAdminUser(db, loginId){
  const envList = String(getEnv("ADMIN_LOGIN_IDS", "")).split(",").map(s=>s.trim()).filter(Boolean);
  if(envList.includes(loginId)) return true;
  try{
    const snap = await db.collection("users").doc(loginId).get();
    if(!snap.exists) return false;
    const u = snap.data() || {};
    return u.role === "admin" || u.isAdmin === true;
  }catch(_){
    return false;
  }
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
            snap.docs.forEach(d=>batch.set(d.ref, { read:true, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true }));
            await batch.commit();
          }
          return json(200, { ok:true });
        }
        if(!id) return json(400, { error:"id kerak" });
        await col.doc(id).set({ read:true, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge:true });
        return json(200, { ok:true });
      }catch(e){
        return json(500, { error:"Read error", message: e.message });
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

      const notif = {
        title,
        body: msg,
        type: String(body.type || "info"),
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.loginId,
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
          return json(200, { ok:true, audience:"all" });
        }
        const wrote = await writeToUsers(targets);
        return json(200, { ok:true, wrote, audience });
      }catch(e){
        return json(500, { error:"Notify error", message: e.message });
      }
    }

    return json(404, { error:"Endpoint topilmadi", path, method });
  }catch(e){
    return json(500, { error: e.message || "Server error" });
  }
};

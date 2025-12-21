// netlify/functions/api.js
const admin = require('firebase-admin');
const crypto = require('crypto');

function env(name, required=true){
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) throw new Error(`Missing env: ${name}`);
  return v;
}

function initAdmin(){
  if (admin.apps.length) return;

  // FIREBASE_KEY ichida BUTUN service account JSON bor
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

function db(){ initAdmin(); return admin.firestore(); }

function json(statusCode, body){
  return {
    statusCode,
    headers: {
      'Content-Type':'application/json; charset=utf-8',
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Session-Id, X-Admin-Token',
      'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'
    },
    body: JSON.stringify(body)
  };
}
const ok = (b)=>json(200,b);
const bad = (msg, code=400)=>json(code,{error:msg});

function pathOf(event){
  return (event.path||'').replace(/^\/\.netlify\/functions\/api/, '') || '/';
}

function randomPassword(len=10){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#%';
  let out='';
  for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function pbkdf2Hash(password, salt=null){
  const _salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, _salt, 120000, 32, 'sha256').toString('hex');
  return {salt:_salt, hash};
}
function verify(password, salt, hash){
  const test = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(test,'hex'), Buffer.from(hash,'hex'));
}

function getSid(event){
  const h = event.headers||{};
  const sid = (h['x-session-id']||h['X-Session-Id']||'').trim();
  const auth = (h['authorization']||h['Authorization']||'').trim();
  if (sid) return sid;
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

function safeUser(d){
  return {
    id: d.id,
    loginId: d.loginId,
    firstName: d.firstName||'',
    lastName: d.lastName||'',
    phone: d.phone||'',
    telegram: d.telegram||'',
    region: d.region||'',
    district: d.district||'',
    role: d.role||'user',
    avatar: d.avatar||'',
    points: d.points||0,
    balance: d.balance||0
  };
}

async function nextLoginId(fire){
  const ref = fire.collection('meta').doc('counters');
  const out = await fire.runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data().loginIdSeq||100000) : 100000;
    const next = cur + 1;
    tx.set(ref, { loginIdSeq: next }, { merge:true });
    return next;
  });
  return String(out).padStart(6,'0').slice(-6);
}

async function createSession(fire, userId){
  const sid = crypto.randomUUID();
  const days = parseInt(process.env.SESSION_DAYS||'30',10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days*24*60*60*1000);
  await fire.collection('sessions').doc(sid).set({
    sid, userId,
    createdAt: admin.firestore.Timestamp.fromDate(now),
    lastSeenAt: admin.firestore.Timestamp.fromDate(now),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
  });
  return {sid, expiresAt};
}

async function requireSession(fire, event){
  const sid = getSid(event);
  if (!sid) return {ok:false, error:'Session kerak. Qayta kiring.'};
  const sref = fire.collection('sessions').doc(sid);
  const ss = await sref.get();
  if (!ss.exists) return {ok:false, error:'Session topilmadi. Qayta kiring.'};
  const sd = ss.data();
  const exp = sd.expiresAt?.toDate ? sd.expiresAt.toDate() : null;
  if (exp && exp < new Date()) return {ok:false, error:'Session tugagan. Qayta kiring.'};
  await sref.set({ lastSeenAt: admin.firestore.FieldValue.serverTimestamp() }, {merge:true});
  const udoc = await fire.collection('users').doc(sd.userId).get();
  if (!udoc.exists) return {ok:false, error:'Foydalanuvchi topilmadi'};
  return {ok:true, sid, user: udoc.data()};
}

const DEFAULT_HOME = {
  navItems: [
    {page:'home',label:'Home',icon:'fa-solid fa-house'},
    {page:'ranking',label:'Reyting',icon:'fa-solid fa-ranking-star'},
    {page:'profile',label:'Profil',icon:'fa-solid fa-user'}
  ],
  banners: [
    { mode:'html', sandbox:'allow-scripts allow-forms', contentHtml:'<html><body style="margin:0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#2E8B57,#22c55e);color:#061013"><div style="text-align:center"><div style="font-size:20px;font-weight:900">LeaderMath</div><div style="opacity:.85">Firebase rulesiz — API-only</div></div></body></html>' }
  ],
  cards: [
    { title:'Testlar', description:'Test yechish bo\'limi (keyin ulanadi)', icon:'fa-solid fa-pen-to-square', href:'' },
    { title:'Kurslar', description:'Video + materiallar (keyin)', icon:'fa-solid fa-graduation-cap', href:'' },
    { title:'Simulator', description:'Trenajorlar (keyin)', icon:'fa-solid fa-calculator', href:'' }
  ],
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
};

exports.handler = async (event) => {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return ok({ok:true});

  try{
    const fire = db();
    const p = pathOf(event);

    if (p === '/' && method === 'GET') return ok({ok:true, name:'LeaderMath Firebase API', time: new Date().toISOString()});

    if (p === '/auth/register' && method === 'POST'){
      const loginId = await nextLoginId(fire);
      const password = randomPassword(10);
      const {salt, hash} = pbkdf2Hash(password);
      const now = admin.firestore.FieldValue.serverTimestamp();

      const mapRef = fire.collection('login_map').doc(loginId);
      const mapSnap = await mapRef.get();
      if (mapSnap.exists) return bad('ID to\'qnashuvi. Qayta urinib ko\'ring.', 409);

      const userId = crypto.randomUUID();
      const userDoc = { id:userId, loginId, salt, hash, role:'user', firstName:'', lastName:'', phone:'', telegram:'', region:'', district:'', avatar:'', points:0, balance:0, createdAt: now, updatedAt: now };

      const batch = fire.batch();
      batch.set(fire.collection('users').doc(userId), userDoc);
      batch.set(mapRef, { userId, loginId, createdAt: now });
      await batch.commit();

      const sess = await createSession(fire, userId);
      return ok({ loginId, password, sessionId: sess.sid, user: safeUser(userDoc) });
    }

    if (p === '/auth/login' && method === 'POST'){
      const body = event.body ? JSON.parse(event.body) : {};
      const id = String(body.id||'').trim();
      const password = String(body.password||'').trim();
      if (id.length !== 6) return bad('ID 6 xonali bo\'lsin', 400);
      if (!password) return bad('Parol kerak', 400);

      const map = await fire.collection('login_map').doc(id).get();
      if (!map.exists) return bad('Bunday ID topilmadi', 404);
      const userId = map.data().userId;

      const udoc = await fire.collection('users').doc(userId).get();
      if (!udoc.exists) return bad('Foydalanuvchi topilmadi', 404);
      const u = udoc.data();

      if (!verify(password, u.salt, u.hash)) return bad('Parol noto\'g\'ri', 401);

      const sess = await createSession(fire, userId);
      return ok({ sessionId: sess.sid, user: safeUser(u) });
    }

    if (p === '/auth/me' && method === 'GET'){
      const a = await requireSession(fire, event);
      if (!a.ok) return bad(a.error, 401);
      return ok({ user: safeUser(a.user) });
    }

    if (p === '/auth/logout' && method === 'POST'){
      const sid = getSid(event);
      if (sid) await fire.collection('sessions').doc(sid).delete().catch(()=>{});
      return ok({ok:true});
    }

    if (p === '/auth/password' && method === 'POST'){
      const a = await requireSession(fire, event);
      if (!a.ok) return bad(a.error, 401);
      const body = event.body ? JSON.parse(event.body) : {};
      const currentPassword = String(body.currentPassword||'').trim();
      const newPassword = String(body.newPassword||'').trim();
      if (newPassword.length < 6) return bad('Yangi parol kamida 6 belgi', 400);
      if (!verify(currentPassword, a.user.salt, a.user.hash)) return bad('Joriy parol noto\'g\'ri', 401);
      const {salt, hash} = pbkdf2Hash(newPassword);
      await fire.collection('users').doc(a.user.id).set({ salt, hash, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, {merge:true});
      return ok({ok:true});
    }

    if (p === '/user/me' && (method==='GET' || method==='PATCH')){
      const a = await requireSession(fire, event);
      if (!a.ok) return bad(a.error, 401);
      if (method==='GET') return ok({ user: safeUser(a.user) });
      const patch = event.body ? JSON.parse(event.body) : {};
      const allow = ['firstName','lastName','phone','telegram','region','district'];
      const clean = {};
      for (const k of allow) if (k in patch) clean[k] = String(patch[k]||'').trim();
      clean.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await fire.collection('users').doc(a.user.id).set(clean, {merge:true});
      const u2 = (await fire.collection('users').doc(a.user.id).get()).data();
      return ok({ user: safeUser(u2) });
    }

    if (p === '/user/me/avatar' && method === 'POST'){
      const a = await requireSession(fire, event);
      if (!a.ok) return bad(a.error, 401);
      const body = event.body ? JSON.parse(event.body) : {};
      const avatar = String(body.avatar||'').trim();
      if (!avatar.startsWith('data:image/')) return bad('Avatar base64 data:image/... bo\'lsin', 400);
      if (avatar.length > 350000) return bad('Avatar juda katta (max ~350KB base64)', 413);
      await fire.collection('users').doc(a.user.id).set({ avatar, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, {merge:true});
      const u2 = (await fire.collection('users').doc(a.user.id).get()).data();
      return ok({ user: safeUser(u2) });
    }

    if (p === '/content/home' && method === 'GET'){
      const ref = fire.collection('content').doc('home');
      const snap = await ref.get();
      if (!snap.exists){
        await ref.set(DEFAULT_HOME, {merge:true});
        const d = (await ref.get()).data();
        return ok({ navItems:d.navItems||[], banners:d.banners||[], cards:d.cards||[] });
      }
      const d = snap.data();
      return ok({ navItems:d.navItems||[], banners:d.banners||[], cards:d.cards||[] });
    }

    if (p === '/ranking' && method === 'GET'){
      const qs = await fire.collection('users').orderBy('points','desc').limit(100).get();
      const users = qs.docs.map(doc=>{
        const u = doc.data();
        return { id:u.id, loginId:u.loginId, firstName:u.firstName||'', lastName:u.lastName||'', region:u.region||'', district:u.district||'', avatar:u.avatar||'', points:u.points||0 };
      });
      return ok({ users });
    }

    if (p === '/admin/content/home' && method === 'POST'){
      const a = await requireSession(fire, event);
      if (!a.ok) return bad(a.error, 401);
      const h = event.headers||{};
      const tok = (h['x-admin-token']||h['X-Admin-Token']||'').trim();
      const ADMIN_TOKEN = (process.env.ADMIN_TOKEN||'').trim();
      const role = String(a.user.role||'user').toLowerCase();
      const isAdmin = (role==='admin' || role==='superadmin') || (ADMIN_TOKEN && tok===ADMIN_TOKEN);
      if (!isAdmin) return bad('Admin ruxsati yo\'q (role=admin yoki X-Admin-Token)', 403);

      const body = event.body ? JSON.parse(event.body) : {};
      const navItems = Array.isArray(body.navItems) ? body.navItems : [];
      const banners = Array.isArray(body.banners) ? body.banners : [];
      const cards = Array.isArray(body.cards) ? body.cards : [];
      await fire.collection('content').doc('home').set({ navItems, banners, cards, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, {merge:true});
      return ok({ok:true});
    }

    return bad('Endpoint topilmadi', 404);
  }catch(e){
    console.error('API error:', e);
    return json(500, {error:'Server xatosi', detail:String(e.message||e)});
  }
};

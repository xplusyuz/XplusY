// netlify/functions/api.js
// LeaderMath API (MongoDB) — no SDK, pure HTTP
const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const mongoUri = process.env.MONGODB_URI;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

if (!mongoUri) {
  console.warn('⚠️ MONGODB_URI is not set. API will fail until you set it in Netlify env vars.');
}

let cached = { client: null, db: null };

async function connectDB() {
  if (cached.db) return cached.db;
  const client = new MongoClient(mongoUri, { maxPoolSize: 5 });
  await client.connect();
  cached.client = client;
  cached.db = client.db('leaderMathDB');
  return cached.db;
}

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function ok(body) { return json(200, body); }
function bad(msg, code = 400) { return json(code, { error: msg }); }

function parsePath(event) {
  const raw = event.path || '';
  // "/.netlify/functions/api/..." -> "/..."
  return raw.replace(/^\/\.netlify\/functions\/api/, '') || '/';
}

function safeUser(u) {
  if (!u) return null;
  return {
    id: u._id,
    loginId: u.loginId,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    region: u.region || '',
    district: u.district || '',
    avatar: u.avatar || '',
    points: u.points || 0,
    createdAt: u.createdAt || null,
    updatedAt: u.updatedAt || null
  };
}

function randomPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#%';
  let out = '';
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

// PBKDF2
function hashPassword(password, salt = null) {
  const _salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, _salt, 120000, 32, 'sha256').toString('hex');
  return { salt: _salt, hash };
}
function verifyPassword(password, salt, hash) {
  const test = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'));
}

async function nextLoginId(db) {
  const counters = db.collection('counters');
  const r = await counters.findOneAndUpdate(
    { _id: 'loginId' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  // Start from 100000 if first time
  const seq = r.value.seq || 100000;
  const id = String(seq).padStart(6, '0').slice(-6);
  return id;
}

function getSessionIdFromRequest(event) {
  const h = event.headers || {};
  const sid = h['x-session-id'] || h['X-Session-Id'] || '';
  const auth = h['authorization'] || h['Authorization'] || '';
  if (sid) return sid.trim();
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

async function requireSession(db, event) {
  const sid = getSessionIdFromRequest(event);
  if (!sid) return { ok: false, error: 'Session kerak (X-Session-Id yoki Authorization: Bearer ...)' };

  const sessions = db.collection('sessions');
  const now = new Date();
  const sess = await sessions.findOne({ _id: sid });

  if (!sess) return { ok: false, error: 'Session topilmadi. Qayta kiring.' };
  if (sess.expiresAt && new Date(sess.expiresAt) < now) return { ok: false, error: 'Session tugagan. Qayta kiring.' };

  // update lastSeen
  await sessions.updateOne({ _id: sid }, { $set: { lastSeenAt: now } });

  const users = db.collection('users');
  const user = await users.findOne({ _id: sess.userId });
  if (!user) return { ok: false, error: 'Foydalanuvchi topilmadi' };

  return { ok: true, sessionId: sid, user };
}

async function createSession(db, userId) {
  const sessions = db.collection('sessions');
  const sid = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000*60*60*24*30); // 30 days
  await sessions.insertOne({
    _id: sid,
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt
  });
  return sid;
}

function isAdmin(event) {
  if (!ADMIN_TOKEN) return false;
  const h = event.headers || {};
  const tok = (h['x-admin-token'] || h['X-Admin-Token'] || '').trim();
  return tok && tok === ADMIN_TOKEN;
}

// default home content
const DEFAULT_HOME = {
  banners: [
    { mode:'html', sandbox:'allow-scripts allow-forms', contentHtml:'<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:linear-gradient(135deg,#007AFF,#5856D6);color:white"><div style="text-align:center"><div style="font-size:20px;font-weight:900">LeaderMath</div><div style="opacity:.9">API orqali boshqariladigan banner</div></div></body></html>' }
  ],
  cards: [
    { title:'Testlar', description:'Test yechish bo\'limi (keyin ulanadi)', icon:'fa-solid fa-pen-to-square', href:'' },
    { title:'Darslar', description:'Video va materiallar (keyin)', icon:'fa-solid fa-graduation-cap', href:'' },
    { title:'Simulator', description:'Matematik trenajorlar', icon:'fa-solid fa-calculator', href:'' }
  ]
};

exports.handler = async (event) => {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return json(200, { ok: true });

  const path = parsePath(event);

  try {
    const db = await connectDB();

    const users = db.collection('users');
    const sessions = db.collection('sessions');
    const content = db.collection('content');

    // health
    if (path === '/' && method === 'GET') {
      return ok({ ok: true, name: 'LeaderMath API', time: new Date().toISOString() });
    }

    // -------- AUTH: REGISTER (auto) --------
    if (path === '/auth/register' && method === 'POST') {
      const loginId = await nextLoginId(db);
      const password = randomPassword(10);

      const { salt, hash } = hashPassword(password);
      const now = new Date();

      // ensure unique loginId
      const existing = await users.findOne({ loginId });
      if (existing) return bad('ID to\'qnashuvi. Qayta urinib ko\'ring.', 409);

      const userDoc = {
        _id: crypto.randomUUID(),
        loginId,
        salt,
        hash,
        firstName: '',
        lastName: '',
        region: '',
        district: '',
        avatar: '',
        points: 0,
        createdAt: now,
        updatedAt: now
      };
      await users.insertOne(userDoc);

      const sessionId = await createSession(db, userDoc._id);

      return ok({
        loginId,
        password,
        sessionId,
        user: safeUser(userDoc)
      });
    }

    // -------- AUTH: LOGIN --------
    if (path === '/auth/login' && method === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const id = String(body.id || '').trim();
      const password = String(body.password || '').trim();
      if (!id || !password) return bad('ID va parol talab qilinadi', 400);
      if (id.length !== 6) return bad('ID 6 xonali bo\'lishi kerak', 400);

      const user = await users.findOne({ loginId: id });
      if (!user) return bad('Bunday ID topilmadi', 404);

      const okPass = verifyPassword(password, user.salt, user.hash);
      if (!okPass) return bad('Parol noto\'g\'ri', 401);

      const sessionId = await createSession(db, user._id);
      return ok({ sessionId, user: safeUser(user) });
    }

    // -------- AUTH: SESSION CHECK --------
    const mSess = path.match(/^\/auth\/session\/([^\/]+)$/);
    if (mSess && method === 'GET') {
      const sid = decodeURIComponent(mSess[1]);
      const sess = await sessions.findOne({ _id: sid });
      if (!sess) return bad('Session topilmadi', 404);
      if (sess.expiresAt && new Date(sess.expiresAt) < new Date()) return bad('Session tugagan', 401);

      const user = await users.findOne({ _id: sess.userId });
      if (!user) return bad('Foydalanuvchi topilmadi', 404);

      return ok({ sessionId: sid, user: safeUser(user) });
    }

    // -------- AUTH: CHANGE PASSWORD (session required) --------
    if (path === '/auth/password' && method === 'POST') {
      const auth = await requireSession(db, event);
      if (!auth.ok) return bad(auth.error, 401);

      const body = event.body ? JSON.parse(event.body) : {};
      const currentPassword = String(body.currentPassword || '').trim();
      const newPassword = String(body.newPassword || '').trim();
      if (newPassword.length < 6) return bad('Yangi parol kamida 6 belgidan iborat bo\'lsin', 400);

      const user = auth.user;
      const okPass = verifyPassword(currentPassword, user.salt, user.hash);
      if (!okPass) return bad('Joriy parol noto\'g\'ri', 401);

      const { salt, hash } = hashPassword(newPassword);
      await users.updateOne(
        { _id: user._id },
        { $set: { salt, hash, updatedAt: new Date() } }
      );

      return ok({ ok: true });
    }

    // -------- USER: GET/PATCH --------
    const mUser = path.match(/^\/user\/([^\/]+)$/);
    if (mUser && (method === 'GET' || method === 'PATCH')) {
      const userId = decodeURIComponent(mUser[1]);
      const auth = await requireSession(db, event);
      if (!auth.ok) return bad(auth.error, 401);

      if (auth.user._id !== userId) return bad('Faqat o\'zingizni profilingizga ruxsat', 403);

      if (method === 'GET') {
        return ok({ user: safeUser(auth.user) });
      }

      // PATCH
      const patch = event.body ? JSON.parse(event.body) : {};
      const allow = ['firstName','lastName','region','district'];
      const clean = {};
      for (const k of allow) {
        if (k in patch) clean[k] = String(patch[k] || '').trim();
      }
      clean.updatedAt = new Date();

      await users.updateOne({ _id: userId }, { $set: clean });
      const u2 = await users.findOne({ _id: userId });
      return ok({ user: safeUser(u2) });
    }

    // -------- USER: AVATAR (base64) --------
    const mAv = path.match(/^\/user\/([^\/]+)\/avatar$/);
    if (mAv && method === 'POST') {
      const userId = decodeURIComponent(mAv[1]);
      const auth = await requireSession(db, event);
      if (!auth.ok) return bad(auth.error, 401);
      if (auth.user._id !== userId) return bad('Faqat o\'zingizni profilingizga ruxsat', 403);

      const body = event.body ? JSON.parse(event.body) : {};
      const avatar = String(body.avatar || '').trim();
      if (!avatar.startsWith('data:image/')) return bad('Avatar base64 data:image/... bo\'lishi kerak', 400);
      if (avatar.length > 350000) return bad('Avatar juda katta (max ~350KB base64).', 413);

      await users.updateOne({ _id: userId }, { $set: { avatar, updatedAt: new Date() } });
      const u2 = await users.findOne({ _id: userId });
      return ok({ user: safeUser(u2) });
    }

    // -------- PUBLIC: HOME CONTENT --------
    if (path === '/content/home' && method === 'GET') {
      let doc = await content.findOne({ _id: 'home' });
      if (!doc) {
        await content.insertOne({ _id: 'home', ...DEFAULT_HOME, updatedAt: new Date() });
        doc = await content.findOne({ _id: 'home' });
      }
      return ok({ banners: doc.banners || [], cards: doc.cards || [] });
    }

    // -------- PUBLIC: RANKING --------
    if (path === '/ranking' && method === 'GET') {
      const list = await users
        .find({}, { projection: { loginId:1, firstName:1, lastName:1, region:1, district:1, avatar:1, points:1 } })
        .sort({ points: -1, createdAt: 1 })
        .limit(200)
        .toArray();

      const out = list.map(u => ({
        id: u._id,
        loginId: u.loginId,
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        region: u.region || '',
        district: u.district || '',
        avatar: u.avatar || '',
        points: u.points || 0
      }));
      return ok({ users: out });
    }

    // -------- ADMIN: update home content --------
    if (path === '/admin/content/home' && method === 'POST') {
      if (!isAdmin(event)) return bad('Admin token yo\'q', 401);
      const body = event.body ? JSON.parse(event.body) : {};
      const banners = Array.isArray(body.banners) ? body.banners : [];
      const cards = Array.isArray(body.cards) ? body.cards : [];
      await content.updateOne(
        { _id: 'home' },
        { $set: { banners, cards, updatedAt: new Date() } },
        { upsert: true }
      );
      return ok({ ok: true });
    }

    return bad('Endpoint topilmadi', 404);
  } catch (e) {
    console.error('API error:', e);
    return json(500, { error: 'Server xatosi', detail: String(e.message || e) });
  }
};

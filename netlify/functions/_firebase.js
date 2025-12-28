// netlify/functions/_firebase.js
// Firebase Admin + auth helpers (Netlify Functions) - Variant A (separate endpoints)

const admin = require('firebase-admin');
const crypto = require('crypto');

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecodeUtf8(str) {
  const padLen = (4 - (str.length % 4)) % 4;
  const pad = '='.repeat(padLen);
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64').toString('utf8');
}

function decodeServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
  if (!raw) throw new Error('ENV: FIREBASE_SERVICE_ACCOUNT_BASE64 topilmadi');

  let jsonText = raw;
  if (!raw.startsWith('{')) {
    // Base64(JSON)
    jsonText = Buffer.from(raw, 'base64').toString('utf8').trim();
  }

  let sa;
  try {
    sa = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('ENV: SERVICE_ACCOUNT JSON xato. JSON.parse bo‘lmadi');
  }

  // Fix common escaped newlines in private_key
  if (sa.private_key && typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }
  return sa;
}

function initFirebase() {
  if (admin.apps.length) return admin;
  const serviceAccount = decodeServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return admin;
}

function getDb() {
  return initFirebase().firestore();
}

// Password hashing (PBKDF2)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iter = 120000;
  const keylen = 32;
  const digest = 'sha256';
  const hash = crypto.pbkdf2Sync(password, salt, iter, keylen, digest).toString('hex');
  return { salt, iter, keylen, digest, hash };
}

function verifyPassword(password, stored) {
  if (!stored || !stored.salt || !stored.hash) return false;
  const iter = stored.iter || 120000;
  const keylen = stored.keylen || 32;
  const digest = stored.digest || 'sha256';
  const hash = crypto.pbkdf2Sync(password, stored.salt, iter, keylen, digest).toString('hex');
  // constant time compare
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(stored.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Tiny JWT (HS256)
function jwtSecret() {
  return process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
}

function signJwt(payload, expiresInSec = 60 * 60 * 24 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encBody = base64UrlEncode(JSON.stringify(body));
  const data = `${encHeader}.${encBody}`;
  const sig = crypto.createHmac('sha256', jwtSecret()).update(data).digest();
  const encSig = base64UrlEncode(sig);
  return `${data}.${encSig}`;
}

function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = base64UrlEncode(crypto.createHmac('sha256', jwtSecret()).update(data).digest());
  // constant time compare on strings
  if (expected.length !== s.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeUtf8(p));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  return payload;
}

function getBearer(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

async function nextUserId(db) {
  const ref = db.doc('meta/counters');
  const id = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data().nextUserId || 100000) : 100000;
    const next = Number(cur) + 1;
    tx.set(ref, { nextUserId: next }, { merge: true });
    return String(next);
  });
  return id;
}

module.exports = {
  initFirebase,
  getDb,
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  getBearer,
  nextUserId,
};

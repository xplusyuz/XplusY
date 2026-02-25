const { initAdmin } = require("./_admin");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function onlyDigits(s) { return (s || "").toString().replace(/\D/g, ""); }

function normalizePhone(raw) {
  const d = onlyDigits(raw);
  if (d.length === 12 && d.startsWith("998")) return d;
  if (d.length === 9) return "998" + d;
  return null;
}

function normalizeOmId(raw) {
  const s = (raw || "").toString().trim().toUpperCase();
  if (!s) return null;
  if (!s.startsWith("OM")) return null;
  // allow OM000123, OM123
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return "OM" + digits.padStart(6, "0");
}

function padOm(num) {
  const n = Number(num);
  return "OM" + String(n).padStart(6, "0");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}

  const name = (body.name || "").toString().trim();
  const phone = normalizePhone(body.phone);
  const pass = (body.password || "").toString();
  const region = (body.region || "").toString().trim();
  const district = (body.district || "").toString().trim();
  const post = (body.post || "").toString().trim();

  if (!name || name.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ ok:false, code:"bad_name", message:"Ism juda qisqa." }) };
  }
  if (!phone) {
    return { statusCode: 400, body: JSON.stringify({ ok:false, code:"bad_phone", message:"Telefon noto‘g‘ri. Masalan: 998901234567" }) };
  }
  if (pass.length < 6) {
    return { statusCode: 400, body: JSON.stringify({ ok:false, code:"bad_password", message:"Parol kamida 6 ta belgidan iborat bo‘lsin." }) };
  }
  if (!region || !district || !post) {
    return { statusCode: 400, body: JSON.stringify({ ok:false, code:"profile_required", message:"Profilni to‘liq to‘ldiring: viloyat, tuman, pochta." }) };
  }

  const admin = initAdmin();
  const db = admin.firestore();

  try {
    // Phone exists?
    const phoneRef = db.doc(`users_by_phone/${phone}`);
    const phoneSnap = await phoneRef.get();
    if (phoneSnap.exists) {
      return { statusCode: 409, body: JSON.stringify({ ok:false, code:"phone_exists", message:"Bu telefon oldin ro‘yxatdan o‘tgan. Kirish bo‘limidan kiring." }) };
    }

    // Allocate numericId + OM id
    const countersRef = db.doc("meta/counters");

    let numericId = null;
    let omId = null;

    await db.runTransaction(async (tx) => {
      const cSnap = await tx.get(countersRef);
      const cur = cSnap.exists ? (cSnap.data().userNumeric || 0) : 0;
      const next = cur + 1;
      numericId = next;
      omId = padOm(next);
      tx.set(countersRef, { userNumeric: next }, { merge: true });
    });

    // Generate uid (stable, random)
    const uid = crypto.randomBytes(16).toString("hex");

    // Create auth user (custom-token sign-in)
    await admin.auth().createUser({ uid, displayName: name });

    const passwordHash = await bcrypt.hash(pass, 10);
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Write user + indexes
    const userDoc = {
      uid,
      name,
      phone,
      region,
      district,
      post,
      numericId,
      omId,
      passwordHash,
      createdAt: now,
      role: "user",
      balanceUZS: 0,
      points: 0
    };

    const userRef = db.doc(`users/${uid}`);
    const numRef = db.doc(`users_by_numeric/${omId}`);

    await db.runTransaction(async (tx) => {
      tx.set(userRef, userDoc, { merge: true });
      tx.set(phoneRef, { uid, omId, createdAt: now }, { merge: true });
      tx.set(numRef, { uid, phone, createdAt: now }, { merge: true });
    });

    const token = await admin.auth().createCustomToken(uid, { omId, role: "user" });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok:true, uid, omId, numericId, token })
    };
  } catch (e) {
    console.error("auth_register error:", e);
    return { statusCode: 500, body: JSON.stringify({ ok:false, code:"server", message:"Server xatosi. Qayta urinib ko‘ring." }) };
  }
};

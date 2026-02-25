const { initAdmin } = require("./_admin");
const bcrypt = require("bcryptjs");

function onlyDigits(s) { return (s || "").toString().replace(/\D/g, ""); }

function normalizePhone(raw) {
  const d = onlyDigits(raw);
  if (d.length === 12 && d.startsWith("998")) return d;
  if (d.length === 9) return "998" + d;
  return null;
}

function normalizeOmId(raw) {
  const s = (raw || "").toString().trim().toUpperCase();
  if (!s.startsWith("OM")) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return "OM" + digits.padStart(6, "0");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}

  const identifierRaw = (body.identifier || body.phone || body.omId || "").toString().trim();
  const pass = (body.password || "").toString();

  if (!identifierRaw) {
    return { statusCode: 400, body: JSON.stringify({ ok:false, code:"missing_identifier", message:"Telefon yoki OM ID kiriting." }) };
  }
  if (!pass) {
    return { statusCode: 400, body: JSON.stringify({ ok:false, code:"missing_password", message:"Parolni kiriting." }) };
  }

  const admin = initAdmin();
  const db = admin.firestore();

  try {
    let uid = null;
    let omId = null;

    const omCandidate = normalizeOmId(identifierRaw);
    if (omCandidate) {
      const snap = await db.doc(`users_by_numeric/${omCandidate}`).get();
      if (!snap.exists) {
        return { statusCode: 404, body: JSON.stringify({ ok:false, code:"not_found", message:"Bunday ID topilmadi." }) };
      }
      uid = snap.data().uid;
      omId = omCandidate;
    } else {
      const phone = normalizePhone(identifierRaw);
      if (!phone) {
        return { statusCode: 400, body: JSON.stringify({ ok:false, code:"bad_phone", message:"Telefon noto‘g‘ri. Masalan: 998901234567" }) };
      }
      const snap = await db.doc(`users_by_phone/${phone}`).get();
      if (!snap.exists) {
        return { statusCode: 404, body: JSON.stringify({ ok:false, code:"not_found", message:"Bu telefon ro‘yxatdan o‘tmagan." }) };
      }
      uid = snap.data().uid;
      omId = snap.data().omId || null;
    }

    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      return { statusCode: 404, body: JSON.stringify({ ok:false, code:"not_found", message:"Foydalanuvchi topilmadi." }) };
    }

    const u = userSnap.data();
    const hash = u.passwordHash || "";
    const ok = await bcrypt.compare(pass, hash);
    if (!ok) {
      return { statusCode: 401, body: JSON.stringify({ ok:false, code:"wrong_password", message:"Parol noto‘g‘ri." }) };
    }

    const token = await admin.auth().createCustomToken(uid, { omId: u.omId || omId || null, role: u.role || "user" });

    return { statusCode: 200, body: JSON.stringify({ ok:true, uid, omId: u.omId || omId, token }) };
  } catch (e) {
    console.error("auth_login error:", e);
    return { statusCode: 500, body: JSON.stringify({ ok:false, code:"server", message:"Server xatosi. Qayta urinib ko‘ring." }) };
  }
};

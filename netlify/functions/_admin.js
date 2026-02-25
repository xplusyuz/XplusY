const admin = require("firebase-admin");

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT env var");
  try { return JSON.parse(raw); }
  catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON"); }
}

function initAdmin() {
  if (admin.apps.length) return admin;
  const sa = getServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
  return admin;
}

module.exports = { initAdmin };

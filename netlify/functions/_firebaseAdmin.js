// netlify/functions/_firebaseAdmin.js
const admin = require("firebase-admin");

function getServiceAccount() {
  // Netlify env var: FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string)
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_JSON");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
}

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const sa = getServiceAccount();
  const projectId = sa.project_id;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;

  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket,
  });
  return admin.app();
}

module.exports = { admin, initAdmin };

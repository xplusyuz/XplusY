const crypto = require("crypto");
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return admin;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_B64");
  const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  const body = event && typeof event.body === "string" ? event.body : "";
  const contentType = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return body ? JSON.parse(body) : {};
  }
  const params = new URLSearchParams(body);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function getEnv() {
  const serviceId = String(process.env.CLICK_SERVICE_ID || "").trim();
  const merchantId = String(process.env.CLICK_MERCHANT_ID || "").trim();
  const merchantUserId = String(process.env.CLICK_MERCHANT_USER_ID || "").trim();
  const secretKey = String(process.env.CLICK_SECRET_KEY || "").trim();
  return { serviceId, merchantId, merchantUserId, secretKey };
}

function md5(v) {
  return crypto.createHash("md5").update(String(v)).digest("hex");
}

function verifyPrepareSign(payload, secretKey) {
  const expected = md5(`${payload.click_trans_id}${payload.service_id}${secretKey}${payload.merchant_trans_id}${payload.amount}${payload.action}${payload.sign_time}`);
  return expected === String(payload.sign_string || "").toLowerCase();
}

function verifyCompleteSign(payload, secretKey) {
  const expected = md5(`${payload.click_trans_id}${payload.service_id}${secretKey}${payload.merchant_trans_id}${payload.merchant_prepare_id}${payload.amount}${payload.action}${payload.sign_time}`);
  return expected === String(payload.sign_string || "").toLowerCase();
}

function clickError(error, error_note, extra = {}) {
  return { error, error_note, ...extra };
}

function safeAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function approxEqualAmount(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

function normalizeReqId(id) {
  return String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
}

module.exports = {
  admin,
  initAdmin,
  json,
  parseBody,
  getEnv,
  verifyPrepareSign,
  verifyCompleteSign,
  clickError,
  safeAmount,
  approxEqualAmount,
  normalizeReqId,
};

// netlify/functions/createOrderCash.js
const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_B64");
  const json = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(json);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function getBearerToken(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function isSafeId(id) {
  return typeof id === "string" && id.length >= 2 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isInteger(x)) return null;
  if (x < min || x > max) return null;
  return x;
}

function buildShortOrderId(len = 6) {
  const max = 10 ** len;
  const n = Math.floor(Math.random() * (max - 1)) + 1;
  return String(n).padStart(len, "0");
}

async function allocateUniqueOrderId(db) {
  // try 6-digit first, then expand
  let len = 6;
  for (;;) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const id = buildShortOrderId(len);
      const ref = db.doc(`orders/${id}`);
      const snap = await ref.get();
      if (!snap.exists) return id;
    }
    len++;
  }
}

exports.handler = async (event) => {
  try {
    initAdmin();
    const db = admin.firestore();

    if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

    // --- Auth ---
    const token = getBearerToken(event);
    if (!token) return json(401, { ok: false, error: "Unauthorized (no token)" });

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
      return json(401, { ok: false, error: "Unauthorized (bad token)" });
    }

    const uid = decoded.uid;

    // --- Parse body ---
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON" });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length < 1 || items.length > 80) {
      return json(400, { ok: false, error: "items: 1..80 bo‘lishi kerak" });
    }

    // Minimal item validation (client already builds snapshot; we accept it but sanitize qty)
    const normItems = [];
    for (const it of items) {
      const productId = (it?.productId || it?.id || "").toString();
      const qty = clampInt(it?.qty ?? it?.count ?? 1, 1, 999);
      if (!isSafeId(productId) || qty == null) {
        return json(400, { ok: false, error: "items format xato (productId/qty)" });
      }
      normItems.push({ ...it, productId, qty });
    }

    const totalUZS = Number(body.totalUZS || 0);
    if (!Number.isFinite(totalUZS) || totalUZS <= 0) {
      return json(400, { ok: false, error: "totalUZS xato" });
    }

    const shipping = body.shipping && typeof body.shipping === "object" ? body.shipping : null;

    // --- Pull user fields for nice order record ---
    let userName = decoded.name || decoded.email || "User";
    let userPhone = "";
    let numericId = null;
    let userTgChatId = null;
    let firstName = null, lastName = null, region = null, district = null, post = null;

    try {
      const uSnap = await db.doc(`users/${uid}`).get();
      if (uSnap.exists) {
        const u = uSnap.data() || {};
        userName = (u.name || userName).toString();
        userPhone = (u.phone || "").toString();
        numericId = (u.numericId != null ? String(u.numericId) : null);
        userTgChatId = (u.telegramChatId || u.tgChatId || "").toString().trim() || null;
        firstName = (u.firstName || "").toString() || null;
        lastName = (u.lastName || "").toString() || null;
        region = (u.region || "").toString() || null;
        district = (u.district || "").toString() || null;
        post = (u.post || "").toString() || null;
      }
    } catch (_) {}

    const orderId = await allocateUniqueOrderId(db);
    const orderRef = db.doc(`orders/${orderId}`);

    let shippingFinal = shipping;
    if (!shippingFinal) {
      const addrText = [region, district, post].filter(Boolean).join(" / ");
      shippingFinal = { region, district, post, addressText: addrText };
    } else if (!shippingFinal.addressText) {
      const r = shippingFinal.region || region;
      const d = shippingFinal.district || district;
      const p = shippingFinal.post || post;
      shippingFinal.addressText = [r, d, p].filter(Boolean).join(" / ");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const orderDoc = {
      orderId,
      uid,
      numericId,
      userName,
      userPhone,
      userTgChatId,
      firstName,
      lastName,
      region,
      district,
      post,
      status: "pending_cash",
      items: normItems,
      totalUZS,
      amountTiyin: null,
      provider: "cash",
      shipping: shippingFinal,
      orderType: "checkout",
      createdAt: now,
      source: "web",
    };

    await orderRef.set(orderDoc, { merge: false });

    return json(200, { ok: true, orderId });
  } catch (e) {
    return json(500, { ok: false, error: "server_error", detail: String(e && e.message ? e.message : e) });
  }
};

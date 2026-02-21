/**
 * Netlify Function: Pay with internal balance (secure)
 *
 * POST JSON:
 *  { items, totalUZS, shipping }
 *
 * Headers:
 *  Authorization: Bearer <Firebase ID token>
 *
 * ENV:
 *  - FIREBASE_SERVICE_ACCOUNT_B64
 */
const admin = require("firebase-admin");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify(obj),
  };
}

function initFirebase() {
  if (admin.apps && admin.apps.length) return admin;
  const rawB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64 || "";
  if (!rawB64) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_B64");
  const b64 = String(rawB64).replace(/\s+/g, "");
  const jsonString = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(jsonString);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}

function getBearer(headers) {
  const h = headers.authorization || headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(200, { ok: true });

  try {
    initFirebase();
    const db = admin.firestore();

    const token = getBearer(event.headers || {});
    if (!token) return json(401, { ok: false, error: "missing_token" });

    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = JSON.parse(event.body || "{}");
    const items = Array.isArray(body.items) ? body.items : [];
    const totalUZS = Math.trunc(Number(body.totalUZS || 0));
    const shipping = body.shipping || null;

    if (!totalUZS || totalUZS <= 0) return json(400, { ok: false, error: "bad_total" });

    const orderId = String(Date.now());

    const result = await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists) throw new Error("no_user");
      const u = uSnap.data() || {};
      const bal = Math.trunc(Number(u.balanceUZS || 0));
      if (bal < totalUZS) throw new Error("insufficient_balance");

      tx.set(userRef, { balanceUZS: bal - totalUZS, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      const numericId = u.numericId != null ? String(u.numericId) : null;
      const userName = u.name || null;
      const userPhone = u.phone || null;
      const userTgChatId = u.telegramChatId || u.tgChatId || null;

      const order = {
        orderId,
        uid,
        numericId,
        userName,
        userPhone,
        userTgChatId,
        status: "paid",
        items,
        totalUZS,
        amountTiyin: null,
        provider: "balance",
        shipping,
        orderType: "checkout",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "web",
      };

      tx.set(db.collection("orders").doc(orderId), order, { merge: true });
      tx.set(db.collection("users").doc(uid).collection("orders").doc(orderId), order, { merge: true });

      return { orderId };
    });

    return json(200, { ok: true, ...result });
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("insufficient_balance")) return json(400, { ok: false, error: "insufficient_balance" });
    return json(500, { ok: false, error: "server", message: msg });
  }
};

// netlify/functions/balancePay.js
const admin = require("firebase-admin");

// --- Firebase Admin init (Netlify env: FIREBASE_SERVICE_ACCOUNT_B64) ---
function initAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("Missing env FIREBASE_SERVICE_ACCOUNT_B64");

  const json = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(json);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
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
  // productId uchun minimal sanitizatsiya (xohlasangiz kuchaytiramiz)
  return typeof id === "string" && id.length >= 2 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isInteger(x)) return null;
  if (x < min || x > max) return null;
  return x;
}

function buildShortOrderId() {
  // 6 xonali random (collison bo'lsa retry qilamiz)
  // Sizning utils/shortOrderId.js bilan bir xil bo‘lishi shart emas; bu server-unique bo‘lishi kerak.
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
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
    const email = decoded.email || null;

    // --- Parse body ---
    let body = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(400, { ok: false, error: "Invalid JSON" });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length < 1 || items.length > 50) {
      return json(400, { ok: false, error: "items: 1..50 bo‘lishi kerak" });
    }

    // Normalize + validate items
    const normalized = [];
    const seen = new Set();
    for (const it of items) {
      const productId = it?.productId;
      const qty = clampInt(it?.qty, 1, 999);
      if (!isSafeId(productId) || qty == null) {
        return json(400, { ok: false, error: "items format xato (productId/qty)" });
      }
      if (seen.has(productId)) {
        return json(400, { ok: false, error: "Bir xil productId takrorlangan. Birlashtirib yuboring." });
      }
      seen.add(productId);
      normalized.push({ productId, qty });
    }

    const note = (typeof body.note === "string" && body.note.length <= 500) ? body.note.trim() : "";
    const deliveryMode = body?.delivery?.mode === "CN" ? "CN" : "UZ"; // default UZ

    // --- Fetch products from Firestore (server-side pricing) ---
    // IMPORTANT: faqat approved mahsulotlarni sotishga ruxsat (xohlasangiz vendor ham bo‘lishi mumkin)
    const productRefs = normalized.map(x => db.doc(`products/${x.productId}`));
    const snaps = await db.getAll(...productRefs);

    const lines = [];
    let subtotalUZS = 0;

    for (let i = 0; i < snaps.length; i++) {
      const snap = snaps[i];
      const { productId, qty } = normalized[i];

      if (!snap.exists) {
        return json(400, { ok: false, error: `Mahsulot topilmadi: ${productId}` });
      }

      const p = snap.data() || {};

      // ✅ Sizning product schemangizga moslang:
      // priceUZS (yoki currentPriceUZS) nomi qanday bo‘lsa shuni ishlating.
      const priceUZS = Number.isFinite(Number(p.priceUZS)) ? Number(p.priceUZS)
                      : Number.isFinite(Number(p.currentPriceUZS)) ? Number(p.currentPriceUZS)
                      : null;

      if (!Number.isFinite(priceUZS) || priceUZS < 0) {
        return json(400, { ok: false, error: `Narx noto‘g‘ri: ${productId}` });
      }

      // only approved
      if (p.status !== "approved") {
        return json(403, { ok: false, error: `Mahsulot hali tasdiqlanmagan: ${productId}` });
      }

      // optional: max qty / stock check (agar stock field bo‘lsa)
      // const stock = Number.isFinite(Number(p.stock)) ? Number(p.stock) : null;
      // if (stock != null && qty > stock) return json(400, { ok:false, error:`Omborda yetarli emas: ${productId}` });

      const lineTotal = priceUZS * qty;
      subtotalUZS += lineTotal;

      lines.push({
        productId,
        title: String(p.title || p.name || "").slice(0, 120),
        unitPriceUZS: priceUZS,
        qty,
        lineTotalUZS: lineTotal,
        // snapshot fields for audit
        image: p.image || p.imageUrl || null,
        ownerUid: p.ownerUid || null,
      });
    }

    // --- Delivery / fees server-side ---
    // Sizning real logistika formulangiz bo‘lsa shu yerga qo‘yiladi.
    // Hozir minimal:
    const deliveryFeeUZS = deliveryMode === "CN" ? 0 : 0; // keyin sozlaysiz
    const discountUZS = 0; // promo/discount bo‘lsa server-side hisoblanadi
    const totalUZS = subtotalUZS + deliveryFeeUZS - discountUZS;

    if (!Number.isFinite(totalUZS) || totalUZS < 0) {
      return json(500, { ok: false, error: "Total hisoblashda xato" });
    }

    // --- Transaction: check balance -> deduct -> create order ---
    const userRef = db.doc(`users/${uid}`);

    // Idempotency (ixtiyoriy, lekin PRO): client har checkout uchun unique key yuborsa yaxshi.
    // Hozir oddiy: server orderId yaratadi.
    // Collison bo‘lsa retry qilamiz.
    const maxTry = 5;

    for (let attempt = 1; attempt <= maxTry; attempt++) {
      const shortId = buildShortOrderId();
      const orderRef = db.doc(`orders/${shortId}`);

      try {
        const result = await db.runTransaction(async (tx) => {
          const [uSnap, oSnap] = await Promise.all([tx.get(userRef), tx.get(orderRef)]);
          if (!uSnap.exists) throw new Error("USER_NOT_FOUND");
          if (oSnap.exists) throw new Error("ORDER_ID_COLLISION");

          const u = uSnap.data() || {};
          const balance = Number.isFinite(Number(u.balanceUZS)) ? Number(u.balanceUZS) : 0;

          if (balance < totalUZS) {
            const need = totalUZS - balance;
            return { ok: false, code: "INSUFFICIENT_BALANCE", balance, need, orderId: null };
          }

          const newBalance = balance - totalUZS;

          // Balance update (server-side)
          tx.update(userRef, {
            balanceUZS: newBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Order create (server-side)
          const now = admin.firestore.FieldValue.serverTimestamp();
          tx.set(orderRef, {
            id: shortId,
            uid,
            email,
            provider: "balance",
            status: "paid",               // balance bilan darhol paid
            currency: "UZS",

            delivery: { mode: deliveryMode },
            pricing: {
              subtotalUZS,
              deliveryFeeUZS,
              discountUZS,
              totalUZS,
            },

            items: lines,

            note,
            createdAt: now,
            paidAt: now,

            // audit
            client: {
              ua: event.headers?.["user-agent"] || event.headers?.["User-Agent"] || null,
              ip: event.headers?.["x-nf-client-connection-ip"] || event.headers?.["x-forwarded-for"] || null,
            },
          });

          return { ok: true, code: "OK", balance: newBalance, need: 0, orderId: shortId };
        });

        if (!result.ok && result.code === "INSUFFICIENT_BALANCE") {
          return json(402, {
            ok: false,
            error: "Balans yetarli emas",
            code: result.code,
            balanceUZS: result.balance,
            needUZS: result.need,
          });
        }

        if (result.ok) {
          return json(200, {
            ok: true,
            orderId: result.orderId,
            totalUZS,
            balanceUZS: result.balance,
          });
        }

        // boshqa holat bo‘lsa:
        return json(500, { ok: false, error: "Transaction xatosi", code: result.code });

      } catch (e) {
        const msg = String(e?.message || e);

        if (msg === "ORDER_ID_COLLISION") {
          // retry
          continue;
        }
        if (msg === "USER_NOT_FOUND") {
          return json(404, { ok: false, error: "User topilmadi" });
        }

        console.error("balancePay error:", e);
        return json(500, { ok: false, error: "Server xatosi" });
      }
    }

    return json(500, { ok: false, error: "Order ID collision (retry limit)" });

  } catch (e) {
    console.error("balancePay fatal:", e);
    return json(500, { ok: false, error: "Fatal server error" });
  }
};
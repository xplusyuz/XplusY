const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// --- Popularity model (world-class, but lightweight) ---
// Exponential time-decay score: score = score * exp(-lambda * dtHours) + weight
// Half-life: 7 days (tunable)
const HALF_LIFE_DAYS = 7;
const LAMBDA = Math.log(2) / (HALF_LIFE_DAYS * 24);

const WEIGHTS = {
  view: 0.2,
  favorite: 1.5,
  add_to_cart: 2.5,
  purchase: 12.0,
};

function nowTs() { return admin.firestore.Timestamp.now(); }

function decay(score, lastAt, nowAt) {
  if (!score || !lastAt) return score || 0;
  const dtMs = nowAt.toMillis() - lastAt.toMillis();
  const dtHours = Math.max(0, dtMs / 36e5);
  const factor = Math.exp(-LAMBDA * dtHours);
  return (score || 0) * factor;
}

async function bumpProductScoreTx(productId, type, extra = {}) {
  const weight = WEIGHTS[type] ?? 0;
  if (!weight) return;

  const ref = db.collection("products").doc(String(productId));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;

    const nowAt = nowTs();
    const data = snap.data() || {};

    const prevScore = Number(data.popularScore || 0);
    const lastAt = data.popularLastAt ? data.popularLastAt : null;

    const decayed = lastAt ? decay(prevScore, lastAt, nowAt) : prevScore;
    const nextScore = decayed + weight;

    const stats = data.popularStats || {};
    const nextStats = {
      views: Number(stats.views || 0) + (type === "view" ? 1 : 0),
      favorites: Number(stats.favorites || 0) + (type === "favorite" ? 1 : 0),
      carts: Number(stats.carts || 0) + (type === "add_to_cart" ? 1 : 0),
      purchases: Number(stats.purchases || 0) + (type === "purchase" ? 1 : 0),
      revenueUZS: Number(stats.revenueUZS || 0) + (type === "purchase" ? Number(extra.revenueUZS || 0) : 0),
      lastEventAt: nowAt,
    };

    tx.update(ref, {
      popularScore: Math.round(nextScore * 1000) / 1000,
      popularLastAt: nowAt,
      popularStats: nextStats,
    });
  });
}

// --- Admin bootstrap: set custom claim admin=true for allowlisted emails ---
exports.claimAdmin = onCall({ region: "us-central1" }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const email = (req.auth.token.email || "").toLowerCase();

  // Configure admin emails in Firebase env:
  // firebase functions:config:set orzu.admin_emails="a@b.com,c@d.com"
  const cfg = process.env.FIREBASE_CONFIG ? null : null;
  const raw = (process.env.ORZU_ADMIN_EMAILS || "").trim();
  // Also support functions config (v1) style via env injected by firebase:
  const configEmails = (process.env.FUNCTIONS_EMULATOR ? "" : "") // placeholder
  const allow = (raw ? raw.split(",") : [])
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allow.length === 0) {
    logger.warn("ORZU_ADMIN_EMAILS is not set; denying claimAdmin.");
    throw new HttpsError("failed-precondition", "Admin emails not configured.");
  }

  if (!allow.includes(email)) {
    throw new HttpsError("permission-denied", "Not in admin allowlist.");
  }

  await admin.auth().setCustomUserClaims(req.auth.uid, { admin: true });
  return { ok: true, admin: true };
});

// --- Interest events from client (view/favorite/add_to_cart) ---
exports.onEventCreated = onDocumentCreated("events/{eventId}", async (event) => {
  const doc = event.data;
  if (!doc) return;

  const e = doc.data() || {};
  const type = e.type;
  const productId = e.productId;

  if (!type || !productId) return;
  if (!["view", "favorite", "add_to_cart"].includes(type)) return;

  try {
    await bumpProductScoreTx(productId, type);
  } catch (err) {
    logger.error("bumpProductScoreTx failed", err);
  }
});

// --- Purchases (orders) ---
exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
  const doc = event.data;
  if (!doc) return;

  const o = doc.data() || {};
  const items = Array.isArray(o.items) ? o.items : [];
  const totalUZS = Number(o.totalUZS || 0);

  for (const it of items) {
    const pid = it.productId || it.id;
    const qty = Number(it.qty || 1);
    const priceUZS = Number(it.priceUZS || it.price || 0);
    const revenue = Math.max(0, qty * priceUZS);
    if (!pid) continue;
    try {
      await bumpProductScoreTx(pid, "purchase", { revenueUZS: revenue });
    } catch (err) {
      logger.error("purchase bump failed", { pid, err });
    }
  }

  // Optionally store aggregate on order
  try {
    await doc.ref.update({ processedAt: nowTs() });
  } catch (_) {}
});

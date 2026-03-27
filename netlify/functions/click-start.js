const {
  admin,
  initAdmin,
  json,
  parseBody,
  getEnv,
  normalizeReqId,
} = require("./_clickCommon");

function getBearerToken(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
    initAdmin();
    const db = admin.firestore();
    const { serviceId, merchantId, merchantUserId } = getEnv();
    if (!serviceId || !merchantId) return json(500, { ok: false, error: "missing_click_env" });

    const token = getBearerToken(event);
    if (!token) return json(401, { ok: false, error: "missing_bearer_token" });
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return json(401, { ok: false, error: "invalid_token" });
    }

    const body = parseBody(event);
    const amountUZS = Math.round(Number(body.amountUZS || 0));
    if (!Number.isFinite(amountUZS) || amountUZS < 1000) {
      return json(400, { ok: false, error: "invalid_amount" });
    }

    let numericId = null;
    let fullName = "";
    try {
      const uSnap = await db.doc(`users/${decoded.uid}`).get();
      if (uSnap.exists) {
        const u = uSnap.data() || {};
        numericId = u.numericId ?? null;
        fullName = String(u.name || "").trim();
      }
    } catch {}

    const reqId = normalizeReqId(`clk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
    const reqRef = db.doc(`topup_requests/${reqId}`);
    const returnUrl = String(body.returnUrl || "").trim();

    await reqRef.set({
      uid: decoded.uid,
      numericId: numericId != null ? String(numericId) : null,
      amountUZS,
      status: "pending_click",
      provider: "click",
      source: "click_auto",
      fullName,
      click: {
        state: "created",
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const params = new URLSearchParams({
      service_id: String(serviceId),
      merchant_id: String(merchantId),
      amount: amountUZS.toFixed(2),
      transaction_param: reqId,
    });
    if (merchantUserId) params.set("merchant_user_id", String(merchantUserId));
    if (returnUrl) params.set("return_url", returnUrl);

    return json(200, {
      ok: true,
      reqId,
      payment_url: `https://my.click.uz/services/pay?${params.toString()}`,
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};

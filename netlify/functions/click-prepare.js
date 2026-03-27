const {
  admin,
  initAdmin,
  json,
  parseBody,
  getEnv,
  verifyPrepareSign,
  clickError,
  safeAmount,
  approxEqualAmount,
  normalizeReqId,
} = require("./_clickCommon");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, clickError(-8, "Method not allowed"));
    initAdmin();
    const db = admin.firestore();
    const { serviceId, secretKey } = getEnv();
    if (!serviceId || !secretKey) return json(500, clickError(-8, "CLICK env missing"));

    const body = parseBody(event);
    const payload = {
      click_trans_id: String(body.click_trans_id || ""),
      service_id: String(body.service_id || ""),
      click_paydoc_id: String(body.click_paydoc_id || ""),
      merchant_trans_id: normalizeReqId(body.merchant_trans_id),
      amount: String(body.amount || ""),
      action: String(body.action || ""),
      error: String(body.error || "0"),
      error_note: String(body.error_note || ""),
      sign_time: String(body.sign_time || ""),
      sign_string: String(body.sign_string || "").toLowerCase(),
    };

    if (!payload.click_trans_id || !payload.merchant_trans_id || !payload.amount || !payload.sign_time || payload.action !== "0") {
      return json(200, clickError(-8, "Error in request from click"));
    }
    if (payload.service_id !== String(serviceId)) {
      return json(200, clickError(-8, "Wrong service_id"));
    }
    if (!verifyPrepareSign(payload, secretKey)) {
      return json(200, clickError(-1, "SIGN CHECK FAILED!"));
    }

    const amount = safeAmount(payload.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return json(200, clickError(-2, "Incorrect parameter amount"));
    }

    const reqRef = db.doc(`topup_requests/${payload.merchant_trans_id}`);
    const snap = await reqRef.get();
    if (!snap.exists) {
      return json(200, clickError(-5, "User does not exist"));
    }
    const req = snap.data() || {};
    const storedAmount = Number(req.amountUZS || 0);
    if (!approxEqualAmount(amount, storedAmount)) {
      return json(200, clickError(-2, "Incorrect parameter amount"));
    }
    if (["approved", "success"].includes(String(req.status || "").toLowerCase())) {
      return json(200, {
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: payload.merchant_trans_id,
        merchant_prepare_id: Number(req.click?.merchant_prepare_id || req.merchant_prepare_id || 0) || 0,
        error: -4,
        error_note: "Already paid",
      });
    }
    if (["rejected", "canceled", "cancelled", "canceled_by_click"].includes(String(req.status || "").toLowerCase())) {
      return json(200, clickError(-9, "Transaction cancelled"));
    }

    const merchantPrepareId = Number(req.click?.merchant_prepare_id || req.merchant_prepare_id || Date.now());
    await reqRef.set({
      status: "pending_click",
      merchant_prepare_id: merchantPrepareId,
      click: {
        ...(req.click || {}),
        state: "prepared",
        click_trans_id: payload.click_trans_id,
        click_paydoc_id: payload.click_paydoc_id,
        merchant_prepare_id: merchantPrepareId,
        amount,
        preparedAt: admin.firestore.FieldValue.serverTimestamp(),
        sign_time: payload.sign_time,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return json(200, {
      click_trans_id: payload.click_trans_id,
      merchant_trans_id: payload.merchant_trans_id,
      merchant_prepare_id: merchantPrepareId,
      error: 0,
      error_note: "Success",
    });
  } catch (e) {
    return json(200, clickError(-7, String(e.message || e)));
  }
};

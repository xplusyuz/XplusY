const {
  admin,
  initAdmin,
  json,
  parseBody,
  getEnv,
  verifyCompleteSign,
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
      merchant_prepare_id: String(body.merchant_prepare_id || ""),
      amount: String(body.amount || ""),
      action: String(body.action || ""),
      error: String(body.error || "0"),
      error_note: String(body.error_note || ""),
      sign_time: String(body.sign_time || ""),
      sign_string: String(body.sign_string || "").toLowerCase(),
    };

    if (!payload.click_trans_id || !payload.merchant_trans_id || !payload.amount || !payload.sign_time || payload.action !== "1") {
      return json(200, clickError(-8, "Error in request from click"));
    }
    if (payload.service_id !== String(serviceId)) {
      return json(200, clickError(-8, "Wrong service_id"));
    }
    if (!verifyCompleteSign(payload, secretKey)) {
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

    const savedPrepareId = String(req.click?.merchant_prepare_id || req.merchant_prepare_id || "");
    if (!savedPrepareId || savedPrepareId !== String(payload.merchant_prepare_id)) {
      return json(200, clickError(-6, "Transaction does not exist"));
    }

    const status = String(req.status || "").toLowerCase();
    if (["approved", "success"].includes(status)) {
      return json(200, {
        click_trans_id: payload.click_trans_id,
        merchant_trans_id: payload.merchant_trans_id,
        merchant_confirm_id: Number(req.click?.merchant_confirm_id || req.click?.merchant_prepare_id || savedPrepareId),
        error: -4,
        error_note: "Already paid",
      });
    }
    if (["rejected", "canceled", "cancelled", "canceled_by_click"].includes(status)) {
      return json(200, clickError(-9, "Transaction cancelled"));
    }

    if (Number(payload.error) < 0) {
      await reqRef.set({
        status: "canceled_by_click",
        click: {
          ...(req.click || {}),
          state: "canceled",
          click_trans_id: payload.click_trans_id,
          click_paydoc_id: payload.click_paydoc_id,
          merchant_prepare_id: Number(savedPrepareId),
          cancelError: Number(payload.error),
          cancelErrorNote: payload.error_note,
          canceledAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return json(200, clickError(-9, "Transaction cancelled"));
    }

    const confirmId = Date.now();
    let txError = null;
    await db.runTransaction(async (tx) => {
      const latest = await tx.get(reqRef);
      if (!latest.exists) throw new Error("TOPUP_NOT_FOUND");
      const row = latest.data() || {};
      const rowStatus = String(row.status || "").toLowerCase();
      if (["approved", "success"].includes(rowStatus)) return;
      if (["rejected", "canceled", "cancelled", "canceled_by_click"].includes(rowStatus)) {
        txError = clickError(-9, "Transaction cancelled");
        return;
      }
      const uid = String(row.uid || "").trim();
      if (!uid) {
        txError = clickError(-5, "User does not exist");
        return;
      }
      const userRef = db.doc(`users/${uid}`);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        txError = clickError(-5, "User does not exist");
        return;
      }
      const user = userSnap.data() || {};
      const currentBalance = Number(user.balanceUZS || 0) || 0;
      tx.set(userRef, {
        balanceUZS: currentBalance + Math.round(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(reqRef, {
        status: "approved",
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: row.source || "click_auto",
        provider: "click",
        adminNote: "CLICK orqali avtomatik to‘landi",
        click: {
          ...(row.click || {}),
          state: "paid",
          click_trans_id: payload.click_trans_id,
          click_paydoc_id: payload.click_paydoc_id,
          merchant_prepare_id: Number(savedPrepareId),
          merchant_confirm_id: confirmId,
          amount,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          sign_time: payload.sign_time,
        },
      }, { merge: true });
    });

    if (txError) return json(200, txError);

    return json(200, {
      click_trans_id: payload.click_trans_id,
      merchant_trans_id: payload.merchant_trans_id,
      merchant_confirm_id: confirmId,
      error: 0,
      error_note: "Success",
    });
  } catch (e) {
    return json(200, clickError(-7, String(e.message || e)));
  }
};

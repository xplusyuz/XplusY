const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.verifyPayme = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });

    // TODO: implement Payme signature validation based on your merchant settings/docs.
    const { orderId, providerTxnId, amount } = req.body || {};
    if (!orderId || !providerTxnId) return res.status(400).json({ ok:false, error:"Missing orderId/providerTxnId" });

    const db = admin.firestore();
    const orderRef = db.collection("orders").doc(orderId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error("Order not found");
      const o = snap.data();
      if (o.payment?.status === "paid") return;

      tx.update(orderRef, {
        "payment.status": "paid",
        "payment.providerTxnId": providerTxnId,
        "payment.verifiedAt": admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      tx.set(db.collection("payments").doc(providerTxnId), {
        orderId,
        provider: "payme",
        state: "verified",
        providerTxnId,
        amount: Number(amount || o.totalAmount || 0),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e.message || e) });
  }
});

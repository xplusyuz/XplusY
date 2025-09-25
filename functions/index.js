const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.setAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins');
  }
  const uid = data.uid;
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  return { ok: true };
});

exports.paymentWebhook = functions.https.onRequest(async (req, res) => {
  const { externalRef, amount, status, uid } = req.body || {};
  if (status === 'paid' && uid) {
    const txnRef = db.collection('transactions').doc(externalRef || db.collection('_').doc().id);
    await db.runTransaction(async (t) => {
      const snap = await t.get(txnRef);
      if (!snap.exists || snap.data().status !== 'paid') {
        t.set(txnRef, { uid, amount, status: 'paid', confirmedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        const userRef = db.collection('users').doc(uid);
        t.set(userRef, { balance: admin.firestore.FieldValue.increment(amount) }, { merge: true });
      }
    });
  }
  res.status(200).send('ok');
});

exports.redeemPromo = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const code = String(data.code || '').toUpperCase().trim();
  const amount = Number(data.amount||0);
  if (!code) throw new functions.https.HttpsError('invalid-argument', 'Code required');

  const ref = db.collection('promocodes').doc(code);
  return await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Code not found');
    const p = snap.data();
    if (p.expiresAt && p.expiresAt.toMillis() < Date.now()) throw new functions.https.HttpsError('failed-precondition', 'Code expired');
    if (p.maxUses && (p.usedCount||0) >= p.maxUses) throw new functions.https.HttpsError('resource-exhausted', 'Code usage limit reached');
    if (p.perUserOnce) {
      const rhRef = ref.collection('redemptions').doc(uid);
      const rhSnap = await t.get(rhRef);
      if (rhSnap.exists) throw new functions.https.HttpsError('already-exists', 'Already redeemed');
    }
    const discountPct = Number(p.discountPct||0);
    const discount = Math.round(amount * discountPct / 100);
    const rhRef = ref.collection('redemptions').doc(uid);
    t.set(rhRef, { uid, amount, discountPct, discount, redeemedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    t.set(ref, { usedCount: admin.firestore.FieldValue.increment(1) }, { merge: true });
    return { discount, discountPct };
  });
});

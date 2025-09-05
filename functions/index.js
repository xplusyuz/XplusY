const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
exports.allocateNumericId = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Kirish talab qilinadi.');
  const db = admin.firestore(); const metaRef = db.collection('meta').doc('counters');
  let nextId;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(metaRef);
    const last = snap.exists && snap.data().lastUserNumericId ? snap.data().lastUserNumericId : 1000000;
    nextId = last + 1;
    tx.set(metaRef, { lastUserNumericId: nextId }, { merge: true });
  });
  return { numericId: nextId };
});

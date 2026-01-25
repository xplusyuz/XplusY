/**
 * ADD THIS ROUTE INSIDE YOUR EXISTING /.netlify/functions/api handler
 * so the front-end can call:
 *   POST /.netlify/functions/api?path=/results/submit
 *
 * Firestore structure (requested):
 *   test_code/{testCode}/results/{uid}   // latest result for user
 *   test_code/{testCode}/attempts/{auto} // history
 *
 * NOTE: This snippet assumes you already have:
 *   - admin initialized as Firebase Admin SDK
 *   - db = admin.firestore()
 *   - authFromToken(req) that returns { uid, loginId, ... }
 */
async function handleResultsSubmit(req, res, { admin, db, user }) {
  const body = req.body || {};
  const testCode = String(body.testCode || "").trim();
  if (!testCode) return res.status(400).json({ error: "testCode_required" });

  const uid = String(user?.uid || user?.loginId || user?.id || "").trim();
  if (!uid) return res.status(401).json({ error: "unauthorized" });

  const base = db.collection("test_code").doc(testCode);
  const latestRef = base.collection("results").doc(uid);
  const attemptRef = base.collection("attempts").doc();

  const now = admin.firestore.FieldValue.serverTimestamp();

  const payload = {
    uid,
    testCode,
    testTitle: String(body.testTitle || testCode),
    mode: String(body.mode || "open"),
    score: Number(body.score || 0) || 0,
    correct: Number(body.correct || 0) || 0,
    wrong: Number(body.wrong || 0) || 0,
    timeSpentSec: Number(body.timeSpentSec || 0) || 0,
    penalty: Number(body.penalty || 0) || 0,
    violations: body.violations || null
  };

  await db.runTransaction(async (tx) => {
    tx.set(latestRef, { ...payload, updatedAt: now, lastAttemptId: attemptRef.id }, { merge: true });
    tx.set(attemptRef, { ...payload, createdAt: now });
  });

  return res.status(200).json({ ok: true });
}

module.exports = { handleResultsSubmit };

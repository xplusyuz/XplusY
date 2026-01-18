
// js/06-firebase.js (PATCHED)

async function saveTestResult({ test, results }) {
  const rawMode = (test?.mode || "challenge").toString().trim().toLowerCase();
  const mode = (rawMode === "open" || rawMode === "challenge") ? rawMode : "challenge";

  const user = firebase.auth().currentUser;
  if (!user) return;

  const uid = user.uid;
  const testCode = test.code;
  const db = firebase.firestore();

  // Points calculation
  const gainedPoints = Math.max(1, Math.round(results.finalScore / 100));

  if (mode === "open") {
    // --- OPEN MODE ---
    const awardRef = db.collection("open_awards").doc(`${testCode}__${uid}`);
    const snap = await awardRef.get();

    if (!snap.exists) {
      await awardRef.set({
        uid,
        testCode,
        points: gainedPoints,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await db.collection("users").doc(uid).set({
        points: firebase.firestore.FieldValue.increment(gainedPoints)
      }, { merge: true });
    }

    // Telegram notify
    await fetch('/.netlify/functions/notify-open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        testCode,
        score: results.finalScore,
        correct: results.correctCount,
        wrong: results.wrongCount,
        time: results.timeSpent
      })
    });

    return;
  }

  // --- CHALLENGE MODE ---
  const resRef = db.collection("test_results").doc(`${testCode}__${uid}`);
  const snap = await resRef.get();
  if (snap.exists) return;

  await resRef.set({
    uid,
    testCode,
    score: results.finalScore,
    correct: results.correctCount,
    wrong: results.wrongCount,
    timeSpent: results.timeSpent,
    submittedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("users").doc(uid).set({
    points: firebase.firestore.FieldValue.increment(gainedPoints)
  }, { merge: true });
}

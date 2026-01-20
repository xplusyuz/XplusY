// ==================== FIREBASE MANAGER (compat) ====================
// Bu fayl test tizimining Firebase bilan ishlashini boshqaradi.
// Muhim: 14-app-init.js firebaseManager.initialize() chaqiradi.
// Shuning uchun bu obyekt GLOBAL bo'lishi shart.

const firebaseManager = {
  app: null,
  db: null,
  auth: null,
  _initDone: false,
  _initPromise: null,

  async initialize() {
    if (this._initDone) return true;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        if (!CONFIG?.useFirebase) {
          this._initDone = true;
          return true;
        }

        // Firebase app init
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        this.app = firebase.app();
        this.db = firebase.firestore();

        // Firebase Auth kerak (rules uchun). Agar auth script ulangan bo'lmasa,
        // firebase.auth bo'lmaydi va app-init yiqiladi.
        if (typeof firebase.auth !== 'function') {
          console.warn('⚠️ firebase-auth-compat ulangan emas. Auth bo‘lmasa rules yozishlar bloklanishi mumkin.');
          this._initDone = true;
          return true;
        }

        this.auth = firebase.auth();

        // Anonymous sign-in: test tizimi ichida "signedIn" talabini qondiradi.
        // LeaderMath login alohida bo‘lib qoladi; bu faqat Firestore write uchun.
        try {
          await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (_) {}

        if (!this.auth.currentUser) {
          await this.auth.signInAnonymously();
        }

        this._initDone = true;
        return true;
      } catch (e) {
        console.error('❌ Firebase init xato:', e);
        return false;
      }
    })();

    return this._initPromise;
  },

  // TestManager shu metodni chaqiradi: const status = await firebaseManager.saveTestResult(results)
  // status:
  // {
  //   ok: boolean,
  //   mode: 'open'|'challenge',
  //   pointsDelta: number,
  //   pointsAdded: boolean,
  //   telegramSent: boolean,
  //   reason?: string
  // }
  async saveTestResult(results) {
    try {
      if (!CONFIG?.useFirebase) {
        return { ok: false, mode: 'challenge', pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'firebase_disabled' };
      }
      await this.initialize();

      const test = appState?.testData;
      if (!test?.code) {
        console.warn('saveTestResult: testData yo‘q yoki code topilmadi');
        return { ok: false, mode: 'challenge', pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'missing_test_code' };
      }

      const rawMode = (test?.mode || 'challenge').toString().trim().toLowerCase();
      const mode = (rawMode === 'open' || rawMode === 'challenge') ? rawMode : 'challenge';

      // Auth bo‘lmasa — rules bo‘yicha yozishlar baribir blok bo‘lishi mumkin.
      const user = (this.auth && this.auth.currentUser) ? this.auth.currentUser : null;
      if (!user) {
        console.warn('saveTestResult: auth user topilmadi');
        return { ok: false, mode, pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'no_auth_user' };
      }

      const uid = user.uid;
      const testCode = test.code;
      const db = this.db;

      // Points: sizning talab: ball uid dagi pointsga qo‘shilsin
      // (minimal: 100 ball -> 1 point)
      const gainedPoints = Math.max(1, Math.round((results?.finalScore || 0) / 100));

      let pointsAdded = false;
      let telegramSent = false;

      // OPEN MODE: Firestore'ga natija yozilmaydi, faqat 1-urinish points + Telegram
      if (mode === 'open') {
        // 1) points faqat 1 marta
        const awardRef = db.collection('open_awards').doc(`${testCode}__${uid}`);
        const awardSnap = await awardRef.get();
        if (!awardSnap.exists) {
          await awardRef.set({
            uid,
            testCode,
            points: gainedPoints,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });

          await db.collection('users').doc(uid).set({
            points: firebase.firestore.FieldValue.increment(gainedPoints),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          pointsAdded = true;
        }

        // 2) Telegram xabari
        if (CONFIG.telegramNotifyOpen && CONFIG.telegramEndpoint) {
          try {
            await fetch(CONFIG.telegramEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid,
                testCode,
                score: results?.finalScore ?? 0,
                correct: results?.correctCount ?? 0,
                wrong: results?.wrongCount ?? 0,
                time: appState?.timeSpent ?? results?.timeSpent ?? 0,
                // LeaderMath user info bo‘lsa, telegramga ham qo‘shib yuboramiz
                studentName: appState?.currentStudent?.fullName || '',
                className: appState?.currentClass || '',
              })
            });
            telegramSent = true;
          } catch (e) {
            console.warn('Telegram notify xato:', e);
          }
        }

        return {
          ok: true,
          mode,
          pointsDelta: gainedPoints,
          pointsAdded,
          telegramSent,
          reason: pointsAdded ? 'open_first_award' : 'open_already_awarded'
        };
      }

      // CHALLENGE MODE: test_results + points
      const resRef = db.collection('test_results').doc(`${testCode}__${uid}`);
      const existsSnap = await resRef.get();
      if (existsSnap.exists) {
        // singleAttempt bo‘lsa, bu false qaytarib UI’da xabar chiqaramiz
        return { ok: false, mode, pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'challenge_already_submitted' };
      }

      await resRef.set({
        uid,
        testCode,
        score: results?.finalScore ?? 0,
        correct: results?.correctCount ?? 0,
        wrong: results?.wrongCount ?? 0,
        timeSpent: appState?.timeSpent ?? results?.timeSpent ?? 0,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('users').doc(uid).set({
        points: firebase.firestore.FieldValue.increment(gainedPoints),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      pointsAdded = true;

      return {
        ok: true,
        mode,
        pointsDelta: gainedPoints,
        pointsAdded,
        telegramSent: false,
        reason: 'challenge_saved'
      };
    } catch (e) {
      console.error('❌ saveTestResult xato:', e);
      return { ok: false, mode: 'challenge', pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'error' };
    }
  }
};

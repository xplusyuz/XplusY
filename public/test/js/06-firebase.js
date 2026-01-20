// ==================== RESULTS MANAGER (API-based) ====================
// Old file name kept for compatibility: 06-firebase.js
// Endi test natijalari Firebase client SDK orqali EMAS, Netlify API orqali yoziladi.
// Bu "Missing or insufficient permissions" muammosini butunlay yo'q qiladi.

const firebaseManager = {
  _initDone: true,
  async initialize() { return true; },

  /**
   * TestManager shu metodni chaqiradi: const status = await firebaseManager.saveTestResult(results)
   * status:
   * {
   *   ok: boolean,
   *   mode: 'open'|'challenge',
   *   pointsDelta: number,
   *   pointsAdded: boolean,
   *   telegramSent: boolean,
   *   reason?: string
   * }
   */
  async saveTestResult(results) {
    try {
      const test = appState?.testData;
      if (!test?.code) {
        console.warn('saveTestResult: testData yo‘q yoki code topilmadi');
        return { ok: false, mode: 'challenge', pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'missing_test_code' };
      }

      const rawMode = (test?.mode || 'challenge').toString().trim().toLowerCase();
      const mode = (rawMode === 'open' || rawMode === 'challenge') ? rawMode : 'challenge';

      // OPEN: cheksiz yechish — natijani faqat UI'da ko'rsatamiz, serverga yozmaymiz.
      if (mode === 'open') {
        return { ok: true, mode, pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'open_no_write' };
      }

      // CHALLENGE: 1 ta urinish + points (API server tomonda yozadi)
      if (!window.authUtils?.fetchApi) {
        return { ok: false, mode, pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'no_api' };
      }

      // Javoblar: appState.userAnswers da variant uchun index, open uchun text bo'ladi.
      const answers = Array.isArray(appState?.userAnswers) ? appState.userAnswers : [];

      const payload = {
        id: String(test.code || test.id || '').trim(),
        answers,
        timeSpentSec: Math.max(0, Math.floor(Number(appState?.timeSpent || results?.timeSpent || 0) || 0))
      };

      const res = await authUtils.fetchApi('tests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = data?.error || data?.message || `HTTP_${res.status}`;
        // old UI reason mapping
        const reason = /avval topshirgansiz/i.test(msg) ? 'challenge_already_submitted' : 'error';
        return { ok: false, mode, pointsDelta: 0, pointsAdded: false, telegramSent: false, reason };
      }

      return {
        ok: !!data?.ok,
        mode: data?.mode || mode,
        pointsDelta: Number(data?.pointsDelta || 0) || 0,
        pointsAdded: !!data?.pointsAdded,
        telegramSent: !!data?.telegramSent,
        reason: data?.mode === 'challenge' ? 'challenge_saved' : 'open_no_write'
      };
    } catch (e) {
      console.error('❌ saveTestResult xato:', e);
      return { ok: false, mode: 'challenge', pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'error' };
    }
  }
};

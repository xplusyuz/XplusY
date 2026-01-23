// ==================== RESULT MANAGER (API-based) ====================
// Compatibility: the app calls `firebaseManager.saveTestResult(results)`.
// This implementation uses server API only (no Firebase client writes).

(function(){
  function getToken(){
    try { return localStorage.getItem('lm_token') || ''; } catch (_) { return ''; }
  }

  function getApiCandidates(){
    let stored = '';
    try { stored = localStorage.getItem('lm_api_base') || ''; } catch (_) {}
    const c = [];
    if (stored) c.push(stored);
    c.push('/.netlify/functions/api');
    c.push('/api');
    return [...new Set(c)];
  }

  async function apiFetch(path, { method='GET', body=null, token='' } = {}){
    const candidates = getApiCandidates();
    let lastErr = null;
    const p = String(path || '').startsWith('/') ? String(path || '') : '/' + String(path || '');

    for (const base of candidates){
      try {
        const u = new URL(base, location.origin);
        u.searchParams.set('path', p);
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = 'Bearer ' + token;

        const res = await fetch(u.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : null,
        });

        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const data = ct.includes('application/json')
          ? await res.json().catch(() => ({}))
          : { raw: await res.text().catch(() => '') };

        if (!res.ok){
          const err = new Error(data?.error || data?.message || ('HTTP ' + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }

        try { localStorage.setItem('lm_api_base', base); } catch (_) {}
        return data;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('API error');
  }

  function buildAnswersForApi(test){
    const qs = Array.isArray(test?.questions) ? test.questions : [];
    const out = new Array(qs.length).fill('');

    for (let i = 0; i < qs.length; i++){
      const q = qs[i] || {};
      const ua = (window.appState && Array.isArray(appState.userAnswers)) ? appState.userAnswers[i] : undefined;

      // OPEN
      if ((q.type || '').toLowerCase() === 'open'){
        out[i] = (ua == null) ? '' : String(ua);
        continue;
      }

      // MCQ/VARIANT
      if (typeof ua === 'number'){
        const shuffled = (window.appState && appState.shuffledOptionsMap) ? appState.shuffledOptionsMap[i] : null;
        const opts = Array.isArray(shuffled) && shuffled.length ? shuffled : (Array.isArray(q.options) ? q.options : []);
        out[i] = (opts[ua] == null) ? '' : String(opts[ua]);
      } else {
        out[i] = (ua == null) ? '' : String(ua);
      }
    }

    return out;
  }

  // ✅ ENDI 100 GA BO‘LINMAYDI: ball qancha bo‘lsa, shuncha points
  function safePointsDeltaFromFinalScore(finalScore){
    const fs = Number(finalScore);
    if (!Number.isFinite(fs) || fs <= 0) return 0;
    return Math.floor(fs); // 7.5 -> 7, 12 -> 12
  }

  // ✅ OPEN mode tugaganda Telegram endpointga yuborish
  async function notifyTelegramOpen({ token, payload }){
    try {
      const endpoint = (window.CONFIG && CONFIG.telegramEndpoint) ? String(CONFIG.telegramEndpoint) : '/.netlify/functions/notify-open';
      if (!endpoint) return false;

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload || {})
      });

      if (!res.ok) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function buildTelegramPayload({ test, results, mode }){
    const testId = String(test?.id || test?.docId || test?.code || '').trim();
    const testCode = String(test?.code || testId || '').trim();
    const title = String(test?.title || test?.name || testCode || 'Test').trim();

    const timeSpentSec = Number(window.appState?.timeSpent || 0) || 0;
    const v = window.appState?.violations || { windowSwitch: 0, minorViolations: 0, fullScreenExit: 0 };

    return {
      kind: 'open_test_finished',
      mode,
      testId,
      testCode,
      title,
      score: {
        finalScore: Number(results?.finalScore || 0) || 0,
        totalScore: Number(results?.totalScore || 0) || 0,
        penalty: Number(results?.penalty || 0) || 0,
        correctCount: Number(results?.correctCount || 0) || 0,
        wrongCount: Number(results?.wrongCount || 0) || 0
      },
      timeSpentSec,
      violations: {
        windowSwitch: Number(v.windowSwitch || 0) || 0,
        minorViolations: Number(v.minorViolations || 0) || 0,
        fullScreenExit: Number(v.fullScreenExit || 0) || 0
      },
      // foydali: qaysi sahifadan kelgani
      page: location?.href || ''
    };
  }

  window.firebaseManager = {
    _initDone: false,

    async initialize(){
      this._initDone = true;
      return true;
    },

    async saveTestResult(results){
      let telegramSent = false;

      try {
        await this.initialize();

        const test = window.appState?.testData;
        const testId = String(test?.id || test?.docId || test?.code || '').trim();
        const testCode = String(test?.code || testId || '').trim();
        const mode = String(test?.mode || 'open').toLowerCase() === 'challenge' ? 'challenge' : 'open';

        const token = getToken();

        // 🔔 OPEN mode bo'lsa — natijani Telegramga yuborishga harakat qilamiz
        if (mode === 'open' && window.CONFIG && CONFIG.telegramNotifyOpen) {
          const payload = buildTelegramPayload({ test, results, mode });
          telegramSent = await notifyTelegramOpen({ token, payload });
        }

        // Token yo'q bo'lsa: API'ga points yozolmaymiz, lekin Telegram urinishini qaytaramiz
        if (!token){
          return {
            ok: false,
            mode,
            pointsDelta: 0,
            pointsAdded: false,
            telegramSent,
            reason: 'no_token'
          };
        }

        // 1) Try server-side tests/submit (works for Firestore-backed tests)
        if (testId){
          try {
            const answers = buildAnswersForApi(test);
            const timeSpentSec = Number(window.appState?.timeSpent || 0) || 0;
            const resp = await apiFetch('/tests/submit', {
              method: 'POST',
              token,
              body: { id: testId, answers, timeSpentSec }
            });

            const score = Number(resp?.result?.score || 0) || 0;
            return {
              ok: true,
              mode,
              pointsDelta: (mode === 'challenge') ? score : 0,
              pointsAdded: (mode === 'challenge') ? (score > 0) : false,
              telegramSent,
              reason: 'submitted_via_api'
            };
          } catch (e) {
            const msg = String(e?.message || '');
            const st = Number(e?.status || 0) || 0;
            if (!(st === 404 || msg.toLowerCase().includes('topilmadi'))){
              throw e;
            }
          }
        }

        // 2) Fallback: local JSON tests — submit points only via /games/submit
        const pointsDelta = safePointsDeltaFromFinalScore(results?.finalScore);
        if (pointsDelta <= 0){
          return { ok:true, mode, pointsDelta:0, pointsAdded:false, telegramSent, reason:'no_points' };
        }

        await apiFetch('/games/submit', {
          method: 'POST',
          token,
          body: {
            gameId: 'test_' + (testCode || 'local'),
            xp: Math.floor(Number(results?.finalScore || 0) || 0),
            pointsDelta
          }
        });

        return { ok:true, mode, pointsDelta, pointsAdded:true, telegramSent, reason:'local_test_points' };
      } catch (e) {
        console.error('saveTestResult error:', e);
        return { ok:false, mode:'challenge', pointsDelta:0, pointsAdded:false, telegramSent:false, reason:'error' };
      }
    }
  };
})();

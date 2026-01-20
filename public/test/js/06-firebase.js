// ==================== DATA MANAGER (API MODE) ====================
// File name kept for backward compatibility.
// IMPORTANT: This project no longer uses Firebase client SDK.
// All persistence goes through Netlify API.
//
// Global required by 14-app-init.js: window.firebaseManager.initialize()

(function(){
  'use strict';

  async function safeJson(res){
    try { return await res.json(); } catch (_) { return null; }
  }

  function getTestMeta(){
    const t = (window.appState && window.appState.testData) ? window.appState.testData : null;
    return t && typeof t === 'object' ? t : null;
  }

  function getMode(){
    const t = getTestMeta();
    const m = String((t && t.mode) ? t.mode : 'challenge').trim().toLowerCase();
    return (m === 'open' || m === 'challenge') ? m : 'challenge';
  }

  function getTestId(){
    const t = getTestMeta();
    return String((t && (t.code || t.id)) ? (t.code || t.id) : '').trim();
  }

  function getAnswersArray(){
    // Prefer runtime state answers (selected options / typed open answers)
    const a = (window.appState && Array.isArray(window.appState.userAnswers)) ? window.appState.userAnswers : null;
    if (a) return a;
    // Some builds may keep answers on results
    return [];
  }

  function getTimeSpentSec(fallback){
    const v = (window.appState && typeof window.appState.timeSpent === 'number') ? window.appState.timeSpent : null;
    const n = Number(v ?? fallback ?? 0);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  async function submitToApi(payload){
    // Prefer global authUtils if present, else use leaderMathAuth token directly.
    let res;
    if (window.authUtils && typeof window.authUtils.fetchApi === 'function') {
      res = await window.authUtils.fetchApi('tests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      const tokenKey = (window.leaderMathAuth && window.leaderMathAuth.tokenKey) ? window.leaderMathAuth.tokenKey : 'lm_token';
      let token = '';
      try { token = localStorage.getItem(tokenKey) || ''; } catch (_) { token = ''; }
      const u = new URL('/.netlify/functions/api', location.origin);
      u.searchParams.set('path', 'tests/submit');
      res = await fetch(u.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: JSON.stringify(payload)
      });
    }
    const data = await safeJson(res);
    return { ok: res.ok, status: res.status, data };
  }

  async function notifyOpen(payload){
    try{
      const endpoint = (window.CONFIG && window.CONFIG.telegramEndpoint) ? window.CONFIG.telegramEndpoint : '/.netlify/functions/notify-open';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return true;
    }catch(_){
      return false;
    }
  }

  // Expose the expected global
  window.firebaseManager = {
    _initDone: false,

    async initialize(){
      this._initDone = true;
      return true;
    },

    // Called by test manager at finish
    // Must return:
    // { ok, mode, pointsDelta, pointsAdded, telegramSent, reason }
    async saveTestResult(results){
      try{
        const mode = getMode();
        const testId = getTestId();
        if (!testId) {
          return { ok:false, mode, pointsDelta: 0, pointsAdded:false, telegramSent:false, reason:'missing_test_code' };
        }

        // OPEN mode: do not write submissions, optional telegram notify only
        if (mode === 'open') {
          let telegramSent = false;
          if (window.CONFIG && window.CONFIG.telegramNotifyOpen) {
            telegramSent = await notifyOpen({
              testCode: testId,
              score: Number(results?.finalScore ?? 0) || 0,
              correct: Number(results?.correctCount ?? 0) || 0,
              wrong: Number(results?.wrongCount ?? 0) || 0,
              time: getTimeSpentSec(results?.timeSpent ?? 0),
            });
          }
          return { ok:true, mode, pointsDelta: 0, pointsAdded:false, telegramSent, reason:'open_no_persist' };
        }

        // CHALLENGE mode: submit to API (server scores and increments points)
        const answers = getAnswersArray();
        const payload = {
          id: testId,
          answers,
          timeSpentSec: getTimeSpentSec(results?.timeSpent ?? 0)
        };

        const out = await submitToApi(payload);
        if (!out.ok) {
          let reason = out.data?.error || out.data?.message || 'submit_failed';
          if (out.status === 404) reason = 'api_not_found';
          if (out.status === 401 || out.status === 403) reason = 'auth_required';
          return { ok:false, mode, pointsDelta: 0, pointsAdded:false, telegramSent:false, reason, status: out.status };
        }

        const score = Number(out.data?.result?.score ?? out.data?.result?.points ?? 0) || 0;
        return { ok:true, mode, pointsDelta: score, pointsAdded:true, telegramSent:false, reason:'challenge_saved_api' };
      }catch(e){
        console.error('saveTestResult error:', e);
        return { ok:false, mode:'challenge', pointsDelta: 0, pointsAdded:false, telegramSent:false, reason:'error' };
      }
    }
  };
})();

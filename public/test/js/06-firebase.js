// ==================== API MANAGER (firebaseManager compat) ====================
// Oldingi test tizimi "firebaseManager" nomidan foydalangan.
// Endi esa Firestore client-config ishlatmaymiz — hammasi Netlify API orqali.
// Shu sababli nomni saqlab qoldik (butun kodni qayta yozmaslik uchun).

const firebaseManager = {
  _initDone: false,

  async initialize() {
    // API rejimda init shart emas, lekin eski kod yiqilmasin.
    this._initDone = true;
    return true;
  },

  _apiUrl(path) {
    const u = new URL(CONFIG.apiBase || '/.netlify/functions/api', location.origin);
    u.searchParams.set('path', path);
    return u.toString();
  },

  async _fetch(path, options) {
    // authUtils bo'lsa — Bearer tokenni avtomatik qo'shadi.
    if (window.authUtils?.fetchApi) {
      return await window.authUtils.fetchApi(path, options);
    }
    // Fallback (tokenni o'zi qo'shmaydi)
    return await fetch(this._apiUrl(path), options);
  },

  // ===== Test yuklash (API) =====
  async loadTest(codeOrId) {
    const id = String(codeOrId || '').trim();
    if (!id) return null;

    const url = new URL(this._apiUrl(CONFIG.apiPaths?.getTest || 'tests/get'));
    url.searchParams.set('id', id);
    // Challenge bo'lsa accessCode kerak bo'lishi mumkin.
    // UI'ga keyinroq qo'shish mumkin; hozircha URL'dan olamiz.
    const qp = new URLSearchParams(location.search);
    const access = qp.get('access') || qp.get('pass') || '';
    if (access) url.searchParams.set('code', access);

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Test yuklab bo‘lmadi');
    return data?.test || null;
  },

  // Old fallback: sinf/o'quvchi bazasi. (API da yo'q — bo'sh qaytaramiz)
  async loadClasses() { return []; },
  async loadStudents() { return []; },

  // ===== Attempt lock (server-side) =====
  async startAttempt(testId) {
    const id = String(testId || '').trim();
    if (!id) throw new Error('id kerak');
    const res = await this._fetch(CONFIG.apiPaths?.startAttempt || 'tests/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Attempt yaratib bo‘lmadi');
    return data?.attempt || null;
  },

  async getAttempt(testId) {
    const id = String(testId || '').trim();
    if (!id) return null;
    const url = new URL(this._apiUrl(CONFIG.apiPaths?.attemptStatus || 'tests/attempt'));
    url.searchParams.set('id', id);
    const token = window.authUtils?.getToken?.() || '';
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // token yo'q bo'lsa 401 bo'lishi mumkin; UI o'zi hal qiladi
      return null;
    }
    return data || null;
  },

  async cancelAttempt(testId, reason) {
    const id = String(testId || '').trim();
    if (!id) return;
    try {
      await this._fetch(CONFIG.apiPaths?.cancelAttempt || 'tests/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason: String(reason || 'cancelled').slice(0, 200) })
      });
    } catch (_) {}
  },

  // ===== Submit (points only for challenge on server) =====
  async saveTestResult(results) {
    const test = appState?.testData;
    const mode = String(test?.mode || 'open').toLowerCase();

    // OPEN: serverga yozmaymiz (cheksiz ishlashi uchun)
    if (mode === 'open') {
      let telegramSent = false;
      if (CONFIG.telegramNotifyOpen && CONFIG.telegramEndpoint) {
        try {
          await fetch(CONFIG.telegramEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              testId: test?.id || test?.code || '',
              testCode: test?.code || test?.id || '',
              score: results?.finalScore ?? 0,
              correct: results?.correctCount ?? 0,
              wrong: results?.wrongCount ?? 0,
              time: appState?.timeSpent ?? results?.timeSpent ?? 0,
              studentName: appState?.currentStudent?.fullName || ''
            })
          });
          telegramSent = true;
        } catch (_) {}
      }
      return { ok: true, mode: 'open', pointsDelta: 0, pointsAdded: false, telegramSent, reason: 'open_no_store' };
    }

    // CHALLENGE: submit via API (yagona urinish + points serverda)
    try {
      const id = String(test?.id || test?.code || '').trim();
      if (!id) return { ok: false, mode: 'challenge', pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: 'missing_test_id' };

      const res = await this._fetch(CONFIG.apiPaths?.submit || 'tests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          answers: results?.answers || appState?.answers || [],
          timeSpentSec: Number(appState?.timeSpent || results?.timeSpent || 0) || 0
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, mode: 'challenge', pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: data?.error || 'submit_failed' };
      }
      // API result: {score, correct, wrong, total}
      const score = Number(data?.result?.score ?? 0) || 0;
      return { ok: true, mode: 'challenge', pointsDelta: score, pointsAdded: true, telegramSent: false, reason: 'challenge_saved' };
    } catch (e) {
      return { ok: false, mode: 'challenge', pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: e?.message || 'error' };
    }
  }
};

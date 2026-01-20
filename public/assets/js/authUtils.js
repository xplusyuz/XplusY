/**
 * authUtils — LeaderMath yagona tokenli login helper
 * - lm_token localStorage
 * - auth/me orqali userni avtomatik tortadi
 * - API base auto-fallback: /.netlify/functions/api -> /api (va eslab qoladi)
 */
(function (global) {
  'use strict';

  const LS_TOKEN = 'lm_token';
  const LS_API = 'lm_api_base';

  function safeGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function getBases() {
    const all = ['/.netlify/functions/api', '/api'];
    const saved = safeGet(LS_API);
    if (saved && all.includes(saved)) return [saved, ...all.filter((x) => x !== saved)];
    return all;
  }

  function buildUrl(base, path) {
    const u = new URL(base, location.origin);
    u.searchParams.set('path', String(path || '').replace(/^\/+/, ''));
    return u.toString();
  }

  async function safeJson(res) {
    try { return await res.json(); } catch (_) { return null; }
  }

  async function fetchMeOnce(base, token) {
    const url = buildUrl(base, 'auth/me');
    const res = await fetch(url, { method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    return res;
  }

  const authUtils = {
    getToken() { return safeGet(LS_TOKEN); },
    setToken(t) { safeSet(LS_TOKEN, String(t || '')); },
    clearToken() { safeRemove(LS_TOKEN); },

    async me() {
      const token = this.getToken();
      if (!token) return null;

      for (const base of getBases()) {
        try {
          const res = await fetchMeOnce(base, token);
          if (!res.ok) {
            // Token invalid
            if (res.status === 401 || res.status === 403) {
              this.clearToken();
              return null;
            }
            // Try fallback on 404/502/503
            if ([404, 502, 503].includes(res.status)) continue;
            return null;
          }
          // Remember working base
          safeSet(LS_API, base);
          const data = await safeJson(res);
          return data?.user || data?.data?.user || null;
        } catch (_) {
          continue;
        }
      }
      return null;
    },

    async requireUser(opts) {
      const o = { redirect: true, appHome: '/app.html', returnTo: '', ...(opts || {}) };
      const user = await this.me();
      if (user) return user;

      if (o.returnTo) {
        try { sessionStorage.setItem('lm_return_to', o.returnTo); } catch (_) {}
      }

      if (o.redirect) {
        const u = new URL(o.appHome || '/app.html', location.origin);
        u.searchParams.set('login', '1');
        if (o.returnTo) u.searchParams.set('returnTo', o.returnTo);
        location.replace(u.toString());
        return null;
      }

      const err = new Error('AUTH_REQUIRED');
      err.code = 'AUTH_REQUIRED';
      throw err;
    },

    toStudent(user) {
      if (!user) return null;
      const fullName = (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.loginId || 'Foydalanuvchi').trim();
      return {
        id: user.loginId || user.id || user.uid || 'unknown',
        fullName,
        numericId: user.numericId ?? user.numericID ?? user.studentId ?? null,
        _lm: user,
      };
    },

    logout(redirectTo) {
      this.clearToken();
      const target = redirectTo || '/app.html';
      const u = new URL(target, location.origin);
      u.searchParams.set('login', '1');
      location.href = u.toString();
    }
  };

  global.authUtils = authUtils;
})(typeof window !== 'undefined' ? window : this);

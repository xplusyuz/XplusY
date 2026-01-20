/**
 * authUtils — LeaderMath kirish tizimiga mos (lm_token + Netlify API)
 *
 * Asosiy g'oya:
 *  - Saytga kirish qilinsa localStorage'da `lm_token` bo'ladi.
 *  - `/.netlify/functions/api?path=auth/me` ga Bearer token yuborib user olinadi.
 *  - Token bo'lmasa yoki yaroqsiz bo'lsa: mehmon YO'Q (user = null).
 *
 * Global: window.authUtils
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    tokenKey: 'lm_token',
    apiBase: '/.netlify/functions/api',
    apiFallback: '/api',
    mePath: 'auth/me',
    // Token yo'q yoki yaroqsiz bo'lsa qaytish sahifasi (login modali odatda shu yerda)
    appHome: '/app.html',
  };

  function safeGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (_) { return ''; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function buildApiUrl(apiBase, path) {
    const u = new URL(apiBase, location.origin);
    u.searchParams.set('path', path);
    return u.toString();
  }

  async function fetchApiWithFallback(cfg, path, options){
    const primary = buildApiUrl(cfg.apiBase, path);
    const res1 = await fetch(primary, options);
    if (res1.status === 404 && cfg.apiFallback) {
      try{
        const alt = buildApiUrl(cfg.apiFallback, path);
        return await fetch(alt, options);
      }catch(_){
        return res1;
      }
    }
    return res1;
  }

  async function safeJson(res) {
    try { return await res.json(); } catch (_) { return null; }
  }

  const authUtils = {
    // sozlamalarni kerak bo'lsa override qilish mumkin: authUtils.configure({tokenKey:'...'})
    _cfg: { ...DEFAULTS },

    configure(partial) {
      if (partial && typeof partial === 'object') {
        this._cfg = { ...this._cfg, ...partial };
      }
      return this._cfg;
    },

    getToken() {
      return safeGet(this._cfg.tokenKey);
    },

    setToken(token) {
      safeSet(this._cfg.tokenKey, String(token || ''));
    },

    clearToken() {
      safeRemove(this._cfg.tokenKey);
    },

    apiUrl(path) {
      return buildApiUrl(this._cfg.apiBase, path);
    },

    /**
     * LeaderMath user info (auth/me)
     * @returns {Promise<object|null>} user
     */
    async me() {
      const token = this.getToken();
      if (!token) return null;

      const res = await fetchApiWithFallback(this._cfg, this._cfg.mePath, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) this.clearToken();
        return null;
      }

      const data = await safeJson(res);
      return data?.user || data?.data?.user || null;
    },

    /**
     * Auth header bilan API chaqirish.
     */
    async fetchApi(path, options) {
      const token = this.getToken();
      const headers = new Headers((options && options.headers) || {});
      if (token) headers.set('Authorization', 'Bearer ' + token);

      const res = await fetchApiWithFallback(this._cfg, path, {
        ...(options || {}),
        headers
      });

      // Token yaroqsiz bo'lsa tozalaymiz
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        this.clearToken();
      }
      return res;
    },

    /**
     * Login shart: user topilmasa o'yin/bo'limni bloklash uchun.
     * - redirect=false bo'lsa: exception tashlaydi
     * - redirect=true bo'lsa: appHome ga qaytaradi
     */
    async requireUser(opts) {
      const cfg = this._cfg;
      const o = {
        redirect: true,
        appHome: cfg.appHome,
        // qaytish URL ni saqlab qo'yish (app login bo'lgach qaytishi uchun)
        returnTo: '',
        ... (opts || {})
      };

      const user = await this.me();
      if (user) return user;

      // returnTo ni saqlab qo'yamiz (app tarafda o'qib, login'dan keyin qaytarish mumkin)
      if (o.returnTo) {
        try { sessionStorage.setItem('lm_return_to', o.returnTo); } catch (_) {}
      }

      if (o.redirect) {
        // appHome ga "?login=1" bilan borish — app shu paramni ko'rib login modalni ochishi mumkin
        const u = new URL(o.appHome || cfg.appHome || '/app.html', location.origin);
        u.searchParams.set('login', '1');
        if (o.returnTo) u.searchParams.set('returnTo', o.returnTo);
        location.replace(u.toString());
        // navigatsiya ketadi, lekin tiplar uchun:
        return null;
      }

      const err = new Error('AUTH_REQUIRED');
      err.code = 'AUTH_REQUIRED';
      throw err;
    },

    /**
     * Game/test ichida ishlatish uchun soddalashtirilgan student obyekt.
     */
    toStudent(user) {
      if (!user) return null;
      const fullName = (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.loginId || 'Foydalanuvchi').trim();
      return {
        id: user.loginId || user.id || user.uid || 'unknown',
        fullName,
        numericId: user.numericId ?? user.numericID ?? user.studentId ?? null,
        _lm: user
      };
    },

    /**
     * Logout (tokenni tozalaydi) va appHome'ga qaytaradi.
     */
    logout(redirectTo) {
      this.clearToken();
      const target = redirectTo || this._cfg.appHome || '/app.html';
      const u = new URL(target, location.origin);
      u.searchParams.set('login', '1');
      location.href = u.toString();
    }
  };

  // globalga chiqaramiz
  global.authUtils = authUtils;

})(typeof window !== 'undefined' ? window : this);

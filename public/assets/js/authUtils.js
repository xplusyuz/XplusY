/**
 * authUtils v2 — LeaderMath kirish tizimi bilan maksimal moslik
 * - Avval saytning /assets/js/auth.js va /assets/js/api.js modullarini dynamic import qiladi
 * - Agar topilmasa: localStorage lm_token + fetch orqali auth/me
 * - Mehmon YO'Q: token bo'lmasa user=null
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    tokenKey: 'lm_token',
    apiBase: '/.netlify/functions/api',
    mePath: 'auth/me',
    appHome: '/app.html',
    // saytning modul yo'llari (bo'lsa ishlatamiz)
    authModule: '/assets/js/auth.js',
    apiModule: '/assets/js/api.js',
  };

  function safeGet(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
  function safeSet(key, v) { try { localStorage.setItem(key, v); } catch {} }
  function safeRemove(key) { try { localStorage.removeItem(key); } catch {} }

  function cleanPath(p){
    return String(p||'').replace(/^\//,'');
  }

  function buildApiUrl(apiBase, path) {
    const u = new URL(apiBase, location.origin);
    u.searchParams.set('path', cleanPath(path));
    return u.toString();
  }

  async function safeJson(res){
    const ct = (res.headers.get('content-type')||'').toLowerCase();
    if(ct.includes('application/json')){
      try { return await res.json(); } catch { return null; }
    }
    try { return { raw: await res.text() }; } catch { return null; }
  }

  async function tryImport(url){
    try { return await import(url); } catch { return null; }
  }

  const authUtils = {
    _cfg: { ...DEFAULTS },
    _mod: { auth:null, api:null, loaded:false, loadPromise:null },

    configure(partial){
      if(partial && typeof partial === 'object') this._cfg = { ...this._cfg, ...partial };
      return this._cfg;
    },

    async _ensureModules(){
      if(this._mod.loaded) return this._mod;
      if(this._mod.loadPromise) return this._mod.loadPromise;
      this._mod.loadPromise = (async ()=>{
        const a = await tryImport(this._cfg.authModule);
        const p = await tryImport(this._cfg.apiModule);
        this._mod.auth = a;
        this._mod.api = p;
        this._mod.loaded = true;
        return this._mod;
      })();
      return this._mod.loadPromise;
    },

    getToken(){
      // Avval sayt auth modulidan
      // auth.js: export function getToken(){...}
      const m = this._mod.auth;
      if(m && typeof m.getToken === 'function'){
        try { return m.getToken() || ''; } catch {}
      }
      // fallback
      return safeGet(this._cfg.tokenKey);
    },

    setToken(t){
      const m = this._mod.auth;
      if(m && typeof m.setToken === 'function'){
        try { return m.setToken(t); } catch {}
      }
      safeSet(this._cfg.tokenKey, String(t||''));
    },

    clearToken(){
      const m = this._mod.auth;
      if(m && typeof m.clearToken === 'function'){
        try { return m.clearToken(); } catch {}
      }
      safeRemove(this._cfg.tokenKey);
    },

    apiUrl(path){
      return buildApiUrl(this._cfg.apiBase, path);
    },

    async me(){
      await this._ensureModules();
      const token = this.getToken();
      if(!token) return null;

      // Avval sayt api modulidan foydalanamiz (api(path,{token}))
      const apiMod = this._mod.api;
      if(apiMod && typeof apiMod.api === 'function'){
        try{
          const r = await apiMod.api(this._cfg.mePath, { method:'GET', token });
          return r?.user || r?.data?.user || null;
        }catch(e){
          // fallback fetch
        }
      }

      const url = this.apiUrl(this._cfg.mePath);
      const res = await fetch(url, { method:'GET', headers:{ Authorization:'Bearer '+token } });
      if(!res.ok){
        if(res.status===401 || res.status===403) this.clearToken();
        return null;
      }
      const data = await safeJson(res);
      return data?.user || data?.data?.user || null;
    },

    async fetchApi(path, options){
      await this._ensureModules();
      const token = this.getToken();

      // Agar sayt api moduli bo'lsa, shuni ishlatamiz (u pathni clean qiladi)
      const apiMod = this._mod.api;
      if(apiMod && typeof apiMod.api === 'function'){
        // api() json qaytaradi yoki throw qiladi
        const method = (options && options.method) || 'GET';
        const headers = (options && options.headers) || {};
        const bodyStr = (options && options.body) || null;
        let body = null;
        if(bodyStr && typeof bodyStr === 'string'){
          try{ body = JSON.parse(bodyStr); }catch{ body = bodyStr; }
        }else if(bodyStr) body = bodyStr;

        // api() token paramni alohida oladi
        const data = await apiMod.api(cleanPath(path), { method, token, body });
        // fake Response-like object
        return { ok:true, status:200, json: async()=>data, _data:data };
      }

      const url = this.apiUrl(path);
      const headers = new Headers((options && options.headers) || {});
      if(token) headers.set('Authorization','Bearer '+token);
      const res = await fetch(url, { ...(options||{}), headers });
      if(!res.ok && (res.status===401 || res.status===403)) this.clearToken();
      return res;
    },

    async requireUser(opts){
      const o = { redirect:true, appHome:this._cfg.appHome, returnTo:'', ...(opts||{}) };
      const user = await this.me();
      if(user) return user;

      if(o.returnTo){
        try { sessionStorage.setItem('lm_return_to', o.returnTo); } catch {}
      }
      if(o.redirect){
        const u = new URL(o.appHome || this._cfg.appHome || '/app.html', location.origin);
        u.searchParams.set('login','1');
        if(o.returnTo) u.searchParams.set('returnTo', o.returnTo);
        location.replace(u.toString());
        return null;
      }
      const err = new Error('AUTH_REQUIRED'); err.code='AUTH_REQUIRED'; throw err;
    },

    toStudent(user){
      if(!user) return null;
      const fullName = (user.name || `${user.firstName||''} ${user.lastName||''}`.trim() || user.loginId || 'Foydalanuvchi').trim();
      return { id:user.loginId||user.id||user.uid||'unknown', fullName, numericId:user.numericId??null, _lm:user };
    },

    async submitGame(gameId, xp, pointsDelta, meta){
      const body = {
        gameId: String(gameId || 'game001'),
        xp: Math.max(0, Math.floor(Number(xp||0)||0)),
        pointsDelta: Math.max(0, Math.floor(Number(pointsDelta||0)||0)),
        meta: meta && typeof meta === 'object' ? meta : null
      };
      const res = await this.fetchApi('/games/submit', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      // res may be fake object if apiMod used
      if(res.ok && res._data) return res._data;

      const data = await (async()=>{ try { return await res.json(); } catch { return null; } })();
      if(!res.ok){
        const msg = data?.error || ('Submit failed: ' + res.status);
        throw new Error(msg);
      }
      return data;
    },

    async submitGame001(xp, meta){
      const xpInt = Math.max(0, Math.floor(Number(xp||0)||0));
      const pointsDelta = Math.round(xpInt/100);
      return this.submitGame('game001', xpInt, pointsDelta, meta);
    },

    logout(redirectTo){
      this.clearToken();
      const target = redirectTo || this._cfg.appHome || '/app.html';
      const u = new URL(target, location.origin);
      u.searchParams.set('login','1');
      location.href = u.toString();
    }
  };

  // Eager-load modules (best-effort) so game pages can call immediately
  authUtils._ensureModules();

  global.authUtils = authUtils;
})(typeof window !== 'undefined' ? window : this);

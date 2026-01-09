/**
 * authUtils v3 — user profilni Firestore'dan qaytaradi (users/me)
 * - Token -> loginId (requireToken) -> users/{loginId} doc
 * - Fallback: auth/me
 */
(function (global) {
  'use strict';

  const CFG = {
    tokenKey: 'lm_token',
    apiBase: '/.netlify/functions/api',
    appHome: '/app.html',
    // avval shu endpoint
    mePrimary: 'users/me',
    // fallback
    meFallback: 'auth/me',
    authModule: '/assets/js/auth.js',
    apiModule: '/assets/js/api.js',
  };

  function safeGet(key){ try{return localStorage.getItem(key)||'';}catch{return'';} }
  function safeSet(key,v){ try{localStorage.setItem(key,v);}catch{} }
  function safeRemove(key){ try{localStorage.removeItem(key);}catch{} }

  const cleanPath = (p)=>String(p||'').replace(/^\//,'');
  const apiUrl = (p)=> {
    const u = new URL(CFG.apiBase, location.origin);
    u.searchParams.set('path', cleanPath(p));
    return u.toString();
  };

  async function tryImport(url){ try{return await import(url);}catch{return null;} }

  const state = { auth:null, api:null, loaded:false, p:null };

  async function ensureMods(){
    if(state.loaded) return state;
    if(state.p) return state.p;
    state.p=(async()=>{
      state.auth = await tryImport(CFG.authModule);
      state.api  = await tryImport(CFG.apiModule);
      state.loaded=true;
      return state;
    })();
    return state.p;
  }

  async function safeJson(res){ try{return await res.json();}catch{return null;} }

  const authUtils = {
    configure(partial){ if(partial&&typeof partial==='object') Object.assign(CFG, partial); return CFG; },

    async _ready(){ return ensureMods(); },

    getToken(){
      const m = state.auth;
      if(m && typeof m.getToken==='function'){ try{return m.getToken()||'';}catch{} }
      return safeGet(CFG.tokenKey);
    },
    setToken(t){
      const m = state.auth;
      if(m && typeof m.setToken==='function'){ try{m.setToken(t);}catch{} }
      safeSet(CFG.tokenKey, String(t||''));
    },
    clearToken(){
      const m = state.auth;
      if(m && typeof m.clearToken==='function'){ try{m.clearToken();}catch{} }
      safeRemove(CFG.tokenKey);
    },

    async _apiCall(path, opts){
      await ensureMods();
      const token = this.getToken();
      const p = cleanPath(path);

      if(state.api && typeof state.api.api==='function'){
        const method = (opts&&opts.method)||'GET';
        const bodyStr = opts && opts.body;
        let body=null;
        if(bodyStr && typeof bodyStr==='string'){
          try{ body = JSON.parse(bodyStr);}catch{ body = bodyStr; }
        } else if(bodyStr) body = bodyStr;
        return state.api.api(p, { method, token, body });
      }

      const res = await fetch(apiUrl(p), {
        method:(opts&&opts.method)||'GET',
        headers: Object.assign(
          {'Authorization': token?('Bearer '+token):''},
          (opts&&opts.headers)||{}
        ),
        body: (opts&&opts.body)||undefined
      });
      if(!res.ok && (res.status===401||res.status===403)) this.clearToken();
      const data = await safeJson(res);
      if(!res.ok) throw new Error(data?.error||('API '+res.status));
      return data;
    },

    async me(){
      await ensureMods();
      const token=this.getToken();
      if(!token) return null;

      // 1) users/me (Firestore users doc)
      try{
        const data = await this._apiCall(CFG.mePrimary, { method:'GET' });
        return data?.user || data?.data?.user || data || null;
      }catch(e){
        // 2) fallback auth/me
        try{
          const data = await this._apiCall(CFG.meFallback, { method:'GET' });
          return data?.user || data?.data?.user || data || null;
        }catch(_){
          return null;
        }
      }
    },

    async requireUser(opts){
      const o = Object.assign({ redirect:true, appHome:CFG.appHome, returnTo:'' }, opts||{});
      const user = await this.me();
      if(user) return user;

      if(o.returnTo){ try{ sessionStorage.setItem('lm_return_to', o.returnTo);}catch{} }
      if(o.redirect){
        const u = new URL(o.appHome||CFG.appHome||'/app.html', location.origin);
        u.searchParams.set('login','1');
        if(o.returnTo) u.searchParams.set('returnTo', o.returnTo);
        location.replace(u.toString());
        return null;
      }
      const err=new Error('AUTH_REQUIRED'); err.code='AUTH_REQUIRED'; throw err;
    },

    toDisplayName(u){
      if(!u) return 'Foydalanuvchi';
      return (u.name || u.fullName || (u.firstName? (u.firstName+' '+(u.lastName||'')).trim(): '') || u.loginId || u.email || 'Foydalanuvchi').trim();
    },

    async submitGame001(xp, meta){
      const xpInt = Math.max(0, Math.floor(Number(xp||0)||0));
      const pointsDelta = Math.round(xpInt/100);
      return this._apiCall('/games/submit', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ gameId:'game001', xp: xpInt, pointsDelta, meta: meta||null })
      });
    }
  };

  ensureMods();
  global.authUtils = authUtils;
})(window);

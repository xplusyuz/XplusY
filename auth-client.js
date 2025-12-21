// auth-client.js — session + guard
(function(){
  let user=null;

  async function load(){
    const s = lmApi.sid();
    if (!s) return null;
    try{
      const out = await lmApi.me();
      user = out.user;
      return user;
    }catch(e){
      lmApi.clearSid();
      user=null;
      return null;
    }
  }

  async function require(){
    if (user) return user;
    const u = await load();
    if (u) return u;
    if (!location.pathname.endsWith('login.html')){
      location.href = 'login.html?redirect='+encodeURIComponent(location.href);
      return new Promise(()=>{});
    }
    return null;
  }

  async function login(id,pw){
    const out = await lmApi.login(id,pw);
    lmApi.setSid(out.sessionId);
    user = out.user;
    return user;
  }

  async function register(){
    const out = await lmApi.register();
    lmApi.setSid(out.sessionId);
    user = out.user;
    return out;
  }

  async function logout(){
    try{ await lmApi.logout(); }catch(e){}
    lmApi.clearSid(); user=null;
  }

  function getUser(){ return user; }

  load();
  window.lmAuth = { load, require, login, register, logout, getUser };
})();
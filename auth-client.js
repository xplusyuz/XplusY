// auth-client.js — session + guard (API-only)
(function(){
  let user = null;
  let loading = null;

  async function load(){
    if (user) return user;
    if (loading) return loading;
    loading = (async ()=>{
      const s = lmApi.sid();
      if (!s) { user=null; return null; }
      try{
        const out = await lmApi.me(); // IMPORTANT: matches backend
        user = out.user || null;
        return user;
      }catch(e){
        lmApi.clearSid();
        user=null;
        return null;
      } finally {
        loading=null;
      }
    })();
    return loading;
  }

  async function requireSession(){
    const u = await load();
    if (u) return u;

    // already on login — do nothing
    if (!/\/login\.html($|\?)/.test(location.pathname + location.search)){
      const red = encodeURIComponent(location.href);
      location.replace(`login.html?redirect=${red}`);
      return new Promise(()=>{});
    }
    return null;
  }

  async function login(id,pw){
    const out = await lmApi.login(id,pw);
    if (out?.sessionId) lmApi.setSid(out.sessionId);
    user = out.user || null;
    return user;
  }

  async function register(){
    const out = await lmApi.register();
    if (out?.sessionId) lmApi.setSid(out.sessionId);
    user = out.user || null;
    return out;
  }

  async function logout(){
    try{ await lmApi.logout(); }catch(e){}
    lmApi.clearSid();
    user = null;
  }

  function getUser(){ return user; }

  window.lmAuth = { load, requireSession, login, register, logout, getUser };
})();
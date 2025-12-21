// auth-utils.js (API-only)
(function () {
  const STORAGE_KEY = 'leaderMathUserSession';
  let currentUser = null;

  function getSessionId(){
    try { return localStorage.getItem(STORAGE_KEY); } catch(e){ return null; }
  }
  function setSessionId(sid){
    try { localStorage.setItem(STORAGE_KEY, sid); } catch(e){}
  }
  function clearSession(){
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
    currentUser = null;
  }

  async function loadSession(){
    const sid = getSessionId();
    if (!sid) return null;
    try {
      const data = await window.apiUtils.session(sid);
      currentUser = data.user;
      return currentUser;
    } catch(e){
      clearSession();
      return null;
    }
  }

  async function requireSession(){
    if (currentUser) return currentUser;
    const u = await loadSession();
    if (u) return u;

    const currentPath = window.location.pathname;
    if (!currentPath.includes('login.html')) {
      const redirect = encodeURIComponent(window.location.href);
      window.location.href = `login.html?redirect=${redirect}`;
      return new Promise(() => {});
    }
    return null;
  }

  async function loginWithIdPassword(id, password){
    const data = await window.apiUtils.login((id||'').trim(), (password||'').trim());
    setSessionId(data.sessionId);
    currentUser = data.user;
    return currentUser;
  }

  async function registerAuto(){
    const data = await window.apiUtils.register();
    setSessionId(data.sessionId);
    currentUser = data.user;
    return data; // {loginId,password,sessionId,user}
  }

  async function logout(){
    clearSession();
  }

  async function updateUserData(patch){
    if (!currentUser) throw new Error("Session yo'q");
    const data = await window.apiUtils.updateUser(currentUser.id, patch);
    currentUser = data.user;
    return currentUser;
  }

  // auto warm
  loadSession();

  window.authUtils = {
    loadSession,
    requireSession,
    loginWithIdPassword,
    registerAuto,
    logout,
    updateUserData,
    getUser: () => currentUser,
    getSessionId
  };
})();
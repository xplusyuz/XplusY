// assets/auth-client.js — session + guard (stable)
(function () {
  let user = null;
  let loading = null;

  function redirectLogin() {
    if (location.pathname.endsWith("login.html")) return;
    const target = "login.html?redirect=" + encodeURIComponent(location.href);
    location.replace(target);
  }

  async function load() {
    if (loading) return loading;
    loading = (async () => {
      const s = lmApi.sid();
      if (!s) { user = null; return null; }
      try {
        const out = await lmApi.me();
        user = out.user || null;
        return user;
      } catch {
        lmApi.clearSid();
        user = null;
        return null;
      } finally {
        loading = null;
      }
    })();
    return loading;
  }

  async function requireAuth() {
    if (user) return user;
    const u = await load();
    if (u) return u;
    redirectLogin();
    return new Promise(() => {});
  }

  async function login(id, pw) {
    const out = await lmApi.login(id, pw);
    lmApi.setSid(out.sessionId);
    user = out.user || null;
    return user;
  }

  async function register() {
    const out = await lmApi.register();
    lmApi.setSid(out.sessionId);
    user = out.user || null;
    return out;
  }

  async function logout() {
    try { await lmApi.logout(); } catch {}
    lmApi.clearSid();
    user = null;
    if (!location.pathname.endsWith("login.html")) location.replace("login.html");
  }

  function getUser() { return user; }

  load();
  window.lmAuth = { load, require: requireAuth, login, register, logout, getUser };
})();

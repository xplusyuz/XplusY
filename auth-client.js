// auth-client.js — session + guard (FIXED)
(function () {
  let user = null;
  let loadingPromise = null;

  function currentUrl() {
    return location.href;
  }

  function goLogin() {
    // login sahifasiga qayta-qayta yuborishni oldini olamiz
    if (location.pathname.endsWith("login.html")) return;

    const target =
      "login.html?redirect=" + encodeURIComponent(currentUrl());

    // replace: back bosganda yana index -> login loop bo‘lmasin
    location.replace(target);
  }

  async function load() {
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      const sid = lmApi.sid();
      if (!sid) {
        user = null;
        return null;
      }
      try {
        const out = await lmApi.me();
        user = out.user || null;
        return user;
      } catch (e) {
        // session yaroqsiz bo‘lsa: tozalaymiz
        lmApi.clearSid();
        user = null;
        return null;
      } finally {
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  async function requireAuth() {
    if (user) return user;

    const u = await load();
    if (u) return u;

    // faqat login.html bo'lmasa redirect qilamiz
    goLogin();

    // Sahifa yo'naltirilgach, kod davom etmasin
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
    try {
      await lmApi.logout();
    } catch (e) {}
    lmApi.clearSid();
    user = null;

    // logout qilganda login ga tushirish (xohlasangiz olib tashlaysiz)
    if (!location.pathname.endsWith("login.html")) {
      location.replace("login.html");
    }
  }

  function getUser() {
    return user;
  }

  // sahifa yuklanganda sessionni tekshirib qo'yamiz (background)
  load();

  window.lmAuth = {
    load,
    require: requireAuth,
    login,
    register,
    logout,
    getUser,
  };
})();

// api-client.js — fetch wrapper (API-only) (FIXED)
(function () {
  const API_BASE = "/.netlify/functions/api";
  const SID_KEY = "lm_session";

  function sid() {
    try { return localStorage.getItem(SID_KEY) || ""; } catch { return ""; }
  }
  function setSid(v) {
    try { localStorage.setItem(SID_KEY, String(v || "")); } catch {}
  }
  function clearSid() {
    try { localStorage.removeItem(SID_KEY); } catch {}
  }

  async function req(path, method = "GET", body = null, headers = null) {
    const h = { "Content-Type": "application/json" };

    const s = sid();
    if (s) {
      // Bitta header yetarli (eng barqaror)
      h["X-Session-Id"] = s;
    }

    if (headers) Object.assign(h, headers);

    const opt = {
      method,
      headers: h,

      // 🔥 eng muhim: eski JS / eski javoblarni cache qilib qolmasin
      cache: "no-store",
      credentials: "same-origin"
    };

    if (body !== null) opt.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opt);

    // JSON parse
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    // 🔥 401/403 bo'lsa sessionni tozalaymiz (requireAuth login'ga yuboradi)
    if (res.status === 401 || res.status === 403) {
      clearSid();
    }

    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  window.lmApi = {
    API_BASE,
    sid, setSid, clearSid,

    // Auth
    register: () => req("/auth/register", "POST"),
    login: (id, password) => req("/auth/login", "POST", { id, password }),
    me: () => req("/auth/me", "GET"),
    logout: () => req("/auth/logout", "POST"),
    changePassword: (currentPassword, newPassword) =>
      req("/auth/password", "POST", { currentPassword, newPassword }),

    // Content (agar ishlatsangiz)
    home: () => req("/content/home", "GET"),

    // Admin (agar ishlatsangiz)
    adminSetHome: (doc, adminToken = "") =>
      req("/admin/content/home", "POST", doc, adminToken ? { "X-Admin-Token": adminToken } : {}),

    // User (agar ishlatsangiz)
    userMe: () => req("/user/me", "GET"),
    userPatch: (patch) => req("/user/me", "PATCH", patch),
    userAvatar: (avatar) => req("/user/me/avatar", "POST", { avatar }),

    // Ranking (agar ishlatsangiz)
    ranking: () => req("/ranking", "GET"),
  };
})();

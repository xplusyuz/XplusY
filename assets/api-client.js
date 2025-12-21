// assets/api-client.js — fetch wrapper (API-only)
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
    if (s) h["X-Session-Id"] = s;
    if (headers) Object.assign(h, headers);

    const opt = { method, headers: h, cache: "no-store", credentials: "same-origin" };
    if (body !== null) opt.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opt);
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    if (res.status === 401 || res.status === 403) clearSid();

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
    register: () => req("/auth/register", "POST"),
    login: (id, password) => req("/auth/login", "POST", { id, password }),
    me: () => req("/auth/me", "GET"),
    logout: () => req("/auth/logout", "POST"),
    changePassword: (currentPassword, newPassword) => req("/auth/password", "POST", { currentPassword, newPassword }),
    userMe: () => req("/user/me", "GET"),
    userPatch: (patch) => req("/user/me", "PATCH", patch),
    ranking: () => req("/ranking", "GET"),
  };
})();

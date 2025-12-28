// assets/js/api.js — Netlify Functions API helper (clean, no ellipsis)
export const API_BASE = "/.netlify/functions/api";

export async function api(path, { method="GET", body=null, token=null } = {}) {
  const clean = String(path || "").replace(/^\//, "");
  const url = API_BASE + "?path=" + encodeURIComponent(clean);

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  let data;
  if (ct.includes("application/json")) {
    try { data = await res.json(); }
    catch (e) { data = { error: "JSON parse xato", detail: String(e) }; }
  } else {
    const txt = await res.text();
    data = { raw: txt };
  }

  if (!res.ok) {
    // auto logout if token invalid
    if (res.status === 401 || res.status === 403) {
      try { localStorage.removeItem("lm_token"); } catch (_) {}
      if (location.pathname.endsWith("app.html")) location.href = "./";
    }
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : ("HTTP " + res.status);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

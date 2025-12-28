// public/assets/js/api.js
export const API_BASE = "/.netlify/functions";

export async function callApi(fn, { method = "GET", token = "", body = null } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/${fn}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data && (data.error || data.message) ? (data.error || data.message) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

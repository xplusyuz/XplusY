/* ================= SESSION UTILS ================= */

const API = "/.netlify/functions/api";

export function getSessionId() {
  return localStorage.getItem("sessionId");
}

export function setSessionId(id) {
  localStorage.setItem("sessionId", id);
}

export function clearSession() {
  localStorage.removeItem("sessionId");
}

/* ================= AUTO REGISTER ================= */
export async function autoRegister() {
  const r = await fetch(`${API}/auth/register`, { method: "POST" });
  const d = await r.json();

  if (d.sessionId) {
    setSessionId(d.sessionId);
  }
  return d;
}

/* ================= LOGIN ================= */
export async function login(id, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, password })
  });
  const d = await r.json();

  if (d.sessionId) {
    setSessionId(d.sessionId);
  }
  return d;
}

/* ================= SESSION CHECK ================= */
export async function requireSession(redirect = "/login.html") {
  const sid = getSessionId();
  if (!sid) {
    location.href = redirect;
    return;
  }

  const r = await fetch(`${API}/auth/session/${sid}`);
  const d = await r.json();

  if (d.error) {
    clearSession();
    location.href = redirect;
  }

  return d.user;
}

/* ================= PASSWORD UPDATE ================= */
export async function updatePassword(oldPassword, newPassword) {
  const sid = getSessionId();

  const r = await fetch(`${API}/user/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: sid,
      oldPassword,
      newPassword
    })
  });

  return r.json();
}

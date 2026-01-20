// Robust API client with automatic fallback.
// Tries Netlify Functions first, then /api. Remembers the last working base.

const LS_KEY = 'lm_api_base';

function getSavedBase() {
  try { return localStorage.getItem(LS_KEY) || ''; } catch (_) { return ''; }
}

function saveBase(base) {
  try { localStorage.setItem(LS_KEY, base); } catch (_) {}
}

function getBases() {
  const all = ['/.netlify/functions/api', '/api'];
  const saved = getSavedBase();
  if (saved && all.includes(saved)) {
    return [saved, ...all.filter((x) => x !== saved)];
  }
  return all;
}

function buildUrl(base, path, query) {
  const clean = String(path || '').replace(/^\/+/, '');
  const u = new URL(base, location.origin);
  u.searchParams.set('path', clean);
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      u.searchParams.set(String(k), String(v));
    }
  }
  return u.toString();
}

async function parseResponse(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return await res.json(); } catch (e) { return { error: 'JSON parse xato', detail: String(e) }; }
  }
  try {
    const txt = await res.text();
    return { raw: txt };
  } catch (_) {
    return null;
  }
}

function shouldFallback(status) {
  // Typical cases when Netlify Functions is unavailable or misconfigured
  return status === 404 || status === 502 || status === 503;
}

export async function api(path, { method = 'GET', body = null, token = null, query = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;

  let lastErr = null;
  for (const base of getBases()) {
    const url = buildUrl(base, path, query);
    try {
      const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
      const data = await parseResponse(res);
      if (!res.ok) {
        // AUTO_LOGOUT: if token invalid, clear and redirect
        if (res.status === 401 || res.status === 403) {
          try { localStorage.removeItem('lm_token'); } catch (_) {}
          if (location.pathname.endsWith('app.html')) location.href = './';
        }

        const msg = data?.error || data?.message || ('HTTP ' + res.status);
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;

        // If base is down/misconfigured, try next base
        if (shouldFallback(res.status)) {
          lastErr = err;
          continue;
        }
        throw err;
      }

      // success: remember working base
      saveBase(base);
      return data;
    } catch (e) {
      // Network error or CORS etc: try next base
      lastErr = e;
      continue;
    }
  }

  // All bases failed
  throw lastErr || new Error('API unreachable');
}

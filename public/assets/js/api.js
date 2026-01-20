export const API_BASE_CANDIDATES = ['/.netlify/functions/api', '/api'];

function getBases(){
  let stored = '';
  try { stored = localStorage.getItem('lm_api_base') || ''; } catch (_) {}
  const arr = [];
  if (stored) arr.push(stored);
  for (const b of API_BASE_CANDIDATES) arr.push(b);
  return [...new Set(arr)];
}

// api('/auth/login', { method:'POST', body:{...} })
// Always sends `path` with leading slash (server expects e.g. '/auth/login').
export async function api(path, { method='GET', body=null, token=null, query=null } = {}){
  const apiPath = '/' + String(path || '').replace(/^\//, '');
  let lastErr = null;

  for (const base of getBases()){
    try {
      const u = new URL(base, location.origin);
      u.searchParams.set('path', apiPath);
      if (query && typeof query === 'object'){
        for (const [k,v] of Object.entries(query)){
          if (v === undefined || v === null || v === '') continue;
          u.searchParams.set(String(k), String(v));
        }
      }

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;

      const res = await fetch(u.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const data = ct.includes('application/json')
        ? await res.json().catch(() => ({}))
        : { raw: await res.text().catch(() => '') };

      if (!res.ok){
        if (res.status === 401 || res.status === 403){
          try { localStorage.removeItem('lm_token'); } catch (_) {}
          if (location.pathname.endsWith('app.html')) location.href = './';
        }
        const err = new Error(data?.error || data?.message || ('HTTP ' + res.status));
        err.status = res.status;
        err.data = data;
        throw err;
      }

      try { localStorage.setItem('lm_api_base', base); } catch (_) {}
      return data;
    } catch (e){
      lastErr = e;
      continue;
    }
  }

  throw lastErr || new Error('API request failed');
}

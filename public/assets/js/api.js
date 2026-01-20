// Primary backend (Netlify). If you host elsewhere, the fallback below will try "/api".
export const API_BASE = "/.netlify/functions/api";
const API_FALLBACK = "/api";

async function fetchWithFallback(urlPrimary, init){
  const res = await fetch(urlPrimary, init);
  // If Netlify Functions are not available on this host, retry on "/api".
  if (res.status === 404) {
    try{
      const u = new URL(urlPrimary);
      const alt = new URL(API_FALLBACK, location.origin);
      // keep same query params
      u.searchParams.forEach((v,k)=> alt.searchParams.set(k,v));
      return await fetch(alt.toString(), init);
    }catch(_){
      return res;
    }
  }
  return res;
}

// api(path, { method, body, token, query })
// - path: "comments" | "leaderboard" ...
// - query: { limit: 20, cursor: "..." }  -> becomes URL query params
export async function api(path, {method="GET", body=null, token=null, query=null} = {}){
  const clean = String(path||"").replace(/^\//,"");
  const u = new URL(API_BASE, location.origin);
  u.searchParams.set("path", clean);
  if(query && typeof query === "object"){
    for(const [k,v] of Object.entries(query)){
      if(v === undefined || v === null || v === "") continue;
      u.searchParams.set(String(k), String(v));
    }
  }
  const url = u.toString();
  const headers = { "Content-Type":"application/json" };
  if(token) headers.Authorization = "Bearer " + token;
  const res = await fetchWithFallback(url, { method, headers, body: body? JSON.stringify(body): null });
  const ct = (res.headers.get('content-type')||'').toLowerCase();
  let data = null;
  if(ct.includes('application/json')){
    try{ data = await res.json(); }catch(e){ data = { error:'JSON parse xato', detail:String(e) }; }
  }else{
    const txt = await res.text();
    data = { raw: txt };
  }
  if(!res.ok){
    // AUTO_LOGOUT: if token invalid, clear and redirect
    if(res.status===401 || res.status===403){
      try{ localStorage.removeItem('lm_token'); }catch(_){ }
      if(location.pathname.endsWith('app.html')) location.href = './';
    }

    const msg = data?.error || data?.message || ("HTTP "+res.status);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const API_BASE = "/.netlify/functions/api";

export async function api(path, {method="GET", body=null, token=null} = {}){
  const clean = String(path||"").replace(/^\//,"");
  const url = API_BASE + "?path=" + encodeURIComponent(clean);
  const headers = { "Content-Type":"application/json" };
  if(token) headers.Authorization = "Bearer " + token;
  const res = await fetch(url, { method, headers, body: body? JSON.stringify(body): null });
  const txt = await res.text();
  let data = null;
  try{ data = txt? JSON.parse(txt): null; }catch(_){ data = { raw: txt }; }
  if(!res.ok){
    const msg = data?.error || data?.message || ("HTTP "+res.status);
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

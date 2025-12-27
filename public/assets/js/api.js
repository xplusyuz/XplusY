const API_BASE = "/.netlify/functions/api";

export async function api(path, {method="GET", body=null, token=null, adminKey=null} = {}){
  const headers = {"Content-Type":"application/json"};
  if(token) headers["Authorization"] = "Bearer " + token;
  if(adminKey) headers["x-admin-key"] = adminKey;

  const clean = String(path||"").replace(/^\//,"");
  const url = API_BASE + "?path=" + encodeURIComponent(clean);
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  let data = null;
  const ct = res.headers.get("content-type") || "";
  if(ct.includes("application/json")){
    data = await res.json().catch(()=>null);
  } else {
    const t = await res.text().catch(()=> "");
    data = {message: t};
  }

  if(!res.ok){
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : "Xatolik";
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

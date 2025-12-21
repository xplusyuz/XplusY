// api-client.js — fetch wrapper (API-only, session header)
(function(){
  const API_BASE='/.netlify/functions/api';
  const SID_KEY='leaderMathUserSession';

  function sid(){ try{return localStorage.getItem(SID_KEY)||'';}catch(e){return '';} }
  function setSid(v){ try{localStorage.setItem(SID_KEY,v);}catch(e){} }
  function clearSid(){ try{localStorage.removeItem(SID_KEY);}catch(e){} }

  async function req(path, method='GET', body=null, extraHeaders=null){
    const headers={'Content-Type':'application/json'};
    const s=sid();
    if (s){
      headers['X-Session-Id']=s;
      headers['Authorization']=`Bearer ${s}`;
    }
    if (extraHeaders) Object.assign(headers, extraHeaders);

    const opt={method, headers};
    if (body!==null) opt.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opt);
    const text = await res.text();
    let data = {};
    try{ data = text ? JSON.parse(text) : {}; } catch(e){ data = { raw:text }; }

    if (!res.ok){
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
    register: ()=>req('/auth/register','POST'),
    login: (id,password)=>req('/auth/login','POST',{id,password}),
    me: ()=>req('/auth/me','GET'),
    logout: ()=>req('/auth/logout','POST'),
    // User
    userMe: ()=>req('/user/me','GET'),
    userPatch: (patch)=>req('/user/me','PATCH',patch),
    userAvatar: (avatarDataUrl)=>req('/user/me/avatar','POST',{avatar: avatarDataUrl}),
    // Content
    home: ()=>req('/content/home','GET'),
    page: (pageId)=>req(`/content/page/${encodeURIComponent(pageId)}`,'GET'),
    // Ranking
    ranking: ()=>req('/ranking','GET')
  };
})();
// api-client.js — fetch wrapper (API-only)
(function(){
  const API_BASE='/.netlify/functions/api';
  const SID_KEY='lm_session';

  function sid(){ try{return localStorage.getItem(SID_KEY)||'';}catch(e){return '';} }
  function setSid(v){ try{localStorage.setItem(SID_KEY,v);}catch(e){} }
  function clearSid(){ try{localStorage.removeItem(SID_KEY);}catch(e){} }

  async function req(path, method='GET', body=null, headers=null){
    const h={'Content-Type':'application/json'};
    const s=sid();
    if (s){
      h['X-Session-Id']=s;
      h['Authorization']=`Bearer ${s}`;
    }
    if (headers) Object.assign(h, headers);
    const opt={method, headers:h};
    if (body!==null) opt.body=JSON.stringify(body);

    const res = await fetch(API_BASE+path, opt);
    const text = await res.text();
    let data={};
    try{ data = text?JSON.parse(text):{}; }catch(e){ data={raw:text}; }
    if (!res.ok){
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status=res.status; err.data=data;
      throw err;
    }
    return data;
  }

  window.lmApi = {
    API_BASE,
    sid, setSid, clearSid,
    register: ()=>req('/auth/register','POST'),
    login: (id,password)=>req('/auth/login','POST',{id,password}),
    me: ()=>req('/auth/me','GET'),
    logout: ()=>req('/auth/logout','POST'),
    changePassword: (currentPassword,newPassword)=>req('/auth/password','POST',{currentPassword,newPassword}),
    home: ()=>req('/content/home','GET'),
    adminSetHome: (doc, adminToken='')=>req('/admin/content/home','POST',doc, adminToken?{'X-Admin-Token':adminToken}:{ }),
    userMe: ()=>req('/user/me','GET'),
    userPatch: (patch)=>req('/user/me','PATCH',patch),
    userAvatar: (avatar)=>req('/user/me/avatar','POST',{avatar}),
    ranking: ()=>req('/ranking','GET')
  };
})();
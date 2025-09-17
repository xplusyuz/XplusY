// js/results.js — standalone
import { attachAuthUI, initUX, db } from "./common.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export default {
  async init(){
    attachAuthUI({ requireSignIn:true }); initUX?.();
    const run = async ()=>{
      const uid = window.__mcUser?.user?.uid; if(!uid) return;
      const list = document.getElementById('resultsList'); if(!list) return;
      list.innerHTML = '<div class="card">Yuklanmoqda…</div>';
      const snap = await getDocs(query(collection(db,'users', uid, 'results'), orderBy('createdAtFS','desc'), limit(20)));
      list.innerHTML='';
      if(snap.empty){ list.innerHTML='<div class="hint">Hozircha natija yo‘q.</div>'; return; }
      snap.forEach(d=>{
        const r=d.data(); const el=document.createElement('div');
        el.className='card';
        el.innerHTML=`<div><b>${r.examName||'Sinov'}</b></div><div class="sub">Score: ${r.score?.toFixed?.(2) ?? r.score} — ${r.createdAt||''}</div>`;
        list.appendChild(el);
      });
    };
    if(window.__mcUser?.user) run(); else document.addEventListener('mc:user-ready', run, { once:true });
  },
  destroy(){}
}
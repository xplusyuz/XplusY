// js/badges.js — standalone
import { attachAuthUI, initUX } from "./common.js";
export default {
  async init(){
    attachAuthUI({ requireSignIn:true }); initUX?.();
    const w=document.getElementById('badgesWrap'); if(!w) return;
    const arr = (window.__mcUser?.profile?.badges) || [];
    w.innerHTML='';
    if(!arr.length){ w.innerHTML='<div class="hint">Hozircha yutuqlar yo‘q.</div>'; return; }
    arr.forEach(b=>{ const s=document.createElement('span'); s.className='pill'; s.textContent=b; w.appendChild(s); });
  },
  destroy(){}
}
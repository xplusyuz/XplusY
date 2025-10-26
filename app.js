// ===== Theme toggle (persist) =====
const root = document.documentElement;
const THEME_KEY = 'lm-theme';
const themeBtn = document.getElementById('themeBtn');
function setTheme(mode){
  root.classList.toggle('dark', mode==='dark');
  localStorage.setItem(THEME_KEY, mode);
  themeBtn.textContent = mode==='dark' ? '☀️' : '🌙';
  // meta theme-color yangilash
  const meta = document.getElementById('meta-theme-color');
  meta?.setAttribute('content', mode==='dark' ? '#0E1512' : '#2E8B57');
}
setTheme(localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
themeBtn.onclick = ()=> setTheme(root.classList.contains('dark') ? 'light' : 'dark');

// ===== Elements
const el = {
  userbar: document.getElementById('userbar'),
  ava: document.getElementById('ava'),
  userMenu: document.getElementById('userMenu'),
  points: document.getElementById('points'),
  userStarsInline: document.getElementById('userStarsInline'),
  userStarsPts: document.getElementById('userStarsPts'),
  signin: document.getElementById('signin'),
  signout: document.getElementById('signout'),
  editProfile: document.getElementById('editProfile'),
  // modal
  PM: {
    mask: document.getElementById('profileModal'),
    first: document.getElementById('pFirst'),
    last: document.getElementById('pLast'),
    region: document.getElementById('pRegion'),
    district: document.getElementById('pDistrict'),
    school: document.getElementById('pSchool'),
    klass: document.getElementById('pClass'),
    phone: document.getElementById('pPhone'),
    err: document.getElementById('pError'),
    save: document.getElementById('pSave'),
    close: document.getElementById('pClose'),
  }
};

// ===== Demo state (o‘rniga Firebase qo‘yishingiz mumkin)
let CURRENT_PROFILE = {
  name: 'Sohibjon Sattorov',
  numericId: 3625,
  points: 9,
  region: 'Namangan',
  district: 'Namangan shahar',
  school: '1-maktab',
  class: '9-A',
  photoURL: null
};

// ===== Helpers
const escapeHtml = (s)=>String(s??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function initials(n){ if(!n) return 'LM'; const p=n.trim().split(/\s+/); return (p[0]?.[0]||'L')+(p[1]?.[0]||'M'); }
function fmtPoints(v){ return (Number(v)||0).toLocaleString('uz-UZ'); }

// SVG star/diamond (gradient fill)
function starSVG(fillPct=100, colors=['#9FE3FF','#39B6FF','#0077FF']){
  const gid='g'+Math.random().toString(36).slice(2,8), cid='c'+Math.random().toString(36).slice(2,8);
  const path='M12 2.3l2.9 5.9 6.5.9-4.7 4.5 1.1 6.4L12 17.8l-5.8 3.1 1.1-6.4L2.6 9.1l6.5-.9L12 2.3z';
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0%" stop-color="${colors[0]}"/><stop offset="50%" stop-color="${colors[1]}"/><stop offset="100%" stop-color="${colors[2]}"/></linearGradient><clipPath id="${cid}"><rect x="0" y="0" width="${fillPct}%" height="100%"/></clipPath></defs><path d="${path}" fill="#d0dbd5"></path><path d="${path}" fill="url(#${gid})" clip-path="url(#${cid})"></path></svg>`;
}
function renderStars(count){
  const full=Math.floor(count), half=(count-full>=0.5)?1:0, empty=5-full-half;
  const fullIcon=starSVG(100), halfIcon=starSVG(50), emptyIcon=starSVG(0);
  return `<span class="stars">${Array.from({length:full}).map(()=>fullIcon).join('')}${half?halfIcon:''}${Array.from({length:empty}).map(()=>emptyIcon).join('')}</span>`;
}

// ===== User panel render (compact)
function refreshCompact(){
  const p = CURRENT_PROFILE;
  el.points.textContent = 'Ball: ' + fmtPoints(p.points||0);
  // yulduz – ballga qarab 0–5 oralig‘ida
  const score = Math.max(0, Math.min(5, (p.points||0)/2)); // demo formula
  const stars = renderStars(score);
  el.userStarsInline.innerHTML = stars;
  el.userStarsPts.innerHTML = stars;
  if(p.photoURL){ el.ava.innerHTML = `<img src="${escapeHtml(p.photoURL)}" alt="ava" style="width:100%;height:100%;object-fit:cover">`; }
  else { el.ava.textContent = initials(p.name); }
}
refreshCompact();

// ===== Popover menyu
function buildUserMenu(){
  const p = CURRENT_PROFILE;
  el.userMenu.innerHTML = `
    <div class="um-head">
      <div class="um-ava">${p.photoURL ? `<img src="${escapeHtml(p.photoURL)}" style="width:100%;height:100%;object-fit:cover">` : initials(p.name)}</div>
      <div>
        <div class="um-name">${escapeHtml(p.name||'Foydalanuvchi')}</div>
        <div class="um-sub">ID: ${escapeHtml(String(p.numericId||'—'))}</div>
      </div>
    </div>
    <div class="um-grid">
      <div class="um-item"><b>Viloyat</b>${escapeHtml(p.region||'—')}</div>
      <div class="um-item"><b>Tuman/Shahar</b>${escapeHtml(p.district||'—')}</div>
      <div class="um-item"><b>Maktab</b>${escapeHtml(p.school||'—')}</div>
      <div class="um-item"><b>Sinf</b>${escapeHtml(p.class||'—')}</div>
    </div>
    <div class="um-actions">
      <button id="umProfile" class="um-btn">📝 Profil</button>
      <button id="umLogout" class="um-btn ghost">↩️ Chiqish</button>
    </div>
  `;
  document.getElementById('umProfile').onclick = (e)=>{ e.preventDefault(); openProfileModal(); closeUserMenu(); };
  document.getElementById('umLogout').onclick  = (e)=>{ e.preventDefault(); alert('Chiqish (demo)'); closeUserMenu(); };
}
function openUserMenu(){ buildUserMenu(); el.userbar.classList.add('menu-open'); el.userMenu.setAttribute('aria-hidden','false'); }
function closeUserMenu(){ el.userbar.classList.remove('menu-open'); el.userMenu.setAttribute('aria-hidden','true'); }
function toggleUserMenu(){ el.userbar.classList.contains('menu-open') ? closeUserMenu() : openUserMenu(); }

el.ava.addEventListener('click', (e)=>{ e.stopPropagation(); toggleUserMenu(); });
document.addEventListener('click', (e)=>{ if(!el.userbar.classList.contains('menu-open')) return; if(!el.userMenu.contains(e.target) && e.target!==el.ava) closeUserMenu(); });
window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeUserMenu(); });

// ===== Profil modal (demo)
function openProfileModal(){
  const PM = el.PM;
  const nm = (CURRENT_PROFILE.name||'').split(/\s+/,2);
  PM.first.value = nm[0]||''; PM.last.value = nm[1]||'';
  PM.region.value = CURRENT_PROFILE.region||''; PM.district.value = CURRENT_PROFILE.district||'';
  PM.school.value = CURRENT_PROFILE.school||''; PM.klass.value = CURRENT_PROFILE.class||'';
  PM.phone.value = CURRENT_PROFILE.phone||''; PM.err.textContent='';
  PM.mask.style.display='flex'; document.body.classList.add('modal-open');
}
function closeProfileModal(){ el.PM.mask.style.display='none'; document.body.classList.remove('modal-open'); }
el.PM.close.onclick = closeProfileModal;
el.PM.save.onclick = ()=>{
  const PM = el.PM, first=PM.first.value.trim(), last=PM.last.value.trim();
  if(!first || !last){ PM.err.textContent='Ism va familiya kiritish shart.'; return; }
  CURRENT_PROFILE.name = `${first} ${last}`;
  CURRENT_PROFILE.region = PM.region.value.trim();
  CURRENT_PROFILE.district= PM.district.value.trim();
  CURRENT_PROFILE.school  = PM.school.value.trim();
  CURRENT_PROFILE.class   = PM.klass.value.trim();
  CURRENT_PROFILE.phone   = PM.phone.value.trim();
  refreshCompact();
  closeProfileModal();
};

// ===== Leaderboard demo
const GROUPS=[
  {label:'10–1 (Diamond)',start:1,end:10,tier:'diamond'},
  {label:'20–11 (Emerald)',start:11,end:20,tier:'emerald'},
  {label:'30–21 (Gold)',start:21,end:30,tier:'gold'},
  {label:'40–31 (Silver)',start:31,end:40,tier:'silver'},
  {label:'50–41 (Bronze)',start:41,end:50,tier:'bronze'},
];
const boardList = document.getElementById('boardList');
const decileInfo= document.getElementById('decileInfo');
let CURRENT_DECILE=0;
const demoUsers = Array.from({length:50}).map((_,i)=>({ name:'Foydalanuvchi '+(i+1), region:'Namangan', district:'—', school:'—', points: Math.max(0, 500 - i*7) }));

function drawDecile(ix){
  const g=GROUPS[ix]; if(!g){ boardList.innerHTML='<div class="desc">Hali ma’lumot yo‘q</div>'; return; }
  const rows=[];
  for(let r=g.start;r<=g.end;r++){
    const u=demoUsers[r-1]; if(!u) continue;
    rows.push(`<div class="rank"><div class="rnk">#${r}</div><div><b>${escapeHtml(u.name)}</b><div class="desc">${escapeHtml(u.region)}</div></div><div><b>${fmtPoints(u.points)}</b></div></div>`);
  }
  boardList.innerHTML = rows.join('');
  decileInfo.textContent = g.label;
}
drawDecile(CURRENT_DECILE);
document.getElementById('decilePrev').onclick=()=>{ if(CURRENT_DECILE>0){ CURRENT_DECILE--; drawDecile(CURRENT_DECILE); } };
document.getElementById('decileNext').onclick=()=>{ if(CURRENT_DECILE<GROUPS.length-1){ CURRENT_DECILE++; drawDecile(CURRENT_DECILE); } };

/* ===== Firebase (ixtiyoriy)
import { auth, db, signOut } from './lib/firebase.client.js';
import { watchAuth } from './lib/auth-guard.js';
import { doc, getDoc, setDoc, runTransaction, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  - Agar Firebase ishlatsangiz, CURRENT_PROFILE ni onSnapshot orqali to‘ldiring,
    el.signout.click() o‘rniga signOut(auth) ni chaqiring, va profil modal saqlaganda
    setDoc(..., {merge:true}) bilan yozing. UI logikasi tayyor.
*/

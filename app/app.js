/* ===========================
   LeaderMath — index.js (ESM)
   =========================== */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}

/* ---- Firebase (ESM) ---- */
import { auth, db, signOut } from './lib/firebase.client.js';
import { watchAuth } from './lib/auth-guard.js';
import {
  doc, getDoc, setDoc, runTransaction,
  collection, query, orderBy, limit, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ==== AUTH GUARD ==== */
const html = document.documentElement;
html.classList.add('auth-checking');
const gate = document.getElementById('authGate');
const app  = document.getElementById('app');
const goLogin = document.getElementById('goLogin');
const ret = encodeURIComponent(location.pathname.replace(/\\/g,'/') + location.search);
if (goLogin) goLogin.href = `./login.html?return=${ret}`;

/* ==== THEME ==== */
const root=document.documentElement, themeBtn=document.getElementById('themeBtn'), THEME_KEY='lm-theme';
const setTheme=m=>{root.classList.toggle('dark',m==='dark');localStorage.setItem(THEME_KEY,m); if(themeBtn) themeBtn.textContent=m==='dark'?'☀️':'🌙';};
setTheme(localStorage.getItem(THEME_KEY)||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
if (themeBtn) themeBtn.onclick=()=>setTheme(root.classList.contains('dark')?'light':'dark');

/* ==== EL ==== */
const el={
  chip:document.getElementById('ucChip'), ava:document.getElementById('ucAva'), avaLg:document.getElementById('ucAvaLg'),
  pointsVal:document.getElementById('ucPointsVal'),
  more:document.getElementById('ucMore'), mask:document.getElementById('ucMask'), pop:document.getElementById('ucPopover'),
  name:document.getElementById('ucName'), numeric:document.getElementById('ucNumeric'),
  region:document.getElementById('ucRegion'), district:document.getElementById('ucDistrict'), school:document.getElementById('ucSchool'), klass:document.getElementById('ucClass'),
  openProfile:document.getElementById('ucOpenProfile'), signOutBtn:document.getElementById('ucSignOut'),
  banners:document.getElementById('banners'), sections:document.getElementById('sections'), mainTags:document.getElementById('mainTags'),
  board:document.getElementById('board'), boardList:document.getElementById('boardList'),
  decilePrev:document.getElementById('decilePrev'), decileNext:document.getElementById('decileNext'), decileInfo:document.getElementById('decileInfo'),
  PM:{
    mask:document.getElementById('profileModal'),
    first:document.getElementById('pFirst'), last:document.getElementById('pLast'),
    role:document.getElementById('pRole'),
    rSel:document.getElementById('pRegion'), dSel:document.getElementById('pDistrict'),
    schoolSel:document.getElementById('pSchoolSel'), schoolCustom:document.getElementById('pSchoolCustom'),
    schoolToggle:document.getElementById('schoolToggle'),
    gradeWrap:document.getElementById('pGradeWrap'), grade:document.getElementById('pGrade'),
    ph:document.getElementById('pPhone'), err:document.getElementById('pError'),
    save:document.getElementById('pSave'), close:document.getElementById('pClose')
  }
};

/* ==== UTIL ==== */
const toMs=v=> v? (new Date(v)).getTime():null;
const fmtTime=(ms)=>{ if(ms<=0) return '00:00:00'; const s=Math.floor(ms/1000); const h=String(Math.floor(s/3600)).padStart(2,'0'); const m=String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${h}:${m}:${ss}`; };
const escapeHtml=(s)=>String(s??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const initials=n=>n?(n.trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()):'LM';
function fmtPoints(v){ const n = Number(v)||0; return n.toLocaleString('uz-UZ',{maximumFractionDigits:1}); }
function setAvatar(txtOrUrl){ const set=n=>{ if(!n) return; if(txtOrUrl && /^https?:/.test(txtOrUrl)) n.innerHTML=`<img src="${txtOrUrl}" alt="ava">`; else n.textContent=(txtOrUrl||'LM').slice(0,2).toUpperCase(); }; set(el.ava); set(el.avaLg); }

/* ==== Stars ==== */
function starSVG(fillPct,colors=['#9FE3FF','#39B6FF','#0077FF']){
  const [c1,c2,c3]=colors, gid='g'+Math.random().toString(36).slice(2,8), cid='c'+Math.random().toString(36).slice(2,8);
  const p='M12 2.3l2.9 5.9 6.5.9-4.7 4.5 1.1 6.4L12 17.8l-5.8 3.1 1.1-6.4L2.6 9.1l6.5-.9L12 2.3z';
  return `<svg viewBox="0 0 24 24"><defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></linearGradient><clipPath id="${cid}"><rect x="0" y="0" width="${fillPct}%" height="100%"/></clipPath></defs><path d="${p}" fill="#d0dbd5"/><path d="${p}" fill="url(#${gid})" clip-path="url(#${cid})"/></svg>`;
}
const GROUPS = [
  {label:'💎 Diamond League',start:1,end:10,tier:'diamond',grad:['#9FE3FF','#39B6FF','#0077FF']},
  {label:'💚 Emerald League',start:11,end:20,tier:'emerald',grad:['#8FE3B0','#2E8B57','#1F6B45']},
  {label:'🥇 Gold League',start:21,end:30,tier:'gold',grad:['#FFE082','#FFC107','#FF8F00']},
  {label:'🥈 Silver League',start:31,end:40,tier:'silver',grad:['#DDE3EC','#BFC6D4','#9AA6B2']},
  {label:'🥉 Bronze League',start:41,end:50,tier:'bronze',grad:['#C69462','#9A6B3F','#7C4F2E']}
];

/* ==== TOP VIEW ==== */
let TOP_VIEW = 'banners';
let FILTER = { main: null };

/* ==== Sections ==== */
const SECTION_FILTERS = new Map();
const getSecKey = s => (s.title||'')+'__'+(s.tag||'');
function chipEl(label, pressed=false, onClick=()=>{}, extraClass=''){
  const b=document.createElement('button');
  b.className='chip '+extraClass; b.type='button';
  b.setAttribute('aria-pressed', pressed?'true':'false');
  b.appendChild(document.createTextNode(label)); b.onclick=()=> onClick(b);
  return b;
}
function collectMainTags(data){
  const main=new Set(); (data.sections||[]).forEach(sec=>{ if(sec.tag) main.add(String(sec.tag)); });
  return [...main].sort();
}
function sectionTags(sec){
  const s=new Set(); (sec.items||[]).forEach(it=> (it.tags||[]).forEach(t=> s.add(String(t)))); return [...s].sort();
}
function computeState(it, now){
  const t=it.type||'open', start=toMs(it.startAt), end=toMs(it.endAt);
  if(t==='open') return {status:'open'};
  if(t==='coming_soon') return {status:'soon'};
  if(t==='window'){ if(!start||!end) return {status:'open'}; if(now<start) return {status:'locked_until', left:start-now}; if(now<=end) return {status:'open'}; return {status:'closed'}; }
  return {status:'open'};
}
function renderSection(sec){
  const key = getSecKey(sec);
  if(!SECTION_FILTERS.has(key)) SECTION_FILTERS.set(key,new Set());
  const subSel=SECTION_FILTERS.get(key);
  const title=document.createElement('h3');
  title.style.margin='10px 6px'; title.style.fontSize='15px'; title.style.opacity='.8';
  title.innerHTML = escapeHtml(sec.title||'Bo‘lim') + (sec.tag ? ` — <span style="font-weight:600;opacity:.9">${escapeHtml(sec.tag)}</span>` : '');
  const subWrap=document.createElement('section'); subWrap.className='filters grad-border glass';
  subWrap.innerHTML = `<h4>Bu bo‘lim uchun kichik teglar:</h4><div class="chips"></div>`;
  const chipsRow = subWrap.querySelector('.chips');
  const tags = sectionTags(sec);
  if(tags.length===0){ chipsRow.innerHTML = `<span class="chip sm" style="opacity:.7">Teglar yo‘q</span>`; }
  else{
    chipsRow.appendChild(chipEl('Reset', subSel.size===0, ()=>{ subSel.clear(); renderAll(); }, 'sm'));
    tags.forEach(t=>{
      const pressed=subSel.has(t);
      chipsRow.appendChild(chipEl(t, pressed, (btn)=>{
        const on = btn.getAttribute('aria-pressed')==='true';
        if(on){ subSel.delete(t); btn.setAttribute('aria-pressed','false'); }
        else { subSel.add(t); btn.setAttribute('aria-pressed','true'); }
        renderAll();
      }, 'sm'));
    });
  }
  const grid=document.createElement('div'); grid.className='grid';
  let items=(sec.items||[]);
  if(subSel.size>0){
    const want=[...subSel];
    items = items.filter(it=>{
      const tags=(it.tags||[]).map(String);
      return want.some(t=> tags.includes(t));
    });
  }
  items.forEach(it=>{
    const card=document.createElement('article'); card.className='card grad-border glass';
    const best=it.best?'<div class="badge">BEST</div>':'';
    const slug=(it.name||'').replace(/\W+/g,'-');
    card.innerHTML=`
      <div class="thumb"><div style="font-weight:900;opacity:.75">${escapeHtml(it.name||'')}</div>${best}</div>
      <div class="body">
        <h3 class="name">${escapeHtml(it.name||'')}</h3>
        ${it.description?`<p class="desc">${escapeHtml(it.description)}</p>`:''}
        <div class="actions">
          <a class="btn" id="start-${slug}">Boshlash</a>
          <button class="btn ghost" disabled id="info-${slug}">Info</button>
        </div>
        <div class="meta"><span class="countdown" data-id="${slug}"></span></div>
        <div class="chips" style="margin-top:8px">
          ${(it.tags||[]).map(t=> `<span class="chip sm">${escapeHtml(String(t))}</span>`).join('')}
        </div>
      </div>`;
    const startBtn=card.querySelector(`#start-${slug}`);
    const cdEl=card.querySelector(`[data-id="${slug}"]`);
    const tick=()=>{ const st=computeState(it,Date.now());
      if(st.status==='open'){ startBtn.removeAttribute('disabled'); startBtn.setAttribute('href', it.link||'#'); cdEl.textContent=''; }
      else if(st.status==='soon'){ startBtn.setAttribute('disabled','1'); startBtn.removeAttribute('href'); cdEl.textContent='Tez orada'; }
      else if(st.status==='locked_until'){ startBtn.setAttribute('disabled','1'); startBtn.removeAttribute('href'); cdEl.textContent='Qolgan vaqt: '+fmtTime(st.left); }
      else { startBtn.setAttribute('disabled','1'); startBtn.removeAttribute('href'); cdEl.textContent='Tugadi'; }
    };
    tick(); setInterval(tick,1000); grid.appendChild(card);
  });
  const frag=document.createDocumentFragment();
  frag.appendChild(title); frag.appendChild(subWrap);
  if(items.length===0){
    const empty=document.createElement('div'); empty.className='desc'; empty.style.margin='0 6px 10px'; empty.style.opacity='.7'; empty.textContent='Bu bo‘lim uchun tanlangan teg(lar) bo‘yicha ma’lumot topilmadi.'; frag.appendChild(empty);
  }
  frag.appendChild(grid); return frag;
}
function renderCards(data){
  const wrap=document.getElementById('sections'); if(!wrap) return;
  wrap.innerHTML='';
  const sections=(data.sections||[]).filter(sec=> FILTER.main && sec.tag && String(sec.tag)===FILTER.main);
  if(sections.length===0){ const empty=document.createElement('div'); empty.className='desc'; empty.style.margin='10px 6px'; empty.style.opacity='.75'; empty.textContent='Katta teg bo‘yicha bo‘lim topilmadi.'; wrap.appendChild(empty); return; }
  sections.forEach(sec=> wrap.appendChild(renderSection(sec)));
}

/* ---- TOP CHIPS ---- */
function renderMainChips(tags){
  const wrap = document.getElementById('mainTags'); if(!wrap) return;
  wrap.innerHTML = '';

  const mk = (label, on, cb)=>{ const b=chipEl(label,on,cb); wrap.appendChild(b); };

  mk('📰 Bannerlar', TOP_VIEW==='banners', ()=>{ TOP_VIEW='banners'; FILTER.main=null; updateTopVisibility(); syncPressed(); });
  mk('🏆 League', TOP_VIEW==='league', ()=>{ TOP_VIEW='league'; FILTER.main=null; updateTopVisibility(); syncPressed(); });

  tags.forEach(t=>{
    mk(t, TOP_VIEW===t, ()=>{ TOP_VIEW=t; FILTER.main=t; updateTopVisibility(); syncPressed(); });
  });

  function syncPressed(){
    [...wrap.querySelectorAll('.chip')].forEach(b=>{
      const label=b.textContent.trim();
      const on = (TOP_VIEW==='banners' && label.includes('Bannerlar')) ||
                 (TOP_VIEW==='league' && label.includes('League')) ||
                 (TOP_VIEW===label);
      b.setAttribute('aria-pressed', on?'true':'false');
    });
  }
}

function updateTopVisibility(){
  if (el.banners) el.banners.style.display = (TOP_VIEW==='banners') ? '' : 'none';
  if (el.board)   el.board.style.display   = (TOP_VIEW==='league')  ? '' : 'none';
  const cont=document.querySelector('.container');
  if (cont) cont.style.display = (TOP_VIEW!=='banners' && TOP_VIEW!=='league') ? '' : 'none';
  if(TOP_VIEW!=='banners' && TOP_VIEW!=='league'){ renderAll(); }
}

async function initContent(){
  try{
    const r=await fetch('./index.json',{cache:'no-store'});
    const data=await r.json();
    const bannersEl=document.getElementById('banners');
    if (bannersEl) bannersEl.innerHTML=(data.banners||[]).map(b=>`<div class="banner grad-border glass">${b.html||''}</div>`).join('');
    const mains=collectMainTags(data);
    renderMainChips(mains);
    window.__LM_DATA=data;
    TOP_VIEW='banners'; FILTER.main=null; updateTopVisibility();
  }catch(e){ console.error(e); }
}
function renderAll(){ if(!window.__LM_DATA) return; renderCards(window.__LM_DATA); }

/* ==== LEADERBOARD ==== */
let CURRENT_DECILE=0, latestUsers=[];
function drawDecile(users,ix){
  const g=GROUPS[ix]; if(!g){ if(el.boardList) el.boardList.innerHTML='<div class="desc">Hali ma’lumot yo‘q</div>'; return; }
  const arr=users.slice(0,50), rows=[];
  for(let r=g.start;r<=g.end;r++){
    const u=arr[r-1]; if(!u) continue; const isTop3=r<=3;
    const left=isTop3?`<span class="medal ${r===1?'m1':r===2?'m2':'m3'}">${r===1?'🏆':r===2?'🥈':'🥉'}</span>`:`<span class="rnk">#${r}</span>`;
    rows.push(`<div class="rank grad-border glass tier-${g.tier} ${isTop3?('top-'+r):''}">
      <div>${left}</div>
      <div><b>${escapeHtml(u.name || 'Foydalanuvchi')}</b><div class="desc">${escapeHtml(u.class || '—')} · ${escapeHtml(u.school || '—')}</div></div>
      <div style="text-align:right"><b>⭐ ${fmtPoints(u.points)}</b></div>
    </div>`);
  }
  if (el.boardList) el.boardList.innerHTML=`<div class="group grad-border glass"><div class="groupHead tier-${g.tier}"><span class="tier-badge">${g.label}</span><span class="stars">${starSVG(100,g.grad)}</span></div><div class="groupBody">${rows.join('')}</div></div>`;
  if (el.decileInfo) el.decileInfo.textContent=g.label;
  if (el.decilePrev) el.decilePrev.disabled=(ix<=0);
  if (el.decileNext) el.decileNext.disabled=(ix>=GROUPS.length-1);
}
if (el.decilePrev) el.decilePrev.onclick=()=>{ if(CURRENT_DECILE>0){ CURRENT_DECILE--; drawDecile(latestUsers,CURRENT_DECILE); } };
if (el.decileNext) el.decileNext.onclick=()=>{ if(CURRENT_DECILE<GROUPS.length-1){ CURRENT_DECILE++; drawDecile(latestUsers,CURRENT_DECILE); } };

/* ==== REGION JSON ==== */
let REGION_DATA = { regions: [] };
async function loadRegions(){
  try{
    const res = await fetch('./region.json', {cache:'no-store'});
    REGION_DATA = await res.json();
  }catch(e){ console.error('region.json yuklashda xato', e); REGION_DATA = { regions: [] }; }
}
function fillRegionSelect(selectedName=''){
  const opts = REGION_DATA.regions.map(r=>`<option value="${r.name}">${r.name}</option>`);
  el.PM.rSel.innerHTML = `<option value="" disabled ${selectedName?'':'selected'}>— tanlang —</option>` + opts.join('');
  if(selectedName && REGION_DATA.regions.find(r=>r.name===selectedName)) el.PM.rSel.value=selectedName;
  fillDistrictSelect(el.PM.rSel.value||'', '');
}
function findRegion(name){ return REGION_DATA.regions.find(r=>r.name===name); }
function fillDistrictSelect(regionName, selectedDistrict=''){
  const reg = findRegion(regionName);
  const dlist = reg ? reg.districts.map(d=> (typeof d==='string'? {name:d, schools:[]} : d)) : [];
  const opts = dlist.map(d=>`<option value="${d.name}">${d.name}</option>`);
  el.PM.dSel.innerHTML = `<option value="" disabled ${selectedDistrict?'':'selected'}>— tanlang —</option>` + opts.join('');
  if(selectedDistrict && dlist.some(d=>d.name===selectedDistrict)) el.PM.dSel.value = selectedDistrict;
  fillSchoolSelect(regionName, el.PM.dSel.value||'', '');
}
function getDistrict(regionName, districtName){
  const reg = findRegion(regionName); if(!reg) return null;
  const obj = reg.districts.map(d=> (typeof d==='string'? {name:d, schools:[]} : d)).find(x=>x.name===districtName);
  return obj||null;
}
function fillSchoolSelect(regionName, districtName, selectedSchool=''){
  const dist = getDistrict(regionName, districtName);
  const schools = dist?.schools || [];
  const opts = schools.map(s=>`<option value="${s}">${s}</option>`);
  el.PM.schoolSel.innerHTML = `<option value="" disabled ${selectedSchool?'':'selected'}>— tanlang —</option>` + opts.join('');
  if(selectedSchool && schools.includes(selectedSchool)) el.PM.schoolSel.value = selectedSchool;
}

/* ==== SCHOOL custom toggle ==== */
function useCustomSchool(on){
  el.PM.schoolCustom.classList.toggle('hidden', !on);
  el.PM.schoolSel.classList.toggle('hidden', on);
  el.PM.schoolToggle.textContent = on ? "Ro‘yxatdan tanlash" : "Ro‘yxatda yo‘q";
}
if (el.PM.schoolToggle) el.PM.schoolToggle.addEventListener('click', ()=>{
  const isCustom = el.PM.schoolCustom.classList.contains('hidden')===false;
  useCustomSchool(!isCustom);
});

/* ==== CLASS ==== */
const GRADE_LIST = Array.from({length:11}, (_,i)=>String(i+1)); // 1..11
function fillClassSelect(gradeValue){
  el.PM.grade.innerHTML =
    `<option value="" disabled ${gradeValue?'':'selected'}>—</option>` +
    GRADE_LIST.map(g=>`<option value="${g}">${g}</option>`).join('');
  if (gradeValue) el.PM.grade.value = String(gradeValue);
}
function onlyGradeFromClass(klass){
  const m = String(klass||'').match(/\d+/); return m ? m[0] : '';
}
function setClassVisible(visible){ el.PM.gradeWrap.style.display = visible ? '' : 'none'; }

/* ==== POPUP ==== */
function openPop(){ if(!el.mask||!el.pop||!el.chip) return; el.mask.style.display='block'; el.pop.style.display='block'; el.chip.setAttribute('aria-expanded','true'); }
function closePop(){ if(!el.mask||!el.pop||!el.chip) return; el.mask.style.display='none'; el.pop.style.display='none'; el.chip.setAttribute('aria-expanded','false'); }
if (el.more) el.more.addEventListener('click',e=>{e.stopPropagation();openPop();});
if (el.mask) el.mask.addEventListener('click',closePop);
document.addEventListener('click',e=>{ if(el.pop && el.chip && !el.pop.contains(e.target) && !el.chip.contains(e.target)) closePop(); });
window.addEventListener('keydown',e=>{ if(e.key==='Escape') closePop(); });

/* ==== PROFILE FLOW ==== */
let currentUserId=null, CURRENT_PROFILE=null;

function profileIsComplete(u){
  const must = !!(u && u.name && /\s/.test(u.name) && u.region && u.district && u.school && u.phone && u.role);
  if(!must) return false;
  if(u.role === 'teacher') return true;
  return !!u.class;
}
function showApp(){ if(!gate||!app) return; gate.style.display='none'; app.style.display='block'; html.classList.remove('auth-checking'); }
function lockToLogin(){ if(!gate||!app) return; app.style.display='none'; gate.style.display='flex'; html.classList.remove('auth-checking'); }

function openProfileModal(pref={}){
  el.PM.first.value=pref.first||''; el.PM.last.value=pref.last||'';
  el.PM.ph.value=pref.phone||''; el.PM.err.textContent='';
  el.PM.role.value = (pref.role==='teacher' || pref.role==='student') ? pref.role : 'student';
  setClassVisible(el.PM.role.value==='student');

  fillRegionSelect(pref.region||'');
  fillDistrictSelect(pref.region||'', pref.district||'');
  fillSchoolSelect(pref.region||'', pref.district||'', pref.school||'');

  const dist = getDistrict(pref.region||'', pref.district||'');
  const inList = !!(pref.school && dist?.schools?.includes(pref.school));
  useCustomSchool(!inList);
  if(!inList) el.PM.schoolCustom.value = pref.school || '';

  const gradePref = onlyGradeFromClass(pref.klass||'');
  fillClassSelect(gradePref);

  el.PM.mask.style.display='flex'; document.body.classList.add('modal-open');
}
function closeProfileModal(){ el.PM.mask.style.display='none'; document.body.classList.remove('modal-open'); }
if (el.PM.close) el.PM.close.onclick=closeProfileModal;
window.addEventListener('keydown',e=>{ if(e.key==='Escape' && el.PM.mask && getComputedStyle(el.PM.mask).display!=='none') closeProfileModal(); });

if (el.PM.rSel) el.PM.rSel.addEventListener('change', ()=>{ fillDistrictSelect(el.PM.rSel.value, ''); useCustomSchool(false); el.PM.schoolCustom.value=''; });
if (el.PM.dSel) el.PM.dSel.addEventListener('change', ()=>{ fillSchoolSelect(el.PM.rSel.value, el.PM.dSel.value, ''); useCustomSchool(false); el.PM.schoolCustom.value=''; });
if (el.PM.role) el.PM.role.addEventListener('change', ()=> setClassVisible(el.PM.role.value==='student'));

/* SAVE */
if (el.PM.save) el.PM.save.onclick=async ()=>{
  el.PM.err.textContent='';

  const first=el.PM.first.value.trim(), last=el.PM.last.value.trim();
  const role = el.PM.role.value || 'student';
  const region=el.PM.rSel.value || ''; const district=el.PM.dSel.value || '';
  const isCustom = !el.PM.schoolCustom.classList.contains('hidden');
  const school = isCustom ? el.PM.schoolCustom.value.trim() : (el.PM.schoolSel.value || '');
  const phone=el.PM.ph.value.trim();
  const klass = (role==='teacher') ? '' : (el.PM.grade.value || '');

  if(!first||!last||!role||!region||!district||!school||!phone){
    el.PM.err.textContent='Barcha maydonlar majburiy (o‘qituvchi uchun sinf majburiy emas).'; return;
  }
  if(role==='student' && !klass){
    el.PM.err.textContent='Sinf raqamini tanlang.'; return;
  }

  const name=`${first} ${last}`;
  try{
    const ref=doc(db,'users',currentUserId);
    await setDoc(ref,{name, role, region, district, school, class:(role==='teacher'?null:klass), phone},{merge:true});
    CURRENT_PROFILE={...(CURRENT_PROFILE||{}),name, role, region, district, school, class:(role==='teacher'?null:klass), phone};
    closeProfileModal(); fillChip(CURRENT_PROFILE);
  }catch(e){ console.error('profile save error',e); el.PM.err.textContent='Saqlashda xatolik. Internetni tekshiring.'; }
};

/* CHIP */
function fillChip(u){
  if (el.name) el.name.textContent=u?.name || 'Foydalanuvchi';
  if (el.numeric) el.numeric.textContent='ID: '+(u?.numericId || '—');
  if (el.region) el.region.textContent=u?.region || '—';
  if (el.district) el.district.textContent=u?.district || '—';
  if (el.school) el.school.textContent=u?.school || '—';
  if (el.klass) el.klass.textContent=(u?.role==='teacher')? '— (o‘qituvchi)' : (u?.class ? `${u.class}-sinf` : '—');
  const phEl=document.getElementById('ucPhone'); if(phEl) phEl.textContent=u?.phone || '—';
  if (el.pointsVal) el.pointsVal.textContent=fmtPoints(u?.points ?? 0);
}

/* AUTH */
async function ensureUser(user){
  const ref=doc(db,'users',user.uid);
  await runTransaction(db, async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists()){
      tx.set(ref,{
        name:user.displayName|| (user.email?user.email.split('@')[0]:'Foydalanuvchi'),
        email:user.email||null, photoURL:user.photoURL||null,
        role:'student',
        numericId:Math.floor(1000+Math.random()*9000),
        points:0, region:null, district:null, school:null, class:null, phone:null, createdAt:Date.now()
      });
    }
  });
  const data=(await getDoc(ref)).data(); return data;
}
function resetChip(){
  const ava=document.getElementById('ucAva'); if(ava) ava.textContent='LM';
  if (el.pointsVal) el.pointsVal.textContent='—';
  if (el.name) el.name.textContent='Mehmon';
  if (el.numeric) el.numeric.textContent='ID: —';
  if (el.region) el.region.textContent='—';
  if (el.district) el.district.textContent='—';
  if (el.school) el.school.textContent='—';
  if (el.klass) el.klass.textContent='—';
}

watchAuth(async(user)=>{
  if(!user){ currentUserId=null; CURRENT_PROFILE=null; resetChip(); lockToLogin(); return; }
  currentUserId=user.uid;
  await loadRegions();
  const u=await ensureUser(user); CURRENT_PROFILE=u;
  setAvatar(user.photoURL||initials(u.name||user.email));
  fillChip(u); showApp();

  const seenKey=`lm-profile-seen:${currentUserId}`;
  if(!profileIsComplete(u) && !localStorage.getItem(seenKey)){
    const nm=(u.name||'').trim().split(/\s+/,2);
    openProfileModal({
      first:nm[0]||'', last:nm[1]||'',
      role:u.role||'student',
      region:u.region||'', district:u.district||'',
      school:u.school||'', klass:u.class||'', phone:u.phone||''
    });
    localStorage.setItem(seenKey,'1');
  }

  onSnapshot(query(collection(db,'users'), orderBy('points','asc'), limit(100)), (snap)=>{
    // Tartib: ko‘tarilish uchun “asc”? Agar pastdan yuqoriga kerak bo‘lsa, o‘zgartiring:
    const docs = snap.docs.map(d=>({ id:d.id, uid:d.id, ...d.data() }));
    // Yuz % to‘g‘ri tartib: points desc, so‘ng numericId asc
    latestUsers = docs.sort((a,b)=> (Number(b.points)||0) - (Number(a.points)||0) || (a.numericId??0)-(b.numericId??0));
    drawDecile(latestUsers, CURRENT_DECILE);
  }, (err)=>{ console.error('board error',err); if(el.boardList) el.boardList.innerHTML='<div class="desc">Leaderboard hozircha yopiq</div>'; });
});

/* Popover actions */
if (el.openProfile) el.openProfile.onclick=(e)=>{
  e.preventDefault(); closePop();
  const u=CURRENT_PROFILE||{};
  const nm=(u.name||'').trim().split(/\s+/,2);
  openProfileModal({
    first:nm[0]||'', last:nm[1]||'',
    role=u.role||'student',
    region=u.region||'', district=u.district||'',
    school=u.school||'', klass=u.class||'', phone=u.phone||''
  });
};
if (el.signOutBtn) el.signOutBtn.onclick=async(e)=>{ e.preventDefault(); await signOut(auth); closePop(); lockToLogin(); };

/* ===== BOOT + SECURITY ===== */
function boot(){
  console.log('Boot ishladi');
  initContent();
}
function securePage(){
  const isEditable = (el) => {
    if (!el) return false;
    const t = el.tagName;
    return el.isContentEditable || t==='INPUT' || t==='TEXTAREA' || t==='SELECT';
  };
  document.addEventListener('contextmenu', e => e.preventDefault(), {capture:true});
  document.addEventListener('keydown', e=>{
    if (isEditable(e.target)) return;
    const k=e.key.toUpperCase();
    const blocked = k==='F12' ||
      (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(k)) ||
      (e.ctrlKey && (k==='U' || k==='S'));
    if (blocked){ e.preventDefault(); e.stopPropagation(); }
  });
  ['copy','cut'].forEach(evt=>{
    document.addEventListener(evt, e=>{ if(!isEditable(e.target)){ e.preventDefault(); e.stopPropagation(); }});
  });
  document.addEventListener('dragstart', e=>{ if (e.target.closest('img,svg,canvas,picture')) e.preventDefault(); });
  ['selectstart','mousedown'].forEach(evt=>{
    document.addEventListener(evt, e=>{
      if (isEditable(e.target) || e.target.closest('.allow-select')) return;
      e.preventDefault();
    }, {passive:false});
  });
  window.addEventListener('beforeprint', ()=>{ document.body.style.display='none'; setTimeout(()=>document.body.style.display='',0); });
  window.addEventListener('load', ()=>{
    document.querySelectorAll('img').forEach(img=>{
      img.setAttribute('draggable','false');
      img.addEventListener('dragstart', e=>e.preventDefault());
      img.addEventListener('contextmenu', e=>e.preventDefault());
    });
  });
}

/* Start */
if (document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', ()=>{ boot(); securePage(); });
}else{
  boot(); securePage();
}

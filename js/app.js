import {
  auth, db, googleProvider,
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, runTransaction, serverTimestamp,
  collection, collectionGroup, getDocs, query, orderBy, limit, where, startAfter, Timestamp, onSnapshot,
  ensureNumericIdAndProfile, updateProfileLocked
} from './firebase.js';

/* Theme */
const btnTheme=document.getElementById('btn-theme'); const root=document.documentElement;
btnTheme.addEventListener('click', ()=>{ const wasLight=root.classList.toggle('light'); localStorage.setItem('theme', wasLight?'light':'dark'); });
if(localStorage.getItem('theme')==='light') root.classList.add('light');

/* Elements */
const gate=document.getElementById('auth-gate'); const diag=document.getElementById('diag'); const authErr=document.getElementById('auth-error');
const btnGoogle=document.getElementById('btn-google'); const formEmail=document.getElementById('form-email');
const btnLogin=document.getElementById('btn-email-login'); const btnSignup=document.getElementById('btn-email-signup');
const pageRoot=document.getElementById('page-root'); const nav=document.querySelector('.bnav');
const pModal=document.getElementById('profile-modal'); const btnSaveProfile=document.getElementById('btn-save-profile');

function addDiag(msg){ if(diag){ diag.textContent += (diag.textContent? '\n' : '') + msg; } }
function showErr(e){ const msg=(e && (e.message||e.code))? (e.code? `${e.code}: ${e.message}`: e.message) : 'Noma\'lum xato'; if(authErr){authErr.textContent=msg; authErr.classList.remove('hidden');} console.error(e); window.__lastAuthError=msg; }
function clearErr(){ if(authErr){authErr.textContent=''; authErr.classList.add('hidden');} }

if(location.protocol==='file:'){ showErr('Bu sahifa file:// rejimida — autentifikatsiya ishlamaydi. HTTP(S) orqali xizmatdan foydalaning.'); }

(async ()=>{ try{ const res=await getRedirectResult(auth); if(res && res.user){ addDiag('Redirect yakunlandi: '+(res.user.email||res.user.uid)); } } catch(e){ showErr(e); } })();

/* Auth */
btnGoogle.addEventListener('click', async ()=>{
  btnGoogle.disabled=true; btnGoogle.textContent='Kutib turing...';
  try{ await signInWithPopup(auth, googleProvider); } catch(e){
    addDiag('Popup xatosi: '+(e.code||e.message));
    try{ await signInWithRedirect(auth, googleProvider); } catch(e2){ showErr(e2); }
  } finally { btnGoogle.disabled=false; btnGoogle.textContent='Google bilan davom etish'; }
});
formEmail.addEventListener('submit', async (e)=>{
  e.preventDefault(); btnLogin.disabled=true; btnLogin.textContent='Kirilmoqda...'; clearErr();
  try{ await signInWithEmailAndPassword(auth, formEmail.email.value, formEmail.password.value); } catch(e){ showErr(e); }
  finally{ btnLogin.disabled=false; btnLogin.textContent='Kirish'; }
});
btnSignup.addEventListener('click', async ()=>{
  btnSignup.disabled=true; btnSignup.textContent='Yaratilmoqda...'; clearErr();
  try{ await createUserWithEmailAndPassword(auth, formEmail.email.value, formEmail.password.value); } catch(e){ showErr(e); }
  finally{ btnSignup.disabled=false; btnSignup.textContent="Ro'yxatdan o'tish"; }
});

/* Profile modal */
btnSaveProfile.addEventListener('click', async (e)=>{
  e.preventDefault();
  try{
    const data={ firstName:val('#p-firstName'), lastName:val('#p-lastName'), middleName:val('#p-middleName'), birthDate:val('#p-birthDate'), address:val('#p-address'), phone:val('#p-phone'), profileComplete:true };
    if(Object.values(data).some(v=>!v)) throw new Error('Barcha maydonlarni to\'ldiring');
    await updateProfileLocked(auth.currentUser.uid, data); pModal.close();
  }catch(e){ const el=document.getElementById('profile-error'); if(el){el.textContent=e.message||e.code; el.classList.remove('hidden');} }
});
function val(sel){ const el=document.querySelector(sel); return (el && el.value||'').trim(); }

/* Nav */
nav.addEventListener('click',(e)=>{ const btn=e.target.closest('button[data-page]'); if(!btn) return; document.querySelectorAll('.bnav button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderPage(btn.dataset.page); });

function renderPage(page){ if(page==='home') return renderHome(); if(page==='courses') return renderCourses(); if(page==='tests') return renderTests(); if(page==='live') return renderLive(); if(page==='sim') return renderSim(); if(page==='settings') return renderSettings(); renderHome(); }

/* Mini Router */
function navigate(path){
  try{
    const loc = new URL(path, location.origin);
    if (loc.origin === location.origin){
      history.pushState({path: loc.pathname}, '', loc.pathname);
      route();
    } else { toggleAuthGate(true);
      location.href = path;
    }
  }catch(_){
    location.href = path;
  }
}
window.addEventListener('popstate', ()=> route());
function route(){
  const p = location.pathname;
  if (p.startsWith('/test/')){
    const slug = p.split('/').pop();
    renderTestPlayer(slug);
    document.querySelectorAll('.bnav button').forEach(b=>b.classList.remove('active'));
    const tb = document.querySelector('.bnav button[data-page="tests"]'); if(tb) tb.classList.add('active');
    return;
  }
  const map = { '/': 'home', '/home': 'home', '/courses': 'courses', '/tests': 'tests', '/sim': 'sim', '/live': 'live', '/settings': 'settings' };
  if (map[p]){ renderPage(map[p]); return; }
  renderHome();
}

/* Badges */
const badgeId=document.getElementById('badge-id'); const badgeBal=document.getElementById('badge-balance'); const badgeGem=document.getElementById('badge-gems');

/* CSV helpers + Firestore prefer */
function resolveCsvAlias(p){ try{ const m=(window.CONTENT_SOURCES||{}); if(p.endsWith('content/tests.csv')||p.includes('content/tests.csv')) return m.testsCsv || p; return p; }catch(_){ return p; }}
const CSV_CACHE_TTL_MS = 5*60*1000;
async function loadCSV(path){
  path = resolveCsvAlias(path);
  try{
    const key = 'csv:'+path;
    const cached = sessionStorage.getItem(key);
    if(cached){
      const obj = JSON.parse(cached);
      if(Date.now() - obj.t < CSV_CACHE_TTL_MS){
        return parseCSV(obj.v);
      } else {
        sessionStorage.removeItem(key);
      }
    }
  }catch(_){}
 try{ const res=await fetch(path); if(!res.ok) return []; const text=await res.text(); const lines=text.trim().split(/\r?\n/); const headers=lines[0].split(','); return lines.slice(1).map(l=>{ const cells=l.split(','); const o={}; headers.forEach((h,i)=>o[h.trim()]=(cells[i]||'').trim()); return o; }); }catch(e){ return []; }}
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
async function loadFromFirestore(coll){ try{ const snap=await getDocs(collection(db,coll)); const arr=[]; snap.forEach(d=>arr.push({id:d.id, ...d.data()})); return arr;}catch(e){ return []; }}
function withTimeout(promise, ms){ return Promise.race([promise, new Promise((_,rej)=>setTimeout(()=>rej(new Error('TIMEOUT')), ms))]); }
async function preferFirestore(coll,csv){
  const [coll, csvPath] = arguments;
  try{
    const ref = collection(db, coll);
    const snap = await withTimeout(getDocs(ref), 2500);
    const arr = snap.docs.map(d=> ({id:d.id, ...d.data()}) );
    if(arr && arr.length) return arr;
  }catch(e){ console.warn('preferFirestore fallback:', e && e.message || e); }
  try{
    const rows = await loadCSV(csvPath);
    return rows || [];
  }catch(e){ console.error('CSV fallback failed:', e); return []; }
}

/* === Universal Card Builder === */
const UC_PALETTE = {
  ad:     { icon:'📣', variant:'ad',     label:'Reklama' },
  course: { icon:'🎓', variant:'course', label:'Kurs' },
  test:   { icon:'📝', variant:'test',   label:'Test' },
  sim:    { icon:'🎮', variant:'sim',    label:'Sim' },
  live:   { icon:'🔥', variant:'live',   label:'Live' },
  default:{ icon:'📦', variant:'test',   label:'Kontent' }
};
function svgBgInline(){
  return `<div class="ucard-bg"><svg viewBox='0 0 400 240' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'>
    <defs>
      <linearGradient id='g1' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%'  stop-color='var(--uc-a)' stop-opacity='.6'/>
        <stop offset='100%' stop-color='var(--uc-b)' stop-opacity='.15'/>
      </linearGradient>
      <linearGradient id='g2' x1='1' y1='0' x2='0' y2='1'>
        <stop offset='0%'  stop-color='var(--uc-b)' stop-opacity='.6'/>
        <stop offset='100%' stop-color='var(--uc-c)' stop-opacity='.15'/>
      </linearGradient>
    </defs>
    <rect width='400' height='240' fill='url(#g1)'/>
    <circle cx='330' cy='40' r='80' fill='url(#g2)' opacity='.35'/>
    <circle cx='40' cy='200' r='100' fill='url(#g2)' opacity='.25'/>
    <path d='M0,160 C80,120 140,140 220,110 C300,80 360,100 400,80 L400,240 L0,240 Z' fill='url(#g1)' opacity='.35'/>
  </svg></div><div class='glow'></div>`;
}
function cardUniversal(opts={}, ctx={}){
  const t = (opts.type && UC_PALETTE[opts.type]) ? UC_PALETTE[opts.type] : UC_PALETTE.default;
  const title = opts.title || opts.name || '—';
  const tag = opts.tag || t.label;
  const meta = opts.meta || '';
  const image = opts.image || '';
  const price = (opts.price!=null) ? parseInt(opts.price||'0',10)||0 : (parseInt(opts.entryPrice||'0',10)||0);
  const priceLabel = price>0 ? `${price.toLocaleString()} so'm` : 'Bepul';
  const pid = opts.productId || (title.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
  const safe = JSON.stringify({ ...opts, productId: pid, type: t.variant }).replace(/"/g,'&quot;');
  return `<div class="ucard premium" data-variant="${t.variant}" data-card='${safe}'>
    ${svgBgInline()}
    <div class="media">${image ? `<img loading="lazy" src="${image}" alt="${title}">` : `<div class="skel block" aria-hidden="true"></div>`}
      <span class="badge">${tag}</span>
      <span class="typechip">${t.icon} ${t.label}</span>
      ${ctx.page==='live' ? `<span class="ucountdown" data-countdown></span><span class="badge alt">👥 <span data-live-count>—</span></span>` : ``}
    </div>
    <div class="body">
      <div class="title">${title}</div>
      <div class="meta">${meta}</div>
      <div class="row cta-row">
        <div class="price">${(t.variant==='test' || t.variant==='live') && price>0 ? '💵 ' + priceLabel : ''}</div>
        <div class="row" style="gap:.4rem">
          ${ctx.page==='tests' || t.variant==='test' ? `<button class="btn btn-sm act-start">Boshlash</button>`:''}
          ${ctx.page==='courses' ? `<button class="btn btn-sm act-open">Kirish</button>`:''}
          ${ctx.page==='home' ? `<button class="btn btn-sm act-open">Ko'rish</button>`:''}
          ${ctx.page==='sim' ? `<button class="btn btn-sm act-open">Ochish</button>`:''}
          ${ctx.page==='live' ? `<button class="btn btn-sm act-live-start">Boshlash</button><button class="btn btn-sm quiet act-live">Batafsil</button>`:''}
        </div>
      </div>
    </div>
  </div>`;
}
function bindUniversalCards(container, ctx={}){
  container.querySelectorAll('.ucard[data-card]').forEach(el=>{
    const data = JSON.parse(el.dataset.card.replace(/&quot;/g,'"'));
    const price = (data.price!=null) ? parseInt(data.price||'0',10)||0 : (parseInt(data.entryPrice||'0',10)||0);
    const pid = data.productId;
    const startBtn = el.querySelector('.act-start');
    const openBtn = el.querySelector('.act-open');
    const liveBtn = el.querySelector('.act-live');
    const liveStartBtn = el.querySelector('.act-live-start');

    if (startBtn){
      startBtn.addEventListener('click', async ()=>{
        try{
          const allowed = await hasAccess({price, productId: pid});
          if(!allowed && price>0){
            if(confirm(`Bu test pullik (${price.toLocaleString()} so'm). Xarid qilasizmi?`)){
              await spend(price, {productId: pid, name: data.title||data.name||'Kontent'});
            } else { toggleAuthGate(true); return; }
          }
          if(data.link){ navigate(data.link); } else { toggleAuthGate(true); alert('Link belgilanmagan'); }
        }catch(e){ showErr(e); }
      });
    }
    if (openBtn){
      openBtn.addEventListener('click', ()=>{ if(data.link){ navigate(data.link); } else { toggleAuthGate(true); alert("Link topilmadi"); } });
    }
    if (liveBtn){
      liveBtn.addEventListener('click', ()=>{ openLiveModal(data); });
    }
    if (liveStartBtn){
      liveStartBtn.addEventListener('click', async ()=>{
        try{
          const toMs = (v)=> (v && v.toMillis) ? v.toMillis() : (typeof v==='number'? v : (v && Date.parse(v) ? Date.parse(v) : 0));
          const sMs = data.startAt ? toMs(data.startAt) : 0;
          const eMs = data.endAt ? toMs(data.endAt) : 0;
          const now = Date.now();
          if(!(sMs && eMs && now>=sMs && now<=eMs)){ alert('LIVE hali boshlanmagan yoki yakunlangan'); return; }
          let joined=false;
          try{ if(data.id){ const me=await getDoc(doc(db,'live_events',data.id,'entries',auth.currentUser.uid)); joined=me.exists(); } }catch(_){}
          if(!joined){ alert("Siz ro'yxatdan o'tmagansiz (pre-join talab). Batafsil orqali ro'yxatdan o'ting."); return; }
          if(data.startLink){ navigate(data.startLink); } else { toggleAuthGate(true); alert('Start link belgilanmagan'); }
        }catch(e){ showErr(e); }
      });
    }
  });
}

/* Pages */
async function renderHome(){
  const ads = await preferFirestore('content_home','./content/home.csv');
  pageRoot.innerHTML = `<h3 class="section-title">Reklamalar</h3>
    <div id="home-cards" class="cards">` + ads.map(it=> cardUniversal({ ...it, type:'ad', title:it.title, image:it.image||'', link: it.link||'' }, {page:'home'})).join('') + `</div>
    <h3 class="section-title" style="margin-top:.75rem">Foydalanuvchilar (olmos kamayish tartibida)</h3>
    <div id="users-list" class="list"></div>
    <div class="row end mt-2"><button id="users-loadmore" class="btn quiet">Ko'proq yuklash</button></div>`;
  bindUniversalCards(document.getElementById('home-cards'), {page:'home'});
  document.getElementById('users-loadmore').addEventListener('click', ()=>renderUsersList(true));
  await renderUsersList(false);
}
async function renderCourses(){
  const items = await preferFirestore('content_courses','./content/courses.csv');
  pageRoot.innerHTML = `<h3 class="section-title">Kurslar</h3>
    <div id="courses-cards" class="cards">` + items.map(it=> cardUniversal({ ...it, type:'course', title:it.name||it.title, link: it.link||'' }, {page:'courses'})).join('') + `</div>`; pageRoot.insertAdjacentHTML('beforeend', `<div class=\"card p-4 mt-2\" id=\"live-lb-overall\"><div class="livebar"><div>🌐 Umumiy TOP</div></div><div class="lb" id="lb2-body"><div class="small muted">Yuklanmoqda...</div></div></div>`);
  /* CALL_OVERALL_LB */ try{ await renderLiveOverall(); }catch(_){}
  bindUniversalCards(document.getElementById('courses-cards'), {page:'courses'});
}
async function renderTests(){
  const items = await preferFirestore('content/tests','./content/tests.csv');
  pageRoot.innerHTML = `<h3 class="section-title">Testlar</h3>
    <div id="tests-cards" class="cards">` + items.map(it=> cardUniversal({ ...it, type:'test', title:it.name||it.title, price: it.price||0, productId: it.productId, link: it.link||'' }, {page:'tests'})).join('') + `</div>`; pageRoot.insertAdjacentHTML('beforeend', `<div class=\"card p-4 mt-2\" id=\"live-lb-overall\"><div class="livebar"><div>🌐 Umumiy TOP</div></div><div class="lb" id="lb2-body"><div class="small muted">Yuklanmoqda...</div></div></div>`);
  /* CALL_OVERALL_LB */ try{ await renderLiveOverall(); }catch(_){}
  bindUniversalCards(document.getElementById('tests-cards'), {page:'tests'});
}
async function renderSim(){
  const items = await preferFirestore('content/sim','./content/sim.csv');
  pageRoot.innerHTML = `<h3 class="section-title">Simulyator</h3>
    <div id="sim-cards" class="cards">` + items.map(it=> cardUniversal({ ...it, type:'sim', title:it.name||it.title, link: it.link||'' }, {page:'sim'})).join('') + `</div>`; pageRoot.insertAdjacentHTML('beforeend', `<div class=\"card p-4 mt-2\" id=\"live-lb-overall\"><div class="livebar"><div>🌐 Umumiy TOP</div></div><div class="lb" id="lb2-body"><div class="small muted">Yuklanmoqda...</div></div></div>`);
  /* CALL_OVERALL_LB */ try{ await renderLiveOverall(); }catch(_){}
  bindUniversalCards(document.getElementById('sim-cards'), {page:'sim'});
}

/* LIVE + modal */
async async function renderLive(){
  let events=[]; try{ const snap=await getDocs(collection(db,'live_events')); snap.forEach(d=>events.push({id:d.id, ...d.data()})); }catch(e){ events=[]; }
  if(events.length===0){ events=await loadCSV('./content/live.csv'); }
  const toMs=(v)=> (v && v.toMillis) ? v.toMillis() : (typeof v==='number'? v : (v && Date.parse(v) ? Date.parse(v) : 0));
  const statusOf=(ev,now)=>{ const s=toMs(ev.startAt), e=toMs(ev.endAt); if(s && e && now>=s && now<=e) return 'live'; if(s && now<s) return 'upcoming'; return 'finished'; };
  const now=Date.now(); events.sort((a,b)=>{ const r={live:0,upcoming:1,finished:2}; const sa=statusOf(a,now), sb=statusOf(b,now); if(r[sa]!==r[sb]) return r[sa]-r[sb]; return (toMs(a.startAt)||0)-(toMs(b.startAt)||0); });

  pageRoot.innerHTML = `<h3 class="section-title">Live turnirlar</h3>
    <div id="live-cards" class="cards">` + events.map(ev=>{
      const when = ev.startAt ? new Date(toMs(ev.startAt)).toLocaleString() : '—';
      const entry = parseInt(ev.entryPrice||'0',10)||0;
      return cardUniversal({ ...ev, type:'live', title: ev.title||ev.name||'Live test', meta:`🎁 ${ev.prize||'—'} • ⏱ ${when}`, price: entry, startLink: ev.startLink||'', modalText: ev.modalText||'' }, {page:'live'});
    }).join('') + `</div>`; pageRoot.insertAdjacentHTML('beforeend', `<div class=\"card p-4 mt-2\" id=\"live-lb-overall\"><div class="livebar"><div>🌐 Umumiy TOP</div></div><div class="lb" id="lb2-body"><div class="small muted">Yuklanmoqda...</div></div></div>`);
  /* CALL_OVERALL_LB */ try{ await renderLiveOverall(); }catch(_){}

  document.querySelectorAll('#live-cards .ucard').forEach(async (card)=>{
    const data = JSON.parse(card.dataset.card.replace(/&quot;/g,'"'));
    const btnStart = card.querySelector('.act-live');
    const btnGo = card.querySelector('.act-live-start');
    if (btnStart) btnStart.addEventListener('click', ()=> openLiveModal(data));

    // countdown
    const pill = card.querySelector('[data-countdown]');
    if(pill){
      const toMs = (v)=> (v && v.toMillis) ? v.toMillis() : (typeof v==='number'? v : (v && Date.parse(v) ? Date.parse(v) : 0));
      const sMs = data.startAt ? toMs(data.startAt) : 0;
      const eMs = data.endAt ? toMs(data.endAt) : 0;
      function tick(){
        if(!sMs){ pill.textContent='—'; return; }
        const now = Date.now();
        if(sMs && now < sMs){
          const d = Math.max(0, sMs - now);
          const h=Math.floor(d/3_600_000), m=Math.floor((d%3_600_000)/60_000), s=Math.floor((d%60_000)/1000);
          pill.textContent = `Start: ${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
          if(btnGo) btnGo.disabled = true;
        } else if (sMs && eMs && now>=sMs && now<=eMs){
          pill.textContent = "LIVE";
          if(btnGo) btnGo.disabled = false;
        } else { toggleAuthGate(true);
          pill.textContent = "Yakunlangan";
          if(btnGo) btnGo.disabled = true;
        }
      }
      tick(); setInterval(tick, 1000);
    }

    // participants realtime
    const badge = card.querySelector('[data-live-count]');
    if(badge && data.id){
      try{
        const entCol = collection(db,'live_events',data.id,'entries');
        onSnapshot(entCol, (snap)=>{ badge.textContent = snap.size; });
      }catch(_){ /* ignore */ }
    }
  });
}

/* Live Details Modal */
let lmLbUnsub = null;
async function openLiveModal(ev){
  const dlg = document.getElementById('live-modal');
  const title = document.getElementById('lm-title');
  const meta = document.getElementById('lm-meta');
  const prize = document.getElementById('lm-prize');
  const entry = document.getElementById('lm-entry');
  const when = document.getElementById('lm-when');
  const statusEl = document.getElementById('lm-status');
  const ctaPre = document.getElementById('lm-prejoin');
  const ctaEnter = document.getElementById('lm-enter');
  const err = document.getElementById('lm-error');
  const lmCount = document.getElementById('lm-count');
  const lmBal = document.getElementById('lm-balance');
  const lmCd = document.getElementById('lm-countdown');
  const lmText = document.getElementById('lm-text');
  const lmLb = document.getElementById('lm-lb');

  err.classList.add('hidden'); err.textContent='';

  const toMs = (v)=> (v && v.toMillis) ? v.toMillis() : (typeof v==='number'? v : (v && Date.parse(v) ? Date.parse(v) : 0));
  const sMs = ev.startAt ? toMs(ev.startAt) : 0;
  const eMs = ev.endAt ? toMs(ev.endAt) : 0;
  function status(now){ if(sMs && eMs && now>=sMs && now<=eMs) return 'LIVE'; if(sMs && now<sMs) return 'UPCOMING'; return 'FINISHED'; }

  title.textContent = ev.title || ev.name || 'Live';
  meta.textContent = ev.meta || '';
  prize.textContent = ev.prize || '—';
  entry.textContent = `${parseInt(ev.entryPrice||'0',10)||0} so'm`;
  when.textContent = sMs ? (new Date(sMs)).toLocaleString() : '—';
  statusEl.textContent = status(Date.now());
  lmText.textContent = ev.modalText || '—';

  // Load participant count & user balance
  let joined=false, count='—', balance='—';
  try{
    const uref = doc(db,'users',auth.currentUser.uid);
    const us = await getDoc(uref); const ud = us.data()||{}; balance = (ud.balance??0).toLocaleString('uz-UZ') + " so'm";
    if(ev.id){
      const entCol = collection(db,'live_events', ev.id, 'entries');
      const snap = await getDocs(entCol); count = snap.size;
      const me = await getDoc(doc(db,'live_events',ev.id,'entries',auth.currentUser.uid)); joined = me.exists();
    }
  }catch(_){}
  lmCount.textContent = count; lmBal.textContent = balance;

  function drawActions(){
    const now = Date.now();
    statusEl.textContent = status(now);
    if(sMs && now < sMs){
      ctaPre.disabled = joined;
      ctaPre.textContent = joined ? "Ro'yxatga olingan ✅" : ( (parseInt(ev.entryPrice||'0',10)||0)>0 ? `Oldindan qo'shilish — ${(parseInt(ev.entryPrice||'0',10)||0).toLocaleString()} so'm` : "Oldindan qo'shilish" );
      ctaEnter.disabled = true; ctaEnter.textContent = "Kirish (LIVE boshlanmagan)";
    } else if (sMs && eMs && now>=sMs && now<=eMs){
      ctaPre.disabled = true; ctaPre.textContent = "Join yopiq";
      ctaEnter.disabled = !joined; ctaEnter.textContent = joined ? "Kirish" : "Kirish (join kerak)";
    } else { toggleAuthGate(true);
      ctaPre.disabled = true; ctaPre.textContent = "Yakunlangan";
      ctaEnter.disabled = true; ctaEnter.textContent = "Yakunlangan";
    }
  }
  drawActions();

  function tick(){
    if(!sMs){ lmCd.textContent='—'; return; }
    const d = Math.max(0, sMs - Date.now());
    const h=Math.floor(d/3_600_000), m=Math.floor((d%3_600_000)/60_000), s=Math.floor((d%60_000)/1000);
    lmCd.textContent = (d>0) ? `Boshlanishiga: ${h} soat ${m} daqiqa ${s} soniya` : 'Boshlanmoqda…';
    if(d<=0) drawActions();
  }
  tick(); const iv = setInterval(tick, 1000);

  const closeBtn = document.getElementById('lm-close');
  function close(){ clearInterval(iv); if(lmLbUnsub){ lmLbUnsub(); lmLbUnsub=null; } dlg.close(); }
  closeBtn.onclick = close;

  ctaPre.onclick = async ()=>{
    try{
      const price = parseInt(ev.entryPrice||'0',10)||0;
      if(price>0) await spend(price, {productId:'live:'+(ev.id||ev.title), name: ev.title||'Live test'});
      if(ev.id){ await setDoc(doc(db,'live_events',ev.id,'entries',auth.currentUser.uid), {at: serverTimestamp(), paid: price>0? price:0}, {merge:true}); }
      await addDoc(collection(db,'users',auth.currentUser.uid,'live_entries'), {eventRef: ev.id||ev.title, at: serverTimestamp(), paid: (parseInt(ev.entryPrice||'0',10)||0)});
      joined = true; drawActions();
    }catch(e){ err.textContent = e.message||e.code; err.classList.remove('hidden'); }
  };
  ctaEnter.onclick = ()=>{ if(!ctaEnter.disabled && ev.startLink){ navigate(ev.startLink); } };

  // realtime leaderboard
  if(ev.id && lmLb){
    try{
      const scQ = query(collection(db,'live_events', ev.id, 'scores'), orderBy('score','desc'), limit(50));
      lmLbUnsub = onSnapshot(scQ, (snap)=>{
        if(snap.empty){ lmLb.innerHTML = `<div class="small muted">🏆 Reyting: hali natijalar yo'q</div>`; return; }
        let rows=''; let rank=0;
        snap.forEach(docSnap=>{ const d=docSnap.data()||{}; rank++; const name=d.name||d.displayName||'—'; const score=d.score||0; rows += `<div class="lb-row"><div class="left"><div class="rk">${rank}</div><div class="name">${name}</div></div><div class="score">${score}</div></div>`; });
        lmLb.innerHTML = `<div class="small muted">🏆 Reyting (real-time):</div>` + rows;
      });
    }catch(e){ lmLb.innerHTML = `<div class="small muted">Reytingni o'qishda xatolik</div>`; }
  }
  dlg.showModal();
}

/* Test Player (Math) — explanations + seeded randomization + anti-cheat + lock + per-question timer */
async function renderTestPlayer(slug){
  const tests = await preferFirestore('content/tests','./content/tests.csv');
  const t = tests.find(it => (it.productId && it.productId===slug) || (it.link && it.link.endsWith('/'+slug)));
  if(!t){ pageRoot.innerHTML = `<div class="p-4 card">Test topilmadi.</div>`; return; }

  const price = parseInt(t.price||'0',10)||0;
  if(price>0){
    const ok = await hasAccess({price, productId: t.productId||slug});
    if(!ok){
      if(confirm(`Bu test pullik (${price.toLocaleString()} so'm). Xarid qilasizmi?`)){
        await spend(price, {productId: t.productId||slug, name: t.name||t.title||'Test'});
      } else { navigate('/tests'); return; }
    }
  }

  let qCsv = `./content/tests_data/${slug}.csv`;
  if(t.gsheet){ qCsv = t.gsheet; } else if(window.CONTENT_SOURCES && window.CONTENT_SOURCES.testsDataBase){ qCsv = window.CONTENT_SOURCES.testsDataBase.replace(/\/$/,'') + '/' + slug + '.csv'; }
  const rawRows = await loadCSV(qCsv);
  if(!rawRows || rawRows.length===0){
    pageRoot.innerHTML = `<div class="p-4 card">Bu test uchun savollar yo'q.</div>`; return;
  }

  const uid = (auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid : 'anon';
  const paramSeed = parseInt(getParam('seed')||'0',10)||0;
  const ssKey = `tp-seed:${uid}:${slug}`;
  let seed = paramSeed || parseInt(sessionStorage.getItem(ssKey)||'0',10) || (Math.floor(Math.random()*2**31));
  sessionStorage.setItem(ssKey, String(seed));
  const rnd = seededRandom ? seededRandom(seed) : null;

  const makeQ = (r)=>{
    const opts=[]; ['a','b','c','d'].forEach(k=>{ if(r[k]) opts.push({key:k,label:k.toUpperCase(),text:r[k],isCorrect:(String(r.ans||'').trim().toLowerCase()===k)}); });
    if(rnd && typeof seededShuffle==='function') seededShuffle(opts, rnd); else if(typeof shuffle==='function') shuffle(opts);
    return { text: r.text || r.q || '—', ex: r.ex || '', img: r.img || r.image || '', opts };
  };
  let rows = rawRows.map(makeQ);
  if(rnd && typeof seededShuffle==='function') seededShuffle(rows, rnd); else if(typeof shuffle==='function') shuffle(rows);

  let durationSec = parseInt(t.durationSec||'0',10)||0;
  if(!durationSec) durationSec = Math.max(300, Math.min(5400, rows.length*45));

  const qPer = Math.max(20, Math.min(180, Math.floor(durationSec / rows.length)));
  const state = { slug, title: t.name||t.title||slug, idx: 0, picks: new Array(rows.length).fill(null), locked: new Array(rows.length).fill(false), startAt: Date.now(), endAt: null, durationSec, remaining: durationSec, qRemaining: qPer, qPer, reveal:false, strikes:0 };

  function visHandler(){ if(document.hidden){ state.strikes++; let penalty = (state.strikes===1?10:(state.strikes===2?30:60)); state.remaining = Math.max(0, state.remaining - penalty); state.qRemaining = Math.max(0, state.qRemaining - Math.ceil(penalty/2)); showToast(`Diqqat: fokusdan chiqish uchun -${penalty}s jarima`); if(state.remaining<=0) finish(); } }
  document.addEventListener('visibilitychange', visHandler);

  function render(){
    const q = rows[state.idx];
    const prog = Math.round((state.idx)/rows.length*100);
    const picked = state.picks[state.idx];
    const locked = state.locked[state.idx];
    pageRoot.innerHTML = `<div class="tplayer">
      <div class="head">
        <div><strong>${state.title}</strong> — ${rows.length} savol</div>
        <div class="row" style="gap:.75rem"><div class="qtimer" id="tp-qtimer">00:00</div><div class="timer" id="tp-timer">00:00</div></div>
      </div>
      <div class="prog"><span style="width:${prog}%"></span></div>
      <div class="qcard">
        <div class="qtext">#${state.idx+1}. ${q.text}</div>
        ${q.img ? `<img class="qimg" src="${q.img}" alt="img" loading="lazy">` : ``}
        <div class="opts">
          ${q.opts.map((op,i)=>{
            const isSel = (picked===i);
            const mark = (state.reveal ? (op.isCorrect ? 'correct' : (isSel ? 'wrong' : '')) : (isSel ? 'selected' : ''));
            const dis = locked ? 'disabled' : '';
            return `<div class="opt ${mark} ${dis}" data-idx="${i}"><b>${op.label}.</b> ${op.text}</div>`;
          }).join('')}
        </div>
        <div class="ctrl">
          <button class="btn quiet" id="tp-prev" ${state.idx===0?'disabled':''}>Ortga</button>
          <div class="row gap-2">
            <button class="btn solbtn" id="tp-sol">${state.reveal?'Yechimni yashirish':'Yechimni ko\'rish'}</button>
            <button class="btn quiet" id="tp-skip">O'tkazib yuborish</button>
            <button class="btn" id="tp-next">${state.idx===rows.length-1?'Yakunlash':'Keyingi'}</button>
          </div>
        </div>
        ${ (state.reveal && q.ex) ? `<div class="sol"><div class="st">Yechim / Izoh</div><div>${q.ex}</div></div>` : ``}
      </div>
      <div class="small muted">Seed=${seed}. Ogohlantirishlar: ${state.strikes} ta.</div>
    </div>`;

    if(!locked){
      pageRoot.querySelectorAll('.opt').forEach(el=>{
        el.addEventListener('click', ()=>{ const i=parseInt(el.dataset.idx,10); state.picks[state.idx]=i; state.reveal=true; state.locked[state.idx]=true; render(); });
      });
    }
    pageRoot.querySelector('#tp-prev').addEventListener('click', ()=>{ if(state.idx>0){ state.idx--; state.reveal=false; state.qRemaining = state.qPer; render(); } });
    pageRoot.querySelector('#tp-skip').addEventListener('click', ()=>{ if(state.idx<rows.length-1){ state.idx++; state.reveal=false; state.qRemaining = state.qPer; render(); } else { finish(); } });
    pageRoot.querySelector('#tp-next').addEventListener('click', ()=>{ if(state.idx<rows.length-1){ state.idx++; state.reveal=false; state.qRemaining = state.qPer; render(); } else { finish(); } });
    pageRoot.querySelector('#tp-sol').addEventListener('click', ()=>{ state.reveal = !state.reveal; render(); });
    updateTimerText(); setTimeout(()=>{ if(window.requestMathTypeset) window.requestMathTypeset(); }, 50);
  }

  let iv=null;
  function startTimer(){
    iv = setInterval(()=>{
      state.remaining--; state.qRemaining--;
      if(state.qRemaining<=0){
        if(state.idx<rows.length-1){ state.idx++; state.reveal=false; state.qRemaining = state.qPer; } else { state.remaining = Math.max(0,state.remaining); finish(); return; }
      }
      if(state.remaining<=0){ state.remaining=0; finish(); return; }
      const bar = pageRoot.querySelector('.prog>span'); if(bar){ const prog = Math.round((state.idx)/rows.length*100); bar.style.width = prog+'%'; }
      updateTimerText();
    }, 1000);
  }
  function stopTimer(){ if(iv){ clearInterval(iv); iv=null; } document.removeEventListener('visibilitychange', visHandler); }
  function fmt(n){ const m=Math.floor(n/60), s=n%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  function updateTimerText(){ const t1 = document.getElementById('tp-timer'); if(t1) t1.textContent = fmt(state.remaining); const t2 = document.getElementById('tp-qtimer'); if(t2) t2.textContent = fmt(state.qRemaining); }

  async function finish(){
    stopTimer();
    state.endAt = Date.now();
    let good=0, bad=0, empty=0;
    rows.forEach((q,i)=>{ const pick = state.picks[i]; if(pick==null){ empty++; return; } const chosen = q.opts[pick]; if(chosen && chosen.isCorrect) good++; else bad++; });
    const rawPercent = Math.round(good/rows.length*100);
    const extraPenalty = Math.min(20, Math.max(0, (state.strikes-1)) * 2);
    const percent = Math.max(0, rawPercent - extraPenalty);
    try{
      await addDoc(collection(db,'users',auth.currentUser.uid,'test_runs'), {
        productId: t.productId||slug, title: state.title, total: rows.length, good, bad, empty, percent,
        startedAt: new Date(state.startAt), finishedAt: new Date(state.endAt), durationSec: state.durationSec, strikes: state.strikes, qPer: state.qPer, seed, picks: state.picks, rawPercent, extraPenalty
      });
    }catch(_){}

    // Gems award by difficulty
    const difficulty = (t.difficulty || 'easy').toLowerCase();
    const coef = (difficulty==='easy')? {win:1, lose:-0.25} : (difficulty==='medium')? {win:2, lose:-0.5} : {win:3, lose:-0.75};
    const gemsDelta = Math.max(0, (good * coef.win) + (bad * coef.lose));
    try{
      await runTransaction(db, async (tx)=>{
        const uref=doc(db,'users',auth.currentUser.uid);
        const us=await tx.get(uref);
        const cur = (us.data().gems||0);
        tx.update(uref, { gems: Math.round((cur + gemsDelta)*100)/100, updatedAt: serverTimestamp() });
        await addDoc(collection(db,'users',auth.currentUser.uid,'gems_logs'), {delta:gemsDelta, difficulty, good, bad, at: serverTimestamp(), ref: (t.productId||slug)});
      });
    }catch(_){}

    const evId = getParam('event');
    if(evId){
      try{
        const uref = doc(db,'users',auth.currentUser.uid);
        const us = await getDoc(uref); const ud = us.data()||{};
        await setDoc(doc(db,'live_events',evId,'scores',auth.currentUser.uid), {
          uid: auth.currentUser.uid, name: (ud.firstName&&ud.lastName)? (ud.firstName+' '+ud.lastName) : (ud.displayName||ud.email||'—'),
          score: percent, updatedAt: serverTimestamp(), strikes: state.strikes
        }, { merge: true });
      }catch(_){}
    }

    pageRoot.innerHTML = `<div class="tplayer">
      <div class="rez">
        <h3>Natijalar — ${state.title}</h3>
        <p><span class="good">To'g'ri: ${good}</span> • <span class="bad">Noto'g'ri: ${bad}</span> • Bo'sh: ${empty}</p>
        <p><b>${percent}%</b> umumiy natija <span class='small muted'>(jarima: -${extraPenalty}%)</span></p>
        <p>💎 Qo'shilgan olmos: <b>${gemsDelta.toFixed(2)}</b></p>
        <div class="row gap-2 mt-2">
          <button class="btn" id="tp-again-same">Qayta yechish (shu tartib)</button>
          <button class="btn" id="tp-again-new">Qayta yechish (yangi tartib)</button>
          <button class="btn quiet" id="tp-exit">Testlarga qaytish</button>
        </div>
      </div>
    </div>`;
    document.getElementById('tp-again-same').addEventListener('click', ()=>{ sessionStorage.setItem(ssKey, String(seed)); renderTestPlayer(slug); });
    document.getElementById('tp-again-new').addEventListener('click', ()=>{ const newSeed = Math.floor(Math.random()*2**31); sessionStorage.setItem(ssKey, String(newSeed)); renderTestPlayer(slug); });
    document.getElementById('tp-exit').addEventListener('click', ()=> navigate('/tests'));
  }

  render(); startTimer();
}
/* Settings + Admin CRUD + Wallet */
function renderSettings(){
  pageRoot.innerHTML=`<div class="cards">
    <div class="card p-4"><h3>Hamyon</h3><div class="row gap-2 mt-2">
      <button class="btn" id="topup-10">➕ 10 000 so'm</button>
      <button class="btn" id="topup-50">➕ 50 000 so'm</button>
      <button class="btn" id="topup-100">➕ 100 000 so'm</button></div>
      <p class="muted mt-1 small">Demo to'ldirish (keyin Payme/Click).</p></div>
    <div class="card p-4" id="admin-card"><h3>Admin panel — Karta CRUD</h3>
      <div class="row gap-2 mt-2">
        <select id="ap-coll" class="input"><option value="content_home">Home</option><option value="content_courses">Courses</option><option value="content_tests">Tests</option><option value="content_sim">Sim</option><option value="live_events">Live</option></select>
      </div>
      <div class="row gap-2 mt-2"><input id="ap-title" class="input" placeholder="Title/Name"/><input id="ap-tag" class="input" placeholder="Tag"/><input id="ap-meta" class="input" placeholder="Meta"/><input id="ap-price" class="input" type="number" placeholder="Narx (tests)"/><input id="ap-productId" class="input" placeholder="Product ID (tests)"/></div>
      <div class="row gap-2 mt-2"><input id="ap-entry" class="input" type="number" placeholder="Entry (Live)"/><input id="ap-prize" class="input" placeholder="Prize (Live)"/><input id="ap-startAt" class="input" type="datetime-local" placeholder="StartAt (Live)"/><input id="ap-endAt" class="input" type="datetime-local" placeholder="EndAt (Live)"/></div>
      <div class="row end mt-2"><button class="btn" id="ap-add">➕ Yangi karta</button><button class="btn quiet" id="ap-refresh">Ro'yxatni yangilash</button></div>
      <div id="ap-list" class="cards mt-2"></div>
    </div>
    <div class="card p-4"><h3>Hisob</h3><div class="row gap-2 mt-2"><button class="btn quiet" id="btn-logout">Chiqish</button></div><div class="small muted mt-2" id="dbg-auth"></div><div class="small muted" id="dbg-last-error"></div></div>
  </div>`;
  document.getElementById('topup-10').addEventListener('click', ()=>doTopUp(10000));
  document.getElementById('topup-50').addEventListener('click', ()=>doTopUp(50000));
  document.getElementById('topup-100').addEventListener('click', ()=>doTopUp(100000));
  document.getElementById('btn-logout').addEventListener('click', ()=>signOut(auth));
  const dbgAuth=document.getElementById('dbg-auth'); const dbgErr=document.getElementById('dbg-last-error');
  dbgAuth.textContent=auth.currentUser?('User: '+(auth.currentUser.email||auth.currentUser.uid)):'User: (not signed in)';
  dbgErr.textContent=window.__lastAuthError?('Last error: '+window.__lastAuthError):'Last error: (none)';
  if(auth.currentUser){ getDoc(doc(db,'users',auth.currentUser.uid)).then(snap=>{ const d=snap.data()||{}; if(d.isAdmin===true){ bindAdminCrud(); } else { toggleAuthGate(true); document.getElementById('admin-card').innerHTML='<h3>Admin panel</h3><p class="muted small">isAdmin=true bo\'lgan foydalanuvchilar uchun.</p>'; } }); }
}
function bindAdminCrud(){ const collSel=document.getElementById('ap-coll'); const listEl=document.getElementById('ap-list');
  async function refresh(){ listEl.innerHTML='<div class="muted p-4">Yuklanmoqda...</div>'; const snap=await getDocs(collection(db,collSel.value)); const items=[]; snap.forEach(d=>items.push({id:d.id, ...d.data()})); if(items.length===0){ listEl.innerHTML='<div class="muted p-4">Hali karta yo\'q.</div>'; return; } listEl.innerHTML=items.map(it=>{ const live = (collSel.value==='live_events'); return `<div class="card p-4" data-id="${it.id}"><div class="row gap-2 mt-1"><input class="input ap-name" value="${(it.name||it.title||'').replace(/"/g,'&quot;')}" placeholder="Name/Title"/><input class="input ap-tag" value="${(it.tag||'').replace(/"/g,'&quot;')}" placeholder="Tag"/><input class="input ap-meta" value="${(it.meta||'').replace(/"/g,'&quot;')}" placeholder="Meta"/></div><div class="row gap-2 mt-1"><input class="input ap-price" type="number" value="${it.price||0}" placeholder="Price (tests)"/><input class="input ap-productId" value="${it.productId||''}" placeholder="Product ID (tests)"/></div>${live?`<div class='row gap-2 mt-1'><input class='input ap-entry' type='number' value='${it.entryPrice||0}' placeholder='Entry (Live)'/><input class='input ap-prize' value='${it.prize||''}' placeholder='Prize (Live)'/><input class='input ap-startAt' type='datetime-local' value='${(it.startAt && it.startAt.toDate? it.startAt.toDate().toISOString().slice(0,16) : (it.startAt||'')).toString().replace('Z','')}'/><input class='input ap-endAt' type='datetime-local' value='${(it.endAt && it.endAt.toDate? it.endAt.toDate().toISOString().slice(0,16) : (it.endAt||'')).toString().replace('Z','')}'/></div>`:''}<div class="row end mt-2"><button class="btn quiet ap-delete">O'chirish</button><button class="btn ap-save">Saqlash</button></div></div>`; }).join('');
    listEl.querySelectorAll('.card[data-id]').forEach(card=>{ const id=card.getAttribute('data-id');
      card.querySelector('.ap-save').addEventListener('click', async ()=>{ const live = (collSel.value==='live_events'); const payload={ name:gv(card,'.ap-name'), title:gv(card,'.ap-name'), tag:gv(card,'.ap-tag'), meta:gv(card,'.ap-meta'), price:parseInt(gv(card,'.ap-price')||'0',10)||0, productId:gv(card,'.ap-productId') };
        if(live){ const rawStart=gv(card,'.ap-startAt'); const rawEnd=gv(card,'.ap-endAt'); payload.entryPrice=parseInt(gv(card,'.ap-entry')||'0',10)||0; payload.prize=gv(card,'.ap-prize')||''; if(rawStart) payload.startAt=Timestamp.fromDate(new Date(rawStart)); if(rawEnd) payload.endAt=Timestamp.fromDate(new Date(rawEnd)); }
        await updateDoc(doc(db,collSel.value,id), payload); alert('Saqlangan'); });
      card.querySelector('.ap-delete').addEventListener('click', async ()=>{ if(!confirm('O\'chirishni tasdiqlaysizmi?')) return; await deleteDoc(doc(db,collSel.value,id)); card.remove(); });
    });
  }
  document.getElementById('ap-add').addEventListener('click', async ()=>{ const coll=collSel.value; const payload={ name:gv(document,'#ap-title'), title:gv(document,'#ap-title'), tag:gv(document,'#ap-tag'), meta:gv(document,'#ap-meta'), price:parseInt(gv(document,'#ap-price')||'0',10)||0, productId:gv(document,'#ap-productId') };
    if(coll==='live_events'){ const rawStart=gv(document,'#ap-startAt'); const rawEnd=gv(document,'#ap-endAt'); payload.entryPrice=parseInt(gv(document,'#ap-entry')||'0',10)||0; payload.prize=gv(document,'#ap-prize')||''; if(rawStart) payload.startAt=Timestamp.fromDate(new Date(rawStart)); if(rawEnd) payload.endAt=Timestamp.fromDate(new Date(rawEnd)); }
    if(!payload.title){ alert('Title/Name kiriting'); return; } await addDoc(collection(db,coll), payload); await refresh();
  });
  document.getElementById('ap-refresh').addEventListener('click', refresh); collSel.addEventListener('change', refresh); refresh();
}
function gv(root, sel){ const el=root.querySelector(sel); return el? el.value.trim() : ''; }

/* Wallet helpers */
async function doTopUp(amount){ try{ await topUp(amount); alert(amount.toLocaleString('uz-UZ')+' so\'m qo\'shildi'); }catch(e){ showErr(e);} }
async function topUp(amount){ if(amount<=0) throw new Error('Miqdor noto\'g\'ri'); await runTransaction(db, async (tx)=>{ const uref=doc(db,'users',auth.currentUser.uid); const snap=await tx.get(uref); const bal=(snap.data().balance||0)+amount; tx.update(uref,{balance:bal,updatedAt:serverTimestamp()}); }); }
async function spend(amount, product){ if(amount<0) throw new Error('Miqdor noto\'g\ri'); await runTransaction(db, async (tx)=>{ const uref=doc(db,'users',auth.currentUser.uid); const usnap=await tx.get(uref); const bal=usnap.data().balance||0; if(bal<amount) throw new Error('Balans yetarli emas'); const newBal=bal-amount; const gems=(usnap.data().gems||0)+Math.floor(amount/1000); tx.update(uref,{balance:newBal,gems,updatedAt:serverTimestamp()}); await addDoc(collection(db,'users',auth.currentUser.uid,'purchases'), {productId:product.productId,name:product.name,price:amount,at:serverTimestamp()}); }); }
async function hasAccess(product){ const price=parseInt(product.price||'0',10)||0; if(price<=0) return true; const pref=collection(db,'users',auth.currentUser.uid,'purchases'); const q=query(pref, where('productId','==', product.productId)); const snap=await getDocs(q); return !snap.empty; }

/* Auth state */
onAuthStateChanged(auth, async (user)=>{
  toggleAuthGate(!user);
  if(user){ try{ await ensureUserId(user.uid); }catch(_){ }
    try{
      const data=await ensureNumericIdAndProfile(user);
      gate.classList.remove('visible');
      const uref=doc(db,'users',auth.currentUser.uid);
      const snap=await getDoc(uref); const d=snap.data()||{};
      document.getElementById('badge-id').textContent = `ID: ${d.numericId || '—'}`;
      document.getElementById('badge-balance').textContent = `💵 ${d.balance ?? 0}`;
      document.getElementById('badge-gems').textContent = `💎 ${(d.gems ?? 0).toLocaleString('uz-UZ',{maximumFractionDigits:2})}`;
      if(!d.profileComplete) document.getElementById('profile-modal').showModal();
      route();
    }catch(e){ showErr(e); }
  } else { toggleAuthGate(true);
    gate.classList.add('visible');
  }
});

async function renderLiveOverall(){
  const body=document.getElementById('lb2-body'); if(!body) return;
  try{
    const snap = await getDocs(query(collectionGroup(db,'scores'), orderBy('updatedAt','desc'), limit(150)));
    const best = new Map();
    snap.forEach(d=>{ const x=d.data()||{}; const id=x.uid||d.id; const prev=best.get(id); const cand={uid:id, name:x.name||'—', score:x.score||0}; if(!prev || cand.score>prev.score) best.set(id,cand); });
    const arr=[...best.values()].sort((a,b)=> b.score-a.score).slice(0,100);
    body.innerHTML = arr.length? arr.map((d,i)=>`<div class='lb-row'><div class='left'><div class='rk'>${i+1}</div><div class='name'>${d.name}</div></div><div class='score'>${d.score}</div></div>`).join('') : `<div class='small muted'>Hali natijalar yo'q</div>`;
  }catch(e){ body.innerHTML = `<div class='small muted'>Umumiy reytingni o'qib bo'lmadi</div>`; }
}


function setUserBadge(d){
  try{
    const el = document.getElementById('badge-uid') || document.querySelector('[data-badge-uid]') || document.querySelector('.top .uid,.uid-badge,.id-badge');
    if(!el) return;
    const id = d && (d.userId || d.numericId || d.uid);
    el.textContent = id ? ('ID'+id) : 'ID: —';
  }catch(_){}
}

import {
  auth, db, googleProvider,
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut,
  ensureNumericIdAndProfile, updateProfileLocked
} from './firebase.js';
import {
  doc, onSnapshot, collection, getDocs,
  runTransaction, getDoc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  query, orderBy, limit, where, startAfter, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Theme
const btnTheme = document.getElementById('btn-theme');
const root = document.documentElement;
function applyTheme(){ const pref = localStorage.getItem('theme') || 'auto'; document.body.className = pref==='light'?'light':'theme-auto'; if (pref==='light') root.classList.add('light'); else root.classList.remove('light'); }
btnTheme.addEventListener('click', ()=>{ const curr=localStorage.getItem('theme')||'auto'; const next=curr==='auto'?'light':'auto'; localStorage.setItem('theme', next); applyTheme(); }); applyTheme();

// Nav
const pageRoot=document.getElementById('page-root'); const nav=document.querySelector('.bnav');
nav.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-page]'); if(!btn) return; document.querySelectorAll('.bnav button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderPage(btn.dataset.page); });
function renderPage(page){ if(page==='home') return renderHome(); if(page==='courses') return renderCourses(); if(page==='tests') return renderTests(); if(page==='live') return renderLive(); if(page==='sim') return renderSim(); if(page==='settings') return renderSettings(); renderHome(); }

// Auth
const gate=document.getElementById('auth-gate'); const emailForm=document.getElementById('email-form'); const btnEmailSignup=document.getElementById('btn-email-signup'); const authErr=document.getElementById('auth-error');
function showErr(e){ const msg=(e&&(e.message||e.code))?(e.code?`${e.code}: ${e.message}`:e.message):'Noma\'lum xato'; if(authErr){authErr.textContent=msg;authErr.classList.remove('hidden');} console.error('AUTH ERROR →',e); window.__lastAuthError=msg; }
window.__mcGoogle = async function(){ const btn=document.getElementById('btn-google'); if(btn){btn.disabled=true;btn.textContent='Kutib turing...';} try{ await signInWithPopup(auth, googleProvider); }catch(e){ try{ await signInWithRedirect(auth, googleProvider); await getRedirectResult(auth);}catch(e2){ showErr(e2||e);} } finally{ if(btn){btn.disabled=false;btn.textContent='Google bilan davom etish';} } };
emailForm.addEventListener('submit', async (e)=>{ e.preventDefault(); try{ await signInWithEmailAndPassword(auth, emailForm.email.value, emailForm.password.value);}catch(e){showErr(e);} });
btnEmailSignup.addEventListener('click', async ()=>{ try{ await createUserWithEmailAndPassword(auth, emailForm.email.value, emailForm.password.value);}catch(e){showErr(e);} });

// Profile modal
const pModal=document.getElementById('profile-modal'); const btnSaveProfile=document.getElementById('btn-save-profile'); const pErr=document.getElementById('profile-error');
btnSaveProfile.addEventListener('click', async (e)=>{ e.preventDefault(); try{ const data={ firstName:document.getElementById('p-firstName').value.trim(), lastName:document.getElementById('p-lastName').value.trim(), middleName:document.getElementById('p-middleName').value.trim(), birthDate:document.getElementById('p-birthDate').value, address:document.getElementById('p-address').value.trim(), phone:document.getElementById('p-phone').value.trim(), profileComplete:true }; if(Object.values(data).some(v=>!v)){ throw new Error('Barcha maydonlarni to\'ldiring.'); } await updateProfileLocked(auth.currentUser.uid, data); pModal.close(); }catch(e){ if(pErr){pErr.textContent=e.message; pErr.classList.remove('hidden');} }});

// Badges
const badgeId=document.getElementById('badge-id'); const badgeBal=document.getElementById('badge-balance'); const badgeGem=document.getElementById('badge-gems');

// CSV helpers
async function loadCSV(path){ try{ const res=await fetch(path); if(!res.ok) return []; const text=await res.text(); const lines=text.trim().split(/\r?\n/); const headers=lines[0].split(','); return lines.slice(1).map(line=>{ const cells=line.split(','); const obj={}; headers.forEach((h,i)=>obj[h.trim()]=(cells[i]||'').trim()); return obj; }); }catch(e){ return []; }}
// Firestore content helpers
async function loadFromFirestore(coll){ try{ const c=collection(db,coll); const snap=await getDocs(c); const arr=[]; snap.forEach(d=>arr.push(d.data())); return arr;}catch(e){return [];} }
async function preferFirestore(coll, csv){ const fs=await loadFromFirestore(coll); if(Array.isArray(fs)&&fs.length>0) return fs; return await loadCSV(csv); }

// Shared card renderer
function card(item){ return `<div class="card item"><div class="row gap-2"><div class="badge">${item.tag||'NEW'}</div><div class="name">${item.name||item.title}</div></div><div class="meta mt-2">${item.meta||''}</div></div>`; }

// Users list (paged)
let __usersPageCursor=null;
async function fetchUsersPage(limitSize=50){ const baseQ=query(collection(db,'users'), orderBy('gems','desc'), limit(limitSize)); const qref=__usersPageCursor?query(baseQ, startAfter(__usersPageCursor)):baseQ; const snap=await getDocs(qref); const rows=[]; snap.forEach(d=>rows.push({id:d.id, ...d.data()})); __usersPageCursor=snap.docs.length? snap.docs[snap.docs.length-1] : __usersPageCursor; return rows; }
async function renderUsersGrid(append=false){ const grid=document.getElementById('users-grid'); const more=document.getElementById('users-loadmore'); if(!append){ grid.innerHTML=''; __usersPageCursor=null; } let batch=[]; try{ batch=await fetchUsersPage(50);}catch(e){ console.error('Users load error', e); const grid=document.getElementById('users-grid'); if(grid){ grid.innerHTML = `<div class="error">${e.message||'Ruxsat yo\'q yoki tarmoq xatosi.'}</div>`; } return; } const cards=batch.map(u=>{ const name=(u.firstName&&u.lastName)?(u.firstName+' '+u.lastName):(u.displayName||'—'); return `<div class="card item"><div class="row gap-2"><div class="badge">ID ${u.numericId||'—'}</div><div class="name">${name}</div></div><div class="meta mt-2">💎 ${u.gems||0}</div></div>`; }).join(''); grid.insertAdjacentHTML('beforeend', cards || '<div class="muted">Foydalanuvchilar topilmadi.</div>'); if(more){ more.disabled=(batch.length===0); more.textContent=(batch.length===0)?'Yana yo\'q':'Ko\'proq yuklash'; } }

// Pages


async function renderHome(){
  const news=await preferFirestore('content_home','./content/home.csv');
  pageRoot.innerHTML=`
    <h3 class="section-title">Yangiliklar</h3>
    <div class="cards">${news.map(card).join('')}</div>
    <h3 class="section-title" style="margin-top:.75rem">Foydalanuvchilar (olmos kamayish tartibida)</h3>
    <div id="users-list" class="list"></div>
    <div class="row end mt-3"><button id="users-loadmore" class="btn quiet">Ko'proq yuklash</button></div>`;
  document.getElementById('users-loadmore').addEventListener('click', ()=>renderUsersList(true));
  await renderUsersList(false);
}
async function renderCourses(){ const items=await preferFirestore('content_courses','./content/courses.csv'); pageRoot.innerHTML=`<h3 class="section-title">Kurslar</h3><div class="cards">${items.map(card).join('')}</div>`; }
async function renderTests(){ const items=await preferFirestore('content_tests','./content/tests.csv'); pageRoot.innerHTML=`<h3 class="section-title">Testlar</h3>
  <div class="cards">`+items.map(it=>{ const title=it.name||it.title; const price=parseInt(it.price||'0',10)||0; const pid=it.productId||(title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'); const safe=JSON.stringify({name:title,tag:it.tag||'TEST',meta:it.meta||'',price,productId:pid}).replace(/"/g,'&quot;'); return `<div class="card item" data-product='${safe}'><div class="row gap-2"><div class="badge">${it.tag||'TEST'}</div><div class="name">${title}</div></div><div class="meta mt-2">${it.meta||''}</div><div class="row gap-2 mt-2">${price>0?`<button class="btn buy">Sotib olish — ${price.toLocaleString()} so'm</button>`:`<span class="muted">Bepul</span>`}<button class="btn quiet start">Boshlash</button></div></div>`; }).join('')+`</div>`;
  document.querySelectorAll('.card.item').forEach(cardEl=>{ const it=JSON.parse(cardEl.dataset.product.replace(/&quot;/g,'"')); const price=parseInt(it.price||'0',10)||0; const buyBtn=cardEl.querySelector('.buy'); if(buyBtn){ buyBtn.addEventListener('click', async ()=>{ try{ await spend(price,it); alert('Xarid muvaffaqiyatli! 💎 bonus berildi.'); }catch(e){ showErr(e);} }); } cardEl.querySelector('.start').addEventListener('click', async ()=>{ try{ const allowed=await hasAccess(it); if(!allowed){ alert('Bu test pullik. Avval sotib oling.'); return; } alert('✅ Kirish ruxsat. (Test UI bu yerda)'); }catch(e){ showErr(e);} }); });
}
async function renderSim(){ const items=await preferFirestore('content_sim','./content/sim.csv'); pageRoot.innerHTML=`<h3 class="section-title">Simulyator</h3><div class="cards">${items.map(card).join('')}</div>`; }
function renderSettings(){ pageRoot.innerHTML=`<div class="cards">
  <div class="card p-4"><h3>Hamyon</h3><div class="row gap-2 mt-2"><button class="btn" id="topup-10">➕ 10 000 so'm</button><button class="btn" id="topup-50">➕ 50 000 so'm</button><button class="btn" id="topup-100">➕ 100 000 so'm</button></div><p class="muted mt-2">Demo to'ldirish (keyin Payme/Click/Xazna).</p></div>
  <div class="card p-4" id="admin-card"><h3>Admin panel — Karta CRUD</h3>
    <div class="grid two mt-2"><select id="ap-coll" class="input"><option value="content_home">Home</option><option value="content_courses">Courses</option><option value="content_tests">Tests</option><option value="content_sim">Sim</option><option value="live_events">Live</option></select>
    <input id="ap-title" class="input" placeholder="Title/Name"/><input id="ap-tag" class="input" placeholder="Tag (NEW/ASOSIY/...)"/><input id="ap-meta" class="input" placeholder="Meta (narx/dars...)"/><input id="ap-price" class="input" type="number" placeholder="Narx (so'm) — testlar uchun"/><input id="ap-productId" class="input" placeholder="Product ID (tests)"/></div>
    <div class="row end mt-3"><button class="btn" id="ap-add">➕ Yangi karta</button><button class="btn quiet" id="ap-refresh">Ro'yxatni yangilash</button></div>
    <div id="ap-list" class="cards mt-3"></div></div>
  <div class="card p-4"><h3>Hisob</h3><div class="row gap-2 mt-2"><button class="btn quiet" id="btn-logout">Chiqish</button></div><div class="small muted mt-2" id="dbg-auth"></div><div class="small muted" id="dbg-last-error"></div></div></div>`;
  document.getElementById('topup-10').addEventListener('click', ()=>doTopUp(10000));
  document.getElementById('topup-50').addEventListener('click', ()=>doTopUp(50000));
  document.getElementById('topup-100').addEventListener('click', ()=>doTopUp(100000));
  document.getElementById('btn-logout').addEventListener('click', ()=>signOut(auth));
  const dbgAuth=document.getElementById('dbg-auth'); const dbgErr=document.getElementById('dbg-last-error');
  dbgAuth.textContent=auth.currentUser?('User: '+(auth.currentUser.email||auth.currentUser.uid)):'User: (not signed in)';
  dbgErr.textContent=window.__lastAuthError?('Last error: '+window.__lastAuthError):'Last error: (none)';
  if(auth.currentUser){ const uref=doc(db,'users',auth.currentUser.uid); getDoc(uref).then(snap=>{ const d=snap.data()||{}; if(d.isAdmin===true){ bindAdminCrud(); } else { document.getElementById('admin-card').innerHTML='<h3>Admin panel</h3><p class="muted">isAdmin=true bo\'lgan foydalanuvchilar uchun.</p>'; } }); }
}
function bindAdminCrud(){ const collSel=document.getElementById('ap-coll'); const listEl=document.getElementById('ap-list');
  async function refreshList(){ listEl.innerHTML='<div class="muted p-4">Yuklanmoqda...</div>'; const snap=await getDocs(collection(db, collSel.value)); const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
    if(items.length===0){ listEl.innerHTML='<div class="muted p-4">Hali karta yo\'q.</div>'; return; }
    listEl.innerHTML=items.map(it=>`<div class="card p-4" data-id="${'${it.id}'}">
      <div class="grid two"><input class="input ap-name" value="${'${(it.name||it.title||"").replace(/"/g,"&quot;")}' }"/><input class="input ap-tag" value="${'${(it.tag||"").replace(/"/g,"&quot;")}' }"/><input class="input ap-meta" value="${'${(it.meta||"").replace(/"/g,"&quot;")}' }"/><input class="input ap-price" type="number" value="${'${it.price||0}' }"/><input class="input ap-productId" value="${'${it.productId||""}' }"/></div>
      <div class="row end mt-3"><button class="btn quiet ap-delete">O'chirish</button><button class="btn ap-save">Saqlash</button></div></div>`).join('');
    listEl.querySelectorAll('.card[data-id]').forEach(card=>{ const id=card.getAttribute('data-id');
      card.querySelector('.ap-save').addEventListener('click', async ()=>{ const payload={ name:card.querySelector('.ap-name').value.trim(), title:card.querySelector('.ap-name').value.trim(), tag:card.querySelector('.ap-tag').value.trim(), meta:card.querySelector('.ap-meta').value.trim(), price:parseInt(card.querySelector('.ap-price').value||'0',10)||0, productId:card.querySelector('.ap-productId').value.trim() }; await updateDoc(doc(db, collSel.value, id), payload); alert('Saqlangan'); });
      card.querySelector('.ap-delete').addEventListener('click', async ()=>{ if(!confirm('O\'chirishni tasdiqlaysizmi?')) return; await deleteDoc(doc(db, collSel.value, id)); card.remove(); });
    });
  }
  document.getElementById('ap-add').addEventListener('click', async ()=>{ const name=document.getElementById('ap-title').value.trim(); const tag=document.getElementById('ap-tag').value.trim(); const meta=document.getElementById('ap-meta').value.trim(); const price=parseInt((document.getElementById('ap-price').value||'0'),10)||0; const productId=document.getElementById('ap-productId').value.trim(); if(!name){ alert('Nom/Title kiriting'); return; } await addDoc(collection(db, collSel.value), { name, title:name, tag, meta, price, productId, createdAt: serverTimestamp() }); await refreshList(); });
  document.getElementById('ap-refresh').addEventListener('click', refreshList); collSel.addEventListener('change', refreshList); refreshList();
}

// Wallet helpers
async function doTopUp(amount){ try{ await topUp(amount); alert(amount.toLocaleString('uz-UZ')+' so\'m qo\'shildi'); }catch(e){ showErr(e);} }
async function topUp(amount){ if(amount<=0) throw new Error('Miqdor noto\'g\'ri'); await runTransaction(db, async (tx)=>{ const uref=doc(db,'users',auth.currentUser.uid); const snap=await tx.get(uref); const bal=(snap.data().balance||0)+amount; tx.update(uref,{balance:bal,updatedAt:serverTimestamp()}); }); }
async function spend(amount,product){ if(amount<0) throw new Error('Miqdor noto\'g\'ri'); await runTransaction(db, async (tx)=>{ const uref=doc(db,'users',auth.currentUser.uid); const usnap=await tx.get(uref); const bal=usnap.data().balance||0; if(bal<amount) throw new Error('Balans yetarli emas'); const newBal=bal-amount; const gems=(usnap.data().gems||0)+Math.floor(amount/1000); tx.update(uref,{balance:newBal,gems,updatedAt:serverTimestamp()}); await addDoc(collection(db,'users',auth.currentUser.uid,'purchases'), {productId:product.productId,name:product.name,price:amount,at:serverTimestamp()}); }); }
async function hasAccess(product){ const price=parseInt(product.price||'0',10)||0; if(price<=0) return true; const pref=collection(db,'users',auth.currentUser.uid,'purchases'); const q=query(pref, where('productId','==', product.productId)); const snap=await getDocs(q); return !snap.empty; }

// Auth state
onAuthStateChanged(auth, async (user)=>{ if(user){ try{ const data=await ensureNumericIdAndProfile(user); gate.classList.remove('visible'); const uref=doc(db,'users',auth.currentUser.uid); onSnapshot(uref,(snap)=>{ const d=snap.data()||{}; document.getElementById('badge-id').textContent = `ID: ${d.numericId || '—'}`; document.getElementById('badge-balance').textContent = `💵 ${d.balance ?? 0}`; document.getElementById('badge-gems').textContent = `💎 ${d.gems ?? 0}`; }); if(!data.profileComplete) document.getElementById('profile-modal').showModal(); renderPage('home'); }catch(e){ showErr(e);} } else { gate.classList.add('visible'); }});

// Initial
renderPage('home');

async function renderLive(){
  let events=[];
  try{ const snap=await getDocs(collection(db,'live_events')); snap.forEach(d=>events.push({id:d.id,...d.data()})); }catch(e){ events=[]; }
  if(events.length===0){ events=await loadCSV('./content/live.csv'); }
  const toMs=(v)=> (v && v.toMillis) ? v.toMillis() : (typeof v==='number'? v : (v && Date.parse(v) ? Date.parse(v) : 0));
  const statusOf=(ev,now)=>{ const s=toMs(ev.startAt), e=toMs(ev.endAt); if(s && e && now>=s && now<=e) return 'live'; if(s && now<s) return 'upcoming'; return 'finished'; };
  const now=Date.now();
  events.sort((a,b)=>{ const r={live:0,upcoming:1,finished:2}; const sa=statusOf(a,now), sb=statusOf(b,now); if(r[sa]!==r[sb]) return r[sa]-r[sb]; return (toMs(a.startAt)||0)-(toMs(b.startAt)||0); });
  pageRoot.innerHTML = `<h3 class="section-title">Live turnirlar</h3><div class="cards">` + events.map(ev=>{
    const s=statusOf(ev,now); const badge=s==='live'?'live':(s==='upcoming'?'upcoming':'finished'); const when=ev.startAt? new Date(toMs(ev.startAt)).toLocaleString() : '—'; const prize=ev.prize||'—'; const entry=parseInt(ev.entryPrice||'0',10)||0;
    return `<div class="card item live-card" data-event='${JSON.stringify({...ev,__status:badge}).replace(/"/g,'&quot;')}'><div class="row gap-2"><div class="badge ${badge}">${s.toUpperCase()}</div><div class="name">${ev.title||ev.name||'Live test'}</div></div><div class="meta mt-2">🎁 Sovrin: ${prize} • 💵 Kirish: ${entry>0? entry.toLocaleString()+' so\'m':'Bepul'} • ⏱ ${when}</div><div class="row gap-2 mt-2 btn-row"></div></div>`;
  }).join('') + `</div>`;
  document.querySelectorAll('.card.live-card').forEach(async (card)=>{
    const ev = JSON.parse(card.dataset.event.replace(/&quot;/g,'"')); const sMs=(ev.startAt&&ev.startAt.toMillis)?ev.startAt.toMillis():(ev.startAt?Date.parse(ev.startAt):0); const eMs=(ev.endAt&&ev.endAt.toMillis)?ev.endAt.toMillis():(ev.endAt?Date.parse(ev.endAt):0);
    const btnRow=card.querySelector('.btn-row'); let hasEntry=false; try{ if(ev.id){ const r=await getDoc(doc(db,'live_events',ev.id,'entries',auth.currentUser.uid)); hasEntry=r.exists(); } }catch(_){}
    function draw(){ const now=Date.now(); if(sMs && now < sMs){ const entry=parseInt(ev.entryPrice||'0',10)||0; btnRow.innerHTML = `<button class="btn prejoin">${hasEntry? 'Ro\'yxatga olingan ✅' : (entry>0? 'Oldindan qo\'shilish — '+entry.toLocaleString()+' so\'m' : 'Oldindan qo\'shilish')}</button><button class="btn quiet countdown">Taymer…</button>`; const pre=card.querySelector('.prejoin'); pre.disabled=hasEntry; pre.addEventListener('click', async ()=>{ try{ if(entry>0) await spend(entry,{productId:'live:'+(ev.id||ev.title), name: ev.title||'Live test'}); if(ev.id){ await setDoc(doc(db,'live_events',ev.id,'entries',auth.currentUser.uid), {at: serverTimestamp(), paid: entry>0? entry:0}, {merge:true}); } await addDoc(collection(db,'users',auth.currentUser.uid,'live_entries'), {eventRef: ev.id||ev.title, at: serverTimestamp(), paid: entry>0? entry:0}); hasEntry=true; draw(); }catch(e){ showErr(e);} }); const c=card.querySelector('.countdown'); if(c){ const tick=()=>{ const d=Math.max(0, sMs-Date.now()); const h=Math.floor(d/3_600_000), m=Math.floor((d%3_600_000)/60_000), s=Math.floor((d%60_000)/1000); c.textContent=d>0?`Boshlanishiga: ${h} soat ${m} daqiqa ${s} soniya`:'Boshlanmoqda…'; if(d<=0){ draw(); } }; tick(); setInterval(tick,1000);} } else if (sMs && eMs && now>=sMs && now<=eMs){ btnRow.innerHTML = hasEntry? `<button class="btn enter">Kirish</button>`:`<button class="btn quiet" disabled>Join yopiq</button>`; if(hasEntry){ card.querySelector('.enter').addEventListener('click', ()=> alert('🎯 Live boshlandi! (Test UI bu yerda)')); } } else { btnRow.innerHTML = `<button class="btn quiet" disabled>Yakunlangan</button>`; } } draw(); });
}
async function updateLiveIndicator(){ try{ const snap=await getDocs(collection(db,'live_events')); let active=false; const now=Date.now(); snap.forEach(d=>{ const v=d.data(); const s=(v.startAt&&v.startAt.toMillis)?v.startAt.toMillis():Date.parse(v.startAt||''); const e=(v.endAt&&v.endAt.toMillis)?v.endAt.toMillis():Date.parse(v.endAt||''); if(s && e && now>=s && now<=e) active=true; }); const btn=document.querySelector('.bnav button[data-page="live"] span'); if(btn){ btn.innerHTML='Live'+(active?' <span class="live-dot" style="vertical-align:middle"></span>':''); } }catch(e){} }
setInterval(updateLiveIndicator,15000); updateLiveIndicator();


async function renderHome(){
  const news=await preferFirestore('content_home','./content/home.csv');
  pageRoot.innerHTML=`
    <h3 class="section-title">Yangiliklar</h3>
    <div class="cards">${news.map(card).join('')}</div>
    <h3 class="section-title" style="margin-top:.75rem">Foydalanuvchilar (olmos kamayish tartibida)</h3>
    <div id="users-list" class="list"></div>
    <div class="row end mt-3"><button id="users-loadmore" class="btn quiet">Ko'proq yuklash</button></div>`;
  document.getElementById('users-loadmore').addEventListener('click', ()=>renderUsersList(true));
  await renderUsersList(false);
}
async function renderCourses(){ const items=await preferFirestore('content_courses','./content/courses.csv'); pageRoot.innerHTML=`<h3 class="section-title">Kurslar</h3><div class="cards">${items.map(card).join('')}</div>`; }
async function renderTests(){ const items=await preferFirestore('content_tests','./content/tests.csv'); pageRoot.innerHTML=`<h3 class="section-title">Testlar</h3>
  <div class="cards">`+items.map(it=>{ const title=it.name||it.title; const price=parseInt(it.price||'0',10)||0; const pid=it.productId||(title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'); const safe=JSON.stringify({name:title,tag:it.tag||'TEST',meta:it.meta||'',price,productId:pid}).replace(/"/g,'&quot;'); return `<div class="card item" data-product='${safe}'><div class="row gap-2"><div class="badge">${it.tag||'TEST'}</div><div class="name">${title}</div></div><div class="meta mt-2">${it.meta||''}</div><div class="row gap-2 mt-2">${price>0?`<button class="btn buy">Sotib olish — ${price.toLocaleString()} so'm</button>`:`<span class="muted">Bepul</span>`}<button class="btn quiet start">Boshlash</button></div></div>`; }).join('')+`</div>`;
  document.querySelectorAll('.card.item').forEach(cardEl=>{ const it=JSON.parse(cardEl.dataset.product.replace(/&quot;/g,'"')); const price=parseInt(it.price||'0',10)||0; const buyBtn=cardEl.querySelector('.buy'); if(buyBtn){ buyBtn.addEventListener('click', async ()=>{ try{ await spend(price,it); alert('Xarid muvaffaqiyatli! 💎 bonus berildi.'); }catch(e){ showErr(e);} }); } cardEl.querySelector('.start').addEventListener('click', async ()=>{ try{ const allowed=await hasAccess(it); if(!allowed){ alert('Bu test pullik. Avval sotib oling.'); return; } alert('✅ Kirish ruxsat. (Test UI bu yerda)'); }catch(e){ showErr(e);} }); });
}
async function renderSim(){ const items=await preferFirestore('content_sim','./content/sim.csv'); pageRoot.innerHTML=`<h3 class="section-title">Simulyator</h3><div class="cards">${items.map(card).join('')}</div>`; }
function renderSettings(){ pageRoot.innerHTML=`<div class="cards">
  <div class="card p-4"><h3>Hamyon</h3><div class="row gap-2 mt-2"><button class="btn" id="topup-10">➕ 10 000 so'm</button><button class="btn" id="topup-50">➕ 50 000 so'm</button><button class="btn" id="topup-100">➕ 100 000 so'm</button></div><p class="muted mt-2">Demo to'ldirish (keyin Payme/Click/Xazna).</p></div>
  <div class="card p-4" id="admin-card"><h3>Admin panel — Karta CRUD</h3>
    <div class="grid two mt-2"><select id="ap-coll" class="input"><option value="content_home">Home</option><option value="content_courses">Courses</option><option value="content_tests">Tests</option><option value="content_sim">Sim</option><option value="live_events">Live</option></select>
    <input id="ap-title" class="input" placeholder="Title/Name"/><input id="ap-tag" class="input" placeholder="Tag (NEW/ASOSIY/...)"/><input id="ap-meta" class="input" placeholder="Meta (narx/dars...)"/><input id="ap-price" class="input" type="number" placeholder="Narx (so'm) — testlar uchun"/><input id="ap-productId" class="input" placeholder="Product ID (tests)"/></div>
    <div class="row end mt-3"><button class="btn" id="ap-add">➕ Yangi karta</button><button class="btn quiet" id="ap-refresh">Ro'yxatni yangilash</button></div>
    <div id="ap-list" class="cards mt-3"></div></div>
  <div class="card p-4"><h3>Hisob</h3><div class="row gap-2 mt-2"><button class="btn quiet" id="btn-logout">Chiqish</button></div><div class="small muted mt-2" id="dbg-auth"></div><div class="small muted" id="dbg-last-error"></div></div></div>`;
  document.getElementById('topup-10').addEventListener('click', ()=>doTopUp(10000));
  document.getElementById('topup-50').addEventListener('click', ()=>doTopUp(50000));
  document.getElementById('topup-100').addEventListener('click', ()=>doTopUp(100000));
  document.getElementById('btn-logout').addEventListener('click', ()=>signOut(auth));
  const dbgAuth=document.getElementById('dbg-auth'); const dbgErr=document.getElementById('dbg-last-error');
  dbgAuth.textContent=auth.currentUser?('User: '+(auth.currentUser.email||auth.currentUser.uid)):'User: (not signed in)';
  dbgErr.textContent=window.__lastAuthError?('Last error: '+window.__lastAuthError):'Last error: (none)';
  if(auth.currentUser){ const uref=doc(db,'users',auth.currentUser.uid); getDoc(uref).then(snap=>{ const d=snap.data()||{}; if(d.isAdmin===true){ bindAdminCrud(); } else { document.getElementById('admin-card').innerHTML='<h3>Admin panel</h3><p class="muted">isAdmin=true bo\'lgan foydalanuvchilar uchun.</p>'; } }); }
}
function bindAdminCrud(){ const collSel=document.getElementById('ap-coll'); const listEl=document.getElementById('ap-list');
  async function refreshList(){ listEl.innerHTML='<div class="muted p-4">Yuklanmoqda...</div>'; const snap=await getDocs(collection(db, collSel.value)); const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
    if(items.length===0){ listEl.innerHTML='<div class="muted p-4">Hali karta yo\'q.</div>'; return; }
    listEl.innerHTML=items.map(it=>`<div class="card p-4" data-id="${'${it.id}'}">
      <div class="grid two"><input class="input ap-name" value="${'${(it.name||it.title||"").replace(/"/g,"&quot;")}' }"/><input class="input ap-tag" value="${'${(it.tag||"").replace(/"/g,"&quot;")}' }"/><input class="input ap-meta" value="${'${(it.meta||"").replace(/"/g,"&quot;")}' }"/><input class="input ap-price" type="number" value="${'${it.price||0}' }"/><input class="input ap-productId" value="${'${it.productId||""}' }"/></div>
      <div class="row end mt-3"><button class="btn quiet ap-delete">O'chirish</button><button class="btn ap-save">Saqlash</button></div></div>`).join('');
    listEl.querySelectorAll('.card[data-id]').forEach(card=>{ const id=card.getAttribute('data-id');
      card.querySelector('.ap-save').addEventListener('click', async ()=>{ const payload={ name:card.querySelector('.ap-name').value.trim(), title:card.querySelector('.ap-name').value.trim(), tag:card.querySelector('.ap-tag').value.trim(), meta:card.querySelector('.ap-meta').value.trim(), price:parseInt(card.querySelector('.ap-price').value||'0',10)||0, productId:card.querySelector('.ap-productId').value.trim() }; await updateDoc(doc(db, collSel.value, id), payload); alert('Saqlangan'); });
      card.querySelector('.ap-delete').addEventListener('click', async ()=>{ if(!confirm('O\'chirishni tasdiqlaysizmi?')) return; await deleteDoc(doc(db, collSel.value, id)); card.remove(); });
    });
  }
  document.getElementById('ap-add').addEventListener('click', async ()=>{ const name=document.getElementById('ap-title').value.trim(); const tag=document.getElementById('ap-tag').value.trim(); const meta=document.getElementById('ap-meta').value.trim(); const price=parseInt((document.getElementById('ap-price').value||'0'),10)||0; const productId=document.getElementById('ap-productId').value.trim(); if(!name){ alert('Nom/Title kiriting'); return; } await addDoc(collection(db, collSel.value), { name, title:name, tag, meta, price, productId, createdAt: serverTimestamp() }); await refreshList(); });
  document.getElementById('ap-refresh').addEventListener('click', refreshList); collSel.addEventListener('change', refreshList); refreshList();
}

// Wallet helpers
async function doTopUp(amount){ try{ await topUp(amount); alert(amount.toLocaleString('uz-UZ')+' so\'m qo\'shildi'); }catch(e){ showErr(e);} }
async function topUp(amount){ if(amount<=0) throw new Error('Miqdor noto\'g\'ri'); await runTransaction(db, async (tx)=>{ const uref=doc(db,'users',auth.currentUser.uid); const snap=await tx.get(uref); const bal=(snap.data().balance||0)+amount; tx.update(uref,{balance:bal,updatedAt:serverTimestamp()}); }); }
async function spend(amount,product){ if(amount<0) throw new Error('Miqdor noto\'g\'ri'); await runTransaction(db, async (tx)=>{ const uref=doc(db,'users',auth.currentUser.uid); const usnap=await tx.get(uref); const bal=usnap.data().balance||0; if(bal<amount) throw new Error('Balans yetarli emas'); const newBal=bal-amount; const gems=(usnap.data().gems||0)+Math.floor(amount/1000); tx.update(uref,{balance:newBal,gems,updatedAt:serverTimestamp()}); await addDoc(collection(db,'users',auth.currentUser.uid,'purchases'), {productId:product.productId,name:product.name,price:amount,at:serverTimestamp()}); }); }
async function hasAccess(product){ const price=parseInt(product.price||'0',10)||0; if(price<=0) return true; const pref=collection(db,'users',auth.currentUser.uid,'purchases'); const q=query(pref, where('productId','==', product.productId)); const snap=await getDocs(q); return !snap.empty; }

// Auth state
onAuthStateChanged(auth, async (user)=>{ if(user){ try{ const data=await ensureNumericIdAndProfile(user); gate.classList.remove('visible'); const uref=doc(db,'users',auth.currentUser.uid); onSnapshot(uref,(snap)=>{ const d=snap.data()||{}; document.getElementById('badge-id').textContent = `ID: ${d.numericId || '—'}`; document.getElementById('badge-balance').textContent = `💵 ${d.balance ?? 0}`; document.getElementById('badge-gems').textContent = `💎 ${d.gems ?? 0}`; }); if(!data.profileComplete) document.getElementById('profile-modal').showModal(); renderPage('home'); }catch(e){ showErr(e);} } else { gate.classList.add('visible'); }});

// Initial
renderPage('home');

async function renderLive(){
  let events=[];
  try{ const snap=await getDocs(collection(db,'live_events')); snap.forEach(d=>events.push({id:d.id,...d.data()})); }catch(e){ events=[]; }
  if(events.length===0){ events=await loadCSV('./content/live.csv'); }
  const toMs=(v)=> (v && v.toMillis) ? v.toMillis() : (typeof v==='number'? v : (v && Date.parse(v) ? Date.parse(v) : 0));
  const statusOf=(ev,now)=>{ const s=toMs(ev.startAt), e=toMs(ev.endAt); if(s && e && now>=s && now<=e) return 'live'; if(s && now<s) return 'upcoming'; return 'finished'; };
  const now=Date.now();
  events.sort((a,b)=>{ const r={live:0,upcoming:1,finished:2}; const sa=statusOf(a,now), sb=statusOf(b,now); if(r[sa]!==r[sb]) return r[sa]-r[sb]; return (toMs(a.startAt)||0)-(toMs(b.startAt)||0); });
  pageRoot.innerHTML = `<h3 class="section-title">Live turnirlar</h3><div class="cards">` + events.map(ev=>{
    const s=statusOf(ev,now); const badge=s==='live'?'live':(s==='upcoming'?'upcoming':'finished'); const when=ev.startAt? new Date(toMs(ev.startAt)).toLocaleString() : '—'; const prize=ev.prize||'—'; const entry=parseInt(ev.entryPrice||'0',10)||0;
    return `<div class="card item live-card" data-event='${JSON.stringify({...ev,__status:badge}).replace(/"/g,'&quot;')}'><div class="row gap-2"><div class="badge ${badge}">${s.toUpperCase()}</div><div class="name">${ev.title||ev.name||'Live test'}</div></div><div class="meta mt-2">🎁 Sovrin: ${prize} • 💵 Kirish: ${entry>0? entry.toLocaleString()+' so\'m':'Bepul'} • ⏱ ${when}</div><div class="row gap-2 mt-2 btn-row"></div></div>`;
  }).join('') + `</div>`;
  document.querySelectorAll('.card.live-card').forEach(async (card)=>{
    const ev = JSON.parse(card.dataset.event.replace(/&quot;/g,'"')); const sMs=(ev.startAt&&ev.startAt.toMillis)?ev.startAt.toMillis():(ev.startAt?Date.parse(ev.startAt):0); const eMs=(ev.endAt&&ev.endAt.toMillis)?ev.endAt.toMillis():(ev.endAt?Date.parse(ev.endAt):0);
    const btnRow=card.querySelector('.btn-row'); let hasEntry=false; try{ if(ev.id){ const r=await getDoc(doc(db,'live_events',ev.id,'entries',auth.currentUser.uid)); hasEntry=r.exists(); } }catch(_){}
    function draw(){ const now=Date.now(); if(sMs && now < sMs){ const entry=parseInt(ev.entryPrice||'0',10)||0; btnRow.innerHTML = `<button class="btn prejoin">${hasEntry? 'Ro\'yxatga olingan ✅' : (entry>0? 'Oldindan qo\'shilish — '+entry.toLocaleString()+' so\'m' : 'Oldindan qo\'shilish')}</button><button class="btn quiet countdown">Taymer…</button>`; const pre=card.querySelector('.prejoin'); pre.disabled=hasEntry; pre.addEventListener('click', async ()=>{ try{ if(entry>0) await spend(entry,{productId:'live:'+(ev.id||ev.title), name: ev.title||'Live test'}); if(ev.id){ await setDoc(doc(db,'live_events',ev.id,'entries',auth.currentUser.uid), {at: serverTimestamp(), paid: entry>0? entry:0}, {merge:true}); } await addDoc(collection(db,'users',auth.currentUser.uid,'live_entries'), {eventRef: ev.id||ev.title, at: serverTimestamp(), paid: entry>0? entry:0}); hasEntry=true; draw(); }catch(e){ showErr(e);} }); const c=card.querySelector('.countdown'); if(c){ const tick=()=>{ const d=Math.max(0, sMs-Date.now()); const h=Math.floor(d/3_600_000), m=Math.floor((d%3_600_000)/60_000), s=Math.floor((d%60_000)/1000); c.textContent=d>0?`Boshlanishiga: ${h} soat ${m} daqiqa ${s} soniya`:'Boshlanmoqda…'; if(d<=0){ draw(); } }; tick(); setInterval(tick,1000);} } else if (sMs && eMs && now>=sMs && now<=eMs){ btnRow.innerHTML = hasEntry? `<button class="btn enter">Kirish</button>`:`<button class="btn quiet" disabled>Join yopiq</button>`; if(hasEntry){ card.querySelector('.enter').addEventListener('click', ()=> alert('🎯 Live boshlandi! (Test UI bu yerda)')); } } else { btnRow.innerHTML = `<button class="btn quiet" disabled>Yakunlangan</button>`; } } draw(); });
}
async function updateLiveIndicator(){ try{ const snap=await getDocs(collection(db,'live_events')); let active=false; const now=Date.now(); snap.forEach(d=>{ const v=d.data(); const s=(v.startAt&&v.startAt.toMillis)?v.startAt.toMillis():Date.parse(v.startAt||''); const e=(v.endAt&&v.endAt.toMillis)?v.endAt.toMillis():Date.parse(v.endAt||''); if(s && e && now>=s && now<=e) active=true; }); const btn=document.querySelector('.bnav button[data-page="live"] span'); if(btn){ btn.innerHTML='Live'+(active?' <span class="live-dot" style="vertical-align:middle"></span>':''); } }catch(e){} }
setInterval(updateLiveIndicator,15000); updateLiveIndicator();

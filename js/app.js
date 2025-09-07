import {
  auth, db, googleProvider,
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
  ensureNumericIdAndProfile, updateProfileLocked
} from './firebase.js';
import { doc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  runTransaction, getDoc, setDoc, addDoc, serverTimestamp, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Theme
const btnTheme = document.getElementById('btn-theme');
const root = document.documentElement;
function applyTheme() {
  const pref = localStorage.getItem('theme') || 'auto';
  document.body.className = pref === 'light' ? 'light' : 'theme-auto';
  if (pref === 'light') root.classList.add('light'); else root.classList.remove('light');
}
btnTheme.addEventListener('click', () => {
  const curr = localStorage.getItem('theme') || 'auto';
  const next = curr === 'auto' ? 'light' : (curr === 'light' ? 'auto' : 'auto');
  localStorage.setItem('theme', next);
  applyTheme();
});
applyTheme();

// Nav
const pageRoot = document.getElementById('page-root');
const nav = document.querySelector('.bnav');
nav.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-page]');
  if (!btn) return;
  document.querySelectorAll('.bnav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPage(btn.dataset.page);
});
function renderPage(page) {
  if (page === 'home') return renderHome();
  if (page === 'courses') return renderCourses();
  if (page === 'tests') return renderTests();
  if (page === 'sim') return renderSim();
  if (page === 'settings') return renderSettings();
  renderHome();
}

// Auth
const gate = document.getElementById('auth-gate');
const btnGoogle = document.getElementById('btn-google');
const emailForm = document.getElementById('email-form');
const btnEmailSignup = document.getElementById('btn-email-signup');
const authErr = document.getElementById('auth-error');
btnGoogle.addEventListener('click', async () => {
  try { await signInWithPopup(auth, googleProvider); } catch (e) { showErr(e); }
});
emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const email = emailForm.email.value;
    const pass = emailForm.password.value;
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) { showErr(e); }
});
btnEmailSignup.addEventListener('click', async () => {
  try {
    const email = emailForm.email.value;
    const pass = emailForm.password.value;
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (e) { showErr(e); }
});
function showErr(e){ authErr.textContent = e.message; authErr.classList.remove('hidden'); }

import { signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

window.__mcGoogle = async function(){
  const btn = document.getElementById('btn-google');
  if (btn) { btn.disabled = true; btn.textContent = 'Kutib turing...'; }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    try {
      await signInWithRedirect(auth, googleProvider);
      await getRedirectResult(auth);
    } catch (e2) {
      const err = document.getElementById('auth-error');
      if (err){ err.textContent = e2.message || e.message; err.classList.remove('hidden'); }
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Google bilan davom etish'; }
  }
};

// Bind (redundant safety)
document.addEventListener('DOMContentLoaded', ()=>{
  const g = document.getElementById('btn-google');
  if (g) g.addEventListener('click', ()=> window.__mcGoogle());
});


// Profile modal
const pModal = document.getElementById('profile-modal');
const btnSaveProfile = document.getElementById('btn-save-profile');
const pErr = document.getElementById('profile-error');
btnSaveProfile.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const data = {
      firstName: document.getElementById('p-firstName').value.trim(),
      lastName: document.getElementById('p-lastName').value.trim(),
      middleName: document.getElementById('p-middleName').value.trim(),
      birthDate: document.getElementById('p-birthDate').value,
      address: document.getElementById('p-address').value.trim(),
      phone: document.getElementById('p-phone').value.trim(),
      profileComplete: true
    };
    if (!data.firstName || !data.lastName || !data.middleName || !data.birthDate || !data.address || !data.phone) {
      throw new Error('Barcha maydonlarni to\'ldiring.');
    }
    await updateProfileLocked(auth.currentUser.uid, data);
    pModal.close();
  } catch (e) { pErr.textContent = e.message; pErr.classList.remove('hidden'); }
});

// Badges
const badgeId = document.getElementById('badge-id');
const badgeBal = document.getElementById('badge-balance');
const badgeGem = document.getElementById('badge-gems');

// CSV loader
import { getFirestore, collection, getDocs as fsGetDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function loadFromFirestore(collName){
  try{
    const c = collection(db, collName);
    const snap = await fsGetDocs(c);
    const arr = [];
    snap.forEach(d=>{
      const v = d.data();
      arr.push(v);
    });
    return arr;
  }catch(e){ return []; }
}

async function preferFirestore(pageKey, csvPath){
  // pageKey: 'content_home' | 'content_courses' | 'content_tests' | 'content_sim'
  const fsData = await loadFromFirestore(pageKey);
  if (Array.isArray(fsData) && fsData.length>0) return fsData;
  return await loadCSV(csvPath);
}

async function loadCSV(path){
  const res = await fetch(path);
  if(!res.ok) return [];
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map(line=>{
    const cells = line.split(',');
    const obj = {};
    headers.forEach((h,i)=> obj[h.trim()] = (cells[i]||'').trim());
    return obj;
  });
}

// Pages
function card(item){
  return `<div class="card item">
    <div class="row gap-2">
      <div class="badge">${item.tag||'NEW'}</div>
      <div class="name">${item.name||item.title}</div>
    </div>
    <div class="meta mt-2">${item.meta||''}</div>
  </div>`;
}
        <button class="btn quiet start">Boshlash</button>
      </div>
    </div>`;
  }).join('') + `</div>`;

  document.querySelectorAll('.card.item').forEach(cardEl=>{
    const it = JSON.parse(cardEl.dataset.product.replace(/&quot;/g,'"'));
    const price = parseInt(it.price||'0',10)||0;
    const buyBtn = cardEl.querySelector('.buy');
    if (buyBtn){
      buyBtn.addEventListener('click', async ()=>{
        try {
          await spend(price, it);
          alert('Xarid muvaffaqiyatli! 💎 bonus berildi.');
        } catch(e){ alert(e.message); }
      });
    }
    cardEl.querySelector('.start').addEventListener('click', ()=>{
      alert('Demo: Test boshlash oynasi.');
    });
  });
}
          const pref = doc(db, 'users', auth.currentUser.uid);
          await addDoc(collection(pref, 'teacher_items'), { name, tag, meta, price, createdAt: serverTimestamp() });
          alert('Saqlandi');
        });
      }
    });
  }
}

// Wallet helpers
async function doTopUp(amount){
  try{
    await topUp(amount);
    alert(amount.toLocaleString('uz-UZ') + " so'm qo'shildi");
  }catch(e){ alert(e.message); }
}
async function topUp(amount){
  if (amount <= 0) throw new Error("Miqdor noto'g'ri");
  await runTransaction(db, async (tx)=>{
    const uref = doc(db, 'users', auth.currentUser.uid);
    const snap = await tx.get(uref);
    const bal = (snap.data().balance || 0) + amount;
    tx.update(uref, { balance: bal, updatedAt: serverTimestamp() });
  });
}
async function spend(amount, product){
  if (amount < 0) throw new Error('Miqdor noto\'g\'ri');
  await runTransaction(db, async (tx)=>{
    const uref = doc(db, 'users', auth.currentUser.uid);
    const usnap = await tx.get(uref);
    const bal = usnap.data().balance || 0;
    if (bal < amount) throw new Error('Balans yetarli emas');
    const newBal = bal - amount;
    const gems = (usnap.data().gems || 0) + Math.floor(amount/1000);
    tx.update(uref, { balance: newBal, gems, updatedAt: serverTimestamp() });
    const pref = doc(db, 'users', auth.currentUser.uid);
    const purchaseRef = await addDoc(collection(pref, 'purchases'), {
      productId: product.productId, name: product.name, price: amount, at: serverTimestamp()
    });
  });
}

async function renderLeaderboard(){
  const qref = query(collection(db, 'users'), orderBy('gems','desc'), limit(100));
  const snap = await getDocs(qref);
  const rows = [];
  let rank = 1;
  snap.forEach(docu=>{
    const d = docu.data();
    rows.push({ rank: rank++, id: d.numericId || '—', name: (d.firstName && d.lastName) ? (d.firstName + ' ' + d.lastName) : (d.displayName || '—'), gems: d.gems || 0 });
  });
  pageRoot.innerHTML = \`
    <h3 class="section-title">Top-100 Reyting (💎)</h3>
    <div class="card p-4">
      \${rows.map(r=>\`<div class="row gap-3"><div class="badge">\${r.rank}</div> <div class="name">ID \${r.id}</div> <div class="muted">\${r.name}</div> <div class="name">💎 \${r.gems}</div></div>\`).join('')}
    </div>
  \`;
}

// Auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const data = await ensureNumericIdAndProfile(user);
    gate.classList.remove('visible');
    // live badges
    const uref = doc(db, 'users', auth.currentUser.uid);
    onSnapshot(uref, (snap)=>{
      const d = snap.data()||{};
      badgeId.textContent = `ID: ${d.numericId||'—'}`;
      badgeBal.textContent = `💵 ${d.balance ?? 0}`;
      badgeGem.textContent = `💎 ${d.gems ?? 0}`;
    });
    if (!data.profileComplete) pModal.showModal();
    renderPage('home');
  } else {
    gate.classList.add('visible');
  }
});

renderPage('home');


async function renderTests(){
  const items = await preferFirestore('content_tests', './content/tests.csv');
  pageRoot.innerHTML = `<h3 class="section-title">Testlar</h3>
  <div class="cards">` + items.map(it=>{
    const title = it.name || it.title;
    const price = parseInt(it.price||'0',10)||0;
    const pid = it.productId || (title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
    const safe = JSON.stringify({name:title, tag:it.tag||'TEST', meta:it.meta||'', price, productId:pid}).replace(/"/g,'&quot;');
    return `<div class="card item" data-product='${safe}'>
      <div class="row gap-2">
        <div class="badge">${it.tag||'TEST'}</div>
        <div class="name">${title}</div>
      </div>
      <div class="meta mt-2">${it.meta||''}</div>
      <div class="row gap-2 mt-2">
        ${price>0 ? `<button class="btn buy">Sotib olish — ${price.toLocaleString()} so'm</button>` : `<span class="muted">Bepul</span>`}
        <button class="btn quiet start">Boshlash</button>
      </div>
    </div>`;
  }).join('') + `</div>`;

  document.querySelectorAll('.card.item').forEach(cardEl=>{
    const it = JSON.parse(cardEl.dataset.product.replace(/&quot;/g,'"'));
    const price = parseInt(it.price||'0',10)||0;
    const buyBtn = cardEl.querySelector('.buy');
    if (buyBtn){
      buyBtn.addEventListener('click', async ()=>{
        try { await spend(price, it); alert('Xarid muvaffaqiyatli! 💎 bonus berildi.'); } catch(e){ alert(e.message); }
      });
    }
    cardEl.querySelector('.start').addEventListener('click', async ()=>{
      try{
        const allowed = await hasAccess(it);
        if (!allowed){
          alert('Bu test pullik. Avval sotib oling.');
          return;
        }
        alert('✅ Kirish ruxsat etildi. (Bu yerda test boshlash interfeysi bo'ladi)');
      }catch(e){ alert(e.message); }
    });
  });
}


import { where, Query, query as fsQuery } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
async function hasAccess(product){
  const price = parseInt(product.price||'0',10)||0;
  if (price<=0) return true;
  const pref = collection(db, 'users', auth.currentUser.uid, 'purchases');
  const q = fsQuery(pref, where('productId','==', product.productId));
  const snap = await getDocs(q);
  return !snap.empty;
}

async function renderHome(){
  const news = await preferFirestore('content_home', './content/home.csv');
  function card2(x){ return `<div class="card item">
    <div class="row gap-2"><div class="badge">${x.tag||'NEW'}</div><div class="name">${x.name||x.title}</div></div>
    <div class="meta mt-2">${x.meta||''}</div>
  </div>`;}
  pageRoot.innerHTML = `
    <h3 class="section-title">Yangiliklar</h3>
    <div class="cards">${news.map(card2).join('')}</div>
    <div class="row end mt-3"><button class="btn quiet" id="open-leaderboard">Top-100 Reyting</button></div>
  `;
  document.getElementById('open-leaderboard').addEventListener('click', ()=>renderLeaderboard());
}

async function renderCourses(){
  const items = await preferFirestore('content_courses', './content/courses.csv');
  function card2(x){ return `<div class="card item">
    <div class="row gap-2"><div class="badge">${x.tag||'ASOSIY'}</div><div class="name">${x.name||x.title}</div></div>
    <div class="meta mt-2">${x.meta||''}</div>
  </div>`;}
  pageRoot.innerHTML = `<h3 class="section-title">Kurslar</h3>
  <div class="cards">${items.map(card2).join('')}</div>`;
}

async function renderSim(){
  const items = await preferFirestore('content_sim', './content/sim.csv');
  function card2(x){ return `<div class="card item">
    <div class="row gap-2"><div class="badge">${x.tag||'SIM'}</div><div class="name">${x.name||x.title}</div></div>
    <div class="meta mt-2">${x.meta||''}</div>
  </div>`;}
  pageRoot.innerHTML = `<h3 class="section-title">Simulyator</h3>
  <div class="cards">${items.map(card2).join('')}</div>`;
}


function renderSettings(){
  pageRoot.innerHTML = `
    <div class="card p-4">
      <h3>Hamyon</h3>
      <div class="row gap-2 mt-2">
        <button class="btn" id="topup-10">➕ 10 000 so'm</button>
        <button class="btn" id="topup-50">➕ 50 000 so'm</button>
        <button class="btn" id="topup-100">➕ 100 000 so'm</button>
      </div>
      <p class="muted mt-2">Demo to'ldirish (keyin Payme/Click/Xazna qo'shamiz).</p>
    </div>
    <div class="card p-4 mt-3">
      <h3>Qo'shimcha</h3>
      <div class="row gap-2 mt-2">
        <button class="btn quiet" id="btn-open-leaderboard">Top-100 Reyting</button>
        <button class="btn quiet" id="btn-logout">Chiqish</button>
      </div>
      <div id="teacher-slot" class="mt-3"></div>
      <div id="admin-slot" class="mt-3"></div>
    </div>`;

  document.getElementById('topup-10').addEventListener('click', ()=>doTopUp(10000));
  document.getElementById('topup-50').addEventListener('click', ()=>doTopUp(50000));
  document.getElementById('topup-100').addEventListener('click', ()=>doTopUp(100000));
  document.getElementById('btn-logout').addEventListener('click', ()=>signOut(auth));
  document.getElementById('btn-open-leaderboard').addEventListener('click', ()=>renderLeaderboard());

  if (auth.currentUser){
    const uref = doc(db, 'users', auth.currentUser.uid);
    getDoc(uref).then(snap=>{
      const d = snap.data()||{};
      // Teacher panel
      if (d.isTeacher === true){
        const slot = document.getElementById('teacher-slot');
        slot.innerHTML = \`
          <div class="card p-4">
            <h3>O'qituvchi paneli</h3>
            <div class="grid two mt-2">
              <input id="ti-name" class="input" placeholder="Nom (masalan: Algebra 2)" />
              <input id="ti-tag" class="input" placeholder="Teg (ASOSIY/TEST/...)" />
              <input id="ti-meta" class="input" placeholder="Meta (narx/dars soni)" />
              <input id="ti-price" class="input" type="number" placeholder="Narx (so'm)" />
            </div>
            <div class="row end mt-3">
              <button class="btn" id="ti-save">Saqlash</button>
            </div>
          </div>\`;
        document.getElementById('ti-save').addEventListener('click', async ()=>{
          const name = document.getElementById('ti-name').value.trim();
          const tag = document.getElementById('ti-tag').value.trim();
          const meta = document.getElementById('ti-meta').value.trim();
          const price = parseInt((document.getElementById('ti-price').value||'0'),10)||0;
          if (!name){ alert('Nom kiriting'); return; }
          const pref = doc(db, 'users', auth.currentUser.uid);
          await addDoc(collection(pref, 'teacher_items'), { name, tag, meta, price, createdAt: serverTimestamp() });
          alert('Saqlandi');
        });
      }
      // Admin panel
      if (d.isAdmin === true){
        const aslot = document.getElementById('admin-slot');
        aslot.innerHTML = \`
          <div class="card p-4">
            <h3>Admin panel (Firestore kontent)</h3>
            <div class="grid two mt-2">
              <select id="ap-coll" class="input">
                <option value="content_home">Home</option>
                <option value="content_courses">Courses</option>
                <option value="content_tests">Tests</option>
                <option value="content_sim">Sim</option>
              </select>
              <input id="ap-title" class="input" placeholder="Title/Name" />
              <input id="ap-tag" class="input" placeholder="Tag (NEW/ASOSIY/...)" />
              <input id="ap-meta" class="input" placeholder="Meta (narx/dars...)" />
              <input id="ap-price" class="input" type="number" placeholder="Narx (so'm) — testlar uchun" />
              <input id="ap-productId" class="input" placeholder="Product ID (tests uchun)" />
            </div>
            <div class="row end mt-3">
              <button class="btn" id="ap-add">Qo'shish</button>
              <button class="btn quiet" id="ap-list">Ro'yxatni yangilash</button>
            </div>
            <div id="ap-listview" class="mt-3"></div>
          </div>\`;
        document.getElementById('ap-add').addEventListener('click', async ()=>{
          const coll = document.getElementById('ap-coll').value;
          const name = document.getElementById('ap-title').value.trim();
          const tag = document.getElementById('ap-tag').value.trim();
          const meta = document.getElementById('ap-meta').value.trim();
          const price = parseInt((document.getElementById('ap-price').value||'0'),10)||0;
          const productId = document.getElementById('ap-productId').value.trim();
          if (!name){ alert('Nom/Title kiriting'); return; }
          await addDoc(collection(db, coll), { name, title:name, tag, meta, price, productId, createdAt: serverTimestamp() });
          alert('Qo\'shildi');
        });
        document.getElementById('ap-list').addEventListener('click', async ()=>{
          const coll = document.getElementById('ap-coll').value;
          const snap = await getDocs(collection(db, coll));
          const out = [];
          snap.forEach(d=>{ const v=d.data(); out.push(`<div class="row gap-2"><div class="badge">${v.tag||''}</div><div>${v.name||v.title}</div><div class="muted">${v.meta||''}</div></div>`); });
          document.getElementById('ap-listview').innerHTML = `<div class="card p-4">`+out.join('')+`</div>`;
        });
      }
    });
  }
}

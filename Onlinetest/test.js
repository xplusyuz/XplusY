import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, writeBatch, serverTimestamp, increment, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const PRODUCT_ID = 'onlinetest1-access';

const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};
let app; try { app = getApp(); } catch { app = initializeApp(firebaseConfig); }
const auth = getAuth(app);
const db   = getFirestore(app);

// Demo rejim: URL oxiriga ?demo qo'shsangiz, pullik kirish chetlab o'tiladi
const DEV_DEMO = new URLSearchParams(location.search).has('demo');

const $ = s => document.querySelector(s);
let overlay = $('#overlay');
if (!overlay) {
  overlay = document.createElement('div');
  overlay.id = 'overlay';
  overlay.className = 'overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  document.body.appendChild(overlay);
}
const appRoot = document.getElementById('app');
const timerEl = $('#timer');
const qGrid   = $('#qGrid');
const qStem   = $('#qStem');
const qOpts   = $('#qOpts');
const qMedia  = $('#qMedia');
const prevBtn = $('#prevBtn');
const nextBtn = $('#nextBtn');
const submitBtn = $('#submitBtn');

const BANK = Array.from(document.querySelectorAll('#qBank .question')).map((node, idx) => {
  const stem   = node.querySelector('.stem')?.innerHTML || '';
  const opts   = Array.from(node.querySelectorAll('.opt')).map(l => l.innerHTML);
  const answer = Number(node.querySelector('.answer')?.value || 0);
  return { id: idx+1, stem, opts, answer };
});

let current=0;
let selected = new Array(BANK.length).fill(null);
let totalSeconds = BANK.length * 120;
let timerInt=null;
let startedTest=false;

function showOverlay(html){ overlay.innerHTML = html; overlay.hidden = false; overlay.style.display = 'flex'; overlay.classList.add('open'); }
function hideOverlay(){ overlay.classList.remove('open'); overlay.hidden = true; overlay.innerHTML = ''; overlay.style.display = 'none'; }
function lockApp(){ if(appRoot) appRoot.hidden = true; }
function unlockApp(){ if(appRoot) appRoot.hidden = false; }

// Progress bar
function updateProgressBar() {
  const answeredCount = selected.filter(ans => ans !== null).length;
  const progress = (answeredCount / BANK.length) * 100;
  
  let progressBar = document.querySelector('.progress-bar');
  if (!progressBar) {
    const head = document.querySelector('.panel-head');
    if (!head) return; // DOM hali tayyor emas
    progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = '<div class="progress-fill"></div>';
    head.after(progressBar);
  }
  const pf = document.querySelector('.progress-fill');
  if (pf) pf.style.width = `${progress}%`;
}

function renderIndex(){
  qGrid.innerHTML='';
  BANK.forEach((q,i)=>{
    const b=document.createElement('button');
    b.className='q-btn'+(i===current?' active':'')+(selected[i]!=null?' answered':'');
    b.textContent=q.id;
    b.addEventListener('click',()=>go(i));
    qGrid.appendChild(b);
  });
  
  updateProgressBar();
}

async function typeset(){ if(window.MathJax?.typesetPromise){ try{ await MathJax.typesetPromise([qStem,qOpts]); }catch(e){} } }

function loadImage(url){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = ()=> resolve(img);
    img.onerror = reject;
    img.src = url;
    img.alt = 'Savol rasmi';
  });
}

async function attachQuestionImage(qid){
  qMedia.innerHTML = '<div class="loading" style="height: 180px; border-radius: 8px;"></div>';
  qMedia.style.display = 'block';
  
  try{
    const jpg = await loadImage(`img/${qid}.jpg`);
    qMedia.innerHTML = '';
    qMedia.appendChild(jpg);
    qMedia.setAttribute('aria-hidden','false');
    return;
  }catch{}
  
  try{
    const png = await loadImage(`img/${qid}.png`);
    qMedia.innerHTML = '';
    qMedia.appendChild(png);
    qMedia.setAttribute('aria-hidden','false');
    return;
  }catch{
    qMedia.innerHTML=''; 
    qMedia.style.display='none'; 
    qMedia.setAttribute('aria-hidden','true');
  }
}

async function renderQuestion(){
  const q=BANK[current];
  attachQuestionImage(q.id);
  qStem.innerHTML=`<div class="muted">Savol ${current+1}/${BANK.length}</div><div style="margin-top:6px">${q.stem}</div>`;

  qOpts.innerHTML='';
  q.opts.forEach((inner,idx)=>{
    const wrap=document.createElement('label');
    wrap.className='opt';
    wrap.innerHTML=`<input type="radio" name="q_${current}" ${selected[current]===idx?'checked':''}> <div>${inner.replace(/^<input[^>]*>/,'')}</div>`;
    wrap.querySelector('input').addEventListener('change',()=>{ selected[current]=idx; renderIndex(); });
    qOpts.appendChild(wrap);
  });

  await typeset();
  prevBtn.disabled=current===0;
  nextBtn.disabled=current===BANK.length-1;
}

const go=i=>{ current=i; renderIndex(); renderQuestion(); };
const next=()=>{ if(current<BANK.length-1) go(current+1); };
const prev=()=>{ if(current>0) go(current-1); };

function startTimer(){ updateTimer(); timerInt=setInterval(()=>{ totalSeconds--; updateTimer(); if(totalSeconds<=0){ clearInterval(timerInt); submit(); } },1000); }

function updateTimer(){
  const m=String(Math.floor(totalSeconds/60)).padStart(2,'0'); 
  const s=String(totalSeconds%60).padStart(2,'0'); 
  timerEl.textContent=`${m}:${s}`;
  
  if (totalSeconds <= 300) {
    timerEl.parentElement.style.background = 'rgba(239, 68, 68, 0.2)';
    timerEl.parentElement.style.borderColor = '#ef4444';
    timerEl.style.color = '#ef4444';
    
    if (totalSeconds % 30 === 0) {
      timerEl.parentElement.classList.add('pulse');
      setTimeout(() => {
        timerEl.parentElement.classList.remove('pulse');
      }, 1000);
    }
  }
}

function calcScore(){
  let correct=0, incorrect=0, unanswered=0;
  const detail = BANK.map((q,i)=>{
    const sel = selected[i];
    const ok = sel===q.answer;
    if(sel==null) unanswered++; else if(ok) correct++; else incorrect++;
    return { id:q.id, sel, answer:q.answer, ok };
  });
  const total=BANK.length;
  const percent = total ? Math.round((correct/total)*100) : 0;
  const points = (correct*3) + (incorrect*(-0.75));
  return {correct, incorrect, unanswered, total, percent, points, detail};
}

function letter(i){ return String.fromCharCode(65+i); }
function renderResult({correct,incorrect,unanswered,total,percent,points,detail}){
  const list = detail.map(d=>{
    const badge = d.ok? 'ok' : (d.sel==null? '' : 'no');
    const chosen = d.sel==null? '<span class="small">(tanlanmagan)</span>' : letter(d.sel);
    return `<div class="result-item">
      <span class="badge ${badge}">${d.id}</span>
      <div>
        <div><strong>Javob:</strong> ${letter(d.answer)} | <strong>Siz:</strong> ${chosen}</div>
        ${d.ok? '<span class="small">✅ To\\'g\\'ri</span>' : (d.sel==null? '<span class="small">—</span>' : '<span class="small">❌ Noto\\'g\\'ri</span>')}
      </div>
    </div>`;
  }).join('');

  return `<div class='card'>
    <h2>Natijalar va tahlil</h2>
    <div class='stats'>
      <div class='kpi'><div class='k'>To'g'ri</div><div class='v'>${correct}/${total}</div></div>
      <div class='kpi'><div class='k'>Noto'g'ri</div><div class='v'>${incorrect}</div></div>
      <div class='kpi'><div class='k'>Javobsiz</div><div class='v'>${unanswered}</div></div>
      <div class='kpi'><div class='k'>Foiz</div><div class='v'>${percent}%</div></div>
      <div class='kpi'><div class='k'>Ball (+3/−0.75)</div><div class='v'>${points.toFixed(2)}</div></div>
    </div>
    <div class='result-list'>${list}</div>
    <div class='row'>
      <button class='btn' onclick="location.href='index.html'">Bosh sahifa</button>
      <button class='btn primary' onclick='window.print()'>PDF/Print</button>
    </div>
  </div>`;
}

async function savePoints(pts){
  try{
    const user = auth.currentUser; if(!user) return false;
    const userRef = doc(db,'users',user.uid);
    const attRef  = doc(db,'attempts', `${user.uid}_${PRODUCT_ID}_${Date.now()}`);
    const add = Number(pts)||0;

    await runTransaction(db, async (tx)=>{
      const s = await tx.get(userRef);
      if(!s.exists()){
        tx.set(userRef, { points: 0, created_at: serverTimestamp() }, { merge:true });
      }
      tx.set(userRef, { points: increment(add) }, { merge:true });
      tx.set(attRef, {
        uid: user.uid,
        productId: PRODUCT_ID,
        points: add,
        ts: serverTimestamp()
      }, { merge:true });
    });

    try{
      const mod = await import('../auth.js');
      if (mod.updateHeaderFor) mod.updateHeaderFor(user.uid);
    }catch(_){ }

    return true;
  }catch(e){
    console.warn('Ball saqlanmadi:', e?.message||e);
    return false;
  }
}

/* ---------------------------
   TELEGRAM INTEGRATSIYASI
----------------------------*/
// Diqqat: ishlab chiqarishda tokenni server tomonda saqlash tavsiya etiladi.
const TELEGRAM_BOT_TOKEN = '7983510816:AAEmMhyAMrxcYC7GudLqEnccQ5Y7i7SJlEU';
const TELEGRAM_CHAT_ID   = '2049065724';

function formatMMSS(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec||0));
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

async function sendResultToTelegram({ name, uid, correct, total, productId, elapsedSec, points }) {
  try {
    const text =
`✅ Online Test natijasi
👤 Ism: ${name}
🆔 ID: ${uid}
📦 Product ID: ${productId}
📊 To'g'ri: ${correct}/${total}
⭐ Ball: ${Number(points||0).toFixed(2)}
⏱ Sarflangan vaqt: ${formatMMSS(elapsedSec)}`;

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body = {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true
    };
    await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    console.warn('Telegramga yuborilmadi:', e?.message || e);
  }
}

/* ---------------------------
   YAKUNLASH / SUBMIT QISMI
----------------------------*/
async function submit(){
  prevBtn.disabled=nextBtn.disabled=submitBtn.disabled=true;
  clearInterval(timerInt);
  const res = calcScore(); // {correct, incorrect, unanswered, total, percent, points}
  await savePoints(res.points);

  // Telegramga yuborish
  try {
    const user = auth.currentUser;
    const name = (user?.displayName) || (user?.email) || 'Noma’lum';
    const uid  = (user?.uid) || 'guest';
    const initialTotal = BANK.length * 120;
    const elapsedSec   = initialTotal - totalSeconds;

    await sendResultToTelegram({
      name,
      uid,
      correct: res.correct,
      total: res.total,
      productId: PRODUCT_ID,
      elapsedSec,
      points: res.points
    });
  } catch (e) {
    console.warn('Natijani Telegramga yuborishda xatolik:', e?.message || e);
  }

  showOverlay(renderResult(res));
}

/* ---------------------------
   Kirish / To‘lov / Start
----------------------------*/
const fmtUZS = n => new Intl.NumberFormat('uz-UZ').format(Number(n||0)) + " so'm";
const payCardHTML = (price, loggedIn)=>`<div class="card">
  <h2>Testga kirish</h2>
  <div class="row">Narx: <strong>${fmtUZS(price||20000)}</strong></div>
  <div class="row muted">To'lov balansdan yechiladi. Xariddan so'ng 3–2–1 va test boshlanadi.</div>
  <div class="row">
    ${loggedIn?`<button id='buyBtn' class='btn primary'>Sotib olish</button>`:`<a class='btn' href='/kirish.html'>Kirish</a>`}
    <a class='btn' href='/balance.html'>Balans</a>
  </div>
</div>`;
const countdownHTML = n=>`<div class='card'><div class='big'>${n}</div><div class='muted'>Boshlanishiga...</div></div>`;

async function fetchPrice(){
  try{ const snap=await getDoc(doc(db,'products',PRODUCT_ID)); return Number(snap.data()?.price||20000); }
  catch{ return 20000; }
}
async function hasAccess(uid){
  try{ const snap=await getDoc(doc(db,'purchases',`${uid}_${PRODUCT_ID}`)); return snap.exists(); }
  catch{ return false; }
}

async function buyAccess(){
  try{
    const user=auth.currentUser; if(!user){ location.href='/kirish.html'; return; }
    const userRef=doc(db,'users',user.uid);
    const uSnap=await getDoc(userRef); if(!uSnap.exists()){ alert('Profil topilmadi'); return; }
    const currentBalance=Number(uSnap.data().balance||0);
    const price=await fetchPrice();
    if(currentBalance<price){ alert('Balans yetarli emas'); return; }

    const batch=writeBatch(db);
    batch.update(userRef,{ balance: currentBalance-price, lastPurchase:{productId:PRODUCT_ID} });
    const purRef=doc(db,'purchases',`${user.uid}_${PRODUCT_ID}`);
    batch.set(purRef,{ uid:user.uid, productId:PRODUCT_ID, price, ts:serverTimestamp() },{merge:true});
    await batch.commit();

    await startSequence();
  }catch(e){ alert(e.message||'Xatolik'); }
}

async function startSequence(){
  startedTest = true;
  showOverlay(countdownHTML(3)); await new Promise(r=>setTimeout(r,1000));
  showOverlay(countdownHTML(2)); await new Promise(r=>setTimeout(r,1000));
  showOverlay(countdownHTML(1)); await new Promise(r=>setTimeout(r,1000));
  hideOverlay();
  unlockApp();
  go(0); startTimer();
}

async function tryEnter(user){
  // Demo rejimi: ?demo bo'lsa, darhol testni boshlaymiz
  if (DEV_DEMO) { await startSequence(); return; }
  if(startedTest) return;
  const price = await fetchPrice();
  if(!user){ lockApp(); showOverlay(payCardHTML(price,false)); return; }
  if(await hasAccess(user.uid)){ await startSequence(); }
  else{ lockApp(); showOverlay(payCardHTML(price,true)); document.getElementById('buyBtn')?.addEventListener('click', buyAccess); }
}

// Event listenerlar
prevBtn.addEventListener('click',prev);
nextBtn.addEventListener('click',next);
submitBtn.addEventListener('click',()=>{ if(confirm('Yakunlaymizmi?')) submit(); });

// Dasturni ishga tushirish
function boot(){
  lockApp();
  showOverlay(`<div class='card'><h2>Tekshirilmoqda…</h2><div class='muted'>Hisob holati yuklanmoqda</div></div>`);
  onAuthStateChanged(auth, (user)=>{ tryEnter(user); });
  setTimeout(()=>{ if(!startedTest){ tryEnter(auth.currentUser||null); } }, 2500);
}

// Start
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}


// === Generic Modal: accessible + focus trap ===
(function(){
  let lastActive = null;
  let keydownHandler = null;
  let overlayClickHandler = null;
  let closeBtnHandler = null;

  function ensureOverlay() {
    let overlay = document.getElementById('overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'overlay';
      overlay.className = 'overlay';
      document.body.appendChild(overlay);
    }
    if (!overlay.querySelector('.modal')) {
      overlay.innerHTML = [
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">',
        '  <div class="modal-header">',
        '    <h3 id="modal-title"></h3>',
        '    <button class="modal-close" aria-label="Yopish" type="button">&times;</button>',
        '  </div>',
        '  <div class="modal-body"></div>',
        '  <div class="modal-footer"></div>',
        '</div>'
      ].join('');
    }
    return overlay;
  }

  function getFocusable(container) {
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
  }

  function trapFocus(e, container) {
    if (e.key !== 'Tab') return;
    const f = getFocusable(container);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  function openModal({ title = '', body = '', footer = '' } = {}) {
    const overlay = ensureOverlay();
    const modal   = overlay.querySelector('.modal');
    overlay.classList.remove('closing');
    overlay.classList.add('open');
    document.body.classList.add('modal-open');

    modal.querySelector('#modal-title').textContent = title;
    const bodyEl = modal.querySelector('.modal-body');
    const footerEl = modal.querySelector('.modal-footer');
    bodyEl.innerHTML = body;
    footerEl.innerHTML = footer;

    lastActive = document.activeElement;

    // Events
    keydownHandler = (e) => {
      if (e.key === 'Escape') { closeModal(); }
      trapFocus(e, modal);
    };
    overlayClickHandler = (e) => { if (e.target === overlay) closeModal(); };
    closeBtnHandler = () => closeModal();

    document.addEventListener('keydown', keydownHandler);
    overlay.addEventListener('click', overlayClickHandler);
    modal.querySelector('.modal-close').addEventListener('click', closeBtnHandler);

    // Focus first focusable, or the close button
    (getFocusable(modal)[0] || modal.querySelector('.modal-close')).focus();
  }

  function closeModal() {
    const overlay = document.getElementById('overlay');
    if (!overlay) return;
    overlay.classList.add('closing');
    overlay.classList.remove('open');
    document.body.classList.remove('modal-open');

    // Cleanup events
    document.removeEventListener('keydown', keydownHandler);
    overlay.removeEventListener('click', overlayClickHandler);
    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) closeBtn.removeEventListener('click', closeBtnHandler);

    // Return focus
    if (lastActive && typeof lastActive.focus === 'function') {
      setTimeout(() => lastActive.focus(), 0);
    }
    // Remove closing state after animation
    setTimeout(() => overlay.classList.remove('closing'), 180);
  }

  // Expose helpers
  window.modal = { open: openModal, close: closeModal };
})();

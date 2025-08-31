// ------------------------------
// test.js  (meta/counters.lastUserId + no attempts writes)
// ------------------------------
import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, writeBatch, serverTimestamp, increment, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Mahsulot identifikatori (Firestore: products/${PRODUCT_ID})
const PRODUCT_ID = 'onlinetest1-access';

// Firebase config
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

// ------------------------------
// DOM qisqartmalar
// ------------------------------
const $ = s => document.querySelector(s);
const overlay = $('#overlay');
const appRoot = document.getElementById('app');
const timerEl = $('#timer');
const qGrid   = $('#qGrid');
const qStem   = $('#qStem');
const qOpts   = $('#qOpts');
const qMedia  = $('#qMedia');
const prevBtn = $('#prevBtn');
const nextBtn = $('#nextBtn');
const submitBtn = $('#submitBtn');

// ------------------------------
// Savollar bankini HTML dan olish
// ------------------------------
const BANK = Array.from(document.querySelectorAll('#qBank .question')).map((node, idx) => {
  const stem   = node.querySelector('.stem')?.innerHTML || '';
  const opts   = Array.from(node.querySelectorAll('.opt')).map(l => l.innerHTML);
  const answer = Number(node.querySelector('.answer')?.value || 0);
  return { id: idx+1, stem, opts, answer };
});

let current=0;
let selected = new Array(BANK.length).fill(null);
let totalSeconds = BANK.length * 120; // har savolga 2 daqiqa
let timerInt=null;
let startedTest=false;

// ------------------------------
// UI util
// ------------------------------
function showOverlay(html){ overlay.innerHTML = html; overlay.hidden = false; overlay.style.display = 'flex'; }
function hideOverlay(){ overlay.hidden = true; overlay.innerHTML = ''; overlay.style.display = 'none'; }
function lockApp(){ if(appRoot) appRoot.hidden = true; }
function unlockApp(){ if(appRoot) appRoot.hidden = false; }

// Progress bar
function updateProgressBar() {
  const answeredCount = selected.filter(ans => ans !== null).length;
  const progress = (answeredCount / BANK.length) * 100;
  let progressBar = document.querySelector('.progress-bar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = '<div class="progress-fill"></div>';
    document.querySelector('.panel-head').after(progressBar);
  }
  document.querySelector('.progress-fill').style.width = `${progress}%`;
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
  try{ const jpg = await loadImage(`img/${qid}.jpg`); qMedia.innerHTML = ''; qMedia.appendChild(jpg); qMedia.setAttribute('aria-hidden','false'); return; }catch{}
  try{ const png = await loadImage(`img/${qid}.png`); qMedia.innerHTML = ''; qMedia.appendChild(png); qMedia.setAttribute('aria-hidden','false'); return; }catch{
    qMedia.innerHTML=''; qMedia.style.display='none'; qMedia.setAttribute('aria-hidden','true');
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

// ------------------------------
// Timer
// ------------------------------
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
      setTimeout(() => { timerEl.parentElement.classList.remove('pulse'); }, 1000);
    }
  }
}

// ------------------------------
// Hisob-kitob va natija
// ------------------------------
function calcScore(){
  let correct=0, incorrect=0, unanswered=0;
  const detail = BANK.map((q,i)=>{
    const sel = selected[i];
    const ok = sel===q.answer;
    if(sel==null) unanswered++;
    else if(ok) correct++; else incorrect++;
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
        ${d.ok? '<span class="small">✅ To\'g\'ri</span>' : (d.sel==null? '<span class="small">—</span>' : '<span class="small">❌ Noto\'g\'ri</span>')}
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

// ------------------------------
// Ball saqlash (faqat users/{uid}, attempts yozilmaydi)
// ------------------------------
async function savePoints(pts){
  try{
    const user = auth.currentUser; 
    if(!user) return false;

    const userRef = doc(db,'users',user.uid);
    const add = Number(pts)||0;

    await runTransaction(db, async (tx)=>{
      const s = await tx.get(userRef);
      if(!s.exists()){
        tx.set(userRef, { points: 0, created_at: serverTimestamp() }, { merge:true });
      }
      tx.set(userRef, {
        points: increment(add),
        lastAttempt: {
          productId: PRODUCT_ID,
          delta: add,
          updated_at: serverTimestamp()
        }
      }, { merge:true });
    });

    try{
      const mod = await import('../auth.js');
      if (mod.updateHeaderFor) mod.updateHeaderFor(user.uid);
    }catch(_){}

    return true;
  }catch(e){
    console.warn('Ball saqlanmadi:', e?.message || e);
    return false;
  }
}

// ------------------------------
// Telegram INTEGRATSIYA
// ------------------------------
const TELEGRAM_BOT_TOKEN = '7983510816:AAEmMhyAMrxcYC7GudLqEnccQ5Y7i7SJlEU';
const TELEGRAM_CHAT_ID   = '2049065724';

function formatMMSS(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec||0));
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// ---- GLOBAL lastUserId (meta/counters) ni olish ----
async function getGlobalLastUserId(){
  try{
    const snap = await getDoc(doc(db, 'meta', 'counters'));
    if (!snap.exists()) return null;
    const v = snap.data()?.lastUserId;
    return (v === undefined || v === null) ? null : String(v);
  }catch(e){
    console.warn('meta/counters lastUserId o‘qilmadi:', e?.message || e);
    return null;
  }
}

// Tanlov tartibi: meta/counters → local/session storage → users/{uid}.lastUserId → uid/guest
async function resolveDisplayId(user){
  const fromMeta = await getGlobalLastUserId();
  if (fromMeta) return fromMeta;

  try{
    const fromStorage = localStorage.getItem('lastUserId') || sessionStorage.getItem('lastUserId');
    if (fromStorage) return fromStorage;
  }catch{}

  try{
    if (user){
      const snap = await getDoc(doc(db,'users', user.uid));
      const fromUser = snap.exists() ? (snap.data()?.lastUserId || null) : null;
      if (fromUser) return String(fromUser);
    }
  }catch{}

  return (user?.uid) || 'guest';
}

async function sendResultToTelegram({ name, id, correct, total, productId, elapsedSec, points }) {
  const text =
`✅ Online Test natijasi
👤 Ism: ${name}
🆔 ID: ${id}
📦 Product ID: ${productId}
📊 To'g'ri: ${correct}/${total}
⭐ Ball: ${Number(points||0).toFixed(2)}
⏱ Sarflangan vaqt: ${formatMMSS(elapsedSec)}`;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = { chat_id: TELEGRAM_CHAT_ID, text, disable_web_page_preview: true };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(()=> '');
    throw new Error(`Telegram HTTP ${resp.status}: ${txt}`);
  }
}

// ------------------------------
// Yakunlash / submit
// (Telegramni har holda jo'natamiz, so'ng ballni saqlaymiz)
// ------------------------------
async function submit(){
  prevBtn.disabled=nextBtn.disabled=submitBtn.disabled=true;
  clearInterval(timerInt);

  const res = calcScore();

  // 1) Telegram
  try {
    const user = auth.currentUser;
    const name = (user?.displayName) || (user?.email) || 'Noma’lum';
    const id   = await resolveDisplayId(user);
    const initialTotal = BANK.length * 120;
    const elapsedSec   = initialTotal - totalSeconds;

    await sendResultToTelegram({
      name,
      id, // lastUserId yoki uid/guest
      correct: res.correct,
      total: res.total,
      productId: PRODUCT_ID,
      elapsedSec,
      points: res.points
    });
  } catch (e) {
    console.warn('Telegramga yuborishda xatolik:', e?.message || e);
  }

  // 2) Ballni saqlash — attempts yo‘q
  try {
    await savePoints(res.points);
  } catch (e) {
    console.warn('Ball saqlashda xatolik:', e?.message || e);
  }

  // 3) Natija oynasi
  showOverlay(renderResult(res));
}

// ------------------------------
// Kirish / To‘lov / Start
// ------------------------------
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
  if(startedTest) return;
  const price = await fetchPrice();
  if(!user){ lockApp(); showOverlay(payCardHTML(price,false)); return; }
  if(await hasAccess(user.uid)){ await startSequence(); }
  else{
    lockApp(); showOverlay(payCardHTML(price,true));
    document.getElementById('buyBtn')?.addEventListener('click', buyAccess);
  }
}

// Eventlar
prevBtn.addEventListener('click',prev);
nextBtn.addEventListener('click',next);
submitBtn.addEventListener('click',()=>{ if(confirm('Yakunlaymizmi?')) submit(); });

// Boot
function boot(){
  lockApp();
  showOverlay(`<div class='card'><h2>Tekshirilmoqda…</h2><div class='muted'>Hisob holati yuklanmoqda</div></div>`);
  onAuthStateChanged(auth, (user)=>{ tryEnter(user); });
  setTimeout(()=>{ if(!startedTest){ tryEnter(auth.currentUser||null); } }, 2500);
}
boot();

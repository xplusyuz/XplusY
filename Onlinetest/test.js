import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, writeBatch, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

const $ = s => document.querySelector(s);
const overlay = $('#overlay');
const appRoot = document.getElementById('app');
const timerEl = $('#timer');
const qGrid   = $('#qGrid');
const qStem   = $('#qStem');
const qOpts   = $('#qOpts');
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

function showOverlay(html){ overlay.innerHTML = html; overlay.hidden = false; overlay.style.display = 'flex'; }
function hideOverlay(){ overlay.hidden = true; overlay.innerHTML = ''; overlay.style.display = 'none'; }
function lockApp(){ if(appRoot) appRoot.hidden = true; }
function unlockApp(){ if(appRoot) appRoot.hidden = false; }

function renderIndex(){
  qGrid.innerHTML='';
  BANK.forEach((q,i)=>{
    const b=document.createElement('button');
    b.className='q-btn'+(i===current?' active':'')+(selected[i]!=null?' answered':'');
    b.textContent=q.id; b.addEventListener('click',()=>go(i));
    qGrid.appendChild(b);
  });
}
async function typeset(){ if(window.MathJax?.typesetPromise){ try{ await MathJax.typesetPromise([qStem,qOpts]); }catch(e){} } }
async function renderQuestion(){
  const q=BANK[current];
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
  prevBtn.disabled=current===0; nextBtn.disabled=current===BANK.length-1;
}
const go=i=>{ current=i; renderIndex(); renderQuestion(); };
const next=()=>{ if(current<BANK.length-1) go(current+1); };
const prev=()=>{ if(current>0) go(current-1); };

function startTimer(){ updateTimer(); timerInt=setInterval(()=>{ totalSeconds--; updateTimer(); if(totalSeconds<=0){ clearInterval(timerInt); submit(); } },1000); }
function updateTimer(){ const m=String(Math.floor(totalSeconds/60)).padStart(2,'0'); const s=String(totalSeconds%60).padStart(2,'0'); timerEl.textContent=`${m}:${s}`; }

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

async function submit(){
  prevBtn.disabled=nextBtn.disabled=submitBtn.disabled=true;
  clearInterval(timerInt);
  const res = calcScore();
  await savePoints(res.points);
  showOverlay(renderResult(res));
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

// Firestorega ball qo‘shish
import { doc, runTransaction, serverTimestamp, increment } 
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

async function savePoints(pts){
  try{
    const user = auth.currentUser;
    if(!user) return false;

    const userRef = doc(db,'users',user.uid);
    const attRefId = `${user.uid}_${PRODUCT_ID}_${Date.now()}`;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if(!snap.exists()){
        // user hujjati bo‘lmasa — yaratib qo‘yamiz (0 dan)
        tx.set(userRef, { points: 0, balance: 0, created_at: serverTimestamp() }, { merge:true });
      }
      // +3/-0.75 yig‘indisini qo‘shamiz
      tx.update(userRef, { points: increment(Number(pts) || 0) });

      // urinish logi
      const attRef = doc(db,'attempts', attRefId);
      tx.set(attRef, {
        uid: user.uid,
        productId: PRODUCT_ID,
        points: Number(pts) || 0,
        ts: serverTimestamp()
      }, { merge:true });
    });

    // Ixtiyoriy: header metrikani yangilash (agar auth.js ulagan bo‘lsangiz)
    try{
      const mod = await import('../auth.js');   // yo‘lni moslang
      if (mod.updateHeaderFor) mod.updateHeaderFor(user.uid);
    }catch{}

    return true;
  }catch(e){
    console.warn('Ball saqlash xatosi:', e?.message||e);
    return false;
  }
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
  else{ lockApp(); showOverlay(payCardHTML(price,true)); document.getElementById('buyBtn')?.addEventListener('click', buyAccess); }
}

prevBtn.addEventListener('click',prev);
nextBtn.addEventListener('click',next);
submitBtn.addEventListener('click',()=>{ if(confirm('Yakunlaymizmi?')) submit(); });

(function boot(){
  lockApp();
  showOverlay(`<div class='card'><h2>Tekshirilmoqda…</h2><div class='muted'>Hisob holati yuklanmoqda</div></div>`);
  onAuthStateChanged(auth, (user)=>{ tryEnter(user); });
  setTimeout(()=>{ if(!startedTest){ tryEnter(auth.currentUser||null); } }, 2500);
})();
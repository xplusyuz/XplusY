// js/tests.js
// SPA integratsiya: #/tests rutida ishlaydi
// Firebase v10: mavjud app bo'lsa qayta init qilmaymiz
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, runTransaction, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// MathJax (agar globalda bo'lmasa yuklaymiz)
(function ensureMathJax(){
  if (!window.MathJax) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
    s.async = true;
    window.MathJax = { tex: {inlineMath: [['$','$'], ['\\(','\\)']]}, svg:{fontCache:'global'} };
    document.head.appendChild(s);
  }
})();

const fbConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};
if (!getApps().length) initializeApp(fbConfig);
const auth = getAuth();
const db   = getFirestore();

// ------- DOM refs (within partial) -------
let $ = (sel)=>document.querySelector(sel);
let el = {
  page: $("#tests-page"),
  badge: $("#testsUserBadge"),
  catalog: $("#testsCatalog"),
  run: $("#testsRun"),
  result: $("#testsResult"),
  dirNote: $("#testsDirNote"),
  cards: $("#testsCards"),
  title: $("#testsTitle"),
  qimg: $("#testsQimg"),
  qtext: $("#testsQtext"),
  choices: $("#testsChoices"),
  timer: $("#testsTimer"),
  progress: $("#testsProgress"),
  prev: $("#testsPrev"),
  next: $("#testsNext"),
  finish: $("#testsFinish"),
  backToCatalog: $("#testsBackToCatalog"),
  backBtn: $("#testsBackBtn"),
  confirmDlg: $("#testsConfirm"),
  confirmBody: $("#testsConfirmBody"),
  cancelPay: $("#testsCancelPay"),
  okPay: $("#testsOkPay"),
};

// ------- State -------
let currentUser=null, userDocRef=null, userData=null;
let manifest=[], catalogItems=[];
let test=null, answers=[], idx=0, deadline=0, ticker=null;

// ------- Utils -------
const fmtSom = v => new Intl.NumberFormat('uz-UZ').format(v) + " so'm";
const fmtMinSec = (sec)=> {
  const m = Math.floor(sec/60).toString().padStart(2,'0');
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  return `${m}:${s}`;
};

function parseCSV(text){
  const rows=[]; let row=[]; let cell=''; let inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQ){
      if(c=='"'){ if(text[i+1]=='"'){cell+='"'; i++;} else {inQ=false;} }
      else cell+=c;
    } else {
      if(c=='"') inQ=true;
      else if(c==','){ row.push(cell.trim()); cell=''; }
      else if(c=='\n' || c=='\r'){ if(cell!=='' || row.length){row.push(cell.trim()); rows.push(row); row=[]; cell='';} }
      else cell+=c;
    }
  }
  if(cell!=='' || row.length){row.push(cell.trim()); rows.push(row);}
  return rows.filter(r=>r.length && r.some(v=>v!==''));
}
function rowsToObjects(rows){
  const header = rows[0].map(h=>h.trim());
  return rows.slice(1).map(r=>{ const o={}; header.forEach((h,i)=>o[h]=r[i]??''); return o; });
}
function show(which){
  el.catalog.classList.add("hidden");
  el.run.classList.add("hidden");
  el.result.classList.add("hidden");
  if(which==="catalog") el.catalog.classList.remove("hidden");
  if(which==="run") el.run.classList.remove("hidden");
  if(which==="result") el.result.classList.remove("hidden");
  if(which==="run" && window.MathJax?.typesetPromise) window.MathJax.typesetPromise();
}
function progress(){ el.progress.style.width = ((idx)/(test.questions.length))*100 + "%"; }

// ------- Catalog -------
async function loadManifest(){
  const u = new URL(location.href);
  // default: csv/tests.csv (SPA konventsiyasi). Fallback: tests.csv
  const manifestPath = u.searchParams.get('manifest') || "csv/tests.csv";
  let res = await fetch(manifestPath);
  if(!res.ok){
    res = await fetch("tests.csv"); // fallback
    if(!res.ok) throw new Error("csv/tests.csv va tests.csv topilmadi");
  }
  const rows = parseCSV(await res.text());
  const objs = rowsToObjects(rows);
  manifest = objs.map(o=>({file:o.file?.trim()})).filter(o=>o.file);
}
async function hydrateCatalogFromEachCSV(){
  catalogItems = [];
  for(const m of manifest){
    try{
      const res = await fetch(m.file);
      if(!res.ok) continue;
      const rows = parseCSV(await res.text());
      if(!rows.length) continue;
      const [card_img, card_title, card_meta, price_som, time_min] = rows[0];
      catalogItems.push({file:m.file, card_img, card_title, card_meta, price_som, time_min});
    }catch(e){ console.warn("CSV o‘qishda xato", m.file, e); }
  }
  renderCatalog();
}
function renderCatalog(){
  el.cards.innerHTML="";
  catalogItems.forEach(item=>{
    const card=document.createElement('div'); card.className='eh-card';
    const img=document.createElement('img'); img.src=item.card_img||''; img.alt='banner';
    const body=document.createElement('div'); body.className='body';
    const title=document.createElement('div'); title.className='eh-title-small'; title.textContent=item.card_title||'Nomsiz test';
    const meta=document.createElement('div'); meta.className='eh-meta'; meta.textContent=item.card_meta||'';
    const row1=document.createElement('div'); row1.className='eh-row';
    const price=document.createElement('div'); price.className='eh-pill'; price.textContent=fmtSom(+item.price_som||0);
    const time=document.createElement('div'); time.className='eh-pill'; time.textContent=(+item.time_min||0)+' daq';
    const row2=document.createElement('div'); row2.className='eh-row';
    const open=document.createElement('a'); open.className='eh-btn'; open.textContent='Ko‘rish';
    open.href = `#/tests?src=${encodeURIComponent(item.file)}`;
    const start=document.createElement('button'); start.className='eh-btn primary'; start.textContent='Boshlash';
    start.onclick = ()=>startFlow(item);
    row1.append(price,time); row2.append(open,start);
    body.append(title,meta,row1,row2);
    card.append(img,body); el.cards.append(card);
  });
}

// ------- Test CSV -> structure -------
function parseTestCSV(text){
  const rows = parseCSV(text);
  if(rows.length<3) throw new Error('CSV format noto‘g‘ri: kamida 3 qator');
  const [card_img, card_title, card_meta, price_som, time_min] = rows[0];
  const header = rows[1].map(h=>h.trim().toLowerCase());
  const qrows = rows.slice(2);
  const get = (obj, key) => obj[header.indexOf(key)] ?? '';
  const questions = qrows.map(r=>{
    const q_img = get(r,'q_img') || get(r,'img') || '';
    const q_text= get(r,'q_text')|| get(r,'savol matni')|| get(r,'question')||'';
    const a = get(r,'a'), b=get(r,'b'), c=get(r,'c'), d=get(r,'d');
    const correct = (get(r,'correct')||'a').toLowerCase();
    const olmos = parseInt(get(r,'olmos')||'0',10)||0;
    const penalty = parseFloat(get(r,'penalty_olmos')||get(r,'-olmos')||'0')||0;
    return {q_img, q_text, choices:{a,b,c,d}, correct, olmos, penalty};
  });
  return {
    title: card_title||'Nomsiz test', price_som: +price_som||0, time_min: +time_min||0, card_img, card_meta, questions
  };
}

function renderQuestion(){
  const q = test.questions[idx];
  el.title.textContent = `${test.title} — ${idx+1}/${test.questions.length}`;
  el.qimg.classList.add('hidden');
  if(q.q_img){ el.qimg.src=q.q_img; el.qimg.classList.remove('hidden'); }
  el.qtext.innerHTML = q.q_text || '—';
  el.choices.innerHTML = '';
  ['a','b','c','d'].forEach(letter=>{
    const wrap=document.createElement('label'); wrap.className='eh-choice';
    const input=document.createElement('input'); input.type='radio'; input.name='ans'; input.value=letter;
    input.checked = answers[idx]===letter;
    input.onchange = ()=>{ answers[idx]=letter; };
    const span=document.createElement('div'); span.innerHTML = `<b>${letter.toUpperCase()}.</b> ` + (q.choices[letter]||'');
    wrap.append(input, span); el.choices.append(wrap);
  });
  el.prev.disabled = idx===0;
  el.next.disabled = idx===test.questions.length-1;
  progress();
  window.MathJax?.typesetPromise?.([el.qtext, el.choices]);
}

function startTimer(){
  clearInterval(ticker);
  const totalSec = test.time_min*60;
  deadline = Date.now() + totalSec*1000;
  ticker=setInterval(()=>{
    const left = Math.max(0, Math.floor((deadline-Date.now())/1000));
    el.timer.textContent = fmtMinSec(left);
    if(left<=0){ clearInterval(ticker); finish(); }
  }, 250);
}

async function startFlow(item){
  try{
    // 1) Load CSV
    const res = await fetch(item.file);
    if(!res.ok) throw new Error('Test CSV topilmadi');
    test = parseTestCSV(await res.text());

    // 2) Auth?
    if(!currentUser){
      alert('Kirish talab qilinadi. Iltimos, tizimga kiring.');
      return;
    }
    // 3) Confirm + Transaction
    const price = test.price_som || +item.price_som || 0;
    el.confirmBody.innerHTML = `
      <div><b>${test.title}</b></div>
      <div class="eh-meta">Narx: <b>${fmtSom(price)}</b></div>
      <div class="eh-note">Balansdan ushbu summa yechiladi va test boshlanadi.</div>
    `;
    el.confirmDlg.showModal();
    const onCancel = ()=> el.confirmDlg.close();
    const onOk = async ()=>{
      el.cancelPay.removeEventListener('click', onCancel);
      el.okPay.removeEventListener('click', onOk);
      el.confirmDlg.close();

      await runTransaction(db, async (tx)=>{
        const snap = await tx.get(userDocRef);
        if(!snap.exists()) throw new Error('User doc yo‘q');
        const data = snap.data();
        const balance = +data.balance||0;
        if(balance < price) throw new Error('Balans yetarli emas');
        tx.update(userDocRef, { balance: balance - price, lastPurchase: serverTimestamp() });
      });

      answers = Array(test.questions.length).fill(null);
      idx=0; show('run'); renderQuestion(); startTimer();
    };
    el.cancelPay.addEventListener('click', onCancel, {once:true});
    el.okPay.addEventListener('click', onOk, {once:true});
  }catch(e){
    alert('Boshlashda xato: '+ e.message);
  }
}

function finish(){
  let correct=0, wrong=0, empty=0, olmosGain=0, olmosLoss=0;
  const rows=[["#", "Savol", "Sizning javob", "To‘g‘ri", "Olmos"]];
  test.questions.forEach((q,i)=>{
    const ans = answers[i];
    if(!ans){empty++; rows.push([i+1, '—', '—', q.correct.toUpperCase(), 0]); return;}
    if(ans===q.correct){ correct++; olmosGain += q.olmos||0; rows.push([i+1,'—', ans.toUpperCase(), q.correct.toUpperCase(), "+"+(q.olmos||0)]); }
    else { wrong++; olmosLoss += q.penalty||0; rows.push([i+1,'—', ans.toUpperCase(), q.correct.toUpperCase(), q.penalty?("-"+q.penalty):0]); }
  });
  const net = (olmosGain-olmosLoss) | 0;
  $("#testsSummary").innerHTML = `
    <div><b>${test.title}</b></div>
    <div>To‘g‘ri: <b>${correct}</b> | Xato: <b>${wrong}</b> | Bo‘sh: <b>${empty}</b></div>
    <div>Yig‘ilgan olmos: <b>+${olmosGain}</b>${olmosLoss?`, jarima: <b>-${olmosLoss}</b>`:''}</div>
    <div class="${net>=0?'':'eh-note danger'}">Sof olmos: <b>${net>=0?'+':''}${net}</b></div>
  `;
  const table = rows.map((r,ri)=> ri? `<tr><td>${r.join("</td><td>")}</td></tr>` : `<tr><th>${r.join("</th><th>")}</th></tr>`).join("");
  $("#testsDetail").innerHTML = table;
  show("result");
  clearInterval(ticker);
  if(currentUser && net){ updateDoc(userDocRef, { gems: increment(net) }).catch(()=>{}); }
}

// ------- events -------
function bindEvents(){
  el.prev.onclick = ()=>{ if(idx>0){ idx--; renderQuestion(); } };
  el.next.onclick = ()=>{ if(idx<test.questions.length-1){ idx++; renderQuestion(); } };
  el.finish.onclick = ()=>{ if(confirm('Testni yakunlaysizmi?')) finish(); };
  el.backToCatalog.onclick = ()=>{ clearInterval(ticker); show("catalog"); };
  el.backBtn.onclick = ()=> show("catalog");
}

// ------- Auth -------
function watchAuth(){
  onAuthStateChanged(auth, async (u)=>{
    currentUser = u||null;
    if(u){
      userDocRef = doc(db, 'users', u.uid);
      const s = await getDoc(userDocRef);
      userData = s.exists()? s.data(): null;
      if(userData){
        el.badge.textContent = `ID: ${userData.numericId ?? u.uid.slice(0,8)} | Balans: ${fmtSom(+userData.balance||0)} | 💎 ${+userData.gems||0}`;
      }else{
        el.badge.textContent = `ID: ${u.uid.slice(0,8)}...`;
      }
    } else {
      el.badge.textContent = "Kirish talab qilinadi";
    }
  });
}

// ------- Init (public) -------
async function init(){
  // Deep-link: #/tests?src=/csv/tests/xxx.csv
  const url = new URL(location.href.replace('#/tests',''));
  const directSrc = url.searchParams.get('src');
  bindEvents();
  watchAuth();
  try{
    if(directSrc){
      await startFlow({file: directSrc});
    } else {
      await loadManifest();
      await hydrateCatalogFromEachCSV();
      show("catalog");
    }
  }catch(e){
    el.dirNote.classList.add('danger');
    el.dirNote.innerHTML = "Xato: "+e.message;
  }
}

// Expose
window.TestsPage = { init };
export default window.TestsPage;

// js/tests.js (v7 - icon pills, Inter font, 6/8-col index)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, runTransaction, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

let $=(s)=>document.querySelector(s);
let el;
let currentUser=null, userDocRef=null, userData=null;
let manifestRows=[], catalogItems=[], viewItems=[];
let test=null, answers=[], idx=0, ticker=null;

// Filters
const FACET_LABELS = ["Bo'lim","tip1","tip2"];
const FACET_ALIASES = { "Bo'lim": ["Bo'lim","Bo‘lim","bolim","Bolim","bo'lim"] };

const fmtSom = v => new Intl.NumberFormat('uz-UZ').format(v) + " so'm";
const fmtMinSec = (sec)=>{ const m=String(Math.floor(sec/60)).padStart(2,'0'); const s=String(Math.floor(sec%60)).padStart(2,'0'); return `${m}:${s}`; };

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
function normalizeKey(key){
  const k = key.trim();
  if (FACET_ALIASES["Bo'lim"].some(x=>x.toLowerCase()===k.toLowerCase())) return "Bo'lim";
  if (k.toLowerCase()==="tip1") return "tip1";
  if (k.toLowerCase()==="tip2") return "tip2";
  return k;
}

async function loadManifest(){
  const u = new URL(location.href);
  const manifestPath = u.searchParams.get('manifest') || "csv/tests.csv";
  let res = await fetch(manifestPath);
  if(!res.ok){ res = await fetch("tests.csv"); if(!res.ok) throw new Error("csv/tests.csv va tests.csv topilmadi"); }
  const rows = parseCSV(await res.text());
  const header = rows[0].map(h=>normalizeKey(h));
  manifestRows = rows.slice(1).map(r=>{ const o={}; header.forEach((h,i)=>o[h]=r[i]??''); return o; });
}
async function hydrateCatalogFromEachCSV(){
  catalogItems = [];
  for(const m of manifestRows){
    const file = (m.file||m.File||m.FILE||"").trim();
    if(!file) continue;
    try{
      const res = await fetch(file);
      if(!res.ok) continue;
      const rows = parseCSV(await res.text());
      if(!rows.length) continue;
      const [card_img, card_title, card_meta, price_som, time_min] = rows[0];
      catalogItems.push({
        file, card_img, card_title, card_meta, price_som, time_min,
        "Bo'lim": m["Bo'lim"]||"", tip1: m["tip1"]||"", tip2: m["tip2"]||""
      });
    }catch(e){ console.warn("CSV o‘qishda xato", file, e); }
  }
  // fill selects with unique values
  const uniq = (key)=> Array.from(new Set(catalogItems.map(x=>x[key]).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  fillSelect(el.fBolim, uniq("Bo'lim"));
  fillSelect(el.fTip1, uniq("tip1"));
  fillSelect(el.fTip2, uniq("tip2"));
  applyFilters();
}
function fillSelect(sel, values){
  sel.innerHTML = `<option value="all">Barchasi</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
}

let facetSel = { "Bo'lim":"all", tip1:"all", tip2:"all" };
function applyFilters(){
  viewItems = catalogItems.filter(it=>{
    const okB = facetSel["Bo'lim"]==='all' || it["Bo'lim"]===facetSel["Bo'lim"];
    const ok1 = facetSel["tip1"]==='all' || it["tip1"]===facetSel["tip1"];
    const ok2 = facetSel["tip2"]==='all' || it["tip2"]===facetSel["tip2"];
    return okB && ok1 && ok2;
  });
  renderCatalog(viewItems);
}

function renderCatalog(items){
  el.cards.innerHTML="";
  if(!items.length){
    el.cards.innerHTML = `<div class="eh-note">Hech narsa topilmadi. Filtrlarni o‘chiring yoki manifestga yangi test qo‘shing.</div>`;
    return;
  }
  items.forEach(item=>{
    const card=document.createElement('div'); card.className='eh-card fade-enter';
    const img=document.createElement('img'); img.src=item.card_img||''; img.alt='banner';
    const body=document.createElement('div'); body.className='body';
    const title=document.createElement('div'); title.className='eh-title-small'; title.textContent=item.card_title||'Nomsiz test';
    const meta=document.createElement('div'); meta.className='eh-meta'; meta.textContent=item.card_meta||'';
    const row1=document.createElement('div'); row1.className='eh-row';
    const price=document.createElement('div'); price.className='eh-pill pill'; price.innerHTML=`<span class="ico">💰</span>${fmtSom(+item.price_som||0)}`;
    const time=document.createElement('div'); time.className='eh-pill pill'; time.innerHTML=`<span class="ico">⏱️</span>${(+item.time_min||0)} daq`;
    const row2=document.createElement('div'); row2.className='eh-row';
    const open=document.createElement('a'); open.className='eh-btn ghost'; open.textContent='Ko‘rish';
    open.href = `#/tests?src=${encodeURIComponent(item.file)}`;
    const start=document.createElement('button'); start.className='eh-btn primary'; start.textContent='Boshlash';
    start.onclick = ()=>startFlow(item);
    row1.append(price,time); row2.append(open,start);
    body.append(title,meta,row1,row2);
    card.append(img,body); el.cards.append(card);
  });
}

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
  return { title: card_title||'Nomsiz test', price_som: +price_som||0, time_min: +time_min||0, card_img, card_meta, questions };
}

// FS
function buildIndexPanel(){
  const box = el.index;
  box.innerHTML = "";
  for(let i=0;i<test.questions.length;i++){
    const b=document.createElement('button'); b.className='dot'; b.textContent=(i+1);
    const selected = answers[i];
    b.classList.add(selected ? 'answered':'empty');
    if(i===idx) b.classList.add('current');
    b.title = selected ? `#${i+1}: belgilangan` : `#${i+1}: bo'sh`;
    b.onclick = ()=>{ idx=i; renderQuestion(); buildIndexPanel(); };
    box.append(b);
  }
}
function updateProgress(){
  const pct = (idx)/(test.questions.length) * 100;
  el.progress.style.width = pct + "%";
  el.count.textContent = `${idx+1}/${test.questions.length}`;
}

function renderQuestion(){
  const q = test.questions[idx];
  $("#testsHeaderTitle").textContent = test.title;
  const imgSrc = q.q_img || test.card_img || "";
  el.qimg.classList.add('hidden');
  if(imgSrc){ el.qimg.src=imgSrc; el.qimg.classList.remove('hidden'); }
  el.qtext.innerHTML = q.q_text || '—';
  el.choices.innerHTML='';
  ['a','b','c','d'].forEach((letter,k)=>{
    const wrap=document.createElement('label'); wrap.className='eh-choice fade-enter';
    const input=document.createElement('input'); input.type='radio'; input.name='ans'; input.value=letter;
    input.checked = answers[idx]===letter;
    input.onchange = ()=>{ answers[idx]=letter; buildIndexPanel(); };
    const span=document.createElement('div'); span.innerHTML = `<b>${letter.toUpperCase()}.</b> ` + (q.choices[letter]||'');
    wrap.append(input, span); el.choices.append(wrap);
  });
  el.prev.disabled = idx===0;
  el.next.disabled = idx===test.questions.length-1;
  updateProgress();
  window.MathJax?.typesetPromise?.([el.qtext, el.choices]);
}

function startTimer(){
  clearInterval(ticker);
  const end = Date.now() + (test.time_min*60*1000);
  ticker=setInterval(()=>{
    const left = Math.max(0, Math.floor((end-Date.now())/1000));
    el.timer.textContent = fmtMinSec(left);
    if(left<=0){ clearInterval(ticker); finish(); }
  }, 250);
}

function updateBadgesUI(){
  if(currentUser){ el.badge?.classList.add('hidden'); } else { el.badge?.classList.remove('hidden'); }
  if(userData){
    const detail = { balance: +userData.balance||0, gems: +userData.gems||0, numericId: userData.numericId };
    window.dispatchEvent(new CustomEvent('user-balance-updated', { detail }));
  }
}

async function startFlow(item){
  try{
    const res = await fetch(item.file);
    if(!res.ok) throw new Error('Test CSV topilmadi');
    test = parseTestCSV(await res.text());
    if(!currentUser){ alert('Kirish talab qilinadi. Iltimos, tizimga kiring.'); return; }
    const price = test.price_som || +item.price_som || 0;
    const bal = +userData?.balance || 0;
    const enough = bal >= price;
    const warn = enough ? "" : `<div class="eh-note" style="border-color:#6b1212">Balans yetarli emas. <a href="#/settings" class="eh-btn" style="margin-top:6px">Balansni to‘ldirish</a></div>`;

    el.confirmBody.innerHTML = `
      <div><b>${test.title}</b></div>
      <div class="eh-meta">Narx: <b>${fmtSom(price)}</b></div>
      ${warn}
    `;
    el.okPay.disabled = !enough;
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
      if(userData){ userData.balance = (+userData.balance||0) - price; updateBadgesUI(); }

      answers = Array(test.questions.length).fill(null);
      idx=0;
      el.fs.showModal();
      renderQuestion();
      buildIndexPanel();
      startTimer();
    };
    el.cancelPay.addEventListener('click', onCancel, {once:true});
    el.okPay.addEventListener('click', onOk, {once:true});
  }catch(e){ alert('Boshlashda xato: '+ e.message); }
}

function finish(){
  clearInterval(ticker);
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
  el.result.classList.remove('hidden');
  if(currentUser && net){
    updateDoc(userDocRef, { gems: increment(net) }).then(()=>{
      userData && (userData.gems = (+userData.gems||0) + net, updateBadgesUI());
    }).catch(()=>{});
  }
}

function closeFS(){
  clearInterval(ticker);
  el.fs.close();
  el.result.classList.add('hidden');
}

function kbdHandler(e){
  if(!el.fs.open) return;
  if(e.ctrlKey && e.key.toLowerCase()==='enter'){ e.preventDefault(); finish(); return; }
  if(e.key==='Enter'){ e.preventDefault(); if(idx<test.questions.length-1){ idx++; renderQuestion(); buildIndexPanel(); } return; }
  if(e.key==='ArrowLeft'){ e.preventDefault(); if(idx>0){ idx--; renderQuestion(); buildIndexPanel(); } return; }
  if(e.key==='ArrowRight'){ e.preventDefault(); if(idx<test.questions.length-1){ idx++; renderQuestion(); buildIndexPanel(); } return; }
  const map={'1':'a','2':'b','3':'c','4':'d','a':'a','b':'b','c':'c','d':'d','A':'a','B':'b','C':'c','D':'d'};
  if(map[e.key]){
    e.preventDefault();
    answers[idx] = map[e.key];
    renderQuestion(); buildIndexPanel();
  }
}

function bindEvents(){
  el.prev.onclick = ()=>{ if(idx>0){ idx--; renderQuestion(); buildIndexPanel(); } };
  el.next.onclick = ()=>{ if(idx<test.questions.length-1){ idx++; renderQuestion(); buildIndexPanel(); } };
  el.finish.onclick = ()=>{ if(confirm('Testni yakunlaysizmi?')) finish(); };
  el.backBtn.onclick = ()=>{ closeFS(); };
  el.fs.addEventListener('cancel', (e)=>{ e.preventDefault(); });
  el.fsClose.onclick = ()=>{ if(confirm('Chiqishni tasdiqlaysizmi?')) closeFS(); };

  el.fBolim.onchange = (e)=>{ facetSel["Bo'lim"]=e.target.value; applyFilters(); };
  el.fTip1.onchange = (e)=>{ facetSel["tip1"]=e.target.value; applyFilters(); };
  el.fTip2.onchange = (e)=>{ facetSel["tip2"]=e.target.value; applyFilters(); };

  window.addEventListener('keydown', kbdHandler);
}

function watchAuth(){
  onAuthStateChanged(auth, async (u)=>{
    currentUser = u||null;
    if(u){
      userDocRef = doc(db, 'users', u.uid);
      const s = await getDoc(userDocRef);
      userData = s.exists()? s.data(): null;
    } else {
      userDocRef = null;
      userData = null;
    }
    if(currentUser){ el.badge.classList.add('hidden'); } else { el.badge.classList.remove('hidden'); }
  });
}

async function init(){
  el = {
    page: $("#tests-page"),
    badge: $("#testsUserBadge"),
    catalog: $("#testsCatalog"),
    dirNote: $("#testsDirNote"),
    cards: $("#testsCards"),
    confirmDlg: $("#testsConfirm"),
    confirmBody: $("#testsConfirmBody"),
    cancelPay: $("#testsCancelPay"),
    okPay: $("#testsOkPay"),
    fs: $("#testsFS"),
    fsClose: $("#fsClose"),
    headerTitle: $("#testsHeaderTitle"),
    count: $("#testsCount"),
    progress: $("#testsProgress"),
    timer: $("#testsTimer"),
    index: $("#testsIndex"),
    qimg: $("#testsQimg"),
    qtext: $("#testsQtext"),
    choices: $("#testsChoices"),
    prev: $("#testsPrev"),
    next: $("#testsNext"),
    finish: $("#testsFinish"),
    result: $("#testsResult"),
    summary: $("#testsSummary"),
    detail: $("#testsDetail"),
    backBtn: $("#testsBackBtn"),
    fBolim: $("#facetBolim"),
    fTip1: $("#facetTip1"),
    fTip2: $("#facetTip2"),
  };
  bindEvents();
  watchAuth();
  try{
    await loadManifest();
    await hydrateCatalogFromEachCSV();
  }catch(e){
    el.dirNote.classList.add('danger');
    el.dirNote.innerHTML = "Xato: "+e.message;
  }
}

window.TestsPage = { init };
export default window.TestsPage;

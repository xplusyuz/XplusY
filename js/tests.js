// js/tests.js (v4 - CSV-driven facets)
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

let $ = (sel)=>document.querySelector(sel);
let el;
let currentUser=null, userDocRef=null, userData=null;
let manifestRows=[], catalogItems=[], viewItems=[];
let test=null, answers=[], idx=0, deadline=0, ticker=null;

// ===== Utils =====
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
function rowsToObjects(rows){ const header = rows[0].map(h=>h.trim()); return rows.slice(1).map(r=>{const o={}; header.forEach((h,i)=>o[h]=r[i]??''); return o;}); }
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

// ===== Manifest (CSV-driven facets) =====
let facetKeys=[];             // e.g., ['fan','daraja','mavzu']
let facetState={};            // selected values for each key

async function loadManifest(){
  const u = new URL(location.href);
  const manifestPath = u.searchParams.get('manifest') || "csv/tests.csv";
  let res = await fetch(manifestPath);
  if(!res.ok){
    res = await fetch("tests.csv"); // fallback
    if(!res.ok) throw new Error("csv/tests.csv va tests.csv topilmadi");
  }
  const rows = parseCSV(await res.text());
  const objs = rowsToObjects(rows); // each row is object with header keys
  // Determine facet keys as all columns except 'file'
  const header = rows[0].map(h=>h.trim());
  facetKeys = header.filter(k=>k.toLowerCase()!=='file');
  manifestRows = objs.map(o=>o);
  // init facet state as 'all'
  facetState = Object.fromEntries(facetKeys.map(k=>[k,'all']));
}
async function hydrateCatalogFromEachCSV(){
  catalogItems = [];
  for(const m of manifestRows){
    const file = m.file?.trim(); if(!file) continue;
    try{
      const res = await fetch(file);
      if(!res.ok) continue;
      const rows = parseCSV(await res.text());
      if(!rows.length) continue;
      const [card_img, card_title, card_meta, price_som, time_min] = rows[0];
      // store facets = all keys except file
      const facets = Object.fromEntries(Object.entries(m).filter(([k])=>k.toLowerCase()!=='file'));
      catalogItems.push({file, card_img, card_title, card_meta, price_som, time_min, facets});
    }catch(e){ console.warn("CSV o‘qishda xato", file, e); }
  }
  buildFacetUI(); // build selects from facetKeys + unique values
  applyFilters();
}

function buildFacetUI(){
  const box = el.facetBar;
  box.innerHTML = "";
  facetKeys.forEach(key=>{
    // collect unique values
    const values = Array.from(new Set(catalogItems.map(it=>String(it.facets[key]||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
    if(values.length===0) return;
    const w = document.createElement('label'); w.style.display='flex'; w.style.flexDirection='column'; w.style.gap='4px';
    const nice = key.replace(/[_-]+/g,' ').replace(/\b\w/g, s => s.toUpperCase());
    const sel = document.createElement('select'); sel.className='eh-input eh-select'; sel.dataset.key=key;
    sel.innerHTML = `<option value="all">${nice}: barchasi</option>` + values.map(v=>`<option value="${v}">${v}</option>`).join('');
    sel.onchange = (e)=>{ facetState[key] = e.target.value; applyFilters(); };
    w.append(sel);
    box.append(w);
  });
}

// ===== Filtering =====
function applyFilters(){
  const q = (el.search.value||'').toLowerCase();
  viewItems = catalogItems.filter(it=>{
    const okQ = !q || (it.card_title?.toLowerCase().includes(q) || it.card_meta?.toLowerCase().includes(q));
    // every facet must match if selected
    const okF = facetKeys.every(k=> facetState[k]==='all' || String(it.facets[k]||'') === facetState[k]);
    return okQ && okF;
  });
  renderCatalog(viewItems);
}

// ===== Catalog render =====
function renderCatalog(items){
  el.cards.innerHTML="";
  if(!items.length){
    el.cards.innerHTML = `<div class="eh-note">Hech narsa topilmadi. Filtrlarni o‘chiring yoki manifestga yangi test qo‘shing.</div>`;
    return;
  }
  items.forEach(item=>{
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

// ===== Test parse and flow =====
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

function renderQuestion(){
  const q = test.questions[idx];
  el.title.textContent = `${test.title} — ${idx+1}/${test.questions.length}`;
  el.qimg.classList.add('hidden');
  const imgSrc = q.q_img || test.card_img || "";
  if(imgSrc){ el.qimg.src=imgSrc; el.qimg.classList.remove('hidden'); }
  el.qtext.innerHTML = q.q_text || '—';
  el.choices.innerHTML='';
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

    if(!currentUser){
      alert('Kirish talab qilinadi. Iltimos, tizimga kiring.');
      return;
    }
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
      idx=0; show('run'); renderQuestion(); startTimer();
    };
    el.cancelPay.addEventListener('click', onCancel, {once:true});
    el.okPay.addEventListener('click', onOk, {once:true});
  }catch(e){ alert('Boshlashda xato: '+ e.message); }
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
  if(currentUser && net){ updateDoc(userDocRef, { gems: increment(net) }).then(()=>{
      userData && (userData.gems = (+userData.gems||0) + net, updateBadgesUI());
    }).catch(()=>{});
  }
}

// ===== Events & Auth =====
function bindEvents(){
  el.prev.onclick = ()=>{ if(idx>0){ idx--; renderQuestion(); } };
  el.next.onclick = ()=>{ if(idx<test.questions.length-1){ idx++; renderQuestion(); } };
  el.finish.onclick = ()=>{ if(confirm('Testni yakunlaysizmi?')) finish(); };
  el.backToCatalog.onclick = ()=>{ clearInterval(ticker); show("catalog"); };
  el.backBtn.onclick = ()=> show("catalog");

  el.search.oninput = (e)=> applyFilters();
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
    updateBadgesUI();
  });
}

// ===== Init =====
async function init(){
  el = {
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
    search: $("#testsSearch"),
    facetBar: $("#testsDynamicFilters"),
  };
  bindEvents();
  watchAuth();
  const url = new URL(location.href.replace('#/tests',''));
  const directSrc = url.searchParams.get('src');
  try{
    if(directSrc){ await startFlow({file: directSrc}); }
    else { await loadManifest(); await hydrateCatalogFromEachCSV(); show("catalog"); }
  }catch(e){
    el.dirNote.classList.add('danger');
    el.dirNote.innerHTML = "Xato: "+e.message;
  }
}

window.TestsPage = { init };
export default window.TestsPage;

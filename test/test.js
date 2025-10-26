/* ============================
   LeaderMath — Test (full)
   - 3 tur: single / multi / open (Mathlive)
   - Availability (always | clip | full)
   - Timer
   - First-solve only: users/{uid}.points += score
     (users/{uid}/solved/{testCode} mark bilan)
   ============================ */

/* ===== Imports ===== */
import { auth, db, onAuthStateChanged } from "/lib/firebase.client.js";
import { requireAuth } from "/lib/auth-guard.js";
import {
  doc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ===== Utils ===== */
const $ = s => document.querySelector(s);
const pad2 = n => String(Math.max(0,n)).padStart(2,'0');
const sum = a => (Array.isArray(a)?a:[]).reduce((x,y)=>x + (+y||0), 0);
const shuffle = a => { const b=a.slice(); for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]];} return b; };
const normalize = arr => Array.from(new Set((arr||[]).map(Number))).sort((a,b)=>a-b);
const arraysEqual = (a,b)=> a.length===b.length && a.every((v,i)=>v===b[i]);
const fmt = x => { const r=Math.round((+x + Number.EPSILON)*100)/100; return (Math.abs(r)%1===0)? String(Math.trunc(r)) : String(r); };
const slug = s => (s||"").toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

/* MathJax helpers */
const TEX_NEEDLES = ['\\frac','\\sqrt','\\sum','\\int','\\log','\\ln','\\sin','\\cos','\\tan','\\vec','\\pi','\\le','\\ge','\\ne','\\pm','\\cdot','\\times','\\left','\\right','^','_','\\alpha','\\beta','\\gamma'];
function looksLikeTeX(s){
  if(!s) return false;
  if(s.includes('$') || s.includes('\\(') || s.includes('\\[')) return false;
  return TEX_NEEDLES.some(k=>s.indexOf(k)!==-1);
}
const wrapTeX = s => looksLikeTeX(s) ? `\\(${s}\\)` : s;
const mjReady = ()=> new Promise(res=>{ const w=()=> (window.MathJax&&window.MathJax.typesetPromise)?res():setTimeout(w,30); w(); });
async function typeset(el){ await mjReady(); try{ await MathJax.typesetPromise([el]); }catch{} }

/* ===== State ===== */
let testData=null, answers=[], currentIndex=0, startedAt=null, spentSeconds=0;
let timerId=null, timeLeftSec=0, effectiveEnd=null;
const params = new URLSearchParams(location.search);
const rawIdFromUrl = params.get('id');
let currentTestId = rawIdFromUrl || (location.pathname.split('/').pop().replace(/\..*$/,'') || 'test');
let currentTestCode = params.get('code') || null;

/* Status chips */
function showTop(msg, kind='good'){ const c=$("#saveStatusTop"); if(!c) return; c.textContent=msg; c.classList.remove('hidden','good','bad','warn'); c.classList.add(kind); }
function showSave(msg, kind='good'){ const c=$("#saveStatus"); if(!c) return; c.textContent=msg; c.classList.remove('hidden','good','bad','warn'); c.classList.add(kind); }

/* ===== Availability / Duration ===== */
function parseISO(s){ try{ return s ? new Date(s) : null; }catch{ return null; } }
function minutesToSec(m){ const n=Number(m||0); return Math.max(0, Math.round(n*60)); }

function computeEffectiveTiming({availability, durationMinutes}){
  const now = new Date();
  const dur = minutesToSec(durationMinutes||0);

  if(!availability || availability.mode==='always'){
    return { canStart: true, openMsg: null, effectiveDurationSec: dur, hardEnd: null };
  }

  const start = parseISO(availability.startAt);
  const end   = parseISO(availability.endAt);
  const latePolicy = availability.latePolicy || 'clip'; // 'clip' | 'full'

  if(!start || !end || end <= start){
    return { canStart:true, openMsg:null, effectiveDurationSec:dur, hardEnd:null };
  }

  if(now < start){
    return { canStart:false, openMsg:`Test ${start.toLocaleString()}` + ' da ochiladi', effectiveDurationSec:0, hardEnd:end };
  }
  if(now >= end){
    return { canStart:false, openMsg:`Test yopilgan (${end.toLocaleString()}).`, effectiveDurationSec:0, hardEnd:end };
  }

  if(latePolicy==='full'){
    return { canStart:true, openMsg:null, effectiveDurationSec:dur, hardEnd:end };
  }else{
    const remain = Math.max(0, Math.floor((end - now)/1000));
    return { canStart:true, openMsg:null, effectiveDurationSec:Math.min(dur, remain), hardEnd:end };
  }
}

/* ===== Test loader ===== */
function applySectionRanges(data){
  if(!Array.isArray(data.questions)) return;
  if(Array.isArray(data.sections)){
    data.sections.forEach(sec=>{
      const name=sec.name||'Umumiy';
      const s=Math.max(1, Number(sec.start||1));
      const e=Math.min(data.questions.length, Number(sec.end||data.questions.length));
      for(let i=s-1;i<e;i++){ data.questions[i].section = data.questions[i].section || name; }
    });
  }
  data.questions.forEach(q=>{ if(!q.section) q.section='Umumiy'; });
}
function normalizeTestData(d){
  if(!d || !Array.isArray(d.questions)) return d;
  d.title=d.title||'Test';
  d.description=d.description||'Rasm + variantlar';
  d.id=d.id||slug(d.title);
  d.code=d.code||slug(d.title);
  d.questions=d.questions.map(q=>{
    const type = q.type || (Array.isArray(q.correctIndices)?'multi':'single');
    return { ...q, type, points: Number(q.points||1) };
  });
  applySectionRanges(d);
  return d;
}
async function loadTestData(){
  const ls = localStorage.getItem('testData');
  if(ls){ try{ testData = normalizeTestData(JSON.parse(ls)); return; }catch{} }
  try{
    const r = await fetch('./test.json',{cache:'no-store'});
    if(!r.ok) throw new Error('no test.json');
    testData = normalizeTestData(await r.json());
  }catch{
    testData = normalizeTestData({
      title:'Demo', description:'Fallback', durationMinutes: 10, availability:{mode:'always'},
      questions:[
        { type:'single', text:'$2+2$?', options:['3','4','5'], correctIndex:1, points:1, section:'Algebra' },
        { type:'multi',  text:'Tub(lar)?', options:['2','4','5','9'], correctIndices:[0,2], points:2, section:'Algebra' },
        { type:'open',   text:'$\\sqrt{a^2+b^2}$ ni yozing (LaTeX yoki tugmalardan)', answer:{accept:['\\sqrt{a^2+b^2}']}, points:2, section:'Algebra' }
      ]
    });
  }
  testData.questions.forEach(q=>{
    if(Array.isArray(q.options)){ q._perm = shuffle([...Array(q.options.length).keys()]); }
  });
}

/* ===== UI: dots, render ===== */
function buildNavDots(){
  const n=testData.questions.length, root=$("#navDots"); root.innerHTML='';
  for(let i=0;i<n;i++){
    const b=document.createElement('button'); b.className='dot'; b.dataset.idx=String(i); b.textContent=String(i+1);
    b.addEventListener('click', ()=>{ currentIndex=i; renderQuestion(); });
    root.appendChild(b);
  }
  refreshDots(); highlightDot(0);
}
function refreshDots(){ [...document.querySelectorAll('.dot')].forEach(el=>{ const i=+el.dataset.idx; const has=!!(answers[i] && answers[i].length); el.classList.toggle('answered', has); }); }
function highlightDot(i){ [...document.querySelectorAll('.dot')].forEach((el,idx)=> el.classList.toggle('active', idx===i)); }

async function resolveImageSrc(idx1){
  const q=testData.questions[idx1-1]||{};
  const candidates=[`./${idx1}.jpg`,`./${idx1}.png`, q.image||''].filter(Boolean);
  for(const src of candidates){
    const ok = await new Promise(res=>{ const im=new Image(); im.onload=()=>res(true); im.onerror=()=>res(false); im.src=src+(src.includes('?')?'':`?t=${Date.now()}`); });
    if(ok) return src;
  }
  return '';
}

/* ===== Open helpers ===== */
function normStr(s){ return (s||'').toString().replace(/\s+/g,'').replace(/\\ /g,'').toLowerCase(); }
function closeEnoughNumeric(a,b,tol){ return Math.abs(+a - +b) <= (+tol || 0); }

/* ===== Mathlive loader ===== */
let mathliveReady = false;
async function ensureMathlive(){
  if(mathliveReady) return;
  await import("https://unpkg.com/mathlive?module");
  mathliveReady = true;
}

/* ===== Render question ===== */
function renderOpenWithMathlive(q) {
  const wrap = document.createElement('div');

  const lab = document.createElement('div');
  lab.className = 'mini';
  lab.textContent = "Javobni kiriting (pastdagi tugmalardan foydalaning):";
  wrap.appendChild(lab);

  /** @type {any} */
  const mf = document.createElement('math-field');
  // yaxshi UX
  mf.setAttribute('virtual-keyboard-mode', 'onfocus');
  mf.setAttribute('virtual-keyboard-theme', 'apple');
  mf.setAttribute('smart-fence', 'true');
  mf.setAttribute('inline-shortcuts', 'true');
  mf.options = {
    virtualKeyboardMode: 'onfocus',
    virtualKeyboardLayout: 'advanced',
    smartFence: true,
    inlineShortcuts: {
      'sqrt': '\\sqrt{▦}', 'pi':'\\pi', 'sin':'\\sin', 'cos':'\\cos', 'tan':'\\tan',
      'log': '\\log', 'ln':'\\ln'
    }
  };

  // Oldingi javobni tiklash
  const prev = (answers[currentIndex]?.[0] ?? '').toString();
  if (prev) mf.setValue(prev, { format: 'latex' });

  mf.addEventListener('input', ()=>{
    answers[currentIndex] = [ mf.getValue('latex') ];
    refreshDots();
  });

  wrap.appendChild(mf);

  // Qo'shimcha kichik toolbar
  const bar = document.createElement('div');
  bar.className = 'mf-toolbar';
  bar.innerHTML = `
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px">
      <button type="button" class="btn ghost" data-cmd="insert" data-latex="\\frac{▦}{ }">a/b</button>
      <button type="button" class="btn ghost" data-cmd="insert" data-latex="\\sqrt{▦}">√</button>
      <button type="button" class="btn ghost" data-cmd="insert" data-latex="\\sqrt[▦]{ }">ⁿ√</button>
      <button type="button" class="btn ghost" data-cmd="insert" data-latex="\\log_{▦}{ }">logₐ( )</button>
      <button type="button" class="btn ghost" data-cmd="insert" data-latex="\\ln">ln</button>
      <button type="button" class="btn ghost" data-cmd="insert" data-latex="^{}">x^n</button>
      <button type="button" class="btn ghost" data-cmd="insert" data-latex="_{}">x_n</button>
      <button type="button" class="btn ghost" data-cmd="vk">Klaviatura</button>
      <button type="button" class="btn" data-cmd="clear">Tozalash</button>
    </div>`;
  bar.addEventListener('click',(e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const cmd = btn.dataset.cmd;
    if(cmd==='vk'){ mf.executeCommand('toggleVirtualKeyboard'); mf.focus(); }
    else if(cmd==='clear'){ mf.setValue('',{format:'latex'}); mf.focus(); mf.dispatchEvent(new Event('input')); }
    else if(cmd==='insert'){ const latex=btn.dataset.latex||''; mf.insert(latex); mf.focus(); mf.dispatchEvent(new Event('input')); }
  });
  wrap.appendChild(bar);

  $("#opts").appendChild(wrap);
}

async function renderQuestion(){
  const q=testData.questions[currentIndex];
  $("#qIndex").textContent=String(currentIndex+1);
  $("#qTotal").textContent=String(testData.questions.length);
  $("#qSect").textContent=q.section||'Umumiy';
  $("#qText").innerHTML=wrapTeX(q.text||'');
  $("#opts").innerHTML='';

  if(q.type==='open'){
    await ensureMathlive();
    renderOpenWithMathlive(q);
  } else {
    const multi = (q.type==='multi');
    const chosen = new Set(answers[currentIndex] || []);
    const order = q._perm && q._perm.length===q.options.length ? q._perm : [...Array(q.options.length).keys()];
    order.forEach(orig=>{
      const row=document.createElement('label'); row.className='opt';
      const inp=document.createElement('input');
      inp.type = multi ? 'checkbox' : 'radio';
      inp.name = 'q'+currentIndex + (multi?'[]':'');
      inp.value = String(orig);
      inp.checked = chosen.has(orig);
      inp.addEventListener('change', ()=>{
        if(multi){ if(inp.checked) chosen.add(orig); else chosen.delete(orig); answers[currentIndex]=normalize([...chosen]); }
        else { answers[currentIndex] = inp.checked ? [orig] : []; }
        refreshDots();
      });
      const span=document.createElement('span'); span.innerHTML=wrapTeX(q.options[orig]);
      row.appendChild(inp); row.appendChild(span); $("#opts").appendChild(row);
    });
  }

  resolveImageSrc(currentIndex+1).then(src=>{ $("#qImage").src=src; });
  typeset($("#questionsCard"));
  highlightDot(currentIndex);
}

/* ===== Timer ===== */
function startTimer(effectiveDurationSec, hardEnd){
  if(timerId){ clearInterval(timerId); timerId=null; }
  timeLeftSec = Math.max(0, Math.floor(effectiveDurationSec||0));
  effectiveEnd = hardEnd || null;

  const both=(txt,show)=>{ $("#metaTimer").textContent=txt; $("#qTimer").textContent=txt; $("#metaTimer").classList.toggle('hidden',!show); $("#qTimer").classList.toggle('hidden',!show); };

  both(`${pad2(Math.floor(timeLeftSec/60))}:${pad2(timeLeftSec%60)}`, true);
  timerId=setInterval(()=>{
    const now = new Date();
    if(effectiveEnd && now >= effectiveEnd){ clearInterval(timerId); timerId=null; onFinish(); return; }

    timeLeftSec--; spentSeconds++;
    if(timeLeftSec <= 0){ clearInterval(timerId); timerId=null; onFinish(); return; }

    const m=Math.floor(timeLeftSec/60), s=timeLeftSec%60;
    both(`${pad2(m)}:${pad2(s)}`, true);
  }, 1000);
}

/* ===== Scoring ===== */
function computeTotals(){
  let total=0, max=0; const perQuestion=[]; const sectionAgg=new Map();

  testData.questions.forEach((q,i)=>{
    const sect=q.section||'Umumiy'; const pts=Number(q.points||1); max += pts;
    let ok=false;

    if(q.type==='single'){
      const picked = normalize(answers[i]||[]);
      const correct=[Number(q.correctIndex ?? -1)];
      ok = (picked.length===1 && picked[0]===correct[0]);
      perQuestion.push({ i, section:sect, pts, ok, picked, correct, text:q.text, options:q.options });
    }
    else if(q.type==='multi'){
      const picked = normalize(answers[i]||[]);
      const correct = normalize(q.correctIndices||[]);
      ok = arraysEqual(picked, correct);
      perQuestion.push({ i, section:sect, pts, ok, picked, correct, text:q.text, options:q.options });
    }
    else {
      const rawLatex = (answers[i]?.[0] ?? '').toString();
      const A = q.answer || {};
      let match=false;

      const accepted = Array.isArray(A.accept) ? A.accept : [];
      const normRaw = normStr(rawLatex);
      for(const patt of accepted){ if(normStr(patt)===normRaw){ match=true; break; } }

      if(!match && A.numeric && typeof A.numeric.value!=='undefined'){
        const v = parseFloat(rawLatex);
        if(isFinite(v)){ match = closeEnoughNumeric(v, A.numeric.value, A.numeric.tol ?? 0); }
      }

      ok = !!match;
      perQuestion.push({ i, section:sect, pts, ok, picked:[rawLatex], correct:accepted, text:q.text, options:[] });
    }

    if(ok) total += pts;
    if(!sectionAgg.has(sect)) sectionAgg.set(sect,{q:0,ok:0,pts:0,ptsMax:0});
    const a=sectionAgg.get(sect); a.q+=1; a.ptsMax+=pts; if(ok){ a.ok+=1; a.pts+=pts; }
  });

  return { total, max, perQuestion, sectionAgg };
}

/* ===== First-solve only points ===== */
async function addPointsIfFirstSolve({ uid, testCode, delta }) {
  const userRef = doc(db, 'users', uid);
  const markRef = doc(db, 'users', uid, 'solved', testCode);
  const add = Number(delta||0);
  if(!(add>0)) return { skipped:true, reason:'non-positive' };

  return runTransaction(db, async (tx)=>{
    const m = await tx.get(markRef);
    if(m.exists()) return { skipped:true };

    const u = await tx.get(userRef);
    const prev = u.exists() ? Number(u.data()?.points || 0) : 0;
    const next = prev + add;

    tx.set(userRef, { points: next, updatedAt: serverTimestamp() }, { merge:true });
    tx.set(markRef, { testCode, added:add, at: serverTimestamp(), spentSeconds });
    return { skipped:false, added:add, totalPoints:next };
  });
}

/* ===== Render: sections & detail ===== */
function renderSectionStats(sectionAgg){
  const grid=document.createElement('div'); grid.className='stats-grid';
  for(const [name,a] of sectionAgg.entries()){
    const pct=a.q?Math.round((a.ok/a.q)*100):0;
    const card=document.createElement('div'); card.className='stat';
    card.innerHTML = `<div style="font-weight:700;margin-bottom:4px">${name}</div>
      <div style="color:#667a72;font-size:12px">Savollar: ${a.q}</div>
      <div style="margin-top:6px"><b>${fmt(a.pts)}</b>/<b>${fmt(a.ptsMax)}</b> · <b>${pct}%</b></div>`;
    grid.appendChild(card);
  }
  $("#sectionStats").innerHTML=''; $("#sectionStats").appendChild(grid);
}
function renderDetail(rows){
  const table=document.createElement('table'); table.className='tbl';
  table.innerHTML=`<thead class="rowbox">
    <tr><th>#</th><th>Bo‘lim</th><th>Savol</th><th>Tanlangan/Javob</th><th>To‘g‘ri</th><th style="text-align:right">Ball</th></tr>
  </thead><tbody id="detailBody"></tbody>`;
  const body=table.querySelector('#detailBody');

  rows.forEach(r=>{
    const pickedDisp = (r.picked && r.picked.length)
      ? (r.options.length===0 ? (r.picked[0]||'—') : r.picked.map(x=>x+1).join(', '))
      : '—';
    const correctDisp = r.options.length ? r.correct.map(x=>x+1).join(', ') : (Array.isArray(r.correct)? r.correct.join(' | ') : '');
    const tr=document.createElement('tr'); tr.className='rowbox';
    tr.innerHTML = `
      <td>${r.i+1}</td>
      <td><span class="chip">${r.section}</span></td>
      <td style="max-width:360px">${wrapTeX(r.text||'')}</td>
      <td>${pickedDisp} ${r.ok?'✓':'✗'}</td>
      <td>${correctDisp}</td>
      <td style="text-align:right"><b>${r.ok?fmt(r.pts):0}</b>/<b>${fmt(r.pts)}</b></td>`;
    body.appendChild(tr);
  });

  $("#detailTable").innerHTML=''; $("#detailTable").appendChild(table);
  typeset($("#detailTable"));
}

/* ===== Finish ===== */
async function onFinish(){
  if(timerId){ clearInterval(timerId); timerId=null; }
  if(startedAt){ const now=new Date(); spentSeconds=Math.max(spentSeconds, Math.floor((now-startedAt)/1000)); }

  const { total, max, perQuestion, sectionAgg } = computeTotals();

  $("#questionsCard").classList.add('hidden'); $("#resultCard").classList.remove('hidden');
  $("#scoreTotal").textContent=fmt(total);
  $("#scoreMax").textContent=fmt(max);
  $("#scoreNote").textContent=`To‘g‘ri: ${perQuestion.filter(x=>x.ok).length} / ${perQuestion.length}`;
  $("#timeNote").textContent=`Sarflangan vaqt: ${pad2(Math.floor(spentSeconds/60))}:${pad2(spentSeconds%60)}`;

  $("#stCorrect").textContent=String(perQuestion.filter(x=>x.ok).length);
  $("#stWrong").textContent=String(perQuestion.length - perQuestion.filter(x=>x.ok).length);
  $("#stPct").textContent=(max?Math.round((total/max)*100):0)+'%';
  $("#stPoints").textContent=`${fmt(total)}/${fmt(max)}`;
  renderSectionStats(sectionAgg);
  renderDetail(perQuestion);

  const user = auth.currentUser;
  if(!currentTestCode){ showSave('Kod topilmadi — points qo‘shilmadi','warn'); return; }
  if(!user){ showSave('Kirmagansiz — points qo‘shilmadi','warn'); return; }

  try{
    const res = await addPointsIfFirstSolve({ uid:user.uid, testCode:currentTestCode, delta: total });
    if(res.skipped) showSave('Oldin yechilgansiz — points qo‘shilmadi (skip)','warn');
    else showSave(`Points +${res.added} → ${res.totalPoints} · Saqlandi`,'good');
  }catch(e){
    console.error(e); showSave('Points qo‘shishda xatolik: '+(e?.message||e),'bad');
  }
}

/* ===== Auth & Boot ===== */
await requireAuth();
onAuthStateChanged(auth, (user)=>{ $('#authInfo').textContent = user ? `Kirish: ${user.displayName||user.email}` : 'Kirish: mehmon'; });

async function boot(){
  await loadTestData();

  if(!testData || !testData.questions?.length){
    $('#introCard').classList.add('hidden'); $('#questionsCard').classList.add('hidden'); $('#resultCard').classList.add('hidden');
    $('#emptyCard').classList.remove('hidden'); return;
  }
  currentTestId = rawIdFromUrl || testData.id || currentTestId;
  currentTestCode = currentTestCode || testData.code || currentTestId;

  // Intro
  $('#testTitle').textContent = testData.title || 'Test';
  $('#testDesc').textContent  = testData.description || '';
  $('#metaCount').textContent = `Savollar: ${testData.questions.length}`;
  $('#metaPoints').textContent= `Umumiy ball: ${fmt(sum(testData.questions.map(q=>q.points)))}`;
  if(currentTestCode){ $('#codeChip').textContent=`Kod: ${currentTestCode}`; $('#codeChip').classList.remove('hidden'); }

  // Availability
  const av = computeEffectiveTiming({ availability: testData.availability, durationMinutes: testData.durationMinutes });
  if(!av.canStart){
    $('#metaTimer').classList.add('hidden');
    $('#questionsCard').classList.add('hidden');
    $('#resultCard').classList.add('hidden');
    showTop(av.openMsg || 'Hozir test yopiq', 'warn');
  } else {
    const m = Math.floor((av.effectiveDurationSec||0)/60);
    if(m>0){ $('#metaTimer').textContent = `${pad2(m)}:00`; $('#metaTimer').classList.remove('hidden'); }
    else { $('#metaTimer').classList.add('hidden'); }
  }

  answers = Array.from({length:testData.questions.length}, ()=>[]);
  buildNavDots();

  $('#startBtn').onclick = async ()=>{
    const conf = computeEffectiveTiming({ availability: testData.availability, durationMinutes: testData.durationMinutes });
    if(!conf.canStart){ showTop(conf.openMsg || 'Hozir test yopiq', 'warn'); return; }

    // Mathlive ni oldindan yuklab qo‘yamiz (open savollar bo‘lishi mumkin)
    await ensureMathlive();

    startedAt=new Date(); spentSeconds=0;
    $('#introCard').classList.add('hidden');
    $('#questionsCard').classList.remove('hidden');
    renderQuestion();
    startTimer(conf.effectiveDurationSec, conf.hardEnd);
  };

  $('#prevBtn').onclick  = ()=>{ if(currentIndex>0){ currentIndex--; renderQuestion(); } };
  $('#nextBtn').onclick  = ()=>{ if(currentIndex<testData.questions.length-1){ currentIndex++; renderQuestion(); } };
  $('#finishBtn').onclick= onFinish;
  $('#againBtn').onclick = ()=>{ $('#resultCard').classList.add('hidden'); $('#questionsCard').classList.remove('hidden'); renderQuestion(); };

  $('#introCard').classList.remove('hidden');
}

boot();

/* ========= Imports ========= */
import { auth, db, onAuthStateChanged } from "/lib/firebase.client.js";
import { requireAuth } from "/lib/auth-guard.js";
import {
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ========= Shorthand & helpers ========= */
const $    = (s) => document.querySelector(s);
const pad2 = (n) => String(Math.max(0, n)).padStart(2, "0");
const sum  = (a) => (Array.isArray(a) ? a : []).reduce((x, y) => x + (+y || 0), 0);
const isMulti     = (q) => Array.isArray(q.correctIndices);
const normalize   = (arr) => Array.from(new Set((arr || []).map(Number))).sort((a, b) => a - b);
const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const fmt  = (x) => { const r = Math.round((+x + Number.EPSILON) * 100) / 100; return (Math.abs(r) % 1 === 0) ? String(Math.trunc(r)) : String(r); };
const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* ========= Status chip ========= */
function showSaveStatus(msg, kind = "good") {
  const top = $("#saveStatusTop");
  const bot = $("#saveStatus");
  [top, bot].forEach((el) => {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden", "good", "bad", "warn");
    el.classList.add(kind);
  });
}

/* ========= MathJax helpers ========= */
const TEX_TOKENS = ["\\frac","\\sqrt","\\sum","\\int","\\pi","\\alpha","\\beta","\\gamma","\\le","\\ge","\\cdot","\\times","\\pm","\\ln","\\log","\\sin","\\cos","\\tan","^","_"];
function looksLikeTeX(s){ if(typeof s!=="string") return false; if(s.includes("$")||s.includes("\\(")||s.includes("\\[")) return false; for(const t of TEX_TOKENS){ if(s.indexOf(t)!==-1) return true; } return false; }
const wrapTeX = (s)=> looksLikeTeX(s) ? `\\(${s}\\)` : s;
const mjReady = ()=> new Promise(res=>{ const tick=()=> (window.MathJax&&window.MathJax.typesetPromise)?res():setTimeout(tick,30); tick(); });
async function typeset(el){ await mjReady(); try{ await MathJax.typesetPromise([el]); }catch{} }

/* ========= Duration parsing ========= */
function parseDurationMinutes(v){
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const s=v.trim();
    if (s.includes(":")) {
      const p=s.split(":").map(x=>parseInt(x,10)||0);
      if (p.length===2) return p[0];         // mm:ss
      if (p.length===3) return p[0]*60+p[1]; // hh:mm:ss
    }
    const n=parseFloat(s); return isFinite(n)?n:0;
  }
  return 0;
}

/* ========= Global state ========= */
let testData=null, currentIndex=0, answers=[], startedAt=null, timeLeftSec=0, timerId=null, spentSeconds=0;
const params=new URLSearchParams(location.search);
const rawIdFromUrl=params.get("id");
let currentTestId= rawIdFromUrl || (location.pathname.split("/").pop().replace(/\..*$/,"") || "test");
let currentTestCode = params.get("code") || null;

/* ========= Auth ========= */
await requireAuth();
onAuthStateChanged(auth, (user)=>{
  $("#authInfo").textContent = user ? `Kirish: ${user.displayName || user.email}` : "Kirish: mehmon";
});

/* ========= Test data loader ========= */
function applySectionRanges(data){
  if(!Array.isArray(data.questions)) return;
  if(Array.isArray(data.sections)){
    data.sections.forEach(sec=>{
      const name=sec.name||"Umumiy";
      const s=Math.max(1, Number(sec.start||1));
      const e=Math.min(data.questions.length, Number(sec.end||data.questions.length));
      for(let i=s-1;i<e;i++){ data.questions[i].section = data.questions[i].section || name; }
    });
  }
  data.questions.forEach(q=>{ if(!q.section) q.section="Umumiy"; });
}
function normalizeTestData(data){
  if(!data || !Array.isArray(data.questions)) return data;
  data.title = data.title || "Test";
  data.description = data.description || "Rasm + variantlar";
  data.questions = data.questions.map(q=>({ ...q, points: Number(q.points||1) }));
  const rawDur = (data.durationMinutes ?? data.totalTime ?? 0);
  data.durationMinutes = parseDurationMinutes(rawDur);
  applySectionRanges(data);
  data.id   = data.id   || slug(data.title);
  data.code = data.code || slug(data.title);
  return data;
}
async function loadTestData(){
  const stored = localStorage.getItem("testData");
  if(stored){ try{ testData = normalizeTestData(JSON.parse(stored)); return; }catch{} }
  try{
    const r = await fetch("./test.json",{cache:"no-store"});
    if(!r.ok) throw new Error("no test.json");
    testData = normalizeTestData(await r.json());
  }catch{
    testData = normalizeTestData({
      title:"Demo test", description:"Fallback ma’lumotlar", durationMinutes:1, code:"demo-001",
      questions:[
        {section:"Algebra", text:"1) $2+2$ nechiga teng?", options:["2","3","4","5"], correctIndex:2, points:1},
        {section:"Sonlar nazariyasi", text:"2) \\(\\text{Tub son(lar)}\\)", options:["2","4","5","9"], correctIndices:[0,2], points:2},
        {section:"Geometriya", text:"3) Nisbatni toping.", options:["1:1","1:2","2:3","3:4"], correctIndex:0, points:1}
      ]
    });
  }
  // shuffle options
  testData.questions.forEach(q=>{
    const idxs=[...Array(q.options.length).keys()];
    for(let i=idxs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [idxs[i],idxs[j]]=[idxs[j],idxs[i]]; }
    q._perm=idxs;
  });
}

/* ========= UI: dots, question render, images ========= */
function buildNavDots(){
  const n=testData.questions.length; const root=$("#navDots"); root.innerHTML="";
  for(let i=0;i<n;i++){
    const b=document.createElement("button");
    b.className="dot"; b.dataset.idx=String(i); b.textContent=String(i+1);
    b.addEventListener("click", ()=>{ currentIndex=i; renderQuestion(); });
    root.appendChild(b);
  }
  refreshDotsState(); highlightDot(0);
}
function highlightDot(i){ [...document.querySelectorAll(".dot")].forEach((el,idx)=> el.classList.toggle("active", idx===i)); }
function refreshDotsState(){ [...document.querySelectorAll(".dot")].forEach(el=>{ const i=Number(el.dataset.idx); const hasAns=!!(answers[i]&&answers[i].length); el.classList.toggle("answered", hasAns); }); }

async function resolveImageSrc(idx1){
  const q=testData.questions[idx1-1]||{};
  const cand=[`./${idx1}.jpg`,`./${idx1}.png`,`./${idx1}.jpeg`,`./${idx1}.webp`, q.image||""].filter(Boolean);
  for(const u of cand){
    const ok = await new Promise(r=>{ const img=new Image(); img.onload=()=>r(true); img.onerror=()=>r(false); img.src=u+(u.includes("?")?"":`?t=${Date.now()}`); });
    if(ok) return u;
  }
  return "";
}
function renderQuestion(){
  const q=testData.questions[currentIndex];
  $("#qIndex").textContent=String(currentIndex+1);
  $("#qTotal").textContent=String(testData.questions.length);
  $("#qText").innerHTML=wrapTeX(q.text||"");
  $("#qSect").textContent=q.section||"Umumiy";
  $("#opts").innerHTML="";

  const multi=isMulti(q);
  const chosen=new Set(answers[currentIndex]||[]);
  const order=q._perm&&q._perm.length===q.options.length?q._perm:[...Array(q.options.length).keys()];
  order.forEach((orig)=>{
    const row=document.createElement("label"); row.className="opt";
    const inp=document.createElement("input");
    inp.type=multi?"checkbox":"radio";
    inp.name="q"+currentIndex+(multi?"[]":"");
    inp.value=String(orig);
    inp.checked=chosen.has(orig);
    inp.addEventListener("change", ()=>{
      if(multi){ if(inp.checked) chosen.add(orig); else chosen.delete(orig); answers[currentIndex]=normalize([...chosen]); }
      else{ answers[currentIndex]=inp.checked?[orig]:[]; }
      refreshDotsState();
    });
    const span=document.createElement("span"); span.innerHTML=wrapTeX(q.options[orig]);
    row.appendChild(inp); row.appendChild(span);
    $("#opts").appendChild(row);
  });
  resolveImageSrc(currentIndex+1).then(src=>{ $("#qImage").src=src; });
  highlightDot(currentIndex); typeset($("#questionsCard"));
}

/* ========= Timer ========= */
function startTimerIfNeeded(){
  const minutes=Number(testData.durationMinutes||0);
  const both=(txt,show)=>{ $("#metaTimer").textContent=txt; $("#qTimer").textContent=txt; $("#metaTimer").classList.toggle("hidden",!show); $("#qTimer").classList.toggle("hidden",!show); };
  if(!minutes){ both("00:00",false); return; }
  timeLeftSec=Math.round(minutes*60);
  both(`${pad2(Math.floor(timeLeftSec/60))}:${pad2(timeLeftSec%60)}`, true);
  timerId=setInterval(()=>{
    timeLeftSec--; spentSeconds++;
    const m=Math.max(0,Math.floor(timeLeftSec/60)), s=Math.max(0,timeLeftSec%60);
    both(`${pad2(m)}:${pad2(s)}`, true);
    if(timeLeftSec<=0){ clearInterval(timerId); onFinish(); }
  },1000);
}

/* ========= Scoring ========= */
function computeTotals(){
  let total=0, max=0; const perQuestion=[]; const sectionAgg=new Map();
  testData.questions.forEach((q,i)=>{
    const sect=q.section||"Umumiy"; const pts=Number(q.points||1); max+=pts;
    const picked=normalize(answers[i]||[]);
    const correct=isMulti(q)?normalize(q.correctIndices||[]):[Number(q.correctIndex??-1)];
    const ok=isMulti(q)?arraysEqual(picked,correct):(picked.length===1 && picked[0]===correct[0]);
    if(ok) total+=pts;
    if(!sectionAgg.has(sect)) sectionAgg.set(sect,{q:0,ok:0,pts:0,ptsMax:0});
    const a=sectionAgg.get(sect); a.q+=1; a.ptsMax+=pts; if(ok){ a.ok+=1; a.pts+=pts; }
    perQuestion.push({
      i, section:sect, pts:Number(pts||0), ok:!!ok,
      picked:Array.isArray(picked)?picked:[], correct:Array.isArray(correct)?correct:[],
      text:String(q.text||""), options:Array.isArray(q.options)?q.options.map(v=>String(v??"")):[]
    });
  });
  return { total, max, perQuestion, sectionAgg };
}

/* ========= POINTS: only-once per test (no results) ========= */
/** Birinchi marta yechilganda points qo‘shish; keyingi urinishlarda skip. */
async function addPointsIfFirstSolve({ uid, testCode, delta }) {
  const userRef = doc(db, "users", uid);
  const markRef = doc(db, "users", uid, "solved", testCode);

  const add = Number(delta || 0);
  if (!(add > 0)) return { skipped: true, reason: "non-positive" };

  return runTransaction(db, async (tx) => {
    const markSnap = await tx.get(markRef);
    if (markSnap.exists()) return { skipped: true };

    const userSnap = await tx.get(userRef);
    const prev = userSnap.exists() ? Number(userSnap.data()?.points || 0) : 0;
    const next = prev + add;

    tx.set(userRef, { points: next, updatedAt: serverTimestamp() }, { merge: true });
    tx.set(markRef, { testCode, added: add, at: serverTimestamp(), spentSeconds });

    return { skipped: false, added: add, totalPoints: next };
  });
}

/* ========= Render helpers for results ========= */
function renderSectionStats(sectionAgg){
  const container=document.createElement("div"); container.className="stats-grid";
  for(const [name,a] of sectionAgg.entries()){
    const pct=a.q?Math.round((a.ok/a.q)*100):0;
    const card=document.createElement("div"); card.className="stat";
    card.innerHTML=`<div style="font-weight:700;margin-bottom:4px">${name}</div>
                    <div style="color:#667a72;font-size:12px">Savollar: ${a.q}</div>
                    <div style="margin-top:6px"><b>${fmt(a.pts)}</b>/<b>${fmt(a.ptsMax)}</b> · <b>${pct}%</b></div>`;
    container.appendChild(card);
  }
  const root=$("#sectionStats"); root.innerHTML=""; root.appendChild(container);
}
function renderDetail(perQuestion){
  const table=document.createElement("table"); table.className="tbl";
  table.innerHTML = `<thead class="rowbox">
    <tr><th>#</th><th>Bo‘lim</th><th>Savol</th><th>Tanlangan</th><th>To‘g‘ri</th><th style="text-align:right">Ball</th></tr>
  </thead><tbody id="detailBody"></tbody>`;
  const body=table.querySelector("#detailBody");
  perQuestion.forEach(r=>{
    const picked=r.picked.length? r.picked.map(x=>x+1).join(", "):"—";
    const correct=r.correct.map(x=>x+1).join(", ");
    const tr=document.createElement("tr"); tr.className="rowbox";
    tr.innerHTML=`<td>${r.i+1}</td>
                  <td><span class="chip">${r.section}</span></td>
                  <td style="max-width:360px">${wrapTeX(r.text||"")}</td>
                  <td>${picked} ${r.ok?"✓":"✗"}</td>
                  <td>${correct}</td>
                  <td style="text-align:right"><b>${r.ok?fmt(r.pts):0}</b>/<b>${fmt(r.pts)}</b></td>`;
    body.appendChild(tr);
  });
  const root=$("#detailTable"); root.innerHTML=""; root.appendChild(table); typeset(root);
}

/* ========= Finish handler ========= */
async function onFinish(){
  if(timerId){ clearInterval(timerId); timerId=null; }
  if(startedAt){ const now=new Date(); spentSeconds=Math.max(spentSeconds, Math.floor((now-startedAt)/1000)); }

  const { total, max, perQuestion, sectionAgg } = computeTotals();
  $("#questionsCard").classList.add("hidden");
  $("#resultCard").classList.remove("hidden");

  $("#scoreTotal").textContent=fmt(total);
  $("#scoreMax").textContent=fmt(max);
  $("#scoreNote").textContent=`To‘g‘ri: ${perQuestion.filter(x=>x.ok).length} / ${perQuestion.length}`;
  $("#timeNote").textContent=`Sarflangan vaqt: ${pad2(Math.floor(spentSeconds/60))}:${pad2(spentSeconds%60)}`;
  $("#stCorrect").textContent=String(perQuestion.filter(x=>x.ok).length);
  $("#stWrong").textContent=String(perQuestion.length - perQuestion.filter(x=>x.ok).length);
  $("#stPct").textContent=(max?Math.round((total/max)*100):0) + "%";
  $("#stPoints").textContent=`${fmt(total)}/${fmt(max)}`;
  renderSectionStats(sectionAgg);
  renderDetail(perQuestion.map(r=>({
    i:r.i, section:r.section||"Umumiy", pts:Number(r.pts||0), ok:!!r.ok,
    picked:Array.isArray(r.picked)?r.picked:[], correct:Array.isArray(r.correct)?r.correct:[],
    text:String(r.text||""), options:Array.isArray(r.options)?r.options.map(v=>String(v??"")):[]
  })));

  const user = auth.currentUser;
  if(!currentTestCode){ showSaveStatus("Kod topilmadi — points qo‘shilmadi","warn"); return; }
  if(!user){ showSaveStatus("Kirmagansiz — points qo‘shilmadi","warn"); return; }

  try{
    const res = await addPointsIfFirstSolve({ uid:user.uid, testCode:currentTestCode, delta: total });
    if(res.skipped){ showSaveStatus("Oldin yechilgansiz — points qo‘shilmadi (skip)","warn"); }
    else { showSaveStatus(`Points +${res.added} → ${res.totalPoints} · Saqlandi`,"good"); }
  }catch(e){
    console.error("points add error:", e);
    showSaveStatus("Points qo‘shishda xatolik: " + (e?.message || e), "bad");
  }
}

/* ========= Boot ========= */
async function boot(){
  await loadTestData();

  if(!testData || !testData.questions?.length){
    $("#introCard").classList.add("hidden");
    $("#questionsCard").classList.add("hidden");
    $("#resultCard").classList.add("hidden");
    $("#emptyCard").classList.remove("hidden");
    return;
  }

  $("#emptyCard").classList.add("hidden");
  $("#resultCard").classList.add("hidden");
  $("#questionsCard").classList.add("hidden");
  $("#introCard").classList.remove("hidden");

  currentTestId   = rawIdFromUrl || testData.id || currentTestId;
  currentTestCode = currentTestCode || testData.code || currentTestId;

  $("#testTitle").textContent=testData.title || "Test";
  if(currentTestCode){ $("#codeChip").textContent=`Kod: ${currentTestCode}`; $("#codeChip").classList.remove("hidden"); }
  document.title = `${testData.title||"Test"} — ${currentTestCode?("#"+currentTestCode):""} | LeaderMath`;
  $("#testDesc").textContent=testData.description || "";
  $("#metaCount").textContent=`Savollar: ${testData.questions.length}`;
  $("#metaPoints").textContent=`Umumiy ball: ${fmt(sum(testData.questions.map(q=>q.points)))}`;

  const minutes=Number(testData.durationMinutes||0);
  if(minutes>0){ $("#metaTimer").textContent=`${pad2(minutes)}:00`; $("#metaTimer").classList.remove("hidden"); }
  else { $("#metaTimer").classList.add("hidden"); }

  answers = Array.from({length:testData.questions.length}, ()=>[]);
  buildNavDots();

  $("#startBtn").onclick  = ()=>{ startedAt=new Date(); spentSeconds=0; $("#introCard").classList.add("hidden"); $("#questionsCard").classList.remove("hidden"); renderQuestion(); startTimerIfNeeded(); };
  $("#prevBtn").onclick   = ()=>{ if(currentIndex>0){ currentIndex--; renderQuestion(); } };
  $("#nextBtn").onclick   = ()=>{ if(currentIndex<testData.questions.length-1){ currentIndex++; renderQuestion(); } };
  $("#finishBtn").onclick = onFinish;
  $("#againBtn").onclick  = ()=>{ $("#resultCard").classList.add("hidden"); $("#questionsCard").classList.remove("hidden"); renderQuestion(); };
}
boot();
document.addEventListener('contextmenu', e => e.preventDefault());

// 2. Klaviatura orqali man etilgan tugmalar
document.addEventListener('keydown', e => {
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && ["I","J","C"].includes(e.key)) ||
    (e.ctrlKey && e.key === "U") ||
    (e.ctrlKey && e.key === "S")
  ) e.preventDefault();
});
document.addEventListener('contextmenu', e => e.preventDefault());

// === 2. Klaviatura orqali "DevTools", "View Source" va "Save" urinishlarini to‘xtatish ===
document.addEventListener('keydown', e => {
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && ["I","J","C"].includes(e.key)) ||
    (e.ctrlKey && e.key === "U") ||
    (e.ctrlKey && e.key === "S")
  ) {
    e.preventDefault();
  }
});

// === 3. Rasmni drag & drop orqali tashlab olishni taqiqlash ===
document.addEventListener('dragstart', e => {
  if (e.target.tagName === 'IMG') e.preventDefault();
});

// === 4. (Ixtiyoriy) — Rasmlarni brauzerda sürüklenmaydigan qilib qo‘yish ===
window.addEventListener('load', ()=>{
  document.querySelectorAll('img').forEach(img=>{
    img.setAttribute('draggable','false');
    img.addEventListener('dragstart', e => e.preventDefault());
  });
});
import { me, logout, getToken } from "./auth.js";
import { api } from "./api.js";

const $ = (id)=>document.getElementById(id);

const toastEl = $("toast");
function toast(msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(window.__t);
  window.__t = setTimeout(()=>toastEl.classList.remove("show"), 2000);
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
}

function getCodeFromUrl(){
  const u = new URL(location.href);
  let code = (u.searchParams.get("code") || u.searchParams.get("c") || "").trim();
  if(!code){
    // allow /test.html#CODE
    code = String(location.hash || "").replace(/^#/, "").trim();
  }
  // if they came from app challenge box
  if(!code){
    try{ code = (sessionStorage.getItem("lm_challenge_code") || "").trim(); }catch{}
  }
  return code;
}

function fmtTime(sec){
  const s = Math.max(0, Math.floor(sec||0));
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${mm}:${ss}`;
}

function setVisible(id, on){
  const el = $(id);
  if(!el) return;
  el.style.display = on ? "" : "none";
}

// Local fallback loader:
// 1) /local-tests/<CODE>.json
// 2) /local-tests/index.json (map: { tests:[{code, file}] })
async function loadLocalTest(code){
  const tryJson = async (url)=>{
    const r = await fetch(url, { cache:"no-store" });
    if(!r.ok) return null;
    return await r.json();
  };

  // direct file
  const direct = await tryJson(`local-tests/${encodeURIComponent(code)}.json`);
  if(direct) return { source:"local", id: direct.id || code, raw: direct };

  // via index
  const idx = await tryJson("local-tests/index.json");
  const arr = Array.isArray(idx?.tests) ? idx.tests : [];
  const hit = arr.find(t => String(t.code||"").trim().toLowerCase() === String(code).trim().toLowerCase());
  if(hit?.file){
    const j = await tryJson(`local-tests/${hit.file}`);
    if(j) return { source:"local", id: j.id || code, raw: j };
  }
  return null;
}

// Normalize local test schema (simple)
// Expected local schema:
// {
//   "id":"T-1",
//   "title":"...",
//   "durationSec":600,
//   "questions":[
//     {"type":"mcq","img":"1.png","options":["A","B"],"correct":"0","points":1},
//     {"type":"open","img":"2.png","answers":["12"],"points":1}
//   ]
// }
function normalizeLocal(raw, code){
  const q = Array.isArray(raw?.questions) ? raw.questions : [];
  return {
    id: String(raw?.id || code),
    code: String(raw?.code || code),
    title: String(raw?.title || "Test"),
    grade: String(raw?.grade || ""),
    examType: String(raw?.examType || raw?.type || "LOCAL"),
    mode: String(raw?.mode || "open"),
    durationSec: Number(raw?.durationSec || 0) || 0,
    folder: String(raw?.folder || raw?.code || code),
    questions: q.map((x,i)=>({
      i,
      type: String(x?.type || "mcq"),
      points: Number(x?.points || 1) || 1,
      img: String(x?.img || x?.image || `${i+1}.png`),
      options: Array.isArray(x?.options) ? x.options.map(v=>String(v)) : [],
      // local-only grading fields
      correct: x?.correct,
      answers: Array.isArray(x?.answers) ? x.answers.map(v=>String(v)) : []
    }))
  };
}

function scoreLocal(test, answers){
  const qs = Array.isArray(test.questions) ? test.questions : [];
  const ans = Array.isArray(answers) ? answers : [];
  let score = 0, correct=0, wrong=0;
  for(let i=0;i<qs.length;i++){
    const q = qs[i] || {};
    const pts = Number(q.points||1)||1;
    const a = ans[i];
    let ok=false;
    if(q.type === "open"){
      const na = String(a??"").trim().toLowerCase().replace(/\s+/g,"");
      ok = (q.answers||[]).some(v=>String(v??"").trim().toLowerCase().replace(/\s+/g,"")===na);
    }else{
      ok = String(a??"") === String(q.correct??"");
    }
    if(ok){ score += pts; correct++; } else { wrong++; }
  }
  return { score, correct, wrong, total: qs.length };
}

// ===== UI state =====
let user = null;
let code = "";
let source = "firebase"; // firebase|local
let test = null;
let idx = 0;
let answers = [];
let startedAt = 0;
let timerInt = null;
let remaining = 0;

function setHeader(){
  $("uName").textContent = user?.name || (user?.firstName ? `${user.firstName} ${user.lastName||""}`.trim() : "—");
  $("uId").textContent = user?.loginId || "—";
}

function setMeta(){
  const meta = [
    test?.grade ? `🎓 ${test.grade}` : null,
    test?.examType ? `🏷️ ${test.examType}` : null,
    test?.mode ? (test.mode === "challenge" ? "⚡ Challenge" : "🟢 Open") : null,
    source === "local" ? "📦 Local" : "☁️ Firebase",
  ].filter(Boolean).join(" • ");
  $("testMeta").textContent = meta || "—";
}

function updateProgress(){
  const total = Array.isArray(test?.questions) ? test.questions.length : 0;
  $("progress").textContent = `${Math.min(idx+1,total)}/${total}`;
}

function stopTimer(){
  if(timerInt) clearInterval(timerInt);
  timerInt = null;
}

function startTimer(){
  stopTimer();
  const dur = Number(test?.durationSec||0)||0;
  if(dur <= 0){
    $("timer").textContent = "∞";
    return;
  }
  remaining = dur;
  $("timer").textContent = fmtTime(remaining);
  timerInt = setInterval(async ()=>{
    remaining -= 1;
    $("timer").textContent = fmtTime(remaining);
    if(remaining <= 0){
      stopTimer();
      toast("⏱️ Vaqt tugadi! Yuborilmoqda…");
      await submit();
    }
  }, 1000);
}

function renderQuestion(){
  const qs = Array.isArray(test?.questions) ? test.questions : [];
  const q = qs[idx];
  if(!q){ return; }

  updateProgress();

  const imgSrc = (source === "firebase")
    ? `tests/${encodeURIComponent(test.folder||test.code||test.id)}/${encodeURIComponent(q.img||"")}`
    : `local-tests/${encodeURIComponent(test.folder||test.code||test.id)}/${encodeURIComponent(q.img||"")}`;

  const chosen = answers[idx];
  const isOpen = (q.type === "open");

  $("qCard").innerHTML = `
    <div class="qHead">
      <div>
        <div class="qIdx">Savol ${idx+1} <span class="muted">(⭐ ${Number(q.points||1)||1} ball)</span></div>
        <div class="small muted">Javobni belgilang va davom eting</div>
      </div>
      <div class="pillMini">${isOpen ? "✍️ Ochiq" : "🔘 Variant"}</div>
    </div>
    <div style="margin-top:12px;">
      <img class="qImg" src="${imgSrc}" alt="Savol rasmi" onerror="this.style.display='none'"/>
    </div>
    <div class="optList" id="optList"></div>
    <div class="navRow">
      <button class="btn secondary" id="prevBtn" type="button"><i class="fa-solid fa-arrow-left"></i> Oldingi</button>
      <button class="btn" id="nextBtn" type="button">Keyingi <i class="fa-solid fa-arrow-right"></i></button>
      <button class="btn btnPrimary" id="submitBtn" type="button" style="display:${idx===qs.length-1?"":"none"}">Yakunlash</button>
    </div>
  `;

  const optList = $("optList");
  if(isOpen){
    optList.innerHTML = `
      <div class="small muted">Ochiq javobni yozing:</div>
      <input class="input" id="openInput" placeholder="Javob…" value="${escapeHtml(chosen||"")}" autocomplete="off" />
    `;
    $("openInput").addEventListener("input", (e)=>{ answers[idx] = e.target.value; });
  }else{
    const opts = Array.isArray(q.options) ? q.options : [];
    optList.innerHTML = opts.map((t, i)=>{
      const val = String(i);
      const checked = String(chosen) === val;
      return `
        <label class="opt">
          <input type="radio" name="opt" value="${val}" ${checked?"checked":""} />
          <div>
            <div style="font-weight:800;">${String.fromCharCode(65+i)}.</div>
            <div class="small">${escapeHtml(t)}</div>
          </div>
        </label>
      `;
    }).join("");
    optList.querySelectorAll("input[type=radio]").forEach(r=>{
      r.addEventListener("change", ()=>{ answers[idx] = r.value; });
    });
  }

  $("prevBtn").onclick = ()=>{
    if(idx<=0) return;
    idx -= 1;
    renderQuestion();
  };
  $("nextBtn").onclick = ()=>{
    if(idx>=qs.length-1) return;
    idx += 1;
    renderQuestion();
  };
  $("submitBtn").onclick = submit;
}

function renderResult(res, extraText=""){
  setVisible("resultCard", true);
  setVisible("qCard", false);
  const total = res?.total ?? (test?.questions?.length||0);
  $("resultCard").innerHTML = `
    <div class="resultBox">
      <div style="font-size:22px; font-weight:900;">✅ Natija</div>
      <div class="small muted" style="margin-top:6px;">${escapeHtml(extraText || "Test yakunlandi")}</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <span class="pillMini">⭐ Ball: <b>${escapeHtml(res?.score ?? 0)}</b></span>
        <span class="pillMini">✅ To‘g‘ri: <b>${escapeHtml(res?.correct ?? 0)}</b></span>
        <span class="pillMini">❌ Xato: <b>${escapeHtml(res?.wrong ?? 0)}</b></span>
        <span class="pillMini">📌 Jami: <b>${escapeHtml(total)}</b></span>
      </div>
      <div class="navRow" style="margin-top:14px;">
        <button class="btn secondary" id="goApp" type="button"><i class="fa-solid fa-house"></i> App</button>
        <button class="btn" id="retry" type="button">🔁 Qayta ko‘rish</button>
      </div>
    </div>
  `;
  $("goApp").onclick = ()=> location.href = "app.html";
  $("retry").onclick = ()=> location.reload();
}

function showError(msg){
  setVisible("errorCard", true);
  $("errorCard").innerHTML = `
    <div class="errBox">
      <div style="font-size:18px; font-weight:900;">⚠️ Xatolik</div>
      <div class="small" style="margin-top:8px;">${escapeHtml(msg||"Noma'lum xatolik")}</div>
      <div class="navRow" style="margin-top:12px;">
        <button class="btn secondary" type="button" onclick="location.href='app.html'">App</button>
        <button class="btn" type="button" onclick="location.reload()">Qayta urinish</button>
      </div>
    </div>
  `;
}

async function submit(){
  try{
    stopTimer();
    const timeSpentSec = Math.max(0, Math.floor((Date.now() - startedAt)/1000));
    setVisible("loadingCard", true);
    $("loadingCard").innerHTML = `<div class="small muted">Yuborilmoqda…</div>`;

    if(source === "firebase"){
      const token = getToken();
      const res = await api("tests/submit", { method:"POST", token, body:{ id: test.id, answers, timeSpentSec } });
      // api returns { result: {score,...}, awarded?... }
      const r = res?.result || res;
      renderResult(r, res?.awarded ? `🏆 Ball qo‘shildi: +${res.awarded.points||0}` : "Test topshirildi");
    }else{
      const r = scoreLocal(test, answers);
      renderResult(r, "Local test (Firebase topilmadi)");
    }
  }catch(e){
    const msg = e?.message || e?.data?.error || "Yuborishda xato";
    showError(msg);
  }finally{
    setVisible("loadingCard", false);
  }
}

async function loadFirebaseTestByCode(code){
  // 1) resolve code -> { id, mode, requiresAccessCode?, title }
  const r = await api("tests/resolve", { query:{ code } });
  if(!r?.id) throw new Error("Test topilmadi");
  const id = r.id;
  // 2) get sanitized test
  const g = await api("tests/get", { query:{ id, code } });
  if(!g?.test) throw new Error("Testni yuklab bo‘lmadi");
  return g.test;
}

async function boot(){
  try{
    // buttons
    $("btnBack").onclick = ()=> history.length>1 ? history.back() : (location.href="app.html");
    $("btnLogout").onclick = async ()=>{ await logout(); location.href = "index.html"; };

    // auth
    const token = getToken();
    if(!token){
      location.href = "index.html";
      return;
    }
    user = await me();
    setHeader();

    code = getCodeFromUrl();
    if(!code){
      showError("Kod topilmadi. Linkni shunday oching: test.html?code=TEST_KOD");
      setVisible("loadingCard", false);
      return;
    }

    // Try Firebase first
    let t = null;
    try{
      t = await loadFirebaseTestByCode(code);
      source = "firebase";
    }catch(e){
      // fallback local
      const local = await loadLocalTest(code);
      if(!local) throw e;
      source = "local";
      t = normalizeLocal(local.raw, code);
    }

    test = t;
    answers = new Array((test.questions||[]).length).fill("");
    idx = 0;
    startedAt = Date.now();

    $("pageTitle").textContent = test.title || "Test";
    $("testTitle").textContent = test.title || "Test";
    setMeta();

    setVisible("loadingCard", false);
    setVisible("infoCard", true);
    setVisible("qCard", true);

    startTimer();
    renderQuestion();
  }catch(e){
    setVisible("loadingCard", false);
    showError(e?.message || "Xatolik");
  }
}

boot();

import { toast } from "./ui_toast.js";
import { getDb } from "./firebase.js";

const $ = (id)=>document.getElementById(id);

function qs(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function tsToMs(v){
  if(!v) return null;
  if(typeof v === "object" && typeof v.toMillis === "function") return v.toMillis();
  if(typeof v === "object" && typeof v.seconds === "number") return v.seconds * 1000;
  if(typeof v === "number") return v;
  if(typeof v === "string"){
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function fmtMMSS(sec){
  sec = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(sec/60)).padStart(2,"0");
  const ss = String(sec%60).padStart(2,"0");
  return `${mm}:${ss}`;
}

function openModal(id, open){
  const m = $(id);
  if(!m) return;
  m.setAttribute("aria-hidden", open?"false":"true");
  m.classList.toggle("open", !!open);
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function normalizeQuestions(raw){
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((q, idx)=>{
    const text = q?.text ?? q?.question ?? q?.q ?? `Savol ${idx+1}`;
    const img = q?.imageUrl ?? q?.img ?? q?.image ?? "";
    const options = Array.isArray(q?.options) ? q.options : Array.isArray(q?.variants) ? q.variants : [];
    const ans = q?.answer ?? q?.correct ?? q?.a;
    const score = Number(q?.score ?? q?.points ?? 1) || 1;
    return { text, img, options, ans, score };
  });
}

function isActive(now, startMs, endMs){
  if(startMs && now < startMs) return false;
  if(endMs && now > endMs) return false;
  return true;
}

export async function initChallengeRun(user){
  const challengeId = qs("id");
  if(!challengeId){
    toast("Challenge ID yo‘q", "info");
    location.href = "challenge.html";
    return;
  }

  // Elements
  const runTitle = $("runTitle");
  const runHint = $("runHint");
  const timeLeftEl = $("timeLeft");
  const timeMeta = $("timeMeta");
  const progressEl = $("progress");
  const scoreMeta = $("scoreMeta");
  const qTitle = $("qTitle");
  const qBody = $("qBody");
  const qImgWrap = $("qImgWrap");
  const qImg = $("qImg");
  const opts = $("options");
  const dots = $("dots");

  // Load challenge doc
  let test = null;
  try{
    runHint.textContent = "Firestore’dan yuklanmoqda…";
    const db = await getDb();
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const ref = doc(db, "tests", challengeId);
    const snap = await getDoc(ref);
    if(!snap.exists()) throw new Error("Bunday challenge topilmadi");
    test = snap.data();
  }catch(e){
    console.error(e);
    toast(e.message || "Yuklab bo‘lmadi");
    location.href = "challenge.html";
    return;
  }

  // Normalize
  const title = test?.title || test?.name || challengeId;
  runTitle.textContent = title;
  const startMs = tsToMs(test?.startAt || test?.startTime || test?.start);
  const endMs = tsToMs(test?.endAt || test?.endTime || test?.end);
  const perQ = Number(test?.perQuestionSeconds || test?.questionSeconds || test?.timePerQuestion || 0) || 0;
  const duration = Number(test?.durationSeconds || test?.duration || 0) || 0;
  const questions = normalizeQuestions(test?.questions);
  if(!questions.length){
    toast("Savollar topilmadi");
    location.href = "challenge.html";
    return;
  }

  // Active check
  const now = Date.now();
  if(!isActive(now, startMs, endMs)){
    toast("Challenge hozir faol emas", "info");
    location.href = "challenge.html";
    return;
  }

  // Attempt lock (one attempt per user+challenge)
  const loginId = user?.user?.loginId || user?.loginId || "";
  if(!loginId){
    toast("Foydalanuvchi topilmadi");
    location.href = "./";
    return;
  }
  const attemptId = `${loginId}__${challengeId}`;

  const db = await getDb();
  const fs = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  const resRef = fs.doc(db, "challenge_results", attemptId);
  const resSnap = await fs.getDoc(resRef);
  if(resSnap.exists()){
    // Already submitted
    const r = resSnap.data();
    showResult(r?.score ?? 0, r?.total ?? 0, r);
    return;
  }

  // State
  const answers = new Array(questions.length).fill(null);
  let idx = 0;
  let remaining = duration || (perQ ? perQ * questions.length : 20*60);
  let tick = null;

  // UI helpers
  function renderDots(){
    dots.innerHTML = "";
    for(let i=0;i<questions.length;i++){
      const b = document.createElement("button");
      b.className = "vertical-dot";
      b.type = "button";
      b.textContent = String(i+1);
      if(i===idx) b.classList.add("active");
      if(answers[i] !== null) b.classList.add("answered");
      b.addEventListener("click", ()=>{ idx=i; render(); });
      dots.appendChild(b);
    }
  }

  function render(){
    renderDots();
    const q = questions[idx];
    qTitle.textContent = `Savol ${idx+1} / ${questions.length}`;
    qBody.innerHTML = escapeHtml(q.text).replace(/\n/g,"<br>");
    if(q.img){
      qImgWrap.style.display = "block";
      qImg.src = q.img;
    }else{
      qImgWrap.style.display = "none";
      qImg.src = "";
    }

    opts.innerHTML = "";
    const selected = answers[idx];
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    (q.options.length ? q.options : ["A","B","C","D"]).forEach((opt, k)=>{
      const v = q.options.length ? opt : "";
      const label = q.options.length ? `${letters[k]}) ${opt}` : `${opt}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      btn.innerHTML = `<b style="margin-right:8px;">${letters[k]}</b> <span>${escapeHtml(String(v||label))}</span>`;
      if(selected === k || selected === opt) btn.classList.add("selected");
      btn.addEventListener("click", ()=>{
        answers[idx] = q.options.length ? k : opt;
        render();
      });
      opts.appendChild(btn);
    });

    // progress
    const answered = answers.filter(a=>a!==null).length;
    progressEl.textContent = `${answered}/${questions.length}`;
    scoreMeta.textContent = `Javoblangan: ${answered} ta`;

    // MathJax re-typeset
    try{ window.MathJax?.typesetPromise?.(); }catch(_){ }

    // buttons
    $("prevBtn").disabled = idx===0;
    $("nextBtn").textContent = idx===questions.length-1 ? "Tugatish" : "Keyingi →";
  }

  function updateTimer(){
    timeLeftEl.textContent = fmtMMSS(remaining);
    timeMeta.textContent = duration ? "Umumiy vaqt" : (perQ ? "Savollar bo‘yicha" : "Standart");
  }

  async function finish(){
    clearInterval(tick);
    tick = null;

    // score
    let score = 0;
    let total = 0;
    for(let i=0;i<questions.length;i++){
      const q = questions[i];
      total += q.score;
      const a = answers[i];
      if(a === null) continue;
      // if options array: a is index
      if(Array.isArray(test?.answers)){
        if(String(test.answers[i]).trim() === String(a).trim()) score += q.score;
      }else if(q.options.length){
        // compare with q.ans: could be index, letter, or text
        if(q.ans === undefined || q.ans === null) continue;
        const ansStr = String(q.ans).trim().toLowerCase();
        const letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[a] || "";
        const optText = String(q.options[a]||"").trim().toLowerCase();
        if(ansStr === String(a).toLowerCase() || ansStr === letter.toLowerCase() || ansStr === optText){
          score += q.score;
        }
      }else{
        if(String(q.ans).trim().toLowerCase() === String(a).trim().toLowerCase()) score += q.score;
      }
    }

    const payload = {
      challengeId,
      title,
      loginId,
      submittedAt: Date.now(),
      score,
      total,
      answers,
      durationSeconds: (duration || (perQ ? perQ * questions.length : 0)),
      remainingSeconds: remaining
    };

    try{
      await fs.setDoc(resRef, payload);
    }catch(e){
      console.warn("Result write failed", e);
    }

    showResult(score, total, payload);
  }

  function showResult(score, total, payload){
    $("resultScore").textContent = String(score);
    $("resultHint").textContent = `${title} • ${loginId}`;
    $("resultMeta").textContent = `Natija: ${score} / ${total}`;
    openModal("resultModal", true);
    $("resultClose")?.addEventListener("click", ()=> openModal("resultModal", false));
    $("resultModal")?.addEventListener("click", (e)=>{ if(e.target?.id==="resultModal") openModal("resultModal", false); });
  }

  // controls
  $("prevBtn").addEventListener("click", ()=>{ if(idx>0){ idx--; render(); } });
  $("nextBtn").addEventListener("click", ()=>{
    if(idx < questions.length-1){ idx++; render(); }
    else finish();
  });
  $("finishBtn").addEventListener("click", ()=> finish());

  // start timer
  updateTimer();
  render();
  runHint.textContent = "Faol";
  tick = setInterval(()=>{
    remaining -= 1;
    updateTimer();
    if(remaining <= 0){
      toast("Vaqt tugadi");
      finish();
    }
  }, 1000);
}

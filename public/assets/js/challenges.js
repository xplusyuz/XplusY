import { toast } from "./ui_toast.js";
import { getDb } from "./firebase.js";

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

function fmtHM(ms){
  if(ms === null) return "—";
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

function statusOf(now, startMs, endMs){
  if(startMs && now < startMs) return { key:"upcoming", label:`⏳ ${fmtHM(startMs)} da boshlanadi` };
  if(endMs && now > endMs) return { key:"ended", label:`✅ Yakunlangan (${fmtHM(endMs)})` };
  return { key:"active", label:"⚡ Faol" };
}

function makeCard(docId, data){
  const title = data?.title || data?.name || docId;
  const startMs = tsToMs(data?.startAt || data?.startTime || data?.start);
  const endMs = tsToMs(data?.endAt || data?.endTime || data?.end);
  const perQ = Number(data?.perQuestionSeconds || data?.questionSeconds || data?.timePerQuestion || 0) || 0;
  const duration = Number(data?.durationSeconds || data?.duration || 0) || 0;
  const qCount = Array.isArray(data?.questions) ? data.questions.length : (Number(data?.questionCount) || 0);

  const st = statusOf(Date.now(), startMs, endMs);
  const metaBits = [
    qCount ? `🧩 ${qCount} savol` : null,
    perQ ? `⏱️ ${perQ}s/savol` : null,
    duration ? `⏳ ${Math.round(duration/60)} daqiqa` : null,
    (startMs && endMs) ? `🕒 ${fmtHM(startMs)}–${fmtHM(endMs)}` : (startMs ? `🕒 ${fmtHM(startMs)}` : null),
  ].filter(Boolean);

  const disabled = st.key !== "active";
  return `
    <article class="featureCard ${disabled ? "soon" : ""}" data-id="${encodeURIComponent(docId)}" role="button" tabindex="0" aria-disabled="${disabled}">
      <div class="poster"><img alt="Challenge" src="assets/images/online_challenge.svg"></div>
      <div class="fOverlay"></div>
      <div class="fMeta">
        <div class="fText">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(st.label)}</p>
          <div class="small" style="margin-top:6px; opacity:.9;">
            ${metaBits.map(x=>`<span class="pill" style="margin-right:6px;">${escapeHtml(x)}</span>`).join("")}
          </div>
        </div>
        <div class="playBtn" style="opacity:${disabled ? 0.55 : 1};">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

export async function initChallengesPage(){
  const cardsEl = document.getElementById("challengeCards");
  const hintEl = document.getElementById("chHint");
  const searchEl = document.getElementById("chSearch");
  const onlyActiveBtn = document.getElementById("chOnlyActive");

  const state = { items: [], q: "", onlyActive: true };

  function render(){
    const q = state.q.trim().toLowerCase();
    const now = Date.now();
    const filtered = state.items.filter(({ id, data })=>{
      if(q){
        const t = String(data?.title || data?.name || "").toLowerCase();
        if(!id.toLowerCase().includes(q) && !t.includes(q)) return false;
      }
      if(!state.onlyActive) return true;
      const startMs = tsToMs(data?.startAt || data?.startTime || data?.start);
      const endMs = tsToMs(data?.endAt || data?.endTime || data?.end);
      const st = statusOf(now, startMs, endMs);
      return st.key === "active";
    });

    if(!filtered.length){
      cardsEl.innerHTML = `<div class="glass" style="padding:14px;border-radius:26px; grid-column: 1 / -1;">`+
        `<div class="nameLine">Topilmadi</div><div class="small" style="margin-top:6px;">`+
        `Filter yoki qidiruvni o‘zgartiring.</div></div>`;
      hintEl.textContent = "0 ta challenge";
      return;
    }
    cardsEl.innerHTML = filtered.map(x=>makeCard(x.id, x.data)).join("");
    hintEl.textContent = `${filtered.length} ta challenge`;
  }

  // Interactions
  searchEl?.addEventListener("input", (e)=>{ state.q = e.target.value || ""; render(); });
  onlyActiveBtn?.addEventListener("click", ()=>{
    state.onlyActive = !state.onlyActive;
    onlyActiveBtn.setAttribute("aria-pressed", String(state.onlyActive));
    onlyActiveBtn.classList.toggle("active", state.onlyActive);
    onlyActiveBtn.textContent = state.onlyActive ? "⚡ Faol" : "📦 Hammasi";
    render();
  });
  cardsEl?.addEventListener("click", (e)=>{
    const card = e.target.closest(".featureCard");
    if(!card) return;
    if(card.getAttribute("aria-disabled") === "true"){
      toast("Hali boshlanmagan yoki yakunlangan", "info");
      return;
    }
    const id = decodeURIComponent(card.getAttribute("data-id") || "");
    if(!id) return;
    location.href = `challenge_run.html?id=${encodeURIComponent(id)}`;
  });
  cardsEl?.addEventListener("keydown", (e)=>{
    if(e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".featureCard");
    if(card) card.click();
  });

  // Load Firestore
  try{
    hintEl.textContent = "Firestore’dan yuklanmoqda…";
    const db = await getDb();
    const { collection, getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const qy = query(collection(db, "tests"), orderBy("startAt", "desc"));
    const snap = await getDocs(qy);
    const list = [];
    snap.forEach((d)=> list.push({ id: d.id, data: d.data() }));
    state.items = list;
    hintEl.textContent = `${list.length} ta challenge`;
    render();
  }catch(e){
    console.error(e);
    hintEl.textContent = "Yuklab bo‘lmadi";
    cardsEl.innerHTML = `<div class="glass" style="padding:14px;border-radius:26px; grid-column: 1 / -1;">`+
      `<div class="nameLine">Xato</div>`+
      `<div class="small" style="margin-top:6px;">Firebase sozlamasini tekshiring: <code>assets/js/firebaseConfig.js</code></div>`+
      `</div>`;
  }
}

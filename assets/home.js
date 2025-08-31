import { db, collection, query, orderBy, limit, getDocs } from "./assets/firebase.js";
import { getCountFromServer } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function qs(s, r=document){ return r.querySelector(s) }
function qsa(s, r=document){ return Array.from(r.querySelectorAll(s)) }

// Quick counters
async function loadCounters(){
  try{
    const usersQ = query(collection(db, "users"));
    const usersCnt = await getCountFromServer(usersQ);
    const users = usersCnt.data().count || 0;
    const elUsers = qs("[data-kpi-users]");
    if(elUsers) elUsers.textContent = users.toLocaleString("uz-UZ");
  }catch(e){ console.warn("Counters:", e) }
}

// Top-5 preview
async function loadTopPreview(){
  try{
    const list = qs("#top5");
    if(!list) return;
    list.innerHTML = "";
    const qy = query(collection(db, "users"), orderBy("points","desc"), limit(5));
    const snap = await getDocs(qy);
    let i = 1;
    snap.forEach(doc => {
      const u = doc.data();
      const li = document.createElement("li");
      li.innerHTML = `<b>${i}.</b> ${u.displayName || "Anonim"} — ${(u.points||0).toLocaleString("uz-UZ")} ball`;
      list.appendChild(li);
      i++;
    });
  }catch(e){ console.error("Top5 failed", e); }
}

// Countdown for competitions
function tickCountdown(){
  qsa("[data-countdown]").forEach(card=>{
    const startISO = card.getAttribute("data-start");
    const endISO   = card.getAttribute("data-end");
    const now = Date.now();
    const start = startISO ? (new Date(startISO)).getTime() : null;
    const end   = endISO ? (new Date(endISO)).getTime() : null;
    let state = "Yakunlandi";
    let left = 0;
    if(start && now < start){ state = "Boshlanishiga"; left = start - now; }
    else if(end && now < end){ state = "Yakunigacha"; left = end - now; }
    else { state = "Yakunlandi"; left = 0; }

    const t = Math.max(0, Math.floor(left/1000));
    const hh = String(Math.floor(t/3600)).padStart(2,"0");
    const mm = String(Math.floor((t%3600)/60)).padStart(2,"0");
    const ss = String(t%60).padStart(2,"0");

    const badge = qs(".state-badge", card);
    const timer = qs(".countdown", card);
    if(badge) badge.textContent = state;
    if(timer) timer.textContent = `${hh}:${mm}:${ss}`;

    // Button states
    const buyBtn = qs("[data-buy]", card);
    const startBtn = qs("[data-start]", card);
    if(start && now < start){
      buyBtn && (buyBtn.disabled = false);
      startBtn && (startBtn.disabled = true);
    }else if(end && now < end){
      buyBtn && (buyBtn.disabled = true);
      startBtn && (startBtn.disabled = false);
    }else{
      buyBtn && (buyBtn.disabled = true);
      startBtn && (startBtn.disabled = true);
    }
  });
}

function wireSearch(){
  const field = qs("#searchInput");
  const go = ()=>{
    const q = field.value.trim();
    if(!q) return;
    // Placeholder: navigate to search (to-be-built)
    alert("Qidiruv: " + q + " (tez orada ishga tushadi)");
  };
  field?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") go(); });
  qs("#searchBtn")?.addEventListener("click", go);
}

// Boot
window.addEventListener("DOMContentLoaded", ()=>{
  loadCounters();
  loadTopPreview();
  wireSearch();
  tickCountdown();
  setInterval(tickCountdown, 1000);
});


// assets/js/ads.js — ads grid + countdown + 5-min early open
import { TESTS } from "./tests.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const tz = "Asia/Tashkent";
function fmtDate(d){
  try{
    return new Date(d).toLocaleString('uz-UZ', { timeZone: tz, year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }catch{ return d; }
}
function hms(ms){
  if(ms<=0) return "00:00:00";
  const s = Math.floor(ms/1000);
  const days = Math.floor(s/86400);
  const hh = String(Math.floor((s%86400)/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return (days>0? (days+'d '):'') + `${hh}:${mm}:${ss}`;
}
export function renderAdsGrid(){
  const el = $("#ads-grid");
  if(!el) return;
  const cardHTML = (t)=>{
    const start = new Date(t.startAt).getTime();
    const openAt = start - 5*60*1000;
    const grades = (t.grades||[]).map(g=>`<span class="pill">${g}</span>`).join(" ");
    const tags = (t.tags||[]).map(x=>`<span class="chip">${x}</span>`).join(" ");
    const when = fmtDate(t.startAt);
    return `
    <article class="ad-card" data-id="${t.id}" data-start="${start}" data-open="${openAt}">
      <div class="ad-head">
        <div class="ad-title">${t.title}</div>
        <div class="ad-meta"><span>📅 ${when}</span> <span>🎁 ${t.prize||""}</span></div>
      </div>
      <div class="ad-body">
        <div class="ad-grades">${grades}</div>
        <div class="ad-tags">${tags}</div>
        <div class="ad-timer" data-role="timer">⏳ —:—:—</div>
      </div>
      <div class="ad-actions" style="display:flex; gap:8px; justify-content:flex-end">
        <a class="btn btn-ghost" href="${t.detailUrl||'#'}">Batafsil</a>
        <a class="btn btn-primary hidden" data-role="start" href="${t.startUrl||'#'}">Boshlash</a>
      </div>
    </article>`;
  };
  el.innerHTML = `<div class="ads-grid">${TESTS.map(cardHTML).join("")}</div>`;
  startTicker();
}
function startTicker(){
  const tick = ()=>{
    const now = Date.now();
    $$(".ad-card").forEach(card=>{
      const start = Number(card.getAttribute("data-start"));
      const open = Number(card.getAttribute("data-open"));
      const timer = $('[data-role="timer"]', card);
      const startBtn = $('[data-role="start"]', card);
      if(!timer || !startBtn) return;

      card.classList.remove("open","soon","ended");
      if(now < open){
        const left = open - now;
        timer.textContent = "⏳ " + hms(left);
        startBtn.classList.add("hidden");
        if(left <= 5*60*1000) card.classList.add("soon");
      }else{
        timer.textContent = "✅ Boshlash ochiq";
        startBtn.classList.remove("hidden");
        startBtn.classList.add("pulse");
        card.classList.add("open");
      }
      const end = start + 2*60*60*1000;
      if(now > end){
        timer.textContent = "🏁 Yakunlandi";
        startBtn.textContent = "Natijalar";
        startBtn.classList.remove("pulse");
        card.classList.add("ended");
      }
    });
  };
  tick();
  window.__adsTicker && clearInterval(window.__adsTicker);
  window.__adsTicker = setInterval(tick, 1000);
}
// autorun (only if #ads-grid exists)
document.addEventListener("DOMContentLoaded", ()=>{
  const el = document.querySelector("#ads-grid");
  if(el){ try{ renderAdsGrid(); }catch{} }
});

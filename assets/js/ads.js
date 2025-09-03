
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
  return (days>0? (days+"d "):"") + `${hh}:${mm}:${ss}`;
}
function cardHTML(t){
  const id = t.id;
  const start = new Date(t.startAt).getTime();
  const openAt = start - 5*60*1000; // 5 daqiqa oldin ochiladi
  const grades = (t.grades||[]).map(g=>`<span class="pill">${g}</span>`).join(" ");
  const tags = (t.tags||[]).map(x=>`<span class="chip">${x}</span>`).join(" ");
  const when = fmtDate(t.startAt);
  return `
  <article class="ad-card" data-id="${id}" data-start="${start}" data-open="${openAt}">
    <div class="ad-head">
      <div class="ad-title">${t.title}</div>
      <div class="ad-meta">
        <span class="ad-when">📅 ${when}</span>
        <span class="ad-prize">🎁 ${t.prize||""}</span>
      </div>
    </div>
    <div class="ad-body">
      <div class="ad-grades">${grades}</div>
      <div class="ad-tags">${tags}</div>
      <div class="ad-timer" data-role="timer">⏳ —:—:—</div>
    </div>
    <div class="ad-actions">
      <a class="btn btn-ghost" href="${t.detailUrl||'#'}">Batafsil</a>
      <a class="btn btn-primary hidden" data-role="start" href="${t.startUrl||'#'}">Boshlash</a>
    </div>
  </article>`;
}
export function renderAdsGrid(){
  const el = $("#ads-grid");
  if(!el) return;
  el.innerHTML = `<div class="ads-grid">${TESTS.map(cardHTML).join("")}</div>`;
  startTicker();
}
function startTicker(){
  const tick = ()=>{
    const now = (window.__serverOffsetMs ? Date.now() + window.__serverOffsetMs : Date.now());
    $$(".ad-card").forEach(card=>{
      const start = Number(card.getAttribute("data-start"));
      const open = Number(card.getAttribute("data-open"));
      const timer = $('[data-role="timer"]', card);
      const startBtn = $('[data-role="start"]', card);
      if(!timer || !startBtn) return;

      card.classList.remove("open","soon","ended");

      if(now < open){
        // hali ochilmagan — openAtgacha sanaymiz
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

      // tugash vaqti: start + 2 soat (demo)
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
      // agar voqea allaqachon bitgan bo'lsa (start + 2 soat deb faraz qilamiz), yakunlangan deb ko'rsatsak bo'ladi
      const end = start + 2*60*60*1000;
      if(now > end){
        timer.textContent = "🏁 Yakunlandi";
        startBtn.textContent = "Natijalar";
      }
    });
  };
  tick();
  window.__adsTicker && clearInterval(window.__adsTicker);
  window.__adsTicker = setInterval(tick, 1000);
}
document.addEventListener("DOMContentLoaded", renderAdsGrid);


// Try to reduce client clock drift using 'Date' response header
async function syncServerTime(){
  try{
    const r = await fetch(location.href, { method: 'HEAD', cache: 'no-store' });
    const srv = r.headers.get('Date');
    if(srv){
      const serverNow = new Date(srv).getTime();
      const offset = serverNow - Date.now();
      // use only if plausible (within +/- 5 minutes)
      if(Math.abs(offset) < 5*60*1000){ window.__serverOffsetMs = offset; }
    }
  }catch{}
}
syncServerTime();

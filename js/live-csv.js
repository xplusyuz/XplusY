import { fetchCSV, byDate } from "./csv-util.js";
const grid = document.getElementById("liveGrid");
if(grid){
  (async()=>{
    try{
      const rows = await fetchCSV(grid.dataset.csv || "./csv/live.csv");
      rows.sort((a,b)=> byDate(a,b,"startISO"));
      grid.classList.add("grid","cards");
      grid.innerHTML = rows.map(r => liveCard(r)).join("");
      initTimers();
    }catch(e){
      grid.innerHTML = `<div class="card"><b>Live CSV xatosi:</b> ${e.message}</div>`;
    }
  })();
}
function liveCard(r){
  const start = Date.parse(r.startISO||"");
  const end = isFinite(start) ? start + (parseInt(r.durationMin||"0")*60000) : 0;
  return `<article class="card live-card" data-start="${start||0}" data-end="${end||0}">
    ${r.image ? `<img src="${r.image}" alt="${esc(r.title||'')}" />` : ''}
    <div class="lc-title">${esc(r.title||'')}</div>
    <div class="lc-meta">
      <span class="kv">📅 ${esc((r.startISO||'').replace('T',' '))}</span>
      <span class="kv">⏱️ ${esc(r.durationMin||'0')} daqiqa</span>
    </div>
    <div class="lc-tags">
      ${r.prize ? `<span class="tag prize">🎁 ${esc(r.prize)}</span>` : ''}
      ${r.price ? `<span class="tag price">💳 ${esc(r.price)} so‘m</span>` : ''}
      ${r.tags ? r.tags.split('|').map(t=>`<span class="tag">${esc(t)}</span>`).join('') : ''}
    </div>
    <div class="lc-cta">
      <button class="btn primary">Batafsil</button>
      <span class="pill timer" data-timer>—:—:—</span>
    </div>
  </article>`;
}
function initTimers(){
  const els = Array.from(document.querySelectorAll('[data-timer]'));
  function tick(){
    const now = Date.now();
    els.forEach(el=>{
      const host = el.closest('.live-card');
      if(!host) return;
      const start = parseInt(host.dataset.start||"0");
      const end   = parseInt(host.dataset.end||"0");
      let txt = "—";
      if(start && now < start){
        txt = "Boshlanishga: " + fmt(start-now);
      } else if(end && now <= end){
        txt = "Tugashga: " + fmt(end-now);
      } else if(end && now > end){
        txt = "Yakunlandi";
      }
      el.textContent = txt;
    });
  }
  function fmt(ms){
    const s = Math.max(0, Math.floor(ms/1000));
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
    return [h,m,ss].map(v=>String(v).padStart(2,'0')).join(':');
  }
  tick();
  setInterval(tick, 1000);
}
function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

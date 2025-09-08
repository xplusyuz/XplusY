import { fetchCSV } from "./csv-util.js";
const wrap = document.getElementById("lb");
if(wrap){
  (async()=>{
    try{
      const rows = await fetchCSV("./csv/leaderboard.csv");
      rows.sort((a,b)=> (parseInt(a.rank||"0")||9999) - (parseInt(b.rank||"0")||9999));
      wrap.innerHTML = rows.map(r=> row(r)).join("");
      wrap.classList.add("grid");
      wrap.style.gridTemplateColumns = "1fr";
    }catch(e){
      wrap.innerHTML = `<div class="card"><b>Reyting CSV xatosi:</b> ${e.message}</div>`;
    }
  })();
}
function row(r){
  return `<article class="card" style="display:flex;align-items:center;gap:12px">
    <div class="pill" style="min-width:48px;text-align:center;font-weight:800">${esc(r.rank||'')}</div>
    ${r.avatar ? `<img src="${r.avatar}" alt="" style="width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.12)">` : ''}
    <div style="flex:1">
      <div style="font-weight:800">${esc(r.name||'Anonim')}</div>
      <div class="sub">ID: ${esc(r.numericId||'—')}</div>
    </div>
    <div class="pill">💎 ${esc(r.gems||'0')}</div>
  </article>`;
}
function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

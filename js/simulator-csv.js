import { fetchCSV, uniqueValues } from "./csv-util.js";
const wrap = document.getElementById("simGrid");
const secSel = document.getElementById("fSec");
if(wrap){
  (async()=>{
    try{
      const rows = await fetchCSV(wrap.dataset.csv || "./csv/simulator.csv");
      if(secSel){
        const vals = uniqueValues(rows,'section');
        secSel.innerHTML = `<option value="">Hammasi</option>` + vals.map(v=>`<option>${esc(v)}</option>`).join("");
        secSel.addEventListener('change', ()=> render());
      }
      function render(){
        const v = secSel?.value || "";
        const list = v ? rows.filter(r=>r.section===v) : rows;
        wrap.classList.add("grid","cards");
        wrap.innerHTML = list.map(r=> card(r)).join("");
      }
      render();
    }catch(e){
      wrap.innerHTML = `<div class="card"><b>Simulator CSV xatosi:</b> ${e.message}</div>`;
    }
  })();
}
function card(r){
  return `<article class="card">
    ${r.image ? `<img src="${r.image}" alt="${esc(r.title||'')}" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);aspect-ratio:16/9;object-fit:cover;margin-bottom:8px">` : ''}
    <h3 style="margin:6px 0 4px">${esc(r.title||'')}</h3>
    <p class="sub">${esc(r.desc||'')}</p>
    <div style="margin-top:8px"><button class="btn">Ochish</button></div>
  </article>`;
}
function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

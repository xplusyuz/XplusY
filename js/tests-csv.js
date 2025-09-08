import { fetchCSV, uniqueValues } from "./csv-util.js";
const grid = document.getElementById("testsSections");
if(grid){
  (async()=>{
    try{
      const rows = await fetchCSV(grid.dataset.csv || "./csv/tests.csv");
      const planSel = document.getElementById("fPlan");
      const secSel  = document.getElementById("fSec");
      const f1Sel   = document.getElementById("f1");
      const f2Sel   = document.getElementById("f2");
      fillSelect(planSel, uniqueValues(rows,'plan'));
      fillSelect(secSel,  uniqueValues(rows,'section'));
      fillSelect(f1Sel,   uniqueValues(rows,'f1'));
      fillSelect(f2Sel,   uniqueValues(rows,'f2'));
      ;[planSel,secSel,f1Sel,f2Sel].forEach(sel => {
        if(!sel) return; const opt = document.createElement('option');
        opt.value = ""; opt.textContent = "Hammasi"; sel.insertBefore(opt, sel.firstChild); sel.value = "";
      });
      function apply(){
        const f = { plan: planSel?.value||"", section: secSel?.value||"", f1: f1Sel?.value||"", f2: f2Sel?.value||"" };
        const filtered = rows.filter(r =>
          (!f.plan || r.plan===f.plan) && (!f.section || r.section===f.section) &&
          (!f.f1 || r.f1===f.f1) && (!f.f2 || r.f2===f.f2)
        );
        render(filtered);
      }
      ;[planSel,secSel,f1Sel,f2Sel].forEach(sel=> sel?.addEventListener('change', apply));
      render(rows);
      function render(list){
        if(list.length===0){ grid.innerHTML = `<div class="card"><b>Hech narsa topilmadi.</b></div>`; return; }
        grid.classList.add("grid","cards");
        grid.innerHTML = list.map(item => testCard(item)).join("");
      }
    }catch(e){
      grid.innerHTML = `<div class="card"><b>Test CSV xatosi:</b> ${e.message}</div>`;
    }
  })();
}
function testCard(r){
  return `<article class="card">
    ${r.image ? `<img src="${r.image}" alt="${esc(r.title||'')}" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);aspect-ratio:16/9;object-fit:cover;margin-bottom:8px">` : ''}
    <h3 style="margin:6px 0 4px">${esc(r.title||'')}</h3>
    <p class="sub">${esc(r.desc||'')}</p>
    <div style="display:flex; gap:8px; margin-top:8px">
      <button class="btn primary" data-test-id="${esc(r.id||'')}">Boshlash</button>
      ${r.plan ? `<span class="pill">${esc(r.plan)}</span>` : ''}
      ${r.section ? `<span class="pill">${esc(r.section)}</span>` : ''}
    </div>
  </article>`;
}
function fillSelect(sel, values){
  if(!sel) return;
  sel.innerHTML = values.map(v=> `<option value="${esc(v)}">${esc(v)}</option>`).join("");
}
function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

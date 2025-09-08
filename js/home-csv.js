import { fetchCSV } from "./csv-util.js";
const wrap = document.getElementById("homeGrid");
if(wrap){
  (async()=>{
    try{
      const rows = await fetchCSV(wrap.dataset.csv || "./csv/home.csv");
      wrap.classList.add("grid","cards");
      wrap.innerHTML = rows.map(r => card(r)).join("");
    }catch(e){
      wrap.innerHTML = `<div class="card"><b>Uy CSV xatosi:</b> ${e.message}</div>`;
    }
  })();
}
function card(r){
  const href = r.href && r.href.startsWith('#') ? r.href : '#tests';
  return `<article class="card">
    ${r.image ? `<img src="${r.image}" alt="${escapeHtml(r.title||'Banner')}" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);aspect-ratio:16/9;object-fit:cover;margin-bottom:8px">` : ''}
    <h3 style="margin:6px 0 4px">${escapeHtml(r.title||'')}</h3>
    <p class="sub">${escapeHtml(r.desc||'')}</p>
    <div style="margin-top:8px"><a class="btn primary" href="${href}">Ochish</a></div>
  </article>`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

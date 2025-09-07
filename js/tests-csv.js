
// Testlar (CSV → cards only): bo'lim + filterlar, "Ixtiyoriy" placeholders (no "Hammasi")
const host = document.querySelector('#testsSections');
const csvPath = host?.dataset?.csv || './tests.csv';

(async function init(){
  const text = await fetchCSV(csvPath);
  if(!text){ host.innerHTML = `<div class="card">tests.csv topilmadi.</div>`; return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  if(!data.length){ host.innerHTML = `<div class="card">CSV bo‘sh.</div>`; return; }
  setupUI(data);
  render(data);
})();

function setupUI(data){
  const sSec = document.querySelector('#fSec');
  const sF1 = document.querySelector('#f1');
  const sF2 = document.querySelector('#f2');
  const fieldF1 = document.querySelector('#fieldF1');
  const fieldF2 = document.querySelector('#fieldF2');

  // Build sections with "Ixtiyoriy" first (empty value)
  const sections = uniq(data.map(x => (x.section||'').trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
  sSec.innerHTML = `<option value="">Ixtiyoriy</option>` + sections.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sSec.value = ""; // default: Ixtiyoriy (no specific section)

  // Initially hide filters until a section is chosen
  fieldF1.style.display = 'none';
  fieldF2.style.display = 'none';

  function rebuildFilters(){
    const curSec = sSec.value;
    if(!curSec){
      // No section chosen => hide filters
      sF1.innerHTML = ''; sF2.innerHTML = '';
      fieldF1.style.display = 'none'; fieldF2.style.display = 'none';
      return;
    }
    const pool = data.filter(x => x.section === curSec);
    const f1vals = uniq(pool.map(x => (x.filter1||'').trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
    const f2vals = uniq(pool.map(x => (x.filter2||'').trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
    if (f1vals.length){
      sF1.innerHTML = `<option value="">Ixtiyoriy</option>` + f1vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      sF1.value = "";
      fieldF1.style.display = '';
    } else {
      sF1.innerHTML=''; fieldF1.style.display='none';
    }
    if (f2vals.length){
      sF2.innerHTML = `<option value="">Ixtiyoriy</option>` + f2vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      sF2.value = "";
      fieldF2.style.display = '';
    } else {
      sF2.innerHTML=''; fieldF2.style.display='none';
    }
  }

  rebuildFilters();

  sSec.addEventListener('change', ()=>{ rebuildFilters(); render(data); });
  sF1.addEventListener('change', ()=> render(data));
  sF2.addEventListener('change', ()=> render(data));
}

function render(data){
  const sSec = document.querySelector('#fSec');
  const sF1 = document.querySelector('#f1');
  const sF2 = document.querySelector('#f2');
  const curSec = sSec?.value || '';
  const v1 = sF1?.value || '';
  const v2 = sF2?.value || '';

  // If no section selected (Ixtiyoriy) -> do NOT render all; show placeholder
  if (!curSec){
    host.innerHTML = `<section class="card"><div class="sub">Bo‘limni tanlang — shu bo‘limdagi testlar kartalari ko‘rinadi.</div></section>`;
    return;
  }

  const filtered = data.filter(r=>{
    if (r.section !== curSec) return false;
    if (v1 && r.filter1 !== v1 && r.filter2 !== v1) return false;
    if (v2 && r.filter1 !== v2 && r.filter2 !== v2) return false;
    return true;
  });

  renderSections(filtered, curSec);
}


function renderSections(items, curSec){
  host.innerHTML = '';
  // Only render the selected section
  host.appendChild(sectionBlock(curSec, items));
}


function sectionBlock(sec, list){
  const wrap = document.createElement('section');
  wrap.className = 'card';
  wrap.innerHTML = `<h2 style="margin:.2rem 0 8px">${esc(sec)}</h2><div class="grid cards"></div>`;
  const grid = wrap.querySelector('.grid');
  list.forEach(r => grid.appendChild(card(r)));
  return wrap;
}

function card(r){
  const div = document.createElement('div'); div.className = 'card';
  const action = (r.href) ? `<a class="btn primary" href="${r.href}">${esc(r.btn || 'Ochish')}</a>` : '';
  div.innerHTML = `
    ${r.img ? `<img src="${r.img}" alt="${esc(r.title)}" loading="lazy" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px;aspect-ratio:16/9;object-fit:cover">` : ''}
    ${r.title ? `<h3 style="margin:.2rem 0">${esc(r.title)}</h3>` : ''}
    ${r.meta ? `<p class="sub">${esc(r.meta)}</p>` : ''}
    ${action}
  `;
  return div;
}

/* CSV helpers */
function uniq(arr){ return Array.from(new Set(arr)); }
async function fetchCSV(path){
  const tries=[path,'./tests.csv','/tests.csv'];
  for(const p of tries){ try{ const r=await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch(_){ } }
  return null;
}
function detectDelim(line){
  const cand=['|',',',';','\t']; const counts=cand.map(d=>(line.split(d).length-1));
  const max=Math.max(...counts); return max>0? cand[counts.indexOf(max)] : '|';
}
function parseCSV(text){
  const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  let first=''; for(const ln of lines){ const t=ln.trim(); if(t){ first=ln; break; } }
  const delim=detectDelim(first || "Img url|Title|Meta|tugma nomi|tugma linki|bo'lim|filter1|filter2");
  const rows=[]; let row=[], field='', q=false;
  function push(){ let v=field; if(v.startsWith('"')&&v.endsWith('"')) v=v.slice(1,-1).replace(/""/g,'"'); row.push(v.trim()); field=''; }
  for(let i=0;i<text.length;i++){
    const ch=text[i], nx=text[i+1];
    if(ch=='"'){ if(q&&nx=='"'){ field+='"'; i++; } else { q=!q; } continue; }
    if(ch=='\n'&&!q){ push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row); row=[]; continue; }
    if(ch==delim&&!q){ push(); continue; }
    field+=ch;
  }
  push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row);
  return rows;
}
function normalize(rows){
  if(!rows.length) return [];
  const hdr=rows[0].map(s=>s.toLowerCase());
  const hasHdr = hdr[0]?.includes('img') && hdr[1]?.includes('title');
  const start = hasHdr ? 1 : 0;
  const out=[];
  for(let i=start;i<rows.length;i++){
    const r=rows[i]; if(r.length<8) continue;
    const [img,title,meta,btn,href,section,f1,f2] = r;
    out.push({
      img:img||'', title:title||'', meta:meta||'',
      btn:btn||'Ochish', href:href||'#',
      section:section||'Boshqa',
      filter1:f1||'', filter2:f2||''
    });
  }
  return out;
}
function esc(s){ return String(s||'').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

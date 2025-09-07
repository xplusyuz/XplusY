// Excel-style CSV → Grid + Table
// Expected columns (header row): Img url, Title, Meta, tugma nomi, tugma linki

const grid = document.querySelector('#homeGrid');
const table = document.querySelector('#homeTable');
const CSV_PATH = grid?.dataset?.csv || './home.csv';

(async function init(){
  const text = await fetchCSV(CSV_PATH);
  if(!text){ renderFallback(); return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  if(!data.length){ renderFallback(); return; }
  renderGrid(data);
  renderTable(data);
})();

async function fetchCSV(path){
  const tries = [path, './home.csv', '/home.csv'];
  for(const p of tries){
    try{ const r = await fetch(p, { cache:'no-cache' }); if(r.ok) return await r.text(); }catch(_){}
  }
  return null;
}

function detectDelim(line){
  // Excel exports: often comma or semicolon (locale). Also support tab / pipe.
  const cand = [',',';','\t','|'];
  const counts = cand.map(d => (line.split(d).length - 1));
  const max = Math.max(...counts);
  return max>0 ? cand[counts.indexOf(max)] : ',';
}

function parseCSV(text){
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  // find the first non-empty line to detect delimiter
  let first = '';
  for(const ln of lines){ const t=ln.trim(); if(t){ first=ln; break; } }
  const delim = detectDelim(first || 'Img url,Title,Meta,tugma nomi,tugma linki');

  const rows=[]; let row=[], field='', q=false;
  function push(){ let v=field; if(v.startsWith('"') && v.endsWith('"')) v=v.slice(1,-1).replace(/""/g,'"'); row.push(v.trim()); field=''; }
  for(let i=0;i<text.length;i++){
    const ch=text[i], nx=text[i+1];
    if(ch === '"'){ if(q && nx === '"'){ field+='"'; i++; } else { q=!q; } continue; }
    if(ch === '\n' && !q){ push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row); row=[]; continue; }
    if(ch === delim && !q){ push(); continue; }
    field += ch;
  }
  push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row);
  return rows;
}

function normalize(rows){
  if(!rows.length) return [];
  const hdr = rows[0].map(s=>s.toLowerCase());
  const hasHdr = hdr[0]?.includes('img') && hdr[1]?.includes('title');
  const start = hasHdr ? 1 : 0;
  const out=[];
  for(let i=start;i<rows.length;i++){
    const r = rows[i];
    if(r.length < 5) continue;
    const [img, title, meta, btn, href] = r;
    if([img,title,meta,btn,href].every(v => !String(v||'').trim())) continue;
    out.push({ img:img||'', title:title||'', meta:meta||'', btn:btn||'', href:href||'' });
  }
  return out;
}

function renderGrid(items){
  grid.innerHTML='';
  for(const r of items){
    const div=document.createElement('div');
    div.className='card';
    div.innerHTML = `
      ${r.img ? `<img src="${r.img}" alt="${esc(r.title)}" loading="lazy" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px;aspect-ratio:16/9;object-fit:cover">` : ''}
      ${r.title ? `<h2 style="margin:.2rem 0">${esc(r.title)}</h2>` : ''}
      ${r.meta ? `<p class="sub">${esc(r.meta)}</p>` : ''}
      ${r.btn ? `<a class="btn primary" href="${r.href||'#'}">${esc(r.btn)}</a>` : ''}
    `;
    grid.appendChild(div);
  }
}

function renderTable(items){
  table.innerHTML = `<thead><tr>
    <th>#</th><th>Img</th><th>Title</th><th>Meta</th><th>Tugma nomi</th><th>Tugma linki</th>
  </tr></thead><tbody></tbody>`;
  const tb = table.querySelector('tbody');
  items.forEach((r,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${r.img ? `<img src="${r.img}" alt="img">` : ''}</td>
      <td>${esc(r.title)}</td>
      <td>${esc(r.meta)}</td>
      <td>${esc(r.btn)}</td>
      <td><a href="${r.href||'#'}">${esc(r.href)}</a></td>
    `;
    tb.appendChild(tr);
  });
}

function renderFallback(){
  grid.innerHTML = `
    <div class="card"><h2>Misol karta</h2><p class="sub">home.csv faylini to‘ldiring.</p></div>
  `;
  table.innerHTML = `<thead><tr>
    <th>#</th><th>Img</th><th>Title</th><th>Meta</th><th>Tugma nomi</th><th>Tugma linki</th>
  </tr></thead><tbody></tbody>`;
}

function esc(s){ return String(s||'').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

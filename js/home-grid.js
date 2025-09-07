// Single CSV → Grid + Table (pipe-first).
// Expected columns: Img url | Title | Meta | tugma nomi | tugma linki
const CSV_PATH = document.querySelector('#homeGrid')?.dataset?.csv || './home.csv';

// view toggle
const gridEl = document.querySelector('#homeGrid');
const tableWrap = document.querySelector('#homeTableWrap');
const tableEl = document.querySelector('#homeTable');
document.querySelector('#btnViewGrid')?.addEventListener('click', ()=> setView('grid'));
document.querySelector('#btnViewTable')?.addEventListener('click', ()=> setView('table'));
function setView(v){
  const gBtn = document.querySelector('#btnViewGrid');
  const tBtn = document.querySelector('#btnViewTable');
  if(v==='grid'){
    gridEl?.classList.remove('hidden');
    tableWrap?.classList.add('hidden');
    gBtn?.classList.add('active'); tBtn?.classList.remove('active');
  }else{
    gridEl?.classList.add('hidden');
    tableWrap?.classList.remove('hidden');
    tBtn?.classList.add('active'); gBtn?.classList.remove('active');
  }
}

(async function load(){
  const text = await fetchText(CSV_PATH);
  if(!text){ renderFallback(); return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  if(!data.length){ renderFallback(); return; }
  renderGrid(data);
  renderTable(data);
})();

async function fetchText(path){
  const tries = [path, './home.csv', '/home.csv'];
  for(const p of tries){
    try{ const r = await fetch(p, {cache:'no-cache'}); if(r.ok) return await r.text(); }catch(_){}
  }
  return null;
}

function detectDelim(line){
  // prefer pipe; else choose max count among candidates
  const cand = ['|', ',', ';', '\t'];
  const counts = cand.map(d => (line.split(d).length - 1));
  const maxIdx = counts.indexOf(Math.max(...counts));
  return counts[maxIdx] > 0 ? cand[maxIdx] : '|';
}

function parseCSV(text){
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  // find first non-empty line for detection
  let first = 'Img url|Title|Meta|tugma nomi|tugma linki';
  for(const ln of lines){ const t=ln.trim(); if(t){ first=ln; break; } }
  const delim = detectDelim(first);
  const rows = [];
  let row = [], field = '', q=false;
  function push(){ 
    let v = field;
    if(v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1).replace(/""/g,'"');
    row.push(v.trim()); field='';
  }
  for(let i=0;i<text.length;i++){
    const ch=text[i], nx=text[i+1];
    if(ch === '"'){ if(q && nx === '"'){ field+='"'; i++; } else { q=!q; } continue; }
    if(ch === '\n' && !q){ push(); if(row.some(s=>s.trim()!=='') && !row[0].trim().startsWith('#')) rows.push(row); row=[]; continue; }
    if(ch === delim && !q){ push(); continue; }
    field += ch;
  }
  push(); if(row.some(s=>s.trim()!=='') && !row[0].trim().startsWith('#')) rows.push(row);
  return rows;
}

function normalize(rows){
  if(!rows.length) return [];
  const hdr = rows[0].map(s=>s.toLowerCase());
  const isHdr = hdr[0]?.includes('img') && hdr[1]?.includes('title');
  const start = isHdr ? 1 : 0;
  const out = [];
  for(let i=start;i<rows.length;i++){
    const r = rows[i];
    if(r.length < 5) continue;
    const [img, title, meta, btn, href] = r;
    if([img,title,meta,btn,href].every(x => !String(x||'').trim())) continue;
    out.push({ img:img||'', title:title||'', meta:meta||'', btn:btn||'', href:href||'' });
  }
  return out;
}

function renderGrid(items){
  if(!gridEl) return;
  gridEl.innerHTML='';
  for(const r of items){
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `
      ${r.img ? `<img src="${r.img}" alt="${esc(r.title||'Card')}" loading="lazy" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px;aspect-ratio:16/9;object-fit:cover" />` : ''}
      ${r.title ? `<h2>${esc(r.title)}</h2>` : ''}
      ${r.meta ? `<p class="sub">${esc(r.meta)}</p>` : ''}
      ${r.btn ? `<a class="btn primary" href="${r.href||'#'}">${esc(r.btn)}</a>` : ''}
    `;
    gridEl.appendChild(card);
  }
}

function renderTable(items){
  if(!tableEl) return;
  const thead = `<thead><tr><th>#</th><th>Img</th><th>Title</th><th>Meta</th><th>Tugma nomi</th><th>Tugma linki</th></tr></thead>`;
  const rows = items.map((r, i)=>{
    const imgCell = r.img ? `<img src="${r.img}" alt="img">` : '';
    return `<tr>
      <td>${i+1}</td>
      <td>${imgCell}</td>
      <td>${esc(r.title)}</td>
      <td>${esc(r.meta)}</td>
      <td>${esc(r.btn)}</td>
      <td><a href="${r.href||'#'}">${esc(r.href)}</a></td>
    </tr>`;
  }).join('');
  tableEl.innerHTML = thead + '<tbody>' + rows + '</tbody>';
}

function renderFallback(){
  if(gridEl){
    gridEl.innerHTML = `
      <div class="card"><h2>📝 Testlar</h2><p class="sub">Oson / O‘rta / Qiyin — 10 ta savol</p><a class="btn primary" href="./tests.html">Boshlash</a></div>
      <div class="card"><h2>🎮 Live</h2><p class="sub">Pre-join, start lock, jonli reyting</p><a class="btn primary" href="./live.html">Kirish</a></div>
      <div class="card"><h2>🏅 Reyting</h2><p class="sub">Top 100 olmos</p><a class="btn primary" href="./leaderboard.html">Ko‘rish</a></div>
      <div class="card"><h2>⚙️ Sozlamalar</h2><p class="sub">Profil, natijalar, balans, promo va admin</p><a class="btn primary" href="./settings.html">Ochish</a></div>
    `;
  }
  if(tableEl){
    tableEl.innerHTML = `<thead><tr><th>#</th><th>Img</th><th>Title</th><th>Meta</th><th>Tugma nomi</th><th>Tugma linki</th></tr></thead><tbody></tbody>`;
  }
}

function esc(s){ return String(s||'').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#39;'}[c])); }

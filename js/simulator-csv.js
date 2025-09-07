// Simulyatorlar — CSV → grid (only O‘ynash), sections, pagination (12)
const host = document.querySelector('#simGrid');
const csvPath = host?.dataset?.csv || './simulator.csv';

let PAGE_SIZE = 12;
let visibleCount = PAGE_SIZE;
const state = { section: '*' };

(async function init(){
  const text = await fetchCSV(csvPath);
  if(!text){ host.innerHTML = `<section class="card"><div class="sub">simulator.csv topilmadi.</div></section>`; return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  if(!data.length){ host.innerHTML = `<section class="card"><div class="sub">CSV bo‘sh.</div></section>`; return; }
  window.__simData = data;
  setupUI(data);
  renderData(data);
})();

function setupUI(data){
  const sSec = document.querySelector('#fSec');
  const sections = uniq(data.map(x => (x.section||'').trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
  sSec.innerHTML = `<option value="*">Hammasi</option>` + sections.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sSec.value='*'; state.section='*'; visibleCount = PAGE_SIZE;
  sSec.addEventListener('change', ()=>{
    state.section = sSec.value || '*';
    visibleCount = PAGE_SIZE;
    renderData(window.__simData || []);
  });
}

function renderData(data){
  const curSec = state.section || '*';
  const pool = (curSec === '*') ? data : data.filter(r => r.section === curSec);
  const visible = pool.slice(0, visibleCount);

  host.innerHTML = '';
  const wrap = document.createElement('section');
  wrap.className = 'card';
  wrap.innerHTML = `<div class="grid cards"></div>`;
  const grid = wrap.querySelector('.grid');
  visible.forEach(r => grid.appendChild(card(r)));
  host.appendChild(wrap);

  appendLoadMore(pool.length);
}

function appendLoadMore(totalCount){
  if (visibleCount < totalCount){
    const moreWrap = document.createElement('div');
    moreWrap.className = 'center';
    moreWrap.style.margin = '12px 0 4px';
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = `Yana ko‘rsatish (${visibleCount} / ${totalCount})`;
    btn.addEventListener('click', ()=>{
      visibleCount += PAGE_SIZE;
      renderData(window.__simData || []);
    });
    moreWrap.appendChild(btn);
    host.appendChild(moreWrap);
  }
}

function card(r){
  const div = document.createElement('div'); div.className = 'card';
  const action = (r.href) ? `<a class="btn primary" href="${r.href}">O‘ynash</a>` : `<button class="btn" disabled>Link yo‘q</button>`;
  div.innerHTML = `
    ${r.img ? `<img src="${r.img}" alt="${esc(r.title)}" loading="lazy">` : ''}
    ${r.title ? `<h3 style="margin:.2rem 0">${esc(r.title)}</h3>` : ''}
    ${action}
  `;
  return div;
}

/* Helpers */
function uniq(arr){ return Array.from(new Set(arr)); }
async function fetchCSV(path){
  const tries=[path,'./simulator.csv','/simulator.csv'];
  for(const p of tries){ try{ const r=await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch(_){ } }
  return null;
}
function detectDelim(line){
  const cand=['|',',',';','\t']; const counts=cand.map(d=>(line.split(d).length-1));
  const max=Math.max(...counts); return max>0? cand[counts.indexOf(max)] : ',';
}
function parseCSV(text){
  const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  let first=''; for(const ln of lines){ const t=ln.trim(); if(t){ first=ln; break; } }
  const delim=detectDelim(first || "Img url,Title,Tugma linki,Bo'lim");
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
    const r=rows[i]; if(r.length<4) continue;
    const [img,title,href,section] = r;
    out.push({ img:img||'', title:title||'', href:href||'', section:section||'Boshqa' });
  }
  return out;
}
function esc(s){ return String(s||'').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

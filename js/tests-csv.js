
// Tests page: CSV → Sections + Filters → Cards
// CSV columns: Img url, Title, Meta, tugma nomi, tugma linki, bo'lim, filter1, filter2
const host = document.querySelector('#testsSections');
const source = host?.dataset?.csv || './tests.csv';

(async function init(){
  const text = await fetchCSV(source);
  if(!text){ host.innerHTML = `<div class="card">tests.csv topilmadi.</div>`; return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  if(!data.length){ host.innerHTML = `<div class="card">CSV bo‘sh.</div>`; return; }
  buildFilters(data);
  render(data);
  wiring(data);
})();

function wiring(data){
  document.querySelector('#fSec')?.addEventListener('change', ()=> render(data));
  document.querySelector('#f1')?.addEventListener('change', ()=> render(data));
  document.querySelector('#f2')?.addEventListener('change', ()=> render(data));
  document.querySelector('#fReset')?.addEventListener('click', ()=>{
    document.querySelector('#fSec').value='';
    document.querySelector('#f1').value='';
    document.querySelector('#f2').value='';
    render(data);
  });
}

function render(data){
  const selS = document.querySelector('#fSec')?.value || '';
  const sel1 = document.querySelector('#f1')?.value || '';
  const sel2 = document.querySelector('#f2')?.value || '';
  const filtered = data.filter(r=>{
    const okS = !selS || r.section === selS;
    const ok1 = !sel1 || r.filter1 === sel1 || r.filter2 === sel1;
    const ok2 = !sel2 || r.filter1 === sel2 || r.filter2 === sel2;
    return okS && ok1 && ok2;
  });
  renderSections(filtered);
}

function renderSections(items){
  host.innerHTML = '';
  const bySec = new Map();
  for(const it of items){
    const key = it.section || 'Boshqa';
    if(!bySec.has(key)) bySec.set(key, []);
    bySec.get(key).push(it);
  }
  for(const [sec, list] of bySec.entries()){
    const wrap = document.createElement('section');
    wrap.className = 'card';
    wrap.innerHTML = `<h2 style="margin:.2rem 0 8px">${esc(sec)}</h2><div class="grid cards"></div>`;
    const grid = wrap.querySelector('.grid');
    list.forEach(r=> grid.appendChild(card(r)));
    host.appendChild(wrap);
  }
}

function card(r){
  const div = document.createElement('div'); div.className = 'card';
  let action = '';
  if(/^start:/.test(r.href||'')){
    const startVal = r.href.split(':')[1];
    action = `<button class="btn primary" data-start="${esc(startVal)}">${esc(r.btn)}</button>`;
  }else{
    action = `<a class="btn primary" href="${r.href||'#'}">${esc(r.btn)}</a>`;
  }
  div.innerHTML = `
    ${r.img ? `<img src="${r.img}" alt="${esc(r.title)}" loading="lazy" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);margin-bottom:8px;aspect-ratio:16/9;object-fit:cover">` : ''}
    ${r.title ? `<h3 style="margin:.2rem 0">${esc(r.title)}</h3>` : ''}
    ${r.meta ? `<p class="sub">${esc(r.meta)}</p>` : ''}
    ${action}
  `;
  return div;
}

function buildFilters(data){
  const uniques = (prop)=>{
    const s = new Set(data.map(x=>(x[prop]||'').trim()).filter(Boolean));
    return Array.from(s).sort((a,b)=>a.localeCompare(b));
  };
  const sec = uniques('section'), f1 = uniques('filter1'), f2 = uniques('filter2');
  const fill = (sel, arr)=>{
    const el = document.querySelector(sel); if(!el) return;
    el.innerHTML = '<option value="">Hammasi</option>' + arr.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  };
  fill('#fSec', sec); fill('#f1', f1); fill('#f2', f2);
}

/* CSV helpers */
async function fetchCSV(path){
  const tries=[path,'./tests.csv','/tests.csv'];
  for(const p of tries){
    try{ const r=await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch(_){}
  }
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
      img: img||'', title: title||'', meta: meta||'',
      btn: btn||'Boshlash', href: href||'#',
      section: section||'Boshqa',
      filter1: f1||'', filter2: f2||''
    });
  }
  return out;
}
function esc(s){ return String(s||'').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

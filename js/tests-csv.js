// Testlar — CSV → grid (sections + plan + filter1/2 + linkli tugma + pagination)
const host = document.querySelector('#testsSections');
const csvPath = host?.dataset?.csv || './csv/tests.csv';

let PAGE_SIZE = 12, visibleCount = PAGE_SIZE;
const state = { section: '*', plan: '*', f1: '*', f2: '*' };

(async function init(){
  const text = await fetchCSV(csvPath);
  if(!text){ host.innerHTML = `<section class="card"><div class="sub">tests.csv topilmadi.</div></section>`; return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  if(!data.length){ host.innerHTML = `<section class="card"><div class="sub">CSV bo‘sh.</div></section>`; return; }
  window.__testsData = data;
  setupFilters(data);
  render();
})();

function setupFilters(data){
  const sSec  = document.querySelector('#fSec');
  const sPlan = document.querySelector('#fPlan');
  const sF1   = document.querySelector('#f1');
  const sF2   = document.querySelector('#f2');

  const sections = uniq(data.map(x => x.section).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
  const plans    = uniq(data.map(x => x.plan)).filter(Boolean).sort();
  const f1s      = uniq(data.map(x => x.f1).filter(Boolean)).sort();
  const f2s      = uniq(data.map(x => x.f2).filter(Boolean)).sort();

  sSec.innerHTML  = opt('*','Hammasi') + sections.map(v=>opt(v,v)).join('');
  sPlan.innerHTML = opt('*','Hammasi') + plans.map(v=>opt(v,v)).join('');
  sF1.innerHTML   = opt('*','Hammasi') + f1s.map(v=>opt(v,v)).join('');
  sF2.innerHTML   = opt('*','Hammasi') + f2s.map(v=>opt(v,v)).join('');

  sSec.value='*'; sPlan.value='*'; sF1.value='*'; sF2.value='*';

  [sSec,sPlan,sF1,sF2].forEach(sel=>{
    sel.addEventListener('change', ()=>{
      state.section = sSec.value; state.plan = sPlan.value; state.f1 = sF1.value; state.f2 = sF2.value;
      visibleCount = PAGE_SIZE; render();
    });
  });
}

function render(){
  const data = window.__testsData || [];
  let pool = data.slice();
  const {section, plan, f1, f2} = state;
  if(section !== '*') pool = pool.filter(x => x.section === section);
  if(plan    !== '*') pool = pool.filter(x => x.plan === plan);
  if(f1      !== '*') pool = pool.filter(x => x.f1 === f1);
  if(f2      !== '*') pool = pool.filter(x => x.f2 === f2);

  const page = pool.slice(0, visibleCount);

  host.innerHTML = '';
  const wrap = el('section','card');
  const grid = el('div','grid cards'); wrap.appendChild(grid);
  page.forEach(r => grid.appendChild(card(r)));
  host.appendChild(wrap);

  if (visibleCount < pool.length){
    const more = el('div','center');
    const btn = el('button','btn'); btn.textContent = `Yana ko‘rsatish (${visibleCount} / ${pool.length})`;
    btn.onclick = ()=>{ visibleCount += PAGE_SIZE; render(); };
    more.appendChild(btn); host.appendChild(more);
  }
}

function card(r){
  const x = el('div','card test-card');
  const action = r.href
    ? `<a class="btn primary" href="${r.href}">${esc(r.btn||'Ochish')}</a>`
    : `<button class="btn" disabled>${esc(r.btn||'Ochish')}</button>`;
  x.innerHTML = `
    ${r.img ? `<img src="${r.img}" alt="${esc(r.title)}" loading="lazy">` : ''}
    ${r.title ? `<h3 style="margin:.2rem 0">${esc(r.title)}</h3>` : ''}
    ${r.meta ? `<p class="sub">${esc(r.meta)}</p>` : ''}
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
      <span class="pill">${esc(r.plan)}</span>
      ${action}
    </div>
  `;
  return x;
}

/* Helpers */
function opt(val, text){ return `<option value="${esc(val)}">${esc(text)}</option>`; }
function el(tag, cls){ const n=document.createElement(tag); if(cls) n.className=cls; return n; }
function uniq(a){ return Array.from(new Set(a)); }

async function fetchCSV(p){ try{ const r=await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch{} return null; }
function detectDelim(line){ const cand=['|',',',';','\t']; const cnt=cand.map(d=>line.split(d).length-1); const m=Math.max(...cnt); return m>0?cand[cnt.indexOf(m)]:','; }
function parseCSV(text){
  const L=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
  let first=''; for(const ln of L){ const t=ln.trim(); if(t){ first=ln; break; } }
  const d=detectDelim(first||"Img url,Title,Meta,tugma nomi,tugma linki,bo'lim,filter1,filter2,plan");
  const rows=[]; let row=[],f='',q=false;
  const push=()=>{ let v=f; if(v.startsWith('"')&&v.endsWith('"')) v=v.slice(1,-1).replace(/""/g,'"'); row.push(v.trim()); f=''; };
  for(let i=0;i<text.length;i++){
    const ch=text[i], nx=text[i+1];
    if(ch=='"'){ if(q&&nx=='"'){f+='"'; i++;} else { q=!q; } continue; }
    if(ch=='\n'&&!q){ push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row); row=[]; continue; }
    if(ch==d&&!q){ push(); continue; }
    f+=ch;
  }
  push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row);
  return rows;
}

function normalize(rows){
  if(!rows.length) return [];
  const hdr = rows[0].map(s=>s.trim().toLowerCase());
  const hasHdr = hdr.some(h => /img|title|tugma|bo'lim|bolim|plan|reja/.test(h));
  const start = hasHdr ? 1 : 0;

  const idx = (...names)=> {
    const cand = names.map(n=>n.toLowerCase());
    for(const n of cand){
      const i = hdr.indexOf(n);
      if(i>-1) return i;
    }
    return -1;
  };

  const iImg = idx('img url','img','image','rasm');
  const iTitle = idx('title','sarlavha','nomi');
  const iMeta = idx('meta','ta\'rif','description','desc');
  const iBtn = idx('tugma nomi','button','btn');
  const iHref = idx('tugma linki','link','href','url');
  const iSec = idx("bo'lim",'bolim','section');
  const iF1 = idx('filter1','filter 1','tag','mavzu');
  const iF2 = idx('filter2','filter 2','tag2','sinf');
  const iPlan = idx('plan','reja','type');

  const out=[];
  for(let r=start;r<rows.length;r++){
    const row = rows[r]; if(!row || row.every(v=>String(v||'').trim()==='')) continue;
    out.push({
      img: get(row,iImg), title: get(row,iTitle), meta: get(row,iMeta),
      btn: get(row,iBtn) || 'Ochish', href: get(row,iHref),
      section: get(row,iSec) || 'Boshqa', f1: get(row,iF1), f2: get(row,iF2),
      plan: (get(row,iPlan) || 'FREE').toUpperCase()
    });
  }
  return out;

  function get(row, i){ return i>=0 ? (row[i]||'').trim() : ''; }
}

function esc(s){ return String(s||'').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

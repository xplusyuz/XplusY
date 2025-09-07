// Testlar CSV tizimi (sections + filters + FREE/PRO + pagination)
const host = document.querySelector('#testsSections');
const csvPath = host?.dataset?.csv || './tests.csv';

// Pagination state
let PAGE_SIZE = 12;
let visibleCount = PAGE_SIZE;
const state = { section: '*', f1: '', f2: '', plan: '' };

(async function init(){
  const text = await fetchCSV(csvPath);
  if(!text){ host.innerHTML = `<section class="card"><div class="sub">tests.csv topilmadi.</div></section>`; return; }
  const rows = parseCSV(text);
  const data = normalize(rows);
  if(!data.length){ host.innerHTML = `<section class="card"><div class="sub">CSV bo‘sh.</div></section>`; return; }
  window.__testsData = data;
  setupUI(data);
  renderData(data);
})();

function setupUI(data){
  const sSec = document.querySelector('#fSec');
  const sPlan = document.querySelector('#fPlan');
  const sF1 = document.querySelector('#f1');
  const sF2 = document.querySelector('#f2');
  const fieldF1 = document.querySelector('#fieldF1');
  const fieldF2 = document.querySelector('#fieldF2');

  // Sections: Hammasi + list
  const sections = uniq(data.map(x => (x.section||'').trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
  sSec.innerHTML = `<option value="*">Hammasi</option>` + sections.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sSec.value = '*'; state.section='*'; visibleCount = PAGE_SIZE;

  // Plan: always visible
  sPlan.innerHTML = `<option value="">Hammasi</option><option value="FREE">FREE</option><option value="PRO">PRO</option>`;
  sPlan.value = ''; state.plan = '';

  // Filters depend on section (Hammasi => from all data)
  function rebuildFilters(){
    const curSec = sSec.value;
    const pool = (curSec === '*') ? data : data.filter(x => x.section === curSec);
    const f1vals = uniq(pool.map(x => (x.filter1||'').trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b));
    const f2vals = uniq(pool.map(x => (x.filter2||'').trim()).filter(Boolean)).sort((a,b)=>a.localeCompare(b));

    if (f1vals.length){
      sF1.innerHTML = `<option value="">Hammasi</option>` + f1vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      sF1.value = state.f1 || '';
      fieldF1.style.display = '';
    } else {
      sF1.innerHTML = ''; state.f1=''; fieldF1.style.display = 'none';
    }

    if (f2vals.length){
      sF2.innerHTML = `<option value="">Hammasi</option>` + f2vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      sF2.value = state.f2 || '';
      fieldF2.style.display = '';
    } else {
      sF2.innerHTML = ''; state.f2=''; fieldF2.style.display = 'none';
    }
  }

  rebuildFilters();

  sSec.addEventListener('change', ()=>{
    state.section = sSec.value || '*';
    visibleCount = PAGE_SIZE;
    rebuildFilters();
    renderData(window.__testsData || []);
  });
  sPlan.addEventListener('change', ()=>{
    state.plan = sPlan.value || '';
    visibleCount = PAGE_SIZE;
    renderData(window.__testsData || []);
  });
  sF1.addEventListener('change', ()=>{
    state.f1 = sF1.value || '';
    visibleCount = PAGE_SIZE;
    renderData(window.__testsData || []);
  });
  sF2.addEventListener('change', ()=>{
    state.f2 = sF2.value || '';
    visibleCount = PAGE_SIZE;
    renderData(window.__testsData || []);
  });
}

function renderData(data){
  const curSec = state.section || '*';
  const v1 = state.f1 || '';
  const v2 = state.f2 || '';
  const vPlan = (state.plan||'').toUpperCase();

  const pool = (curSec === '*') ? data : data.filter(r => r.section === curSec);
  const filtered = pool.filter(r=>{
    if (v1 && r.filter1 !== v1 && r.filter2 !== v1) return false;
    if (v2 && r.filter1 !== v2 && r.filter2 !== v2) return false;
    if (vPlan && r.plan !== vPlan) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);

  if (curSec === '*'){
    renderFlatWithLoadMore(visible, filtered.length);
  } else {
    renderSectionWithLoadMore(curSec, visible, filtered.length);
  }
}

function renderFlatWithLoadMore(items, totalCount){
  host.innerHTML = '';
  const wrap = document.createElement('section');
  wrap.className = 'card';
  wrap.innerHTML = `<div class="grid cards"></div>`;
  const grid = wrap.querySelector('.grid');
  items.forEach(r => grid.appendChild(card(r)));
  host.appendChild(wrap);

  appendLoadMore(totalCount);
}

function renderSectionWithLoadMore(curSec, items, totalCount){
  host.innerHTML = '';
  const wrap = sectionBlock(curSec, items);
  host.appendChild(wrap);

  appendLoadMore(totalCount);
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
      renderData(window.__testsData || []);
    });
    moreWrap.appendChild(btn);
    host.appendChild(moreWrap);
  }
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
  const planBadge = r.plan ? `<span class="pill-plan ${r.plan==='PRO'?'pill-pro':'pill-free'}">${r.plan}</span>` : '';
  const action = (r.href) ? `<a class="btn primary" href="${r.href}">${esc(r.btn || 'Ochish')}</a>` : '';
  div.innerHTML = `${planBadge}` + `
    ${r.img ? `<img src="${r.img}" alt="${esc(r.title)}" loading="lazy">` : ''}
    ${r.title ? `<h3 style="margin:.2rem 0">${esc(r.title)}</h3>` : ''}
    ${r.meta ? `<p class="sub">${esc(r.meta)}</p>` : ''}
    ${action}
  `;
  return div;
}

/* Helpers */
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
  const delim=detectDelim(first || "Img url|Title|Meta|tugma nomi|tugma linki|bo'lim|filter1|filter2|plan");
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
    const [img,title,meta,btn,href,section,f1,f2,planRaw] = r;
    const plan = String(planRaw||'FREE').trim().toUpperCase();
    out.push({
      img:img||'', title:title||'', meta:meta||'',
      btn:btn||'Ochish', href:href||'#',
      section:section||'Boshqa',
      filter1:f1||'', filter2:f2||'',
      plan: (plan==='PRO'?'PRO':'FREE')
    });
  }
  return out;
}
function esc(s){ return String(s||'').replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

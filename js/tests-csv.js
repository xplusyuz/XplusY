// tests.csv => grid (narx + runner link) + filter + pagination
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
    sel.addEventListener('change', ()=>{ state.section=sSec.value; state.plan=sPlan.value; state.f1=sF1.value; state.f2=sF2.value; visibleCount=PAGE_SIZE; render(); });
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
  const priceTag = r.price ? `<span class="pill" title="Narx">💳 ${formatUZS(r.price)}</span>` : `<span class="pill">FREE</span>`;
  const link = r.href ? `./tests.html?run=${encodeURIComponent(r.href)}&price=${encodeURIComponent(r.price||0)}&title=${encodeURIComponent(r.title||'Test')}` : '';
  const action = r.href ? `<a class="btn primary" href="${link}">${esc(r.btn||'Boshlash')}</a>` : `<button class="btn" disabled>${esc(r.btn||'Boshlash')}</button>`;
  x.innerHTML = `${r.img?`<img src="${r.img}" alt="${esc(r.title)}" loading="lazy">`:''}${r.title?`<h3 style="margin:.2rem 0">${esc(r.title)}</h3>`:''}${r.meta?`<p class="sub">${esc(r.meta)}</p>`:''}
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">${priceTag}${action}</div>`;
  return x;
}
/* helpers */
function opt(v,t){return `<option value="${esc(v)}">${esc(t)}</option>`} function el(t,c){const n=document.createElement(t); if(c) n.className=c; return n;}
function uniq(a){return Array.from(new Set(a))} function formatUZS(n){try{return new Intl.NumberFormat('uz-UZ').format(n);}catch(_){return n;}}
async function fetchCSV(p){ try{ const r=await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch{} return null; }
function detectDelim(line){ const cand=['|',',',';','\\t']; const cnt=cand.map(d=>line.split(d).length-1); const m=Math.max(...cnt); return m>0?cand[cnt.indexOf(m)]:','; }
function parseCSV(text){
  const L=text.replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n').split('\\n'); let first=''; for(const ln of L){ const t=ln.trim(); if(t){ first=ln; break; } }
  const d=detectDelim(first||"Img url,Title,Meta,tugma nomi,tugma linki,bo'lim,filter1,filter2,plan,narx");
  const rows=[]; let row=[],f='',q=false; const push=()=>{ let v=f; if(v.startsWith('\"')&&v.endsWith('\"')) v=v.slice(1,-1).replace(/\"\"/g,'\"'); row.push(v.trim()); f=''; };
  for(let i=0;i<text.length;i++){ const ch=text[i], nx=text[i+1]; if(ch=='\"'){ if(q&&nx=='\"'){f+='\"'; i++;} else { q=!q; } continue; } if(ch=='\\n'&&!q){ push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row); row=[]; continue; } if(ch==d&&!q){ push(); continue; } f+=ch; }
  push(); if(row.some(x=>x!=='') && !String(row[0]||'').trim().startsWith('#')) rows.push(row); return rows;
}
function normalize(rows){
  if(!rows.length) return []; const hdr=rows[0].map(s=>String(s||'').trim().toLowerCase());
  const getIndex=(...ns)=>{ns=ns.map(n=>n.toLowerCase()); for(const n of ns){const i=hdr.indexOf(n); if(i>-1) return i;} return -1;}
  const iImg=getIndex('img url','img','image','rasm'), iTitle=getIndex('title','sarlavha','nomi'), iMeta=getIndex('meta',"ta'rif",'description','desc'),
        iBtn=getIndex('tugma nomi','button','btn'), iHref=getIndex('tugma linki','link','href','url'), iSec=getIndex("bo'lim",'bolim','section'),
        iF1=getIndex('filter1','filter 1','tag','mavzu'), iF2=getIndex('filter2','filter 2','tag2','sinf'), iPlan=getIndex('plan','reja','type'), iPrice=getIndex('narx','price','sum',"so'm");
  const out=[]; for(let r=1;r<rows.length;r++){ const row=rows[r]; if(!row||row.every(v=>String(v||'').trim()==='')) continue;
    out.push({img:g(row,iImg), title:g(row,iTitle), meta:g(row,iMeta), btn:g(row,iBtn)||'Boshlash', href:g(row,iHref),
      section:g(row,iSec)||'Boshqa', f1:g(row,iF1), f2:g(row,iF2), plan:(g(row,iPlan)||'FREE').toUpperCase(), price:Number(g(row,iPrice)||0)});
  } return out; function g(row,i){return i>=0? String(row[i]||'').trim():'';}
}
function esc(s){return String(s||'').replace(/[&<>\\\"']/g,c=>({\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\\"\":\"&quot;\",\"'\":\"&#39;\"}[c]));}

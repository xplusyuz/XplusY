// js/simulator-csv.js — CSV-driven simulator catalog (NO TIME), fixed JS

let mounted = false, abortCtrl = null;
const $ = (s, r = document) => r.querySelector(s);
const fmt = (v) => new Intl.NumberFormat('uz-UZ').format(+v || 0);

const ALIASES = { "Bo'lim": ["Bo'lim","Bo‘lim","bolim","Bolim","bo'lim","bo‘lim"] };

function parseCSV(t){
  const rows=[]; let row=[], cell='', q=false;
  for (let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){
      if(ch === '"'){ if(t[i+1] === '"'){ cell+='"'; i++; } else q=false; }
      else cell += ch;
    } else {
      if(ch === '"') q=true;
      else if(ch === ','){ row.push(cell.trim()); cell=''; }
      else if(ch === '\n' || ch === '\r'){ if(cell!=='' || row.length){ row.push(cell.trim()); rows.push(row); row=[]; cell=''; } }
      else cell += ch;
    }
  }
  if(cell!=='' || row.length){ row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.length && r.some(v=>v!==''));
}
function normKey(k){
  const t = (k||'').trim().toLowerCase();
  if (ALIASES["Bo'lim"].some(x => x.toLowerCase() === t)) return 'bolim';
  return t;
}
function hydrate(rows){
  const head = rows[0].map(normKey);
  const idx = (k)=> head.indexOf(k);
  return rows.slice(1).map(r => ({
    type:   (r[idx('type')]||'card').toLowerCase(),   // 'promo' | 'card'
    bolim:  r[idx('bolim')] || '',
    img:    r[idx('img')] || '',
    title:  r[idx('title')] || '',
    meta:   r[idx('meta')] || '',
    link:   r[idx('link')] || r[idx('href')] || '',
    cta_text: r[idx('cta_text')] || 'Boshlash',
    badge:  r[idx('badge')] || '',
    price_som: r[idx('price_som')] || '',
  }));
}

/* ---- Render ---- */
function renderHero(it){
  const box = $("#simHero");
  if(!it){ box.classList.add('hidden'); box.innerHTML=''; return; }
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="bg" style="background-image:url('${it.img||""}')"></div>
    <div class="overlay"></div>
    <div class="body">
      ${it.badge? `<span class="pill">${it.badge}</span>`:''}
      <div class="title">${it.title||""}</div>
      <div class="meta">${it.meta||""}</div>
      <div class="row">
        <a class="btn" href="${it.link||"#"}">${it.cta_text||"Boshlash"}</a>
        ${it.price_som? `<span class="pill">💰 ${fmt(it.price_som)} so'm</span>`:''}
      </div>
    </div>`;
}
function cardNode(it){
  const el = document.createElement('div');
  el.className = 'scard';
  el.innerHTML = `
    ${it.img ? `<img src="${it.img}" alt="">` : ``}
    <div class="sbody">
      <div class="stitle">${it.title||""}</div>
      <div class="smeta">${it.meta||""}</div>
      <div class="srow">
        ${it.price_som? `<span class="spill">💰 ${fmt(it.price_som)} so'm</span>`:''}
        ${it.badge? `<span class="spill">${it.badge}</span>`:''}
      </div>
      <div class="sactions">
        <a class="sbtn" href="${it.link||"#"}" ${/^https?:\/\//.test(it.link||"")?'target="_blank" rel="noopener"':''}>${it.cta_text||"Boshlash"}</a>
      </div>
    </div>`;
  return el;
}
function fillBolimFacet(items){
  const sel = $("#simFacetBolim");
  const uniq = Array.from(new Set(items.map(x=>x.bolim).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  sel.innerHTML = `<option value="all">Barchasi</option>` + uniq.map(v=>`<option value="${v}">${v}</option>`).join('');
}
function applyFilter(){
  const bolim = $("#simFacetBolim").value;
  const grid = $("#simGrid");
  const all = window.__SIM_ALL__ || [];
  const list = all.filter(x => x.type !== 'promo').filter(x => bolim==='all' || x.bolim===bolim);
  grid.innerHTML = '';
  if(!list.length){ grid.innerHTML = `<div class="eh-note">Hech narsa topilmadi.</div>`; return; }
  list.forEach(it => grid.append(cardNode(it)));
}

/* ---- Lifecycle ---- */
function bind(){
  $("#simFacetBolim").onchange = applyFilter;
}

async function init(){
  if (mounted) destroy();
  mounted = true;
  abortCtrl = new AbortController();

  // CSV ni ikki joydan ko‘ramiz: csv/simulator.csv -> simulator.csv (fallback)
  let text = "";
  let ok = false;
  try {
    const r1 = await fetch("csv/simulator.csv", { cache: "no-cache", signal: abortCtrl.signal });
    if (r1.ok) { text = await r1.text(); ok = true; }
  } catch {}
  if (!ok) {
    try {
      const r2 = await fetch("simulator.csv", { cache: "no-cache", signal: abortCtrl.signal });
      if (r2.ok) { text = await r2.text(); ok = true; }
    } catch {}
  }
  if (!ok) {
    const grid = $("#simGrid");
    if (grid) grid.innerHTML = `<div class="eh-note">simulator.csv topilmadi</div>`;
    return;
  }

  const rows = parseCSV(text);
  const items = hydrate(rows);
  window.__SIM_ALL__ = items;

  const hero = items.find(x => x.type === 'promo') || null;
  renderHero(hero);
  fillBolimFacet(items.filter(x => x.type !== 'promo'));
  bind();
  applyFilter();
}

function destroy(){
  mounted = false;
  try { abortCtrl?.abort(); } catch {}
  abortCtrl = null;
  window.__SIM_ALL__ = null;
}

export default { init, destroy };

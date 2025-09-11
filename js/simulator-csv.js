// js/simulator-csv.js — CSV-driven simulator catalog (grid) with only "Bo'lim" filter
let mounted=false, el=null, abortCtrl=null;
let allItems=[], viewItems=[], hero=null;
const $=(s,r=document)=>r.querySelector(s);
const fmt=(v)=>new Intl.NumberFormat('uz-UZ').format(+v||0);

/* CSV */
function parseCSV(t){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){ if(ch=='"'){ if(t[i+1]=='"'){cell+='"';i++;} else q=false; } else cell+=ch; }
    else { if(ch=='"') q=true;
      else if(ch==','){ row.push(cell.trim()); cell=''; }
      else if(ch=='\n'||ch=='\r'){ if(cell!==''||row.length){row.push(cell.trim()); rows.push(row); row=[]; cell='';} }
      else cell+=ch; }
  }
  if(cell!==''||row.length){ row.push(cell.trim()); rows.push(row); }
  return rows.filter(r=>r.length && r.some(v=>v!==''));
}
const ALIASES = { "Bo'lim": ["Bo'lim","Bo‘lim","bolim","Bolim","bo'lim","bo‘lim"] };
function normKey(k){
  const t=(k||'').trim().toLowerCase();
  if (ALIASES["Bo'lim"].some(x=>x.toLowerCase()===t)) return "bolim";
  return t;
}
function hydrate(rows){
  const head = rows[0].map(normKey);
  const idx = (k)=> head.indexOf(k);
  const items = rows.slice(1).map(r=>({
    type: (r[idx("type")]||"card").toLowerCase(),   // promo|card
    bolim: r[idx("bolim")]||"",
    img: r[idx("img")]||"",
    title: r[idx("title")]||"",
    meta: r[idx("meta")]||"",
    link: r[idx("link")]||r[idx("href")]||"",
    cta_text: r[idx("cta_text")]||"Boshlash",
    badge: r[idx("badge")]||"",
    price_som: r[idx("price_som")]||"",
    time_min: r[idx("time_min")]||"",
  }));
  return items;
}

/* Render */
function renderHero(it){
  const box = el.hero;
  if(!it){ box.classList.add("hidden"); box.innerHTML=""; return; }
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="bg" style="background-image:url('${it.img||""}')"></div>
    <div class="overlay"></div>
    <div class="body">
      ${it.badge? `<span class="pill">${it.badge}</span>`:""}
      <div class="title">${it.title||""}</div>
      <div class="meta">${it.meta||""}</div>
      <div class="row">
        <a class="btn" href="${it.link||"#"}">${it.cta_text||"Boshlash"}</a>
        ${it.price_som? `<span class="pill">💰 ${fmt(it.price_som)} so'm</span>`:""}
        ${it.time_min?  `<span class="pill">⏱️ ${fmt(it.time_min)} daq</span>`:""}
      </div>
    </div>`;
}

function cardNode(it){
  const card = document.createElement("div");
  card.className="scard";
  card.innerHTML = `
    ${it.img? `<img src="${it.img}" alt="">`:""}
    <div class="sbody">
      <div class="stitle">${it.title||""}</div>
      <div class="smeta">${it.meta||""}</div>
      <div class="srow">
        ${it.price_som? `<span class="spill">💰 ${fmt(it.price_som)} so'm</span>`:""}
        ${it.time_min?  `<span class="spill">⏱️ ${fmt(it.time_min)} daq</span>`:""}
        ${it.badge?     `<span class="spill">${it.badge}</span>`:""}
      </div>
      <div class="sactions">
        <a class="sbtn" href="${it.link||"#"}" ${/^https?:\/\//.test(it.link||"")?'target="_blank" rel="noopener"':''}>${it.cta_text||"Boshlash"}</a>
      </div>
    </div>`;
  return card;
}

function fillBolimFacet(items){
  const uniq = Array.from(new Set(items.map(x=>x.bolim).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const sel = el.fBolim;
  sel.innerHTML = `<option value="all">Barchasi</option>` + uniq.map(v=>`<option value="${v}">${v}</option>`).join("");
}

function applyFilter(){
  const bolim = el.fBolim.value;
  viewItems = allItems.filter(it => it.type!=="promo").filter(it => bolim==='all' || it.bolim===bolim);
  const grid = el.grid; grid.innerHTML="";
  if(!viewItems.length){ grid.innerHTML = `<div class="eh-note">Hech narsa topilmadi.</div>`; return; }
  viewItems.forEach(it => grid.append(cardNode(it)));
}

async function loadCSV(signal){
  let res = await fetch("csv/simulator.csv", { cache:"no-cache", signal }).catch(()=>({}));
  if(!res?.ok) res = await fetch("simulator.csv", { cache:"no-cache", signal }).catch(()=>({}));
  if(!res?.ok) return [];
  const rows = parseCSV(await res.text());
  return hydrate(rows);
}

/* PUBLIC */
function bind(){
  el.fBolim.onchange = applyFilter;
}
function init(){
  if(mounted) destroy();
  mounted=true;
  el = {
    root: document.getElementById("simulator-page"),
    hero: document.getElementById("simHero"),
    grid: document.getElementById("simGrid"),
    fBolim: document.getElementById("simFacetBolim"),
  };
  abortCtrl = new AbortController();
  bind();
  loadCSV(abortCtrl.signal).then(items=>{
    if(!mounted) return;
    // split hero + items
    hero = items.find(x=>x.type==="promo") || null;
    allItems = items;
    renderHero(hero);
    fillBolimFacet(items.filter(x=>x.type!=="promo"));
    applyFilter();
  }).catch(()=>{});
}
function destroy(){
  mounted=false;
  try{ abortCtrl?.abort(); }catch{}
  abortCtrl=null;
  el=null;
  allItems=[]; viewItems=[]; hero=null;
}
export default { init, destroy };

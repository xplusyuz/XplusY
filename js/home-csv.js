// js/home-csv.js — Home page driven by CSV, with ad-like wide cards (span>1)
let mounted = false;
let el = null;
let abortCtrl = null;

const $ = (s, r=document) => r.querySelector(s);
const fmt = (v)=> new Intl.NumberFormat('uz-UZ').format(+v||0);

function parseCSV(t){
  const rows=[]; let row=[], cell='', q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){ if(ch=='"'){ if(t[i+1]=='"'){cell+='"'; i++;} else q=false; } else cell+=ch; }
    else { if(ch=='"') q=true; else if(ch==','){ row.push(cell.trim()); cell=''; }
      else if(ch=='\n'||ch=='\r'){ if(cell!==''||row.length){ row.push(cell.trim()); rows.push(row); row=[]; cell=''; } }
      else cell+=ch; }
  }
  if(cell!==''||row.length){ row.push(cell.trim()); rows.push(row); }
  return rows.filter(r=>r.length && r.some(v=>v!==''));
}

function normalize(items, head){
  const idx = (k)=> head.indexOf(k);
  return items.map(r=> ({
    type: (r[idx("type")]||"card").toLowerCase(),      // card|promo|poster
    span: Math.max(1, parseInt(r[idx("span")]||"1",10)||1),
    img:  r[idx("img")]||"",
    title: r[idx("title")]||"",
    meta:  r[idx("meta")]||"",
    badge: r[idx("badge")]||"",
    price_som: r[idx("price_som")]||"",
    time_min:  r[idx("time_min")]||"",
    cta_text:  r[idx("cta_text")]||"Ko‘rish",
    cta_href:  r[idx("cta_href")]||"",
    src_csv:   r[idx("src_csv")]||"",                  // agar tests CSV bo‘lsa
    bg:   r[idx("bg_hex")]||"",
    color: r[idx("text_color")]||"",
  }));
}

async function loadHome(abortSignal){
  // csv/home.csv (fallback: home.csv at root)
  let res = await fetch("csv/home.csv", { cache: "no-cache", signal: abortSignal }).catch(()=>({}));
  if(!res?.ok) res = await fetch("home.csv", { cache: "no-cache", signal: abortSignal }).catch(()=>({}));
  if(!res?.ok) return [];
  const rows = parseCSV(await res.text());
  if(!rows.length) return [];
  const head = rows[0].map(s=>s.trim());
  const items = normalize(rows.slice(1), head);
  return items;
}

/* ===== Renderers ===== */
function resolveHref(it){
  if (it.cta_href) return it.cta_href;
  if (it.src_csv) return `#/tests?src=${encodeURIComponent(it.src_csv)}`;
  return "#";
}

function cardHTML(it){
  const href = resolveHref(it);
  return `
  <article class="hcard">
    ${it.img ? `<img class="cover" src="${it.img}" alt="">` : ``}
    <div class="hbody">
      <div class="htitle">${it.title||""}</div>
      <div class="hmeta">${it.meta||""}</div>
      <div class="hrow">
        ${it.price_som? `<span class="hpill">💰 ${fmt(it.price_som)} so'm</span>`:""}
        ${it.time_min?  `<span class="hpill">⏱️ ${fmt(it.time_min)} daq</span>`:""}
        ${it.badge?     `<span class="badge silver">${it.badge}</span>`:""}
      </div>
      <div class="hrow">
        <a class="hbtn" href="${href}">${it.cta_text||"Ko‘rish"}</a>
        ${href.startsWith("#/live") ? `<span class="badge live">LIVE</span>`:``}
      </div>
    </div>
  </article>`;
}

function promoHTML(it){
  const styleBg = (it.bg || it.img) ? `background-image:url('${it.bg || it.img}')` : "";
  const color = it.color? `color:${it.color};` : ``;
  const href = resolveHref(it);
  return `
  <article class="hcard promo">
    <div class="bg" style="${styleBg};"></div>
    <div class="overlay"></div>
    <div class="content" style="${color}">
      ${it.badge? `<span class="badge">${it.badge}</span>`:""}
      <div class="title">${it.title||""}</div>
      <div class="desc">${it.meta||""}</div>
      <div class="cta-row">
        <a class="hbtn" href="${href}">${it.cta_text||"Ko‘rish"}</a>
        ${it.price_som? `<span class="hpill" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25)">💰 ${fmt(it.price_som)} so'm</span>`:""}
      </div>
    </div>
  </article>`;
}

function posterHTML(it){
  const href = resolveHref(it);
  return `
  <article class="hcard poster">
    <div class="left">${it.img? `<img src="${it.img}" alt="">` : ``}</div>
    <div class="right">
      ${it.badge? `<span class="badge gold">${it.badge}</span>`:""}
      <div class="htitle">${it.title||""}</div>
      <div class="hmeta">${it.meta||""}</div>
      <div class="hrow">
        ${it.price_som? `<span class="hpill">💰 ${fmt(it.price_som)} so'm</span>`:""}
        ${it.time_min?  `<span class="hpill">⏱️ ${fmt(it.time_min)} daq</span>`:""}
      </div>
      <div class="ctas">
        <a class="hbtn" href="${href}">${it.cta_text||"Boshlash"}</a>
      </div>
    </div>
  </article>`;
}

function render(items){
  const grid = el.grid;
  grid.innerHTML = "";
  if(!items.length){
    grid.innerHTML = `<div class="eh-note">csv/home.csv bo'sh. Namuna yozuvlarini qo‘shing.</div>`;
    return;
  }
  items.forEach(it=>{
    const wrap = document.createElement("div");
    const span = Math.max(1, Math.min(3, +it.span || 1));
    wrap.className = ["item", span>1?`span-${span}`:""].filter(Boolean).join(" ");
    let html = "";
    if(it.type==="promo") html = promoHTML(it);
    else if(it.type==="poster") html = posterHTML(it);
    else html = cardHTML(it);
    wrap.innerHTML = html;
    grid.append(wrap);
  });
}

/* ===== PUBLIC ===== */
function init(){
  if(mounted) destroy();
  mounted = true;
  el = {
    root: document.getElementById("home-page"),
    grid: document.getElementById("homeGrid")
  };
  abortCtrl = new AbortController();
  loadHome(abortCtrl.signal).then(items=>{
    if(!mounted) return;
    render(items);
  }).catch(()=>{});
}
function destroy(){
  mounted = false;
  try{ abortCtrl?.abort(); }catch{}
  abortCtrl = null;
  el = null;
}
export default { init, destroy };

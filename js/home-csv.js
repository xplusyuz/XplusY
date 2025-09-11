// js/home-csv.js — hero-only home (no time)
let mounted=false, abortCtrl=null;

function $(s,r=document){ return r.querySelector(s); }
const fmt=(v)=> new Intl.NumberFormat('uz-UZ').format(+v||0);

function parseCSV(t){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){ if(ch=='"'){ if(t[i+1]=='"'){cell+='"';i++;} else q=false; } else cell+=ch; }
    else { if(ch=='"') q=true; else if(ch==','){ row.push(cell.trim()); cell=''; }
      else if(ch=='\n'||ch=='\r'){ if(cell!==''||row.length){row.push(cell.trim()); rows.push(row); row=[]; cell='';} }
      else cell+=ch; }
  }
  if(cell!==''||row.length){ row.push(cell.trim()); rows.push(row); }
  return rows.filter(r=>r.length && r.some(v=>v!==''));
}

function normalize(rows){
  const head = rows[0].map(h=>h.trim().toLowerCase());
  const idx = (k)=> head.indexOf(k);
  return rows.slice(1).map(r=> ({
    img: r[idx('img')]||'',
    title: r[idx('title')]||'',
    meta: r[idx('meta')]||'',
    cta_text: r[idx('cta_text')]||'Boshlash',
    cta_href: r[idx('cta_href')]||'#',
    badge: r[idx('badge')]||'',
    price_som: r[idx('price_som')]||'',
    height_px: parseInt(r[idx('height_px')]||'0',10)||0,
  }));
}

async function loadHeroes(signal){
  let res = await fetch('csv/home_heroes.csv', { cache:'no-cache', signal }).catch(()=>({}));
  if(!res?.ok) res = await fetch('home_heroes.csv', { cache:'no-cache', signal }).catch(()=>({}));
  if(!res?.ok) return [];
  const rows = parseCSV(await res.text());
  if(!rows.length) return [];
  return normalize(rows);
}

function heroHTML(it){
  const h = it.height_px && it.height_px>0 ? `style="min-height:${it.height_px}px"` : "";
  return `
  <article class="hero" ${h}>
    <div class="bg" style="background-image:url('${it.img||''}')"></div>
    <div class="overlay"></div>
    <div class="body">
      ${it.badge? `<span class="badge">${it.badge}</span>`:''}
      <div class="title">${it.title||''}</div>
      <div class="meta">${it.meta||''}</div>
      <div class="row">
        <a class="btn" href="${it.cta_href||'#'}">${it.cta_text||'Boshlash'}</a>
        ${it.price_som? `<span class="pill">💰 ${fmt(it.price_som)} so'm</span>`:''}
      </div>
    </div>
  </article>`;
}

function render(heroes){ $("#homeHeroes").innerHTML = heroes.map(heroHTML).join(''); }

export default {
  init(){
    if(mounted) this.destroy();
    mounted=true;
    abortCtrl = new AbortController();
    loadHeroes(abortCtrl.signal).then(items=>{
      if(!mounted) return;
      render(items);
    }).catch(()=>{});
  },
  destroy(){
    mounted=false;
    try{ abortCtrl?.abort(); }catch{}
    abortCtrl=null;
  }
};

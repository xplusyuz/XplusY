// csv-loader.js — CSV -> banner UI (eng ixcham)

function csvParse(t){
  const L=t.replace(/\r/g,"").split("\n").filter(l=>l.trim()); if(!L.length) return [];
  const H=L.shift().split(",").map(h=>h.trim()); const out=[];
  for(const ln of L){
    let row=[], cur="", q=false;
    for(let i=0;i<ln.length;i++){
      const ch=ln[i], nx=ln[i+1];
      if(ch==='\"'){ if(q&&nx==='\"'){cur+='\"';i++;} else q=!q; }
      else if(ch===',' && !q){ row.push(cur); cur=""; }
      else cur+=ch;
    }
    row.push(cur);
    const o={}; H.forEach((h,i)=> o[h]=(row[i]??"").trim()); out.push(o);
  }
  return out;
}
const b = v=>String(v??"").trim()==="1";
const n = (v,d=0)=>{ const x=Number(v); return Number.isFinite(x)?x:d; };
const okDate = o=>{ const now=new Date(), sd=o.start_date?new Date(o.start_date):null, ed=o.end_date?new Date(o.end_date):null; if(sd&&now<sd) return false; if(ed&&now>ed) return false; return true; };

function card(o, plc){
  const bg=o.background?` style="background:${o.background}"`:"", img=o.image?`<img src="${o.image}" alt="${o.title||""}" loading="lazy">`:"";
  const sub=o.subtitle?`<p class="b-sub">${o.subtitle}</p>`:"", cta=o.cta_text?`<span class="btn mini">${o.cta_text}</span>`:"", href=o.url?` href="${o.url}"`:"";
  if(plc==="hero")  return `<a class="banner hero-card"${href}${bg}><div class="b-txt"><h3 class="b-title">${o.title||""}</h3>${sub}${cta}</div><div class="b-media">${img}</div></a>`;
  if(plc==="promo") return `<a class="banner promo-card"${href}${bg}><div class="b-media">${img}</div><div class="b-txt"><h4 class="b-title">${o.title||""}</h4>${sub}</div></a>`;
  return `<a class="banner sponsor-card"${href} title="${o.title||""}">${img||`<span class="sponsor-fallback">${o.title||""}</span>`}</a>`;
}

async function fillSection(sec){
  const csv=sec.getAttribute("data-csv"), plc=(sec.getAttribute("data-placement")||"hero").toLowerCase();
  const list=sec.querySelector('[data-target="list"], .banner-list'); if(!csv||!list) return;
  const url=new URL(csv, location.origin); url.searchParams.set("_", Date.now());
  try{
    const res=await fetch(url, {cache:"no-store"}); if(!res.ok) throw new Error(`CSV ${res.status}`);
    const items=csvParse(await res.text()).filter(x=>b(x.active)).filter(okDate).filter(x=>(x.placement||"").toLowerCase()===plc).sort((a,c)=>n(a.order,9999)-n(c.order,9999));
    list.innerHTML = items.length ? items.map(x=>card(x,plc)).join("") : `<div class="muted small">Banner yo‘q.</div>`;
  }catch(e){ console.error("[csv]",e); list.innerHTML=`<div class="msg error">CSV o‘qilmadi. (${e.message})</div>`; }
}
export async function hydrateCsvBanners(){ const secs=document.querySelectorAll("section[data-csv][data-placement]"); for(const s of secs) await fillSection(s); }
window.hydrateCsvBanners = hydrateCsvBanners;

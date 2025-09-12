// js/courses-csv.js — CSV‑driven Courses grid (default export)
let mounted=false, abortCtrl=null;
const $=(s,r=document)=>r.querySelector(s);
const fmtSom=(v)=> new Intl.NumberFormat('uz-UZ').format(+v||0) + " so'm";

/* Lightweight CSV */
function parseCSV(t){
  const rows=[]; let row=[],cell='',q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){
      if(ch=='"'){ if(t[i+1]=='"'){cell+='"'; i++;} else q=false; } else cell+=ch;
    }else{
      if(ch=='"') q=true;
      else if(ch==','){ row.push(cell.trim()); cell=''; }
      else if(ch=='\n'||ch=='\r'){ if(cell!==''||row.length){row.push(cell.trim()); rows.push(row); row=[]; cell='';} }
      else cell+=ch;
    }
  }
  if(cell!==''||row.length){ row.push(cell.trim()); rows.push(row); }
  return rows.filter(r=>r.length && r.some(v=>v!==''));
}

function normalize(rows){
  const head = rows[0].map(h=>h.trim().toLowerCase());
  const id=(k)=> head.indexOf(k);
  const iImg=id('img'), iTitle=id('title'), iSub=id('subtitle'),
        iPrice=id('price_som'), iCtaT=id('cta_text'), iCtaH=id('cta_href'),
        iTags=id('tags');
  return rows.slice(1).map(r=> ({
    img: r[iImg]||'',
    title: r[iTitle]||'Kurs',
    subtitle: r[iSub]||'',
    price_som: +(r[iPrice]||0),
    cta_text: r[iCtaT]||'Ko‘rish',
    cta_href: r[iCtaH]||'#',
    tags: (r[iTags]||'').split('|').filter(Boolean)
  }));
}

function card(it){
  return `<article class="crd">
    ${it.img? `<div class="thumb"><img src="${it.img}" alt=""></div>`: ''}
    <div class="body">
      <h3>${it.title}</h3>
      ${it.subtitle? `<div class="sub">${it.subtitle}</div>`:''}
      <div class="row">
        <a class="btn" href="${it.cta_href}">${it.cta_text||'Ko‘rish'}</a>
        ${it.price_som? `<span class="pill">💰 ${fmtSom(it.price_som)}</span>`:''}
      </div>
      ${it.tags?.length? `<div class="tags">${it.tags.map(t=>`<span>${t}</span>`).join('')}</div>`:''}
    </div>
  </article>`;
}

function render(list){
  const box = $("#coursesGrid");
  box.innerHTML = list.map(card).join("");
}

async function init(root){
  if(mounted) destroy();
  mounted=true;
  abortCtrl = new AbortController();
  const res = await fetch("/csv/courses.csv?v="+Date.now(), { cache:"no-store", signal: abortCtrl.signal });
  const text = await res.text();
  const items = normalize(parseCSV(text));
  render(items);
}

function destroy(){
  mounted=false;
  try{ abortCtrl?.abort(); }catch{}
  abortCtrl=null;
}

export default { init, destroy };

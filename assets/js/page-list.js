
import { bootFirebase } from './firebase-init.js';

const $=(s,c=document)=>c.querySelector(s);
const $$=(s,c=document)=>Array.from((c||document).querySelectorAll(s));
const PAGE_SIZE = 12;

const typeMap = { courses:'course', simulators:'sim', tests:'test' };

function uniq(list,k){ return Array.from(new Set(list.map(c=>(c[k]||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b)) }
function price(v){ v=+v||0; return v<=0?'<span class="price free">FREE</span>':`<span class="price">${v.toLocaleString('uz-UZ')} so'm</span>`; }
function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }

function cardCourse(c){
  return `<article class="card3d">${c.image?`<img class="media" src="${c.image}" alt="cover">`:''}
    <div class="body">
      <h3 class="ctitle">${c.title||'—'} ${c.tag?`<span class="tag">${String(c.tag).toUpperCase()}</span>`:''} ${c.cat?`<span class="tag">${c.cat}</span>`:''} ${c.cat2?`<span class="tag">${c.cat2}</span>`:''} ${c.cat3?`<span class="tag">${c.cat3}</span>`:''}</h3>
      ${c.desc?`<p class="desc">${c.desc}</p>`:''}
      <div class="foot">
        ${price(c.price)}
        ${c.link?`<a class="pill" href="${c.link}" target="${c.link?.startsWith('http')?'_blank':'_self'}">${c.button||'Boshlash'}</a>`:''}
      </div>
    </div></article>`;
}
const cardSim = cardCourse;

function cardTest(c){
  const startISO = c.start?.toDate ? c.start.toDate().toISOString() : (c.start||'');
  const endISO = c.end?.toDate ? c.end.toDate().toISOString() : (c.end||'');
  return `<article class="card3d" data-start="${startISO}" data-end="${endISO}" data-href="${c.link||'#'}" data-label="${c.button||'Boshlash'}">
    ${c.image?`<img class="media" src="${c.image}" alt="cover">`:''}
    <div class="body">
      <h3 class="ctitle">${c.title||'—'} ${c.tag?`<span class="tag">${String(c.tag).toUpperCase()}</span>`:''} ${c.cat?`<span class="tag">${c.cat}</span>`:''} ${c.cat2?`<span class="tag">${c.cat2}</span>`:''} ${c.cat3?`<span class="tag">${c.cat3}</span>`:''}</h3>
      ${c.desc?`<p class="desc">${c.desc}</p>`:''}
      <div class="foot">
        ${price(c.price)}
        <span class="slot"></span>
      </div>
    </div></article>`;
}

function attachTestTimers(root){
  root.querySelectorAll('.card3d').forEach(card=>{
    const slot=card.querySelector('.slot');
    const start=card.dataset.start ? new Date(card.dataset.start).getTime() : 0;
    const end=card.dataset.end ? new Date(card.dataset.end).getTime() : 0;
    function fmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); const d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), ss=s%60; const parts=[]; if(d>0) parts.push(d+'k'); parts.push(String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0')); return parts.join(' ') }
    function tick(){ const now=Date.now();
      if(now<start){ slot.innerHTML=`Boshlanishigacha: <b>${fmt(start-now)}</b>`; }
      else if(now>=start && now<=end){ slot.innerHTML=`Yopilishigacha: <b>${fmt(end-now)}</b>`; if(!card.querySelector('.pill')){ const a=document.createElement('a'); a.className='pill'; a.href=card.dataset.href||'#'; a.textContent=card.dataset.label||'Boshlash'; card.querySelector('.foot').appendChild(a);} }
      else { slot.textContent='Yopilgan'; }
    }
    tick(); setInterval(tick,1000);
  });
}

async function fetchCatalog(fs, db, WANT){
  const col = fs.collection(db, 'catalog');
  let snap;
  try {
    const qy = fs.query(col, fs.where('type','==',WANT), fs.orderBy('updatedAt','desc'));
    snap = await fs.getDocs(qy);
  } catch(err){
    console.warn('updatedAt bo‘yicha sort ishlamadi, fallback:', err?.message||err);
    const qy = fs.query(col, fs.where('type','==',WANT));
    snap = await fs.getDocs(qy);
  }
  const arr=[]; snap.forEach(d=>arr.push({id:d.id, ...d.data()}));
  // Agar updatedAt yo'q bo'lsa — client-side sort
  arr.sort((a,b)=>{
    const ta = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
    const tb = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
    return tb - ta;
  });
  return arr;
}

async function fetchFallback(fs, db, KIND){
  // Agar catalog bo'sh bo'lsa, alohida kolleksiyalardan o'qib, umumiy formatga keltiramiz
  const map = { courses:'courses', simulators:'simulators', tests:'tests' };
  const collName = map[KIND];
  const arr=[];
  if(!collName) return arr;
  const col = fs.collection(db, collName);
  const snap = await fs.getDocs(col);
  snap.forEach(d=>{
    const x = d.data();
    arr.push({
      id:d.id,
      type: (KIND==='courses'?'course':KIND==='simulators'?'sim':'test'),
      title: x.title||x.name||'',
      desc: x.desc||x.description||'',
      image: x.image||x.cover||'',
      link: x.link||x.url||'',
      button: x.button||'Boshlash',
      price: Number(x.price||0),
      tag: x.tag||'',
      cat: x.cat||'',
      cat2: x.cat2||'',
      cat3: x.cat3||'',
      mode: x.mode||'',
      start: x.start||null,
      end: x.end||null,
      updatedAt: x.updatedAt||null
    });
  });
  return arr;
}

async function main(){
  await bootFirebase();
  const fs = window.fs;
  const db = window.db;
  const KIND = document.body.dataset.type;
  const WANT = typeMap[KIND];

  let items = await fetchCatalog(fs, db, WANT);
  if(items.length===0){
    const alt = await fetchFallback(fs, db, KIND);
    if(alt.length>0){ items = alt; }
  }

  const $cards = $('#cards');
  const $pi = $('#pi');
  const $badge = $('#badge');

  // filters state
  let cat='',cat2='',cat3='',tg='',q=''; let page=1;
  const uniqCats = uniq(items,'cat'), uniqCats2=uniq(items,'cat2'), uniqCats3=uniq(items,'cat3');
  const addOptions=(sel,arr)=>{const el=$(sel); if(!el) return; arr.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o); }); }
  addOptions('#f1',uniqCats); addOptions('#f2',uniqCats2); addOptions('#f3',uniqCats3);

  function match(c){
    if(cat && String(c.cat||'')!==cat) return false;
    if(cat2 && String(c.cat2||'')!==cat2) return false;
    if(cat3 && String(c.cat3||'')!==cat3) return false;
    if(tg && String(c.tag||'').toLowerCase()!==tg) return false;
    if(q){ const s=((c.title||'')+' '+(c.desc||'')).toLowerCase(); if(!s.includes(q.toLowerCase())) return false; }
    return true;
  }
  function filtered(){ return items.filter(match) }
  function totalPages(){ return Math.max(1, Math.ceil(filtered().length/PAGE_SIZE)) }
  function clamp(){ const t=totalPages(); if(page>t) page=t; if(page<1) page=1; }

  function drawChips(){
    const root=$('#chips'); if(!root) return; root.innerHTML='';
    function chip(label, onclear){ const d=document.createElement('button'); d.className='btn'; d.style.borderRadius='999px'; d.style.background='#ffffff'; d.style.borderColor='#cdeee2'; d.innerHTML=label+' ✕'; d.onclick=onclear; return d; }
    if(cat) root.appendChild(chip("Bo'lim: "+cat, ()=>{cat=''; $('#f1').value=''; page=1; grid();}));
    if(cat2) root.appendChild(chip("Bo'lim 2: "+cat2, ()=>{cat2=''; $('#f2').value=''; page=1; grid();}));
    if(cat3) root.appendChild(chip("Bo'lim 3: "+cat3, ()=>{cat3=''; $('#f3').value=''; page=1; grid();}));
    if(tg) root.appendChild(chip('Tag: '+tg.toUpperCase(), ()=>{tg=''; $('#ft').value=''; page=1; grid();}));
    if(q) root.appendChild(chip('Qidiruv: '+q, ()=>{q=''; $('#fq').value=''; page=1; grid();}));
  }

  function grid(){
    clamp(); $cards.innerHTML='';
    const arr=filtered(); const start=(page-1)*PAGE_SIZE; const slice=arr.slice(start,start+PAGE_SIZE);
    slice.forEach(c=>{
      if(KIND==='tests') $cards.appendChild(el(cardTest(c)));
      else if(KIND==='simulators') $cards.appendChild(el(cardSim(c)));
      else $cards.appendChild(el(cardCourse(c)));
    });
    $pi.textContent = page+' / '+totalPages();
    $badge.textContent = arr.length + ' ta';
    drawChips();
    const prev=$('#prev'), next=$('#next');
    prev.disabled=page<=1; next.disabled=page>=totalPages();
    prev.onclick=()=>{ if(page>1){page--;grid();} }; next.onclick=()=>{ if(page<totalPages()){page++;grid();} };

    if(KIND==='tests'){ attachTestTimers($cards); }
  }

  // events
  $('#f1')?.addEventListener('change', e=>{cat=e.target.value; page=1; grid();});
  $('#f2')?.addEventListener('change', e=>{cat2=e.target.value; page=1; grid();});
  $('#f3')?.addEventListener('change', e=>{cat3=e.target.value; page=1; grid();});
  $('#ft')?.addEventListener('change', e=>{tg=e.target.value; page=1; grid();});
  $('#fq')?.addEventListener('input', e=>{q=e.target.value; page=1; grid();});
  $('#clear-q')?.addEventListener('click', ()=>{q=''; $('#fq').value=''; page=1; grid();});
  $('#reset')?.addEventListener('click', ()=>{cat=cat2=cat3=tg=q=''; ['#f1','#f2','#f3','#ft','#fq'].forEach(s=>{const el=$(s); if(el) el.value='';}); page=1; grid();});

  grid();
}

main().catch(err=>{ console.error('Sahifa yuklanmadi', err); alert('Yuklashda xato: '+(err.message||err)); });

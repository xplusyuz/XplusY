const data = [
  {id:'algebra', title:'Algebra Sprint', tag:'Mashq', desc:'10 daqiqalik tezkor mashqlar + progress.', pts:120, level:'Oson', progress:0.35},
  {id:'geom', title:'Geometriya: Uchburchaklar', tag:'Dars', desc:'Qisqa konspekt + interaktiv kartalar.', pts:180, level:'O‘rtacha', progress:0.12},
  {id:'test', title:'Test Pro — 20 savol', tag:'Test', desc:'Timer + natija tahlili (demo).', pts:300, level:'Qiyin', progress:0.00},
  {id:'func', title:'Funksiya va grafik', tag:'Dars', desc:'Grafikni tushunish: masalalar va misollar.', pts:160, level:'O‘rtacha', progress:0.52},
  {id:'olymp', title:'Olimpiada: Kombinatorika', tag:'Olimp', desc:'Kombinatorik fikrlashni kuchaytirish.', pts:420, level:'Qiyin', progress:0.05},
  {id:'daily', title:'Daily Challenge', tag:'Mashq', desc:'Har kunlik bitta qiziqarli masala.', pts:90, level:'Oson', progress:0.78},
];

const tags = ['Hammasi','Mashq','Dars','Test','Olimp'];
const chips = document.getElementById('chips');
const grid = document.getElementById('grid');
const q = document.getElementById('q');
const clearBtn = document.getElementById('clear');

const sheet = document.getElementById('sheet');
const sTag = document.getElementById('sTag');
const sTitle = document.getElementById('sTitle');
const sDesc = document.getElementById('sDesc');
const sMeta = document.getElementById('sMeta');
const sClose = document.getElementById('sClose');
const sStart = document.getElementById('sStart');
const sFav = document.getElementById('sFav');

const favKey='lm_favs';
const favs = new Set(JSON.parse(localStorage.getItem(favKey)||'[]'));

let activeTag='Hammasi';

function saveFavs(){ localStorage.setItem(favKey, JSON.stringify([...favs])); }

function chipEl(t){
  const b=document.createElement('button');
  b.className='chip'+(t===activeTag?' active':'');
  b.textContent=t;
  b.onclick=()=>{ activeTag=t; [...chips.children].forEach(x=>x.classList.remove('active')); b.classList.add('active'); render(); };
  return b;
}

tags.forEach(t=>chips.appendChild(chipEl(t)));

function matches(item, query){
  if(activeTag!=='Hammasi' && item.tag!==activeTag) return false;
  if(!query) return true;
  query=query.toLowerCase();
  return (item.title+' '+item.desc+' '+item.tag).toLowerCase().includes(query);
}

function card(item){
  const d=document.createElement('div');
  d.className='card';
  const isFav=favs.has(item.id);
  d.innerHTML = `
    <div class="top">
      <div class="tag">${item.tag}</div>
      <div class="star ${isFav?'on':''}" title="Favorite">${isFav?'★':'☆'}</div>
    </div>
    <div class="title">${item.title}</div>
    <div class="desc">${item.desc}</div>
    <div class="progress"><i style="width:${Math.round(item.progress*100)}%"></i></div>
    <div class="row">
      <span class="pill">Ball: ${item.pts}</span>
      <span class="pill">Daraja: ${item.level}</span>
      <span class="pill">Progress: ${Math.round(item.progress*100)}%</span>
    </div>
  `;
  d.querySelector('.star').onclick=(e)=>{
    e.stopPropagation();
    if(favs.has(item.id)) favs.delete(item.id); else favs.add(item.id);
    saveFavs(); render();
  };
  d.onclick=()=>openSheet(item);
  return d;
}

function render(){
  const query=q.value||'';
  grid.innerHTML='';
  data.filter(it=>matches(it, query)).forEach(it=>grid.appendChild(card(it)));
  if(!grid.children.length){
    const p=document.createElement('div');
    p.className='card';
    p.style.cursor='default';
    p.innerHTML = `<div class="title">Topilmadi</div><div class="desc">Qidiruvni o‘zgartiring yoki boshqa chip tanlang.</div>`;
    grid.appendChild(p);
  }
}

function openSheet(item){
  sTag.textContent=item.tag;
  sTitle.textContent=item.title;
  sDesc.textContent=item.desc;
  sMeta.innerHTML = `
    <span class="pill">Ball: ${item.pts}</span>
    <span class="pill">Daraja: ${item.level}</span>
    <span class="pill">Progress: ${Math.round(item.progress*100)}%</span>
  `;
  sFav.textContent = favs.has(item.id) ? '★ Favorite (o‘chirish)' : '★ Favorite';
  sFav.onclick=()=>{
    if(favs.has(item.id)) favs.delete(item.id); else favs.add(item.id);
    saveFavs(); render(); openSheet(item);
  };
  sStart.onclick=()=>alert('Demo: "'+item.title+'" start ✅');
  sheet.hidden=false;
}

function closeSheet(){ sheet.hidden=true; }
sheet.addEventListener('click',(e)=>{ if(e.target===sheet) closeSheet(); });
sClose.onclick=closeSheet;

q.addEventListener('input', render);
clearBtn.onclick=()=>{ q.value=''; q.focus(); render(); };

render();

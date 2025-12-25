const courses = [
  {id:'a1', title:'Algebra 1', desc:'Ifodalar, tenglama, tengsizlik.', lvl:'Oson', lessons:18},
  {id:'a2', title:'Algebra 2', desc:'Funksiyalar, progressiyalar.', lvl:'O‘rtacha', lessons:24},
  {id:'g1', title:'Geometriya 1', desc:'Uchburchaklar va aylana.', lvl:'Oson', lessons:16},
  {id:'g2', title:'Geometriya 2', desc:'Ko‘pburchaklar, stereometriya.', lvl:'Qiyin', lessons:22},
  {id:'t1', title:'Test Strategiya', desc:'Testlarda tez ishlash yo‘llari.', lvl:'O‘rtacha', lessons:12},
  {id:'o1', title:'Olimpiada start', desc:'Kombinatorika va mantiq.', lvl:'Qiyin', lessons:20},
];

const lvlList=['Hammasi','Oson','O‘rtacha','Qiyin'];
const lvlWrap=document.getElementById('lvl');
const grid=document.getElementById('grid');
const goal=document.getElementById('goal');
const goalBar=document.getElementById('goalBar');

const progKey='lm_course_progress';
const cont = JSON.parse(localStorage.getItem(progKey)||'{}'); // {id: {done:number}}

let activeLvl='Hammasi';
let seg='all';

function computeGoal(){
  // goal: 3 lesson/day (demo)
  const doneToday = Object.values(cont).reduce((a,x)=>a+(x.doneToday||0),0);
  const target = 3;
  goal.textContent = `${Math.min(doneToday,target)} / ${target}`;
  goalBar.style.width = `${Math.min(100, (doneToday/target)*100)}%`;
}

function chip(t){
  const b=document.createElement('button');
  b.className='chip'+(t===activeLvl?' active':'');
  b.textContent=t;
  b.onclick=()=>{ activeLvl=t; [...lvlWrap.children].forEach(x=>x.classList.remove('active')); b.classList.add('active'); render(); };
  return b;
}
lvlList.forEach(t=>lvlWrap.appendChild(chip(t)));

document.querySelectorAll('.segBtn').forEach(b=>{
  b.onclick=()=>{
    seg=b.dataset.s;
    document.querySelectorAll('.segBtn').forEach(x=>x.removeAttribute('aria-current'));
    b.setAttribute('aria-current','page');
    render();
  };
});

function getProgress(id){
  const p=cont[id]||{done:0, doneToday:0};
  return p;
}
function setProgress(id, patch){
  cont[id]={...(cont[id]||{done:0,doneToday:0}), ...patch};
  localStorage.setItem(progKey, JSON.stringify(cont));
  computeGoal();
}

function card(c){
  const p=getProgress(c.id);
  const percent=Math.round(Math.min(100,(p.done/c.lessons)*100));
  const d=document.createElement('div');
  d.className='card';
  d.innerHTML = `
    <div class="row">
      <div>
        <div class="title">${c.title}</div>
        <div class="desc">${c.desc}</div>
      </div>
      <div class="pill">${c.lvl}</div>
    </div>
    <div class="pills">
      <span class="pill">Dars: ${p.done}/${c.lessons}</span>
      <span class="pill">Progress: ${percent}%</span>
      ${p.done>0?'<span class="pill">Davom etish</span>':''}
    </div>
    <div class="bar"><i style="width:${percent}%"></i></div>
    <div class="actions">
      <button class="btn ghost" data-act="reset">Reset</button>
      <button class="btn" data-act="next">${p.done>0?'Davom etish':'Boshlash'}</button>
    </div>
  `;
  d.querySelector('[data-act="next"]').onclick=()=>{
    const nextDone=Math.min(c.lessons, p.done+1);
    setProgress(c.id, {done: nextDone, doneToday: (p.doneToday||0)+1});
    render();
  };
  d.querySelector('[data-act="reset"]').onclick=()=>{
    setProgress(c.id, {done:0, doneToday:0});
    render();
  };
  return d;
}

function allowed(c){
  if(activeLvl!=='Hammasi' && c.lvl!==activeLvl) return false;
  const p=getProgress(c.id);
  if(seg==='new' && p.done>0) return false;
  if(seg==='cont' && p.done===0) return false;
  return true;
}

function render(){
  grid.innerHTML='';
  courses.filter(allowed).forEach(c=>grid.appendChild(card(c)));
  if(!grid.children.length){
    const e=document.createElement('div');
    e.className='card';
    e.innerHTML = `<div class="title">Topilmadi</div><div class="desc">Filterlarni o‘zgartiring.</div>`;
    grid.appendChild(e);
  }
}
computeGoal();
render();

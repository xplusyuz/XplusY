import { db, createDoc, toast } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById('testGrid');
const tType = document.getElementById('tType');
const tCat = document.getElementById('tCat');
const tSearch = document.getElementById('tSearch');
const CATS = ["Algebra","Geometriya","Mantiq","Arifmetika"];
for(const v of CATS){ tCat.insertAdjacentHTML('beforeend', `<option>${v}</option>`); }

function now(){ return Date.now(); }
function within(d){
  if(d.type!=='online') return true;
  const s = d.start ? new Date(d.start).getTime() : 0;
  const e = d.end ? new Date(d.end).getTime() : 0;
  return now()>=s && now()<=e;
}
function countdown(d){
  if(d.type!=='online') return '';
  const s = new Date(d.start).getTime();
  const e = new Date(d.end).getTime();
  const t = now()<s ? (s-now()) : (now()<e ? (e-now()):0);
  if(t<=0) return 'Tugadi';
  const sec = Math.floor(t/1000);
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s2 = String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s2}`;
}
function cardHTML(d){
  const badge = d.type==='online' ? `<span class="badge pro">online</span>` : `<span class="badge free">oddiy</span>`;
  const timer = d.type==='online' ? `<div class="meta">Boshlanish: ${d.start||'-'} • Tugash: ${d.end||'-'} • Qolgan: <b class="cd"></b></div>` : '';
  const btn = (d.type==='online')
    ? (within(d) ? `<a class="btn pri" target="_blank" href="${d.link||'#'}">Boshlash</a>` : `<button class="btn" disabled>Vaqti emas</button>`)
    : (d.link ? `<a class="btn pri" target="_blank" href="${d.link}">Boshlash</a>` : `<button class="btn" disabled>Havola yo‘q</button>`);
  return `<article class="card">
    <div class="media"><img src="${d.image||''}" alt=""><div class="badge-wrap">${badge}</div></div>
    <div class="body">
      <h3 class="title">${d.title||'—'}</h3>
      <div class="meta">${[d.cat, d.type].filter(Boolean).join(' • ')}</div>
      ${timer}
      <p>${d.info||''}</p>
    </div>
    <div class="actions">${btn}</div>
  </article>`;
}
async function render(){
  grid.innerHTML='';
  const snap = await getDocs(query(collection(db,'tests'), orderBy('createdAt','desc'), limit(60)));
  const els = [];
  snap.forEach(doc=>{
    const d = doc.data();
    if(tType.value && d.type!==tType.value) return;
    if(tCat.value && d.cat!==tCat.value) return;
    if(tSearch.value && !JSON.stringify(d).toLowerCase().includes(tSearch.value.toLowerCase())) return;
    els.push(d);
  });
  els.sort((a,b)=> (a.type==='online'? -1:1)); // onlinelar birinchi
  for(const d of els){ grid.insertAdjacentHTML('beforeend', cardHTML(d)); }
  // countdown
  const cards = [...grid.querySelectorAll('.card')];
  if(cards.some(c=>c.querySelector('.cd'))){
    const tick = ()=>{
      let i=0;
      cards.forEach(card=>{
        const d = els[i++];
        const c = card.querySelector('.cd');
        if(c) c.textContent = countdown(d);
      });
    };
    tick(); setInterval(tick,1000);
  }
}
['change','input'].forEach(ev=>[tType,tCat,tSearch].forEach(el=>el.addEventListener(ev, render)));
async function mountAdmin(){
  const box = document.getElementById('adminContent');
  box.innerHTML = `
    <h3>Test qo‘shish</h3>
    <div class="field"><label>Turi</label>
      <select id="type"><option value="online">online</option><option value="oddiy">oddiy</option></select></div>
    <div class="field"><label>Nomi</label><input id="title"></div>
    <div class="field"><label>Info</label><textarea id="info"></textarea></div>
    <div class="field"><label>Rasm</label><input id="image"></div>
    <div class="field"><label>Bo‘lim</label><select id="cat">${CATS.map(v=>`<option>${v}</option>`).join('')}</select></div>
    <div class="field"><label>Havola</label><input id="link"></div>
    <div id="onlineFields">
      <div class="field"><label>Boshlash (YYYY-MM-DD HH:MM)</label><input id="start" placeholder="2025-09-25 10:00"></div>
      <div class="field"><label>Tugash (YYYY-MM-DD HH:MM)</label><input id="end" placeholder="2025-09-25 12:00"></div>
    </div>
    <button class="btn pri full" id="save">Saqlash</button>
  `;
  const typeSel = box.querySelector('#type');
  const onlineFields = box.querySelector('#onlineFields');
  function syncType(){ onlineFields.style.display = typeSel.value==='online' ? 'block':'none'; }
  typeSel.addEventListener('change', syncType); syncType();
  box.querySelector('#save').addEventListener('click', async ()=>{
    const d = {
      type: typeSel.value,
      title: box.querySelector('#title').value.trim(),
      info: box.querySelector('#info').value.trim(),
      image: box.querySelector('#image').value.trim(),
      cat: box.querySelector('#cat').value,
      link: box.querySelector('#link').value.trim()
    };
    if(!d.title) return alert('Nomi shart');
    if(d.type==='online'){
      d.start = box.querySelector('#start').value.trim();
      d.end   = box.querySelector('#end').value.trim();
    }
    try{ await createDoc('tests', d); toast('Test qo‘shildi'); render(); } catch(e){ alert(e.message); }
  });
}
mountAdmin(); render();

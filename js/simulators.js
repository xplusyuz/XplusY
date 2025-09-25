import { db, createDoc, toast } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById('simGrid');
const sCat = document.getElementById('sCat');
const sLevel = document.getElementById('sLevel');
const sSearch = document.getElementById('sSearch');

const CATS = ["Arifmetika","Mantiq","Algebra","Geometriya"];
const LEVEL = ["Boshlang‘ich","O‘rta","Qiyin"];
for(const v of CATS){ sCat.insertAdjacentHTML('beforeend', `<option>${v}</option>`); }
for(const v of LEVEL){ sLevel.insertAdjacentHTML('beforeend', `<option>${v}</option>`); }

function cardHTML(d){
  const badge = d.price && Number(d.price)>0 ? `<span class="badge pro">pro</span>` : `<span class="badge free">free</span>`;
  return `<article class="card">
    <div class="media"><img src="${d.image||''}" alt=""><div class="badge-wrap">${badge}</div></div>
    <div class="body">
      <h3 class="title">${d.title||'—'}</h3>
      <div class="meta">${[d.cat, d.level].filter(Boolean).join(' • ')}</div>
      <p>${d.info||''}</p>
    </div>
    <div class="actions">
      ${d.link ? `<a class="btn pri" href="${d.link}" target="_blank">Ishga tushurish</a>`: '<button class="btn" disabled>Havola yo‘q</button>'}
    </div>
  </article>`;
}

async function render(){
  grid.innerHTML='';
  const snap = await getDocs(query(collection(db,'simulators'), orderBy('createdAt','desc'), limit(60)));
  snap.forEach(doc=>{
    const d = doc.data();
    if(sCat.value && d.cat!==sCat.value) return;
    if(sLevel.value && d.level!==sLevel.value) return;
    if(sSearch.value && !JSON.stringify(d).toLowerCase().includes(sSearch.value.toLowerCase())) return;
    grid.insertAdjacentHTML('beforeend', cardHTML(d));
  });
}

['change','input'].forEach(ev=>[sCat,sLevel,sSearch].forEach(el=>el.addEventListener(ev, render)));

async function mountAdmin(){
  const box = document.getElementById('adminContent');
  box.innerHTML = `
    <h3>Simulyator qo‘shish</h3>
    <div class="field"><label>Nomi</label><input id="title"></div>
    <div class="field"><label>Info</label><textarea id="info"></textarea></div>
    <div class="field"><label>Rasm</label><input id="image"></div>
    <div class="field"><label>Havola</label><input id="link"></div>
    <div class="field"><label>Bo‘lim</label><select id="cat">${CATS.map(v=>`<option>${v}</option>`).join('')}</select></div>
    <div class="field"><label>Daraja</label><select id="level">${LEVEL.map(v=>`<option>${v}</option>`).join('')}</select></div>
    <div class="field"><label>Narx</label><input id="price" type="number" min="0" value="0"></div>
    <button class="btn pri full" id="save">Saqlash</button>
  `;
  box.querySelector('#save').addEventListener('click', async ()=>{
    const d = {
      title: box.querySelector('#title').value.trim(),
      info: box.querySelector('#info').value.trim(),
      image: box.querySelector('#image').value.trim(),
      link: box.querySelector('#link').value.trim(),
      cat: box.querySelector('#cat').value,
      level: box.querySelector('#level').value,
      price: Number(box.querySelector('#price').value||0)
    };
    if(!d.title) return alert('Nomi shart');
    try{ await createDoc('simulators', d); toast('Simulyator qo‘shildi'); render(); } catch(e){ alert(e.message); }
  });
}
mountAdmin(); render();

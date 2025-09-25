import { db, createDoc, toast } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById('courseGrid');
const fCat = document.getElementById('fCat');
const fGrade = document.getElementById('fGrade');
const fTerm = document.getElementById('fTerm');
const search = document.getElementById('search');

const FACETS = { cat: ["Algebra","Geometriya","Mantiq","Arifmetika"], grade: ["5-sinf","6-sinf","7-sinf","8-sinf","9-sinf","10-sinf","11-sinf"], term: ["1-chorak","2-chorak","3-chorak","4-chorak"] };
for(const v of FACETS.cat){ fCat.insertAdjacentHTML('beforeend', `<option>${v}</option>`); }
for(const v of FACETS.grade){ fGrade.insertAdjacentHTML('beforeend', `<option>${v}</option>`); }
for(const v of FACETS.term){ fTerm.insertAdjacentHTML('beforeend', `<option>${v}</option>`); }

function cardHTML(d){
  const badge = (d.price && Number(d.price)>0) ? `<span class="badge pro">pro</span>` : `<span class="badge free">free</span>`;
  return `<article class="card">
    <div class="media"><img src="${d.image||''}" alt=""><div class="badge-wrap">${badge}</div></div>
    <div class="body">
      <h3 class="title">${d.title||'—'}</h3>
      <div class="meta">${[d.cat,d.grade,d.term].filter(Boolean).join(' • ')}</div>
      <p>${d.info||''}</p>
    </div>
    <div class="actions">
      ${d.link ? `<a class="btn" href="${d.link}" target="_blank">Batafsil</a>`:''}
      <button class="btn pri">Boshlash</button>
    </div>
  </article>`;
}

async function render(){
  grid.innerHTML='';
  const snap = await getDocs(query(collection(db,'courses'), orderBy('createdAt','desc'), limit(60)));
  snap.forEach(doc=>{
    const d = doc.data();
    if(fCat.value && d.cat!==fCat.value) return;
    if(fGrade.value && d.grade!==fGrade.value) return;
    if(fTerm.value && d.term!==fTerm.value) return;
    if(search.value && !JSON.stringify(d).toLowerCase().includes(search.value.toLowerCase())) return;
    grid.insertAdjacentHTML('beforeend', cardHTML(d));
  });
}

['change','input'].forEach(ev=>[fCat,fGrade,fTerm,search].forEach(el=>el.addEventListener(ev, render)));

async function mountAdmin(){
  const box = document.getElementById('adminContent');
  box.innerHTML = `
    <h3>Kurs qo‘shish</h3>
    <div class="field"><label>Nomi</label><input id="cTitle"></div>
    <div class="field"><label>Info</label><textarea id="cInfo"></textarea></div>
    <div class="field"><label>Rasm URL (yoki img/…)</label><input id="cImg"></div>
    <div class="field"><label>Havola</label><input id="cLink"></div>
    <div class="field"><label>Narx (0 — free)</label><input id="cPrice" type="number" min="0" value="0"></div>
    <div class="field"><label>Bo‘lim</label><select id="cCat">${FACETS.cat.map(v=>`<option>${v}</option>`).join('')}</select></div>
    <div class="field"><label>Sinf</label><select id="cGrade">${FACETS.grade.map(v=>`<option>${v}</option>`).join('')}</select></div>
    <div class="field"><label>Chorak</label><select id="cTerm">${FACETS.term.map(v=>`<option>${v}</option>`).join('')}</select></div>
    <button class="btn pri full" id="cSave">Saqlash</button>
  `;
  box.querySelector('#cSave').addEventListener('click', async ()=>{
    const d = {
      title: box.querySelector('#cTitle').value.trim(),
      info: box.querySelector('#cInfo').value.trim(),
      image: box.querySelector('#cImg').value.trim(),
      link: box.querySelector('#cLink').value.trim(),
      price: Number(box.querySelector('#cPrice').value||0),
      cat: box.querySelector('#cCat').value,
      grade: box.querySelector('#cGrade').value,
      term: box.querySelector('#cTerm').value,
    };
    if(!d.title) return alert('Nomi shart');
    try{ await createDoc('courses', d); toast('Kurs qo‘shildi'); render(); } catch(e){ alert(e.message); }
  });
}
mountAdmin(); render();

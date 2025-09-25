import { db, listLatest, createDoc, updateDocById, deleteDocById, adminAllowed } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById('courseGrid');

function card(d){
  const badge = d.price && Number(d.price)>0 ? `<span class="badge pro">pro</span>` : `<span class="badge free">free</span>`;
  return `<article class="card">
    <div class="media"><img src="${d.image||''}" alt=""><div class="badge-wrap">${badge}</div></div>
    <div class="body">
      <h3 class="title">${d.title||'—'}</h3>
      <div class="meta">${[d.cat,d.grade,d.term].filter(Boolean).join(' • ')}</div>
      <p>${d.info||''}</p>
    </div>
    <div class="actions">
      ${d.link?`<a class="btn" href="${d.link}" target="_blank">Batafsil</a>`:''}
      <button class="btn pri">Boshlash</button>
    </div>
  </article>`;
}

async function render(){
  grid.innerHTML='';
  const snap = await getDocs(query(collection(db,'courses'), orderBy('createdAt','desc'), limit(60)));
  snap.forEach(docu=>{ grid.insertAdjacentHTML('beforeend', card({id:docu.id, ...docu.data()})); });
}

async function mountAdmin(){
  const box = document.getElementById('adminContent');
  if(!adminAllowed()){ box.innerHTML = '<p>Admin huquqi talab qilinadi.</p>'; return; }
  box.innerHTML = `
    <h3>Kurs qo‘shish</h3>
    <div class="field"><label>Nomi</label><input id="cTitle"></div>
    <div class="field"><label>Info</label><textarea id="cInfo"></textarea></div>
    <div class="field"><label>Rasm URL</label><input id="cImg"></div>
    <div class="field"><label>Havola</label><input id="cLink"></div>
    <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div class="field"><label>Bo‘lim</label><input id="cCat" placeholder="Algebra"></div>
      <div class="field"><label>Sinf</label><input id="cGrade" placeholder="7-sinf"></div>
      <div class="field"><label>Chorak</label><input id="cTerm" placeholder="2-chorak"></div>
    </div>
    <div class="field"><label>Narx</label><input id="cPrice" type="number" min="0" value="0"></div>
    <button class="btn pri full" id="cSave">Saqlash</button>
    <hr/>
    <h3>Hozirgi kurslar</h3>
    <div class="list" id="cList"></div>
  `;
  async function loadList(){
    const list = box.querySelector('#cList'); list.innerHTML='';
    const snap = await getDocs(query(collection(db,'courses'), orderBy('createdAt','desc'), limit(100)));
    snap.forEach(docu=>{
      const d = {id:docu.id, ...docu.data()};
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><b>${d.title||'—'}</b><div class="meta">${[d.cat,d.grade,d.term].filter(Boolean).join(' • ')}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn" data-edit="${d.id}">Edit</button>
          <button class="btn danger" data-del="${d.id}">Delete</button>
        </div>`;
      list.appendChild(row);
    });
  }
  box.querySelector('#cSave').addEventListener('click', async ()=>{
    const d = {
      title: box.querySelector('#cTitle').value.trim(),
      info: box.querySelector('#cInfo').value.trim(),
      image: box.querySelector('#cImg').value.trim(),
      link: box.querySelector('#cLink').value.trim(),
      cat: box.querySelector('#cCat').value.trim(),
      grade: box.querySelector('#cGrade').value.trim(),
      term: box.querySelector('#cTerm').value.trim(),
      price: Number(box.querySelector('#cPrice').value||0)
    };
    if(!d.title) return alert('Nomi shart');
    const id = await createDoc('courses', d);
    await loadList(); render();
  });
  box.addEventListener('click', async (e)=>{
    const id = e.target.dataset?.del; const eid = e.target.dataset?.edit;
    if(id){ if(confirm('O‘chirish?')){ await deleteDocById('courses', id); await loadList(); render(); } }
    if(eid){
      const title = prompt('Nomi'); if(!title) return;
      await updateDocById('courses', eid, { title });
      await loadList(); render();
    }
  });
  await loadList();
}

render(); mountAdmin();

import { db, createDoc, updateDocById, deleteDocById, adminAllowed } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById('simGrid');

function card(d){
  const badge = d.price && Number(d.price)>0 ? `<span class="badge pro">pro</span>` : `<span class="badge free">free</span>`;
  return `<article class="card">
    <div class="media"><img src="${d.image||''}" alt=""><div class="badge-wrap">${badge}</div></div>
    <div class="body"><h3 class="title">${d.title||'—'}</h3><div class="meta">${[d.cat,d.level].filter(Boolean).join(' • ')}</div><p>${d.info||''}</p></div>
    <div class="actions">${d.link?`<a class="btn pri" href="${d.link}" target="_blank">Ishga tushurish</a>`:'<button class="btn" disabled>Havola yo‘q</button>'}</div>
  </article>`;
}

async function render(){
  grid.innerHTML='';
  const snap = await getDocs(query(collection(db,'simulators'), orderBy('createdAt','desc'), limit(60)));
  snap.forEach(docu=> grid.insertAdjacentHTML('beforeend', card({id:docu.id, ...docu.data()})));
}

async function mountAdmin(){
  const box = document.getElementById('adminContent');
  if(!adminAllowed()){ box.innerHTML = '<p>Admin huquqi talab qilinadi.</p>'; return; }
  box.innerHTML = `
    <h3>Simulyator qo‘shish</h3>
    <div class="field"><label>Nomi</label><input id="sTitle"></div>
    <div class="field"><label>Info</label><textarea id="sInfo"></textarea></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Bo‘lim</label><input id="sCat" placeholder="Algebra"></div>
      <div class="field"><label>Daraja</label><input id="sLevel" placeholder="Boshlang‘ich/O‘rta/Qiyin"></div>
    </div>
    <div class="field"><label>Rasm</label><input id="sImage"></div>
    <div class="field"><label>Havola</label><input id="sLink"></div>
    <div class="field"><label>Narx</label><input id="sPrice" type="number" min="0" value="0"></div>
    <button class="btn pri full" id="sSave">Saqlash</button>
    <hr/>
    <h3>Simulyatorlar</h3>
    <div class="list" id="sList"></div>
  `;
  async function loadList(){
    const list = box.querySelector('#sList'); list.innerHTML='';
    const snap = await getDocs(query(collection(db,'simulators'), orderBy('createdAt','desc'), limit(100)));
    snap.forEach(docu=>{
      const d = {id:docu.id, ...docu.data()};
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><b>${d.title||'—'}</b><div class="meta">${[d.cat,d.level].filter(Boolean).join(' • ')}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn" data-edit="${d.id}">Edit</button>
          <button class="btn danger" data-del="${d.id}">Delete</button>
        </div>`;
      list.appendChild(row);
    });
  }
  box.querySelector('#sSave').addEventListener('click', async ()=>{
    const d = {
      title: box.querySelector('#sTitle').value.trim(),
      info: box.querySelector('#sInfo').value.trim(),
      cat: box.querySelector('#sCat').value.trim(),
      level: box.querySelector('#sLevel').value.trim(),
      image: box.querySelector('#sImage').value.trim(),
      link: box.querySelector('#sLink').value.trim(),
      price: Number(box.querySelector('#sPrice').value||0)
    };
    if(!d.title) return alert('Nomi shart');
    await createDoc('simulators', d); await loadList(); render();
  });
  box.addEventListener('click', async (e)=>{
    const id = e.target.dataset?.del; const eid = e.target.dataset?.edit;
    if(id){ if(confirm('O‘chirish?')){ await deleteDocById('simulators', id); await loadList(); render(); } }
    if(eid){ const title = prompt('Yangi nom'); if(!title) return; await updateDocById('simulators', eid, { title }); await loadList(); render(); }
  });
  await loadList();
}

render(); mountAdmin();

// augment admin drawer for index page
import { db, adminAllowed, createDoc, updateDocById, deleteDocById } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

(async function(){
  const box = document.getElementById('adminContent');
  if(!box) return;
  if(!adminAllowed()){ box.innerHTML = '<p>Admin huquqi talab qilinadi.</p>'; return; }
  box.innerHTML = `
    <h3>Banner qo‘shish</h3>
    <div class="field"><label>Rasm URL</label><input id="bImg"></div>
    <div class="field"><label>Havola</label><input id="bLink"></div>
    <button class="btn pri full" id="bSave">Saqlash</button>
    <hr/>
    <h3>Bannerlar</h3>
    <div class="list" id="bList"></div>
  `;
  async function loadList(){
    const l = document.getElementById('bList'); l.innerHTML='';
    const snap = await getDocs(query(collection(db,'home_banners'), orderBy('createdAt','desc'), limit(20)));
    snap.forEach(docu=>{
      const d = {id:docu.id, ...docu.data()};
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><b>${d.image||'rasm'}</b><div class="meta">${d.link||''}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn" data-edit="${d.id}">Edit</button>
          <button class="btn danger" data-del="${d.id}">Delete</button>
        </div>`;
      l.appendChild(row);
    });
  }
  document.getElementById('bSave').addEventListener('click', async ()=>{
    const d = { image: document.getElementById('bImg').value.trim(), link: document.getElementById('bLink').value.trim() };
    if(!d.image) return alert('Rasm URL shart');
    await createDoc('home_banners', d); await loadList();
  });
  document.getElementById('adminContent').addEventListener('click', async (e)=>{
    const id = e.target.dataset?.del; const eid = e.target.dataset?.edit;
    if(id){ if(confirm('O‘chirish?')){ await deleteDocById('home_banners', id); await loadList(); } }
    if(eid){ const link = prompt('Yangi havola'); if(!link) return; await updateDocById('home_banners', eid, { link }); await loadList(); }
  });
  await loadList();
})();

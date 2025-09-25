import { db, createDoc, updateDocById, deleteDocById, adminAllowed } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById('testGrid');

function within(d){
  if(d.type!=='online') return true;
  const s = d.start ? new Date(d.start).getTime() : 0;
  const e = d.end ? new Date(d.end).getTime() : 0;
  const now = Date.now(); return now>=s && now<=e;
}
function card(d){
  const badge = d.type==='online'?`<span class="badge pro">online</span>`:`<span class="badge free">oddiy</span>`;
  const timer = d.type==='online'?`<div class="meta">Boshlanish: ${d.start||'-'} • Tugash: ${d.end||'-'}</div>`:'';
  const btn = (d.type==='online') ? (within(d)?`<a class="btn pri" href="${d.link||'#'}" target="_blank">Boshlash</a>`:`<button class="btn" disabled>Vaqti emas</button>`) : (d.link?`<a class="btn pri" href="${d.link}" target="_blank">Boshlash</a>`:`<button class="btn" disabled>Havola yo‘q</button>`);
  return `<article class="card"><div class="media"><img src="${d.image||''}"><div class="badge-wrap">${badge}</div></div><div class="body"><h3 class="title">${d.title||'—'}</h3><div class="meta">${[d.cat,d.type].filter(Boolean).join(' • ')}</div>${timer}<p>${d.info||''}</p></div><div class="actions">${btn}</div></article>`;
}

async function render(){
  grid.innerHTML='';
  const snap = await getDocs(query(collection(db,'tests'), orderBy('createdAt','desc'), limit(60)));
  const arr = []; snap.forEach(d=>arr.push({id:d.id, ...d.data()}));
  arr.sort((a,b)=>(a.type==='online'?-1:1));
  arr.forEach(d=> grid.insertAdjacentHTML('beforeend', card(d)));
}

async function mountAdmin(){
  const box = document.getElementById('adminContent');
  if(!adminAllowed()){ box.innerHTML = '<p>Admin huquqi talab qilinadi.</p>'; return; }
  box.innerHTML = `
    <h3>Test qo‘shish</h3>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Turi</label><select id="tType"><option value="online">online</option><option value="oddiy">oddiy</option></select></div>
      <div class="field"><label>Bo‘lim</label><input id="tCat" placeholder="Algebra"></div>
    </div>
    <div class="field"><label>Nomi</label><input id="tTitle"></div>
    <div class="field"><label>Info</label><textarea id="tInfo"></textarea></div>
    <div class="field"><label>Rasm</label><input id="tImage"></div>
    <div class="field"><label>Havola</label><input id="tLink"></div>
    <div class="grid" id="onlineFields" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Boshlash (YYYY-MM-DD HH:MM)</label><input id="tStart"></div>
      <div class="field"><label>Tugash (YYYY-MM-DD HH:MM)</label><input id="tEnd"></div>
    </div>
    <button class="btn pri full" id="tSave">Saqlash</button>
    <hr/>
    <h3>Testlar</h3>
    <div class="list" id="tList"></div>
  `;
  const typeSel = box.querySelector('#tType'); const onlineFields = box.querySelector('#onlineFields');
  function syncType(){ onlineFields.style.display = typeSel.value==='online' ? 'grid' : 'none'; }
  typeSel.addEventListener('change', syncType); syncType();

  async function loadList(){
    const list = box.querySelector('#tList'); list.innerHTML='';
    const snap = await getDocs(query(collection(db,'tests'), orderBy('createdAt','desc'), limit(100)));
    snap.forEach(docu=>{
      const d = {id:docu.id, ...docu.data()};
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><b>${d.title||'—'}</b><div class="meta">${[d.cat,d.type].filter(Boolean).join(' • ')}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn" data-edit="${d.id}">Edit</button>
          <button class="btn danger" data-del="${d.id}">Delete</button>
        </div>`;
      list.appendChild(row);
    });
  }
  box.querySelector('#tSave').addEventListener('click', async ()=>{
    const d = {
      type: typeSel.value,
      cat: box.querySelector('#tCat').value.trim(),
      title: box.querySelector('#tTitle').value.trim(),
      info: box.querySelector('#tInfo').value.trim(),
      image: box.querySelector('#tImage').value.trim(),
      link: box.querySelector('#tLink').value.trim()
    };
    if(d.type==='online'){ d.start = box.querySelector('#tStart').value.trim(); d.end = box.querySelector('#tEnd').value.trim(); }
    if(!d.title) return alert('Nomi shart');
    await createDoc('tests', d); await loadList(); render();
  });
  box.addEventListener('click', async (e)=>{
    const id = e.target.dataset?.del; const eid = e.target.dataset?.edit;
    if(id){ if(confirm('O‘chirish?')){ await deleteDocById('tests', id); await loadList(); render(); } }
    if(eid){ const title = prompt('Yangi nom'); if(!title) return; await updateDocById('tests', eid, { title }); await loadList(); render(); }
  });
  await loadList();
}

render(); mountAdmin();

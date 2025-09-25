import { db, adminAllowed, createDoc, updateDocById, deleteDocById } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById('simGrid');
// ---------- Simple admin modal utility ----------
function ensureModal(){
  let m = document.getElementById('adminModal');
  if(!m){
    m = document.createElement('div');
    m.id = 'adminModal';
    m.className = 'modal';
    m.innerHTML = `<div class="panel"><div id="adminModalBody" class="pad"></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e)=>{ if(e.target===m) m.classList.remove('open'); });
  }
  return m;
}
function openFormModal(html, onMount){
  const m = ensureModal();
  m.querySelector('#adminModalBody').innerHTML = html;
  m.classList.add('open');
  if(onMount) onMount(m);
}


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
  const snap = await getDocs(query(collection(db,'simulators'), orderBy('createdAt','desc'), limit(120)));
  snap.forEach(docu=> grid.insertAdjacentHTML('beforeend', card({id:docu.id, ...docu.data()})));
}
function simForm(d={}){
  return `
  <h3>${d.id?'Simulyatorni tahrirlash':'Simulyator qo‘shish'}</h3>
  <div class="grid" style="gap:10px">
    <div class="field"><label>Nomi</label><input id="fTitle" value="${d.title||''}"></div>
    <div class="field"><label>Info</label><textarea id="fInfo">${d.info||''}</textarea></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Bo‘lim</label><input id="fCat" value="${d.cat||''}"></div>
      <div class="field"><label>Daraja</label><input id="fLevel" value="${d.level||''}"></div>
    </div>
    <div class="field"><label>Rasm</label><input id="fImage" value="${d.image||''}"></div>
    <div class="field"><label>Havola</label><input id="fLink" value="${d.link||''}"></div>
    <div class="field"><label>Narx</label><input id="fPrice" type="number" value="${d.price||0}"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      ${d.id?`<button class="btn danger" id="fDelete">O‘chirish</button>`:''}
      <button class="btn pri" id="fSave">Saqlash</button>
    </div>
  </div>`;
}
async function mountAdmin(){
  const box = document.getElementById('adminContent');
  if(!box) return;
  if(!adminAllowed()){ box.innerHTML = '<p>Admin huquqi talab qilinadi.</p>'; return; }
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h3>Simulyatorlar</h3>
      <button class="btn pri" id="addNew">Yangi simulyator</button>
    </div>
    <div class="list" id="sList"></div>
  `;
  async function loadList(){
    const list = box.querySelector('#sList'); list.innerHTML='';
    const snap = await getDocs(query(collection(db,'simulators'), orderBy('createdAt','desc'), limit(200)));
    snap.forEach(docu=>{
      const d = {id:docu.id, ...docu.data()};
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><b>${d.title||'—'}</b><div class="meta">${[d.cat,d.level].filter(Boolean).join(' • ')}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn" data-edit="${d.id}">Edit</button>
          <a class="btn" href="${d.link||'#'}" target="_blank">Ko‘rish</a>
        </div>`;
      list.appendChild(row);
    });
  }
  box.addEventListener('click', async (e)=>{
    const eid = e.target.dataset?.edit;
    if(eid){
      const snap = await getDoc(doc(db,'simulators',eid));
      const d = {id:eid, ...snap.data()};
      openFormModal(simForm(d), (m)=>{
        m.querySelector('#fSave').addEventListener('click', async ()=>{
          const data = {
            title: m.querySelector('#fTitle').value.trim(),
            info: m.querySelector('#fInfo').value.trim(),
            cat: m.querySelector('#fCat').value.trim(),
            level: m.querySelector('#fLevel').value.trim(),
            image: m.querySelector('#fImage').value.trim(),
            link: m.querySelector('#fLink').value.trim(),
            price: Number(m.querySelector('#fPrice').value||0)
          };
          if(!data.title) return alert('Nomi shart');
          await updateDocById('simulators', d.id, data);
          m.classList.remove('open'); await loadList(); render();
        });
        const del=m.querySelector('#fDelete'); if(del) del.addEventListener('click', async ()=>{ if(confirm('O‘chirish?')){ await deleteDocById('simulators', d.id); m.classList.remove('open'); await loadList(); render(); } });
      });
    }
    if(e.target.id==='addNew'){
      openFormModal(simForm(), (m)=>{
        m.querySelector('#fSave').addEventListener('click', async ()=>{
          const data = {
            title: m.querySelector('#fTitle').value.trim(),
            info: m.querySelector('#fInfo').value.trim(),
            cat: m.querySelector('#fCat').value.trim(),
            level: m.querySelector('#fLevel').value.trim(),
            image: m.querySelector('#fImage').value.trim(),
            link: m.querySelector('#fLink').value.trim(),
            price: Number(m.querySelector('#fPrice').value||0)
          };
          if(!data.title) return alert('Nomi shart');
          await createDoc('simulators', data); m.classList.remove('open'); await loadList(); render();
        });
      });
    }
  });
  await loadList();
}
render(); mountAdmin();

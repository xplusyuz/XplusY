import { db, adminAllowed, createDoc, updateDocById, deleteDocById } from '../assets/app.js';
import { collection, getDocs, query, orderBy, limit, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const grid = document.getElementById('testGrid');
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
  const snap = await getDocs(query(collection(db,'tests'), orderBy('createdAt','desc'), limit(120)));
  const arr = []; snap.forEach(d=>arr.push({id:d.id, ...d.data()}));
  arr.sort((a,b)=>(a.type==='online'?-1:1));
  arr.forEach(d=> grid.insertAdjacentHTML('beforeend', card(d)));
}
function testForm(d={}){
  return `
  <h3>${d.id?'Testni tahrirlash':'Test qo‘shish'}</h3>
  <div class="grid" style="gap:10px">
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Turi</label><select id="fType"><option value="online" ${d.type==='online'?'selected':''}>online</option><option value="oddiy" ${d.type==='oddiy'?'selected':''}>oddiy</option></select></div>
      <div class="field"><label>Bo‘lim</label><input id="fCat" value="${d.cat||''}"></div>
    </div>
    <div class="field"><label>Nomi</label><input id="fTitle" value="${d.title||''}"></div>
    <div class="field"><label>Info</label><textarea id="fInfo">${d.info||''}</textarea></div>
    <div class="field"><label>Rasm</label><input id="fImage" value="${d.image||''}"></div>
    <div class="field"><label>Havola</label><input id="fLink" value="${d.link||''}"></div>
    <div class="grid" id="onlineFields" style="grid-template-columns:1fr 1fr;gap:8px">
      <div class="field"><label>Boshlash (YYYY-MM-DD HH:MM)</label><input id="fStart" value="${d.start||''}"></div>
      <div class="field"><label>Tugash (YYYY-MM-DD HH:MM)</label><input id="fEnd" value="${d.end||''}"></div>
    </div>
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
      <h3>Testlar</h3>
      <button class="btn pri" id="addNew">Yangi test</button>
    </div>
    <div class="list" id="tList"></div>
  `;
  async function loadList(){
    const list = box.querySelector('#tList'); list.innerHTML='';
    const snap = await getDocs(query(collection(db,'tests'), orderBy('createdAt','desc'), limit(200)));
    snap.forEach(docu=>{
      const d = {id:docu.id, ...docu.data()};
      const row = document.createElement('div'); row.className='item';
      row.innerHTML = `<div><b>${d.title||'—'}</b><div class="meta">${[d.cat,d.type].filter(Boolean).join(' • ')}</div></div>
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
      const snap = await getDoc(doc(db,'tests',eid));
      const d = {id:eid, ...snap.data()};
      openFormModal(testForm(d), (m)=>{
        function syncType(){ m.querySelector('#onlineFields').style.display = m.querySelector('#fType').value==='online' ? 'grid' : 'none'; }
        syncType(); m.querySelector('#fType').addEventListener('change', syncType);
        m.querySelector('#fSave').addEventListener('click', async ()=>{
          const data = {
            type: m.querySelector('#fType').value,
            cat: m.querySelector('#fCat').value.trim(),
            title: m.querySelector('#fTitle').value.trim(),
            info: m.querySelector('#fInfo').value.trim(),
            image: m.querySelector('#fImage').value.trim(),
            link: m.querySelector('#fLink').value.trim()
          };
          if(data.type==='online'){ data.start = m.querySelector('#fStart').value.trim(); data.end = m.querySelector('#fEnd').value.trim(); }
          if(!data.title) return alert('Nomi shart');
          await updateDocById('tests', d.id, data);
          m.classList.remove('open'); await loadList(); render();
        });
        const del=m.querySelector('#fDelete'); if(del) del.addEventListener('click', async ()=>{ if(confirm('O‘chirish?')){ await deleteDocById('tests', d.id); m.classList.remove('open'); await loadList(); render(); } });
      });
    }
    if(e.target.id==='addNew'){
      openFormModal(testForm(), (m)=>{
        function syncType(){ m.querySelector('#onlineFields').style.display = m.querySelector('#fType').value==='online' ? 'grid' : 'none'; }
        syncType(); m.querySelector('#fType').addEventListener('change', syncType);
        m.querySelector('#fSave').addEventListener('click', async ()=>{
          const data = {
            type: m.querySelector('#fType').value,
            cat: m.querySelector('#fCat').value.trim(),
            title: m.querySelector('#fTitle').value.trim(),
            info: m.querySelector('#fInfo').value.trim(),
            image: m.querySelector('#fImage').value.trim(),
            link: m.querySelector('#fLink').value.trim()
          };
          if(data.type==='online'){ data.start = m.querySelector('#fStart').value.trim(); data.end = m.querySelector('#fEnd').value.trim(); }
          if(!data.title) return alert('Nomi shart');
          await createDoc('tests', data); m.classList.remove('open'); await loadList(); render();
        });
      });
    }
  });
  await loadList();
}
render(); mountAdmin();

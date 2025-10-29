// admin-fs.js — JSON/home.json ni File System Access API bilan o'qish/yozish + to'liq edit/delete
const KEY = 'lm.json.cms.fs.draft';
let CMS = { sections:[], htmlSnippets:[] };
let folderHandle = null;
let fileHandle = null;

const $ = (q, root=document)=>root.querySelector(q);
document.getElementById('toggleTheme').onclick=()=>{ document.documentElement.classList.toggle('dark'); };

window.addEventListener('DOMContentLoaded', async()=>{
  loadDraft();
  renderLists();
  bind();
});

function bind(){
  $('#connectBtn').onclick = connectFolder;
  $('#saveBtn').onclick = saveToDisk;
  $('#reloadBtn').onclick = reloadFromDisk;

  $('#saveSection').onclick = ()=>{
    const id=$('#secId').value.trim(); const title=$('#secTitle').value.trim();
    if(!id||!title) return alert('Bo\'lim ID va nomi kerak');
    const idx = CMS.sections.findIndex(s=>s.id===id);
    if(idx>=0){ CMS.sections[idx].title=title; }
    else CMS.sections.push({ id, title, modChips:[], bigChips:[], cards:[], banners:[] });
    persistDraft(); renderLists(); alert('Bo\'lim saqlandi');
  };

  $('#saveSnippet').onclick = ()=>{
    const id=$('#snipId').value.trim(); const title=$('#snipTitle').value.trim(); const html=$('#snipHtml').value;
    if(!id) return alert('Snippet ID kerak');
    const idx=(CMS.htmlSnippets||[]).findIndex(x=>x.id===id);
    if(idx>=0) CMS.htmlSnippets[idx]={id,title,html}; else { CMS.htmlSnippets.push({id,title,html}); }
    persistDraft(); renderLists(); alert('Snippet saqlandi');
  };

  // import/export + draft
  $('#exportJson').onclick=()=>{
    const blob=new Blob([JSON.stringify(CMS,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='home.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#importJsonBtn').onclick=()=>$('#importJsonFile').click();
  $('#importJsonFile').onchange=async(e)=>{
    const f=e.target.files[0]; if(!f) return;
    const text=await f.text();
    try{ CMS=JSON.parse(text); persistDraft(); renderLists(); $('#status').textContent='Imported (draft)'; }catch(err){ alert('JSON xato: '+err.message); }
  };
  $('#clearDraft').onclick=()=>{ localStorage.removeItem(KEY); $('#status').textContent='Draft cleared'; };
}

function sectionItemView(s){
  // Build a full editor for a section (chips/cards/banners) with edit/delete buttons.
  const el = document.createElement('div'); el.className='item';
  el.innerHTML = `
    <div class="grow"><b>${s.title}</b> <span class="small">(${s.id})</span></div>
    <button class="btn" data-act="edit">Tahrirlash</button>
    <button class="btn" data-act="del">O'chirish</button>
  `;
  el.querySelector('[data-act="del"]').onclick=()=>{
    if(confirm('Bo\'limni o\'chirasizmi?')){ CMS.sections = CMS.sections.filter(x=>x.id!==s.id); persistDraft(); renderLists(); }
  };
  el.querySelector('[data-act="edit"]').onclick=()=> openSectionEditor(s.id);
  return el;
}

function snipItemView(sn){
  const el = document.createElement('div'); el.className='item';
  el.innerHTML = `
    <div class="grow"><b>${sn.title||'(title yo\'q)'}</b> <span class="small">(${sn.id})</span></div>
    <button class="btn" data-act="edit">Tahrirlash</button>
    <button class="btn" data-act="del">O'chirish</button>
  `;
  el.querySelector('[data-act="del"]').onclick=()=>{
    if(confirm('Snippetni o\'chirasizmi?')){ CMS.htmlSnippets = CMS.htmlSnippets.filter(x=>x.id!==sn.id); persistDraft(); renderLists(); }
  };
  el.querySelector('[data-act="edit"]').onclick=()=>{
    $('#snipId').value = sn.id;
    $('#snipTitle').value = sn.title||'';
    $('#snipHtml').value = sn.html||'';
    window.scrollTo({top:0,behavior:'smooth'});
  };
  return el;
}

function renderLists(){
  const sbox = $('#sectionsList'); sbox.innerHTML='';
  (CMS.sections||[]).forEach(s=> sbox.appendChild(sectionItemView(s)));
  const nbox = $('#snipsList'); nbox.innerHTML='';
  (CMS.htmlSnippets||[]).forEach(sn=> nbox.appendChild(snipItemView(sn)));
}

function openSectionEditor(id){
  const s = CMS.sections.find(x=>x.id===id); if(!s) return;
  // Open an inline editor modal using prompt approach for brevity
  // Edit modChips
  if(confirm('Mod chip qo\'shasizmi?')){
    const label = prompt('Chip label:');
    const htmlId = prompt('HTML ID (html.xxx):');
    if(label && htmlId){ s.modChips = s.modChips||[]; s.modChips.push({ id:'chip.'+slug(label), type:'modal', label, htmlId }); }
  }
  // Edit bigChips
  if(confirm('Katta chip qo\'shasizmi?')){
    const label = prompt('Katta chip label:');
    if(label){ s.bigChips = s.bigChips||[]; s.bigChips.push({ id:'big.'+slug(label), type:'section', label }); }
  }
  // Add/Remove Card
  if(confirm('Card qo\'shasizmi?')){
    const title = prompt('Card nomi:');
    if(title){
      const img = prompt('Rasm URL (ixtiyoriy, bo\'sh qoldirish mumkin):','');
      const soon = confirm('Tez kunda sifatida belgilansinmi?');
      s.cards = s.cards||[]; s.cards.push({ id:'card.'+slug(title), title, img, soon, buttons:[] });
      if(confirm('Cardga tugma qo\'shasizmi?')){
        const label = prompt('Tugma label:');
        const isModal = confirm('Modal tugma (OK) yoki Link tugma (Cancel)?');
        if(isModal){
          const htmlId = prompt('HTML ID (html.xxx):');
          if(htmlId){ s.cards[s.cards.length-1].buttons.push({label, type:'modal', htmlId}); }
        }else{
          const href = prompt('Havola (https://…):','https://');
          if(href){ s.cards[s.cards.length-1].buttons.push({label, type:'link', href}); }
        }
      }
    }
  }
  // Add Banner
  if(confirm('Banner qo\'shasizmi?')){
    const htmlId = prompt('Banner HTML ID (html.xxx):');
    if(htmlId){ s.banners = s.banners||[]; s.banners.push({ id:'ban.'+Math.random().toString(36).slice(2,7), htmlId }); }
  }

  persistDraft(); renderLists();
}

function persistDraft(){ localStorage.setItem(KEY, JSON.stringify(CMS)); $('#status').textContent='Draft (local)'; }
function loadDraft(){
  try{
    const d=localStorage.getItem(KEY);
    if(d){ CMS=JSON.parse(d); $('#status').textContent='Draft (local)'; }
    else { $('#status').textContent='Not connected'; }
  }catch{}
}

async function connectFolder(){
  try{
    folderHandle = await window.showDirectoryPicker();
    // Find or create JSON/home.json
    const jsonDir = await getOrCreateDir(folderHandle, 'JSON');
    fileHandle = await getOrCreateFile(jsonDir, 'home.json');
    $('#status').textContent='Connected';
    $('#saveBtn').disabled=false; $('#reloadBtn').disabled=false;
    await reloadFromDisk();
  }catch(e){
    console.warn(e); alert('Folder ulanmadi yoki rad etildi.');
  }
}

async function reloadFromDisk(){
  if(!fileHandle){ alert('Folder ulanmagan'); return; }
  const file = await fileHandle.getFile();
  const text = await file.text();
  try{
    CMS = JSON.parse(text);
    localStorage.setItem(KEY, JSON.stringify(CMS));
    renderLists();
    $('#status').textContent='Loaded from disk';
  }catch(err){
    alert('home.json JSON emas yoki buzilgan: '+err.message);
  }
}

async function saveToDisk(){
  if(!fileHandle){ alert('Folder ulanmagan'); return; }
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([JSON.stringify(CMS,null,2)], {type:'application/json'}));
  await writable.close();
  $('#status').textContent='Saved to disk';
}

async function getOrCreateDir(rootHandle, name){
  try{ return await rootHandle.getDirectoryHandle(name, { create:true }); }catch(e){ throw e; }
}
async function getOrCreateFile(dirHandle, name){
  try{ return await dirHandle.getFileHandle(name, { create:true }); }catch(e){ throw e; }
}

function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
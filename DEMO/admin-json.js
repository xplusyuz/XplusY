// admin-json.js — edits ./JSON/home.json client-side (import/export + localStorage drafts)
const KEY = 'lm.json.cms.draft';
let CMS = null;

const $ = (q, root=document)=>root.querySelector(q);
document.getElementById('toggleTheme').onclick=()=>{ document.documentElement.classList.toggle('dark'); };

window.addEventListener('DOMContentLoaded', async()=>{
  await loadCMS();
  bind();
});

async function loadCMS(){
  $('#status').textContent='Yuklanmoqda…';
  try{
    const res = await fetch('./JSON/home.json', { cache: 'no-store' });
    CMS = await res.json();
    // apply draft if exists
    const d = localStorage.getItem(KEY);
    if(d){ try{ const draft = JSON.parse(d); CMS = draft; $('#status').textContent='Draft (localStorage)'; }catch{} }
    else { $('#status').textContent='Yuklandi'; }
  }catch(e){
    console.error(e); $('#status').textContent='Xato'; alert('home.json o‘qilmadi');
    CMS = { sections:[], htmlSnippets:[] };
  }
}

function persistDraft(){ localStorage.setItem(KEY, JSON.stringify(CMS)); $('#status').textContent='Draft saqlandi'; }
function clearDraft(){ localStorage.removeItem(KEY); $('#status').textContent='Yuklandi'; }

function bind(){
  $('#saveSection').onclick = ()=>{
    const id = $('#secId').value.trim(); const title = $('#secTitle').value.trim();
    if(!id||!title) return alert('Bo\'lim ID va nomi kerak');
    const idx = (CMS.sections||[]).findIndex(s=>s.id===id);
    const obj = idx>=0 ? CMS.sections[idx] : { id, title, modChips:[], bigChips:[], cards:[], banners:[] };
    obj.title = title;
    if(idx>=0) CMS.sections[idx]=obj; else CMS.sections.push(obj);
    persistDraft(); alert('Bo\'lim saqlandi (draft)');
  };
  $('#deleteSection').onclick = ()=>{
    const id = $('#secId').value.trim(); if(!id) return;
    CMS.sections = (CMS.sections||[]).filter(s=>s.id!==id);
    persistDraft(); alert('Bo\'lim o\'chirildi (draft)');
  };

  $('#addModChip').onclick = ()=>{
    const sid=$('#modSecId').value.trim(); const label=$('#modLabel').value.trim(); const htmlId=$('#modHtmlId').value.trim();
    const sec = (CMS.sections||[]).find(s=>s.id===sid); if(!sec) return alert('Bo\'lim topilmadi');
    sec.modChips = sec.modChips||[]; sec.modChips.push({ id:'chip.'+slug(label), type:'modal', label, htmlId });
    // auto-create snippet if missing
    const has = (CMS.htmlSnippets||[]).some(x=>x.id===htmlId);
    if(!has){ CMS.htmlSnippets = CMS.htmlSnippets||[]; CMS.htmlSnippets.push({ id:htmlId, title:label, html:`<div style="padding:18px"><h2>${label}</h2><p>…</p></div>` }); }
    persistDraft(); alert('Modal chip qo\'shildi (draft)');
  };

  $('#addBigChip').onclick = ()=>{
    const sid=$('#bigSecId').value.trim(); const label=$('#bigLabel').value.trim();
    const sec = (CMS.sections||[]).find(s=>s.id===sid); if(!sec) return alert('Bo\'lim topilmadi');
    sec.bigChips = sec.bigChips||[]; sec.bigChips.push({ id:'big.'+slug(label), type:'section', label });
    persistDraft(); alert('Katta chip qo\'shildi (draft)');
  };

  $('#addCard').onclick = ()=>{
    const sid=$('#cardSecId').value.trim(); const title=$('#cardTitle').value.trim(); const img=$('#cardImg').value.trim(); const soon=$('#cardSoon').value==='yes';
    const sec = (CMS.sections||[]).find(s=>s.id===sid); if(!sec) return alert('Bo\'lim topilmadi');
    sec.cards = sec.cards||[]; sec.cards.push({ id:'card.'+slug(title), title, img, soon, buttons:[] });
    persistDraft(); alert('Card qo\'shildi (draft)');
  };

  $('#addCardButton').onclick = ()=>{
    const sid=$('#btnSecId').value.trim(); const cid=$('#btnCardId').value.trim(); const label=$('#btnLabel').value.trim();
    const type=$('#btnType').value; const target=$('#btnTarget').value.trim();
    const sec=(CMS.sections||[]).find(s=>s.id===sid); if(!sec) return alert('Bo\'lim topilmadi');
    const card=(sec.cards||[]).find(c=>c.id===cid); if(!card) return alert('Card topilmadi');
    card.buttons = card.buttons||[];
    if(type==='link') card.buttons.push({ label, type:'link', href:target });
    else card.buttons.push({ label, type:'modal', htmlId:target });
    persistDraft(); alert('Card tugmasi qo\'shildi (draft)');
  };

  $('#addBanner').onclick = ()=>{
    const sid=$('#banSecId').value.trim(); const htmlId=$('#banHtmlId').value.trim();
    const sec=(CMS.sections||[]).find(s=>s.id===sid); if(!sec) return alert('Bo\'lim topilmadi');
    sec.banners = sec.banners||[]; sec.banners.push({ id:'ban.'+Math.random().toString(36).slice(2,7), htmlId });
    persistDraft(); alert('Banner qo\'shildi (draft)');
  };

  $('#saveSnippet').onclick=()=>{
    const id=$('#snipId').value.trim(); const title=$('#snipTitle').value.trim(); const html=$('#snipHtml').value;
    if(!id) return alert('Snippet ID kerak');
    const idx=(CMS.htmlSnippets||[]).findIndex(x=>x.id===id);
    if(idx>=0) CMS.htmlSnippets[idx]={id,title,html}; else { CMS.htmlSnippets=CMS.htmlSnippets||[]; CMS.htmlSnippets.push({id,title,html}); }
    persistDraft(); alert('Snippet saqlandi (draft)');
  };
  $('#deleteSnippet').onclick=()=>{
    const id=$('#snipId').value.trim(); if(!id) return;
    CMS.htmlSnippets = (CMS.htmlSnippets||[]).filter(x=>x.id!==id);
    persistDraft(); alert('Snippet o\'chirildi (draft)');
  };

  // Export/Import
  $('#exportJson').onclick=()=>{
    // finalize draft and download
    clearDraft(); // to mark it as finalized
    const blob=new Blob([JSON.stringify(CMS,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='home.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#importJsonBtn').onclick=()=>$('#importJsonFile').click();
  $('#importJsonFile').onchange=async(e)=>{
    const f=e.target.files[0]; if(!f) return;
    const text=await f.text();
    try{ CMS=JSON.parse(text); persistDraft(); $('#status').textContent='Draft (import)'; alert('Import qilindi (draft)'); }catch(err){ alert('JSON xato: '+err.message); }
  };
}

function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
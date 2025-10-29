import { firebaseConfig } from './firebaseConfig.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Allowed admin emails
const ALLOW = new Set(['sohibjonmath@gmail.com']);

const $ = (q,root=document)=>root.querySelector(q);
document.getElementById('toggleTheme').onclick=()=>{ document.documentElement.classList.toggle('dark'); };

onAuthStateChanged(auth, async (user)=>{
  if(!user){
    await signIn();
    return;
  }
  $('#adminUser').innerHTML = `<img src="${user.photoURL||''}" alt="u"><div>${user.displayName||user.email}</div>`;
  if(!ALLOW.has(user.email)){
    alert('Bu admin panelga kirish huquqi yo\'q.');
    await signOut(auth);
    location.href = './index.html';
    return;
  }
  await loadCMS();
});
async function signIn(){ const prov = new GoogleAuthProvider(); await signInWithPopup(auth, prov); }
document.getElementById('signOutBtn').onclick=()=>signOut(auth);

let CMS = null;
async function loadCMS(){
  $('#cmsStatus').textContent='Yuklanmoqda…';
  const ref = doc(db,'cms','root');
  const snap = await getDoc(ref);
  if(!snap.exists()){
    await setDoc(ref, { sections:[], htmlSnippets:[] });
    CMS = { sections:[], htmlSnippets:[] };
  } else CMS = snap.data();
  $('#cmsStatus').textContent='Yuklandi';
}

// Helpers
function findSection(id){ return CMS.sections.find(s=>s.id===id); }
function upsertSection(obj){
  const idx = CMS.sections.findIndex(s=>s.id===obj.id);
  if(idx>=0) CMS.sections[idx]=obj; else CMS.sections.push(obj);
}
async function persist(){ await setDoc(doc(db,'cms','root'), CMS); alert('Saqlandi'); }

// Section
$('#saveSection').onclick=async()=>{
  const id = $('#secId').value.trim(); const title=$('#secTitle').value.trim();
  if(!id||!title) return alert('Bo\'lim ID va nomi kerak');
  const cur = findSection(id) || { id, title, modChips:[], bigChips:[], cards:[], banners:[] };
  cur.title = title; upsertSection(cur); await persist();
};
$('#deleteSection').onclick=async()=>{
  const id = $('#secId').value.trim(); if(!id) return;
  CMS.sections = CMS.sections.filter(s=>s.id!==id); await persist();
};

// Mod chip
$('#addModChip').onclick=async()=>{
  const sid=$('#modSecId').value.trim(); const label=$('#modLabel').value.trim(); const htmlId=$('#modHtmlId').value.trim();
  const sec=findSection(sid); if(!sec) return alert('Bo\'lim topilmadi');
  sec.modChips = sec.modChips||[]; sec.modChips.push({ id:'chip.'+slug(label), type:'modal', label, htmlId });
  await persist();
};

// Big chip
$('#addBigChip').onclick=async()=>{
  const sid=$('#bigSecId').value.trim(); const label=$('#bigLabel').value.trim();
  const sec=findSection(sid); if(!sec) return alert('Bo\'lim topilmadi');
  sec.bigChips = sec.bigChips||[]; sec.bigChips.push({ id:'big.'+slug(label), type:'section', label });
  await persist();
};

// Card
$('#addCard').onclick=async()=>{
  const sid=$('#cardSecId').value.trim(); const title=$('#cardTitle').value.trim(); const img=$('#cardImg').value.trim(); const soon=$('#cardSoon').value==='yes';
  const sec=findSection(sid); if(!sec) return alert('Bo\'lim topilmadi');
  sec.cards = sec.cards||[]; sec.cards.push({ id:'card.'+slug(title), title, img, soon, buttons:[] });
  await persist();
};

// Card button
$('#addCardButton').onclick=async()=>{
  const sid=$('#btnSecId').value.trim(); const cid=$('#btnCardId').value.trim();
  const label=$('#btnLabel').value.trim(); const type=$('#btnType').value; const target=$('#btnTarget').value.trim();
  const sec=findSection(sid); if(!sec) return alert('Bo\'lim topilmadi');
  const card=(sec.cards||[]).find(c=>c.id===cid); if(!card) return alert('Card topilmadi');
  card.buttons = card.buttons||[];
  if(type==='link') card.buttons.push({label:type==='link'?label:label, type:'link', href:target});
  else card.buttons.push({label, type:'modal', htmlId:target});
  await persist();
};

// Banner
$('#addBanner').onclick=async()=>{
  const sid=$('#banSecId').value.trim(); const htmlId=$('#banHtmlId').value.trim();
  const sec=findSection(sid); if(!sec) return alert('Bo\'lim topilmadi');
  sec.banners = sec.banners||[]; sec.banners.push({ id:'ban.'+Math.random().toString(36).slice(2,7), htmlId });
  await persist();
};

// Snippet
$('#saveSnippet').onclick=async()=>{
  const id=$('#snipId').value.trim(); const title=$('#snipTitle').value.trim(); const html=$('#snipHtml').value;
  if(!id) return alert('ID kerak');
  const idx=(CMS.htmlSnippets||[]).findIndex(x=>x.id===id);
  if(idx>=0) CMS.htmlSnippets[idx]={id,title,html}; else { CMS.htmlSnippets=CMS.htmlSnippets||[]; CMS.htmlSnippets.push({id,title,html}); }
  await persist();
};
$('#deleteSnippet').onclick=async()=>{
  const id=$('#snipId').value.trim(); if(!id) return;
  CMS.htmlSnippets = (CMS.htmlSnippets||[]).filter(x=>x.id!==id);
  await persist();
};

// User points
$('#applyPoints').onclick=async()=>{
  const email=$('#userEmail').value.trim(); const delta=Number($('#userPointsDelta').value||0);
  if(!email||!delta) return alert('Email va delta kerak');
  // find user by email — in a simple demo we store users by uid, so we need mapping. In production, create an index. Here we keep a per-email doc too.
  const ref = doc(db,'userEmails', email.replaceAll('.', '(dot)'));
  const snap = await getDoc(ref);
  if(!snap.exists()){ alert('Bu email uchun UID topilmadi. Foydalanuvchi ilovaga bir kirib chiqsın.'); return; }
  const uid = snap.data().uid;
  const uref = doc(db,'users', uid);
  const udoc = await getDoc(uref);
  if(!udoc.exists()){ alert('User doc topilmadi'); return; }
  const cur = udoc.data().points||0;
  await updateDoc(uref, { points: cur + delta, updatedAt: serverTimestamp() });
  alert('Ball yangilandi: '+(cur+delta));
};

// Export/Import
$('#exportJson').onclick=()=>{
  const blob=new Blob([JSON.stringify(CMS,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='cms.json'; a.click(); URL.revokeObjectURL(a.href);
};
$('#importJsonBtn').onclick=()=>$('#importJsonFile').click();
$('#importJsonFile').onchange=async(e)=>{
  const f=e.target.files[0]; if(!f) return;
  const text=await f.text();
  try{ CMS=JSON.parse(text); await persist(); }catch(err){ alert('JSON xato: '+err.message); }
};

function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
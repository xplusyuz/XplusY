
import { attachAuthUI, initUX, db, ADMIN_NUMERIC_IDS } from "./js/common.js";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, limit, getDocs, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

attachAuthUI({ requireSignIn: true });
initUX();

const qs=(s,el=document)=>el.querySelector(s);
const qsa=(s,el=document)=>[...el.querySelectorAll(s)];
const show=el=>el.classList.remove('hidden');
const hide=el=>el.classList.add('hidden');

function openModal(id){ hideAll(); show(qs('#'+id)); }
function hideAll(){ qsa('.modal').forEach(m=>m.classList.add('hidden')); }
document.addEventListener('click',(e)=>{
  const openId=e.target.getAttribute('data-open'); if(openId) openModal(openId);
  if(e.target.hasAttribute('data-close')) e.target.closest('.modal')?.classList.add('hidden');
  if(e.target.classList.contains('modal')) e.target.classList.add('hidden');
});

let currentUser=null, currentDoc=null;
document.addEventListener('mc:user-ready', async ()=>{
  const { user, profile } = window.__mcUser; currentUser=user; currentDoc=profile;
  if(ADMIN_NUMERIC_IDS.includes(Number(profile?.numericId))) show(qs('#cardAdmin'));
  fillProfile(profile);
  renderBadges(profile.badges||[]);
});

function fillProfile(d){
  qs('#pf_numericId').value = d.numericId ?? '—';
  qs('#pf_firstName').value = d.firstName ?? '';
  qs('#pf_lastName').value = d.lastName ?? '';
  qs('#pf_middleName').value = d.middleName ?? '';
  qs('#pf_dob').value = d.dob ?? '';
  qs('#pf_region').value = d.region ?? '';
  qs('#pf_district').value = d.district ?? '';
  qs('#pf_phone').value = d.phone ?? '';
  qs('#pf_balance').value = d.balance ?? 0;
  qs('#pf_gems').value = d.gems ?? 0;
}
function setEditable(x){
  ['#pf_firstName','#pf_lastName','#pf_middleName','#pf_dob','#pf_region','#pf_district','#pf_phone'].forEach(s=> qs(s).readOnly=!x);
  qs('#profileSave').disabled = !x;
}
qs('#profileEdit').addEventListener('click', ()=> setEditable(true));
qs('#profileSave').addEventListener('click', async ()=>{
  try{
    const ref=doc(db,'users', currentUser.uid);
    const data={
      firstName: qs('#pf_firstName').value.trim(),
      lastName: qs('#pf_lastName').value.trim(),
      middleName: qs('#pf_middleName').value.trim(),
      dob: qs('#pf_dob').value,
      region: qs('#pf_region').value.trim(),
      district: qs('#pf_district').value.trim(),
      phone: qs('#pf_phone').value.trim(),
    };
    await updateDoc(ref, data);
    alert('Profil saqlandi ✅'); setEditable(false); currentDoc={ ...currentDoc, ...data };
  }catch(e){ alert('Xato: '+e.message); }
});

// Results
async function loadResults(){
  const list=qs('#resultsList'); list.innerHTML='<div class="card">Yuklanmoqda…</div>';
  const col=collection(db,'users', currentUser.uid, 'results');
  const snap=await getDocs(query(col, orderBy('createdAtFS','desc'), limit(20)));
  list.innerHTML=''; if(snap.empty){ list.innerHTML='<div class="hint">Hozircha natija yo‘q.</div>'; return; }
  snap.forEach(d=>{ const r=d.data(); const when=r.createdAt || ''; const el=document.createElement('div'); el.className='card'; el.innerHTML=`<div><b>${r.examName||'Sinov'}</b></div><div class="sub">Score: ${r.score?.toFixed?.(2) ?? r.score} — ${when}</div>`; list.appendChild(el); });
}
qs('#cardResults .btn')?.addEventListener('click', loadResults);

// Badges
function renderBadges(arr){
  const w=qs('#badgesWrap'); w.innerHTML=''; if(!arr||!arr.length){ w.innerHTML='<div class="hint">Hozircha yutuqlar yo‘q.</div>'; return; }
  arr.forEach(b=>{ const s=document.createElement('span'); s.className='pill'; s.textContent=b; w.appendChild(s); });
}

// Promo
qs('#promoApply').addEventListener('click', async ()=>{
  const msg=qs('#promoMsg'); msg.textContent='';
  const code=qs('#promoInput').value.trim(); if(!code){ msg.textContent='Kod kiriting'; return; }
  try{
    const promoRef=doc(db,'promoCodes', code);
    const userRef=doc(db,'users', currentUser.uid);
    const redRef=doc(db,'users', currentUser.uid, 'promoRedemptions', code);
    await runTransaction(db, async (tx)=>{
      const p=await tx.get(promoRef); if(!p.exists()) throw new Error('Kod topilmadi');
      const D=p.data();
      if(D.active===false) throw new Error('Kod faol emas');
      if(D.expiresAt && D.expiresAt.toDate && D.expiresAt.toDate() < new Date()) throw new Error('Muddati tugagan');
      const used=await tx.get(redRef); if(used.exists()) throw new Error('Bu kod allaqachon ishlatilgan');
      const u=await tx.get(userRef); if(!u.exists()) throw new Error('Foydalanuvchi topilmadi');
      tx.update(userRef, { balance: Number(u.data().balance||0) + Number(D.balance||0), gems: Number(u.data().gems||0) + Number(D.gems||0) });
      tx.set(redRef, { usedAt: serverTimestamp(), code });
    });
    msg.textContent='✅ Qo‘llandi';
  }catch(e){ msg.textContent='❌ '+e.message; }
});

// Admin
let adminUnlocked=false;
qs('#cardAdmin .btn').addEventListener('click', ()=>{
  if(!ADMIN_NUMERIC_IDS.includes(Number(currentDoc?.numericId))) alert('Faqat 1000001/1000002');
});
qs('#adminEnter').addEventListener('click', ()=>{
  const code=qs('#adminCode').value; if(code==='Math@1999'){ adminUnlocked=true; openModal('adminModal'); } else alert('Noto‘g‘ri kod');
});
qs('#adm_list_all').addEventListener('click', adminListTop);
qs('#adm_search').addEventListener('click', adminSearch);
qs('#adm_table').addEventListener('click', async (e)=>{
  if(!e.target.classList.contains('a_save')) return;
  if(!adminUnlocked) return alert('Admin rejimi yopiq');
  if(!ADMIN_NUMERIC_IDS.includes(Number(currentDoc?.numericId))) return alert('Ruxsat yo‘q');
  const row=e.target.closest('.adm-row') || e.target.closest('.card'); const uid=row.getAttribute('data-uid');
  const ref=doc(db,'users', uid);
  try{
    await updateDoc(ref, {
      numericId: Number(row.querySelector('.a_numericId').value) || null,
      firstName: row.querySelector('.a_firstName').value.trim(),
      lastName: row.querySelector('.a_lastName').value.trim(),
      phone: row.querySelector('.a_phone').value.trim(),
      region: row.querySelector('.a_region').value.trim(),
      balance: Number(row.querySelector('.a_balance').value),
      gems: Number(row.querySelector('.a_gems').value),
      dob: row.querySelector('.a_dob').value
    });
    alert('Saqlandi ✅');
  }catch(e){ alert('Xato: '+e.message); }
});

async function adminListTop(){
  const table=qs('#adm_table'); table.innerHTML='';
  const snap=await getDocs(query(collection(db,'users'), orderBy('numericId','asc'), limit(50)));
  renderAdminTable(snap);
}
async function adminSearch(){
  const term=(qs('#adm_query').value||'').trim(); if(!term) return adminListTop();
  let snap;
  if(/^[0-9]+$/.test(term)){
    snap = await getDocs(query(collection(db,'users'), where('numericId','==', Number(term)), limit(20)));
  }else{
    snap = await getDocs(query(collection(db,'users'), where('phone','==', term), limit(20)));
  }
  renderAdminTable(snap);
}
function renderAdminTable(snap){
  const table=qs('#adm_table'); table.innerHTML='';
  const head=document.createElement('div'); head.className='card';
  head.innerHTML='<b>ID</b> | Ism | Fam | Tel | Viloyat | Balans | Olmos | DOB | Amal';
  table.appendChild(head);
  if(snap.empty){ const d=document.createElement('div'); d.className='hint'; d.textContent='Hech narsa topilmadi'; table.appendChild(d); return; }
  snap.forEach(d=>{
    const u=d.data(); const row=document.createElement('div'); row.className='card adm-row'; row.setAttribute('data-uid', d.id);
    row.innerHTML = `
      <input class="a_numericId" type="number" value="${u.numericId ?? ''}" />
      <input class="a_firstName" type="text" value="${u.firstName ?? ''}" />
      <input class="a_lastName" type="text" value="${u.lastName ?? ''}" />
      <input class="a_phone" type="text" value="${u.phone ?? ''}" />
      <input class="a_region" type="text" value="${u.region ?? ''}" />
      <input class="a_balance" type="number" value="${u.balance ?? 0}" />
      <input class="a_gems" type="number" value="${u.gems ?? 0}" />
      <input class="a_dob" type="date" value="${u.dob ?? ''}" />
      <button class="btn primary a_save">Saqlash</button>`;
    table.appendChild(row);
  });
}

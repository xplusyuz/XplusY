import { attachAuthUI, initUX, db, ADMIN_NUMERIC_IDS } from "./common.js";
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
document.querySelector('#cardResults .btn')?.addEventListener('click', loadResults);

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

// Admin visibility + open
qs('#openAdmin')?.addEventListener('click', ()=>{
  if(!ADMIN_NUMERIC_IDS.includes(Number(currentDoc?.numericId))) return alert('Faqat 1000001/1000002');
  openModal('adminModal');
});

// Admin table actions
let adminUnlocked=true; // no password gate, numericId check only
document.addEventListener('click', async (e)=>{
  if(!e.target.classList.contains('a_save')) return;
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

document.getElementById('adm_list_all')?.addEventListener('click', adminListTop);
document.getElementById('adm_search')?.addEventListener('click', adminSearch);

// Admin tabs
document.addEventListener('click', (e)=>{
  if(e.target?.id==='tabUsers'){ qs('#paneUsers')?.classList.remove('hidden'); qs('#panePromo')?.classList.add('hidden'); qs('#paneCSV')?.classList.add('hidden'); }
  if(e.target?.id==='tabPromo'){ qs('#paneUsers')?.classList.add('hidden'); qs('#panePromo')?.classList.remove('hidden'); qs('#paneCSV')?.classList.add('hidden'); }
  if(e.target?.id==='tabCSV'){ qs('#paneUsers')?.classList.add('hidden'); qs('#panePromo')?.classList.add('hidden'); qs('#paneCSV')?.classList.remove('hidden'); }
});

async function ensureAdmin(){
  if(!ADMIN_NUMERIC_IDS.includes(Number(currentDoc?.numericId))){
    throw new Error('Faqat 1000001/1000002 ruxsat etiladi');
  }
}

// Promo create
qs('#pr_create')?.addEventListener('click', async ()=>{
  try{
    await ensureAdmin();
    const code = qs('#pr_code').value.trim();
    if(!code) throw new Error('Kod kiriting');
    const payload = {
      code,
      active: qs('#pr_active').value==='true',
      balance: Number(qs('#pr_balance').value||0),
      gems: Number(qs('#pr_gems').value||0),
      percent: Number(qs('#pr_percent').value||0),
      maxUses: Number(qs('#pr_max').value||0),
      perUserLimit: Number(qs('#pr_peruser').value||1),
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    };
    const ex = qs('#pr_expires').value;
    if(ex) payload.expiresAt = new Date(ex+'T23:59:59');
    await setDoc(doc(db,'promoCodes', code), payload);
    qs('#pr_msg').textContent = '✅ Yaratildi';
  }catch(err){
    qs('#pr_msg').textContent = '❌ '+(err.message||err);
  }
});

// CSV list/load/save
async function csvList(){
  await ensureAdmin();
  const sel = qs('#csv_select'); if(!sel) return;
  sel.innerHTML='';
  const snap = await getDocs(query(collection(db,'csvFiles'), orderBy('name','asc'), limit(500)));
  if(snap.empty){ sel.innerHTML='<option value="">(Hali yo‘q)</option>'; return; }
  snap.forEach(d=>{
    const o=document.createElement('option');
    o.value = d.id; o.textContent = d.data().name || d.id;
    sel.appendChild(o);
  });
}
async function csvLoad(){
  await ensureAdmin();
  const id = qs('#csv_select').value;
  if(!id) return qs('#csv_text').value='';
  const s = await getDoc(doc(db,'csvFiles', id));
  qs('#csv_text').value = s.exists() ? (s.data().content||'') : '';
}
async function csvSave(){
  await ensureAdmin();
  let id = qs('#csv_select').value;
  const text = qs('#csv_text').value;
  if(!id){
    const name = prompt('CSV nomi (mas: courses.csv):'); if(!name) return;
    id = name;
  }
  await setDoc(doc(db,'csvFiles', id), {
    name: id, content: text, updatedAt: serverTimestamp(), updatedBy: currentUser.uid
  }, { merge:true });
  qs('#csv_msg').textContent='✅ Saqlandi';
  await csvList();
  qs('#csv_select').value = id;
}
qs('#csv_refresh')?.addEventListener('click', csvList);
qs('#csv_select')?.addEventListener('change', csvLoad);
qs('#csv_save')?.addEventListener('click', csvSave);
qs('#csv_new')?.addEventListener('click', ()=>{ qs('#csv_select').value=''; qs('#csv_text').value=''; });

// ----- Top-up: save request + history (no Storage upload here) -----
qs('#pay_submit')?.addEventListener('click', async ()=>{
  const msg=qs('#pay_msg'); msg.textContent='';
  try{
    const amount = Number(qs('#pay_amount').value||0);
    if(!amount || amount<1000) throw new Error('Summani kiriting');
    const note = qs('#pay_note').value.trim();
    const file = qs('#pay_file').files?.[0];
    const payload={ amount, note, filename: file?.name || null, createdAt: new Date(), createdAtFS: serverTimestamp(), status: 'pending' };
    // Firestore: users/{uid}/topups/{auto}
    const refCol = collection(db,'users', currentUser.uid, 'topups');
    // setDoc with random id via add-like pattern:
    const randomId = Math.random().toString(36).slice(2);
    await setDoc(doc(refCol, randomId), payload);
    msg.textContent='✅ Yuborildi. 10–15 daqiqa ichida tekshirilib qo‘shiladi.';
    await loadPayHistory();
  }catch(e){
    msg.textContent='❌ '+(e.message||e);
  }
});

export async function loadPayHistory(){
  const wrap=qs('#pay_history'); if(!wrap) return;
  wrap.innerHTML='<div class="card">Yuklanmoqda…</div>';
  const col=collection(db,'users', currentUser.uid, 'topups');
  const snap=await getDocs(query(col, orderBy('createdAtFS','desc'), limit(20)));
  wrap.innerHTML='';
  if(snap.empty){ wrap.innerHTML='<div class="hint">Hozircha ma’lumot yo‘q.</div>'; return; }
  snap.forEach(d=>{
    const r=d.data();
    const el=document.createElement('div'); el.className='card';
    el.innerHTML = `<div><b>${r.amount?.toLocaleString?.('uz-UZ')} so‘m</b> — ${r.status||'pending'}</div>
                    <div class="sub">${r.note||''}</div>`;
    wrap.appendChild(el);
  });
}

// open TopUp => refresh history
document.querySelector('#cardBalance [data-open="topUpModal"]')?.addEventListener('click', ()=>{
  if(typeof loadPayHistory === 'function'){ try{ loadPayHistory(); }catch{} }
});

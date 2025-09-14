import { attachAuthUI, initUX, db, ADMIN_NUMERIC_IDS, storage } from "./common.js";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, limit, getDocs, runTransaction, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

// ==== CONFIG: Telegram =====
const TG_TOKEN = "8021293022:AAGud9dz-Dv_5RjsjF0RFaqgMR2LeKA6G7c";
const TG_CHAT_ID = "2049065724"; // your chat id
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;
// ===========================

attachAuthUI({ requireSignIn: true });
initUX();

const qs=(s,el=document)=>el.querySelector(s);
const qsa=(s,el=document)=>[...el.querySelectorAll(s)];
const show=el=>el?.classList.remove('hidden');
const hide=el=>el?.classList.add('hidden');

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

// ---------- Top-up: upload to Storage, save doc, send to Telegram, history ----------
qs('#pay_submit')?.addEventListener('click', async ()=>{
  const msg=qs('#pay_msg'); msg.textContent='';
  try{
    const amount = Number(qs('#pay_amount').value||0);
    if(!amount || amount<1000) throw new Error('Summani kiriting');
    const note = qs('#pay_note').value.trim();
    const file = qs('#pay_file').files?.[0];
    // 1) Create doc id first
    const refCol = collection(db,'users', currentUser.uid, 'topups');
    const id = Math.random().toString(36).slice(2);
    // 2) Upload file if any
    let fileURL=null, fileName=null;
    if(file){
      fileName = file.name;
      const path = `users/${currentUser.uid}/topups/${id}/${fileName}`;
      const sref = sRef(storage, path);
      await uploadBytes(sref, file);
      fileURL = await getDownloadURL(sref);
    }
    // 3) Save firestore
    const payload={ 
      amount, note, filename: fileName, fileURL: fileURL || null,
      createdAt: new Date(), createdAtFS: serverTimestamp(), 
      status: 'pending',
      userNumericId: currentDoc?.numericId || null,
      userName: `${currentDoc?.firstName||''} ${currentDoc?.lastName||''}`.trim(),
      userPhone: currentDoc?.phone || null
    };
    await setDoc(doc(refCol, id), payload);
    // 4) Try Telegram (best effort; may fail due to CORS)
    try{
      const caption = `🧾 Yangi to‘lov arizasi\n\n`+
        `💰 Summasi: ${amount.toLocaleString('uz-UZ')} so‘m\n`+
        `👤 ID: ${currentDoc?.numericId} | ${currentDoc?.firstName||''} ${currentDoc?.lastName||''}\n`+
        `📞 Tel: ${currentDoc?.phone||'-'}\n`+
        (note?`📝 Izoh: ${note}\n`:'')+
        (fileURL?`📎 Chek: ${fileURL}\n`:'' )+
        `🔗 Bot: https://t.me/MathCenter_Pay_bot`;
      if(fileURL){
        await fetch(`${TG_API}/sendDocument`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT_ID, caption, document: fileURL, parse_mode: "HTML" })
        });
      }else{
        await fetch(`${TG_API}/sendMessage`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT_ID, text: caption })
        });
      }
    }catch(err){
      console.warn('Telegram yuborishda xatolik (ehtimol CORS):', err);
    }
    msg.textContent='✅ Yuborildi. Arizangiz ko‘rib chiqiladi.';
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
    const st = r.status||'pending';
    el.innerHTML = `<div class="row"><b>${r.amount?.toLocaleString?.('uz-UZ')} so‘m</b>
        <span class="status-badge status-${st}">${st}</span></div>
        <div class="sub">${r.note||''}</div>`;
    wrap.appendChild(el);
  });
}

// open TopUp => refresh history
document.querySelector('#cardBalance [data-open="topUpModal"]')?.addEventListener('click', ()=>{
  if(typeof loadPayHistory === 'function'){ try{ loadPayHistory(); }catch{} }
});

// ------------------- ADMIN: payments list + approve/reject -------------------
function ensureAdminSync(){
  if(!ADMIN_NUMERIC_IDS.includes(Number(currentDoc?.numericId))){
    throw new Error('Faqat 1000001/1000002 ruxsat etiladi');
  }
}
async function listPayments(filter='pending'){
  ensureAdminSync();
  const wrap = qs('#adm_pay_table'); wrap.innerHTML='<div class="card">Yuklanmoqda…</div>';
  // search across all users: collectionGroup
  const topups = collection(db, 'users', '__uid__', 'topups'); // placeholder
  // Workaround: no collectionGroup via REST here; use simple approach:
  // We'll query recent users and then merge. (If you have CF, replace with collectionGroup.)
  // For now, list latest 100 users then pull their topups.
  const usersSnap = await getDocs(query(collection(db,'users'), orderBy('numericId','asc'), limit(100)));
  wrap.innerHTML='';
  let cnt=0;
  for (const u of usersSnap.docs){
    const uid=u.id;
    const col=collection(db,'users', uid, 'topups');
    let qy;
    if(filter==='pending') qy=query(col, where('status','==','pending'), orderBy('createdAtFS','desc'), limit(50));
    else if(filter==='today'){
      const start = new Date(); start.setHours(0,0,0,0);
      qy=query(col, orderBy('createdAtFS','desc'), limit(50)); // client-side filter by createdAt (approx)
    } else {
      qy=query(col, orderBy('createdAtFS','desc'), limit(50));
    }
    const snap=await getDocs(qy);
    snap.forEach(d=>{
      const r=d.data(); if(filter==='today'){ /* skip if not today */ }
      const card=document.createElement('div'); card.className='card adm-row'; card.dataset.uid=uid; card.dataset.id=d.id;
      card.innerHTML = `
        <div class="row">
          <b>${r.amount?.toLocaleString?.('uz-UZ')} so‘m</b>
          <span class="status-badge status-${r.status||'pending'}">${r.status||'pending'}</span>
        </div>
        <div class="sub">ID: ${r.userNumericId||''} | ${r.userName||''} | ${r.userPhone||''}</div>
        ${r.note?`<div class="sub">Izoh: ${r.note}</div>`:''}
        ${r.fileURL?`<div class="sub"><a href="${r.fileURL}" target="_blank" rel="noopener">📎 Chekni ko‘rish</a></div>`:''}
        <textarea class="adm-note" placeholder="Izoh (majburiy emas)"></textarea>
        <div class="row">
          <button class="btn primary a_approve">Qabul qilish</button>
          <button class="btn danger a_reject">Rad etish</button>
        </div>`;
      wrap.appendChild(card);
      cnt++;
    });
  }
  if(!cnt){ wrap.innerHTML = '<div class="hint">Hozircha ariza yo‘q.</div>'; }
}

qs('#adm_pay_pending')?.addEventListener('click', ()=>listPayments('pending'));
qs('#adm_pay_all')?.addEventListener('click', ()=>listPayments('all'));
qs('#adm_pay_today')?.addEventListener('click', ()=>listPayments('today'));

document.addEventListener('click', async (e)=>{
  if(!(e.target.classList.contains('a_approve')||e.target.classList.contains('a_reject'))) return;
  try{
    ensureAdminSync();
    const row = e.target.closest('.adm-row');
    const uid=row.dataset.uid, id=row.dataset.id;
    const reason = row.querySelector('.adm-note')?.value?.trim()||'';
    const approved = e.target.classList.contains('a_approve');
    const userRef = doc(db,'users', uid);
    const topupRef = doc(db,'users', uid, 'topups', id);
    await runTransaction(db, async (tx)=>{
      const t = await tx.get(topupRef); if(!t.exists()) throw new Error('Top-up topilmadi');
      const R = t.data(); if(R.status!=='pending') throw new Error('Bu ariza allaqachon ko‘rilgan');
      if(approved){
        // add to balance
        const u = await tx.get(userRef); if(!u.exists()) throw new Error('User topilmadi');
        const newBal = Number(u.data().balance||0) + Number(R.amount||0);
        tx.update(userRef, { balance: newBal });
        tx.update(topupRef, { status:'approved', adminNote: reason, reviewedAt: serverTimestamp(), reviewedBy: currentUser.uid });
      }else{
        tx.update(topupRef, { status:'rejected', adminNote: reason, reviewedAt: serverTimestamp(), reviewedBy: currentUser.uid });
      }
    });
    // Telegram notify
    try{
      const text = (approved? '✅ QABUL QILINDI':'❌ RAD ETILDI') + `\n` + 
        `ID:${row.querySelector('.sub')?.textContent||''}\n`+
        (reason?`Izoh: ${reason}`:'') ;
      await fetch(`${TG_API}/sendMessage`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text })
      });
    }catch{}
    row.querySelector('.status-badge').textContent = approved? 'approved':'rejected';
    row.querySelector('.status-badge').className = 'status-badge ' + (approved? 'status-approved':'status-rejected');
    alert('Bajarildi ✅');
  }catch(err){
    alert('Xato: '+(err.message||err));
  }
});

// show history when opening modal
document.querySelector('#cardBalance [data-open="topUpModal"]')?.addEventListener('click', ()=>{
  if(typeof loadPayHistory === 'function'){ try{ loadPayHistory(); }catch{} }
});

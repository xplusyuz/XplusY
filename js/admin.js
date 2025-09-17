// js/admin.js — standalone
import { attachAuthUI, initUX, db, ADMIN_NUMERIC_IDS } from "./common.js";
import { collection, query, where, orderBy, limit, getDocs, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function ensureAdminSync(){
  if(!ADMIN_NUMERIC_IDS.includes(Number(window.__mcUser?.profile?.numericId))){
    throw new Error('Faqat 1000001/1000002 ruxsat etiladi');
  }
}
async function renderUsersTable(snap){
  const table=document.getElementById('adm_table'); if(!table) return;
  table.innerHTML='';
  const head=document.createElement('div'); head.className='card';
  head.innerHTML='<b>ID</b> | Ism | Fam | Tel | Viloyat | Balans | Olmos | DOB';
  table.appendChild(head);
  if(snap.empty){ const d=document.createElement('div'); d.className='hint'; d.textContent='Hech narsa topilmadi'; table.appendChild(d); return; }
  snap.forEach(d=>{
    const u=d.data(); const row=document.createElement('div'); row.className='card adm-row';
    row.innerHTML = `<b>${u.numericId ?? ''}</b> — ${u.firstName||''} ${u.lastName||''} — ${u.phone||''} — ${u.region||''} — ${u.balance||0} — ${u.gems||0} — ${u.dob||''}`;
    table.appendChild(row);
  });
}
async function adminListTop(){
  const snap=await getDocs(query(collection(db,'users'), orderBy('numericId','asc'), limit(50)));
  await renderUsersTable(snap);
}
async function adminSearch(){
  const term=(document.getElementById('adm_query')?.value||'').trim(); if(!term) return adminListTop();
  let snap;
  if(/^[0-9]+$/.test(term)){
    snap = await getDocs(query(collection(db,'users'), where('numericId','==', Number(term)), limit(20)));
  }else{
    snap = await getDocs(query(collection(db,'users'), where('phone','==', term), limit(20)));
  }
  await renderUsersTable(snap);
}
async function listPayments(filter='pending'){
  const wrap = document.getElementById('adm_pay_table'); if(!wrap) return;
  wrap.innerHTML='<div class="card">Yuklanmoqda…</div>';
  try{
    const usersSnap = await getDocs(query(collection(db,'users'), orderBy('numericId','asc'), limit(200)));
    wrap.innerHTML=''; let cnt=0;
    for (const u of usersSnap.docs){
      const uid=u.id;
      const col=collection(db,'users', uid, 'topups');
      let qy;
      if(filter==='all'){ qy = query(col, orderBy('createdAtFS','desc'), limit(50)); }
      else{ qy = query(col, where('status','==', filter), limit(50)); }
      const snap=await getDocs(qy);
      snap.forEach(d=>{
        const r=d.data();
        const card=document.createElement('div'); card.className='card adm-row'; card.dataset.uid=uid; card.dataset.id=d.id;
        card.innerHTML = `
          <div class="row">
            <b>${r.amount?.toLocaleString?.('uz-UZ')} so‘m</b>
            <span class="status-badge status-${r.status||'pending'}">${r.status||'pending'}</span>
          </div>
          <div class="sub">User: ${r.userName||''} | Tel: ${r.userPhone||''}</div>
          <div class="sub">Usul: ${r.method||'-'}  |  💳 **** ${r.cardLast4||'----'}</div>
          ${r.note?`<div class="sub">Foydalanuvchi izohi: ${r.note}</div>`:''}`;
        wrap.appendChild(card); cnt++;
      });
    }
    if(!cnt){ wrap.innerHTML = '<div class="hint">Hech narsa yo‘q.</div>'; }
  }catch(err){
    wrap.innerHTML = `<div class="card" style="color:#b00020">❌ Xato: ${err?.message||err}</div>`;
    console.error('[payments]', err);
  }
}

export default {
  async init(){
    attachAuthUI({ requireSignIn:true }); initUX?.();
    try{ ensureAdminSync(); }catch(e){ alert(e.message); return; }
    document.getElementById('adm_pay_pending')?.addEventListener('click', ()=>listPayments('pending'));
    document.getElementById('adm_pay_approved')?.addEventListener('click', ()=>listPayments('approved'));
    document.getElementById('adm_pay_rejected')?.addEventListener('click', ()=>listPayments('rejected'));
    document.getElementById('adm_pay_all')?.addEventListener('click', ()=>listPayments('all'));
    document.getElementById('adm_search')?.addEventListener('click', adminSearch);
    document.getElementById('adm_list_all')?.addEventListener('click', adminListTop);
    listPayments('pending');
  },
  destroy(){}
}
import { attachAuthUI, initUX, db, ADMIN_NUMERIC_IDS } from "./common.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
const storage = getStorage();
import { doc, setDoc, updateDoc, collection, query, where, orderBy, limit, getDocs, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ==== Telegram (text-only) =====
const TG_TOKEN = "8021293022:AAGud9dz-Dv_5RjsjF0RFaqgMR2LeKA6G7c";
const TG_CHAT_ID = "2049065724";
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;
// =======================================

attachAuthUI({ requireSignIn: true });
initUX();

const qs=(s,el=document)=>el.querySelector(s);
const qsa=(s,el=document)=>[...el.querySelectorAll(s)];
const show=el=>el?.classList.remove('hidden');
const hide=el=>el?.classList.add('hidden');

let currentUser=null, currentDoc=null;
document.addEventListener('mc:user-ready', async ()=>{
  const { user, profile } = window.__mcUser;
  currentUser=user; currentDoc=profile;
});

// ---------- Profile ----------
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
  ['#pf_firstName','#pf_lastName','#pf_middleName','#pf_dob','#pf_region','#pf_district','#pf_phone'].forEach(s=> qs(s)?.setAttribute('readonly', !x));
  const saveBtn=qs('#profileSave'); if(saveBtn) saveBtn.disabled = !x;
}

// ---------- Results ----------
async function loadResults(){
  const list=qs('#resultsList'); if(!list) return;
  list.innerHTML='<div class="card">Yuklanmoqda…</div>';
  const col=collection(db,'users', currentUser.uid, 'results');
  const snap=await getDocs(query(col, orderBy('createdAtFS','desc'), limit(20)));
  list.innerHTML='';
  if(snap.empty){ list.innerHTML='<div class="hint">Hozircha natija yo‘q.</div>'; return; }
  snap.forEach(d=>{
    const r=d.data();
    const when=r.createdAt || '';
    const el=document.createElement('div');
    el.className='card';
    el.innerHTML=`<div><b>${r.examName||'Sinov'}</b></div><div class="sub">Score: ${r.score?.toFixed?.(2) ?? r.score} — ${when}</div>`;
    list.appendChild(el);
  });
}

// ---------- Badges ----------
function renderBadges(arr){
  const w=qs('#badgesWrap'); if(!w) return;
  w.innerHTML='';
  if(!arr||!arr.length){ w.innerHTML='<div class="hint">Hozircha yutuqlar yo‘q.</div>'; return; }
  arr.forEach(b=>{ const s=document.createElement('span'); s.className='pill'; s.textContent=b; w.appendChild(s); });
}

// ---------- Top-up ----------
let selectedMethod=null;
document.addEventListener('click', (e)=>{
  const m=e.target.closest?.('.method'); if(!m) return;
  selectedMethod = m.getAttribute('data-method');
  qsa('.method').forEach(x=> x.classList.toggle('active', x===m));
  const fv = qs('#pay_method_view'); if(fv) fv.value = selectedMethod;
});
function digitsOnly(s){ return (s||'').replace(/\D+/g,''); }
function last4(s){ const d=digitsOnly(s); return d.slice(-4); }
function bindTopup(){
  const rIn = document.getElementById('pay_receipt');
  const rBox = document.getElementById('receipt_preview');
  if(rIn && !rIn._bound){
    rIn._bound = true;
    rIn.addEventListener('change', ()=>{
      if(!rBox) return;
      rBox.innerHTML='';
      const f = rIn.files && rIn.files[0];
      if(!f) return;
      if((f.size||0) > 5*1024*1024){
        rBox.textContent = '❌ Fayl 5 MB dan oshmasin';
        return;
      }
      if(f.type && f.type.startsWith('image/')){
        const img = document.createElement('img');
        img.style.maxWidth='140px'; img.style.borderRadius='8px'; img.style.border='1px solid #ddd';
        img.src = URL.createObjectURL(f);
        rBox.appendChild(img);
      }else{
        rBox.textContent = 'Fayl tanlandi: '+(f.name||'chek.pdf');
      }
    });
  }
  const btn = document.getElementById('pay_submit');
  if(!btn || btn._bound) return;
  btn._bound = true;
  btn.addEventListener('click', async ()=>{
    const msg=qs('#pay_msg'); if(msg){ msg.className='hint'; msg.textContent='Yuborilmoqda…'; }
    btn.disabled = true;
    try{
      if(!selectedMethod) throw new Error('Avval to‘lov usulini tanlang');
      const amount = Number(qs('#pay_amount').value||0);
      if(!amount || amount<1000) throw new Error('Summani kiriting (min 1000)');
      const cardIn = qs('#pay_card').value;
      const l4 = last4(cardIn);
      if(!l4 || l4.length<4) throw new Error('Kartaning oxirgi 4 ta raqamini kiriting');
      const note = (qs('#pay_note').value||'').trim();

      const id = Math.random().toString(36).slice(2);
      const refCol = collection(db,'users', currentUser.uid, 'topups');

      // Receipt file upload to Storage
      let receiptURL=null, receiptType=null, receiptName=null, receiptSize=null;
      const receiptInput = document.getElementById('pay_receipt');
      const file = receiptInput && receiptInput.files && receiptInput.files[0];
      if(file){
        if((file.size||0) > 5*1024*1024) throw new Error('Fayl hajmi 5 MB dan oshmasin');
        const safeName = (file.name||'receipt').replace(/[^\w.\-]+/g,'_');
        const path = `users/${currentUser.uid}/topups/${id}/${safeName}`;
        const storageRef = sRef(storage, path);
        await uploadBytes(storageRef, file);
        receiptURL = await getDownloadURL(storageRef);
        receiptType = file.type || null;
        receiptName = safeName;
        receiptSize = file.size || null;
      }
      const payload={ 
        amount,
        method: selectedMethod,
        cardLast4: l4,
        note,
        createdAt: new Date(),
        createdAtFS: serverTimestamp(),
        status: 'pending',
        userNumericId: currentDoc?.numericId || null,
        userName: `${currentDoc?.firstName||''} ${currentDoc?.lastName||''}`.trim(),
        userPhone: currentDoc?.phone || null,
        receiptURL, receiptType, receiptName, receiptSize
      };
      await setDoc(doc(refCol, id), payload);

      if(msg){ msg.className='hint ok'; msg.textContent='✅ Yuborildi. Arizangiz ko‘rib chiqiladi.'; }
      ['#pay_amount','#pay_card','#pay_note'].forEach(s=>{ const el=qs(s); if(el) el.value=''; });
      try{ const rIn=document.getElementById('pay_receipt'); if(rIn){ rIn.value=''; const pv=document.getElementById('receipt_preview'); if(pv) pv.innerHTML=''; } }catch(_){ }
      await loadPayHistory();

      try{
        const caption =
          `🧾 Yangi to‘lov arizasi\n\n`+
          `💰 Summasi: ${amount.toLocaleString('uz-UZ')} so‘m\n`+
          `🧩 Usul: ${selectedMethod}\n`+
          `💳 Karta: **** ${l4}\n`+
          `👤 ID: ${currentDoc?.numericId} | ${currentDoc?.firstName||''} ${currentDoc?.lastName||''}\n`+
          `📞 Tel: ${currentDoc?.phone||'-'}\n`+
          (note?`📝 Izoh: ${note}\n`:'');
        const controller = new AbortController();
        setTimeout(()=>controller.abort(), 3000);
        const url = `${TG_API}/sendMessage`;
        const body = { chat_id: TG_CHAT_ID, text: caption };
        fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body), signal: controller.signal })
          .catch(err=>console.warn('Telegram yuborilmadi:', err));
      }catch(err){ console.warn('Telegram skip:', err); }
    }catch(e){
      if(msg){ msg.className='hint err'; msg.textContent='❌ '+(e.message||e); }
    } finally {
      btn.disabled = false;
    }
  });
}
export async function loadPayHistory(){
  const wrap=qs('#pay_history'); if(!wrap) return;
  wrap.innerHTML='<div class="card">Yuklanmoqda…</div>';
  const col=collection(db,'users', currentUser.uid, 'topups');
  const snap=await getDocs(query(col, orderBy('createdAtFS','desc'), limit(20)));
  wrap.innerHTML='';
  if(snap.empty){ wrap.innerHTML='<div class="hint">Hozircha ma’lumot yo‘q.</div>'; return; }
  snap.forEach(d=>{
    const r=d.data(); const st=r.status||'pending';
    const el=document.createElement('div'); el.className='card';
    el.innerHTML = `<div class="row"><b>${r.amount?.toLocaleString?.('uz-UZ')} so‘m</b>
        <span class="status-badge status-${st}">${st}</span></div>
        <div class="sub">Usul: ${r.method||'-'}  |  💳 **** ${r.cardLast4||'----'}</div>
        ${r.note?`<div class="sub">Izoh: ${r.note}</div>`:''}
        ${r.adminNote && st!=='pending' ? `<div class="sub"><b>Admin izohi:</b> ${r.adminNote}</div>`:''}`;
    wrap.appendChild(el);
  });
}

// ---------- Admin ----------
function ensureAdminSync(){
  if(!ADMIN_NUMERIC_IDS.includes(Number(currentDoc?.numericId))){
    throw new Error('Faqat 1000001/1000002 ruxsat etiladi');
  }
}
async function adminListTop(){
  ensureAdminSync();
  const table=qs('#adm_table'); table.innerHTML='';
  const snap=await getDocs(query(collection(db,'users'), orderBy('numericId','asc'), limit(50)));
  renderAdminTable(snap);
}
async function adminSearch(){
  ensureAdminSync();
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
document.addEventListener('click', async (e)=>{
  if(!(e.target.classList?.contains('a_approve')||e.target.classList?.contains('a_reject'))) return;
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
      const u = await tx.get(userRef); if(!u.exists()) throw new Error('User topilmadi');
      if(approved){
        const newBal = Number(u.data().balance||0) + Number(R.amount||0);
        tx.update(userRef, { balance: newBal });
        tx.update(topupRef, { status:'approved', adminNote: reason, reviewedAt: serverTimestamp(), reviewedBy: currentUser.uid });
      }else{
        tx.update(topupRef, { status:'rejected', adminNote: reason, reviewedAt: serverTimestamp(), reviewedBy: currentUser.uid });
      }
    });
    const badge = row.querySelector('.status-badge');
    if(badge){ badge.textContent = approved? 'approved':'rejected'; badge.className = 'status-badge ' + (approved? 'status-approved':'status-rejected'); }
    row.querySelectorAll('.a_approve,.a_reject').forEach(b=> b.disabled=true);
    alert('Bajarildi ✅');
  }catch(err){
    alert('Xato: '+(err.message||err));
  }
});

async function listPayments(filter='pending'){
  ensureAdminSync();
  const wrap = qs('#adm_pay_table'); if(!wrap) return;
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
        const nid = r.userNumericId ?? u.data().numericId ?? '—';
        const card=document.createElement('div'); card.className='card adm-row'; card.dataset.uid=uid; card.dataset.id=d.id;
        card.innerHTML = `
          <div class="row">
            <b>${r.amount?.toLocaleString?.('uz-UZ')} so‘m</b>
            <span class="status-badge status-${r.status||'pending'}">${r.status||'pending'}</span>
          </div>
          <div class="sub">UserID: ${nid} | Name: ${r.userName||''} | Tel: ${r.userPhone||''}</div>
          <div class="sub">Usul: ${r.method||'-'}  |  💳 **** ${r.cardLast4||'----'}</div>
          <div class="sub">Topup Doc ID: ${d.id}</div>
          ${r.note?`<div class="sub">Foydalanuvchi izohi: ${r.note}</div>`:''}
          ${r.adminNote && r.status!=='pending' ? `<div class="sub"><b>Admin izohi:</b> ${r.adminNote}</div>`:''}
          <textarea class="adm-note" placeholder="Admin izohi (faqat siz uchun)"></textarea>
          <div class="row">
            ${r.status==='pending' ? `<button class="btn primary a_approve">Qabul qilish</button>
            <button class="btn danger a_reject">Rad etish</button>` : ''}
          </div>`;
        wrap.appendChild(card); cnt++;
      });
    }
    if(!cnt){ wrap.innerHTML = '<div class="hint">Hech narsa yo‘q.</div>'; }
  }catch(err){
    wrap.innerHTML = `<div class="card" style="color:#b00020">❌ Xato: ${err?.message||err}</div>`;
    console.error('[payments]', err);
  }
}

// ---------- Tabs ----------
function setTab(tab){
  const tabs = ['Payments','Users','Promo'];
  tabs.forEach(name=>{
    const btn = document.getElementById('tab'+name);
    const pane = document.getElementById('pane'+name);
    if(!btn || !pane) return;
    if(name===tab){ btn.classList.add('active'); pane.classList.remove('hidden'); }
    else{ btn.classList.remove('active'); pane.classList.add('hidden'); }
  });
}

// ---------- Public API for router ----------
window.Settings = {
  initIndex(){ /* nothing special */ },
  initProfile(){ if(currentDoc){ fillProfile(currentDoc); setEditable(false); } const ed=qs('#profileEdit'); const sv=qs('#profileSave');
    ed?.addEventListener('click', ()=> setEditable(true));
    sv?.addEventListener('click', async ()=>{
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
  },
  initResults(){ loadResults(); },
  initBadges(){ renderBadges(currentDoc?.badges||[]); },
  initTopup(){ bindTopup(); loadPayHistory(); },
  initPromo(){
    const btn = document.getElementById('promoApply');
    const input = document.getElementById('promoInput');
    const msg = document.getElementById('promoMsg');
    btn?.addEventListener('click', ()=>{
      msg.textContent = 'Promo kod tizimi keyingi bosqichda yoqiladi.';
    });
  },
  initAdmin(){
    try{ ensureAdminSync(); }catch(e){ alert(e.message); return; }
    setTab('Payments');
    document.getElementById('adm_pay_pending')?.addEventListener('click', ()=>listPayments('pending'));
    document.getElementById('adm_pay_approved')?.addEventListener('click', ()=>listPayments('approved'));
    document.getElementById('adm_pay_rejected')?.addEventListener('click', ()=>listPayments('rejected'));
    document.getElementById('adm_pay_all')?.addEventListener('click', ()=>listPayments('all'));
    document.getElementById('adm_search')?.addEventListener('click', adminSearch);
    document.getElementById('adm_list_all')?.addEventListener('click', adminListTop);
    // auto-load
    listPayments('pending');
    // tabs
    document.getElementById('tabPayments')?.addEventListener('click', ()=> setTab('Payments'));
    document.getElementById('tabUsers')?.addEventListener('click', ()=> { setTab('Users'); adminListTop(); });
    document.getElementById('tabPromo')?.addEventListener('click', ()=> setTab('Promo'));
  }
};
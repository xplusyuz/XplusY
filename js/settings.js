// Settings JS (see analysis above)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, collectionGroup, query, orderBy, where, limit, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const firebaseConfig={apiKey:"AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",authDomain:"xplusy-760fa.firebaseapp.com",projectId:"xplusy-760fa",storageBucket:"xplusy-760fa.appspot.com",messagingSenderId:"992512966017",appId:"1:992512966017:web:5e919dbc9b8d8abcb43c80",measurementId:"G-459PLJ7P7L"};
const ADMIN_NUMERIC_IDS=[1000001,1000002];
const TG_BOT_TOKEN="8021293022:AAGud9dz-Dv_5RjsjF0RFaqgMR2LeKA6G7c";
const TG_CHAT_ID=2049065724;

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const storage=getStorage(app);

let currentUser=null,currentDoc=null;
const qs=s=>document.querySelector(s);
const openModal=id=>qs('#'+id)?.classList.remove('hidden');
const closeModal=el=>el.classList.add('hidden');
document.addEventListener('click',e=>{const o=e.target?.getAttribute?.('data-open');if(o)openModal(o);if(e.target?.hasAttribute?.('data-close')){const m=e.target.closest('.modal');if(m)closeModal(m);}});

onAuthStateChanged(auth, async(user)=>{
  currentUser=user||null; if(!user) return;
  const uref=doc(db,'users',user.uid); const s=await getDoc(uref);
  currentDoc=s.exists()?s.data():null; window.__mcUser={user,profile:currentDoc};
});

// Results
async function loadResults(){
  if(!currentUser) return;
  const box=qs('#resultsBox'); if(!box) return;
  box.innerHTML='<div class="card">Yuklanmoqda…</div>';
  const rows=[], best=[];
  const col=collection(db,'users',currentUser.uid,'attempts');
  const last=await getDocs(query(col,orderBy('createdAt','desc'),limit(20)));
  last.forEach(d=>rows.push({id:d.id,...d.data()}));
  const all=await getDocs(query(col,orderBy('score','desc'),limit(100))); const seen=new Set();
  all.forEach(d=>{const r=d.data();if(seen.has(r.testId))return; best.push({id:d.id,...r}); seen.add(r.testId);});
  const frag=document.createDocumentFragment();
  const sec1=document.createElement('div'); sec1.className='card'; sec1.innerHTML='<h4 style="margin:0 0 6px">Oxirgi 20</h4>';
  rows.forEach(r=>{const div=document.createElement('div');div.className='row';div.innerHTML=`<div><b>${r.title||r.testId||'—'}</b> <span class="sub">(${r.type||'test'})</span></div><div class="pill">${Number(r.score||0)}%</div>`;sec1.appendChild(div);});
  frag.appendChild(sec1);
  const sec2=document.createElement('div'); sec2.className='card'; sec2.innerHTML='<h4 style="margin:8px 0 6px">Eng yaxshi natijalar</h4>';
  best.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  best.forEach(r=>{const div=document.createElement('div');div.className='row';div.innerHTML=`<div><b>${r.title||r.testId||'—'}</b> <span class="sub">(${r.type||'test'})</span></div><div class="pill success">${Number(r.score||0)}%</div>`;sec2.appendChild(div);});
  box.innerHTML=''; box.appendChild(frag);
}
qs('#btnOpenResults')?.addEventListener('click',loadResults);

// Promo redeem
qs('#promo_apply')?.addEventListener('click', async()=>{
  try{
    if(!currentUser) throw new Error('Kirish kerak');
    const code=qs('#promo_code').value.trim(); if(!code) throw new Error('Kod kiriting');
    const ref=doc(db,'promoCodes',code); const s=await getDoc(ref); if(!s.exists()) throw new Error('Kod topilmadi');
    const p=s.data(); if(p.active===false) throw new Error('Kod faol emas');
    const usedRef=doc(db,'users',currentUser.uid,'promoUsed',code); const used=await getDoc(usedRef); if(used.exists()) throw new Error('Avval ishlatilgan');
    const uref=doc(db,'users',currentUser.uid); const u=await getDoc(uref); const cur=u.data()||{};
    await updateDoc(uref,{balance:Number(cur.balance||0)+Number(p.balance||0),gems:Number(cur.gems||0)+Number(p.gems||0)});
    await setDoc(usedRef,{usedAt:serverTimestamp()}); qs('#promo_msg').textContent='✅ Qo‘llandi';
  }catch(err){ qs('#promo_msg').textContent='❌ '+(err.message||err); }
});

// Admin guard + tabs
function ensureAdmin(){const num=Number(currentDoc?.numericId||0); if(![1000001,1000002].includes(num)) throw new Error('Faqat 1000001/1000002');}
document.addEventListener('click',e=>{if(e.target?.closest('#cardAdmin [data-open="adminModal"]')){try{ensureAdmin(); openModal('adminModal');}catch(err){alert(err.message);}}});
document.addEventListener('click',e=>{
  if(e.target?.id==='tabUsers'){qs('#paneUsers')?.classList.remove('hidden');qs('#panePromo')?.classList.add('hidden');qs('#panePayments')?.classList.add('hidden');}
  if(e.target?.id==='tabPromo'){qs('#paneUsers')?.classList.add('hidden');qs('#panePromo')?.classList.remove('hidden');qs('#panePayments')?.classList.add('hidden');}
  if(e.target?.id==='tabPayments'){qs('#paneUsers')?.classList.add('hidden');qs('#panePromo')?.classList.add('hidden');qs('#panePayments')?.classList.remove('hidden');admLoadPayments();}
});

// Admin users
qs('#adm_search')?.addEventListener('click', async()=>{
  try{
    ensureAdmin();
    const qv=qs('#adm_query').value.trim(); const box=qs('#adm_table'); box.innerHTML='';
    if(!qv){box.innerHTML='<div class="hint">Qidiruv qiymatini kiriting</div>'; return;}
    const found=[];
    if(/^[0-9]+$/.test(qv)){const cg=await getDocs(query(collection(db,'users'), where('numericId','==',Number(qv)), limit(30))); cg.forEach(s=>found.push({id:s.id,...s.data()}));}
    if(found.length===0){const snap=await getDocs(query(collection(db,'users'), limit(50))); snap.forEach(s=>{const d=s.data(); if((d.phone||'').includes(qv)) found.push({id:s.id,...d});});}
    if(!found.length){box.innerHTML='<div class="hint">Topilmadi</div>';return;}
    renderUsers(box,found);
  }catch(err){alert(err.message);}
});
qs('#adm_list_all')?.addEventListener('click', async()=>{
  try{ensureAdmin(); const box=qs('#adm_table'); box.innerHTML=''; const snap=await getDocs(query(collection(db,'users'), orderBy('createdAt','desc'), limit(50))); const list=[]; snap.forEach(s=>list.push({id:s.id,...s.data()})); renderUsers(box,list);}catch(err){alert(err.message);} });
function renderUsers(box,list){list.forEach(u=>{const row=document.createElement('div');row.className='card';row.innerHTML=`<div class="row"><div><b>${u.displayName||u.email||u.id}</b> <span class="sub">ID: ${u.numericId||'—'}</span></div><div class="sub">balans: ${Number(u.balance||0).toLocaleString('ru-RU')}</div></div>`; box.appendChild(row);});}

// Admin promo create
qs('#pr_create')?.addEventListener('click', async()=>{
  try{
    ensureAdmin();
    const payload={
      code:qs('#pr_code').value.trim(),
      active:qs('#pr_active').value==='true',
      balance:Number(qs('#pr_balance').value||0),
      gems:Number(qs('#pr_gems').value||0),
      percent:Number(qs('#pr_percent').value||0),
      maxUses:Number(qs('#pr_max').value||0),
      perUserLimit:Number(qs('#pr_peruser').value||1),
      createdAt:serverTimestamp(),
      createdBy:currentUser?.uid||null
    };
    if(!payload.code) throw new Error('Kod');
    const ex=qs('#pr_expires').value; if(ex) payload.expiresAt=new Date(ex+'T23:59:59');
    await setDoc(doc(db,'promoCodes',payload.code),payload); qs('#pr_msg').textContent='✅ Yaratildi';
  }catch(err){qs('#pr_msg').textContent='❌ '+(err.message||err);}
});

// Payments: history + submit
async function tgSendDocument(caption,file){
  const url=`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendDocument`;
  const fd=new FormData(); fd.append('chat_id',TG_CHAT_ID); fd.append('caption',caption); fd.append('document',file,file.name||'receipt');
  const res=await fetch(url,{method:'POST',body:fd}); if(!res.ok) throw new Error('Telegram xatosi: '+res.status); return res.json();
}
async function loadPayHistory(){
  if(!currentUser) return; const list=qs('#pay_history'); if(!list) return;
  list.innerHTML='<div class="card">Yuklanmoqda…</div>';
  const snap=await getDocs(query(collection(db,'users', currentUser.uid, 'payments'), orderBy('createdAt','desc'), limit(50)));
  list.innerHTML=''; if(snap.empty){list.innerHTML='<div class="hint">Hali to‘lov arizasi yo‘q.</div>'; return;}
  snap.forEach(d=>{const p=d.data(); const st=p.status||'pending'; const row=document.createElement('div'); row.className='card'; row.innerHTML=`<div class="row"><div><b>${Number(p.amount||0).toLocaleString('ru-RU')} so‘m</b> <span class="sub">— ${p.method||'manual'}</span></div><div class="pill ${st}">${st}</div></div>`; list.appendChild(row);});
}
document.addEventListener('click',e=>{if(e.target?.closest('#cardBalance [data-open="topUpModal"]')){try{loadPayHistory();}catch{}}});
qs('#pay_submit')?.addEventListener('click', async()=>{
  try{
    if(!currentUser) throw new Error('Kirish kerak');
    const amount=Number(qs('#pay_amount').value||0); const note=qs('#pay_note').value||''; const fileEl=qs('#pay_file'); const file=fileEl?.files?.[0];
    if(!amount||amount<1000) throw new Error('Summani kiriting'); if(!file) throw new Error('Chek faylini tanlang');
    const pref=doc(collection(db,'users',currentUser.uid,'payments')); const payload={id:pref.id,uid:currentUser.uid,amount,note,method:'manual',status:'pending',createdAt:serverTimestamp()};
    await setDoc(pref,payload); try{await setDoc(doc(db,'payments_admin',pref.id),{...payload,userRef:pref.path});}catch{}
    const r=ref(storage,`receipts/${currentUser.uid}/${pref.id}`); await uploadBytes(r,file); const url=await getDownloadURL(r);
    await updateDoc(pref,{receiptUrl:url}); try{await updateDoc(doc(db,'payments_admin',pref.id),{receiptUrl:url});}catch{}
    const me=window.__mcUser?.profile||{}; const cap=`MathCenter — yangi to‘lov arizasi\nID: ${me.numericId||'—'}\nUser: ${me.displayName||currentUser.email||currentUser.uid}\nSumma: ${amount.toLocaleString('ru-RU')} so‘m\nIzoh: ${note}\nReceipt: ${url}`; await tgSendDocument(cap,file);
    qs('#pay_msg').textContent='✅ Yuborildi. Tekshiruv kutilmoqda'; qs('#pay_amount').value=''; qs('#pay_note').value=''; fileEl.value=''; await loadPayHistory();
  }catch(err){ qs('#pay_msg').textContent='❌ '+(err.message||err); }
});

// Admin: payments queue
async function admLoadPayments(){
  try{
    const num=Number(currentDoc?.numericId||0); if(!ADMIN_NUMERIC_IDS.includes(num)) return;
    const box=qs('#adm_payments'); if(!box) return; box.innerHTML='<div class="card">Yuklanmoqda…</div>';
    const snap=await getDocs(query(collection(db,'payments_admin'), orderBy('createdAt','desc'), limit(200))); box.innerHTML='';
    if(snap.empty){box.innerHTML='<div class="hint">Hozircha ariza yo‘q.</div>'; return;}
    snap.forEach(d=>{const p=d.data(); p.id=d.id; const sum=Number(p.amount||0).toLocaleString('ru-RU'); const row=document.createElement('div'); row.className='card'; row.innerHTML=`<div class="row"><div><b>${sum} so‘m</b> <span class="sub">UID: ${p.uid||'-'}</span></div><div class="sub" style="max-width:420px;overflow:auto">Izoh: ${p.note||''}</div><div><a class="btn ghost" href="${p.receiptUrl||'#'}" target="_blank">Chek</a><button class="btn success" data-approve="${p.id}">Qabul</button><button class="btn danger" data-reject="${p.id}">Rad</button></div></div>`; box.appendChild(row);});
  }catch(err){alert(err.message);}
}
document.addEventListener('click', async(e)=>{
  const ap=e.target?.getAttribute?.('data-approve'); const rj=e.target?.getAttribute?.('data-reject'); if(!ap && !rj) return;
  const num=Number(currentDoc?.numericId||0); if(!ADMIN_NUMERIC_IDS.includes(num)) return;
  if(ap){const comment=prompt('Izoh (ixtiyoriy):',''); try{const pa=await getDoc(doc(db,'payments_admin',ap)); const data=pa.data(); if(!data) throw new Error('Topilmadi'); const uref=doc(db,'users',data.uid); const udoc=await getDoc(uref); const bal=Number(udoc.data()?.balance||0)+Number(data.amount||0); await updateDoc(uref,{balance:bal}); await updateDoc(doc(db,'users',data.uid,'payments',ap),{status:'approved',adminComment:comment||''}); await updateDoc(doc(db,'payments_admin',ap),{status:'approved',adminComment:comment||''}); await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:TG_CHAT_ID,text:`✅ Qabul qilindi: ${Number(data.amount||0).toLocaleString('ru-RU')} so‘m (UID: ${data.uid})`})}); admLoadPayments(); alert('Qabul qilindi');}catch(err){alert('Xato: '+(err.message||err));}}
  if(rj){const comment=prompt('Rad etish sababi:',''); try{const pa=await getDoc(doc(db,'payments_admin',rj)); const data=pa.data(); if(!data) throw new Error('Topilmadi'); await updateDoc(doc(db,'users',data.uid,'payments',rj),{status:'rejected',adminComment:comment||''}); await updateDoc(doc(db,'payments_admin',rj),{status:'rejected',adminComment:comment||''}); await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:TG_CHAT_ID,text:`❌ Rad etildi: ${Number(data.amount||0).toLocaleString('ru-RU')} so‘m (UID: ${data.uid}) — ${comment||''}`})}); admLoadPayments(); alert('Rad etildi');}catch(err){alert('Xato: '+(err.message||err));}}
});

// js/topup.js — standalone
import { attachAuthUI, initUX, db } from "./common.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";
import { doc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
const storage = getStorage();

function digitsOnly(s){ return (s||'').replace(/\D+/g,''); }
function last4(s){ const d=digitsOnly(s); return d.slice(-4); }

async function loadPayHistory(){
  const wrap=document.getElementById('pay_history'); if(!wrap) return;
  const uid = window.__mcUser?.user?.uid; if(!uid) return;
  wrap.innerHTML='<div class="card">Yuklanmoqda…</div>';
  const snap=await getDocs(query(collection(db,'users', uid, 'topups'), orderBy('createdAtFS','desc'), limit(20)));
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

export default {
  async init(){
    attachAuthUI({ requireSignIn:true }); initUX?.();
    let selectedMethod=null;
    document.addEventListener('click', (e)=>{
      const m=e.target.closest?.('.method'); if(!m) return;
      selectedMethod = m.getAttribute('data-method');
      document.querySelectorAll('.method').forEach(x=> x.classList.toggle('active', x===m));
      const fv = document.getElementById('pay_method_view'); if(fv) fv.value = selectedMethod;
    });

    const rIn = document.getElementById('pay_receipt');
    const rBox = document.getElementById('receipt_preview');
    if(rIn){
      rIn.addEventListener('change', ()=>{
        if(!rBox) return;
        rBox.innerHTML='';
        const f = rIn.files && rIn.files[0];
        if(!f) return;
        if((f.size||0) > 5*1024*1024){ rBox.textContent = '❌ Fayl 5 MB dan oshmasin'; return; }
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
    btn?.addEventListener('click', async ()=>{
      const msg=document.getElementById('pay_msg'); if(msg){ msg.className='hint'; msg.textContent='Yuborilmoqda…'; }
      btn.disabled = true;
      try{
        const uid = window.__mcUser?.user?.uid;
        if(!uid) throw new Error('User yo‘q');
        if(!selectedMethod) throw new Error('Avval to‘lov usulini tanlang');
        const amount = Number((document.getElementById('pay_amount')?.value)||0);
        if(!amount || amount<1000) throw new Error('Summani kiriting (min 1000)');
        const cardIn = document.getElementById('pay_card')?.value || '';
        const l4 = last4(cardIn);
        if(!l4 || l4.length<4) throw new Error('Kartaning oxirgi 4 ta raqamini kiriting');
        const note = (document.getElementById('pay_note')?.value||'').trim();

        const id = Math.random().toString(36).slice(2);
        let receiptURL=null, receiptType=null, receiptName=null, receiptSize=null;
        const file = rIn && rIn.files && rIn.files[0];
        if(file){
          if((file.size||0) > 5*1024*1024) throw new Error('Fayl hajmi 5 MB dan oshmasin');
          const safeName = (file.name||'receipt').replace(/[^\w.\-]+/g,'_');
          const path = `users/${uid}/topups/${id}/${safeName}`;
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
          userNumericId: window.__mcUser?.profile?.numericId || null,
          userName: `${window.__mcUser?.profile?.firstName||''} ${window.__mcUser?.profile?.lastName||''}`.trim(),
          userPhone: window.__mcUser?.profile?.phone || null,
          receiptURL, receiptType, receiptName, receiptSize
        };
        await setDoc(doc(db,'users', uid, 'topups', id), payload);

        if(msg){ msg.className='hint ok'; msg.textContent='✅ Yuborildi. Arizangiz ko‘rib chiqiladi.'; }
        ['pay_amount','pay_card','pay_note'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
        try{ if(rIn){ rIn.value=''; if(rBox) rBox.innerHTML=''; } }catch(_){ }
        await loadPayHistory();
      }catch(e){
        if(msg){ msg.className='hint err'; msg.textContent='❌ '+(e.message||e); }
      } finally { btn.disabled=false; }
    });

    const run = ()=> loadPayHistory();
    if(window.__mcUser?.user) run(); else document.addEventListener('mc:user-ready', run, { once:true });
  },
  destroy(){}
}
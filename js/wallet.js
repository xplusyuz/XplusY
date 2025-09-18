import { getCtx, refreshHeader } from './common.js';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

export async function onMount(){
  const { db, storage, user } = getCtx();
  const msg = document.getElementById('topupMsg');
  const btn = document.getElementById('btnUploadReceipt');
  const file = document.getElementById('topupFile');
  const amount = document.getElementById('topupAmount');
  const list = document.getElementById('topupsList');

  btn?.addEventListener('click', async ()=>{
    if(!user) { alert('Kirish talab qilinadi'); return; }
    const f = file.files[0];
    const val = parseInt(amount.value||'0',10);
    if(!f || !val || val<1000) { msg.textContent='Fayl va summa talab qilinadi'; return; }
    const r = ref(storage, `receipts/${user.uid}/${Date.now()}_${f.name}`);
    await uploadBytes(r, f);
    const url = await getDownloadURL(r);
    await addDoc(collection(db,'topups'),{
      uid: user.uid, amount: val, url, status: 'pending', createdAt: serverTimestamp()
    });
    msg.textContent = 'Yuklandi. Tasdiqlash kutilmoqda.';
  });

  // Promo
  const promoInput = document.getElementById('promoInput');
  const btnRedeem = document.getElementById('btnRedeem');
  const promoMsg = document.getElementById('promoMsg');

  btnRedeem?.addEventListener('click', async ()=>{
    if(!user) { alert('Kirish talab qilinadi'); return; }
    const code = (promoInput.value||'').trim();
    if(!code){ promoMsg.textContent='Kod kiriting'; return; }
    // Transaction: promoCodes/{code} must exist and unused
    await runTransaction(db, async (tx)=>{
      const pref = doc(db,'promoCodes',code);
      const psnap = await tx.get(pref);
      if(!psnap.exists()) throw new Error('Kod topilmadi');
      const pd = psnap.data();
      if(pd.usedBy) throw new Error('Bu kod avval ishlatilgan');
      const uref = doc(db,'users',user.uid);
      const usnap = await tx.get(uref);
      const ud = usnap.data()||{};
      tx.update(pref,{ usedBy: user.uid, usedAt: serverTimestamp() });
      tx.update(uref,{ gems: (ud.gems||0) + (pd.amount||0) });
    }).then(async()=>{
      promoMsg.textContent='Kod faollashtirildi ✓';
      await refreshHeader();
    }).catch(e=> promoMsg.textContent='Xato: '+e.message);
  });

  // History
  async function loadTopups(){
    if(!user) return;
    const qs = await getDocs(query(collection(db,'topups'), where('uid','==', user.uid), orderBy('createdAt','desc')));
    list.innerHTML = '';
    qs.forEach(doc=>{
      const d = doc.data();
      const li = document.createElement('li');
      li.textContent = `${(d.amount||0)} so‘m — ${d.status}`;
      list.appendChild(li);
    });
  }
  loadTopups();
}

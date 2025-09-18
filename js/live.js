import { getCtx } from './common.js';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let unsub = null;

export async function onMount(){
  const { db, user } = getCtx();
  const liveRef = doc(db,'live','current');
  const statusEl = document.getElementById('liveStatus');
  const partEl = document.getElementById('participants');
  const btnJoin = document.getElementById('btnJoinLive');
  const btnStart = document.getElementById('btnStartLive');
  const btnStop = document.getElementById('btnStopLive');

  async function ensureLive(){
    const snap = await getDoc(liveRef);
    if(!snap.exists()){
      await setDoc(liveRef,{status:'lobby', createdAt: serverTimestamp()});
    }
  }
  await ensureLive();

  unsub = onSnapshot(liveRef, (s)=>{
    const d = s.data()||{};
    statusEl.textContent = 'Holat: ' + (d.status||'—');
  });

  const partsRef = collection(db,'live','current','participants');
  onSnapshot(partsRef, (qs)=>{
    const rows = [];
    let i=1;
    qs.forEach(doc=>{
      const d = doc.data();
      rows.push(`<li>${i++}. ${d.name||'Anon'} (ID: ${d.numericId||'—'})</li>`);
    });
    partEl.innerHTML = rows.join('');
  });

  btnJoin?.addEventListener('click', async ()=>{
    if(!user){ alert('Kirish talab qilinadi'); return; }
    const u = await getDoc(doc(db,'users',user.uid));
    const d = u.data()||{};
    await addDoc(partsRef, { uid: user.uid, name: d.name||'Foydalanuvchi', numericId: d.numericId||'', joinedAt: serverTimestamp() });
  });

  btnStart?.addEventListener('click', async ()=>{
    await updateDoc(liveRef,{status:'running'});
  });
  btnStop?.addEventListener('click', async ()=>{
    await updateDoc(liveRef,{status:'stopped'});
  });
}

export function onUnmount(){
  if(unsub) unsub();
}

import { doc, getDoc, serverTimestamp, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

function pad6(n){const s=String(n); return s.length>=6?s:('0'.repeat(6-s.length)+s)}

export async function ensureUserDoc({uid, phone, name}){
  const ref = doc(db,'users',uid);
  const snap = await getDoc(ref);
  if(snap.exists()){
    const data = snap.data();
    const patch = {};
    if(name && !data.name) patch.name=name;
    if(phone && !data.phone) patch.phone=phone;
    if(Object.keys(patch).length){ patch.updatedAt=serverTimestamp(); await updateDoc(ref, patch); }
    return data;
  }

  const metaRef = doc(db,'meta','counters');
  const userDoc = await runTransaction(db, async (tx)=>{
    const metaSnap = await tx.get(metaRef);
    const meta = metaSnap.exists()? metaSnap.data(): {};
    const next = Number(meta.userCount||0)+1;
    tx.set(metaRef, { userCount: next }, { merge:true });
    const omId = 'OM'+pad6(next);
    const u = { omId, name: name||'', phone: phone||'', role:'user', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    tx.set(ref, u, { merge:true });
    return u;
  });
  return userDoc;
}

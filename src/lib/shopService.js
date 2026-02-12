import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where, runTransaction, serverTimestamp, setDoc, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export function listenProducts({search=''}, cb){
  const col = collection(db,'products');
  const q = query(col, where('isActive','==',true), orderBy('updatedAt','desc'), limit(60));
  return onSnapshot(q, (snap)=>{
    let list = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(search.trim()){
      const s = search.trim().toLowerCase();
      list = list.filter(p => (p.title||'').toLowerCase().includes(s));
    }
    cb(list);
  });
}

export function listenCart(uid, cb){
  const ref = doc(db,'carts',uid);
  return onSnapshot(ref, (snap)=> cb(snap.exists()? snap.data() : { items: [] }));
}

export async function addToCart(uid, item){
  const ref = doc(db,'carts',uid);
  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(ref);
    const data = snap.exists()? snap.data() : { items: [] };
    const items = Array.isArray(data.items)? [...data.items] : [];
    const key = `${item.productId}__${item.colorKey||''}__${item.size||''}`;
    const idx = items.findIndex(i => `${i.productId}__${i.colorKey||''}__${i.size||''}` === key);
    if(idx>=0) items[idx] = { ...items[idx], qty: Number(items[idx].qty||1) + Number(item.qty||1) };
    else items.push({ ...item, qty: Number(item.qty||1) });
    tx.set(ref, { items, updatedAt: serverTimestamp() }, { merge:true });
  });
}

export async function removeFromCart(uid, key){
  const ref = doc(db,'carts',uid);
  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists()) return;
    const data = snap.data();
    const items = (data.items||[]).filter(i => `${i.productId}__${i.colorKey||''}__${i.size||''}` !== key);
    tx.set(ref, { items, updatedAt: serverTimestamp() }, { merge:true });
  });
}

export async function clearCart(uid){
  const ref = doc(db,'carts',uid);
  await setDoc(ref, { items: [], updatedAt: serverTimestamp() }, { merge:true });
}

export async function createOrder({uid, userSnapshot, items, delivery, paymentMethod}){
  const metaRef = doc(db,'meta','counters');
  const created = await runTransaction(db, async (tx)=>{
    const metaSnap = await tx.get(metaRef);
    const meta = metaSnap.exists()? metaSnap.data(): {};
    const next = Number(meta.orderCount||0)+1;
    tx.set(metaRef, { orderCount: next }, { merge:true });

    const orderNo = `ORZ-${new Date().getFullYear()}-${String(next).padStart(6,'0')}`;
    const totalAmount = (items||[]).reduce((s,i)=> s + Number(i.price||0)*Number(i.qty||1), 0);

    const order = {
      orderNo,
      userId: uid,
      userSnapshot: userSnapshot||{},
      items: items||[],
      totalAmount,
      delivery: delivery||{ type:'text', addressText:'' },
      payment: { method: paymentMethod||'cash', status:'pending', provider: paymentMethod==='payme'?'payme':null, providerTxnId:null, verifiedAt:null },
      status: 'new',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const orderRef = doc(collection(db,'orders'));
    tx.set(orderRef, order);
    return { id: orderRef.id, ...order };
  });
  return created;
}

export function listenOrdersForUser(uid, cb){
  const col = collection(db,'orders');
  const q = query(col, where('userId','==',uid), orderBy('createdAt','desc'), limit(30));
  return onSnapshot(q, (snap)=> cb(snap.docs.map(d=>({id:d.id, ...d.data()}))));
}

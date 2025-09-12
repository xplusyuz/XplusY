// js/promo-client.js — helper to redeem promos from 'promos' collection
import { auth, db } from './app.js';
import { doc, getDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function redeemPromo(code){
  if(!auth.currentUser) throw new Error("Kirish talab qilinadi");
  const promoRef = doc(db,'promos', code);
  const userRef = doc(db,'users', auth.currentUser.uid);
  await runTransaction(db, async (tx)=>{
    const [ps, us] = await Promise.all([tx.get(promoRef), tx.get(userRef)]);
    if(!ps.exists()) throw new Error("Promo topilmadi");
    const p = ps.data();
    if(p.active===false) throw new Error("Promo faol emas");
    if(p.maxUses && Number(p.usedCount||0) >= Number(p.maxUses)) throw new Error("Promo limiti tugagan");
    if(p.expiresAt && p.expiresAt.toDate && p.expiresAt.toDate() < new Date()) throw new Error("Muddati o'tgan");
    const u = us.data();
    const used = new Set(u.usedPromos||[]);
    if(used.has(code)) throw new Error("Bu promo avval ishlatilgan");
    // apply
    const credit = Number(p.creditSom||0);
    const newBal = Number(u.balance||0) + credit;
    used.add(code);
    tx.update(userRef, { balance: newBal, usedPromos: Array.from(used), updatedAt: serverTimestamp() });
    tx.update(promoRef, { usedCount: Number(p.usedCount||0)+1 });
  });
  return true;
}

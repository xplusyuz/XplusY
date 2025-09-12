
import { db, auth } from './app.js';
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Redeem promo code -> adds gems
export async function redeemPromo(code, amount=0){
  if(!auth.currentUser) throw new Error("Kirish talab qilinadi");
  const ref = doc(db,'users',auth.currentUser.uid);
  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists()) throw new Error("User doc yo'q");
    const u = snap.data();
    const used = new Set(u.usedPromos||[]);
    if(used.has(code)) throw new Error("Promo allaqachon ishlatilgan");
    const gems = Number(u.gems||0) + Number(amount||0);
    used.add(code);
    tx.update(ref, { gems, usedPromos: Array.from(used) });
  });
}

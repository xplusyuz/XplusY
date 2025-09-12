import { auth, db, updateGems } from "./app.js";
import { doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

async function redeem(code){
  if (!code) throw new Error("Kod kiritilmadi");
  const user = auth.currentUser;
  if (!user) throw new Error("Kirish talab qilinadi");

  const pref = doc(db,"promoCodes", code);
  await runTransaction(db, async (tx)=>{
    const ps = await tx.get(pref);
    if (!ps.exists()) throw new Error("Kod topilmadi");
    const p = ps.data();
    if (p.active===false) throw new Error("Kod faol emas");
    const used = (p.usedBy||[]);
    if (used.includes(user.uid)) throw new Error("Allaqachon ishlatilgan");
    used.push(user.uid);
    tx.update(pref, { usedBy: used });
  });
  const snap = await getDoc(doc(db,"promoCodes", code));
  const g = Number(snap.data()?.value||0);
  if (g>0) await updateGems(auth.currentUser.uid, g);
}

document.addEventListener("DOMContentLoaded", ()=>{
  $("#btnPromo").addEventListener("click", async ()=>{
    try{
      await redeem($("#promo").value.trim());
      toast("Promo faollashtirildi");
    }catch(e){ alert(e?.message||e); }
  });
});
import { auth, getProfile, loadProfileFromFirestore, saveProfileToFirestore, generateUniqueNumericId, isProfileComplete, redeemPromo, signOutGoogle } from '../assets/app.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

function el(id){ return document.getElementById(id); }
async function prefill(){
  const p = getProfile() || await loadProfileFromFirestore();
  const u = auth.currentUser;
  if(!p){
    try{ el('pfId').value = await generateUniqueNumericId(); }catch{ el('pfId').value = String(Math.floor(10000000 + Math.random()*90000000)); }
    el('pfEmail').value = u?.email || '';
    return;
  }
  el('pfId').value = p.numericId||'';
  el('pfFirst').value = p.first||'';
  el('pfLast').value = p.last||'';
  el('pfPatron').value = p.patron||'';
  el('pfBirth').value = p.birth||'';
  el('pfPhone').value = p.phone||'';
  el('pfTelegram').value = p.telegram||'';
  el('pfEmail').value = p.email|| (u?.email||'');
  el('pfAddress').value = p.address||'';
  el('pfSchool').value = p.school||'';
  el('pfRole').value = p.role||'';
  el('pfBalance').value = p.balance||0;
  el('pfPoints').value = p.points||0;
}
async function save(){
  const u = auth.currentUser; if(!u) return alert('Kirish kerak');
  const first = el('pfFirst').value.trim();
  const last  = el('pfLast').value.trim();
  const birth = el('pfBirth').value.trim();
  const phone = el('pfPhone').value.trim();
  const role  = el('pfRole').value;
  if(!first || !last || !birth || !phone || !role){ alert('Ism, Familiya, Tug‘ilgan sana, Telefon va Rol majburiy.'); return; }
  const profile = {
    numericId: el('pfId').value.trim(),
    first, last, patron: el('pfPatron').value.trim(),
    birth, phone, telegram: el('pfTelegram').value.trim(),
    email: el('pfEmail').value.trim(), address: el('pfAddress').value.trim(),
    school: el('pfSchool').value.trim(), role,
    balance: Number(el('pfBalance').value||0), points: Number(el('pfPoints').value||0),
    updatedAt: new Date().toISOString()
  };
  try{ await saveProfileToFirestore(profile); alert('Profil saqlandi'); }catch(e){ alert(e.message); }
}
async function applyPromo(){
  try{
    const code = el('promoCode').value;
    const res = await redeemPromo(code);
    el('promoMsg').textContent = `Promokod qabul qilindi! +${res.addBal} balans, +${res.addPts} ball.`;
    await prefill();
  }catch(e){
    const map={PROMO_EMPTY:'Kod kiritilmadi', PROMO_NOT_FOUND:'Kod topilmadi', PROMO_DISABLED:'Kod o‘chirilgan', PROMO_LIMIT:'Kod limit tugagan', PROMO_EXPIRED:'Kod muddati tugagan', PROMO_ALREADY_USED:'Bu kod allaqachon ishlatilgan'};
    el('promoMsg').textContent = map[e.message]||e.message;
  }
}
el('pfSave').addEventListener('click', save);
el('pfCancel').addEventListener('click', ()=>history.back());
el('promoApply').addEventListener('click', applyPromo);
el('logout').addEventListener('click', async ()=>{ await signOutGoogle(); });
onAuthStateChanged(auth, async (user)=>{ if(user){ await prefill(); } });
prefill();

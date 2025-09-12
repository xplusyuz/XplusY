// js/admin-visibility.js (auth-aware)
import { auth, db } from './app.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function ensureCard(){
  let card = document.getElementById('admin-card');
  if (!card) {
    // create minimal card if markup not present (safety)
    card = document.createElement('div');
    card.id = 'admin-card';
    card.className = 'card';
    card.style.display = 'none';
    card.innerHTML = `<h3>🛠️ Admin</h3>
      <p class="meta">Foydalanuvchi tahriri, natijalar, CSV menejer, promo kodlar</p>
      <p><a class="btn" href="#admin">Ochilish</a></p>`;
    (document.querySelector('.container') || document.body).appendChild(card);
  }
  return card;
}

async function checkAndToggle(){
  const card = ensureCard();
  try{
    const uid = auth.currentUser?.uid;
    if(!uid){ card.style.display='none'; return; }
    const snap = await getDoc(doc(db,'users', uid));
    const u = snap.exists() ? snap.data() : {};
    const num = Number(u.numericId ?? u.numeric_id ?? 0);
    card.style.display = (num === 1000001 || num === 1000002) ? 'block' : 'none';
  }catch(e){
    // If rules block reading, keep hidden silently
    card.style.display = 'none';
    console.warn('[admin-visibility]', e.message);
  }
}

export async function wireAdminCard(){
  // run once now (in case auth is already ready)
  await checkAndToggle();
  // and re-run when auth changes
  try {
    onAuthStateChanged(auth, ()=>{ checkAndToggle(); });
  } catch(e){
    console.warn('[admin-visibility] onAuthStateChanged error', e.message);
  }
}

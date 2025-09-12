// js/admin-visibility.js
import { auth, db } from './app.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function wireAdminCard(){
  const card = document.getElementById('admin-card');
  if(!card) return;
  try{
    const uid = auth.currentUser?.uid;
    if(!uid){ card.style.display='none'; return; }
    const snap = await getDoc(doc(db,'users', uid));
    const u = snap.data()||{};
    const id = Number(u.numericId||0);
    card.style.display = (id===1000001 || id===1000002) ? 'block' : 'none';
  }catch(e){
    card.style.display='none';
    console.warn('[admin-visibility]', e.message);
  }
}

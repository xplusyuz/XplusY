import { db, auth } from './app.js';
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function renderLeaderboard(root){
  root.innerHTML = `<div class="container">
    <div class="banner"><h2>🏆 TOP 100 — Olmos</h2></div>
    <div class="card"><table class="table" id="lb"></table></div>
  </div>`;
  const tb = root.querySelector('#lb');
  tb.innerHTML = `<tr><th>#</th><th>Foydalanuvchi</th><th>Olmos</th></tr>`;
  const q = query(collection(db, 'users'), orderBy('gems','desc'), limit(100));
  const snap = await getDocs(q);
  let i=0;
  snap.forEach(doc=>{
    const u = doc.data();
    i++;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i}</td><td>${u.firstName||'-'} ${u.lastName||''}</td><td>${u.gems||0}</td>`;
    tb.appendChild(tr);
  });
}

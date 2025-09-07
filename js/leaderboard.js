
import { attachAuthUI, initUX, db } from "./common.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

attachAuthUI({ requireSignIn: true });
initUX();
const lb=document.querySelector('#lb');

async function load(){
  lb.innerHTML='<div class="card">Yuklanmoqda…</div>';
  const snap=await getDocs(query(collection(db,'users'), orderBy('gems','desc'), limit(100)));
  lb.innerHTML='';
  let rank=1;
  snap.forEach(d=>{
    const u=d.data();
    const row=document.createElement('div'); row.className='card';
    row.innerHTML=`<b>${rank++}.</b> ${u.displayName || (u.firstName||'-')} <span class="pill">ID: ${u.numericId ?? '—'}</span> <span class="pill">💎 ${u.gems ?? 0}</span>`;
    lb.appendChild(row);
  });
}
load();

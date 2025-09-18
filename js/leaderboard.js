import { getCtx } from './common.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function onMount(){
  const { db } = getCtx();
  const qs = await getDocs(query(collection(db,'users'), orderBy('gems','desc'), limit(100)));
  const tb = document.querySelector('#lbTable tbody');
  let i=1, html='';
  qs.forEach(doc=>{
    const d = doc.data();
    html += `<tr>
      <td style="padding:8px">${i++}</td>
      <td style="padding:8px">${d.name||'Foydalanuvchi'} (ID: ${d.numericId||'—'})</td>
      <td style="padding:8px;text-align:right">${d.gems||0}</td>
    </tr>`;
  });
  tb.innerHTML = html;
}

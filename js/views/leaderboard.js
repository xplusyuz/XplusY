import { getTopLeaderboard, el } from '../common.js';

export async function mount(){
  const tbody = document.querySelector('#lbTable tbody');
  tbody.innerHTML = '';
  const list = await getTopLeaderboard(100);
  list.forEach((u, i) => {
    const tr = el(`<tr>
      <td>${i+1}</td>
      <td>${u.firstName||'User'}</td>
      <td>${u.numericId||'—'}</td>
      <td>${u.gems||0}</td>
    </tr>`);
    tbody.appendChild(tr);
  });
}

const { db, collection, query, orderBy, getDocs } = window.fb;
const tbody = document.getElementById('ratingBody');
const exportBtn = document.getElementById('exportCSV');
const tableEl = document.getElementById('ratingTable');

async function loadRating(){
  const now = new Date(); const past = new Date(now.getTime()-90*24*60*60*1000);
  const qs = query(collection(db,'attempts'), orderBy('finishedAt','desc'));
  const snap = await getDocs(qs);
  const totals = new Map();
  snap.forEach(d=>{
    const a=d.data(); if(!a.userId) return;
    const finished=a.finishedAt?.toDate?.() || past; if (finished<past) return;
    const prev=totals.get(a.userId)||{ name:a.userName||'Anon', points:0, attempts:0 };
    prev.points += (a.earnedPoints||0); prev.attempts += 1; totals.set(a.userId, prev);
  });
  const rows=[...totals.entries()].map(([uid,v])=>({uid,...v})).sort((a,b)=>b.points-a.points);
  tbody.innerHTML = rows.map((r,i)=> `<tr><td>${i+1}</td><td>${r.name}</td><td><b>${r.points}</b></td><td>${r.attempts}</td></tr>`).join('');
}
function toCSV(table){
  const rows=[...table.querySelectorAll('tr')].map(tr=> [...tr.children].map(td=> `"${(td.textContent||'').replace(/"/g,'""')}"`).join(','));
  return rows.join('\n');
}
exportBtn.addEventListener('click', ()=>{
  const csv = toCSV(tableEl);
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='umumiy-reyting.csv'; a.click(); URL.revokeObjectURL(url);
});
loadRating();

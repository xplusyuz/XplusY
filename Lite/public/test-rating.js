const { db, collection, query, where, orderBy, getDocs, doc, getDoc } = window.fb;
const tbody = document.getElementById('ratingBody');
const exportBtn = document.getElementById('exportCSV');
const tableEl = document.getElementById('ratingTable');
const testTitleNote = document.getElementById('testTitleNote');
const input = document.getElementById('testIdInput'); const loadBtn = document.getElementById('loadBtn');

function getQP(name){ return new URLSearchParams(location.search).get(name); }

async function loadTestTitle(id){
  try{ const t=await getDoc(doc(db,'tests',id)); if(t.exists()) testTitleNote.textContent = `Test: ${t.data().title} (${id})`; else testTitleNote.textContent=`Test topilmadi (${id})`; }
  catch{ testTitleNote.textContent=`Test: ${id}`; }
}

async function loadRatingForTest(testId){
  await loadTestTitle(testId);
  const qs = query(collection(db,'attempts'), where('testId','==',testId), orderBy('earnedPoints','desc'));
  const snap = await getDocs(qs);
  const rows = snap.docs.map(d=> d.data()).sort((a,b)=> (b.earnedPoints||0)-(a.earnedPoints||0));
  tbody.innerHTML = rows.map((r,i)=>{
    const dt = r.finishedAt?.toDate?.() ? r.finishedAt.toDate().toISOString().slice(0,19).replace('T',' ') : '';
    return `<tr><td>${i+1}</td><td>${r.userName||'Anon'}</td><td><b>${r.earnedPoints||0}</b> / ${r.totalPoints||0}</td><td>${r.scorePercent||0}%</td><td>${dt}</td></tr>`;
  }).join('');
}

function toCSV(table){
  const rows=[...table.querySelectorAll('tr')].map(tr=> [...tr.children].map(td=> `"${(td.textContent||'').replace(/"/g,'""')}"`).join(','));
  return rows.join('\n');
}
exportBtn.addEventListener('click', ()=>{
  const csv = toCSV(tableEl);
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='test-reyting.csv'; a.click(); URL.revokeObjectURL(url);
});
loadBtn.addEventListener('click', ()=>{
  const id = input.value.trim(); if(!id) return; history.replaceState(null,'',`?testId=${encodeURIComponent(id)}`); loadRatingForTest(id);
});

const qp = getQP('testId'); if(qp){ input.value=qp; loadRatingForTest(qp); }

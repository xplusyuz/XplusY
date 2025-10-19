const { db, collection, query, orderBy, getDocs, requireAuth } = window.fb;
const tagSelect = document.getElementById('tagSelect');
const loadBtn = document.getElementById('loadBtn');
const tbody = document.getElementById('ratingBody');
const exportBtn = document.getElementById('exportCSV');
const tableEl = document.getElementById('ratingTable');

requireAuth(()=> init());

async function init(){
  // Collect unique tags from tests
  const tSnap = await getDocs(collection(db,'tests'));
  const set = new Set();
  tSnap.forEach(d=> (d.data().tags||[]).forEach(t=> set.add(t)));
  tagSelect.innerHTML = [...set].sort().map(t=> `<option>${t}</option>`).join('');
}

loadBtn.addEventListener('click', ()=> loadTag());

async function loadTag(){
  const tag = tagSelect.value; if(!tag) return;
  const aSnap = await getDocs(query(collection(db,'attempts'), orderBy('finishedAt','desc')));
  const totals = new Map();
  aSnap.forEach(d=>{
    const a=d.data(); if(!a.userId) return;
    const tags=a.tags||[]; if (!tags.includes(tag)) return;
    const prev=totals.get(a.userId)||{ name:a.userName||'Anon', points:0, attempts:0 };
    prev.points += (a.earnedPoints||0); prev.attempts += 1; totals.set(a.userId, prev);
  });
  const rows=[...totals.entries()].map(([uid,v])=>({uid,...v})).sort((a,b)=>b.points-a.points);
  tbody.innerHTML = rows.map((r,i)=> `<tr><td>${i+1}</td><td>${r.name}</td><td><b>${r.points}</b></td><td>${r.attempts}</td></tr>`).join('');
}

function toCSV(table){ const rows=[...table.querySelectorAll('tr')].map(tr=> [...tr.children].map(td=> `"${(td.textContent||'').replace(/"/g,'""')}"`).join(',')); return rows.join('\n'); }
exportBtn.addEventListener('click', ()=>{ const csv=toCSV(tableEl); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='teg-reyting.csv'; a.click(); URL.revokeObjectURL(url); });

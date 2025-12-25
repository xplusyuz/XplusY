const users = [
  {name:'Sohibjon', pts:980, region:'Namangan'},
  {name:'Dilshod', pts:860, region:'Toshkent'},
  {name:'Aziza', pts:920, region:'Andijon'},
  {name:'Jasur', pts:740, region:'Farg‘ona'},
  {name:'Malika', pts:810, region:'Samarqand'},
  {name:'Ulug‘bek', pts:650, region:'Buxoro'},
  {name:'Madina', pts:705, region:'Xorazm'},
  {name:'Sardor', pts:540, region:'Qashqadaryo'},
];

const q=document.getElementById('q');
const sort=document.getElementById('sort');
const list=document.getElementById('list');

function groupByPts(p){
  if(p>=900) return ['Diamond','b-diamond'];
  if(p>=800) return ['Gold','b-gold'];
  if(p>=700) return ['Silver','b-silver'];
  return ['Bronze','b-bronze'];
}

function render(){
  const query=(q.value||'').toLowerCase();
  const arr=users
    .filter(u=>u.name.toLowerCase().includes(query))
    .slice();

  if(sort.value==='pts') arr.sort((a,b)=>b.pts-a.pts);
  else arr.sort((a,b)=>a.name.localeCompare(b.name,'uz'));

  list.innerHTML='';
  arr.forEach((u,i)=>{
    const [g,cls]=groupByPts(u.pts);
    const row=document.createElement('div');
    row.className='item';
    row.innerHTML=`
      <div class="left">
        <div class="rank">#${i+1}</div>
        <div style="min-width:0">
          <div class="name">${u.name}</div>
          <div class="meta">${u.region}</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="badge ${cls}">${g}</span>
        <div class="pts">${u.pts}</div>
      </div>
    `;
    list.appendChild(row);
  });

  if(!list.children.length){
    const row=document.createElement('div');
    row.className='item';
    row.innerHTML=`<div class="name">Topilmadi</div><div class="meta">Qidiruvni o‘zgartiring.</div>`;
    list.appendChild(row);
  }
}

q.addEventListener('input', render);
sort.addEventListener('change', render);
render();

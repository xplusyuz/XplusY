
// Demo test cards (static). Replace with Firestore-backed content later.
const tests = [
  { title:"DTM Kuzgi", class:"11-sinf", level:"Oson", reward:"+1/-0.25" },
  { title:"ChSB Boshlang'ich", class:"5-sinf", level:"O'rta", reward:"+2/-0.5" },
  { title:"SAT Math", class:"Advanced", level:"Qiyin", reward:"+3/-1" },
  { title:"Milliy", class:"Aralash", level:"O'rta", reward:"+2/-0.5" },
  { title:"BSB Algebra", class:"8-sinf", level:"Oson", reward:"+1/-0.25" },
  { title:"Attestatsiya", class:"O'qituvchilar", level:"O'rta", reward:"+2/-0.5" },
  { title:"Olimpiada—o'quvchi", class:"7-9", level:"Qiyin", reward:"+3/-1" },
  { title:"Olimpiada—o'qituvchi", class:"All", level:"Qiyin", reward:"+3/-1" },
];

const grid = document.getElementById("testGrid");
grid.innerHTML = tests.map(t=>`
  <div class="card">
    <div class="title">${t.title}</div>
    <div class="meta">${t.class}</div>
    <div class="badges">
      <span class="badge">${t.level}</span>
      <span class="badge">${t.reward}</span>
    </div>
    <div class="row mt">
      <button class="btn primary wide">Batafsil</button>
    </div>
  </div>
`).join("");

/* Dynamic loaders: tests/courses/simulators with filter/search */
const colTests = () => db.collection('tests');
const colCourses = () => db.collection('courses');
const colSims = () => db.collection('simulators');
function $(s, r=document){ return r.querySelector(s); }
function fmtPrice(v){ if(v==null) return ''; try { return new Intl.NumberFormat('uz-UZ').format(v);}catch(e){return String(v)} }
function esc(s){ return (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]); }

const testsGrid = document.getElementById('tests-grid');
const testsType = document.getElementById('tests-type');
const testsTag = document.getElementById('tests-tag');
const testsQ = document.getElementById('tests-q');
const testsCount = document.getElementById('tests-count');

function renderTestCard(doc){
  const d = doc.data();
  const price = d.price;
  const priceHtml = (typeof price==='number')? `<span class="price">UZS ${fmtPrice(price)}</span>`: '';
  return `<div class="card">
    <div class="media"></div>${priceHtml}
    <div class="content">
      <h3 class="title">${esc(d.title||'Test')}</h3>
      <p class="meta">${d.questionsCount||0} ta savol • ${d.durationMin||0} daqiqa • ${(d.type==='oddiy'?'Oddiy':'Onlayn')}</p>
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
        ${d.status? `<span class="badge ${esc(d.status)}">${esc(d.status)}</span>`:''}
        <button class="cta" data-id="${doc.id}" data-col="tests">Boshlash</button>
      </div>
    </div></div>`;
}
function renderCourseCard(doc){
  const d = doc.data();
  const priceHtml = (typeof d.price==='number')? `<span class="price">UZS ${fmtPrice(d.price)}</span>`: '';
  return `<div class="card"><div class="media"></div>${priceHtml}
    <div class="content"><h3 class="title">${esc(d.title||'Kurs')}</h3>
    <p class="meta">${esc(d.description||'')}</p>
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
      ${d.status? `<span class="badge ${esc(d.status)}">${esc(d.status)}</span>`:''}
      <button class="cta" data-id="${doc.id}" data-col="courses">Ko'rish</button>
    </div></div></div>`;
}
function renderSimCard(doc){
  const d = doc.data();
  const priceHtml = (typeof d.price==='number')? `<span class="price">UZS ${fmtPrice(d.price)}</span>`: '';
  return `<div class="card"><div class="media"></div>${priceHtml}
    <div class="content"><h3 class="title">${esc(d.title||'Simulyator')}</h3>
    <p class="meta">${esc(d.description||'')}</p>
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
      ${d.status? `<span class="badge ${esc(d.status)}">${esc(d.status)}</span>`:''}
      <button class="cta" data-id="${doc.id}" data-col="simulators">Ochish</button>
    </div></div></div>`;
}

function matchSearch(doc, q){
  if(!q) return true;
  const s = q.toLowerCase().trim();
  const d = doc.data();
  const hay = `${d.title||''} ${d.description||''} ${(d.tags||[]).join(' ')}`.toLowerCase();
  return hay.includes(s);
}
function matchTag(doc, tag){ if(!tag||tag==='all') return true; const d=doc.data(); return (d.status||'').toLowerCase()===tag.toLowerCase(); }
function matchType(doc, t){ if(!t||t==='all') return true; const d=doc.data(); return (d.type||'online')===t; }
function debounce(fn, wait=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); } }

async function loadTests(){
  if(!testsGrid) return;
  const snap = await colTests().orderBy('title').get().catch(e=>({empty:true, docs:[]}));
  const q = testsQ?.value || ''; const tag = testsTag?.value || 'all'; const t = testsType?.value || 'all';
  const filtered = snap.docs.filter(d=> matchSearch(d,q) && matchTag(d,tag) && matchType(d,t));
  testsCount && (testsCount.textContent = filtered.length);
  testsGrid.innerHTML = filtered.length? filtered.map(renderTestCard).join('') : '<div class="card"><div class="content"><b>Hech narsa topilmadi.</b></div></div>';
}
async function loadCourses(){
  const grid = document.getElementById('courses-grid'); if(!grid) return;
  const snap = await colCourses().orderBy('title').get().catch(e=>({empty:true, docs:[]}));
  grid.innerHTML = snap.empty? '<div class="card"><div class="content"><b>Kurslar yo‘q</b></div></div>' : snap.docs.map(renderCourseCard).join('');
}
async function loadSims(){
  const grid = document.getElementById('sims-grid'); if(!grid) return;
  const snap = await colSims().orderBy('title').get().catch(e=>({empty:true, docs:[]}));
  grid.innerHTML = snap.empty? '<div class="card"><div class="content"><b>Simulyatorlar yo‘q</b></div></div>' : snap.docs.map(renderSimCard).join('');
}

document.getElementById('tests-type')?.addEventListener('change', loadTests);
document.getElementById('tests-tag')?.addEventListener('change', loadTests);
document.getElementById('tests-q')?.addEventListener('input', debounce(loadTests, 250));
document.getElementById('tab-tests')?.addEventListener('click', loadTests);
document.getElementById('tab-courses')?.addEventListener('click', loadCourses);
document.getElementById('tab-sims')?.addEventListener('click', loadSims);

document.addEventListener('DOMContentLoaded', ()=>{ loadCourses(); loadSims(); });

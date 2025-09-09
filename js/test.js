// Runner: load CSV (?run=...), charge from balance (?price=...), MathJax + timer + review
const qs = new URLSearchParams(location.search);
const runPath = qs.get('run');
const price = Number(qs.get('price') || 0);
const titleHint = qs.get('title') || 'Test';

const wrap = document.getElementById('testWrap');
const listWrap = document.getElementById('testsSections');
const filtersBar = document.getElementById('filtersBar');

if (runPath){
  listWrap.classList.add('hidden'); filtersBar.classList.add('hidden'); wrap.classList.remove('hidden'); bootstrap();
}

async function bootstrap(){
  const user = JSON.parse(localStorage.getItem('mc_user')||'{}');
  if (price > 0){
    const ok = confirm(`${titleHint}\nNarx: ${fmt(price)} so'm\nPul yechilsinmi?`);
    if(!ok){ location.href='./tests.html'; return; }
    if ((user.balance||0) < price){ alert('Balans yetarli emas.'); location.href='./tests.html'; return; }
    user.balance = (user.balance||0) - price; localStorage.setItem('mc_user', JSON.stringify(user));
    try{ window.__syncHeader && window.__syncHeader(); }catch(_){}
  }
  const text = await fetchCSV(runPath);
  if(!text){ wrap.innerHTML = `<div class="sub">Test CSV topilmadi: ${runPath}</div>`; return; }
  const {meta, questions} = parseTestCSV(text);
  renderTest(meta, questions);
}

function renderTest(meta, qs){
  let idx = 0; const answers = new Array(qs.length).fill(null);
  const startTs = Date.now(); const totalMs = (meta.timeSec || 600) * 1000; const title = meta.title || titleHint;

  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 style="margin:.3rem 0">${escapeMath(title)}</h2>
      <div class="pill" id="timerPill">⏳ ${fmtDur(totalMs)}</div>
    </div>
    <div class="progress" style="margin:8px 0 12px"><i id="progBar" style="width:0%"></i></div>
    <div id="qArea"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn ghost" id="prevBtn">⟵ Oldingi</button>
      <button class="btn primary" id="nextBtn">Keyingi ⟶</button>
      <button class="btn" id="finishBtn">Yakunlash</button>
    </div>`;

  const qArea = document.getElementById('qArea');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const finishBtn = document.getElementById('finishBtn');
  const timerPill = document.getElementById('timerPill');
  const progBar = document.getElementById('progBar');

  const go = (i)=>{
    idx = Math.min(Math.max(i,0), qs.length-1);
    const q = qs[idx]; progBar.style.width = (((idx)/qs.length)*100).toFixed(1)+'%';
    qArea.innerHTML = renderQuestion(q, idx, answers[idx]);
    try{ MathJax.typesetPromise && MathJax.typesetPromise(); }catch(e){}
    qArea.querySelectorAll('input[name="ans"]').forEach(r=> r.addEventListener('change', ()=>{ answers[idx] = r.value; }));
    prevBtn.disabled = (idx===0); nextBtn.disabled = (idx===qs.length-1);
  };
  prevBtn.onclick = ()=> go(idx-1); nextBtn.onclick = ()=> go(idx+1); finishBtn.onclick = ()=> submit(); go(0);

  const t = setInterval(()=>{
    const left = (startTs + totalMs) - Date.now();
    timerPill.textContent = '⏳ ' + fmtDur(left);
    if(left<=0){ clearInterval(t); submit(true); }
  },1000);

  function submit(auto=false){
    let score = 0, max = 0, correct=0;
    qs.forEach((q,i)=>{ const pts = Number(q.points||1)||1; max += pts; if((answers[i]||'').toUpperCase() === (q.correct||'').toUpperCase()){ score += pts; correct++; } });
    const percent = max ? Math.round((score/max)*100) : 0; progBar.style.width = '100%';
    wrap.innerHTML = `
      <h2 style="margin:.3rem 0">${escapeMath(title)} — Yakunlandi</h2>
      <div class="pill">Natija: ${score} / ${max} (${percent}%) — to'g'ri: ${correct}/${qs.length}</div>
      <div style="margin:10px 0 6px" class="sub">Belgilangani: ${answers.map(x=>x?x:'-').join(', ')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <a class="btn" href="./tests.html">Barcha testlar</a>
        <button class="btn ghost" id="reviewBtn">Tahlilni ko‘rish</button>
      </div>
      <div id="review" class="hidden"></div>`;
    document.getElementById('reviewBtn').onclick = ()=>{
      const r = document.getElementById('review'); r.classList.toggle('hidden');
      if(!r.dataset.filled){ r.innerHTML = qs.map((q,i)=>reviewBlock(q, i, answers[i])).join(''); r.dataset.filled = '1'; try{ MathJax.typesetPromise && MathJax.typesetPromise(); }catch(e){} }
    };
  }
}

function renderQuestion(q, idx, sel){
  const opts = ['A','B','C','D'].map(k=>{
    const val = q[k] ?? ''; if(!val) return '';
    const id = `q${idx}_${k}`; const checked = (sel===k) ? 'checked' : '';
    return `<label class="opt"><input type="radio" name="ans" value="${k}" id="${id}" ${checked}/> <div class="q-opt"><span class="kbd">${k}</span> <span class="q-text">${escapeMath(val)}</span></div></label>`;
  }).join('');
  const img = q.img ? `<img class="q-img" src="${q.img}" alt="savol rasmi">` : '';
  return `<div class="sub">Savol ${idx+1}</div><div class="q-text">${escapeMath(q.q || '')}</div>${img}<div>${opts}</div>`;
}

function reviewBlock(q, idx, given){
  const ok = (given||'').toUpperCase() === (q.correct||'').toUpperCase(); const badge = ok ? '✅' : '❌';
  return `<div style="margin:10px 0;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px">
      <div class="sub">Savol ${idx+1} · To‘g‘ri: ${q.correct||'-'} ${badge}</div>
      <div class="q-text" style="margin-top:6px">${escapeMath(q.q||'')}</div>
      ${q.img ? `<img class="q-img" src="${q.img}" alt="savol rasmi">` : ''}
      <div style="margin-top:6px">${['A','B','C','D'].map(k => q[k]?`<div class="sub"><b>${k})</b> ${escapeMath(q[k])}</div>`:'').join('')}</div>
    </div>`;
}

/* CSV + utils */
async function fetchCSV(p){ try{ const r=await fetch(p,{cache:'no-cache'}); if(r.ok) return await r.text(); }catch{} return null; }
function parseTestCSV(text){
  const lines = text.replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n').split('\\n'); const meta = {}; const rows=[];
  let headerParsed=false, headers=[];
  for(const ln of lines){
    const t = ln.trim(); if(!t) continue;
    if(t.startsWith('#')){ const m=t.slice(1).split('='); if(m.length>=2){ meta[m[0].trim().toLowerCase()] = m.slice(1).join('=').trim(); } continue; }
    if(!headerParsed){ headers = splitSmart(t); headerParsed=true; continue; }
    const vals = splitSmart(ln); const obj={}; headers.forEach((h,i)=> obj[h.trim().toLowerCase()] = (vals[i]||'').trim());
    rows.push({ q: obj.q || obj['savol'] || '', A: obj.a||'', B: obj.b||'', C: obj.c||'', D: obj.d||'',
      correct: (obj.correct||obj["to'g'ri"]||obj.togri||'').toUpperCase(), img: obj.img || obj.image || obj['img url'] || '', points: Number(obj.points||obj.ball||1)||1 });
  }
  meta.timeSec = Number(meta['time']||meta['vaqt']||meta['time_sec']||900)||900; meta.title = meta['title'] || meta['sarlavha'] || '';
  return {meta, questions: rows};
}
function splitSmart(line){ const cand=[',','|',';','\\t']; let d=',',best=0; for(const c of cand){ const n=line.split(c).length; if(n>best){best=n; d=c;} }
  const out=[]; let f='',q=false; for(let i=0;i<line.length;i++){ const ch=line[i], nx=line[i+1];
    if(ch=='\"'){ if(q&&nx=='\"'){f+='\"'; i++;} else { q=!q; } continue; } if(ch==d && !q){ out.push(f); f=''; continue; } f+=ch; } out.push(f); return out; }
function escapeMath(s){ return String(s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
const fmt = n => new Intl.NumberFormat('uz-UZ').format(n||0);
function fmtDur(ms){ if(ms<0) ms=0; let s=Math.floor(ms/1000); const h=Math.floor(s/3600); s%=3600; const m=Math.floor(s/60); s%=60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

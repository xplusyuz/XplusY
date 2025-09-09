
// === csv-utils ===
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

function parseCSV(text){
  // RFC4180-ish parser supporting quotes and commas
  const rows = [];
  let i = 0, cur = [], field = '', inQuotes = false;
  function pushField(){ cur.push(field); field=''; }
  function pushRow(){ rows.push(cur); cur = []; }
  while(i < text.length){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i+=2; continue; }
        inQuotes = false; i++; continue;
      }else{ field += c; i++; continue; }
    }else{
      if(c === '"'){ inQuotes = true; i++; continue; }
      if(c === ','){ pushField(); i++; continue; }
      if(c === '\r'){ i++; continue; }
      if(c === '\n'){ pushField(); pushRow(); i++; continue; }
      field += c; i++; continue;
    }
  }
  // last field/row
  pushField(); if(cur.length>1 || (cur.length===1 && cur[0]!=='')) pushRow();
  // map to objects
  if(rows.length === 0) return [];
  const headers = rows[0].map(h=>h.trim());
  return rows.slice(1).filter(r=>r.some(v=>String(v).trim()!=='')).map(r => {
    const obj = {}; headers.forEach((h,idx)=> obj[h] = (r[idx]??'').trim()); return obj;
  });
}

async function fetchCSV(url){
  const res = await fetch(url, {cache: "no-store"});
  if(!res.ok) throw new Error(`CSV yuklanmadi: ${url}`);
  const txt = await res.text();
  return parseCSV(txt);
}
function uniqueValues(rows, key){
  const set = new Set(rows.map(r=>r[key]).filter(Boolean)); return Array.from(set).sort();
}

// === manifest -> cards ===
const grid = document.getElementById("testsSections");
const testWrap = document.getElementById("testWrap");
let MANIFEST = [];
let MANIFEST_BY_ID = {};

if(grid){
  (async()=>{
    try{
      MANIFEST = await fetchCSV(grid.dataset.csv || "./csv/tests.csv");
      MANIFEST.forEach(r=>{ MANIFEST_BY_ID[r.id] = r; });
      // fill filters
      const planSel = document.getElementById("fPlan");
      const secSel  = document.getElementById("fSec");
      const f1Sel   = document.getElementById("f1");
      const f2Sel   = document.getElementById("f2");
      fillSelect(planSel, uniqueValues(MANIFEST,'plan'));
      fillSelect(secSel,  uniqueValues(MANIFEST,'section'));
      fillSelect(f1Sel,   uniqueValues(MANIFEST,'f1'));
      fillSelect(f2Sel,   uniqueValues(MANIFEST,'f2'));
      [planSel,secSel,f1Sel,f2Sel].forEach(sel => {
        if(!sel) return; const opt = document.createElement('option');
        opt.value = ""; opt.textContent = "Hammasi"; sel.insertBefore(opt, sel.firstChild); sel.value = "";
      });
      [planSel,secSel,f1Sel,f2Sel].forEach(sel=> sel?.addEventListener('change', ()=>render()));
      render();
      grid.addEventListener('click', onGridClick);
    }catch(e){
      grid.innerHTML = `<div class="card"><b>Test CSV xatosi:</b> ${esc(e.message)}</div>`;
    }
  })();
}

function fillSelect(sel, values){
  if(!sel) return;
  sel.innerHTML = values.map(v=> `<option value="${esc(v)}">${esc(v)}</option>`).join("");
}

function currentFilters(){
  const f = {
    plan: document.getElementById("fPlan")?.value||"",
    section: document.getElementById("fSec")?.value||"",
    f1: document.getElementById("f1")?.value||"",
    f2: document.getElementById("f2")?.value||""
  };
  return f;
}
function applyFilters(rows, f){
  return rows.filter(r =>
    (!f.plan || r.plan===f.plan) && (!f.section || r.section===f.section) &&
    (!f.f1 || r.f1===f.f1) && (!f.f2 || r.f2===f.f2)
  );
}

function render(){
  const list = applyFilters(MANIFEST, currentFilters());
  if(list.length===0){ grid.innerHTML = `<div class="card"><b>Hech narsa topilmadi.</b></div>`; return; }
  grid.classList.add("grid","cards");
  grid.innerHTML = list.map(item => cardHTML(item)).join("");
  testWrap.classList.add("hidden");
}

function cardHTML(r){
  return `<article class="card">
    ${r.image ? `<img src="${esc(r.image)}" alt="${esc(r.title||'')}" style="width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.08);aspect-ratio:16/9;object-fit:cover;margin-bottom:8px">` : ''}
    <h3 style="margin:6px 0 4px">${esc(r.title||'')}</h3>
    <p class="sub">${esc(r.desc||'')}</p>
    <div class="toolbar">
      <button class="btn primary" data-cmd="start" data-test-id="${esc(r.id||'')}">Boshlash</button>
      ${r.price && r.price!=='0' ? `<span class="pill">💵 ${esc(r.price)} so‘m</span>` : `<span class="pill">🆓 Bepul</span>`}
      ${r.duration_min ? `<span class="pill">⏱ ${esc(r.duration_min)} daqiqa</span>` : ''}
      ${r.plan ? `<span class="pill">${esc(r.plan)}</span>` : ''}
      ${r.section ? `<span class="pill">${esc(r.section)}</span>` : ''}
    </div>
  </article>`;
}
function onGridClick(e){
  const btn = e.target.closest('[data-cmd="start"]');
  if(!btn) return;
  const id = btn.dataset.testId;
  startTestFlow(id);
}

// === test flow ===
async function startTestFlow(id){
  const pack = MANIFEST_BY_ID[id];
  if(!pack){ alert("Test topilmadi"); return; }
  // Purchase guard (simple local ticket)
  const price = Number(pack.price||0);
  const ticketKey = `ticket_${id}`;
  if(price>0 && !localStorage.getItem(ticketKey)){
    if(!confirm(`Bu test pullik: ${price} so‘m. Tasdiqlaysizmi? (Demo rejim: faqat belgilash)`)) return;
    localStorage.setItem(ticketKey, JSON.stringify({purchasedAt: Date.now()}));
  }
  // Load pack CSV
  const rows = await fetchCSV(pack.file);
  const meta = rows.find(r=> (r.type||'').toLowerCase()==='meta') || {};
  const neg = {
    easy: Number(meta.neg_easy||'0.25'),
    medium: Number(meta.neg_med||'0.5'),
    hard: Number(meta.neg_hard||'1')
  };
  const marks = {
    easy: Number(meta.m_easy||'1'),
    medium: Number(meta.m_med||'2'),
    hard: Number(meta.m_hard||'3')
  };
  let duration = Number(meta.duration_min || pack.duration_min || 10);

  // build questions
  let qs = rows.filter(r => (r.type||'').toLowerCase()==='q').map((r,idx)=> ({
    id: r.qid || String(idx+1),
    text: r.text,
    A: r.A, B: r.B, C: r.C, D: r.D,
    correct: (r.correct||'').split('|').map(s=>s.trim()).filter(Boolean),
    multi: (r.correct||'').includes('|'),
    difficulty: (r.difficulty||'easy').toLowerCase(),
    topic: r.topic||'',
    explain: r.explain||''
  }));
  if((meta.shuffle||'yes').toLowerCase()!=='no'){
    qs = qs.map(q => ({...q, _r: Math.random()})).sort((a,b)=>a._r-b._r).map(({_r,...q})=>q);
  }

  runTest({ id, title: pack.title, duration, neg, marks, qs });
}

// === runner ===
function runTest(cfg){
  const {id, title, duration, neg, marks, qs} = cfg;
  const state = {
    i: 0,
    answers: {}, // qid -> array of letters
    marked: new Set(),
    startedAt: Date.now(),
    leftSec: duration * 60
  };
  // timer
  if(state._timer) clearInterval(state._timer);
  state._timer = setInterval(()=>{
    state.leftSec--;
    if(state.leftSec<=0){ clearInterval(state._timer); submit(); }
    updateTopbar();
  }, 1000);

  // render skeleton
  testWrap.classList.remove("hidden");
  testWrap.innerHTML = `
    <div class="test-topbar">
      <div>
        <b>${esc(title)}</b>
        <span class="badge">Savollar: ${qs.length}</span>
        <span class="badge">Neg: O:${neg.easy} / O‘:${neg.medium} / Q:${neg.hard}</span>
      </div>
      <div>
        <span class="badge" id="timer">00:00</span>
        <button class="btn ghost" id="btnMark">⭐ Belgilash</button>
        <button class="btn" id="btnPrev">← Oldingi</button>
        <button class="btn" id="btnNext">Keyingi →</button>
        <button class="btn primary" id="btnSubmit">Yakunlash</button>
        <button class="btn ghost" id="btnBack">← Ro‘yxat</button>
      </div>
    </div>
    <div class="qwrap" id="qwrap"></div>
    <div class="progress" id="progress"></div>
  `;
  testWrap.querySelector("#btnPrev").onclick = ()=>{ if(state.i>0){ state.i--; renderQ(); } };
  testWrap.querySelector("#btnNext").onclick = ()=>{ if(state.i<qs.length-1){ state.i++; renderQ(); } };
  testWrap.querySelector("#btnBack").onclick = ()=>{ clearInterval(state._timer); render(); window.scrollTo(0,0); };
  testWrap.querySelector("#btnSubmit").onclick = ()=>{ if(confirm("Testni yakunlaysizmi?")){ clearInterval(state._timer); submit(); } };
  testWrap.querySelector("#btnMark").onclick = ()=>{
    const q = qs[state.i];
    if(state.marked.has(q.id)) state.marked.delete(q.id); else state.marked.add(q.id);
    renderProgress(); updateTopbar();
  };

  function updateTopbar(){
    const t = testWrap.querySelector("#timer");
    const m = Math.floor(state.leftSec/60), s = state.leftSec%60;
    t.textContent = `⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function renderQ(){
    const q = qs[state.i];
    const wrap = testWrap.querySelector("#qwrap");
    const selected = state.answers[q.id] || [];
    let opts = ['A','B','C','D'].filter(k => q[k]!=null && q[k]!=='');
    wrap.innerHTML = `
      <div class="qitem">
        <div class="qtitle">${state.i+1}. ${esc(q.text)}</div>
        <div>${q.topic? `<span class="pill">#${esc(q.topic)}</span>`:''} <span class="pill">${q.difficulty}</span> ${q.multi?'<span class="pill">⬜ Multiple</span>':''}</div>
      </div>
      ${opts.map(letter => `
        <label class="opt">
          <input type="${q.multi?'checkbox':'radio'}" name="q${esc(q.id)}" value="${letter}" ${selected.includes(letter)?'checked':''}>
          <div><b>${letter})</b> ${esc(q[letter])}</div>
        </label>
      `).join('')}
    `;
    // attach
    wrap.querySelectorAll('input').forEach(inp => {
      inp.onchange = ()=>{
        if(q.multi){
          const arr = new Set(state.answers[q.id]||[]);
          if(inp.checked) arr.add(inp.value); else arr.delete(inp.value);
          state.answers[q.id] = Array.from(arr);
        }else{
          state.answers[q.id] = [inp.value];
        }
        renderProgress();
      };
    });
    renderProgress();
  }

  function renderProgress(){
    const prog = testWrap.querySelector("#progress");
    prog.innerHTML = qs.map((q,idx)=>{
      const ans = state.answers[q.id];
      const answered = Array.isArray(ans) && ans.length>0;
      const cls = [
        'dot',
        idx===state.i?'sel':'',
        answered?'answered':'',
        state.marked.has(q.id)?'marked':''
      ].filter(Boolean).join(' ');
      return `<div class="${cls}" data-jump="${idx}">${idx+1}</div>`;
    }).join('');
    prog.querySelectorAll('[data-jump]').forEach(d => d.onclick = ()=>{ state.i = Number(d.dataset.jump); renderQ(); });
  }

  function computeScore(){
    let total=0, max=0, right=0, wrong=0, blank=0;
    const byTopic = {}, byDiff = {easy:{r:0,w:0,b:0}, medium:{r:0,w:0,b:0}, hard:{r:0,w:0,b:0}};

    const rows = qs.map(q => {
      const pick = (state.answers[q.id]||[]).slice().sort().join('|') || '';
      const correct = q.correct.slice().sort().join('|');
      const isBlank = pick === '';
      const isRight = !isBlank && pick === correct;
      const diff = q.difficulty in marks ? q.difficulty : 'easy';
      const mark = marks[diff];
      const negv = neg[diff];
      max += mark;
      let delta = 0;
      if(isRight){ right++; delta = mark; byDiff[diff].r++; }
      else if(isBlank){ blank++; byDiff[diff].b++; }
      else { wrong++; delta = -negv; byDiff[diff].w++; }
      total += delta;
      if(q.topic){
        byTopic[q.topic] = byTopic[q.topic] || {r:0,w:0,b:0};
        if(isRight) byTopic[q.topic].r++; else if(isBlank) byTopic[q.topic].b++; else byTopic[q.topic].w++;
      }
      return { q, pick, correct, isRight, isBlank, delta, mark, diff };
    });
    return { total, max, right, wrong, blank, rows, byTopic, byDiff };
  }

  function submit(){
    const res = computeScore();
    // store history
    const key = `result_${id}`;
    const history = JSON.parse(localStorage.getItem(key)||'[]');
    history.unshift({when:Date.now(), total:res.total, max:res.max, right:res.right, wrong:res.wrong, blank:res.blank});
    localStorage.setItem(key, JSON.stringify(history.slice(0,20)));

    // render result
    testWrap.innerHTML = `
      <div class="test-topbar">
        <div><b>${esc(title)}</b> <span class="badge">Natija</span></div>
        <div>
          <button class="btn" id="btnAgain">Qayta yechish</button>
          <button class="btn ghost" id="btnBack2">← Ro‘yxat</button>
        </div>
      </div>
      <div class="result-grid">
        <div class="stat">
          <h4>Umumiy</h4>
          <div>Ball: <b>${res.total.toFixed(2)}</b> / ${res.max}</div>
          <div>To‘g‘ri: <b>${res.right}</b>, Noto‘g‘ri: <b>${res.wrong}</b>, Bo‘sh: <b>${res.blank}</b></div>
        </div>
        <div class="stat">
          <h4>Qiyinlik bo‘yicha</h4>
          <table><tbody>
            ${Object.entries(res.byDiff).map(([k,v])=>`<tr><td>${k}</td><td>✔️ ${v.r}</td><td>❌ ${v.w}</td><td>⏳ ${v.b}</td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="stat">
          <h4>Bo‘limlar</h4>
          <table><tbody>
            ${Object.entries(res.byTopic).map(([k,v])=>`<tr><td>${esc(k)}</td><td>✔️ ${v.r}</td><td>❌ ${v.w}</td><td>⏳ ${v.b}</td></tr>`).join('') || '<tr><td>—</td></tr>'}
          </tbody></table>
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Analiz (savol-ma\'savol)</h3>
        ${res.rows.map((r,idx)=>`
          <div class="qitem">
            <div class="qtitle">${idx+1}. ${esc(r.q.text)} ${r.isRight? '✅':'❌'}</div>
            <div>Tanlov: <span class="kbd">${r.pick || '—'}</span> • To‘g‘ri: <span class="kbd">${r.correct}</span> • Ball: ${r.delta>=0?'+':''}${r.delta.toFixed(2)}</div>
            ${r.q.explain? `<div class="sub" style="margin-top:6px">${esc(r.q.explain)}</div>`:''}
          </div>
        `).join('')}
      </div>
    `;
    testWrap.querySelector("#btnBack2").onclick = ()=>{ render(); window.scrollTo(0,0); };
    testWrap.querySelector("#btnAgain").onclick = ()=>{ runTest(cfg); window.scrollTo(0,0); };
  }

  renderQ(); updateTopbar();
}

// === end ===

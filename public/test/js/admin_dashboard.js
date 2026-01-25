/* ===========================
   SUPER ADMIN DASHBOARD
   Analytics + charts
   Works with Firestore + Google Auth
   =========================== */

const ADMIN_EMAILS = [
  'sohibjonmath@gmail.com'
];

const state = {
  user: null,
  isAdmin: false,
  db: null,
  selectedTest: '',
  tests: [],
  // datasets
  users: [],
  locks: [],
  results: [],
  // global (for top tests)
  locks30: [],
  results30: [],
  // charts
  chartTrend: null,
};

const $ = (sel) => document.querySelector(sel);

function setNotice(msg){
  const el = $('#notice');
  if (el) el.textContent = msg;
}

function num(n){
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtTime(iso){
  if (!iso) return '';
  try{
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('uz-UZ');
  }catch{ return String(iso); }
}

function requireAdmin(){
  if (!state.user) throw new Error('LOGIN_REQUIRED');
  if (!state.isAdmin) throw new Error('NOT_ADMIN');
}

function dayKey(d){
  // local day key: YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseAnyDate(v){
  // accepts ISO, Firestore Timestamp, millis, Date
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number'){
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string'){
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp (compat): has toDate()
  if (typeof v === 'object' && typeof v.toDate === 'function'){
    const d = v.toDate();
    return (d instanceof Date && !Number.isNaN(d.getTime())) ? d : null;
  }
  // Timestamp-like: seconds / nanoseconds
  if (typeof v === 'object' && (typeof v.seconds === 'number')){
    const d = new Date(v.seconds*1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function deriveTestCode(d){
  return d?.testCode || d?.testId || d?.test || d?.code || '';
}

function deriveScore(d){
  if (d && (typeof d.score === 'number' || typeof d.score === 'string')){
    const s = Number(d.score);
    if (Number.isFinite(s)) return s;
  }
  if (Array.isArray(d?.detailedResults)){
    const sum = d.detailedResults.reduce((acc,x)=> acc + num(x?.pointsEarned ?? x?.earned ?? 0), 0);
    if (sum) return sum;
  }
  if (d && (typeof d.correctAnswers === 'number' || typeof d.correctAnswers === 'string')){
    const c = Number(d.correctAnswers);
    if (Number.isFinite(c)) return c;
  }
  if (d && (typeof d.totalPoints === 'number' || typeof d.totalPoints === 'string')){
    const t = Number(d.totalPoints);
    if (Number.isFinite(t)) return t;
  }
  if (d && (typeof d.totalPointsEarned === 'number' || typeof d.totalPointsEarned === 'string')){
    const t = Number(d.totalPointsEarned);
    if (Number.isFinite(t)) return t;
  }
  if (d && (typeof d.points === 'number' || typeof d.points === 'string')){
    const p = Number(d.points);
    if (Number.isFinite(p)) return p;
  }
  return 0;
}

function deriveViolations(d){
  return num(d?.violations ?? d?.violationCount ?? d?.antiCheat?.violations ?? 0);
}

function deriveCompletedAt(d){
  return d?.completedAt || d?.finishedAt || d?.doneAt || d?.endedAt || d?.endAt || d?.updatedAt || null;
}

function deriveStartedAt(d){
  return d?.startedAt || d?.startAt || d?.createdAt || null;
}

async function initFirebase(){
  if (!CONFIG.useFirebase) throw new Error('FIREBASE_DISABLED');
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);

  state.db = firebase.firestore();

  // OPTIONAL: keep admin dashboards fresh (disable offline cache by default)
  try{
    if (CONFIG.enableFirestorePersistence){
      await state.db.enablePersistence({ synchronizeTabs: true });
    }
  }catch{
    // ignore (multiple tabs / unsupported)
  }

  firebase.auth().onAuthStateChanged((u)=>{
    state.user = u || null;
    state.isAdmin = !!u && ADMIN_EMAILS.includes(String(u.email||'').toLowerCase());
    renderAuth();
    if (state.isAdmin && state.selectedTest) refreshAll().catch(()=>{});
  });
}

function renderAuth(){
  const u = state.user;
  $('#loginBtn').style.display = u ? 'none' : '';
  $('#logoutBtn').style.display = u ? '' : 'none';

  const el = $('#authState');
  if (!u){
    el.textContent = 'Kirmagansiz';
    setNotice('Google bilan kiring (admin email bilan).');
    return;
  }
  const badge = state.isAdmin ? '✅ admin' : '⛔ admin emas';
  el.textContent = `${u.email || u.displayName || 'User'} — ${badge}`;
  if (!state.isAdmin) setNotice('Bu sahifa faqat ADMIN uchun. Admin email bilan kiring.');
}

async function login(){
  const provider = new firebase.auth.GoogleAuthProvider();
  await firebase.auth().signInWithPopup(provider);
}

async function logout(){
  await firebase.auth().signOut();
}

async function loadTestsList(){
  const db = state.db;
  const sel = $('#testSelect');
  sel.innerHTML = '<option value="">— test tanlang —</option>';

  let arr = [];
  // 1) testlar
  try{
    const snap = await db.collection('testlar').limit(300).get();
    snap.forEach(doc=>{
      const d = doc.data()||{};
      arr.push({ code: doc.id, title: d.title || d.name || doc.id });
    });
  }catch{}

  // 2) fallback from results / locks
  if (!arr.length){
    const codes = new Map();
    try{
      const rs = await db.collection('test_results').limit(600).get();
      rs.forEach(doc=>{
        const d = doc.data()||{};
        const c = deriveTestCode(d);
        if (c) codes.set(String(c), true);
      });
    }catch{}
    try{
      const ls = await db.collection('test_attempt_locks').limit(600).get();
      ls.forEach(doc=>{
        const d = doc.data()||{};
        const c = deriveTestCode(d);
        if (c) codes.set(String(c), true);
      });
    }catch{}
    const list = [...codes.keys()].sort((a,b)=>a.localeCompare(b));
    arr = list.map(c=>({code:c,title:c}));
  }

  if (!arr.length) arr = [{code:'ALL', title:'Barcha'}];

  state.tests = arr;

  // add ALL at top if not exists
  if (!arr.some(x=>x.code==='ALL')){
    arr.unshift({code:'ALL', title:'Barcha'});
  }

  sel.innerHTML = '';
  for (const t of arr){
    const opt = document.createElement('option');
    opt.value = t.code;
    opt.textContent = `${t.code} — ${t.title}`;
    sel.appendChild(opt);
  }

  const last = localStorage.getItem('super_admin_selected_test') || '';
  if (last && arr.some(x=>x.code===last)){
    sel.value = last;
    state.selectedTest = last;
  }else{
    sel.value = 'ALL';
    state.selectedTest = 'ALL';
  }
}

async function fetchUsers(){
  const snap = await state.db.collection('users').limit(2000).get();
  const rows = [];
  snap.forEach(doc=>{
    const d = doc.data()||{};
    // try to detect activity fields
    const last = d.lastActiveAt || d.lastSeenAt || d.updatedAt || d.lastLoginAt || null;
    rows.push({
      id: doc.id,
      name: d.name || d.fullName || d.displayName || d.loginId || doc.id,
      points: num(d.points),
      lastActive: parseAnyDate(last),
      createdAt: parseAnyDate(d.createdAt || d.created || null),
    });
  });
  state.users = rows;
}

async function fetchLocks(testCode){
  let rows = [];
  const db = state.db;
  try{
    if (testCode && testCode !== 'ALL'){
      const snap = await db.collection('test_attempt_locks').where('testCode','==',testCode).limit(1200).get();
      snap.forEach(doc=> rows.push({id:doc.id, ...doc.data()}));
    }
  }catch{}
  if (!rows.length){
    const snap = await db.collection('test_attempt_locks').limit(1200).get();
    snap.forEach(doc=> rows.push({id:doc.id, ...doc.data()}));
    if (testCode && testCode !== 'ALL'){
      rows = rows.filter(r => String(deriveTestCode(r)) === String(testCode));
    }
  }
  state.locks = rows;
}

async function fetchResults(testCode){
  let rows = [];
  const db = state.db;
  try{
    if (testCode && testCode !== 'ALL'){
      const snap = await db.collection('test_results').where('testCode','==',testCode).limit(1200).get();
      snap.forEach(doc=> rows.push({id:doc.id, ...doc.data()}));
    }
  }catch{}
  if (!rows.length){
    const snap = await db.collection('test_results').limit(1200).get();
    snap.forEach(doc=> rows.push({id:doc.id, ...doc.data()}));
    if (testCode && testCode !== 'ALL'){
      rows = rows.filter(r => String(deriveTestCode(r)) === String(testCode));
    }
  }
  // normalize score for sorting / aggregation
  rows.forEach(r=>{
    if (r.score === undefined || r.score === null) r.score = deriveScore(r);
  });
  state.results = rows;
}

async function fetchGlobal30d(){
  // We do best-effort: fetch latest N and filter by date client-side.
  const db = state.db;
  const now = new Date();
  const since = new Date(now.getTime() - 30*24*3600*1000);

  const locks = [];
  const results = [];

  try{
    const snapL = await db.collection('test_attempt_locks').limit(2000).get();
    snapL.forEach(doc=>{
      const d = doc.data()||{};
      const dt = parseAnyDate(deriveStartedAt(d)) || parseAnyDate(d.updatedAt) || null;
      if (!dt || dt >= since) locks.push({id:doc.id, ...d, __dt: dt});
    });
  }catch{}

  try{
    const snapR = await db.collection('test_results').limit(2000).get();
    snapR.forEach(doc=>{
      const d = doc.data()||{};
      const dt = parseAnyDate(deriveCompletedAt(d)) || null;
      if (!dt || dt >= since) results.push({id:doc.id, ...d, __dt: dt});
    });
  }catch{}

  state.locks30 = locks;
  state.results30 = results;
}

function setTag(id, text, cls){
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('ok','warn','bad');
  if (cls) el.classList.add(cls);
}

function renderKpis(){
  const users = state.users.length;
  const locks = state.locks.length;
  const results = state.results.length;

  $('#kpiUsers').textContent = users.toLocaleString('uz-UZ');
  $('#kpiAttempts').textContent = locks.toLocaleString('uz-UZ');
  $('#kpiResults').textContent = results.toLocaleString('uz-UZ');

  setTag('#tagUsers', users ? 'LIVE' : '—', users ? 'ok' : '');
  setTag('#tagAttempts', state.selectedTest || '—', state.selectedTest ? '' : '');
  setTag('#tagResults', state.selectedTest || '—', state.selectedTest ? '' : '');

  // activity
  const now = new Date();
  const d1 = new Date(now.getTime() - 24*3600*1000);
  const d7 = new Date(now.getTime() - 7*24*3600*1000);

  const active1 = state.users.filter(u => u.lastActive && u.lastActive >= d1).length;
  const active7 = state.users.filter(u => u.lastActive && u.lastActive >= d7).length;

  $('#kpiUsersMeta').textContent = `Jami · 24h active: ${active1} · 7d active: ${active7}`;
}

function buildTrendData(){
  const now = new Date();
  const days = [];
  for (let i=29; i>=0; i--){
    const d = new Date(now.getTime() - i*24*3600*1000);
    days.push(dayKey(d));
  }
  const bucket = new Map();
  days.forEach(k => bucket.set(k, {count:0, scoreSum:0, viol:0}));

  const source = state.results.filter(r => {
    const dt = parseAnyDate(deriveCompletedAt(r));
    return dt && dt >= new Date(now.getTime()-30*24*3600*1000);
  });

  source.forEach(r=>{
    const dt = parseAnyDate(deriveCompletedAt(r));
    if (!dt) return;
    const k = dayKey(dt);
    const b = bucket.get(k);
    if (!b) return;
    b.count += 1;
    b.scoreSum += num(r.score ?? deriveScore(r));
    b.viol += deriveViolations(r);
  });

  const labels = days;
  const counts = labels.map(k => bucket.get(k).count);
  const avgScore = labels.map(k => {
    const b = bucket.get(k);
    return b.count ? (b.scoreSum / b.count) : 0;
  });
  const viol = labels.map(k => bucket.get(k).viol);

  return { labels, counts, avgScore, viol, total: source.length };
}

function renderTrendChart(){
  const { labels, counts, avgScore, viol, total } = buildTrendData();

  const el = $('#chartTrend');
  if (!el) return;

  if (state.chartTrend){
    state.chartTrend.destroy();
    state.chartTrend = null;
  }

  const ctx = el.getContext('2d');
  state.chartTrend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Attempts (results)', data: counts, yAxisID: 'y' },
        { label: 'Avg score', data: avgScore, type:'line', yAxisID: 'y1', tension: .25, pointRadius: 0 },
        { label: 'Violations', data: viol, type:'line', yAxisID: 'y2', tension: .25, pointRadius: 0 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: 'rgba(255,255,255,.85)' } },
        tooltip: { enabled: true }
      },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,.65)', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,.06)' } },
        y: { position: 'left', ticks: { color: 'rgba(255,255,255,.65)' }, grid: { color: 'rgba(255,255,255,.06)' }, title:{ display:true, text:'Count', color:'rgba(255,255,255,.65)'} },
        y1:{ position: 'right', ticks: { color: 'rgba(255,255,255,.65)' }, grid: { drawOnChartArea: false }, title:{ display:true, text:'Avg score', color:'rgba(255,255,255,.65)'} },
        y2:{ position: 'right', ticks: { color: 'rgba(255,255,255,.65)' }, grid: { drawOnChartArea: false }, display: false }
      }
    }
  });

  $('#trendNote').textContent = `Oxirgi 30 kunda: ${total} ta natija (selected test: ${state.selectedTest}).`;
}

function renderTopResults(){
  const tb = $('#topResultsTbody');
  tb.innerHTML = '';

  const rows = [...state.results]
    .map(r => ({...r, score: num(r.score ?? deriveScore(r)), viol: deriveViolations(r), completedAt: deriveCompletedAt(r)}))
    .sort((a,b)=> num(b.score)-num(a.score))
    .slice(0,20);

  setTag('#tagTop', `Top ${rows.length}`, rows.length ? 'ok' : '');

  if (!rows.length){
    tb.innerHTML = `<tr><td colspan="6" class="small">Natija yo‘q.</td></tr>`;
    return;
  }

  rows.forEach((r,i)=>{
    const tr = document.createElement('tr');
    const who = escapeHtml(r.studentName || r.name || '—');
    tr.innerHTML = `
      <td class="mono">${i+1}</td>
      <td>${who}</td>
      <td class="mono"><strong>${escapeHtml(r.score)}</strong></td>
      <td class="mono">${escapeHtml(r.viol)}</td>
      <td class="small">${escapeHtml(fmtTime(r.completedAt))}</td>
      <td class="mono small">${escapeHtml(r.id)}</td>
    `;
    tb.appendChild(tr);
  });
}

function renderIntegrity(){
  const tb = $('#integrityTbody');
  tb.innerHTML = '';

  // Basic signals:
  // 1) violations total and rate
  const total = state.results.length;
  const violSum = state.results.reduce((s,r)=> s + deriveViolations(r), 0);
  const violAny = state.results.filter(r => deriveViolations(r) > 0).length;

  // 2) suspiciously fast completions (if timeSpent exists)
  const timeSpentVals = state.results.map(r => num(r.timeSpent ?? r.durationSec ?? r.seconds ?? 0)).filter(x => x>0);
  timeSpentVals.sort((a,b)=>a-b);
  const p10 = timeSpentVals.length ? timeSpentVals[Math.floor(timeSpentVals.length*0.10)] : 0;
  const fast = timeSpentVals.length ? state.results.filter(r => {
    const t = num(r.timeSpent ?? r.durationSec ?? r.seconds ?? 0);
    return t>0 && t <= p10;
  }).length : 0;

  // 3) duplicate studentId frequency
  const freq = new Map();
  state.results.forEach(r=>{
    const sid = String(r.studentId || r.uid || r.userId || '').trim();
    if (!sid) return;
    freq.set(sid, (freq.get(sid)||0)+1);
  });
  const multi = [...freq.entries()].filter(([,n])=>n>=2).length;

  const violRate = total ? (violAny/total) : 0;

  const rows = [
    ['Results count', total, 'Tanlangan test natijalari'],
    ['Violations (sum)', violSum, 'Jami violationlar'],
    ['Violations rate', (violRate*100).toFixed(1)+'%', 'Violation > 0 bo‘lgan natijalar ulushi'],
    ['Fast completions', fast, timeSpentVals.length ? `timeSpent p10 ≈ ${p10}s` : 'timeSpent field topilmadi'],
    ['Repeated students', multi, 'Bir o‘quvchi bir necha natija (schema bo‘yicha)'],
  ];

  // Health tag
  let health = 'OK', cls = 'ok';
  if (violRate > 0.25 || violSum > total*2){ health = 'WARN'; cls = 'warn'; }
  if (violRate > 0.45 || violSum > total*4){ health = 'RISK'; cls = 'bad'; }
  setTag('#tagHealth', `HEALTH: ${health}`, cls);
  setTag('#tagIntegrity', `violRate ${(violRate*100).toFixed(1)}%`, cls);

  rows.forEach(([m,v,c])=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(m)}</td><td class="mono"><strong>${escapeHtml(v)}</strong></td><td class="small">${escapeHtml(c)}</td>`;
    tb.appendChild(tr);
  });
}

function renderTopTests(){
  const tb = $('#topTestsTbody');
  tb.innerHTML = '';

  const locks = state.locks30;
  const results = state.results30;

  const map = new Map(); // test -> {locks, results, scoreSum, scoreN}
  function get(t){
    if (!map.has(t)) map.set(t, {locks:0, results:0, scoreSum:0, scoreN:0});
    return map.get(t);
  }

  locks.forEach(r=>{
    const t = String(deriveTestCode(r) || 'UNKNOWN');
    get(t).locks += 1;
  });
  results.forEach(r=>{
    const t = String(deriveTestCode(r) || 'UNKNOWN');
    const o = get(t);
    o.results += 1;
    const sc = num(r.score ?? deriveScore(r));
    o.scoreSum += sc;
    o.scoreN += 1;
  });

  const list = [...map.entries()].map(([test, v])=>({
    test,
    locks: v.locks,
    results: v.results,
    avg: v.scoreN ? (v.scoreSum / v.scoreN) : 0
  }))
  .sort((a,b)=> (b.locks + b.results) - (a.locks + a.results))
  .slice(0,12);

  setTag('#tagTests', `Top ${list.length}`, list.length ? 'ok' : '');

  if (!list.length){
    tb.innerHTML = `<tr><td colspan="5" class="small">Ma’lumot yetarli emas.</td></tr>`;
    return;
  }

  list.forEach((x,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${i+1}</td>
      <td class="mono"><strong>${escapeHtml(x.test)}</strong></td>
      <td class="mono">${escapeHtml(x.locks)}</td>
      <td class="mono">${escapeHtml(x.results)}</td>
      <td class="mono">${escapeHtml(x.avg.toFixed(2))}</td>
    `;
    tb.appendChild(tr);
  });
}

async function refreshAll(){
  try{
    requireAdmin();
    if (!state.selectedTest) { setNotice('Test tanlang.'); return; }

    setNotice('Yuklanmoqda… (users, locks, results, 30d activity)');
    await Promise.all([
      fetchUsers(),
      fetchLocks(state.selectedTest),
      fetchResults(state.selectedTest),
      fetchGlobal30d(),
    ]);

    renderKpis();
    renderTrendChart();
    renderTopResults();
    renderIntegrity();
    renderTopTests();

    setNotice(`Tayyor ✅  test=${state.selectedTest} · users=${state.users.length} · locks=${state.locks.length} · results=${state.results.length}`);
  }catch(e){
    if (String(e.message).includes('NOT_ADMIN')){
      setNotice('Admin emas — kirish taqiqlangan.');
      return;
    }
    if (String(e.message).includes('LOGIN_REQUIRED')){
      setNotice('Avval Google bilan kiring.');
      return;
    }
    console.error(e);
    setNotice('Xatolik: ' + (e?.message || e));
  }
}

function initActions(){
  $('#loginBtn').addEventListener('click', ()=> login().catch(err=> alert(err.message||err)));
  $('#logoutBtn').addEventListener('click', ()=> logout().catch(()=>{}));
  $('#refreshBtn').addEventListener('click', ()=> refreshAll());

  $('#testSelect').addEventListener('change', ()=>{
    state.selectedTest = $('#testSelect').value;
    try{ localStorage.setItem('super_admin_selected_test', state.selectedTest); }catch{}
    refreshAll();
  });
}

async function boot(){
  try{
    initActions();
    await initFirebase();
    await loadTestsList();
    renderAuth();
    if (state.isAdmin && state.selectedTest) await refreshAll();
    else setNotice('Google bilan kiring va testni tanlang.');
  }catch(e){
    console.error(e);
    setNotice('Ishga tushirishda xatolik: ' + (e?.message || e));
  }
}

document.addEventListener('DOMContentLoaded', boot);
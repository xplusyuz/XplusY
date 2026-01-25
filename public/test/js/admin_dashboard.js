/* ===========================
   SUPER ADMIN DASHBOARD (Professional)
   - Google Auth (Firebase)
   - Server-side secured API (Netlify Function):
       /.netlify/functions/api?path=/admin/summary&testCode=...
       /.netlify/functions/api?path=/admin/results/list&testCode=...
       /.netlify/functions/api?path=/admin/results/resetUser  (POST)
   =========================== */

const ADMIN_EMAILS = ['sohibjonmath@gmail.com'];

const ui = {
  testSelect: () => document.getElementById('testSelect'),
  refreshBtn: () => document.getElementById('refreshBtn'),
  authState: () => document.getElementById('authState'),
  loginBtn: () => document.getElementById('loginBtn'),
  logoutBtn: () => document.getElementById('logoutBtn'),
  notice: () => document.getElementById('notice'),

  kpiUsers: () => document.getElementById('kpiUsers'),
  kpiUsersMeta: () => document.getElementById('kpiUsersMeta'),
  kpiAttempts: () => document.getElementById('kpiAttempts'),
  kpiAttemptsMeta: () => document.getElementById('kpiAttemptsMeta'),
  kpiResults: () => document.getElementById('kpiResults'),
  kpiResultsMeta: () => document.getElementById('kpiResultsMeta'),
  kpiHealth: () => document.getElementById('tagHealth'),

  topResultsTbody: () => document.getElementById('topResultsTbody'),
  integrityTbody: () => document.getElementById('integrityTbody'),
  topTestsTbody: () => document.getElementById('topTestsTbody'),

  trendNote: () => document.getElementById('trendNote'),
};

const state = {
  user: null,
  isAdmin: false,
  chart: null,
  idToken: '',
  selectedTest: '',
};

function setNotice(text = '', type = 'info') {
  const el = ui.notice();
  if (!el) return;
  el.textContent = text;
  el.className = 'notice ' + type;
  el.style.display = text ? 'block' : 'none';
}

function fmtSec(sec) {
  const s = Math.max(0, Math.floor(Number(sec || 0) || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function safeText(x) {
  return (x == null) ? '' : String(x);
}

function isAdminEmail(email) {
  const e = String(email || '').toLowerCase();
  return ADMIN_EMAILS.map(a => a.toLowerCase()).includes(e);
}

async function api(path, { method = 'GET', body = null } = {}) {
  const baseCandidates = [
    '/.netlify/functions/api',
    '/api',
  ];

  const p = String(path || '').startsWith('/') ? String(path || '') : '/' + String(path || '');
  let lastErr = null;

  for (const base of baseCandidates) {
    try {
      const u = new URL(base, location.origin);
      u.searchParams.set('path', p);

      const headers = { 'Content-Type': 'application/json' };
      if (state.idToken) headers.Authorization = 'Bearer ' + state.idToken;

      const res = await fetch(u.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || ('HTTP ' + res.status));
      return data;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('API error');
}

function initFirebase() {
  if (!window.firebase || !window.FIREBASE_CONFIG) throw new Error('Firebase config missing');
  if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
}

async function signIn() {
  initFirebase();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await firebase.auth().signInWithPopup(provider);
}

async function signOut() {
  initFirebase();
  await firebase.auth().signOut();
}

async function bindAuth() {
  initFirebase();

  firebase.auth().onAuthStateChanged(async (user) => {
    state.user = user || null;
    state.idToken = '';
    state.isAdmin = false;

    if (!user) {
      ui.authState().textContent = 'Kirilmagan';
      ui.loginBtn().style.display = '';
      ui.logoutBtn().style.display = 'none';
      setNotice('Admin dashboard uchun Google orqali kiring.', 'info');
      return;
    }

    const email = safeText(user.email);
    state.isAdmin = isAdminEmail(email);

    if (!state.isAdmin) {
      ui.authState().textContent = 'Admin emas: ' + email;
      ui.loginBtn().style.display = 'none';
      ui.logoutBtn().style.display = '';
      setNotice('Bu akkaunt admin emas. Admin email bilan kiring.', 'danger');
      return;
    }

    ui.authState().textContent = 'Admin: ' + email;
    ui.loginBtn().style.display = 'none';
    ui.logoutBtn().style.display = '';

    state.idToken = await user.getIdToken(true);
    setNotice('', 'info');
    await refreshAll();
  });
}

function fillTestSelect() {
  const sel = ui.testSelect();
  if (!sel) return;

  const presets = [
    { code: 'dtm001', label: 'DTM 1-variant (dtm001)' },
    { code: 'variant002', label: 'DTM 2-variant (variant002)' },
    { code: 'vector001', label: 'Vector (vector001)' },
    { code: 'test001', label: 'Test 001 (test001)' },
    { code: 'test002', label: 'Test 002 (test002)' },
  ];

  sel.innerHTML = '';
  for (const p of presets) {
    const opt = document.createElement('option');
    opt.value = p.code;
    opt.textContent = p.label;
    sel.appendChild(opt);
  }

  // default
  state.selectedTest = presets[0]?.code || '';
  sel.value = state.selectedTest;

  sel.addEventListener('change', () => {
    state.selectedTest = sel.value;
    refreshAll();
  });
}

async function refreshAll() {
  if (!state.isAdmin || !state.selectedTest) return;

  ui.refreshBtn().disabled = true;
  setNotice('Yuklanmoqda...', 'info');

  try {
    const testCode = state.selectedTest;

    // Summary
    const summary = await api(`/admin/summary&testCode=${encodeURIComponent(testCode)}`, { method: 'GET' });

    ui.kpiUsers().textContent = safeText(summary.countUsers ?? '-');
    ui.kpiUsersMeta().textContent = `O'rtacha ball: ${Number(summary.avgScore || 0).toFixed(2)}`;

    ui.kpiAttempts().textContent = '-';
    ui.kpiAttemptsMeta().textContent = 'Attempts (history) admin panelda ochiladi';

    ui.kpiResults().textContent = safeText(summary.modeCounts ? (summary.modeCounts.challenge + summary.modeCounts.open) : '-');
    ui.kpiResultsMeta().textContent = summary.best
      ? `Top: ${safeText(summary.best.name || summary.best.email || summary.best.uid)} — ${safeText(summary.best.score)}`
      : 'Top yo‘q';

    // Latest list (desc by updatedAt)
    const list = await api(`/admin/results/list&testCode=${encodeURIComponent(testCode)}&limit=100`, { method: 'GET' });

    renderTopResults(list.items || []);
    renderIntegrity(list.items || []);
    renderTrendChart(list.items || []);

    setNotice('Yuklandi ✅', 'success');
  } catch (e) {
    console.error(e);
    setNotice('Xatolik: ' + safeText(e.message || e), 'danger');
  } finally {
    ui.refreshBtn().disabled = false;
  }
}

function renderTopResults(items) {
  const tb = ui.topResultsTbody();
  if (!tb) return;
  tb.innerHTML = '';

  // sort by score desc for "Top"
  const sorted = [...items].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  sorted.slice(0, 50).forEach((r, idx) => {
    const tr = document.createElement('tr');

    const name = safeText(r.name || '').trim() || safeText(r.email || '').trim() || ('UID: ' + safeText(r.uid));
    const viol = r.violations ? (Array.isArray(r.violations) ? r.violations.length : 1) : 0;

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${name}</td>
      <td><b>${Number(r.score || 0)}</b></td>
      <td>${viol}</td>
      <td>${fmtSec(r.timeSpentSec || 0)}</td>
      <td>
        <div class="row-actions">
          <code>${safeText(r.uid).slice(0, 10)}</code>
          <button class="btn btn-ghost btn-xs" data-reset="${safeText(r.uid)}">Reset</button>
        </div>
      </td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll('button[data-reset]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-reset');
      if (!uid) return;
      if (!confirm('Rostdan ham shu o‘quvchining natijalarini reset qilamizmi?\nUID: ' + uid)) return;

      try {
        btn.disabled = true;
        const resp = await api('/admin/results/resetUser', { method: 'POST', body: { testCode: state.selectedTest, uid } });
        setNotice(`Reset OK: ${resp.deletedAttempts || 0} attempts o‘chirildi ✅`, 'success');
        await refreshAll();
      } catch (e) {
        setNotice('Reset xato: ' + safeText(e.message || e), 'danger');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function renderIntegrity(items) {
  const tb = ui.integrityTbody();
  if (!tb) return;
  tb.innerHTML = '';

  const total = items.length;
  const noEmail = items.filter(x => !x.email).length;
  const noName = items.filter(x => !x.name).length;

  const rows = [
    { m: 'Results count', v: total, c: 'Latest results doclar soni' },
    { m: 'Missing email', v: noEmail, c: 'Token ichida email yo‘q (rare)' },
    { m: 'Missing name', v: noName, c: 'Token ichida name yo‘q (normal)' },
  ];

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.m}</td><td><b>${r.v}</b></td><td>${r.c}</td>`;
    tb.appendChild(tr);
  });

  // Top tests table not used in this build (single test view)
  const tb2 = ui.topTestsTbody();
  if (tb2) {
    tb2.innerHTML = `<tr><td colspan="5">Bu versiyada test bo‘yicha alohida analytics. Keyin global “top tests” qo‘shamiz.</td></tr>`;
  }
}

function renderTrendChart(items) {
  const canvas = document.getElementById('chartTrend');
  if (!canvas || !window.Chart) return;

  // Build score distribution
  const scores = items.map(x => Number(x.score || 0) || 0);
  const buckets = new Map();
  for (const s of scores) {
    const b = Math.floor(s / 5) * 5; // 0-4,5-9,..
    buckets.set(b, (buckets.get(b) || 0) + 1);
  }
  const labels = [...buckets.keys()].sort((a,b)=>a-b).map(b => `${b}-${b+4}`);
  const data = [...buckets.keys()].sort((a,b)=>a-b).map(b => buckets.get(b));

  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }

  state.chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'O‘quvchilar soni', data }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  ui.trendNote().textContent = 'Diagramma: ball taqsimoti (5 ballik interval).';
}

document.addEventListener('DOMContentLoaded', () => {
  fillTestSelect();

  ui.loginBtn().addEventListener('click', signIn);
  ui.logoutBtn().addEventListener('click', signOut);
  ui.refreshBtn().addEventListener('click', refreshAll);

  bindAuth();
});

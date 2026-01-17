/* ==================== TEST ADMIN PANEL ====================
   Maqsad: urinish (lock), natijalar va reytingni bitta oynada boshqarish.
   Talab: Firebase Firestore mavjud bo'lsa ishlaydi.
*/

// Adminlar ro'yxati
const ADMIN_EMAILS = [
  'sohibjonmath@gmail.com'
];

const adminState = {
  appReady: false,
  user: null,
  isAdmin: false,
  db: null,
  selectedTest: '',
  tests: [],
  // cache
  locks: [],
  results: [],
  users: [],
  // modal
  currentModal: null // {kind:'lock'|'result', id, ref, data}
};

// ---------- UI helpers ----------
const $ = (sel) => document.querySelector(sel);
function setNotice(msg) {
  const el = $('#notice');
  if (!el) return;
  el.textContent = msg;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('uz-UZ');
  } catch { return String(iso); }
}

function num(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function requireAdmin() {
  if (!adminState.user) throw new Error('LOGIN_REQUIRED');
  if (!adminState.isAdmin) throw new Error('NOT_ADMIN');
}

// ---------- Firebase init/auth ----------
async function initFirebase() {
  if (!CONFIG.useFirebase) {
    throw new Error('FIREBASE_DISABLED');
  }
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  adminState.db = firebase.firestore();
  adminState.db.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });

  firebase.auth().onAuthStateChanged((u) => {
    adminState.user = u || null;
    adminState.isAdmin = !!u && ADMIN_EMAILS.includes(String(u.email || '').toLowerCase());
    renderAuth();
    // admin bo'lsa avtomatik data yuklash
    if (adminState.isAdmin && adminState.selectedTest) {
      refreshAll().catch(() => {});
    }
  });
}

function renderAuth() {
  const u = adminState.user;
  $('#loginBtn').style.display = u ? 'none' : '';
  $('#logoutBtn').style.display = u ? '' : 'none';
  const state = $('#authState');
  if (!u) {
    state.textContent = 'Kirmagansiz';
    setNotice('Google bilan kiring (admin email bilan).');
    return;
  }
  const badge = adminState.isAdmin ? '✅ admin' : '⛔ admin emas';
  state.textContent = `${u.email || u.displayName || 'User'} — ${badge}`;
  if (!adminState.isAdmin) {
    setNotice('Bu sahifa faqat ADMIN uchun. Admin email bilan kiring.');
  } else {
    setNotice('Admin rejim: tayyor.');
  }
}

async function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  await firebase.auth().signInWithPopup(provider);
}

async function logout() {
  await firebase.auth().signOut();
}

// ---------- Load tests list ----------
async function loadTestsList() {
  const db = adminState.db;
  const sel = $('#testSelect');
  sel.innerHTML = '<option value="">— test tanlang —</option>';

  // testlar kolleksiyasidan code/title olish
  const snap = await db.collection('testlar').limit(200).get();
  const arr = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    arr.push({ code: doc.id, title: d.title || d.name || doc.id });
  });
  arr.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  adminState.tests = arr;
  for (const t of arr) {
    const opt = document.createElement('option');
    opt.value = t.code;
    opt.textContent = `${t.code} — ${t.title}`;
    sel.appendChild(opt);
  }

  // old selection
  const last = localStorage.getItem('admin_selected_test') || '';
  if (last && arr.some(x => x.code === last)) {
    sel.value = last;
    adminState.selectedTest = last;
  } else if (arr.length) {
    sel.value = arr[0].code;
    adminState.selectedTest = arr[0].code;
  }
}

// ---------- Queries (no composite index) ----------
async function fetchLocks(testCode) {
  const db = adminState.db;
  const snap = await db.collection('test_attempt_locks')
    .where('testCode', '==', testCode)
    .limit(500)
    .get();
  const rows = [];
  snap.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));
  // newest first by startedAt
  rows.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
  adminState.locks = rows;
}

async function fetchResults(testCode) {
  const db = adminState.db;
  const snap = await db.collection('test_results')
    .where('testCode', '==', testCode)
    .limit(500)
    .get();
  const rows = [];
  snap.forEach((doc) => rows.push({ id: doc.id, ...doc.data() }));
  // score desc
  rows.sort((a, b) => num(b.score) - num(a.score));
  adminState.results = rows;
}

async function fetchTopUsers() {
  const db = adminState.db;
  // users.points bo'yicha index talab qilishi mumkin; orderBy ishlatmaymiz.
  // Kichik limit uchun 300 ta olib, JS sort.
  const snap = await db.collection('users').limit(300).get();
  const rows = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    rows.push({ id: doc.id, name: d.name || d.fullName || d.displayName || d.loginId || doc.id, points: num(d.points) });
  });
  rows.sort((a, b) => num(b.points) - num(a.points));
  adminState.users = rows.slice(0, 100);
}

// ---------- Render tables ----------
function renderLocks() {
  const tb = $('#attemptsTbody');
  tb.innerHTML = '';
  const rows = adminState.locks;
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="5" class="muted">Lock topilmadi.</td></tr>`;
    return;
  }
  for (const r of rows) {
    const who = `${escapeHtml(r.studentName || '—')}<div class="muted mono" style="margin-top:2px">${escapeHtml(r.studentId || '')}</div>`;
    const st = `<span class="mono">${escapeHtml(r.status || '')}</span>`;
    const tm = `<div class="muted">start: ${escapeHtml(fmtTime(r.startedAt))}</div><div class="muted">done: ${escapeHtml(fmtTime(r.completedAt || r.cancelledAt))}</div>`;
    const rs = `${r.cancelReason ? `<div class="muted">${escapeHtml(r.cancelReason)}</div>` : ''}${typeof r.score === 'number' ? `<div class="muted">score: <span class="mono">${escapeHtml(r.score)}</span></div>` : ''}`;
    const act = `
      <button class="tabBtn btnGhost" data-action="editLock" data-id="${escapeHtml(r.id)}">Tahrir</button>
      <button class="tabBtn btnDanger" data-action="deleteLock" data-id="${escapeHtml(r.id)}">Unlock</button>
    `;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${who}</td><td>${st}</td><td>${tm}</td><td>${rs}</td><td>${act}</td>`;
    tb.appendChild(tr);
  }
}

function renderResults() {
  const tb = $('#resultsTbody');
  tb.innerHTML = '';
  const rows = adminState.results;
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="5" class="muted">Natija topilmadi (bu test oddiy bo'lishi ham mumkin).</td></tr>`;
    return;
  }
  for (const r of rows) {
    const who = `${escapeHtml(r.studentName || '—')}<div class="muted mono" style="margin-top:2px">${escapeHtml(r.studentId || '')}</div>`;
    const sc = `<strong class="mono">${escapeHtml(r.score ?? 0)}</strong><div class="muted">/${escapeHtml(r.totalScore ?? '')}</div>`;
    const vio = `<div class="muted">to'g'ri: ${escapeHtml(r.correctAnswers ?? '')}, xato: ${escapeHtml(r.wrongAnswers ?? '')}</div><div class="muted">viol: <span class="mono">${escapeHtml(r.violations ?? 0)}</span></div>`;
    const tm = `<div class="muted">${escapeHtml(fmtTime(r.completedAt))}</div><div class="muted">${escapeHtml(r.timeSpent ?? '')} s</div>`;
    const act = `
      <button class="tabBtn btnGhost" data-action="editResult" data-id="${escapeHtml(r.id)}">Tahrir</button>
      <button class="tabBtn btnDanger" data-action="deleteResult" data-id="${escapeHtml(r.id)}">O'chirish</button>
    `;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${who}</td><td>${sc}</td><td>${vio}</td><td>${tm}</td><td>${act}</td>`;
    tb.appendChild(tr);
  }
}

function renderLeaderboards() {
  // test leaderboard = results sorted
  const tb1 = $('#testLeaderTbody');
  tb1.innerHTML = '';
  const res = [...adminState.results].sort((a, b) => num(b.score) - num(a.score));
  if (!res.length) {
    tb1.innerHTML = `<tr><td colspan="5" class="muted">Natija yo'q.</td></tr>`;
  } else {
    res.slice(0, 100).forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="mono">${i + 1}</td><td>${escapeHtml(r.studentName || '—')}</td><td class="mono"><strong>${escapeHtml(r.score ?? 0)}</strong></td><td class="muted">${escapeHtml(r.studentClass || '')}</td><td class="muted">${escapeHtml(fmtTime(r.completedAt))}</td>`;
      tb1.appendChild(tr);
    });
  }
  const tb2 = $('#pointsLeaderTbody');
  tb2.innerHTML = '';
  const us = adminState.users;
  if (!us.length) {
    tb2.innerHTML = `<tr><td colspan="4" class="muted">Users topilmadi.</td></tr>`;
  } else {
    us.forEach((u, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="mono">${i + 1}</td><td>${escapeHtml(u.name || '—')}</td><td class="mono"><strong>${escapeHtml(u.points)}</strong></td><td class="mono muted">${escapeHtml(u.id)}</td>`;
      tb2.appendChild(tr);
    });
  }
}

// ---------- Modal ----------
function openModal(kind, row) {
  const modal = $('#modal');
  adminState.currentModal = { kind, id: row.id, data: row };
  $('#modalTitle').textContent = kind === 'lock' ? `Lock: ${row.id}` : `Natija: ${row.id}`;
  $('#editStatus').value = String(row.status || '');
  $('#editScore').value = (row.score === undefined || row.score === null) ? '' : String(row.score);
  $('#editReason').value = String(row.cancelReason || '');
  $('#modalJson').value = JSON.stringify(row, null, 2);

  // delete button text
  $('#modalDelete').textContent = (kind === 'lock') ? "Unlock (o'chirish)" : "Natijani o'chirish";

  modal.classList.add('show');
}

function closeModal() {
  $('#modal').classList.remove('show');
  adminState.currentModal = null;
}

async function modalSave() {
  requireAdmin();
  const m = adminState.currentModal;
  if (!m) return;
  const status = $('#editStatus').value.trim();
  const scoreRaw = $('#editScore').value.trim();
  const reason = $('#editReason').value.trim();
  const score = scoreRaw === '' ? null : Number(scoreRaw);

  const db = adminState.db;
  const ref = (m.kind === 'lock')
    ? db.collection('test_attempt_locks').doc(m.id)
    : db.collection('test_results').doc(m.id);

  const payload = {};
  if (status) payload.status = status;
  if (reason) payload.cancelReason = reason;
  if (scoreRaw !== '') payload.score = Number.isFinite(score) ? score : 0;
  payload.updatedAt = new Date().toISOString();

  await ref.set(payload, { merge: true });
  closeModal();
  await refreshAll();
}

async function modalDelete() {
  requireAdmin();
  const m = adminState.currentModal;
  if (!m) return;
  const ok = confirm('Rostdan ham o‘chirasizmi? (orqaga qaytmaydi)');
  if (!ok) return;
  const db = adminState.db;
  const ref = (m.kind === 'lock')
    ? db.collection('test_attempt_locks').doc(m.id)
    : db.collection('test_results').doc(m.id);
  await ref.delete();
  closeModal();
  await refreshAll();
}

// ---------- Bulk tools ----------
async function bulkUnlock() {
  requireAdmin();
  const code = adminState.selectedTest;
  if (!code) return;
  if (!confirm(`Test ${code} bo‘yicha hamma locklarni o‘chirasizmi?`)) return;
  const db = adminState.db;
  const snap = await db.collection('test_attempt_locks').where('testCode','==',code).limit(800).get();
  const batch = db.batch();
  let n = 0;
  snap.forEach((doc) => { batch.delete(doc.ref); n++; });
  if (n) await batch.commit();
  await refreshAll();
  alert(`Done: ${n} ta lock o‘chirildi.`);
}

async function bulkDeleteResults() {
  requireAdmin();
  const code = adminState.selectedTest;
  if (!code) return;
  if (!confirm(`Test ${code} bo‘yicha hamma natijani o‘chirasizmi?`)) return;
  const db = adminState.db;
  const snap = await db.collection('test_results').where('testCode','==',code).limit(800).get();
  const batch = db.batch();
  let n = 0;
  snap.forEach((doc) => { batch.delete(doc.ref); n++; });
  if (n) await batch.commit();
  await refreshAll();
  alert(`Done: ${n} ta natija o‘chirildi.`);
}

// ---------- Main refresh ----------
async function refreshAll() {
  try {
    requireAdmin();
    const code = adminState.selectedTest;
    if (!code) { setNotice('Test tanlang.'); return; }
    setNotice('Yuklanmoqda…');
    await Promise.all([
      fetchLocks(code),
      fetchResults(code),
      fetchTopUsers()
    ]);
    renderLocks();
    renderResults();
    renderLeaderboards();
    setNotice(`Tayyor: ${code} (lock: ${adminState.locks.length}, natija: ${adminState.results.length})`);
  } catch (e) {
    if (String(e.message).includes('NOT_ADMIN')) {
      setNotice('Admin emas — kirish taqiqlangan.');
      return;
    }
    if (String(e.message).includes('LOGIN_REQUIRED')) {
      setNotice('Avval Google bilan kiring.');
      return;
    }
    console.error(e);
    setNotice('Xatolik: ' + (e?.message || e));
  }
}

// ---------- Tabs & events ----------
function initTabs() {
  document.querySelectorAll('.tabBtn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabBtn[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      $('#panel_' + tab).classList.add('active');
    });
  });
}

function initActions() {
  $('#loginBtn').addEventListener('click', () => login().catch(err => alert(err.message || err)));
  $('#logoutBtn').addEventListener('click', () => logout().catch(() => {}));
  $('#refreshBtn').addEventListener('click', () => refreshAll());

  $('#testSelect').addEventListener('change', () => {
    adminState.selectedTest = $('#testSelect').value;
    try { localStorage.setItem('admin_selected_test', adminState.selectedTest); } catch {}
    refreshAll();
  });

  // tables click delegation
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const act = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if (!act || !id) return;

    if (act === 'editLock') {
      const row = adminState.locks.find(x => x.id === id);
      if (row) openModal('lock', row);
    }
    if (act === 'deleteLock') {
      // unlock
      (async () => {
        requireAdmin();
        if (!confirm('Bu lock o‘chirilsa, foydalanuvchi qayta test yecha oladi. Davom etamizmi?')) return;
        await adminState.db.collection('test_attempt_locks').doc(id).delete();
        await refreshAll();
      })().catch(err => alert(err.message || err));
    }
    if (act === 'editResult') {
      const row = adminState.results.find(x => x.id === id);
      if (row) openModal('result', row);
    }
    if (act === 'deleteResult') {
      (async () => {
        requireAdmin();
        if (!confirm('Natija o‘chiriladi. Davom etamizmi?')) return;
        await adminState.db.collection('test_results').doc(id).delete();
        await refreshAll();
      })().catch(err => alert(err.message || err));
    }
  });

  // modal
  $('#modalClose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeModal(); });
  $('#modalSave').addEventListener('click', () => modalSave().catch(err => alert(err.message || err)));
  $('#modalDelete').addEventListener('click', () => modalDelete().catch(err => alert(err.message || err)));

  // bulk
  $('#bulkUnlockBtn').addEventListener('click', () => bulkUnlock().catch(err => alert(err.message || err)));
  $('#bulkDeleteResultsBtn').addEventListener('click', () => bulkDeleteResults().catch(err => alert(err.message || err)));
}

// ---------- Boot ----------
async function boot() {
  try {
    initTabs();
    initActions();
    await initFirebase();
    await loadTestsList();
    renderAuth();
    if (adminState.selectedTest && adminState.isAdmin) {
      await refreshAll();
    } else {
      setNotice('Google bilan kiring va testni tanlang.');
    }
  } catch (e) {
    console.error(e);
    setNotice('Ishga tushirishda xatolik: ' + (e?.message || e));
  }
}

document.addEventListener('DOMContentLoaded', boot);

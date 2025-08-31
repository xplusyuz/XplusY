// assets/js/main.js
import { auth, onAuthStateChanged, fetchUser, fetchTopUsersByPoints } from './firebase.js';

// Inject header & footer fragments if placeholders exist
async function injectFragment(id, url) {
  const host = document.getElementById(id);
  if (!host) return;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    host.innerHTML = await res.text();
  } catch (e) { console.error('Fragment load failed:', e); }
}

await injectFragment('km-header', './header.html');
await injectFragment('km-footer', './footer.html');

// After header is in DOM, wire theme & menu toggles if any
(function wireHeaderControls(){
  const themeToggle = document.getElementById('themeToggle');
  const verticalMenu = document.getElementById('verticalMenu');
  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle && verticalMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      verticalMenu.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!verticalMenu.contains(e.target) && e.target !== menuToggle) {
        verticalMenu.classList.remove('show');
      }
    });
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('theme-dark');
      localStorage.setItem('theme-dark', document.documentElement.classList.contains('theme-dark') ? '1' : '0');
    });
    if (localStorage.getItem('theme-dark') === '1') {
      document.documentElement.classList.add('theme-dark');
    }
  }
})();

// Fill header user info (Salom!, username, ID, ball va balans)
async function fillHeaderUser(user) {
  const elName = document.querySelector('[data-username]');
  const elId = document.querySelector('[data-userid]');
  const elPoints = document.querySelector('[data-points]');
  const elBalance = document.querySelector('[data-balance]');

  if (!user) {
    if (elName) elName.textContent = "Mehmon";
    if (elId) elId.textContent = "—";
    if (elPoints) elPoints.textContent = "0";
    if (elBalance) elBalance.textContent = "0 so'm";
    return;
  }

  // read Firestore user doc
  const profile = await fetchUser(user.uid);
  const displayName = profile?.displayName || user.displayName || "Foydalanuvchi";
  const points = Number((profile?.points ?? profile?.ball) ?? 0);
  const balance = Number(profile?.balance ?? 0);

  if (elName) elName.textContent = displayName;
  if (elId) elId.textContent = user.uid.slice(0, 8);
  if (elPoints) elPoints.textContent = points.toLocaleString('uz-UZ');
  if (elBalance) elBalance.textContent = balance.toLocaleString('uz-UZ') + " so'm";
}

// Populate Top-10 on index.html if table exists
async function populateTop10() {
  const tbody = document.getElementById('ratingTableBody');
  if (!tbody) return;
  const top = await fetchTopUsersByPoints(10);
  tbody.innerHTML = '';
  top.forEach((u, idx) => {
    const tr = document.createElement('tr');
    const rankClass = idx===0?'rank-1':idx===1?'rank-2':idx===2?'rank-3':'';
    const name = u.displayName || u.name || '—';
    const badge = (idx===0?'Grandmaster':idx===1?'Champion':idx===2?'Master':'Member');
    const points = Number((u.points ?? u.ball) ?? 0);
    tr.innerHTML = `
      <td class="${rankClass}">${idx+1}</td>
      <td>${name}</td>
      <td>${(u.id || '').slice(0,8)}</td>
      <td>${points.toLocaleString('uz-UZ')}</td>
      <td>${badge}</td>`;
    tbody.appendChild(tr);
  });
}

// Populate full rating on reyting.html (Top-100 by points)
async function populateFullRating() {
  const tableBody = document.getElementById('fullRatingTable');
  if (!tableBody) return;
  // For now: single pass fetch top100 ordered by points
  const { getFirestore, collection, query, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js');
  const db = getFirestore();
  const q = query(collection(db, "users"), orderBy("points","desc"), limit(100));
  const snap = await getDocs(q);
  tableBody.innerHTML = '';
  let rank = 1;
  snap.docs.forEach(d => {
    const u = { id:d.id, ...d.data() };
    const name = u.displayName || u.name || '—';
    const points = Number((u.points ?? u.ball) ?? 0);
    const tr = document.createElement('tr');
    const rankClass = rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';
    const badge = rank===1?'Grandmaster':rank===2?'Champion':rank===3?'Master'
      : points>=8000?'Expert':points>=6000?'Specialist':points>=4000?'Contributor':'Member';
    tr.innerHTML = `
      <td class="${rankClass}">${rank}</td>
      <td>${name}</td>
      <td>${(u.id||'').slice(0,8)}</td>
      <td>${points.toLocaleString('uz-UZ')}</td>
      <td><span class="badge badge-${badge.toLowerCase()}">${badge}</span></td>`;
    tableBody.appendChild(tr);
    rank++;
  });
}

// Auth-driven UI
onAuthStateChanged(auth, async (user) => {
  try {
    await fillHeaderUser(user);
  } catch (e) { console.error('fillHeaderUser failed', e); }
});

// Page-specific boot
populateTop10();
populateFullRating();
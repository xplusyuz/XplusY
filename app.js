// --- Always unlock scroll on load
document.body.classList.remove('modal-open');

// Theme
const root = document.documentElement;
const themeBtn = document.getElementById('themeBtn');
const THEME_KEY = 'lm-theme';
const setTheme = (m) => {
  root.classList.toggle('dark', m === 'dark');
  localStorage.setItem(THEME_KEY, m);
  themeBtn.textContent = m === 'dark' ? '☀️' : '🌙';
};
setTheme(localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeBtn.onclick = () => setTheme(root.classList.contains('dark') ? 'light' : 'dark');
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./service-worker.js'); }

// Firebase
import { auth, db, signOut } from './lib/firebase.client.js';
import { watchAuth } from './lib/auth-guard.js';
import { doc, getDoc, setDoc, runTransaction, collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- Elements
const el = {
  uname: document.getElementById('uname'), uid: document.getElementById('uid'),
  uregion: document.getElementById('uregion'), udistrict: document.getElementById('udistrict'),
  uschool: document.getElementById('uschool'), uclass: document.getElementById('uclass'),
  urank: document.getElementById('urank'), utier: document.getElementById('utier'),
  points: document.getElementById('points'),
  ava: document.getElementById('ava'), signin: document.getElementById('signin'),
  signout: document.getElementById('signout'), editProfile: document.getElementById('editProfile'),
  banners: document.getElementById('banners'), sections: document.getElementById('sections'),
  boardList: document.getElementById('boardList'),
  decilePrev: document.getElementById('decilePrev'), decileNext: document.getElementById('decileNext'), decileInfo: document.getElementById('decileInfo'),
  userTierStars: document.getElementById('userTierStars'), userStarsPts: document.getElementById('userStarsPts'),
  mainTags: document.getElementById('mainTags'),
  mstats: document.getElementById('mstats')
};

// ---- Modal helpers
const PM = {
  mask: document.getElementById('profileModal'),
  first: document.getElementById('pFirst'), last: document.getElementById('pLast'),
  region: document.getElementById('pRegion'), district: document.getElementById('pDistrict'),
  school: document.getElementById('pSchool'), klass: document.getElementById('pClass'),
  phone: document.getElementById('pPhone'), err: document.getElementById('pError'),
  save: document.getElementById('pSave'), close: document.getElementById('pClose'),
};
const isModalVisible = () => PM.mask && getComputedStyle(PM.mask).display !== 'none';
function openProfileModal(pref = {}) {
  PM.first.value = pref.first || ''; PM.last.value = pref.last || '';
  PM.region.value = pref.region || ''; PM.district.value = pref.district || '';
  PM.school.value = pref.school || ''; PM.klass.value = pref.klass || '';
  PM.phone.value = pref.phone || ''; PM.err.textContent = '';
  PM.mask.style.display = 'flex'; document.body.classList.add('modal-open');
}
function closeProfileModal() { PM.mask.style.display = 'none'; document.body.classList.remove('modal-open'); }
PM.close.onclick = closeProfileModal;
new MutationObserver(() => {
  if (isModalVisible()) document.body.classList.add('modal-open'); else document.body.classList.remove('modal-open');
}).observe(PM.mask, { attributes: true, attributeFilter: ['style', 'class'] });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && isModalVisible()) closeProfileModal(); });

// ---- Utils
function initials(n) { if (!n) return 'LM'; const p = n.trim().split(/\s+/); return (p[0]?.[0] || 'L') + (p[1]?.[0] || 'M'); }
function profileIsComplete(u) { return !!(u && u.name && /\s/.test(u.name) && u.region && u.district && u.school && u.class && u.phone); }
const toMs = v => v ? (new Date(v)).getTime() : null;
const fmt = (ms) => { if (ms <= 0) return '00:00:00'; const s = Math.floor(ms / 1000); const h = String(Math.floor(s / 3600)).padStart(2, '0'); const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0'); const ss = String(s % 60).padStart(2, '0'); return `${h}:${m}:${ss}`; };
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
function fmtPoints(v) { const n = Number(v) || 0; return n.toLocaleString('uz-UZ', { maximumFractionDigits: 1 }); }

// ==== GLOBAL FILTR STATE ====
let FILTER = { main: null }; // faqat katta teg
const SECTION_FILTERS = new Map(); // har bo'lim uchun: key -> Set(sub-tags)

const byText = (txt) => document.createTextNode(txt);
function chipEl(label, pressed = false, onClick = () => { }, extraClass = '') {
  const b = document.createElement('button');
  b.className = 'chip filter ' + extraClass;
  b.type = 'button';
  b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  b.appendChild(byText(label));
  b.onclick = () => onClick(b);
  return b;
}

function collectMainTags(data) {
  const main = new Set();
  (data.sections || []).forEach(sec => { if (sec.tag) main.add(String(sec.tag)); });
  return [...main].sort();
}
function getSecKey(sec) { return (sec.title || '') + '__' + (sec.tag || ''); }

function renderMainChips(tags) {
  const wrap = el.mainTags; wrap.innerHTML = '';
  wrap.appendChild(chipEl('Hammasi', FILTER.main === null, () => {
    FILTER.main = null; renderAll();
  }));
  tags.forEach(t => {
    wrap.appendChild(chipEl(t, FILTER.main === t, () => {
      FILTER.main = (FILTER.main === t ? null : t);
      renderAll();
    }));
  });
}

// ---- Cards (with per-section subfilters)
function computeState(it, now) {
  const t = it.type || 'open', start = toMs(it.startAt), end = toMs(it.endAt);
  if (t === 'open') return { status: 'open' };
  if (t === 'coming_soon') return { status: 'soon' };
  if (t === 'window') { if (!start || !end) return { status: 'open' }; if (now < start) return { status: 'locked_until', left: start - now }; if (now <= end) return { status: 'open' }; return { status: 'closed' }; }
  return { status: 'open' };
}

function sectionTags(sec) {
  const s = new Set();
  (sec.items || []).forEach(it => (it.tags || []).forEach(t => s.add(String(t))));
  return [...s].sort();
}

function renderSection(sec) {
  const key = getSecKey(sec);
  if (!SECTION_FILTERS.has(key)) SECTION_FILTERS.set(key, new Set());
  const subSel = SECTION_FILTERS.get(key);

  // sarlavha
  const title = document.createElement('h3');
  title.style.margin = '10px 6px'; title.style.fontSize = '15px'; title.style.opacity = '.8';
  title.innerHTML = escapeHtml(sec.title || 'Bo‘lim') + (sec.tag ? ` — <span style="font-weight:600;opacity:.9">${escapeHtml(sec.tag)}</span>` : '');

  // bo'lim ichidagi sub-tag chiplar
  const subWrap = document.createElement('section');
  subWrap.className = 'filters grad-border glass';
  subWrap.innerHTML = `<h4>Bu bo‘lim uchun kichik teglar:</h4><div class="chips"></div>`;
  const chipsRow = subWrap.querySelector('.chips');

  const tags = sectionTags(sec);
  if (tags.length === 0) {
    chipsRow.innerHTML = `<span class="chip sm" style="opacity:.7">Teglar yo‘q</span>`;
  } else {
    // Reset
    chipsRow.appendChild(chipEl('Reset', subSel.size === 0, () => {
      subSel.clear(); renderAll();
    }, 'sm'));
    // tags
    tags.forEach(t => {
      const pressed = subSel.has(t);
      chipsRow.appendChild(chipEl(t, pressed, (btn) => {
        const on = btn.getAttribute('aria-pressed') === 'true';
        if (on) { subSel.delete(t); btn.setAttribute('aria-pressed', 'false'); }
        else { subSel.add(t); btn.setAttribute('aria-pressed', 'true'); }
        renderAll();
      }, 'sm'));
    });
  }

  // grid
  const grid = document.createElement('div'); grid.className = 'grid';

  // filter items by section subSel (ANY)
  let items = (sec.items || []);
  if (subSel.size > 0) {
    const want = [...subSel];
    items = items.filter(it => {
      const tags = (it.tags || []).map(String);
      return want.some(t => tags.includes(t));
    });
  }

  items.forEach(it => {
    const card = document.createElement('article'); card.className = 'card grad-border glass';
    const best = it.best ? '<div class="badge">BEST</div>' : '';
    const slug = (it.name || '').replace(/\W+/g, '-');
    card.innerHTML = `
      <div class="thumb"><div style="font-weight:900;opacity:.75">${escapeHtml(it.name || '')}</div>${best}</div>
      <div class="body">
        <h3 class="name">${escapeHtml(it.name || '')}</h3>
        ${it.description ? `<p class="desc">${escapeHtml(it.description)}</p>` : ''}
        <div class="actions">
          <a class="btn" id="start-${slug}">Boshlash</a>
          <button class="btn ghost" disabled id="info-${slug}">Info</button>
        </div>
        <div class="meta">
          <span class="countdown" data-id="${slug}"></span>
        </div>
        <div class="chips" style="margin-top:8px">
          ${(it.tags || []).map(t => `<span class="chip sm">${escapeHtml(String(t))}</span>`).join('')}
        </div>
      </div>`;

    const startBtn = card.querySelector(`#start-${slug}`);
    const cdEl = card.querySelector(`[data-id="${slug}"]`);
    const tick = () => {
      const st = computeState(it, Date.now());
      if (st.status === 'open') { startBtn.removeAttribute('disabled'); startBtn.setAttribute('href', it.link || '#'); cdEl.textContent = ''; }
      else if (st.status === 'soon') { startBtn.setAttribute('disabled', '1'); startBtn.removeAttribute('href'); cdEl.textContent = 'Tez orada'; }
      else if (st.status === 'locked_until') { startBtn.setAttribute('disabled', '1'); startBtn.removeAttribute('href'); cdEl.textContent = 'Qolgan vaqt: ' + fmt(st.left); }
      else { startBtn.setAttribute('disabled', '1'); startBtn.removeAttribute('href'); cdEl.textContent = 'Tugadi'; }
    };
    tick(); setInterval(tick, 1000); grid.appendChild(card);
  });

  // bo'lim blokini qaytarish
  const frag = document.createDocumentFragment();
  frag.appendChild(title);
  frag.appendChild(subWrap);
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'desc'; empty.style.margin = '0 6px 10px'; empty.style.opacity = '.7';
    empty.textContent = 'Bu bo‘lim uchun tanlangan teg(lar) bo‘yicha ma’lumot topilmadi.';
    frag.appendChild(empty);
  }
  frag.appendChild(grid);
  return frag;
}

function renderCards(data) {
  const wrap = el.sections; wrap.innerHTML = '';

  // main tag bo'yicha bo'lim filtri
  const sections = (data.sections || []).filter(sec => {
    if (!FILTER.main) return true;
    return (sec.tag && String(sec.tag) === FILTER.main);
  });

  if (sections.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'desc'; empty.style.margin = '10px 6px'; empty.style.opacity = '.75';
    empty.textContent = 'Tanlangan katta teg bo‘yicha bo‘lim topilmadi.';
    wrap.appendChild(empty);
    return;
  }

  sections.forEach(sec => {
    wrap.appendChild(renderSection(sec));
  });
}

// Initial content load
(async function initContent() {
  try {
    const r = await fetch('./index.json', { cache: 'no-store' });
    const data = await r.json();

    // Banners
    el.banners.innerHTML = (data.banners || []).map(b => `<div class="banner grad-border glass">${b.html || ''}</div>`).join('');

    // Main tags (global)
    const mains = collectMainTags(data);
    renderMainChips(mains);

    // Dastlabki render
    window.__LM_DATA = data;
    renderCards(data);
  } catch (e) { console.error(e); }
})();

function renderAll() {
  if (!window.__LM_DATA) return;
  renderCards(window.__LM_DATA);
}

// ---- Leaderboard groups
const GROUPS = [
  { label: '10–1 (Diamond)', start: 1, end: 10, tier: 'diamond', grad: ['#9FE3FF', '#39B6FF', '#0077FF'] },
  { label: '20–11 (Emerald)', start: 11, end: 20, tier: 'emerald', grad: ['#8FE3B0', '#2E8B57', '#1F6B45'] },
  { label: '30–21 (Gold)', start: 21, end: 30, tier: 'gold', grad: ['#FFE082', '#FFC107', '#FF8F00'] },
  { label: '40–31 (Silver)', start: 31, end: 40, tier: 'silver', grad: ['#DDE3EC', '#BFC6D4', '#9AA6B2'] },
  { label: '50–41 (Bronze)', start: 41, end: 50, tier: 'bronze', grad: ['#C69462', '#9A6B3F', '#7C4F2E'] }
];
let CURRENT_DECILE = 0;

function iconSVG(shape, fillPct, colors) {
  const [c1, c2, c3] = colors, gid = 'g' + Math.random().toString(36).slice(2, 8), cid = 'c' + Math.random().toString(36).slice(2, 8);
  if (shape !== 'diamond') {
    const pathStar = 'M12 2.3l2.9 5.9 6.5.9-4.7 4.5 1.1 6.4L12 17.8l-5.8 3.1 1.1-6.4L2.6 9.1l6.5-.9L12 2.3z';
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></linearGradient><clipPath id="${cid}"><rect x="0" y="0" width="${fillPct}%" height="100%"/></clipPath></defs><path d="${pathStar}" fill="#d0dbd5"></path><path d="${pathStar}" fill="url(#${gid})" clip-path="url(#${cid})"></path></svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" x2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></linearGradient><clipPath id="${cid}"><rect x="0" y="0" width="${fillPct}%" height="100%"/></clipPath></defs><path d="M12 2 L20.5 8.5 L12 22 L3.5 8.5 Z" fill="#cfe8ff"/><path d="M12 2 L20.5 8.5 L12 22 L3.5 8.5 Z" fill="url(#${gid})" clip-path="url(#${cid})"/><polygon points="6,8.5 9,4.7 12,4.7 9.6,8.5" fill="rgba(255,255,255,.35)"/><polygon points="12,4.7 15,4.7 18,8.5 14.4,8.5" fill="rgba(255,255,255,.25)"/><polygon points="6,8.5 9.6,8.5 12,12.2 8.4,12.2" fill="rgba(255,255,255,.18)"/><polygon points="18,8.5 14.4,8.5 12,12.2 15.6,12.2" fill="rgba(255,255,255,.12)"/><polygon points="9.6,8.5 14.4,8.5 12,12.2" fill="rgba(255,255,255,.22)"/><polygon points="8.4,12.2 12,22 12,12.2" fill="rgba(255,255,255,.2)"/><polygon points="15.6,12.2 12,22 12,12.2" fill="rgba(255,255,255,.16)"/><path d="M12 2 L20.5 8.5 L12 22 L3.5 8.5 Z" fill="none" stroke="rgba(255,255,255,.6)" stroke-width=".8"/><path d="M6 8.5 L9 4.7 L15 4.7 L18 8.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".7"/><path d="M6 8.5 L12 12.2 L18 8.5" fill="none" stroke="rgba(255,255,255,.45)" stroke-width=".7"/></svg>`;
}
function renderStars(count, tier) {
  const g = GROUPS.find(x => x.tier === tier) || GROUPS[0], shape = (tier === 'diamond') ? 'diamond' : 'star';
  const full = Math.floor(count), half = (count - full >= 0.5) ? 1 : 0, empty = 5 - full - half;
  const fullIcon = iconSVG(shape, 100, g.grad), halfIcon = iconSVG(shape, 50, g.grad), emptyIcon = iconSVG(shape, 0, g.grad);
  return `<span class="stars">${Array.from({ length: full }).map(() => fullIcon).join('')}${half ? halfIcon : ''}${Array.from({ length: empty }).map(() => emptyIcon).join('')}</span>`;
}

function drawDecile(users, ix) {
  const g = GROUPS[ix]; if (!g) { el.boardList.innerHTML = '<div class="desc">Hali ma’lumot yo‘q</div>'; return; }
  const arr = users.slice(0, 50), rows = [], pos = (rank) => g.end - rank + 1, starsFor = (rank) => 0.5 * pos(rank);
  for (let r = g.start; r <= g.end; r++) {
    const u = arr[r - 1]; if (!u) continue; const isTop3 = r <= 3;
    const left = isTop3 ? `<span class="medal ${r === 1 ? 'm1' : r === 2 ? 'm2' : 'm3'}">${r === 1 ? '🏆' : r === 2 ? '🥈' : '🥉'}</span>` : `<span class="rnk">#${r}</span>`;
    rows.push(`<div class="rank grad-border glass tier-${g.tier} ${isTop3 ? ('top-' + r) : ''}">
      <div>${left}</div>
      <div><b>${escapeHtml(u.name || 'Foydalanuvchi')}</b><div class="desc">${escapeHtml(u.region || '—')} · ${escapeHtml(u.district || '—')} · ${escapeHtml(u.school || '—')}</div></div>
      <div style="text-align:right"><div><b>${fmtPoints(u.points)}</b></div>${renderStars(starsFor(r), g.tier)}</div>
    </div>`);
  }
  el.boardList.innerHTML = `<div class="group grad-border glass">
    <div class="groupHead tier-${g.tier}"><span class="tier-badge">${g.label}</span><span class="legend">${renderStars(3, g.tier)}</span></div>
    <div class="groupBody">${rows.join('')}</div></div>`;
  el.decileInfo.textContent = g.label; el.decilePrev.disabled = (ix <= 0); el.decileNext.disabled = (ix >= GROUPS.length - 1);
}

// ---- Rank + stars to userbar (desktop) + mobile chips
const TIER_NAME = { diamond: 'Olmos', emerald: 'Zumrad', gold: 'Oltin', silver: 'Kumush', bronze: 'Bronza' };

function updateUserbarRank(sorted, currentUid) {
  const idx = sorted.findIndex(u => (u.uid || u.id || u.userId) === currentUid);
  if (idx === -1) { el.userTierStars.innerHTML = ''; el.userStarsPts.innerHTML = ''; el.urank.textContent = 'O‘rin: —'; el.utier.textContent = 'Daraja: —'; renderMobileUserChips(); return; }
  const rank = idx + 1; let g = null; for (const gr of GROUPS) { if (rank >= gr.start && rank <= gr.end) { g = gr; break; } }
  if (!g) { el.userTierStars.innerHTML = ''; el.userStarsPts.innerHTML = ''; el.urank.textContent = 'O‘rin: —'; el.utier.textContent = 'Daraja: —'; renderMobileUserChips({ rank }); return; }
  const stars = 0.5 * (g.end - rank + 1);
  const html = renderStars(stars, g.tier);
  el.userTierStars.innerHTML = html;   // ism yonida
  el.userStarsPts.innerHTML = html;    // ball chipida
  el.urank.textContent = `O‘rin: #${rank}`;
  el.utier.textContent = `Daraja: ${TIER_NAME[g.tier]} ${stars.toFixed(1)}/5`;

  // mobil chiplar
  renderMobileUserChips({
    school: CURRENT_PROFILE?.school || null,
    klass: CURRENT_PROFILE?.class || null,
    points: CURRENT_PROFILE?.points ?? null,
    rank,
    tier: g.tier
  });
}

// === MOBILE CHIPS ===
function renderMobileUserChips({ school, klass, points, rank, tier } = {}) {
  const host = el.mstats; if (!host) return;
  const chips = [];
  if (school) chips.push({ emoji: '🏫', text: String(school) });
  if (klass) chips.push({ emoji: '🎒', text: String(klass) });
  if (points != null) chips.push({ emoji: '⭐', text: (Number(points) || 0).toLocaleString('uz-UZ') });
  if (rank != null) chips.push({ emoji: '🏅', text: '#' + rank });
  if (tier) {
    const tn = TIER_NAME[tier] || tier;
    chips.push({ emoji: '💎', text: tn });
  }
  host.innerHTML = chips.map(c => `<span class="mchip"><span>${c.emoji}</span><span class="txt">${escapeHtml(c.text)}</span></span>`).join('');
}

// ---- Auth + profile/live listeners
let latestUsers = [], currentUserId = null, CURRENT_PROFILE = null;

PM.save.onclick = async () => {
  PM.err.textContent = '';
  const first = PM.first.value.trim(), last = PM.last.value.trim(),
    region = PM.region.value.trim(), district = PM.district.value.trim(),
    school = PM.school.value.trim(), klass = PM.klass.value.trim(), phone = PM.phone.value.trim();
  if (!first || !last || !region || !district || !school || !klass || !phone) { PM.err.textContent = 'Barcha maydonlar majburiy.'; return; }
  const name = `${first} ${last}`;
  try {
    const ref = doc(db, 'users', currentUserId);
    await setDoc(ref, { name, region, district, school, class: klass, phone }, { merge: true });
    el.uname.childNodes[0].nodeValue = name + ' ';
    el.uregion.textContent = 'Viloyat: ' + region; el.udistrict.textContent = 'Tuman: ' + district; el.uschool.textContent = 'Maktab: ' + school; el.uclass.textContent = 'Sinf: ' + klass;
    CURRENT_PROFILE = { ...(CURRENT_PROFILE || {}), name, region, district, school, class: klass, phone };
    localStorage.setItem(`lm-profile-seen:${currentUserId}`, '1'); renderMobileUserChips({
      school, klass, points: CURRENT_PROFILE?.points ?? null,
      rank: (el.urank.textContent.match(/#(\d+)/)?.[1]) || null,
      tier: (el.utier.textContent.toLowerCase().includes('olmos') && 'diamond') || null
    });
    closeProfileModal();
  } catch (e) { console.error('profile save error', e); PM.err.textContent = 'Saqlashda xatolik. Internetni tekshiring.'; }
};

el.signin.onclick = (e) => { e.preventDefault(); const ret = encodeURIComponent(location.pathname + location.search + location.hash); location.href = `./login.html?return=${ret}`; };
el.signout.onclick = async (e) => { e.preventDefault(); await signOut(auth); const ret = encodeURIComponent('./index.html'); location.href = `./login.html?return=${ret}`; };
el.editProfile.onclick = (e) => {
  e.preventDefault();
  const u = CURRENT_PROFILE || {};
  const nm = (u.name || el.uname.textContent).trim().split(/\s+/, 2);
  openProfileModal({
    first: nm[0] || '', last: nm[1] || '',
    region: u.region || '', district: u.district || '', school: u.school || '',
    klass: u.class || '', phone: u.phone || ''
  });
};

async function ensureUser(user) {
  const ref = doc(db, 'users', user.uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, { name: user.displayName || (user.email ? user.email.split('@')[0] : 'Foydalanuvchi'), email: user.email || null, photoURL: user.photoURL || null, role: 'user', numericId: Math.floor(1000 + Math.random() * 9000), points: 0, region: null, district: null, school: null, class: null, phone: null, createdAt: Date.now() });
    }
  });
  return (await getDoc(ref)).data();
}

watchAuth(async (user) => {
  if (!user) {
    el.uname.childNodes[0].nodeValue = 'Mehmon ';
    el.uid.textContent = 'ID: —'; el.uregion.textContent = 'Viloyat: —'; el.udistrict.textContent = 'Tuman: —'; el.uschool.textContent = 'Maktab: —'; el.uclass.textContent = 'Sinf: —';
    el.urank.textContent = 'O‘rin: —'; el.utier.textContent = 'Daraja: —'; el.points.textContent = 'Ball: —';
    el.ava.textContent = 'LM'; el.ava.style.backgroundImage = ''; el.signin.style.display = 'inline-flex'; el.signout.style.display = 'none'; el.editProfile.style.display = 'none';
    el.userTierStars.innerHTML = ''; el.userStarsPts.innerHTML = ''; currentUserId = null; CURRENT_PROFILE = null;
    renderMobileUserChips(); // clear
    if (isModalVisible()) closeProfileModal();
    return;
  }
  el.signin.style.display = 'none'; el.signout.style.display = 'inline'; currentUserId = user.uid;

  // live listener for own profile
  onSnapshot(doc(db, 'users', currentUserId), (snap) => {
    CURRENT_PROFILE = snap.exists() ? snap.data() : null;
    if (CURRENT_PROFILE?.class) el.uclass.textContent = 'Sinf: ' + CURRENT_PROFILE.class;
    // profil o'zgarsa mobil chiplarni yangilab turamiz
    renderMobileUserChips({
      school: CURRENT_PROFILE?.school || null,
      klass: CURRENT_PROFILE?.class || null,
      points: CURRENT_PROFILE?.points ?? null,
      rank: (el.urank.textContent.match(/#(\d+)/)?.[1]) ? Number(el.urank.textContent.match(/#(\d+)/)[1]) : null,
      tier: (el.utier.textContent.includes('Olmos') && 'diamond') ||
            (el.utier.textContent.includes('Zumrad') && 'emerald') ||
            (el.utier.textContent.includes('Oltin') && 'gold') ||
            (el.utier.textContent.includes('Kumush') && 'silver') ||
            (el.utier.textContent.includes('Bronza') && 'bronze') || null
    });
  });

  const u = await ensureUser(user);
  CURRENT_PROFILE = u;
  el.uname.childNodes[0].nodeValue = (u.name || user.displayName || (user.email?.split('@')[0] ?? 'Foydalanuvchi')) + ' ';
  el.uid.textContent = 'ID: ' + (u.numericId || '—');
  el.uregion.textContent = 'Viloyat: ' + (u.region || '—');
  el.udistrict.textContent = 'Tuman: ' + (u.district || '—');
  el.uschool.textContent = 'Maktab: ' + (u.school || '—');
  el.uclass.textContent = 'Sinf: ' + (u.class || '—');
  el.points.textContent = 'Ball: ' + fmtPoints(u.points);
  if (user.photoURL) { el.ava.innerHTML = '<img src="' + user.photoURL + '" alt="ava">'; } else { el.ava.textContent = initials(el.uname.textContent); }
  el.editProfile.style.display = 'inline';

  const seenKey = `lm-profile-seen:${currentUserId}`;
  if (!profileIsComplete(u) && !localStorage.getItem(seenKey)) {
    const nm = (u.name || '').trim().split(/\s+/, 2);
    openProfileModal({ first: nm[0] || '', last: nm[1] || '', region: u.region || '', district: u.district || '', school: u.school || '', klass: u.class || '', phone: u.phone || '' });
  } else { if (isModalVisible()) closeProfileModal(); }

  onSnapshot(query(collection(db, 'users'), orderBy('points', 'desc'), limit(100)), (snap) => {
    latestUsers = snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() }))
      .sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0) ? (Number(b.points) || 0) - (Number(a.points) || 0) : (a.numericId ?? 0) - (b.numericId ?? 0));
    drawDecile(latestUsers, CURRENT_DECILE);
    updateUserbarRank(latestUsers, currentUserId); // desktop + mobile chips ichida ham chaqiriladi
  }, (err) => {
    console.error('board error', err);
    el.boardList.innerHTML = '<div class="desc">Leaderboard hozircha yopiq</div>';
    el.userTierStars.innerHTML = ''; el.userStarsPts.innerHTML = ''; el.urank.textContent = 'O‘rin: —'; el.utier.textContent = 'Daraja: —';
    renderMobileUserChips(); // clear
  });
});

// Pager
document.getElementById('decilePrev').onclick = () => { if (CURRENT_DECILE > 0) { CURRENT_DECILE--; drawDecile(latestUsers, CURRENT_DECILE); } };
document.getElementById('decileNext').onclick = () => { if (CURRENT_DECILE < GROUPS.length - 1) { CURRENT_DECILE++; drawDecile(latestUsers, CURRENT_DECILE); } };
// --- USER MENU: avatar bosilganda popover ochish/yopish va kontent to‘ldirish
const userbar = document.getElementById('userbar');
const userMenu = document.getElementById('userMenu');

function buildUserMenu(){
  const name = (CURRENT_PROFILE?.name || el.uname.textContent || 'Foydalanuvchi').trim();
  const region = CURRENT_PROFILE?.region || '—';
  const district = CURRENT_PROFILE?.district || '—';
  const school = CURRENT_PROFILE?.school || '—';
  const klass = CURRENT_PROFILE?.class || '—';
  const uid = (el.uid.textContent || '').replace(/^ID:\s*/,'') || '—';

  userMenu.innerHTML = `
    <div class="um-head">
      <div class="um-ava">${(el.ava.querySelector('img')) ? '<img src="'+el.ava.querySelector('img').src+'" style="width:100%;height:100%;object-fit:cover" />' : (name.split(/\s+/).map(s=>s[0]).slice(0,2).join('') || 'LM')}</div>
      <div>
        <div class="um-name">${name}</div>
        <div class="um-sub">ID: ${uid}</div>
      </div>
    </div>

    <div class="um-grid">
      <div class="um-item"><b>Viloyat</b>${region}</div>
      <div class="um-item"><b>Tuman/Shahar</b>${district}</div>
      <div class="um-item"><b>Maktab</b>${school}</div>
      <div class="um-item"><b>Sinf</b>${klass}</div>
    </div>

    <div class="um-actions">
      <button id="umProfile" class="um-btn">📝 Profil</button>
      <button id="umLogout" class="um-btn ghost">↩️ Chiqish</button>
    </div>
  `;

  // Tugmalarni mavjud handlerlarga bog‘lash:
  const umProfile = document.getElementById('umProfile');
  const umLogout  = document.getElementById('umLogout');
  umProfile.onclick = (e)=>{ e.preventDefault(); el.editProfile.click(); closeUserMenu(); };
  umLogout.onclick  = (e)=>{ e.preventDefault(); el.signout.click(); closeUserMenu(); };
}

function openUserMenu(){
  buildUserMenu();
  userbar.classList.add('menu-open');
  userMenu.setAttribute('aria-hidden','false');
}
function closeUserMenu(){
  userbar.classList.remove('menu-open');
  userMenu.setAttribute('aria-hidden','true');
}
function toggleUserMenu(){
  if(userbar.classList.contains('menu-open')) closeUserMenu(); else openUserMenu();
}

// Avatar trigger
el.ava.addEventListener('click', (e)=>{ e.stopPropagation(); toggleUserMenu(); });

// Outside click to close
document.addEventListener('click', (e)=>{
  if(!userbar.classList.contains('menu-open')) return;
  if(!userMenu.contains(e.target) && e.target !== el.ava) closeUserMenu();
});

// ESC to close
window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeUserMenu(); });

// Auth snapshotlarda profil o‘zgarsa menyuni yangilaymiz
// (mavjud onSnapshot ichida renderMobileUserChips chaqirgan joydan keyin qo‘ying)

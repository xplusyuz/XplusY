import {
  auth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getSiteConfig,
  getHomeConfig,
  getProfile,
  getUserPoints,
} from "./firebase.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function toast(msg, type = "info", timeout = 3500) {
  const host = $("#toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = `<span class="t">${type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️"}</span><div>${msg}</div>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

let CURRENT_USER = null;
let PROFILE = null;
let USER_POINTS = 0;

function calcAge(iso) {
  try {
    const b = new Date(iso);
    const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  } catch {
    return "";
  }
}

function setVH() {
  document.documentElement.style.setProperty("--vh", `${innerHeight * 0.01}px`);
}
setVH();
addEventListener("resize", setVH);
addEventListener("orientationchange", setVH);

function updateTopGap() {
  const h = $("#hdr")?.getBoundingClientRect().height || 0;
  const c = $("#chipwrap")?.getBoundingClientRect().height || 0;
  document.documentElement.style.setProperty("--top-gap", h + c + "px");
}
addEventListener("load", updateTopGap);
document.fonts?.ready?.then?.(updateTopGap);

async function applySiteConfig() {
  const cfg = await getSiteConfig();

  $("#brand-title").innerHTML = (cfg.title || "LEADERMATH.UZ").toUpperCase();
  $("#brand-sub").textContent = cfg.subtitle || "Matematika platformasi";

  const logoImg = $("#brand-logo-img");
  if (cfg.logoUrl && logoImg) logoImg.src = cfg.logoUrl;

  const fav = $("#site-favicon");
  if (fav && cfg.faviconUrl) fav.href = cfg.faviconUrl;

  const metaTC = $("#meta-theme-color");
  if (metaTC && cfg.primaryColor) metaTC.content = cfg.primaryColor;

  const chipbar = $("#chipbar");
  chipbar.innerHTML = "";
  const chips = Array.isArray(cfg.chips) && cfg.chips.length
    ? cfg.chips
    : [{ id: "home", label: "Asosiy" }];

  chips.forEach((ch, i) => {
    const b = document.createElement("button");
    b.className = "chip" + (i === 0 ? " active" : "");
    b.dataset.id = ch.id || `sec${i}`;
    b.textContent = ch.label || ch.id || `Bo'lim ${i + 1}`;
    b.onclick = () => {
      activateSection(b.dataset.id);
      b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    };
    chipbar.appendChild(b);
  });

  $("#footer-content").innerHTML = cfg.footerHtml || "© 2025 LeaderMath.UZ";

  updateTopGap();
}

const HSTATE = { sections: [], activeId: null };
const ORDER = { active: 0, soon: 1, available: 2, ended: 3 };

const parseLocal = (s) => {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, Y, M, D, h, mn] = m;
  return new Date(+Y, +M - 1, +D, +h, +mn, 0, 0);
};
const fmt = (d) =>
  !d
    ? "-"
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`;

const cardState = (it) => {
  if (it.cardStyle === "soon") return "soon";
  if (it.cardStyle === "timed") {
    const now = new Date();
    const s = parseLocal(it.startAt);
    const e = parseLocal(it.endAt);
    if (s && now < s) return "soon";
    if (s && e && now >= s && now <= e) return "active";
    if (e && now > e) return "ended";
    return "active";
  }
  return "available";
};

const sortCards = (arr) =>
  [...arr].sort((a, b) => {
    const sa = cardState(a);
    const sb = cardState(b);
    const oa = ORDER[sa] ?? 9;
    const ob = ORDER[sb] ?? 9;
    if (oa !== ob) return oa - ob;
    const as = parseLocal(a.startAt)?.getTime() || 0;
    const bs = parseLocal(b.startAt)?.getTime() || 0;
    return as - bs;
  });

function renderFilters() {
  const w = document.createElement("div");
  w.className = "filters";
  const opts = [
    ["all", "Barchasi"],
    ["active", "Faol"],
    ["soon", "Yaqinda"],
    ["available", "Mavjud"],
    ["ended", "Tugagan"],
  ];
  const chips = opts.map(([k, label]) => {
    const b = document.createElement("button");
    b.className = "fchip" + (k === "all" ? " active" : "");
    b.dataset.f = k;
    b.textContent = label;
    b.onclick = () => {
      chips.forEach((x) => x.classList.toggle("active", x === b));
      w.onChange && w.onChange(k);
    };
    w.appendChild(b);
    return b;
  });
  w.onChange = null;
  return w;
}

const applyFilter = (grid, key) =>
  $$(".cardX", grid).forEach((c) => {
    const st = c.dataset.state || "available";
    c.style.display = key === "all" || st === key ? "flex" : "none";
  });

function cardView(it) {
  const c = document.createElement("div");
  c.className = "cardX";
  const st = cardState(it);
  c.dataset.state = st;

  const head = document.createElement("div");
  head.style.display = "flex";
  head.style.gap = "8px";
  head.style.alignItems = "center";
  const h = document.createElement("h4");
  h.textContent = it.title || "Card";
  head.appendChild(h);
  const bd = document.createElement("span");
  bd.className = "badge " + (st === "soon" ? "soon" : st === "ended" ? "ended" : "");
  bd.textContent =
    st === "soon" ? "Yaqinda" : st === "ended" ? "Tugagan" : st === "active" ? "Faol" : "Mavjud";
  head.appendChild(bd);
  c.appendChild(head);

  if (it.imageUrl) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.loading = "lazy";
    img.src = it.imageUrl;
    c.appendChild(img);
  }

  if (it.cardStyle === "timed") {
    const s = parseLocal(it.startAt);
    const e = parseLocal(it.endAt);
    const t = document.createElement("div");
    t.className = "mini";
    t.textContent = `Vaqt: ${fmt(s)} — ${fmt(e)}`;
    c.appendChild(t);
  }

  const act = document.createElement("div");
  act.style.display = "flex";
  act.style.gap = "8px";
  act.style.marginTop = "4px";

  const info = document.createElement("button");
  info.className = "btn";
  info.textContent = "ℹ️ Info";
  info.onclick = () =>
    showOverlay(
      `<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><b>${
        it.title || "Maʼlumot"
      }</b><button class="btn" onclick="closeOverlay()">Yopish</button></div><div style="height:1px;background:rgba(148,239,191,.4);margin:12px 0"></div>${
        it.infoHtml || '<p class="mini">Maʼlumot yo‘q.</p>'
      }</div>`
    );
  act.appendChild(info);

  const go = document.createElement("a");
  go.className = "btn primary";
  go.textContent = it.ctaLabel || "Boshlash";
  if (st === "active" && it.ctaHref) {
    go.href = it.ctaHref;
    go.target = "_blank";
  } else {
    go.classList.remove("primary");
    go.setAttribute("disabled", "");
  }
  act.appendChild(go);

  c.appendChild(act);
  return c;
}

function renderSection(sec) {
  const id = sec.id || "sec";
  const outer = document.createElement("section");
  outer.className = "section";
  outer.dataset.section = id;

  const hdr = document.createElement("div");
  hdr.className = "section-hdr";
  hdr.innerHTML = `<h3>${sec.title || id}</h3>`;
  outer.appendChild(hdr);

  const inner = document.createElement("div");
  inner.className = "inner";

  const cards = Array.isArray(sec.cards) ? sec.cards : [];
  if (cards.length) {
    const flt = renderFilters();
    inner.appendChild(flt);
    const grid = document.createElement("div");
    grid.className = "grid";
    sortCards(cards).forEach((x) => grid.appendChild(cardView(x)));
    inner.appendChild(grid);
    flt.onChange = (k) => applyFilter(grid, k);
  } else {
    inner.innerHTML = '<p class="mini">Kontent hali qo‘shilmagan.</p>';
  }

  outer.appendChild(inner);
  return outer;
}

async function loadHome() {
  const data = await getHomeConfig();
  HSTATE.sections = (Array.isArray(data.sections) ? data.sections : []).map((s, i) => ({
    id: s.id || `sec${i + 1}`,
    ...s,
  }));
  const host = $("#sections");
  host.innerHTML = "";
  HSTATE.sections.forEach((s) => host.appendChild(renderSection(s)));
  if (HSTATE.sections.length) activateSection(HSTATE.sections[0].id);
}

function activateSection(id) {
  HSTATE.activeId = id;
  $$(".chip").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
  $$("[data-section]").forEach(
    (s) => (s.style.display = s.dataset.section === id ? "block" : "none")
  );
}

const showOverlay = (html) => {
  const o = $("#overlay");
  o.innerHTML = html;
  o.classList.add("show");
  document.body.classList.add("no-scroll");
};
const closeOverlay = () => {
  const o = $("#overlay");
  o.classList.remove("show");
  o.innerHTML = "";
  document.body.classList.remove("no-scroll");
};
window.closeOverlay = closeOverlay;

function authLock() {
  if ($("#auth-lock")) return;
  const o = $("#overlay");
  o.classList.add("show");
  document.body.classList.add("no-scroll");
  o.innerHTML = `
    <div class="panel" id="auth-lock">
      <h2 style="margin:0 0 8px;font-size:18px;">Kirish</h2>
      <p class="mini">LeaderMath.UZ funksiyalaridan foydalanish uchun akkauntga kiring.</p>
      <div style="height:1px;background:rgba(148,239,191,.4);margin:12px 0"></div>
      <div style="display:grid;gap:8px;margin-bottom:12px;">
        <label class="mini">Email</label>
        <input id="eml" type="email" placeholder="email@example.com" style="padding:10px;border-radius:12px;border:1px solid rgba(148,163,184,.4);background:#020617;color:#e5e7eb;">
      </div>
      <div style="display:grid;gap:8px;margin-bottom:12px;">
        <label class="mini">Parol</label>
        <input id="pwd" type="password" placeholder="••••••••" style="padding:10px;border-radius:12px;border:1px solid rgba(148,163,184,.4);background:#020617;color:#e5e7eb;">
      </div>
      <div id="err" class="mini" style="color:#fecaca;margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="login" class="btn primary">Kirish</button>
        <button id="signup" class="btn">Ro'yxatdan o'tish</button>
        <button id="google" class="btn">Google</button>
      </div>
    </div>
  `;

  o.addEventListener(
    "click",
    async (e) => {
      const id = e.target.id;
      if (!id) return;
      const err = $("#err");
      const btns = $$("#auth-lock .btn");
      const busy = (b) => btns.forEach((x) => (x.disabled = b));
      try {
        busy(true);
        if (id === "google") {
          await signInWithPopup(auth, new GoogleAuthProvider());
        }
        if (id === "login") {
          const em = $("#eml").value.trim();
          const pw = $("#pwd").value;
          await signInWithEmailAndPassword(auth, em, pw);
        }
        if (id === "signup") {
          const em = $("#eml").value.trim();
          const pw = $("#pwd").value;
          await createUserWithEmailAndPassword(auth, em, pw);
        }
      } catch (e2) {
        err.textContent = e2?.message || String(e2);
      } finally {
        busy(false);
      }
    },
    { once: true }
  );
}

function renderUserChip(u, profileData) {
  const slot = $("#user-slot");
  const age = profileData?.birthDate ? calcAge(profileData.birthDate) : "";
  const name = profileData?.firstName
    ? profileData.firstName + (profileData.lastName ? " " + profileData.lastName : "")
    : u.displayName || u.email || "Foydalanuvchi";
  const avatar = profileData?.avatarUrl || u.photoURL || "";
  const role = profileData?.role || "—";

  slot.innerHTML = `
    <div class="userchip" id="userchip" aria-haspopup="menu" aria-expanded="false">
      <div class="avatar">${avatar ? `<img src="${avatar}" alt="">` : ""}</div>
      <div style="display:grid;line-height:1;">
        <b style="font-size:13px">${name}</b>
        <span class="mini">${role} • ${age ? age + " yosh • " : ""}${USER_POINTS} points</span>
      </div>
      <div class="menu" id="usermenu" role="menu">
        <a href="#" id="mTheme">🌗 Kun/Tun</a>
        <a href="#" id="mProfile">👤 Profil</a>
        <a href="#" id="mEdit">✏️ Profilni tahrirlash</a>
        <a href="#" id="mLogout">🚪 Chiqish</a>
      </div>
    </div>
  `;
}

function openUserMenu() {
  const chip = $("#userchip");
  const menu = $("#usermenu");
  if (!chip || !menu) return;
  ($("#portal-root") || document.body).appendChild(menu);
  menu.style.visibility = "hidden";
  menu.style.display = "block";
  const r = chip.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const gap = 8;
  let L = Math.min(Math.max(r.right - mw, 8), innerWidth - mw - 8);
  let T = r.bottom + gap;
  if (T + mh > innerHeight - 8) T = Math.max(8, r.top - gap - mh);
  menu.style.left = L + "px";
  menu.style.top = T + "px";
  menu.classList.add("open");
  menu.style.visibility = "visible";

  const closeOutside = (e) => {
    if (!menu.contains(e.target) && !chip.contains(e.target)) closeUserMenu();
  };
  const onRelayout = () => {
    const r2 = chip.getBoundingClientRect();
    let L2 = Math.min(Math.max(r2.right - mw, 8), innerWidth - mw - 8);
    let T2 = r2.bottom + gap;
    if (T2 + mh > innerHeight - 8) T2 = Math.max(8, r2.top - gap - mh);
    menu.style.left = L2 + "px";
    menu.style.top = T2 + "px";
  };
  menu._closers = { closeOutside, onRelayout };
  addEventListener("click", closeOutside, { capture: true });
  addEventListener("scroll", onRelayout, { passive: true });
  addEventListener("resize", onRelayout, { passive: true });
}
function closeUserMenu() {
  const menu = $("#usermenu");
  if (!menu) return;
  menu.classList.remove("open");
  menu.style.display = "none";
  if (menu._closers) {
    removeEventListener("click", menu._closers.closeOutside, { capture: true });
    removeEventListener("scroll", menu._closers.onRelayout);
    removeEventListener("resize", menu._closers.onRelayout);
    menu._closers = null;
  }
  const chip = $("#userchip");
  if (chip) chip.appendChild(menu);
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("#userchip")) {
    const open = $("#usermenu")?.classList.contains("open");
    open ? closeUserMenu() : openUserMenu();
  }
  if (t.closest("#mLogout")) {
    e.preventDefault();
    closeUserMenu();
    signOut(auth);
  }
  if (t.closest("#mTheme")) {
    e.preventDefault();
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("lm_theme", next);
  }
});

onAuthStateChanged(auth, async (u) => {
  CURRENT_USER = u || null;
  if (!u) {
    $("#app").hidden = true;
    $("#user-slot").innerHTML = "";
    authLock();
    return;
  }
  $("#app").hidden = false;

  PROFILE = await getProfile(u.uid);
  USER_POINTS = await getUserPoints(u.uid);
  renderUserChip(u, PROFILE || {});
});

async function boot() {
  await applySiteConfig();
  await loadHome();

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (!localStorage.getItem("sw_installed")) {
        toast("Offline rejim yoqildi ✅", "success");
        localStorage.setItem("sw_installed", "1");
      }
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            toast("Yangi versiya tayyor. Sahifani yangilang.", "info");
          }
        });
      });
    } catch (e) {
      console.warn(e);
    }
  }
}

boot().catch((e) => console.error(e));

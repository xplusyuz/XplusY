const API = "/api";
const $ = (id) => document.getElementById(id);

const state = {
  token: localStorage.getItem("lm_token") || "",
  idDraft: "",
  app: null,
  activeNav: null,
  activeChip: "all",
};

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Xatolik");
  return data;
}

function showStep(step) {
  $("stepId").hidden = step !== "id";
  $("stepPw").hidden = step !== "pw";
  $("stepCreate").hidden = step !== "create";
}

function openProfileModal(open) {
  $("profileModal").setAttribute("aria-hidden", open ? "false" : "true");
}

function setUserChip(me) {
  $("userChip").hidden = false;
  $("uHello").textContent = (`Salom! ${me?.profile?.firstName || ""}`).trim() || "Salom!";
  $("uId").textContent = me.id;
  $("uPts").textContent = `${me.points || 0} pt`;
  $("uAge").textContent = (me.age == null) ? "—" : `${me.age} yosh`;
  const av = $("uAvatar");
  av.src = me.avatarUrl || "";
  av.alt = me.id;
}

async function ensureMeAndProfile() {
  const me = await api("/me");
  setUserChip(me);
  if (!me.profileCompleted) {
    await loadRegions();
    openProfileModal(true);
  } else {
    openProfileModal(false);
    await loadApp();
  }
}

async function loadRegions() {
  const r = await fetch("region.json").then(x => x.json());
  const regSel = $("pfRegion");
  regSel.innerHTML = `<option value="">Tanlang</option>` + Object.keys(r).map(k => `<option>${k}</option>`).join("");
  function fillDistrict() {
    const v = regSel.value;
    const dSel = $("pfDistrict");
    const arr = r[v] || [];
    dSel.innerHTML = `<option value="">Tanlang</option>` + arr.map(x => `<option>${x}</option>`).join("");
  }
  regSel.onchange = fillDistrict;
  fillDistrict();
}

function renderBottomNav(nav) {
  const el = $("bottomNav");
  el.hidden = false;
  el.innerHTML = "";
  nav.forEach((n, idx) => {
    const b = document.createElement("button");
    b.className = "navBtn";
    b.innerHTML = `<div class="i">${n.icon || "✨"}</div><div class="t">${n.label || n.id}</div>`;
    b.onclick = () => activateNav(n.id);
    el.appendChild(b);
    if (idx === 0) state.activeNav = n.id;
  });
}

function setActiveNavBtn(activeId) {
  document.querySelectorAll(".navBtn").forEach((b, i) => {
    const nav = state.app.nav[i];
    b.classList.toggle("active", nav.id === activeId);
  });
}

function renderChips(section) {
  const el = $("chips");
  const chips = section.chips?.length ? section.chips : [{ id: "all", label: "Hammasi" }];
  el.innerHTML = "";
  chips.forEach(c => {
    const b = document.createElement("button");
    b.className = "chip" + (c.id === state.activeChip ? " active" : "");
    b.textContent = c.label;
    b.onclick = () => {
      state.activeChip = c.id;
      renderChips(section);
      renderFeed(section);
    };
    el.appendChild(b);
  });
}

function renderFeed(section) {
  const el = $("feed");
  el.innerHTML = "";
  const items = (section.items || []).filter(it => state.activeChip === "all" ? true : it.chipId === state.activeChip);

  items.forEach(it => {
    const card = document.createElement("div");
    card.className = "item";
    const img = it.imageUrl ? `<img class="itemImg" src="${it.imageUrl}" alt="">` : "";
    const sub = it.subtitle ? `<div class="itemSub">${it.subtitle}</div>` : "";
    card.innerHTML = `
      ${img}
      <div class="itemBody">
        <div class="itemTitle">${it.title || ""}</div>
        ${sub}
        ${it.href ? `<a class="itemBtn" href="${it.href}">Ochish →</a>` : ``}
      </div>
    `;
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x * 6}deg) rotateX(${y * -6}deg) translateZ(0)`;
    });
    card.addEventListener("mouseleave", () => (card.style.transform = "translateZ(0)"));
    el.appendChild(card);
  });
}

async function loadApp() {
  $("authCard").hidden = true;
  $("content").hidden = false;

  const cache = JSON.parse(localStorage.getItem("lm_app_cache") || "null");
  const remote = await api("/app");
  if (cache && cache.version === remote.version) {
    state.app = cache;
  } else {
    state.app = remote;
    localStorage.setItem("lm_app_cache", JSON.stringify(remote));
  }

  renderBottomNav(state.app.nav || []);
  const first = state.app.nav?.[0];
  if (first) activateNav(first.id);
}

function activateNav(navId) {
  state.activeNav = navId;
  setActiveNavBtn(navId);

  const n = (state.app.nav || []).find(x => x.id === navId);
  const sec = state.app.sections[n.sectionId];
  state.activeChip = "all";
  renderChips(sec);
  renderFeed(sec);
}

async function openRank(open) {
  const panel = $("rankPanel");
  panel.classList.toggle("open", open);
  if (open) {
    const data = await api("/rank");
    const el = $("rankList");
    el.innerHTML = data.items.map(u => `
      <div class="rankRow">
        <div class="rankPlace">${u.place}</div>
        <img class="rankAv" src="${u.avatarUrl || ""}" alt="">
        <div>
          <div class="rankName">${u.name || u.id}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.65)">${u.id}</div>
        </div>
        <div class="rankPts">${u.points} pt</div>
      </div>
    `).join("");
  }
}

function bindUI() {
  $("btnStart").onclick = async () => {
    const id = $("loginId").value.trim().toUpperCase();
    if (!id) return;
    const s = await api("/auth/login-step1", { method: "POST", body: JSON.stringify({ id }) });
    if (!s.exists) {
      $("loginErr").hidden = false;
      $("loginErr").textContent = "Bunday ID topilmadi. “Men yangiman” ni bosing.";
      return;
    }
    state.idDraft = id;
    $("pillId").textContent = id;
    $("loginErr").hidden = true;
    showStep("pw");
    $("loginPw").focus();
  };

  $("btnBack").onclick = () => showStep("id");

  $("btnLogin").onclick = async () => {
    $("loginErr").hidden = true;
    try {
      const token = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ id: state.idDraft, password: $("loginPw").value })
      });
      state.token = token.token;
      localStorage.setItem("lm_token", state.token);
      await ensureMeAndProfile();
    } catch (e) {
      $("loginErr").hidden = false;
      $("loginErr").textContent = e.message;
    }
  };

  $("btnNew").onclick = () => {
    showStep("create");
    $("pwWarn").hidden = true;
  };

  $("btnCreate").onclick = async () => {
    $("pwWarn").hidden = true;
    try {
      const pw = $("newPw").value || "";
      const r = await api("/auth/new", { method: "POST", body: JSON.stringify({ password: pw }) });
      state.token = r.token;
      localStorage.setItem("lm_token", state.token);

      const msgs = [];
      msgs.push(`✅ Yangi ID: ${r.id}`);
      if (r.warnings?.length) msgs.push("⚠️ " + r.warnings.join(" "));
      $("pwWarn").hidden = false;
      $("pwWarn").textContent = msgs.join("\n");

      await ensureMeAndProfile();
    } catch (e) {
      $("pwWarn").hidden = false;
      $("pwWarn").textContent = e.message;
    }
  };

  $("btnSaveProfile").onclick = async () => {
    $("profileErr").hidden = true;
    try {
      await api("/me/profile", {
        method: "POST",
        body: JSON.stringify({
          firstName: $("pfFirst").value,
          lastName: $("pfLast").value,
          birthDate: $("pfBirth").value,
          region: $("pfRegion").value,
          district: $("pfDistrict").value
        })
      });
      openProfileModal(false);
      await loadApp();
    } catch (e) {
      $("profileErr").hidden = false;
      $("profileErr").textContent = e.message;
    }
  };

  $("rankTab").onclick = () => openRank(true);
  $("rankClose").onclick = () => openRank(false);
}

(async function boot() {
  bindUI();
  if (state.token) {
    try {
      await ensureMeAndProfile();
    } catch {
      localStorage.removeItem("lm_token");
      state.token = "";
      showStep("id");
    }
  } else {
    showStep("id");
  }
})();
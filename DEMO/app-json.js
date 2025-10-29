// app-json.js — reads from ./JSON/home.json
const state = { cms: null, secIndex: 0, bannerIndex: 0, bannerTimer: null, bannerSpeed: 3500 };
const $ = (q, root = document) => root.querySelector(q);

document.getElementById("toggleTheme").onclick = () => {
  document.documentElement.classList.toggle("dark");
};

window.addEventListener("DOMContentLoaded", async () => {
  await loadCMS();
});

async function loadCMS() {
  try {
    const res = await fetch("./JSON/home.json", { cache: "no-store" });
    state.cms = await res.json();
    renderAll();
  } catch (e) {
    console.error("home.json o'qishda xato:", e);
    alert("home.json topilmadi yoki xato.");
  }
}

function renderAll() {
  renderBigChips();
  renderModChips();
  renderBanners();
  renderCards();
}

function renderBigChips() {
  const el = document.getElementById("bigChips");
  el.innerHTML = "";
  (state.cms.sections || []).forEach((s, idx) => {
    const a = document.createElement("button");
    a.className = "big-chip" + (idx === state.secIndex ? " active" : "");
    a.innerHTML = `<span class="dot"></span>${s.title}`;
    a.onclick = () => { state.secIndex = idx; renderAll(); };
    el.appendChild(a);
  });
}

function renderModChips() {
  const box = document.getElementById("modChips");
  box.innerHTML = "";
  const sec = state.cms.sections[state.secIndex];
  (sec.modChips || []).forEach((ch) => {
    const b = document.createElement("button");
    b.className = "mod-chip";
    b.textContent = ch.label;
    b.onclick = () => openHtml(ch.htmlId, ch.label);
    box.appendChild(b);
  });
}

function renderBanners() {
  const track = document.getElementById("bannerTrack");
  const prog = document.getElementById("bannerProgress");
  const sec = state.cms.sections[state.secIndex];
  track.innerHTML = "";
  prog.innerHTML = "";

  (sec.banners || []).forEach((b) => {
    const slide = document.createElement("div");
    slide.className = "banner";
    const snip = findHtml(b.htmlId);
    if (snip) {
      const div = document.createElement("div");
      div.className = "html";
      div.innerHTML = snip.html;
      slide.appendChild(div);
    }
    track.appendChild(slide);

    const p = document.createElement("div");
    const bar = document.createElement("i");
    p.appendChild(bar);
    prog.appendChild(p);
  });

  state.bannerIndex = 0;
  updateBannerUI();
  startBannerAuto();

  document.getElementById("prevBanner").onclick = () => moveBanner(-1);
  document.getElementById("nextBanner").onclick = () => moveBanner(+1);
}

function startBannerAuto() {
  stopBannerAuto();
  state.bannerTimer = setInterval(() => moveBanner(+1), state.bannerSpeed);
  updateBannerUI();
}
function stopBannerAuto() {
  if (state.bannerTimer) clearInterval(state.bannerTimer);
  state.bannerTimer = null;
}
function moveBanner(d) {
  const sec = state.cms.sections[state.secIndex];
  if ((sec.banners || []).length === 0) return;
  state.bannerIndex = (state.bannerIndex + d + sec.banners.length) % sec.banners.length;
  updateBannerUI();
}
function updateBannerUI() {
  const sec = state.cms.sections[state.secIndex];
  const track = document.getElementById("bannerTrack");
  track.style.transform = `translateX(-${state.bannerIndex * 100}%)`;

  const bars = [...document.querySelectorAll("#bannerProgress i")];
  bars.forEach((i, idx) => {
    i.style.width = idx < state.bannerIndex ? "100%" : "0%";
    i.style.transition = "none";
  });
  requestAnimationFrame(() => {
    const cur = bars[state.bannerIndex];
    if (cur) {
      cur.style.transition = `width ${state.bannerSpeed - 300}ms linear`;
      cur.style.width = "100%";
    }
  });
}

function renderCards() {
  const grid = document.getElementById("cards");
  grid.innerHTML = "";
  const sec = state.cms.sections[state.secIndex];

  const sticky = createCard({
    id: "sticky.info",
    title: "Doimiy card",
    img: "",
    soon: false,
    buttons: [{ label: "Qo‘llanma", type: "modal", htmlId: "html.qollanma" }],
  });
  sticky.classList.add("sticky-card");
  grid.appendChild(sticky);

  (sec.cards || []).forEach((c) => grid.appendChild(createCard(c)));
}

function createCard(c) {
  const card = document.createElement("div");
  card.className = "card";

  const media = document.createElement("div");
  media.className = "media";
  if (c.img) {
    media.classList.add("has-img");
    media.innerHTML = `<img src="${c.img}" alt="${c.title}">`;
  } else {
    media.innerHTML = `<div class='title-big'>${c.title}</div>`;
  }
  if (c.soon) media.insertAdjacentHTML("beforeend", `<div class='badge-soon'>Tez kunda</div>`);

  const body = document.createElement("div");
  body.className = "body";
  const h = document.createElement("div");
  h.style.fontWeight = "700";
  h.style.marginBottom = "8px";
  h.textContent = c.title;
  body.appendChild(h);

  const btns = document.createElement("div");
  btns.className = "btns";
  (c.buttons || []).forEach((b) => {
    const k = document.createElement("button");
    k.className = "btn-ghost" + (b.type === "modal" ? " modal" : "");
    k.textContent = b.label;
    if (b.type === "link") k.onclick = () => (location.href = b.href || "#");
    else if (b.type === "modal") k.onclick = () => openHtml(b.htmlId, b.label);
    btns.appendChild(k);
  });
  body.appendChild(btns);
  card.append(media, body);
  return card;
}

function openHtml(htmlId, title = "Modal") {
  const snip = findHtml(htmlId);
  if (!snip) return;
  const m = document.getElementById("htmlModal");
  document.getElementById("modalTitle").textContent = snip.title || title;
  const div = document.getElementById("modalHtml");
  div.innerHTML = snip.html;
  m.showModal();
}

function findHtml(id) {
  return (state.cms.htmlSnippets || []).find((x) => x.id === id);
}
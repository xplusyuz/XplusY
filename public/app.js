import { auth } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const els = {
  userName: document.getElementById("userName"),
  userSmall: document.getElementById("userSmall"),
  avatar: document.getElementById("avatar"),
  btnGoogle: document.getElementById("btnGoogle"),
  btnLogout: document.getElementById("btnLogout"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  q: document.getElementById("q"),
  sort: document.getElementById("sort"),
  btnReload: document.getElementById("btnReload"),
  tgNotice: document.getElementById("tgNotice"),
  authCard: document.getElementById("authCard"),

  // new UI
  favViewBtn: document.getElementById("favViewBtn"),
  cartBtn: document.getElementById("cartBtn"),
  favCount: document.getElementById("favCount"),
  cartCount: document.getElementById("cartCount"),

  overlay: document.getElementById("overlay"),
  sidePanel: document.getElementById("sidePanel"),
  panelTitle: document.getElementById("panelTitle"),
  panelClose: document.getElementById("panelClose"),
  panelList: document.getElementById("panelList"),
  panelEmpty: document.getElementById("panelEmpty"),
  panelBottom: document.getElementById("panelBottom"),
  totalRow: document.getElementById("totalRow"),
  cartTotal: document.getElementById("cartTotal"),
  checkoutBtn: document.getElementById("checkoutBtn"),
  clearBtn: document.getElementById("clearBtn"),

  // image viewer (gallery)
  imgViewer: document.getElementById("imgViewer"),
  imgViewerBackdrop: document.getElementById("imgViewerBackdrop"),
  // Title is hidden; we show product name in the old description style
  imgViewerTitle: document.getElementById("imgViewerTitle"),
  imgViewerName: document.getElementById("imgViewerName"),
  imgViewerDesc: document.getElementById("imgViewerDesc"),
  imgViewerImg: document.getElementById("imgViewerImg"),
  imgViewerClose: document.getElementById("imgViewerClose"),
  imgPrev: document.getElementById("imgPrev"),
  imgNext: document.getElementById("imgNext"),
  imgThumbs: document.getElementById("imgThumbs"),

  // reviews
  revScore: document.getElementById("revScore"),
  revCount: document.getElementById("revCount"),
  revStars: document.getElementById("revStars"),
  revText: document.getElementById("revText"),
  revSend: document.getElementById("revSend"),
  revList: document.getElementById("revList"),

  // viewer actions
  viewerCart: document.getElementById("viewerCart"),
  viewerBuy: document.getElementById("viewerBuy"),
};

let products = [];

const LS = {
  favs: "om_favs",
  cart: "om_cart",
  reviews: "om_reviews_v1"
};

// ---------------- Reviews (local, per-product) ----------------
function loadReviewsMap(){
  return loadLS(LS.reviews, {});
}
function saveReviewsMap(map){
  saveLS(LS.reviews, map);
}
function getReviews(productId){
  const map = loadReviewsMap();
  const list = Array.isArray(map[productId]) ? map[productId] : [];
  // newest first
  return list.slice().sort((a,b)=> (b?.ts||0) - (a?.ts||0));
}
function addReview(productId, stars, text){
  const map = loadReviewsMap();
  const list = Array.isArray(map[productId]) ? map[productId] : [];
  const author = (els.userName?.textContent || els.userSmall?.textContent || "Mehmon").trim() || "Mehmon";
  list.push({ stars, text, author, ts: Date.now() });
  map[productId] = list;
  saveReviewsMap(map);
}
function reviewStats(productId){
  const list = getReviews(productId);
  if(!list.length) return { avg: null, count: 0 };
  const sum = list.reduce((s,r)=> s + (Number(r.stars)||0), 0);
  return { avg: sum / list.length, count: list.length };
}
// Variant selections per product (in-memory)
const selected = new Map(); // id -> {color, size, imgIdx}

// Image viewer state
let viewer = { open:false, productId:null, title:"", desc:"", images:[], idx:0, onSelect:null };

function normColors(p){
  const arr = p.colors || p.colorOptions || [];
  return arr.map(c=>{
    if(typeof c === "string") return {name:c, hex:null};
    return {name: c.name || c.label || "Color", hex: c.hex || c.color || null};
  });
}
function normSizes(p){
  const arr = p.sizes || p.sizeOptions || [];
  return arr.map(s=> typeof s === "string" ? s : (s.label||s.name||""));
}
function getDefaultSel(p){
  const colors = normColors(p);
  const sizes = normSizes(p);
  return {
    color: colors[0]?.name || null,
    size: sizes[0] || null,
    imgIdx: 0,
  };
}
function getSel(p){
  if(selected.has(p.id)) return selected.get(p.id);
  const d = getDefaultSel(p);
  selected.set(p.id, d);
  return d;
}

// --- Images (multi-image + variant-dependent) ---
// Supported JSON formats:
// 1) images: [url1, url2, ...]                         (generic)
// 2) images: { "Gold": [...], "Black": [...] }          (per color)
// 3) imagesByColor: { "Gold": [...], ... }               (per color)
// 4) image: "url"                                       (legacy fallback)
function normImages(p, sel){
  const color = sel?.color || "";

  // explicit imagesByColor
  if(p && p.imagesByColor && typeof p.imagesByColor === "object"){
    const arr = p.imagesByColor[color] || p.imagesByColor[color?.toLowerCase?.()] || null;
    if(Array.isArray(arr) && arr.length) return arr;
  }

  // images can be array or map
  if(Array.isArray(p?.images) && p.images.length) return p.images;
  if(p && p.images && typeof p.images === "object"){
    const arr = p.images[color] || p.images[color?.toLowerCase?.()] || null;
    if(Array.isArray(arr) && arr.length) return arr;
    // if object but no matching key, try any first array
    const firstKey = Object.keys(p.images).find(k=>Array.isArray(p.images[k]) && p.images[k].length);
    if(firstKey) return p.images[firstKey];
  }

  // legacy
  if(p?.image) return [p.image];
  return [];
}

function getCurrentImage(p, sel){
  const imgs = normImages(p, sel);
  if(!imgs.length) return "";
  const idx = Math.max(0, Math.min(sel?.imgIdx ?? 0, imgs.length-1));
  return imgs[idx] || imgs[0];
}

function setImageIndex(p, idx){
  const sel = getSel(p);
  const imgs = normImages(p, sel);
  if(!imgs.length) return;
  sel.imgIdx = Math.max(0, Math.min(idx, imgs.length-1));
  selected.set(p.id, sel);
}
function variantKey(id, sel){
  const c = sel?.color || "";
  const s = sel?.size || "";
  return `${id}::${c}::${s}`;
}

function getImagesFor(p, sel){
  // Supports:
  // 1) imagesByColor: {"Gold": [..], "Black": [..]}
  // 2) images: object map (same as above)
  // 3) images: array
  // 4) image: single string
  const color = sel?.color || null;
  const byColor = p.imagesByColor || null;
  if(byColor && color && Array.isArray(byColor[color]) && byColor[color].length){
    return byColor[color].filter(Boolean);
  }
  if(p.images && !Array.isArray(p.images) && typeof p.images === "object"){
    if(color && Array.isArray(p.images[color]) && p.images[color].length) return p.images[color].filter(Boolean);
    // fallback: first key
    const k = Object.keys(p.images)[0];
    if(k && Array.isArray(p.images[k])) return p.images[k].filter(Boolean);
  }
  if(Array.isArray(p.images) && p.images.length) return p.images.filter(Boolean);
  if(p.image) return [p.image];
  return [];
}

function clampIdx(i, n){
  if(!n) return 0;
  const x = i % n;
  return x < 0 ? x + n : x;
}

function setCardImage(imgEl, p, sel){
  const imgs = getImagesFor(p, sel);
  const idx = clampIdx(sel?.imgIdx || 0, imgs.length);
  if(imgs.length){
    imgEl.src = imgs[idx];
  }
}


function loadLS(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
  catch{ return fallback; }
}
function saveLS(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

let viewMode = "all"; // all | fav
let favs = new Set(loadLS(LS.favs, []));
let cart = loadLS(LS.cart, []);
// migrate legacy cart items: {id,qty} -> {key,id,color,size,qty}
cart = (cart||[]).map(x=>{
  if(x && x.key) return x;
  const id = x?.id;
  const qty = x?.qty ?? 1;
  const key = `${id}::::`;
  return {key, id, color:null, size:null, qty, image:null};
}); // [{id, qty}]


function showTgNotice(msg){
  if(!els.tgNotice) return;
  els.tgNotice.hidden = !msg;
  els.tgNotice.textContent = msg || "";
}

function moneyUZS(n){
  const x = typeof n === "number" && Number.isFinite(n) ? n : parsePrice(n);
  try { return new Intl.NumberFormat("uz-UZ").format(x) + " so‘m"; }
  catch { return `${x} UZS`; }
}

// Accept numbers or strings like: "349 000", "349,000 so'm", "349000 UZS"
function parsePrice(v){
  if(typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = (v ?? "").toString();
  // Keep digits only
  const digits = s.replace(/[^0-9]/g, "");
  if(!digits) return 0;
  // Guard against extremely large values (accidental)
  const n = parseInt(digits.slice(0, 12), 10);
  return Number.isFinite(n) ? n : 0;
}
function norm(s){ return (s ?? "").toString().toLowerCase().trim(); }

function applyFilterSort(){
  const query = norm(els.q.value);
  let arr = [...products];

  if(viewMode === "fav"){
    arr = arr.filter(p=>favs.has(p.id));
  }

  if(query){
    arr = arr.filter(p=>{
      const hay = `${p.name} ${(p.tags||[]).join(" ")}`.toLowerCase();
      return hay.includes(query);
    });
  }

  const sort = els.sort.value;
  if(sort === "price_asc") arr.sort((a,b)=>(a._price||0)-(b._price||0));
  if(sort === "price_desc") arr.sort((a,b)=>(b._price||0)-(a._price||0));
  if(sort === "new") arr.sort((a,b)=> (b._created||0) - (a._created||0));
  if(sort === "popular") arr.sort((a,b)=>(b.popularScore||0)-(a.popularScore||0));

  render(arr);
}


function renderOptions(p){
  const colors = normColors(p);
  const sizes = normSizes(p);
  if(colors.length===0 && sizes.length===0) return "";
  const sel = getSel(p);

  const sw = colors.length ? `
    <div class="swatches" aria-label="Rang">
      ${colors.map(c=>{
        const active = (sel.color===c.name) ? "active" : "";
        const style = c.hex ? `style="--c:${c.hex}"` : "";
        return `<button class="swatch ${active}" ${style} data-c="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}"></button>`;
      }).join("")}
    </div>` : "";

  const sz = sizes.length ? `
    <div class="sizes" aria-label="O'lcham">
      ${sizes.map(s=>{
        const active = (sel.size===s) ? "active" : "";
        return `<button class="sizeChip ${active}" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
      }).join("")}
    </div>` : "";

  return `<div class="optRow">${sw}${sz}</div>`;
}

function escapeHtml(str){
  return String(str||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

function render(arr){
  els.grid.innerHTML = "";
  els.empty.hidden = arr.length !== 0;

  for(const p of arr){
    const card = document.createElement("div");
    card.className = "pcard";

    const isFav = favs.has(p.id);

    const sel = getSel(p);
    const currentImg = getCurrentImage(p, sel);

    const localStats = reviewStats(p.id);
    const showAvg = localStats.count ? localStats.avg : (p.rating ? Number(p.rating) : null);
    const showCount = localStats.count ? localStats.count : Number(p.reviewsCount||0);

    card.innerHTML = `
      <div class="pmedia">
        <img class="pimg" src="${currentImg || ""}" alt="${escapeHtml(p.name || "product")}" loading="lazy"/>
        ${p.badge ? `<div class="pbadge">${escapeHtml(p.badge)}</div>` : ``}
        <button class="favBtn ${isFav ? "active" : ""}" title="Sevimli">${isFav ? "♥" : "♡"}</button>
      </div>

      <div class="pbody uz">
        <div class="ppriceRow">
          <div class="ppriceNow">${moneyUZS(p.price || 0)}</div>
          ${p.oldPrice ? `<div class="ppriceOld">${moneyUZS(p.oldPrice)}</div>` : ``}
        </div>

        ${p.installmentText ? `<div class="pinstall">${escapeHtml(p.installmentText)}</div>` : ``}

        <div class="pname clamp2">${escapeHtml(p.name || "Nomsiz")}</div>

        ${p.subtitle ? `<div class="psub">${escapeHtml(p.subtitle)}</div>` : (p.description ? `<div class="psub">${escapeHtml(String(p.description).split(/[.\n]/)[0])}</div>` : ``)}

        ${(showAvg ? `<div class="prating">⭐ ${Number(showAvg).toFixed(1)} <span>(${showCount} sharhlar)</span></div>` : ``)}

        ${renderOptions(p)}

        <div class="pactions">
          <button class="iconPill" data-act="buy" title="Bir zumda">⚡</button>
          <button class="iconPill primary" data-act="cart" title="Savatchaga" aria-label="Savatchaga">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM7.17 14h9.66c.75 0 1.4-.41 1.74-1.03L21 6H6.21L5.27 4H2v2h2l3.6 7.59-1.35 2.44C5.52 17.37 6.48 19 8 19h12v-2H8l1.17-3Z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    const favBtn = card.querySelector(".favBtn");
    favBtn.addEventListener("click", ()=>{
      if(favs.has(p.id)) favs.delete(p.id); else favs.add(p.id);
      saveLS(LS.favs, Array.from(favs));
      favBtn.classList.toggle("active", favs.has(p.id));
      updateBadges();
      if(viewMode === "fav") applyFilterSort();
    });


    const imgEl = card.querySelector(".pimg");

    // Open fullscreen viewer on image click
    imgEl.addEventListener("click", ()=>{
      const imgs = getImagesFor(p, getSel(p));
      if(!imgs.length) return;
      openImageViewer({
        productId: p.id,
        title: p.name || "Rasm",
        desc: p.description || p.desc || "",
        images: imgs,
        startIndex: getSel(p).imgIdx || 0,
        onSelect: (i)=>{
          setImageIndex(p, i);
          setCardImage(imgEl, p, getSel(p));
        }
      });
    });

    // Variant option listeners
    card.querySelectorAll(".swatch").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        sel.color = btn.getAttribute("data-c");
        sel.imgIdx = 0; // reset to first image for this color
        selected.set(p.id, sel);
        setCardImage(imgEl, p, sel);
        // update active
        card.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("active", b===btn));
      });
    });
    card.querySelectorAll(".sizeChip").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        sel.size = btn.getAttribute("data-s");
        selected.set(p.id, sel);
        card.querySelectorAll(".sizeChip").forEach(b=>b.classList.toggle("active", b===btn));
      });
    });

    card.querySelector('[data-act="cart"]').addEventListener("click", ()=>{
      addToCart(p.id, 1, getSel(p));
      openPanel("cart");
    });

    card.querySelector('[data-act="buy"]').addEventListener("click", ()=>{
      // quick order: add 1 and open panel
      addToCart(p.id, 1, getSel(p));
      openPanel("cart");
    });

    els.grid.appendChild(card);
  }
}


function addToCart(id, qty, sel){
  const key = variantKey(id, sel || {color:null,size:null});
  const p = products.find(x=>x.id===id);
  const img = p ? getCurrentImage(p, sel || getDefaultSel(p)) : null;
  const item = cart.find(x=>x.key===key);
  if(item){
    item.qty += qty;
    // keep latest selected image for this variant
    if(img) item.image = img;
  } else {
    cart.push({key, id, color: sel?.color || null, size: sel?.size || null, qty, image: img || null});
  }
  cart = cart.filter(x=>x.qty>0);
  saveLS(LS.cart, cart);
  updateBadges();
}

function cartCount(){
  return cart.reduce((s,x)=>s + (x.qty||0), 0);
}

function updateBadges(){
  if(els.favCount) els.favCount.textContent = String(favs.size);
  if(els.cartCount) els.cartCount.textContent = String(cartCount());
}

function openPanel(mode){
  if(!els.sidePanel || !els.overlay) return;
  // bottom controls exist for both, but differ
  els.panelBottom.style.display = "";
  const isCart = (mode === "cart");
  if(els.totalRow) els.totalRow.style.display = isCart ? "" : "none";
  if(els.checkoutBtn) els.checkoutBtn.style.display = isCart ? "" : "none";
  if(els.clearBtn) els.clearBtn.textContent = isCart ? "Tozalash" : "Sevimlilarni tozalash";
  els.panelTitle.textContent = isCart ? "Savatcha" : "Sevimlilar";
  renderPanel(mode);

  // show + animate
  els.overlay.hidden = false;
  els.sidePanel.hidden = false;
  requestAnimationFrame(()=>{
    els.overlay.classList.add("open");
    els.sidePanel.classList.add("open");
  });
}

function closePanel(){
  if(!els.sidePanel || !els.overlay) return;

  els.overlay.classList.remove("open");
  els.sidePanel.classList.remove("open");

  // wait animation then hide
  const t = 240;
  window.setTimeout(()=>{
    els.overlay.hidden = true;
    els.sidePanel.hidden = true;
  }, t);
}


// ---------- Image viewer (fullscreen gallery) ----------
function renderViewer(){
  if(!els.imgViewer || !els.imgViewerImg || !els.imgThumbs) return;
  const imgs = viewer.images || [];
  const idx = clampIdx(viewer.idx || 0, imgs.length);
  viewer.idx = idx;
  // Top line: full product name (same style as old description)
  if(els.imgViewerName) els.imgViewerName.textContent = viewer.title || "Rasm";
  // Description block below thumbs
  if(els.imgViewerDesc) els.imgViewerDesc.textContent = viewer.desc || "";

  els.imgViewerImg.src = imgs[idx] || "";

  // thumbs
  els.imgThumbs.innerHTML = "";
  imgs.forEach((src, i)=>{
    const b = document.createElement("button");
    b.className = "thumb" + (i===idx ? " active" : "");
    b.innerHTML = `<img src="${src}" alt="thumb" loading="lazy" />`;
    b.addEventListener("click", ()=>{
      viewer.idx = i;
      renderViewer();
      viewer.onSelect?.(i);
    });
    els.imgThumbs.appendChild(b);
  });

  const hasNav = imgs.length > 1;
  if(els.imgPrev) els.imgPrev.style.display = hasNav ? "" : "none";
  if(els.imgNext) els.imgNext.style.display = hasNav ? "" : "none";
  renderReviewsUI(viewer.productId);
}

function openImageViewer({productId, title, desc, images, startIndex=0, onSelect}){
  if(!els.imgViewer) return;
  viewer = {
    open: true,
    productId: productId || null,
    title: title || "Rasm",
    desc: desc || "",
    images: (images||[]).filter(Boolean),
    idx: startIndex || 0,
    onSelect: onSelect || null
  };
  els.imgViewer.hidden = false;
  renderViewer();
  document.body.style.overflow = "hidden";
}

function closeImageViewer(){
  if(!els.imgViewer) return;
  viewer.open = false;
  els.imgViewer.hidden = true;
  document.body.style.overflow = "";
}

function stepViewer(dir){
  const n = viewer.images?.length || 0;
  if(n <= 1) return;
  viewer.idx = clampIdx((viewer.idx||0) + dir, n);
  renderViewer();
  viewer.onSelect?.(viewer.idx);
}

// ---------- Reviews UI (in fullscreen viewer) ----------
let draftStars = 5;

function renderStarSelector(){
  if(!els.revStars) return;
  els.revStars.innerHTML = "";
  for(let i=1;i<=5;i++){
    const b = document.createElement("button");
    b.className = "starBtn" + (i<=draftStars ? " active" : "");
    b.type = "button";
    b.title = `${i} / 5`;
    b.textContent = "★";
    b.addEventListener("click", ()=>{
      draftStars = i;
      renderStarSelector();
    });
    els.revStars.appendChild(b);
  }
}

function renderReviewsUI(productId){
  if(!productId) return;
  renderStarSelector();

  const list = getReviews(productId);
  const st = reviewStats(productId);
  if(els.revScore) els.revScore.textContent = `⭐ ${st.avg ? st.avg.toFixed(1) : "0.0"}`;
  if(els.revCount) els.revCount.textContent = `(${st.count} sharh)`;

  if(els.revList){
    els.revList.innerHTML = "";
    if(!list.length){
      const d = document.createElement("div");
      d.className = "revItem";
      d.innerHTML = `<div class="revItemText">Hozircha sharh yo‘q. Birinchi bo‘lib yozing 🙂</div>`;
      els.revList.appendChild(d);
    } else {
      for(const r of list.slice(0, 12)){
        const it = document.createElement("div");
        it.className = "revItem";
        const when = new Date(r.ts||Date.now()).toLocaleDateString("uz-UZ");
        it.innerHTML = `
          <div class="revItemTop">
            <b>⭐ ${Number(r.stars||0).toFixed(0)} — ${escapeHtml(r.author||"Mehmon")}</b>
            <span>${escapeHtml(when)}</span>
          </div>
          <div class="revItemText">${escapeHtml(r.text||"")}</div>
        `;
        els.revList.appendChild(it);
      }
    }
  }
}


function renderVariantLine(ci){
  if(!ci) return "";
  const parts = [];
  if(ci.color) parts.push(ci.color);
  if(ci.size) parts.push(ci.size);
  if(parts.length===0) return "";
  return `<div class="ptags">${parts.map(x=>`#${escapeHtml(x)}`).join(" ")}</div>`;
}

function renderPanel(mode){

  els.panelList.innerHTML = "";
  const list = [];

  if(mode === "fav"){
    for(const id of favs){
      const p = products.find(x=>x.id===id);
      if(p) list.push({p, qty:0});
    }
  } else {
    for(const ci of cart){
      const p = products.find(x=>x.id===ci.id);
      if(p) list.push({p, qty: ci.qty || 1, ci});
    }
  }

  els.panelEmpty.hidden = list.length !== 0;

  let total = 0;

  for(const row of list){
    const {p, qty} = row;
    if(mode === "cart") total += (p.price||0) * qty;

    const imgSrc = (mode === "cart")
      ? (row.ci?.image || getCurrentImage(p, {color: row.ci?.color || null, size: row.ci?.size || null, imgIdx: 0}))
      : getCurrentImage(p, getSel(p));

    const item = document.createElement("div");
    item.className = "cartItem";
    item.innerHTML = `
      <img class="cartImg" src="${imgSrc||""}" alt="${p.name||"product"}" />
      <div class="cartMeta">
        <div class="cartTitle">${p.name||"Nomsiz"}</div>
        ${mode==="cart" ? renderVariantLine(row.ci) : ""}
        <div class="cartRow">
          <div class="price">${moneyUZS(p.price||0)}</div>
          <button class="removeBtn" title="O‘chirish">🗑️</button>
        </div>
        ${mode==="cart" ? `
        <div class="cartRow">
          <div class="qty">
            <button data-q="-">−</button>
            <span>${qty}</span>
            <button data-q="+">+</button>
          </div>
          <div class="badge">${moneyUZS((p.price||0)*qty)}</div>
        </div>` : `
        <div class="cartRow">
          <button class="pBtn iconOnly" title="Savatchaga" data-add>🛒</button>
          <div class="badge">❤️</div>
        </div>`}
      </div>
    `;

    const removeBtn = item.querySelector(".removeBtn");
    removeBtn.addEventListener("click", ()=>{
      if(mode==="fav"){
        favs.delete(p.id);
        saveLS(LS.favs, Array.from(favs));
        updateBadges();
        renderPanel("fav");
        if(viewMode==="fav") applyFilterSort();
      } else {
        cart = cart.filter(x=>x.key!==row.ci.key);
        saveLS(LS.cart, cart);
        updateBadges();
        renderPanel("cart");
      }
    });

    if(mode==="cart"){
      item.querySelector('[data-q="-"]').addEventListener("click", ()=>{
        addToCart(p.id, -1, row.ci);
        renderPanel("cart");
      });
      item.querySelector('[data-q="+"]').addEventListener("click", ()=>{
        addToCart(p.id, +1, row.ci);
        renderPanel("cart");
      });
    } else {
      const addBtn = item.querySelector("[data-add]");
      addBtn.addEventListener("click", ()=>{
        addToCart(p.id, 1, getSel(p));
        openPanel("cart");
      });
    }

    els.panelList.appendChild(item);
  }

  if(els.cartTotal) els.cartTotal.textContent = moneyUZS(total);
}


async function loadProducts(){
  const res = await fetch("./products.json", { cache: "no-store" });
  const json = await res.json();
  const raw = Array.isArray(json.items) ? json.items : [];
  // Normalize for robust filtering/sorting even if JSON has strings for price/date
  products = raw.map(p=>({
    ...p,
    id: (p.id ?? "").toString(),
    name: (p.name ?? "").toString(),
    tags: Array.isArray(p.tags) ? p.tags.map(x=>x.toString()) : [],
    _price: parsePrice(p.price),
    _created: Date.parse(p.createdAt ?? "") || 0,
  }));
  applyFilterSort();
}

function setUserUI(user){
  const authCard = els.authCard || document.getElementById("authCard");

  // robust: body class controls CSS hide/show
  document.body.classList.toggle("signed-in", !!user);

  if(!user){
    if(authCard) authCard.style.display = "";
    els.userName.textContent = "Mehmon";
    els.userSmall.textContent = "Kirish talab qilinadi";
    els.avatar.src = "";
    els.avatar.style.visibility = "hidden";
    els.btnLogout.hidden = true;
    return;
  }

  // hide login block after sign-in
  if(authCard) authCard.style.display = "none";

  const name = user.displayName || user.email || user.phoneNumber || "User";
  els.userName.textContent = name;
  els.userSmall.textContent = `UID: ${user.uid.slice(0,8)}…`;

  const photo = user.photoURL;
  if(photo){
    els.avatar.src = photo;
    els.avatar.style.visibility = "visible";
  } else {
    els.avatar.src = "";
    els.avatar.style.visibility = "hidden";
  }
  els.btnLogout.hidden = false;
}

els.btnGoogle.addEventListener("click", async ()=>{
  try{
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }catch(e){
    alert("Google login xatolik. Console’ni tekshiring. Eng ko‘p sabab: firebase-config.js apiKey noto‘g‘ri.");
    console.error(e);
  }
});

els.btnLogout.addEventListener("click", async ()=>{ await signOut(auth); });

window.addEventListener("tg_auth", async (e)=>{
  const tgUser = e.detail;
  showTgNotice("Telegram auth yuborildi...");

  try{
    const r = await fetch("/.netlify/functions/telegramAuth", {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({ tgUser })
    });

    const out = await r.json().catch(()=> ({}));
    if(!r.ok){
      const msg = out?.error || "Telegram auth xatolik";
      const details = out?.details ? `\nDETAILS: ${out.details}` : "";
      const hints = out?.envHints ? `\nENV: ${JSON.stringify(out.envHints)}` : "";
      showTgNotice(msg + details + hints);
      console.error("telegramAuth error:", out);
      return;
    }

    showTgNotice("Firebase token olindi. Kirish...");
    await signInWithCustomToken(auth, out.customToken);
    showTgNotice("");
  }catch(err){
    showTgNotice("Telegram auth network/server xatolik");
    console.error(err);
  }
});

els.q.addEventListener("input", applyFilterSort);
els.sort.addEventListener("change", applyFilterSort);
els.btnReload.addEventListener("click", loadProducts);

// panel & views
// Favorites should open like cart (drawer), not just filter the grid.
els.favViewBtn?.addEventListener("click", ()=> openPanel("fav"));
els.cartBtn?.addEventListener("click", ()=> openPanel("cart"));
els.panelClose?.addEventListener("click", closePanel);
els.overlay?.addEventListener("click", closePanel);

// image viewer events
els.imgViewerClose?.addEventListener("click", closeImageViewer);
els.imgViewerBackdrop?.addEventListener("click", closeImageViewer);
els.imgPrev?.addEventListener("click", ()=>stepViewer(-1));
els.imgNext?.addEventListener("click", ()=>stepViewer(+1));

// reviews (viewer)
els.revSend?.addEventListener("click", ()=>{
  if(!viewer.productId) return;
  const text = (els.revText?.value || "").trim();
  if(text.length < 2) return;
  addReview(viewer.productId, draftStars, text.slice(0, 280));
  if(els.revText) els.revText.value = "";
  renderReviewsUI(viewer.productId);
  // refresh ratings on cards (if visible)
  applyFilterSort();
});

// viewer actions
els.viewerCart?.addEventListener("click", ()=>{
  const p = products.find(x=>x.id===viewer.productId);
  if(!p) return;
  addToCart(p.id, 1, getSel(p));
  updateBadges();
  openPanel("cart");
});
els.viewerBuy?.addEventListener("click", ()=>{
  const p = products.find(x=>x.id===viewer.productId);
  if(!p) return;
  addToCart(p.id, 1, getSel(p));
  updateBadges();
  openPanel("cart");
});
window.addEventListener("keydown", (e)=>{
  if(!viewer.open) return;
  if(e.key === "Escape") closeImageViewer();
  if(e.key === "ArrowLeft") stepViewer(-1);
  if(e.key === "ArrowRight") stepViewer(+1);
});
els.clearBtn?.addEventListener("click", ()=>{
  if(els.panelTitle.textContent.includes("Sevimli")){
    favs = new Set();
    saveLS(LS.favs, []);
  } else {
    cart = [];
    saveLS(LS.cart, []);
  }
  updateBadges();
  renderPanel(els.panelTitle.textContent.includes("Sevimli") ? "fav" : "cart");
  if(viewMode === "fav") applyFilterSort();
});
els.checkoutBtn?.addEventListener("click", ()=>{
  // This demo doesn't send automatically. Provide copyable text.
  const lines = cart.map(ci=>{
    const p = products.find(x=>x.id===ci.id);
    if(!p) return null;
    return `${p.name} x${ci.qty} = ${moneyUZS((p.price||0)*ci.qty)}`;
  }).filter(Boolean);
  const total = cart.reduce((s,ci)=>{
    const p = products.find(x=>x.id===ci.id);
    return s + (p? (p.price||0)*(ci.qty||0) : 0);
  },0);
  const msg = `OrzuMall buyurtma:%0A${encodeURIComponent(lines.join("\n"))}%0A%0AJami: ${encodeURIComponent(moneyUZS(total))}`;
  // Try open Telegram share (works if user has TG installed or web)
  window.open(`https://t.me/share/url?url=&text=${msg}`, "_blank");
});

onAuthStateChanged(auth, (user)=> setUserUI(user));

await loadProducts();
updateBadges();
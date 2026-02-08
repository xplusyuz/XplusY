import { auth, db } from "./firebase-config.js";
import {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js"; import {   doc,
  getDoc, setDoc, collection, query, orderBy, limit, onSnapshot,
  runTransaction, serverTimestamp, getAggregateFromServer, average,
  count, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";


let currentUser = null;

// Lightweight interest tracking -> Firestore events (used to compute real popularity)
async function logEvent(type, productId){
  try{
    if(!currentUser) return;
    await addDoc(collection(db, "events"), {
      uid: currentUser.uid,
      type,
      productId: String(productId),
      createdAt: new Date(),
      ua: navigator.userAgent || "",
    });
  }catch(e){
    console.warn("logEvent failed", e);
  }
}


const els = {
  avatar: document.getElementById("avatar"),
  avatarBtn: document.getElementById("avatarBtn"),
  avatarFallback: document.getElementById("avatarFallback"),
  btnGoogle: document.getElementById("btnGoogle"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  tagBar: document.getElementById("tagBar"),
  q: document.getElementById("q"),
  sort: document.getElementById("sort"),
  tgNotice: document.getElementById("tgNotice"),
  authCard: document.getElementById("authCard"),
  heroAuthJump: document.getElementById("heroAuthJump"),

  // new UI
  favViewBtn: document.getElementById("favViewBtn"),
  cartBtn: document.getElementById("cartBtn"),
  favCount: document.getElementById("favCount"),
  cartCount: document.getElementById("cartCount"),

  overlay: document.getElementById("overlay"),
  sidePanel: document.getElementById("sidePanel"),

  // profile modal
  profileOverlay: document.getElementById("profileOverlay"),
  profileClose: document.getElementById("profileClose"),
  profileEditBtn: document.getElementById("profileEditBtn"),
  profileSave: document.getElementById("profileSave"),
  profileLogout: document.getElementById("profileLogout"),
  profileName: document.getElementById("profileName"),
  profileUid: document.getElementById("profileUid"),
  profileAvatar: document.getElementById("profileAvatar"),
  pfPhone: document.getElementById("pfPhone"),
  pfRegion: document.getElementById("pfRegion"),
  pfDistrict: document.getElementById("pfDistrict"),
  pfPost: document.getElementById("pfPost"),
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
  qvPrice: document.getElementById("qvPrice"),
  qvOldPrice: document.getElementById("qvOldPrice"),
  qvRating: document.getElementById("qvRating"),
  qvTags: document.getElementById("qvTags"),
  qvBadge: document.getElementById("qvBadge"),
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
  revFiles: document.getElementById("revFiles"),
  revPreview: document.getElementById("revPreview"),

  // viewer actions
  viewerCart: document.getElementById("viewerCart"),
  viewerBuy: document.getElementById("viewerBuy"),

  // variant modal (add to cart)
  vOverlay: document.getElementById("vOverlay"),
  vClose: document.getElementById("vClose"),
  vCancel: document.getElementById("vCancel"),
  vConfirm: document.getElementById("vConfirm"),
  vImg: document.getElementById("vImg"),
  vName: document.getElementById("vName"),
  vPrice: document.getElementById("vPrice"),
  vColors: document.getElementById("vColors"),
  vColorRow: document.getElementById("vColorRow"),
  vColorHint: document.getElementById("vColorHint"),
  vSizes: document.getElementById("vSizes"),
  vSizeRow: document.getElementById("vSizeRow"),
  vSizeHint: document.getElementById("vSizeHint"),
  vMinus: document.getElementById("vMinus"),
  vPlus: document.getElementById("vPlus"),
  vQty: document.getElementById("vQty")
};

// ---- Modal helpers (world-class, animated, accessibility-friendly) ----
function _anyOverlayOpen(){
  return [els.profileOverlay, els.vOverlay, els.imgViewer].some(el=>el && !el.hidden);
}
function _syncModalBody(){
  if(_anyOverlayOpen()) document.body.classList.add("modalOpen");
  else document.body.classList.remove("modalOpen");
}
function showOverlay(el){
  if(!el) return;
  el.hidden = false;
  // allow CSS transitions
  requestAnimationFrame(()=>{ el.classList.add("isOpen"); });
  _syncModalBody();
}
function hideOverlay(el){
  if(!el) return;
  el.classList.remove("isOpen");
  // keep in DOM briefly for exit animation
  window.setTimeout(()=>{ el.hidden = true; _syncModalBody(); }, 190);
}

// === Desktop horizontal scroll helpers (PC: wheel + drag) ===
const isFinePointer = () => window.matchMedia && window.matchMedia("(pointer:fine)").matches;

function enhanceHScroll(el){
  if(!el || el.dataset.hscrollInit==="1") return;
  el.dataset.hscrollInit="1";

  // Wheel: use vertical wheel to scroll horizontally when hovering the row (PC)
  el.addEventListener("wheel", (e)=>{
    if(!isFinePointer()) return;
    // If user is already doing horizontal wheel/trackpad, don't override
    if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if(e.deltaY === 0) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }, {passive:false});

  // Drag to scroll (mouse) — doesn't break clicks (threshold + cancel-click-after-drag)
  let down = false;
  let moved = false;
  let startX = 0;
  let startLeft = 0;
  let pid = null;

  const DRAG_THRESHOLD = 6; // px

  el.addEventListener("pointerdown", (e)=>{
    if(!isFinePointer()) return;
    if(e.pointerType === "touch") return;
    if(e.button != null && e.button !== 0) return; // left click only

    down = true;
    moved = false;
    pid = e.pointerId;
    startX = e.clientX;
    startLeft = el.scrollLeft;
    // NOTE: no pointer capture here — only after threshold, so clicks still work.
  });

  el.addEventListener("pointermove", (e)=>{
    if(!down) return;
    const dx = e.clientX - startX;

    if(!moved){
      if(Math.abs(dx) < DRAG_THRESHOLD) return;
      moved = true;
      el.classList.add("dragging");
      try{ el.setPointerCapture(pid); }catch(_){}
    }
    el.scrollLeft = startLeft - dx;
    e.preventDefault();
  });

  const finish = ()=>{
    if(moved){
      el.dataset.justDragged = "1";
      setTimeout(()=>{ delete el.dataset.justDragged; }, 140);
    }
    down = false;
    moved = false;
    pid = null;
    el.classList.remove("dragging");
  };

  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", finish);

  // If we just dragged, kill the click so options don't accidentally toggle.
  el.addEventListener("click", (e)=>{
    if(el.dataset.justDragged === "1"){
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

let products = [];
let selectedTag = "all";
let tagCounts = new Map();

const LS = {
  favs: "om_favs",
  cart: "om_cart"
};

// ---------------- Reviews (Firestore, realtime) ----------------
// Reviews subcollection: products/{productId}/reviews/{uid} -> {uid, authorName, stars, text, createdAt, updatedAt}
// Rating/Count: Firestore Aggregate (real, server-side), statsCache bilan tezlashtiramiz.
const statsCache = new Map(); // productId -> {avg, count, ts}
let unsubReviews = null;
let viewerProductId = null;

function cleanupReviewSubscriptions(){
  try{ unsubReviews && unsubReviews(); }catch{}
  unsubReviews = null;
}

function getStats(productId){
  const d = statsCache.get(productId);
  if(!d) return { avg: 0, count: 0 };
  return { avg: Number(d.avg)||0, count: Number(d.count)||0 };
}

async function refreshStats(productId, force=false){
  const now = Date.now();
  const cached = statsCache.get(productId);
  if(!force && cached && (now - (cached.ts||0) < 20000)) return getStats(productId);

  try{
    const baseRef = collection(db, "products", productId, "reviews");
    const agg = await getAggregateFromServer(baseRef, {
      count: count(),
      avg: average("stars")
    });
    const data = agg.data() || {};
    const out = {
      avg: Number(data.avg)||0,
      count: Number(data.count)||0,
      ts: now
    };
    statsCache.set(productId, out);
    return { avg: out.avg, count: out.count };
  }catch(e){
    return getStats(productId);
  }
}

async function preloadStats(productIds){
  await Promise.all((productIds||[]).map(id => refreshStats(id, false)));
}

function subscribeReviews(productId){
  cleanupReviewSubscriptions();
  logEvent('view', productId);
  viewerProductId = productId;

  refreshStats(productId, true).then((st)=>{
    if(els.revScore) els.revScore.textContent = `⭐ ${st.avg ? st.avg.toFixed(1) : "0.0"}`;
    if(els.revCount) els.revCount.textContent = `(${st.count} sharh)`;
  });

  const q = query(
    collection(db, "products", productId, "reviews"),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  let statsDebounce = null;
  unsubReviews = onSnapshot(q, (snap)=>{
    const list = [];
    snap.forEach(docu=>{
      const d = docu.data() || {};
      list.push({
        uid: d.uid || docu.id,
        author: d.authorName || "Foydalanuvchi",
        stars: Number(d.stars)||0,
        text: (d.text||"").toString(),
        ts: d.createdAt?.toMillis ? d.createdAt.toMillis() : 0
      });
    });
    renderReviewsList(list);

    if(statsDebounce) clearTimeout(statsDebounce);
    statsDebounce = setTimeout(async ()=>{
      const st = await refreshStats(productId, true);
      if(els.revScore) els.revScore.textContent = `⭐ ${st.avg ? st.avg.toFixed(1) : "0.0"}`;
      if(els.revCount) els.revCount.textContent = `(${st.count} sharh)`;
      applyFilterSort();
    }, 400);
  });
}

function formatDate(ts){
  try{
    if(!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("uz-UZ", { year:"numeric", month:"2-digit", day:"2-digit" });
  }catch{ return ""; }
}

function renderReviewsList(list){
  if(!els.revList) return;
  els.revList.innerHTML = "";

  if(!list.length){
    const d = document.createElement("div");
    d.className = "revItem";
    d.innerHTML = `<div class="revItemText">Hozircha sharh yo‘q. Birinchi bo‘lib sharh qoldiring 🙂</div>`;
    els.revList.appendChild(d);
    return;
  }

  for(const r of list){
    const item = document.createElement("div");
    item.className = "revItem";
    const stars = "★".repeat(Math.max(0, Math.min(5, r.stars))) + "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, r.stars))));
    const imgs = (r.images||[]).length ? `
      <div class="revItemImgs">
        ${(r.images||[]).map(u=>`
          <div class="revItemImg" data-img="${escapeHtml(u)}"><img src="${escapeHtml(u)}" alt="review image" loading="lazy"/></div>
        `).join("")}
      </div>
    ` : "";

    item.innerHTML = `
      <div class="revHead">
        <div class="revAuthor">${escapeHtml(r.author)}</div>
        <div class="revMeta">
          <span class="revStarsMini">${stars}</span>
          <span class="revDate">${escapeHtml(formatDate(r.ts))}</span>
        </div>
      </div>
      ${r.text ? `<div class="revItemText">${escapeHtml(r.text)}</div>` : ""}
      ${imgs}
    `;
    els.revList.appendChild(item);
  }

  // click any review image to open viewer
  els.revList.querySelectorAll(".revItemImg").forEach(el=>{
    el.addEventListener("click", ()=>{
      const u = el.getAttribute("data-img");
      if(u) openStandaloneImage(u);
    });
  });
}

function openImageZoom(src){
  try{ if(!src) return; }catch(e){ return; }
  // lightweight zoom overlay (no product modal)
  const old = document.querySelector(".imgZoomOverlay");
  if(old) old.remove();
  const overlay = document.createElement("div");
  overlay.className = "imgZoomOverlay";
  overlay.innerHTML = `\
    <div class="imgZoomBackdrop"></div>\
    <div class="imgZoomBox" role="dialog" aria-modal="true">\
      <button class="imgZoomClose" aria-label="Yopish">×</button>\
      <img class="imgZoomImg" src="${src}" alt="Zoom"/>\
    </div>`;
  const close = ()=>{ overlay.remove(); window.removeEventListener("keydown", onKey); };
  const onKey = (ev)=>{ if(ev.key==="Escape") close(); };
  overlay.querySelector(".imgZoomBackdrop").addEventListener("click", close);
  overlay.querySelector(".imgZoomClose").addEventListener("click", close);
  window.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

function openStandaloneImage(url){
  openImageZoom(url);
}
);
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

// Variant pricing support
function getVariantPricing(p, sel){
  const color = (sel?.color ?? "").toString() || null;
  const size  = (sel?.size  ?? "").toString() || null;

  const base = {
    price: parsePrice(p.price),
    oldPrice: parsePrice(p.oldPrice),
    installmentText: (p.installmentText ?? "").toString()
  };

  // New optimized format: variants: [{color, size, price, oldPrice?, installmentText?}]
  if(Array.isArray(p.variants) && p.variants.length){
    const pick = (c,s)=> p.variants.find(v=>
      (v?.color ?? null) === (c ?? null) &&
      (v?.size  ?? null) === (s ?? null)
    );
    const v =
      pick(color, size) ||
      pick(color, null) ||
      pick(null, size) ||
      null;

    if(v){
      if(v.price != null) base.price = parsePrice(v.price);
      if(v.oldPrice != null) base.oldPrice = parsePrice(v.oldPrice);
      if(v.installmentText != null) base.installmentText = (v.installmentText||"").toString();
    }
  }

  // Backward compatibility: variantPrices map (old)
  const vp = (p.variantPrices || p.pricesByVariant || p.pricingByVariant || null);
  if(vp && typeof vp === "object"){
    const keys = [
      `${color||""}|${size||""}`,
      `${color||""}|`,
      `|${size||""}`,
      color||"",
      size||""
    ].filter(k=>k && k !== "|");
    for(const k of keys){
      if(Object.prototype.hasOwnProperty.call(vp, k)){
        const v = vp[k];
        if(typeof v === "number" || typeof v === "string"){
          base.price = parsePrice(v);
        } else if(v && typeof v === "object"){
          if(v.price != null) base.price = parsePrice(v.price);
          if(v.oldPrice != null) base.oldPrice = parsePrice(v.oldPrice);
          if(v.installmentText != null) base.installmentText = v.installmentText.toString();
        }
        break;
      }
    }
  }
  return base;
}

function minVariantPrice(p){
  let min = parsePrice(p.price);

  // new optimized
  if(Array.isArray(p.variants) && p.variants.length){
    for(const v of p.variants){
      const n = parsePrice((v && typeof v === "object") ? v.price : v);
      if(n>0) min = Math.min(min||n, n);
    }
  }

  // old map (backward)
  const vp = (p.variantPrices || p.pricesByVariant || p.pricingByVariant || null);
  if(vp && typeof vp === "object"){
    for(const v of Object.values(vp)){
      const n = (v && typeof v === "object") ? parsePrice(v.price) : parsePrice(v);
      if(n>0) min = Math.min(min||n, n);
    }
  }
  return min || 0;
}

function updateCardPricing(cardEl, p, sel){
  const pr = getVariantPricing(p, sel);
  const nowEl = cardEl.querySelector(".ppriceNow");
  const oldEl = cardEl.querySelector(".ppriceOld");
  const instEl = cardEl.querySelector(".pinstall");

  if(nowEl) nowEl.textContent = moneyUZS(pr.price || 0);

  if(oldEl){
    if(pr.oldPrice && pr.oldPrice > (pr.price||0)){
      oldEl.textContent = moneyUZS(pr.oldPrice);
      oldEl.style.display = "";
    } else {
      oldEl.style.display = "none";
    }
  }

  if(instEl){
    if(pr.installmentText){
      instEl.textContent = pr.installmentText;
      instEl.style.display = "";
    } else {
      instEl.style.display = "none";
    }
  }
}


function buildTagCounts(){
  tagCounts = new Map();
  for(const p of products){
    for(const t of (p.tags || [])){
      const key = String(t).toLowerCase();
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
    }
  }
}

function titleTag(t){
  // keep original style: capitalize first letter, keep rest
  const s = String(t);
  return s.length ? (s[0].toUpperCase() + s.slice(1)) : s;
}

function renderTagBar(){
  if(!els.tagBar) return;
  const entries = Array.from(tagCounts.entries())
    .sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0]));

  const total = products.length;
  const chips = [];
  chips.push(`<button class="tagChip ${selectedTag==="all"?"active":""}" data-tag="all">Barchasi <span class="count">${total}</span></button>`);
  for(const [tag,count] of entries){
    chips.push(`<button class="tagChip ${selectedTag===tag?"active":""}" data-tag="${tag}">${titleTag(tag)} <span class="count">${count}</span></button>`);
  }
  els.tagBar.innerHTML = chips.join("");
}

function setSelectedTag(tag){
  selectedTag = tag || "all";
  renderTagBar();
  applyFilterSort();
}

function applyFilterSort(){
  const query = norm(els.q.value);
  let arr = [...products];

  if(viewMode === "fav"){
    arr = arr.filter(p=>favs.has(p.id));
  }

  // tag category filter
  if(selectedTag && selectedTag !== "all"){
    arr = arr.filter(p => (p.tags || []).map(t=>String(t).toLowerCase()).includes(selectedTag));
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
  renderTagBar();
}


function renderOptions(p){
  const colors = normColors(p);
  const sizes = normSizes(p);
  if(colors.length===0 && sizes.length===0) return "";
  const sel = getSel(p);

  const sw = colors.length ? `
    <div class="optLine swatchesLine" aria-label="Rang">
      ${colors.map(c=>{
        const active = (sel.color===c.name) ? "active" : "";
        const style = c.hex ? `style="--c:${c.hex}"` : "";
        return `<button class="swatch ${active}" ${style} data-c="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}"></button>`;
      }).join("")}
    </div>` : "";

  const sz = sizes.length ? `
    <div class="optLine sizesLine" aria-label="O'lcham">
      ${sizes.map(s=>{
        const active = (sel.size===s) ? "active" : "";
        return `<button class="sizeChip ${active}" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
      }).join("")}
    </div>` : "";

  return `<div class="optStack">${sw}${sz}</div>`;
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

    const st = getStats(p.id);
    const showAvg = st.count ? st.avg : 0;
    const showCount = st.count ? st.count : 0;

    card.innerHTML = `
      <div class="pmedia">
        <img class="pimg" src="${currentImg || ""}" alt="${escapeHtml(p.name || "product")}" loading="lazy"/>
        ${p.badge ? `<div class="pbadge">${escapeHtml(p.badge)}</div>` : ``}
        <button class="favBtn ${isFav ? "active" : ""}" title="Sevimli">${isFav ? "♥" : "♡"}</button>
      </div>

      <div class="pbody uz">
        <div class="ppriceRow">
          <div class="ppriceNow">${moneyUZS(getVariantPricing(p, sel).price || 0)}</div>
          <div class="ppriceOld" style="display:none"></div>
        </div>

        <div class="pinstall" style="display:none"></div>

        <div class="pname clamp2">${escapeHtml(p.name || "Nomsiz")}</div>


        

        <div class="pactions">
          <div class="pratingInline">${(showCount ? `⭐ ${Number(showAvg).toFixed(1)} <span>(${showCount})</span>` : ``)}</div>
          <button class="iconPill primary" data-act="cart" title="Savatchaga" aria-label="Savatchaga">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM7.17 14h9.66c.75 0 1.4-.41 1.74-1.03L21 6H6.21L5.27 4H2v2h2l3.6 7.59-1.35 2.44C5.52 17.37 6.48 19 8 19h12v-2H8l1.17-3Z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Apply dynamic pricing for current selection
    updateCardPricing(card, p, sel);

    const favBtn = card.querySelector(".favBtn");
    favBtn.addEventListener("click", ()=>{
      if(favs.has(p.id)) { favs.delete(p.id); } else { favs.add(p.id); logEvent('favorite', p.id); }
      saveLS(LS.favs, Array.from(favs));
      favBtn.classList.toggle("active", favs.has(p.id));
      favBtn.textContent = favs.has(p.id) ? "♥" : "♡";
      favBtn.setAttribute("aria-pressed", favs.has(p.id) ? "true" : "false");
      updateBadges();
      if(viewMode === "fav") applyFilterSort();
    });


    const imgEl = card.querySelector(".pimg");

    
const openQuickView = ()=>{
  const selNow = getSel(p);
  const imgs = getImagesFor(p, selNow);
  if(!imgs.length) return;

  const stQV = getStats(p.id);

  openImageViewer({
    productId: p.id,
    title: p.name || "Rasm",
    desc: p.description || p.desc || "",
    pricing: getVariantPricing(p, selNow),
    rating: Number(stQV.avg || 0),
    reviewsCount: Number(stQV.count || 0),
    tags: Array.isArray(p.tags) ? p.tags : [],
    badge: p.badge || "",
    images: imgs,
    startIndex: selNow.imgIdx || 0,
    onSelect: (i)=>{
      setImageIndex(p, i);
      setCardImage(imgEl, p, getSel(p));
    }
  });
};

    // Open fullscreen viewer on image click
    imgEl.addEventListener("click", (e)=>{
      e.stopPropagation();
      openQuickView();
    });

    // Open quick view when clicking anywhere on the card (except fav/cart)
    card.addEventListener("click", (e)=>{
      const t = e.target;
      if(t.closest(".favBtn")) return;
      if(t.closest('[data-act="cart"]')) return;
      openQuickView();
    });

    card.querySelector('[data-act="cart"]').addEventListener("click", ()=>{
      handleAddToCart(p, { openCartAfter: true });
    });

    els.grid.appendChild(card);

    // (variant selection is now handled in the modal on Add to Cart)

  }
}


function addToCart(id, qty, sel){
  logEvent('add_to_cart', id);
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

// ---------- World-class variant selection (opened from Add to Cart) ----------
const vState = { open:false, product:null, qty:1, sel:{color:null,size:null}, openCartAfter:false };

function productNeedsVariantModal(p){
  const colors = normColors(p);
  const sizes = normSizes(p);
  return (colors.length > 1) || (sizes.length > 1);
}

function normalizeSelectionForProduct(p, baseSel){
  const colors = normColors(p);
  const sizes = normSizes(p);
  const sel = { ...(baseSel || {}) };
  if(!sel.color && colors.length === 1) sel.color = colors[0].name;
  if(!sel.size && sizes.length === 1) sel.size = sizes[0];
  return { color: sel.color || null, size: sel.size || null };
}

function handleAddToCart(p, opts={}){
  const openCartAfter = !!opts.openCartAfter;
  if(!productNeedsVariantModal(p)){
    const sel = normalizeSelectionForProduct(p, getSel(p));
    addToCart(p.id, 1, sel);
    updateBadges();
    if(openCartAfter) openPanel("cart");
    return;
  }
  openVariantModal(p, { openCartAfter });
}

function openVariantModal(p, opts={}){
  if(!els.vOverlay) return;
  vState.open = true;
  vState.product = p;
  vState.openCartAfter = !!opts.openCartAfter;
  vState.qty = 1;
  vState.sel = normalizeSelectionForProduct(p, getSel(p));
  renderVariantModal();
  showOverlay(els.vOverlay);
}

function closeVariantModal(){
  if(!els.vOverlay) return;
  vState.open = false;
  vState.product = null;
  hideOverlay(els.vOverlay);
}

function renderVariantModal(){
  const p = vState.product;
  if(!p) return;
  const colors = normColors(p);
  const sizes = normSizes(p);
  const sel = vState.sel || {color:null,size:null};

  if(els.vName) els.vName.textContent = p.name || "—";
  const pricing = getVariantPricing(p, sel);
  if(els.vPrice) els.vPrice.textContent = moneyUZS(pricing.price || 0);
  if(els.vQty) els.vQty.textContent = String(vState.qty || 1);
  if(els.vImg){
    const img = getCurrentImage(p, sel) || getCurrentImage(p, getDefaultSel(p)) || "";
    els.vImg.src = img;
  
    // click to zoom (image only)
    els.vImg.onclick = (e)=>{
      e?.preventDefault?.();
      e?.stopPropagation?.();
      try{ e?.stopImmediatePropagation?.(); }catch(_){ }
      openImageZoom(els.vImg.src || "");
    };
  }

  const showColors = colors.length > 0;
  if(els.vColors) els.vColors.hidden = !showColors;
  if(els.vColorRow) els.vColorRow.innerHTML = showColors ? colors.map(c=>{
    const active = sel.color === c.name ? "active" : "";
    const bg = c.hex ? `style="background:${c.hex};"` : "";
    return `<button class="vSwatch ${active}" ${bg} data-c="${escapeHtml(c.name)}" title="${escapeHtml(c.name)}" aria-label="${escapeHtml(c.name)}"></button>`;
  }).join("") : "";

  const showSizes = sizes.length > 0;
  if(els.vSizes) els.vSizes.hidden = !showSizes;
  if(els.vSizeRow) els.vSizeRow.innerHTML = showSizes ? sizes.map(s=>{
    const active = sel.size === s ? "active" : "";
    return `<button class="vChip ${active}" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
  }).join("") : "";

  if(els.vColorHint) els.vColorHint.hidden = true;
  if(els.vSizeHint) els.vSizeHint.hidden = true;

  els.vColorRow?.querySelectorAll(".vSwatch").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      vState.sel.color = btn.getAttribute("data-c");
      // keep selection for future image viewer usage
      const now = getSel(p);
      now.color = vState.sel.color;
      now.imgIdx = 0;
      selected.set(p.id, now);
      renderVariantModal();
    });
  });
  els.vSizeRow?.querySelectorAll(".vChip").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      vState.sel.size = btn.getAttribute("data-s");
      const now = getSel(p);
      now.size = vState.sel.size;
      selected.set(p.id, now);
      renderVariantModal();
    });
  });
}

function validateVariantSelection(){
  const p = vState.product;
  if(!p) return false;
  const colors = normColors(p);
  const sizes = normSizes(p);
  const sel = normalizeSelectionForProduct(p, vState.sel);
  vState.sel = sel;
  let ok = true;
  if(colors.length > 0 && !sel.color){ ok = false; if(els.vColorHint) els.vColorHint.hidden = false; }
  if(sizes.length > 0 && !sel.size){ ok = false; if(els.vSizeHint) els.vSizeHint.hidden = false; }
  return ok;
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
  // Header title
  if(els.imgViewerName) els.imgViewerName.textContent = viewer.title || "Rasm";

  // Price + meta (optional)
  const pr = viewer.pricing || null;
  if(els.qvPrice) els.qvPrice.textContent = pr ? moneyUZS(pr.price||0) : "";
  if(els.qvOldPrice){
    const op = pr ? (pr.oldPrice||0) : 0;
    els.qvOldPrice.textContent = op ? moneyUZS(op) : "";
    els.qvOldPrice.style.display = op ? "" : "none";
  }
  if(els.qvRating){
    const r = Number(viewer.rating||0);
    const c = Number(viewer.reviewsCount||0);
    els.qvRating.textContent = (r||c) ? `⭐ ${r ? r.toFixed(1) : "0.0"} (${c||0})` : "";
    els.qvRating.style.display = (r||c) ? "" : "none";
  }
  if(els.qvBadge){
    const b = (viewer.badge||"").toString().trim();
    els.qvBadge.textContent = b;
    els.qvBadge.style.display = b ? "" : "none";
  }
  if(els.qvTags){
    const tagsArr = Array.isArray(viewer.tags) ? viewer.tags : [];
    els.qvTags.innerHTML = tagsArr.slice(0,12).map(t=>`<span class="qvTag">${escapeHtml(String(t))}</span>`).join("");
    els.qvTags.style.display = tagsArr.length ? "" : "none";
  }

  // Description
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

function openImageViewer({productId, title, desc, pricing, rating, reviewsCount, tags, badge, images, startIndex=0, onSelect}){
  if(!els.imgViewer) return;
  viewer = {
    open: true,
    productId: productId || null,
    title: title || "Rasm",
    desc: desc || "",
    pricing: pricing || null,
    rating: Number.isFinite(+rating) ? +rating : 0,
    reviewsCount: Number.isFinite(+reviewsCount) ? +reviewsCount : 0,
    tags: Array.isArray(tags) ? tags : [],
    badge: badge || "",
    images: (images||[]).filter(Boolean),
    idx: startIndex || 0,
    onSelect: onSelect || null
  };
  showOverlay(els.imgViewer);
  renderViewer();
}

function closeImageViewer(){
  if(!els.imgViewer) return;
  viewer.open = false;
  cleanupReviewSubscriptions();
  hideOverlay(els.imgViewer);
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
let hoverStars = 0;

function renderStarSelector(){
  if(!els.revStars) return;
  els.revStars.innerHTML = "";
  const shown = hoverStars || draftStars;
  for(let i=1;i<=5;i++){
    const b = document.createElement("button");
    b.className = "starBtn" + (i<=shown ? " active" : "");
    b.type = "button";
    b.title = `${i} / 5`;
    b.textContent = "★";
    b.addEventListener("mouseenter", ()=>{ hoverStars = i; renderStarSelector(); });
    b.addEventListener("focus", ()=>{ hoverStars = i; renderStarSelector(); });
    b.addEventListener("mouseleave", ()=>{ hoverStars = 0; renderStarSelector(); });
    b.addEventListener("blur", ()=>{ hoverStars = 0; renderStarSelector(); });
    b.addEventListener("click", ()=>{
      draftStars = i;
      hoverStars = 0;
      renderStarSelector();
    });
    els.revStars.appendChild(b);
  }
}


// --- Review images (selection + preview) ---
function renderReviewsUI(productId){
  if(!productId) return;
  renderStarSelector();
  // Firestore realtime updates (subscribe once per opened product)
  if(viewerProductId !== productId) subscribeReviews(productId);
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
    if(mode === "cart") total += (getVariantPricing(p, {color: row.ci?.color || null, size: row.ci?.size || null}).price||0) * qty;

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
          <div class="price">${moneyUZS(getVariantPricing(p, {color: row.ci?.color || null, size: row.ci?.size || null}).price||0)}</div>
          <button class="removeBtn" title="O‘chirish">🗑️</button>
        </div>
        ${mode==="cart" ? `
        <div class="cartRow">
          <div class="qty">
            <button data-q="-">−</button>
            <span>${qty}</span>
            <button data-q="+">+</button>
          </div>
          <div class="badge">${moneyUZS((getVariantPricing(p, {color: row.ci?.color || null, size: row.ci?.size || null}).price||0)*qty)}</div>
        </div>` : `
        <div class="cartRow">
          <button class="pBtn iconOnly" title="Savatchaga" data-add>🛒</button>
          <div class="badge">❤️</div>
        </div>`}
      </div>
    `;

    
    // Click image -> open large viewer
    const cartImgEl = item.querySelector(".cartImg");
    if(cartImgEl){
      cartImgEl.addEventListener("click", (e)=>{
        e?.preventDefault?.();
        e?.stopPropagation?.();
        try{ e?.stopImmediatePropagation?.(); }catch(_){ }
        openImageZoom(imgSrc);
      });
    }

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



let unsubProducts = null;

async function loadProducts(){
  // Firestore is the single source of truth (no products.json fallback).
  try{
    const colRef = collection(db, "products");
    const qy = query(colRef, orderBy("popularScore", "desc"));
    unsubProducts && unsubProducts();
    unsubProducts = onSnapshot(qy, (snap)=>{
      const arr = snap.docs.map(d=> {
        const data = d.data() || {};
        return { id: String(data.id || d.id), ...data, _docId: d.id };
      });
      products = arr;
      applyFilterSort();

      // If empty, show a helpful hint for setup
      if(arr.length === 0){
        showToast("Mahsulotlar yo‘q. Admin paneldan mahsulot qo‘shing.", "info");
      }
    }, (err)=>{
      console.warn("Firestore products error", err);
      showToast("Mahsulotlarni o‘qib bo‘lmadi. Firestore rules / config tekshiring.", "error");
      products = [];
      applyFilterSort();
    });
  }catch(e){
    console.warn("Firestore products init failed", e);
    showToast("Firestore ulanishida xato. firebase-config.js ni tekshiring.", "error");
    products = [];
    applyFilterSort();
  }
}

function setUserUI(user){
  currentUser = user || null;
  const authCard = els.authCard || document.getElementById("authCard");

  document.body.classList.toggle("signed-in", !!user);

  if(!user){
    if(authCard) authCard.style.display = "";
    if(els.avatar) els.avatar.src = "";
    if(els.avatar) els.avatar.style.visibility = "hidden";
    if(els.avatarFallback) els.avatarFallback.style.display = "grid";
    if(els.avatarBtn) els.avatarBtn.disabled = true;
    return;
  }

  if(authCard) authCard.style.display = "none";

  const name = user.displayName || user.email || user.phoneNumber || "User";
  const initial = (name || "U").trim().slice(0,1).toUpperCase();

  const photo = user.photoURL;
  if(photo){
    if(els.avatar) els.avatar.src = photo;
    if(els.avatar) els.avatar.style.visibility = "visible";
    if(els.avatarFallback) els.avatarFallback.style.display = "none";
  } else {
    if(els.avatar) els.avatar.src = "";
    if(els.avatar) els.avatar.style.visibility = "hidden";
    if(els.avatarFallback){
      els.avatarFallback.textContent = initial;
      els.avatarFallback.style.display = "grid";
    }
  }
  if(els.avatarBtn) els.avatarBtn.disabled = false;

  // keep profile modal header in sync
  if(window.__omProfile) window.__omProfile.syncUser(user);
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

els.profileLogout.addEventListener("click", async ()=>{ await signOut(auth); });

window.addEventListener("tg_auth", async (e)=>{
  const tgUser = e.detail;
  showTgNotice("Telegram auth yuborildi...");

  try{
    // Telegram login requires a server-side verifier (Cloud Functions / backend).
    // This build is intentionally 'no-functions', so Telegram login is disabled.
    showTgNotice("Telegram login o‘chirilgan (functionsiz build). Iltimos, Google bilan kiring.");
    return;
  }catch(err){
    showTgNotice("Telegram auth network/server xatolik");
    console.error(err);
  }
});

els.q.addEventListener("input", applyFilterSort);
els.sort.addEventListener("change", applyFilterSort);

if(els.tagBar){
  els.tagBar.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-tag]");
    if(!btn) return;
    setSelectedTag(btn.dataset.tag);
  });
}


// panel & views
// Favorites should open like cart (drawer), not just filter the grid.
els.favViewBtn?.addEventListener("click", ()=> openPanel("fav"));
els.cartBtn?.addEventListener("click", ()=> openPanel("cart"));
els.panelClose?.addEventListener("click", closePanel);
els.overlay?.addEventListener("click", closePanel);

// variant modal events
els.vClose?.addEventListener("click", closeVariantModal);
els.vCancel?.addEventListener("click", closeVariantModal);
els.vOverlay?.addEventListener("click", (e)=>{
  // click on the dim area closes; click inside card does not
  if(e.target === els.vOverlay) closeVariantModal();
});
els.vMinus?.addEventListener("click", ()=>{
  vState.qty = Math.max(1, (vState.qty||1) - 1);
  if(els.vQty) els.vQty.textContent = String(vState.qty);
});
els.vPlus?.addEventListener("click", ()=>{
  vState.qty = Math.min(99, (vState.qty||1) + 1);
  if(els.vQty) els.vQty.textContent = String(vState.qty);
});
els.vConfirm?.addEventListener("click", ()=>{
  const p = vState.product;
  if(!p) return;
  if(!validateVariantSelection()) return;
  const sel = normalizeSelectionForProduct(p, vState.sel);
  addToCart(p.id, vState.qty || 1, sel);
  updateBadges();
  closeVariantModal();
  if(vState.openCartAfter) openPanel("cart");
});

// image viewer events
els.imgViewerClose?.addEventListener("click", closeImageViewer);
els.imgViewerBackdrop?.addEventListener("click", closeImageViewer);
els.imgPrev?.addEventListener("click", ()=>stepViewer(-1));
els.imgNext?.addEventListener("click", ()=>stepViewer(+1));

// reviews (viewer)
els.revSend?.addEventListener("click", async ()=>{
  const productId = viewer.productId;
  if(!productId) return;

  const user = auth.currentUser;
  if(!user){
    alert("Sharh qoldirish uchun avval Google/Telegram orqali kiring.");
    return;
  }

  const stars = Math.max(1, Math.min(5, Number(draftStars)||5));
  const text = (els.revText?.value || "").trim().slice(0, 400);

  // Rasm yuklash olib tashlandi
  if(text.length < 2){
    alert("Sharh matni kamida 2 ta belgidan iborat bo‘lsin.");
    return;
  }

  els.revSend.disabled = true;
  const oldLabel = els.revSend.textContent;
  els.revSend.textContent = "Yuborilmoqda...";

  try{
    const authorName = (user.displayName || user.email || "Foydalanuvchi").toString();
    const revRef = doc(db, "products", productId, "reviews", user.uid);

    await runTransaction(db, async (tx) => {
      const revSnap = await tx.get(revRef);
      const prev = revSnap.exists() ? (revSnap.data() || {}) : {};
      const createdAt = prev.createdAt ? prev.createdAt : serverTimestamp();

      tx.set(revRef, {
        uid: user.uid,
        authorName,
        stars,
        text,
        updatedAt: serverTimestamp(),
        createdAt
      }, { merge: true });
    });

    if(els.revText) els.revText.value = "";

    // Real stats: Firestore aggregate orqali yangilab qo‘yamiz
    await refreshStats(productId, true);

    applyFilterSort();
  }catch(err){
    console.error(err);
    alert("Sharh yuborishda xatolik. Keyinroq urinib ko‘ring.");
  }finally{
    els.revSend.disabled = false;
    els.revSend.textContent = oldLabel;
  }
});

// viewer actions
els.viewerCart?.addEventListener("click", ()=>{
  const p = products.find(x=>x.id===viewer.productId);
  if(!p) return;
  handleAddToCart(p, { openCartAfter: true });
});
els.viewerBuy?.addEventListener("click", ()=>{
  const p = products.find(x=>x.id===viewer.productId);
  if(!p) return;
  handleAddToCart(p, { openCartAfter: true });
});
window.addEventListener("keydown", (e)=>{
  if(vState.open && e.key === "Escape"){
    closeVariantModal();
    return;
  }
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
els.checkoutBtn?.addEventListener("click", async ()=>{
  if(!currentUser){
    // prompt login
    toast("Avval kirish qiling (Google / Telegram).");
    document.getElementById('authCard')?.scrollIntoView({behavior:'smooth'});
    return;
  }
  if(cart.length === 0){
    toast("Savatcha bo'sh.");
    return;
  }

  // Build order payload
  const items = cart.map(ci=>{
    const p = products.find(x=>x.id===ci.id);
    const pr = p ? getVariantPricing(p, {color: ci.color||null, size: ci.size||null}) : {price:0};
    return {
      productId: ci.id,
      name: p?.name || "",
      color: ci.color || null,
      size: ci.size || null,
      qty: Number(ci.qty||1),
      priceUZS: Number(pr.price||0),
    };
  });

  const totalUZS = items.reduce((s,it)=> s + (it.priceUZS||0) * (it.qty||0), 0);

  try{
    await addDoc(collection(db, "orders"), {
      uid: currentUser.uid,
      status: "created",
      items,
      totalUZS,
      createdAt: new Date(),
      source: "web",
    });
    toast("Buyurtma qabul qilindi ✅");
  }catch(e){
    console.warn("order create failed", e);
    toast("Buyurtma yuborilmadi. Qayta urinib ko'ring.");
    return;
  }

  // Optional Telegram share (operator uchun qulay)
  const lines = items.map(it=>{
    const variant = [it.color, it.size].filter(Boolean).join(" / ");
    return `${it.name}${variant?` (${variant})`:``} x${it.qty} = ${moneyUZS((it.priceUZS||0)*(it.qty||0))}`;
  });
  const msg = `OrzuMall buyurtma:%0A${encodeURIComponent(lines.join("\n"))}%0A%0AJami: ${encodeURIComponent(moneyUZS(totalUZS))}`;
  window.open(`https://t.me/share/url?url=&text=${msg}`, "_blank");

  // clear cart locally
  cart.length = 0;
  saveLS(LS.cart, cart);
  updateBadges();
  renderPanel("cart");
});





/* =========================
   Profile modal (one-time fill + pencil edit)
========================= */
function profileStorageKey(uid){ return `om_profile_v1_${uid}`; }

function safeJSONParse(s){
  try{ return JSON.parse(s); } catch(e){ return null; }
}

async function loadRegionData(){
  try{
    const res = await fetch("./region.json?v=1", { cache: "no-store" });
    if(!res.ok) throw new Error("region.json fetch failed");
    return await res.json();
  }catch(e){
    console.warn("region.json load error", e);
    return { regions: [] };
  }
}

function setSelectOptions(sel, items, placeholder){
  sel.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  sel.appendChild(ph);
  for(const it of items){
    const opt = document.createElement("option");
    opt.value = it;
    opt.textContent = it;
    sel.appendChild(opt);
  }
}

function setFieldsDisabled(disabled){
  if(els.pfPhone) els.pfPhone.disabled = disabled;
  if(els.pfRegion) els.pfRegion.disabled = disabled;
  if(els.pfDistrict) els.pfDistrict.disabled = disabled;
  if(els.pfPost) els.pfPost.disabled = disabled;
  if(els.profileSave) els.profileSave.hidden = disabled;
}

function openProfile(){
  if(!els.profileOverlay) return;
  showOverlay(els.profileOverlay);
}
function closeProfile(){
  if(!els.profileOverlay) return;
  hideOverlay(els.profileOverlay);
}

window.__omProfile = (function(){
  let regionData = null;
  let currentUser = null;
  let isCompleted = false;

  function readProfile(uid){
    const raw = localStorage.getItem(profileStorageKey(uid));
    const obj = raw ? safeJSONParse(raw) : null;
    return obj && typeof obj === "object" ? obj : null;
  }

  function writeProfile(uid, data){
    localStorage.setItem(profileStorageKey(uid), JSON.stringify(data));
  }

  function computePhone(user){
    const p1 = user?.phoneNumber || "";
    const p2 = (user?.providerData || []).map(x=>x?.phoneNumber).find(Boolean) || "";
    return p1 || p2 || "";
  }

  function renderHeader(user){
    const name = user?.displayName || user?.email || user?.phoneNumber || "User";
    const initial = (name || "U").trim().slice(0,1).toUpperCase();

    if(els.profileName) els.profileName.textContent = name;
    if(els.profileUid) els.profileUid.textContent = `UID: ${user.uid}`;

    if(els.profileAvatar){
      const photo = user.photoURL;
      if(photo){
        els.profileAvatar.innerHTML = `<img src="${photo}" alt="avatar" />`;
      } else {
        els.profileAvatar.textContent = initial;
      }
    }
  }

  function populateDistricts(regionName, selectedDistrict){
    const region = (regionData?.regions || []).find(r=>r.name===regionName);
    const districts = region ? region.districts.map(d=>d.name) : [];
    setSelectOptions(els.pfDistrict, districts, "Tumanni tanlang");
    if(selectedDistrict) els.pfDistrict.value = selectedDistrict;
    populatePosts(regionName, selectedDistrict, null);
  }

  function populatePosts(regionName, districtName, selectedPost){
    const region = (regionData?.regions || []).find(r=>r.name===regionName);
    const district = region ? region.districts.find(d=>d.name===districtName) : null;
    const posts = district ? (district.posts || []) : [];
    setSelectOptions(els.pfPost, posts, "Pochta indeks");
    if(selectedPost) els.pfPost.value = selectedPost;
  }

  async function ensureRegionLoaded(){
    if(regionData) return regionData;
    regionData = await loadRegionData();
    const regions = (regionData.regions || []).map(r=>r.name);
    setSelectOptions(els.pfRegion, regions, "Viloyatni tanlang");
    setSelectOptions(els.pfDistrict, [], "Tumanni tanlang");
    setSelectOptions(els.pfPost, [], "Pochta indeks");
    return regionData;
  }

  async function syncUser(user){
    currentUser = user || null;
    if(!user) return;

    await ensureRegionLoaded();
    renderHeader(user);

    const saved = readProfile(user.uid);
    isCompleted = !!saved?.completedAt;

    // phone: auto fill from auth only if empty or first time
    const autoPhone = computePhone(user);
    if(els.pfPhone){
      els.pfPhone.value = saved?.phone || autoPhone || "";
      // If saved exists but phone empty, still keep autoPhone visible (user can edit only via pencil)
    }

    if(els.pfRegion){
      els.pfRegion.value = saved?.region || "";
      populateDistricts(saved?.region || "", saved?.district || "");
      if(els.pfPost) els.pfPost.value = saved?.post || "";
    }

    // lock after first save
    setFieldsDisabled(isCompleted);
  }

  async function open(){
    if(!currentUser) return;
    await syncUser(currentUser);
    openProfile();
  }

  function enableEdit(){
    // allow editing only when completed; if not completed, already editable
    setFieldsDisabled(false);
    isCompleted = false; // but keep completedAt in storage until saved again
  }

  function save(){
    if(!currentUser) return;
    const phone = (els.pfPhone?.value || "").trim();
    const region = els.pfRegion?.value || "";
    const district = els.pfDistrict?.value || "";
    const post = els.pfPost?.value || "";

    if(!region || !district || !post){
      alert("Iltimos, viloyat, tuman va pochta indeksini tanlang.");
      return;
    }

    const payload = {
      phone,
      region,
      district,
      post,
      completedAt: new Date().toISOString()
    };

    writeProfile(currentUser.uid, payload);
    isCompleted = true;
    setFieldsDisabled(true);
    closeProfile();
  }

  // wire events
  if(els.avatarBtn){
    els.avatarBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      if(document.body.classList.contains("signed-in")) open();
    });
  }
  if(els.heroAuthJump){
    els.heroAuthJump.addEventListener("click", ()=>{
      // If signed-in -> open profile, else jump to login card
      if(document.body.classList.contains("signed-in")){
        try{ open(); }catch(e){ openProfile(); }
      }else{
        els.authCard?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        // small pulse to draw attention
        els.authCard?.classList?.add("pulse");
        setTimeout(()=>els.authCard?.classList?.remove("pulse"), 800);
      }
    });
  }

  if(els.profileClose) els.profileClose.addEventListener("click", closeProfile);
  if(els.profileOverlay){
    els.profileOverlay.addEventListener("click", (e)=>{
      if(e.target === els.profileOverlay) closeProfile();
    });
  }
  document.addEventListener("keydown", (e)=>{
    if(e.key==="Escape"){
      if(els.vOverlay && !els.vOverlay.hidden) closeVariantModal();
      else if(els.profileOverlay && !els.profileOverlay.hidden) closeProfile();
      else if(els.imgViewer && !els.imgViewer.hidden) closeImgViewer();
    }
  });

  if(els.profileEditBtn) els.profileEditBtn.addEventListener("click", ()=>{
    enableEdit();
  });

  if(els.profileSave) els.profileSave.addEventListener("click", save);

  // region change
  if(els.pfRegion) els.pfRegion.addEventListener("change", ()=>{
    populateDistricts(els.pfRegion.value, "");
  });
  if(els.pfDistrict) els.pfDistrict.addEventListener("change", ()=>{
    populatePosts(els.pfRegion.value, els.pfDistrict.value, "");
  });

  return { open, syncUser };
})();

onAuthStateChanged(auth, (user)=> setUserUI(user));

await loadProducts();
updateBadges();


/* ===== Inline rating near cart (compact) ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll(".pcard").forEach(card=>{
    const actions = card.querySelector(".pactions");
    if(!actions) return;
    if(actions.querySelector(".pratingInline")) return;

    const rating = card.querySelector(".prating");
    if(!rating) return;

    const inline = document.createElement("div");
    inline.className = "pratingInline";
    inline.innerHTML = rating.innerHTML;
    actions.prepend(inline);
  });
});
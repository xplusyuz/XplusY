
/* ========= TELEGRAM ADMIN NOTIFY (NO FUNCTIONS) =========
   Sends a lightweight notification to admin chat when a new order is created.
   Uses GET (Image beacon) and/or no-cors POST to avoid CORS issues.
   Requires window.TG_ADMIN { botToken, chatId } from telegram-config.js.
*/
function tgAdminEnabled(){
  return typeof window !== "undefined"
    && window.TG_ADMIN
    && typeof window.TG_ADMIN.botToken === "string"
    && window.TG_ADMIN.botToken.trim().length > 10
    && typeof window.TG_ADMIN.chatId === "string"
    && window.TG_ADMIN.chatId.trim().length > 2;
}
function tgEscape(s){ return String(s??"").replace(/[<>&]/g, c=>({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[c])); }

function tgSendAdmin(text){
  try{
    if(!tgAdminEnabled()) return;
    const token = window.TG_ADMIN.botToken.trim();
    const chatId = window.TG_ADMIN.chatId.trim();
    const base = `https://api.telegram.org/bot${token}/sendMessage`;
    // 1) GET beacon (no CORS)
    const url = base + `?chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(text)}&disable_web_page_preview=true`;
    const img = new Image();
    img.src = url;
    // 2) best-effort POST (no-cors) — ok if GET is blocked
    try{
      const body = new URLSearchParams({ chat_id: chatId, text, disable_web_page_preview: "true" }).toString();
      fetch(base, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body });
    }catch(_e){}
  }catch(_e){}
}
function tgNotifyNewOrder(o){
  try{
    if(!tgAdminEnabled()) return;
    const lines = [
      "🛒 Yangi buyurtma!",
      `ID: ${o.orderId || o.id || ""}`,
      `Summa: ${o.totalUZS || o.total || 0} so'm`,
      `To'lov: ${o.provider || o.paymentType || ""}`,
      o.shipping?.phone ? `Tel: ${o.shipping.phone}` : (o.phone ? `Tel: ${o.phone}` : ""),
      o.shipping?.addressText ? `Manzil: ${o.shipping.addressText}` : "",
    ].filter(Boolean);
    tgSendAdmin(lines.join("\n"));
  }catch(_e){}
}

import { auth, db } from "./firebase-config.js";
import { PAYME_MERCHANT_ID, PAYME_LANG } from "./payme-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  getAggregateFromServer,
  average,
  count,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";


/* =========================
   Telegram WebApp detect
========================= */
const IS_TG_WEBAPP = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
function getTgWebUser(){
  try{
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    return u && typeof u === "object" ? u : null;
  }catch(_e){ return null; }
}
if(IS_TG_WEBAPP){
  try{ window.Telegram.WebApp.ready(); }catch(_e){}
  try{ window.Telegram.WebApp.expand(); }catch(_e){}
}

/* =========================
   Toast helper
========================= */
function toast(message, type="info"){
  try{
    const id = "om_toast_host";
    let host = document.getElementById(id);
    if(!host){
      host = document.createElement("div");
      host.id = id;
      host.style.position = "fixed";
      host.style.left = "50%";
      host.style.bottom = "18px";
      host.style.transform = "translateX(-50%)";
      host.style.zIndex = "99999";
      host.style.display = "flex";
      host.style.flexDirection = "column";
      host.style.gap = "8px";
      host.style.pointerEvents = "none";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.textContent = String(message ?? "");
    el.style.maxWidth = "min(92vw, 520px)";
    el.style.padding = "12px 14px";
    el.style.borderRadius = "14px";
    el.style.background = "rgba(15,23,42,.92)";
    el.style.color = "#fff";
    el.style.boxShadow = "0 12px 28px rgba(0,0,0,.22)";
    el.style.fontSize = "14px";
    el.style.lineHeight = "1.25";
    el.style.pointerEvents = "auto";
    el.style.opacity = "0";
    el.style.transition = "opacity .18s ease, transform .18s ease";
    el.style.transform = "translateY(8px)";
    host.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    const ttl = type === "error" ? 3800 : 2600;
    setTimeout(()=>{
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(()=> el.remove(), 220);
    }, ttl);
  }catch(e){
    // fallback
    alert(message);
  }
}


let currentUser = null;
let isEditing = false;

// Normalize price / createdAt for reliable client-side sorting
function parseUZS(value){
  // Accept number or strings like "680,000 so'm" / "680000".
  if(typeof value === "number" && Number.isFinite(value)) return value;
  if(value == null) return 0;
  const s = String(value);
  const digits = s.replace(/[^0-9]/g, "");
  const n = parseInt(digits || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function toMillis(ts){
  try{
    if(!ts) return 0;
    if(typeof ts === "number" && Number.isFinite(ts)) return ts;
    if(ts.toMillis) return ts.toMillis();
    if(ts.toDate) return +ts.toDate();
    const d = new Date(ts);
    return Number.isNaN(+d) ? 0 : +d;
  }catch(e){
    return 0;
  }
}

// Lightweight interest tracking -> Firestore events (used to compute real popularity)
async function logEvent(type, productId){
  try{
    if(!currentUser) return;
    await addDoc(collection(db, "events"), {
      uid: currentUser.uid,
      type,
      productId: String(productId),
      createdAt: serverTimestamp(),
      ua: navigator.userAgent || "",
    });
  }catch(e){
    console.warn("logEvent failed", e);
  }
}


const els = {
  avatar: document.getElementById("avatar"),
  avatarBtn: document.getElementById("avatarBtn"),
  avatarFallback: document.getElementById("avatarFallback"),  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  tagBar: document.getElementById("tagBar"),
  q: document.getElementById("q"),
  sort: document.getElementById("sort"),  authCard: document.getElementById("authCard"),
  tabLogin: document.getElementById("tabLogin"),
  tabSignup: document.getElementById("tabSignup"),
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),
  loginPhone: document.getElementById("loginPhone"),
  loginPass: document.getElementById("loginPass"),
  btnLogin: document.getElementById("btnLogin"),
  signupName: document.getElementById("signupName"),
  signupPhone: document.getElementById("signupPhone"),
  signupPass: document.getElementById("signupPass"),
  signupPass2: document.getElementById("signupPass2"),
  btnSignup: document.getElementById("btnSignup"),
  authNotice: document.getElementById("authNotice"),
  authNotice2: document.getElementById("authNotice2"),
  heroAuthJump: document.getElementById("heroAuthJump"),

  // new UI
  favViewBtn: document.getElementById("favViewBtn"),
  cartBtn: document.getElementById("cartBtn"),
  favCount: document.getElementById("favCount"),
  cartCount: document.getElementById("cartCount"),

  overlay: document.getElementById("overlay"),
  sidePanel: document.getElementById("sidePanel"),

  // SPA views
  viewHome: document.getElementById("view-home"),
  viewCategories: document.getElementById("view-categories"),
  viewFav: document.getElementById("view-fav"),
  viewCart: document.getElementById("view-cart"),
  viewProfile: document.getElementById("view-profile"),
  navBar: document.querySelector(".mobile-bottom-bar"),

  // categories page
  catList: document.getElementById("catList"),
  catCrumbs: document.getElementById("catCrumbs"),
  catBackBtn: document.getElementById("catBackBtn"),
  catApplyBtn: document.getElementById("catApplyBtn"),
  catClearBtn: document.getElementById("catClearBtn"),
  catEmpty: document.getElementById("catEmpty"),

  // favorites/cart pages
  favPageList: document.getElementById("favPageList"),
  favPageEmpty: document.getElementById("favPageEmpty"),
  cartPageList: document.getElementById("cartPageList"),
  cartPageEmpty: document.getElementById("cartPageEmpty"),
  cartTotalPage: document.getElementById("cartTotalPage"),
  cartSelectAllPage: document.getElementById("cartSelectAllPage"),
  paymeBtnPage: document.getElementById("paymeBtnPage"),
  tgShareBtnPage: document.getElementById("tgShareBtnPage"),
  clearCartPage: document.getElementById("clearCartPage"),
  orderBtnPage: document.getElementById("orderBtnPage"),
  checkoutSheet: document.getElementById("checkoutSheet"),
  checkoutClose: document.getElementById("checkoutClose"),
  checkoutSubmit: document.getElementById("checkoutSubmit"),
  shipAddress: document.getElementById("shipAddress"),
  useMyLocation: document.getElementById("useMyLocation"),
  shipCoordsText: document.getElementById("shipCoordsText"),

  // profile page

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

  // orders (profile page)
  ordersReload: document.getElementById("ordersReload"),
  ordersList: document.getElementById("ordersList"),
  ordersEmpty: document.getElementById("ordersEmpty"),
  panelTitle: document.getElementById("panelTitle"),
  panelClose: document.getElementById("panelClose"),
  panelList: document.getElementById("panelList"),
  panelEmpty: document.getElementById("panelEmpty"),
  panelBottom: document.getElementById("panelBottom"),
  panelSelectRow: document.getElementById("panelSelectRow"),
  selectAllBox: document.getElementById("selectAllBox"),
  selectAllLabel: document.getElementById("selectAllLabel"),
  totalRow: document.getElementById("totalRow"),
  cartTotal: document.getElementById("cartTotal"),
  paymeBtn: document.getElementById("paymeBtn"),
  tgShareBtn: document.getElementById("tgShareBtn"),
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
  return [ els.vOverlay, els.imgViewer].some(el=>el && !el.hidden);
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
// Cart selection (for partial checkout / later buy)
let cartSelected = new Set(); // contains cart item keys
let lastCartKeys = new Set(cart.map(x=>x.key)); // track additions (so deselected items stay deselected)

function syncCartSelected(autoSelectNew=true){
  const keys = new Set(cart.map(x=>x.key));

  // first run: default everything selected
  if(cartSelected.size === 0){
    cartSelected = new Set(keys);
    lastCartKeys = new Set(keys);
    return;
  }

  // drop removed items
  cartSelected = new Set(Array.from(cartSelected).filter(k=>keys.has(k)));

  // auto-select ONLY newly added items (do not re-select deselected ones)
  if(autoSelectNew){
    for(const k of keys){
      if(!lastCartKeys.has(k)) cartSelected.add(k);
    }
  }

  lastCartKeys = new Set(keys);
}

function allCartSelected(){
  if(cart.length === 0) return false;
  return cart.every(x=>cartSelected.has(x.key));
}

function selectedCartItems(){
  syncCartSelected(true);
  return cart.filter(ci=>cartSelected.has(ci.key));
}

// migrate legacy cart items: {id,qty} -> {key,id,color,size,qty}
cart = (cart||[]).map(x=>{
  if(x && x.key) return x;
  const id = x?.id;
  const qty = x?.qty ?? 1;
  const key = `${id}::::`;
  return {key, id, color:null, size:null, qty, image:null};
}); // [{id, qty}]


/* ================== PHONE + PASSWORD AUTH ================== */
function normPhone(raw){
  const s = String(raw||"").trim();
  const digits = s.replace(/\D+/g, "");
  if(!digits) return null;

  // Accept: 9 digits (UZ local), 12 digits starting with 998, or full +998...
  if(digits.length === 9){
    return "+998" + digits;
  }
  if(digits.length === 12 && digits.startsWith("998")){
    return "+" + digits;
  }
  if(digits.length === 13 && digits.startsWith("998")){ // just in case
    return "+" + digits.slice(0,12);
  }
  if(digits.length >= 10 && digits.length <= 15){
    // best-effort E164
    return "+" + digits;
  }
  return null;
}
function phoneToEmail(e164){
  // Map phone to a stable pseudo-email for Firebase email/password auth
  const d = String(e164).replace(/\D+/g, "");
  return `p${d}@orzumall.phone`;
}
function showAuthNotice(el, msg, kind){
  if(!el) return;
  el.hidden = false;
  el.textContent = msg;
  el.classList.remove("isError","isOk");
  if(kind === "error") el.classList.add("isError");
  if(kind === "ok") el.classList.add("isOk");
}
function clearAuthNotices(){
  if(els.authNotice){ els.authNotice.hidden = true; els.authNotice.textContent=""; els.authNotice.classList.remove("isError","isOk"); }
  if(els.authNotice2){ els.authNotice2.hidden = true; els.authNotice2.textContent=""; els.authNotice2.classList.remove("isError","isOk"); }
}
function setAuthTab(which){
  const isLogin = which === "login";
  els.tabLogin?.classList.toggle("isActive", isLogin);
  els.tabSignup?.classList.toggle("isActive", !isLogin);
  els.tabLogin?.setAttribute("aria-selected", String(isLogin));
  els.tabSignup?.setAttribute("aria-selected", String(!isLogin));
  if(els.loginForm) els.loginForm.hidden = !isLogin;
  if(els.signupForm) els.signupForm.hidden = isLogin;
  clearAuthNotices();
}

// Tabs
els.tabLogin?.addEventListener("click", ()=> setAuthTab("login"));
els.tabSignup?.addEventListener("click", ()=> setAuthTab("signup"));

// Login
els.loginForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAuthNotices();

  const phone = normPhone(els.loginPhone?.value);
  const pass = String(els.loginPass?.value || "");
  if(!phone) return showAuthNotice(els.authNotice, "Telefon raqam noto‘g‘ri. Masalan: +998901234567", "error");
  if(pass.length < 6) return showAuthNotice(els.authNotice, "Parol kamida 6 ta belgidan iborat bo‘lsin.", "error");

  try{
    const email = phoneToEmail(phone);
    await signInWithEmailAndPassword(auth, email, pass);
    showAuthNotice(els.authNotice, "Kirish muvaffaqiyatli ✅", "ok");
  }catch(err){
    console.error(err);
    showAuthNotice(els.authNotice, "Kirish xato. Telefon yoki parol noto‘g‘ri.", "error");
  }
});

// Signup
els.signupForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearAuthNotices();

  const name = String(els.signupName?.value || "").trim();
  const phone = normPhone(els.signupPhone?.value);
  const pass = String(els.signupPass?.value || "");
  const pass2 = String(els.signupPass2?.value || "");

  if(!name) return showAuthNotice(els.authNotice2, "Ismni kiriting.", "error");
  if(!phone) return showAuthNotice(els.authNotice2, "Telefon raqam noto‘g‘ri. Masalan: +998901234567", "error");
  if(pass.length < 6) return showAuthNotice(els.authNotice2, "Parol kamida 6 ta belgidan iborat bo‘lsin.", "error");
  if(pass !== pass2) return showAuthNotice(els.authNotice2, "Parollar bir xil emas.", "error");

  try{
    const email = phoneToEmail(phone);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    // Firestore user doc + auto numericId
    const u = cred.user;
    const userRef = doc(db, "users", u.uid);

    await runTransaction(db, async (tx)=>{
      const counterRef = doc(db, "meta", "counters");
      const counterSnap = await tx.get(counterRef);
      const data = counterSnap.exists() ? counterSnap.data() : {};
      const cur = (data && data.userCounter) ? Number(data.userCounter) : 0;
      const next = cur + 1;
      tx.set(counterRef, { userCounter: next }, { merge: true });
      tx.set(userRef, {
        uid: u.uid,
        name,
        phone,
        numericId: next,
        createdAt: serverTimestamp(),
        role: "user"
      }, { merge: true });
    });

    showAuthNotice(els.authNotice2, "Ro‘yxatdan o‘tish muvaffaqiyatli ✅", "ok");
    setAuthTab("login");
    if(els.loginPhone) els.loginPhone.value = phone;
    if(els.loginPass) els.loginPass.focus();
  }catch(err){
    console.error(err);
    const code = String(err?.code || "");
    if(code.includes("auth/email-already-in-use")){
      showAuthNotice(els.authNotice2, "Bu telefon raqam bilan akkaunt mavjud. Kirish bo‘limidan kiring.", "error");
    }else{
      showAuthNotice(els.authNotice2, "Ro‘yxatdan o‘tishda xatolik. Qayta urinib ko‘ring.", "error");
    }
  }
});

// Logout
els.profileLogout?.addEventListener("click", async ()=>{ await signOut(auth); });
/* ================== /PHONE + PASSWORD AUTH ================== */


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
els.favViewBtn?.addEventListener("click", ()=> goTab("fav"));
els.cartBtn?.addEventListener("click", ()=> goTab("cart"));
els.panelClose?.addEventListener("click", closePanel);
els.overlay?.addEventListener("click", closePanel);
// cart select all
els.selectAllBox?.addEventListener("change", ()=>{
  if((els.panelTitle?.textContent || "").trim() !== "Savatcha") return;
  if(els.selectAllBox.checked){
    cartSelected = new Set(cart.map(x=>x.key));
  } else {
    cartSelected = new Set();
  }
  updateCartSelectUI();
  renderPanel("cart");
});


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
  if(vState.openCartAfter) goTab("cart");
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
    const sel = new Set(selectedCartItems().map(x=>x.key));
    if(sel.size === 0){
      toast("Hech narsa tanlanmagan.");
      return;
    }
    cart = cart.filter(x=>!sel.has(x.key));
    saveLS(LS.cart, cart);
    cartSelected = new Set(cart.map(x=>x.key));
  }
  updateBadges();
  renderPanel(els.panelTitle.textContent.includes("Sevimli") ? "fav" : "cart");
  updateCartSelectUI();
  if(viewMode === "fav") applyFilterSort();
});
function buildSelectedItems(){
  const _selCart = selectedCartItems();
  if(_selCart.length === 0) return { ok:false, reason:"Hech narsa tanlanmagan.", sel:[], items:[], totalUZS:0 };
  const items = _selCart.map(ci=>{
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
  if(!Number.isFinite(totalUZS) || totalUZS <= 0) return { ok:false, reason:"Jami summa noto‘g‘ri.", sel:_selCart, items, totalUZS:0 };
  return { ok:true, reason:"", sel:_selCart, items, totalUZS };
}

async function createOrderDoc({orderId, provider, status, items, totalUZS, amountTiyin}){
  if(!currentUser) throw new Error("no_user");
  const orderRef = doc(db, "orders", orderId);
  await setDoc(orderRef, {
    uid: currentUser.uid,
    status,
    items,
    totalUZS,
    amountTiyin: amountTiyin ?? null,
    provider,
    createdAt: serverTimestamp(),
    source: "web",
  }, { merge: true });

// also store under user subcollection to avoid composite index for profile history
const userOrderRef = doc(db, "users", currentUser.uid, "orders", orderId);
await setDoc(userOrderRef, {
  uid: currentUser.uid,
  status,
  items,
  totalUZS,
  amountTiyin: amountTiyin ?? null,
  provider,
  createdAt: serverTimestamp(),
  orderId,
  source: "web",
}, { merge: true });

  // notify admin via Telegram (optional)
  try{ tgNotifyNewOrder({ orderId, provider, totalUZS }); }catch(_e){}
}

function removePurchasedFromCart(sel){
  const purchased = new Set((sel||[]).map(x=>x.key));
  cart = cart.filter(x=>!purchased.has(x.key));
  saveLS(LS.cart, cart);
  cartSelected = new Set(cart.map(x=>x.key));
  updateBadges();
  renderCartPage?.();
  renderPanel?.("cart");
  updateCartSelectUI();
}

async function startPaymeCheckout(){
  if(!currentUser){
    toast("Avval kirish qiling (Google / Telegram).");
    document.getElementById('authCard')?.scrollIntoView({behavior:'smooth'});
    return;
  }
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }

  const built = buildSelectedItems();
  if(!built.ok){ toast(built.reason); return; }

  if(!PAYME_MERCHANT_ID || String(PAYME_MERCHANT_ID).includes("YOUR_")){
    toast("PAYME_MERCHANT_ID sozlanmagan (public/payme-config.js).");
    return;
  }

  // Payme amount is in tiyin
  const amountTiyin = Math.round(built.totalUZS * 100);
  const orderId = String(Date.now()); // digits-only

  try{
    await createOrderDoc({
      orderId,
      provider: "payme",
      status: "pending_payment",
      items: built.items,
      totalUZS: built.totalUZS,
      amountTiyin,
    });
    removePurchasedFromCart(built.sel);
  }catch(e){
    console.warn("order create failed", e);
    toast("Buyurtma yaratilmadi. Qayta urinib ko'ring.");
    return;
  }

  const returnUrl = `${location.origin}/payme_return.html?order_id=${encodeURIComponent(orderId)}`;
  const params = `m=${PAYME_MERCHANT_ID};ac.order_id=${orderId};a=${amountTiyin};l=${PAYME_LANG};c=${encodeURIComponent(returnUrl)}`;
  const b64 = btoa(unescape(encodeURIComponent(params)));
  window.location.href = `https://checkout.paycom.uz/${b64}`;
}

async function shareOrderTelegram(){
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  const built = buildSelectedItems();
  if(!built.ok){ toast(built.reason); return; }

  const orderId = String(Date.now());
  try{
    if(currentUser){
      await createOrderDoc({
        orderId,
        provider: "telegram",
        status: "shared_telegram",
        items: built.items,
        totalUZS: built.totalUZS,
        amountTiyin: null,
      });
    }
  }catch(e){
    console.warn("telegram order create failed", e);
  }

  const lines = built.items.map(it=>{
    const variant = [it.color, it.size].filter(Boolean).join(" / ");
    return `${it.name}${variant?` (${variant})`:``} x${it.qty} = ${moneyUZS((it.priceUZS||0)*(it.qty||0))}`;
  });
  const msg = `OrzuMall buyurtma (ID: ${orderId}):%0A${encodeURIComponent(lines.join("\n"))}%0A%0AJami: ${encodeURIComponent(moneyUZS(built.totalUZS))}`;
  window.open(`https://t.me/share/url?url=&text=${msg}`, "_blank");
}

els.paymeBtn?.addEventListener("click", startPaymeCheckout);
els.paymeBtnPage?.addEventListener("click", startPaymeCheckout);
els.tgShareBtn?.addEventListener("click", shareOrderTelegram);
els.tgShareBtnPage?.addEventListener("click", shareOrderTelegram);

// Cart -> single order flow
els.orderBtnPage?.addEventListener("click", ()=>{
  if(cart.length === 0){ toast("Savatcha bo'sh."); return; }
  openCheckout();
});
els.checkoutClose?.addEventListener("click", closeCheckout);
els.checkoutSubmit?.addEventListener("click", createOrderFromCheckout);

els.useMyLocation?.addEventListener("click", ()=>{
  if(!navigator.geolocation){
    toast("Geolokatsiya qo‘llab-quvvatlanmaydi.");
    return;
  }
  navigator.geolocation.getCurrentPosition((pos)=>{
    shipLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    initShipMapOnce();
    try{
      if(shipMap){
        shipMap.setView([shipLatLng.lat, shipLatLng.lng], 16);
        if(!shipMarker) shipMarker = L.marker([shipLatLng.lat, shipLatLng.lng]).addTo(shipMap);
        else shipMarker.setLatLng([shipLatLng.lat, shipLatLng.lng]);
      }
    }catch(e){}
    if(els.shipCoordsText) els.shipCoordsText.textContent = `Tanlandi: ${shipLatLng.lat.toFixed(5)}, ${shipLatLng.lng.toFixed(5)}`;
  }, ()=>{
    toast("Lokatsiyani olishga ruxsat berilmadi.");
  }, { enableHighAccuracy: true, timeout: 8000 });
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
}


function setEditing(on){
  isEditing = !!on;
  // when editing => enable fields; otherwise lock fields
  setFieldsDisabled(!isEditing);
  if(els.profileSave) els.profileSave.hidden = !isEditing;
  const vp = document.getElementById("view-profile");
  if(vp) vp.classList.toggle("editing", isEditing);
}

function openProfile(){ goTab("profile"); }
function closeProfile(){ goTab("home"); }

window.__omProfile = (function(){
  let regionData = null;
  let currentUser = null;
  let isEditing = false;
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

    // start in view mode; editing only via ✏️
    setEditing(false);
  }

  async function open(){
    if(!currentUser) return;
    await syncUser(currentUser);
    openProfile();
  }

  function enableEdit(){
    // allow editing only when completed; if not completed, already editable
    setEditing(true);
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
    setEditing(false);
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
document.addEventListener("keydown", (e)=>{
    if(e.key==="Escape"){
      if(els.vOverlay && !els.vOverlay.hidden) closeVariantModal();
      else if(null && !null.hidden) closeProfile();
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

/* =========================
   Mobile Bottom Bar (App-like)
========================= */
function initMobileBottomBar(){
  // Start SPA routing on first load
  handleHash();
}

document.addEventListener("DOMContentLoaded", initMobileBottomBar);
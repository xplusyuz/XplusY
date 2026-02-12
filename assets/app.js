/* OrzuMall Static + Firebase (Variant A+) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, limit,
  doc, setDoc, deleteDoc, getDoc, onSnapshot, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function fmt(n){
  if (n == null || isNaN(n)) return "";
  const s = Math.round(Number(n)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>t.classList.remove("show"), 1600);
}
function safeConfig(){
  const cfg = window.__FIREBASE_CONFIG__;
  if(!cfg || !cfg.apiKey || cfg.apiKey==="PASTE_ME") return null;
  return cfg;
}

/* ===== Data helpers ===== */
function pickImage(p){
  if (p.image) return p.image;
  if (Array.isArray(p.images) && p.images.length) return p.images[0];
  if (p.imagesByColor && typeof p.imagesByColor === "object"){
    const colors = Object.keys(p.imagesByColor);
    for (const c of colors){
      const v = p.imagesByColor[c];
      if (Array.isArray(v) && v.length) return v[0];
      if (typeof v === "string") return v;
    }
  }
  return null;
}
function calcDiscount(p){
  if (p.discountPercent != null) return Number(p.discountPercent);
  if (p.oldPrice && p.price) {
    const d = (1 - (Number(p.price)/Number(p.oldPrice))) * 100;
    if (isFinite(d) && d > 0) return Math.round(d);
  }
  return 0;
}
function ratingStars(r){
  const x = Math.max(0, Math.min(5, Number(r||0)));
  const full = Math.floor(x);
  const half = (x - full) >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    "<i class='fas fa-star'></i>".repeat(full) +
    (half ? "<i class='fas fa-star-half-alt'></i>" : "") +
    "<i class='far fa-star'></i>".repeat(empty)
  );
}
function getCatPair(p){
  // priority:
  // - category string as parent
  // - tags[0] as parent, tags[1] as child
  const tags = Array.isArray(p.tags) ? p.tags.map(String) : [];
  const parent = (p.category ? String(p.category) : (tags[0] || "Boshqa"));
  const child = (tags[1] || "");
  return { parent, child };
}

/* ===== Firebase ===== */
let app, db, auth, uid=null;
let products=[];
let currentFilter = { parent:"all", child:"" };
let searchText="";

const state = {
  favorites: new Set(),
};

async function ensureFirebase(){
  const cfg = safeConfig();
  if(!cfg){
    $("#fbWarn").style.display = "block";
    return false;
  }
  app = initializeApp(cfg);
  db = getFirestore(app);
  auth = getAuth(app);

  try{
    await new Promise((res)=> {
      const unsub = onAuthStateChanged(auth, (u)=>{
        if (u){
          uid = u.uid;
          unsub();
          res();
        }
      });
    });
    if(!uid){
      await signInAnonymously(auth);
    }
  }catch(err){
    console.error(err);
    $("#fbWarn").style.display = "block";
    $("#fbWarn").textContent = "Firebase Auth xato: Anonymous Sign-in yoqilganini tekshiring.";
    return false;
  }

  await ensureUserDoc(); // OM ID create
  wireCounters();
  return true;
}

function omFromNumeric(n){
  const s = String(n).padStart(6,"0");
  return `OM${s}`;
}

async function ensureUserDoc(){
  if(!uid || !db) return;
  const uref = doc(db, "users", uid);
  const cur = await getDoc(uref);
  if(cur.exists()){
    const d = cur.data() || {};
    renderProfile(d);
    return;
  }
  // transaction to increment /meta/counters.userCounter
  const cref = doc(db, "meta", "counters");
  try{
    const numericId = await runTransaction(db, async (tx)=>{
      const csnap = await tx.get(cref);
      const prev = csnap.exists() ? Number(csnap.data().userCounter||0) : 0;
      const next = prev + 1;
      tx.set(cref, { userCounter: next }, { merge:true });
      tx.set(uref, {
        numericId: next,
        omId: omFromNumeric(next),
        createdAt: serverTimestamp()
      }, { merge:true });
      return next;
    });
    const d = { numericId, omId: omFromNumeric(numericId) };
    renderProfile(d);
  }catch(e){
    console.error(e);
    // fallback: create without numericId
    await setDoc(uref, { createdAt: serverTimestamp() }, { merge:true });
    renderProfile({ omId: "OM??????" });
  }
}

function renderProfile(d){
  $("#profUid").textContent = uid ? uid.slice(0,8) + "…" : "-";
  $("#profOm").textContent = d.omId || (d.numericId ? omFromNumeric(d.numericId) : "OM??????");
  $("#profName").textContent = d.name || "Mehmon";
}

/* ===== Products ===== */
async function loadProducts(){
  const q = query(collection(db,"products"), orderBy("createdAt","desc"), limit(80));
  let snap;
  try{
    snap = await getDocs(q);
  }catch(e){
    snap = await getDocs(collection(db,"products"));
  }
  products = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  renderHome();
  renderCategoriesPage();
}

function filteredProducts(){
  return products.filter(p=>{
    const t = (p.title||"").toLowerCase();
    const okSearch = !searchText || t.includes(searchText);
    const { parent, child } = getCatPair(p);

    const okParent = (currentFilter.parent==="all") || (parent===currentFilter.parent);
    const okChild  = (!currentFilter.child) || (child===currentFilter.child);
    return okSearch && okParent && okChild;
  });
}

function productCard(p){
  const img = pickImage(p);
  const d = calcDiscount(p);
  const r = Number(p.rating||0);
  const rc = Number(p.reviewsCount||0);
  const ins = p.installmentText ? `<div style="margin-top:6px;color:var(--muted);font-size:11px"><i class="fas fa-coins"></i> ${escapeHtml(p.installmentText)}</div>` : "";
  const favOn = state.favorites.has(p.id);

  return `
  <div class="card" data-id="${p.id}">
    <div class="img">
      ${img ? `<img src="${img}" alt="${escapeHtml(p.title||"Mahsulot")}">` : `<div class="ph"><i class="fas fa-image"></i></div>`}
      ${d>0 ? `<div class="discount">-${d}%</div>` : ``}
    </div>
    <div class="info">
      <div class="title" title="${escapeHtml(p.title||"")}">${escapeHtml(p.title||"Nomsiz mahsulot")}</div>
      <div class="price">
        <div class="cur">${fmt(p.price)} so‘m</div>
        ${p.oldPrice ? `<div class="old">${fmt(p.oldPrice)} so‘m</div>` : ``}
      </div>
      <div class="rating">
        <span>${ratingStars(r)}</span>
        <span class="meta">${rc ? `(${rc})` : ""}</span>
      </div>
      ${ins}
      <div class="actions">
        <button class="btn dark js-fav" title="Saralangan" aria-label="Saralangan">
          <i class="fas fa-heart"></i>
        </button>
        <button class="btn gold js-cart" aria-label="Savatga qo‘shish">
          <i class="fas fa-cart-plus"></i> Savatga
        </button>
      </div>
    </div>
  </div>`;
}

function hydrateCardButtons(root){
  $$(".card", root).forEach(card=>{
    const id = card.dataset.id;
    const favBtn = $(".js-fav", card);
    const cartBtn = $(".js-cart", card);

    const favOn = state.favorites.has(id);
    favBtn.style.opacity = favOn ? "1" : ".65";
    favBtn.style.borderColor = favOn ? "rgba(212,175,55,.40)" : "rgba(34,41,58,.9)";
    favBtn.style.background = favOn ? "rgba(212,175,55,.10)" : "rgba(255,255,255,.04)";
    favBtn.querySelector("i").style.color = favOn ? "var(--gold2)" : "var(--text)";

    cartBtn.onclick = ()=> addToCart(id, 1);
    favBtn.onclick = ()=> toggleFavorite(id);
  });
}

/* ===== UI pages ===== */
function setActivePage(page){
  $$(".page").forEach(p=>p.classList.remove("active"));
  $(`#page-${page}`).classList.add("active");
  $$(".nav-item").forEach(n=>n.classList.toggle("active", n.dataset.page===page));
}

function renderHome(){
  const list = filteredProducts();
  const grid = $("#grid-home");
  if(!list.length){
    grid.innerHTML = `<div class="empty">Mahsulot topilmadi</div>`;
    return;
  }
  grid.innerHTML = list.slice(0, 60).map(productCard).join("");
  hydrateCardButtons(grid);
}

function renderCategoriesPage(){
  const box = $("#catList");
  // build tree: parent -> set(children)
  const tree = new Map();
  for (const p of products){
    const { parent, child } = getCatPair(p);
    if(!tree.has(parent)) tree.set(parent, new Set());
    if(child) tree.get(parent).add(child);
  }

  if(!tree.size){
    box.innerHTML = `<div class="empty">Kategoriya yo‘q</div>`;
    return;
  }

  const cards = [];
  for (const [parent, children] of tree.entries()){
    const kids = Array.from(children);
    cards.push(`
      <div class="card" style="margin:0 16px 12px; padding:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-weight:900"><i class="fas fa-tags" style="color:var(--gold2)"></i> ${escapeHtml(parent)}</div>
          <button class="btn gold" style="flex:0; padding:8px 12px;" data-parent="${escapeHtml(parent)}" data-child="">
            Ko‘rish <i class="fas fa-arrow-right"></i>
          </button>
        </div>
        ${kids.length ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
          ${kids.map(ch=>`<button class="cat-chip" data-parent="${escapeHtml(parent)}" data-child="${escapeHtml(ch)}" style="margin:0;">${escapeHtml(ch)}</button>`).join("")}
        </div>` : `<div class="muted" style="margin-top:8px;font-size:12px;">Bo‘lim ichida subkategoriya yo‘q</div>`}
      </div>
    `);
  }
  box.innerHTML = cards.join("");

  box.onclick = (e)=>{
    const btn = e.target.closest("[data-parent]");
    if(!btn) return;
    currentFilter.parent = btn.dataset.parent;
    currentFilter.child = btn.dataset.child || "";
    $("#q").value = ""; searchText="";
    setActivePage("home");
    renderHome();
    toast("Filtr qo‘yildi");
  };
}

/* ===== Cart / Favorites ===== */
async function addToCart(productId, inc){
  if(!uid || !db){ toast("Firebase sozlanmagan"); return; }
  const ref = doc(db, "users", uid, "cart", productId);
  const cur = await getDoc(ref);
  const qty = (cur.exists() ? (cur.data().qty||1) : 0) + inc;
  await setDoc(ref, { qty, addedAt: serverTimestamp() }, { merge:true });
  toast("Savatga qo‘shildi");
}

async function toggleFavorite(productId){
  if(!uid || !db){ toast("Firebase sozlanmagan"); return; }
  const ref = doc(db, "users", uid, "favorites", productId);
  const cur = await getDoc(ref);
  if(cur.exists()){
    await deleteDoc(ref);
    state.favorites.delete(productId);
    toast("Saralangandan olib tashlandi");
  }else{
    await setDoc(ref, { addedAt: serverTimestamp() }, { merge:true });
    state.favorites.add(productId);
    toast("Saralanganlarga qo‘shildi");
  }
  renderHome();
}

function wireCounters(){
  if(!uid || !db) return;

  onSnapshot(collection(db, "users", uid, "cart"), snap=>{
    const n = snap.size;
    $("#cartCount").textContent = String(n);
    $("#navCartCount").textContent = String(n);
    $("#cartCount").style.display = n ? "inline-block" : "none";
    $("#navCartCount").style.display = n ? "inline-block" : "none";
  });

  onSnapshot(collection(db, "users", uid, "favorites"), snap=>{
    const n = snap.size;
    $("#favCount").textContent = String(n);
    $("#navFavCount").textContent = String(n);
    $("#favCount").style.display = n ? "inline-block" : "none";
    $("#navFavCount").style.display = n ? "inline-block" : "none";
    state.favorites = new Set(snap.docs.map(d=>d.id));
    renderHome();
    renderFavoritesPage();
  });
}

function renderFavoritesPage(){
  const grid = $("#grid-fav");
  const list = products.filter(p=>state.favorites.has(p.id));
  if(!list.length){
    grid.innerHTML = `<div class="empty">Saralanganlar bo‘sh</div>`;
    return;
  }
  grid.innerHTML = list.map(productCard).join("");
  hydrateCardButtons(grid);
}

/* ===== Cart modal ===== */
async function openCart(){
  if(!uid || !db){ toast("Firebase sozlanmagan"); return; }
  $("#cartModalBackdrop").classList.add("show");
  const listEl = $("#cartList");
  listEl.innerHTML = "<div class='empty'>Yuklanmoqda...</div>";

  onSnapshot(collection(db, "users", uid, "cart"), async (snap)=>{
    if(!snap.size){
      listEl.innerHTML = "<div class='empty'>Savat bo‘sh</div>";
      $("#cartTotal").textContent = "0 so‘m";
      return;
    }
    const items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    const byId = new Map(products.map(p=>[p.id,p]));
    let total = 0;

    listEl.innerHTML = items.map(it=>{
      const p = byId.get(it.id) || { title:"Mahsulot", price:0 };
      const img = pickImage(p);
      const qty = Number(it.qty||1);
      const sum = Number(p.price||0) * qty;
      total += sum;
      return `
        <div class="row" data-id="${it.id}">
          ${img ? `<img src="${img}" alt="">` : `<div class="ph"><i class="fas fa-image"></i></div>`}
          <div class="rinfo">
            <div class="t">${escapeHtml(p.title||"Mahsulot")}</div>
            <div class="p">${fmt(p.price||0)} so‘m</div>
          </div>
          <div class="qty">
            <button class="qminus">-</button>
            <div class="n">${qty}</div>
            <button class="qplus">+</button>
          </div>
        </div>
      `;
    }).join("");

    $("#cartTotal").textContent = `${fmt(total)} so‘m`;

    $$(".row", listEl).forEach(row=>{
      const id = row.dataset.id;
      $(".qminus", row).onclick = async ()=>{
        const ref = doc(db, "users", uid, "cart", id);
        const cur = await getDoc(ref);
        const q = (cur.exists()?Number(cur.data().qty||1):1) - 1;
        if(q<=0) await deleteDoc(ref);
        else await setDoc(ref, { qty:q }, { merge:true });
      };
      $(".qplus", row).onclick = async ()=>{
        const ref = doc(db, "users", uid, "cart", id);
        const cur = await getDoc(ref);
        const q = (cur.exists()?Number(cur.data().qty||1):0) + 1;
        await setDoc(ref, { qty:q }, { merge:true });
      };
    });
  });
}
function closeCart(){ $("#cartModalBackdrop").classList.remove("show"); }

/* ===== Boot ===== */
function initUI(){
  // Logout (if exists)
  const lo = document.getElementById('btnLogout');
  if(lo){
    lo.onclick = async ()=>{ try{ await signOut(auth); }catch(e){} window.location.href='login.html'; };
  }

  $("#btnCart").onclick = openCart;
  $("#btnFav").onclick = ()=> setActivePage("favorites");
  $("#btnBell").onclick = ()=> toast("Bildirishnomalar keyin qo‘shiladi");

  $("#q").addEventListener("input", (e)=>{
    searchText = (e.target.value||"").trim().toLowerCase();
    renderHome();
  });

  $$(".nav-item").forEach(n=>{
    n.onclick = ()=>{
      const page = n.dataset.page;
      setActivePage(page);
      if(page==="favorites") renderFavoritesPage();
      if(page==="categories") renderCategoriesPage();
      if(page==="profile") toast("Profil ma’lumotlari pastda");
    };
  });

  $("#cartClose").onclick = closeCart;
  $("#cartModalBackdrop").addEventListener("click",(e)=>{
    if(e.target.id==="cartModalBackdrop") closeCart();
  });

  $("#checkoutBtn").onclick = ()=> toast("Checkout (A+) keyingi bosqichda");
}

async function boot(){
  initUI();
  const ok = await ensureFirebase();
  if(!ok) return;
  await loadProducts();
}

boot();

/* OrzuMall Static + Firebase (Variant A) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy, limit,
  doc, setDoc, deleteDoc, getDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function fmt(n){
  if (n == null || isNaN(n)) return "";
  const s = Math.round(Number(n)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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

let app, db, auth, uid = null;
let products = [];
let currentCategory = "all";
let searchText = "";

const state = {
  cart: new Map(),       // productId -> {qty}
  favorites: new Set()   // productId
};

function pickImage(p){
  // priority: image -> images[0] -> imagesByColor first -> null
  if (p.image) return p.image;
  if (Array.isArray(p.images) && p.images.length) return p.images[0];
  if (p.imagesByColor && typeof p.imagesByColor === "object"){
    const colors = Object.keys(p.imagesByColor);
    for (const c of colors){
      const arr = p.imagesByColor[c];
      if (Array.isArray(arr) && arr.length) return arr[0];
      if (typeof arr === "string") return arr;
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

function productCard(p){
  const img = pickImage(p);
  const d = calcDiscount(p);
  const r = Number(p.rating||0);
  const rc = Number(p.reviewsCount||0);
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
      <div class="actions">
        <button class="btn dark js-fav" title="Saralangan">
          <i class="fas fa-heart"></i>
        </button>
        <button class="btn gold js-cart">
          <i class="fas fa-cart-plus"></i> Savatga
        </button>
      </div>
    </div>
  </div>`;
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ===== UI ===== */
function setActivePage(page){
  $$(".page").forEach(p=>p.classList.remove("active"));
  $(`#page-${page}`).classList.add("active");

  $$(".nav-item").forEach(n=>n.classList.remove("active"));
  $(`.nav-item[data-page="${page}"]`).classList.add("active");
}

function renderCategories(){
  const el = $("#cats");
  const cats = new Map(); // key->count
  for (const p of products){
    const c = (p.category || (Array.isArray(p.tags)&&p.tags[0]) || "Boshqa").toString();
    cats.set(c, (cats.get(c)||0)+1);
  }
  const items = [["all","Hammasi", "fa-layer-group"]];
  for (const [k] of cats.entries()){
    items.push([k, k, "fa-tag"]);
  }
  el.innerHTML = items.map(([key,label,icon])=>`
    <button class="cat-chip ${key===currentCategory?"active":""}" data-cat="${escapeHtml(key)}">
      <i class="fas ${icon}"></i><span>${escapeHtml(label)}</span>
    </button>
  `).join("");

  el.addEventListener("click",(e)=>{
    const b = e.target.closest(".cat-chip");
    if(!b) return;
    currentCategory = b.dataset.cat;
    $$(".cat-chip").forEach(x=>x.classList.toggle("active", x.dataset.cat===currentCategory));
    renderProducts();
  }, { once:true });
}

function filteredProducts(){
  return products.filter(p=>{
    const t = (p.title||"").toLowerCase();
    const cat = (p.category || (Array.isArray(p.tags)&&p.tags[0]) || "Boshqa").toString();
    const okCat = (currentCategory==="all") || (cat===currentCategory);
    const okSearch = !searchText || t.includes(searchText);
    return okCat && okSearch;
  });
}

function renderProducts(){
  const list = filteredProducts();
  const grid = $("#grid-home");
  if(!list.length){
    grid.innerHTML = `<div class="empty">Mahsulot topilmadi</div>`;
    return;
  }
  grid.innerHTML = list.slice(0, 40).map(productCard).join("");
  hydrateCardButtons(grid);
}

function hydrateCardButtons(root){
  $$(".card", root).forEach(card=>{
    const id = card.dataset.id;
    const favBtn = $(".js-fav", card);
    const cartBtn = $(".js-cart", card);

    favBtn.style.opacity = state.favorites.has(id) ? "1" : ".65";
    favBtn.style.borderColor = state.favorites.has(id) ? "rgba(212,175,55,.40)" : "rgba(34,41,58,.9)";
    favBtn.style.background = state.favorites.has(id) ? "rgba(212,175,55,.10)" : "rgba(255,255,255,.04)";
    favBtn.querySelector("i").style.color = state.favorites.has(id) ? "var(--gold2)" : "var(--text)";

    cartBtn.addEventListener("click", ()=> addToCart(id, 1));
    favBtn.addEventListener("click", ()=> toggleFavorite(id));
  });
}

/* ===== Firebase data ===== */
async function ensureFirebase(){
  const cfg = safeConfig();
  if(!cfg){
    $("#fbWarn").style.display = "block";
    return false;
  }
  app = initializeApp(cfg);
  db = getFirestore(app);
  auth = getAuth(app);

  // anonymous auth for cart/fav
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
    if (!uid) {
      await signInAnonymously(auth);
    }
  }catch(err){
    console.error(err);
    $("#fbWarn").style.display = "block";
    $("#fbWarn").innerHTML = "Firebase Auth xato: Anonymous Sign-in yoqilganini tekshiring.";
    return false;
  }

  wireRealtimeCounters();
  return true;
}

function wireRealtimeCounters(){
  if(!uid || !db) return;

  onSnapshot(collection(db, "users", uid, "cart"), snap=>{
    $("#cartCount").textContent = String(snap.size);
    $("#navCartCount").textContent = String(snap.size);
    $("#cartCount").style.display = snap.size ? "inline-block" : "none";
    $("#navCartCount").style.display = snap.size ? "inline-block" : "none";
  });

  onSnapshot(collection(db, "users", uid, "favorites"), snap=>{
    $("#favCount").textContent = String(snap.size);
    $("#navFavCount").textContent = String(snap.size);
    $("#favCount").style.display = snap.size ? "inline-block" : "none";
    $("#navFavCount").style.display = snap.size ? "inline-block" : "none";
  });
}

async function loadProducts(){
  const q = query(collection(db, "products"), orderBy("createdAt","desc"), limit(60));
  let snap;
  try{
    snap = await getDocs(q);
  }catch(e){
    // if createdAt index missing, fallback
    snap = await getDocs(collection(db, "products"));
  }
  products = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  renderCategories();
  renderProducts();
}

/* ===== Cart/Favorites ===== */
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
  // update visuals in home grid
  renderProducts();
}

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
    // load product docs quickly from local cache
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

    // bind +/-
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

function closeCart(){
  $("#cartModalBackdrop").classList.remove("show");
}

/* ===== Favorites page ===== */
function renderFavoritesPage(){
  if(!uid || !db) return;
  const grid = $("#grid-fav");
  grid.innerHTML = "<div class='empty'>Yuklanmoqda...</div>";
  onSnapshot(collection(db, "users", uid, "favorites"), (snap)=>{
    if(!snap.size){
      grid.innerHTML = "<div class='empty'>Saralanganlar bo‘sh</div>";
      return;
    }
    const favIds = new Set(snap.docs.map(d=>d.id));
    state.favorites = favIds;
    const list = products.filter(p=>favIds.has(p.id));
    grid.innerHTML = list.map(productCard).join("");
    hydrateCardButtons(grid);
  });
}

/* ===== Orders page (placeholder) ===== */
function renderOrdersPage(){
  $("#ordersBox").innerHTML = `
    <div class="empty">
      Buyurtmalar bo‘limi (A variant) — keyingi bosqichda /orders kolleksiyasi bilan ulanadi.
      <div style="margin-top:10px" class="muted">Hozircha savat ishlaydi ✅</div>
    </div>`;
}

/* ===== Wire UI events ===== */
function initUI(){
  // header icons
  $("#btnCart").onclick = openCart;
  $("#btnFav").onclick = ()=>{ setActivePage("favorites"); };
  $("#btnBell").onclick = ()=> toast("Bildirishnomalar keyin qo‘shiladi");

  // search
  $("#q").addEventListener("input", (e)=>{
    searchText = (e.target.value||"").trim().toLowerCase();
    renderProducts();
  });

  // nav
  $$(".nav-item").forEach(n=>{
    n.onclick = ()=>{
      const page = n.dataset.page;
      setActivePage(page);
      if(page==="favorites") renderFavoritesPage();
      if(page==="orders") renderOrdersPage();
    };
  });

  // modal close
  $("#cartClose").onclick = closeCart;
  $("#cartModalBackdrop").addEventListener("click",(e)=>{
    if(e.target.id==="cartModalBackdrop") closeCart();
  });

  $("#checkoutBtn").onclick = ()=>{
    toast("Checkout (A variant) keyingi bosqichda");
  };
}

async function boot(){
  initUI();
  const ok = await ensureFirebase();
  if(!ok) return;
  await loadProducts();

  // favorites visuals quick sync (so heart states show correctly)
  onSnapshot(collection(db, "users", uid, "favorites"), (snap)=>{
    state.favorites = new Set(snap.docs.map(d=>d.id));
    // update home grid fast
    renderProducts();
  });
}

boot();

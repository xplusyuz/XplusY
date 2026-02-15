// OrzuMall Admin Panel (secure)
// Only admin email allowed (frontend guard + firestore rules recommended)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {"apiKey": "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM", "authDomain": "xplusy-760fa.firebaseapp.com", "projectId": "xplusy-760fa", "storageBucket": "xplusy-760fa.firebasestorage.app", "messagingSenderId": "992512966017", "appId": "1:992512966017:web:5e919dbc9b8d8abcb43c80", "measurementId": "G-459PLJ7P7L"};
const ADMIN_EMAIL = "sohibjonmath@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ===================== UI helpers ===================== */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

function toast(msg){
  const t = $("#toast");
  $("#toastTxt").innerHTML = msg;
  t.classList.add("show");
  clearTimeout(window.__tto);
  window.__tto = setTimeout(()=>t.classList.remove("show"), 2800);
}

function fmtMoney(n){
  if (n === null || n === undefined || n === "") return "";
  const x = Number(n);
  if (!Number.isFinite(x)) return String(n);
  return x.toLocaleString("uz-UZ");
}

function iso(ts){
  try {
    if (!ts) return "";
    // Firestore Timestamp
    if (ts.seconds) return new Date(ts.seconds*1000).toLocaleString("uz-UZ");
    return new Date(ts).toLocaleString("uz-UZ");
  } catch(e) {
    return "";
  }
}

function setTab(tab){
  $$("#tab-overview, #tab-products, #tab-orders, #tab-users, #tab-settings").forEach(el=>el.classList.add("hidden"));
  $("#tab-"+tab).classList.remove("hidden");
  $$(".nav button").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  $("#pageTitle").textContent = {
    overview:"Overview",
    products:"Mahsulotlar",
    orders:"Buyurtmalar",
    users:"Foydalanuvchilar",
    settings:"Sozlamalar"
  }[tab] || "Admin";
}

/* ===================== Security guard ===================== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.body.innerHTML = "";
    location.replace("./login.html");
    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    await signOut(auth);
    document.body.innerHTML = "";
    alert("Ruxsat yo‘q!");
    location.replace("../index.html");
    return;
  }

  $("#adminEmail").textContent = user.email;
  document.body.style.display = "block";

  bindNav();
  await refreshKPIs();
  await loadProducts();
});

/* ===================== Navigation ===================== */
function bindNav(){
  $$(".nav button").forEach(btn=>btn.addEventListener("click", () => {
    setTab(btn.dataset.tab);
  }));

  $("#logout").addEventListener("click", async () => {
    await signOut(auth);
    location.replace("./login.html");
  });

  $("#goSite").addEventListener("click", () => location.href = "../index.html");
  $("#openRules").addEventListener("click", () => {
    toast("Zip ichida: <b>firestore.rules.txt</b>");
  });

  // Products controls
  $("#btnNewProduct").addEventListener("click", () => openProductForm(null));
  $("#btnReloadProducts").addEventListener("click", loadProducts);
  $("#btnClearForm").addEventListener("click", () => openProductForm(null));
  $("#btnDeleteProduct").addEventListener("click", deleteCurrentProduct);
  $("#productForm").addEventListener("submit", saveProduct);

  // Orders/users reload
  $("#btnReloadOrders").addEventListener("click", loadOrders);
  $("#btnReloadUsers").addEventListener("click", loadUsers);
}

/* ===================== KPIs ===================== */
async function refreshKPIs(){
  const counts = {
    products: 0, orders: 0, users: 0
  };

  try {
    counts.products = (await getDocs(collection(db, "products"))).size;
  } catch(e) {}

  try {
    counts.orders = (await getDocs(collection(db, "orders"))).size;
  } catch(e) {}

  try {
    counts.users = (await getDocs(collection(db, "users"))).size;
  } catch(e) {}

  $("#kProducts").textContent = counts.products;
  $("#kOrders").textContent = counts.orders;
  $("#kUsers").textContent = counts.users;

  $("#bProducts").textContent = counts.products;
  $("#bOrders").textContent = counts.orders;
  $("#bUsers").textContent = counts.users;
}

/* ===================== Products ===================== */
let PRODUCTS = [];
let CURRENT_ID = null;

function openProductForm(p){
  CURRENT_ID = p?.id || null;
  $("#pid").value = CURRENT_ID || "";
  $("#ptitle").value = p?.title || "";
  $("#pprice").value = p?.price ?? "";
  $("#pold").value = p?.oldPrice ?? "";
  $("#pcat").value = p?.category || "";
  $("#ptags").value = Array.isArray(p?.tags) ? p.tags.join(", ") : (p?.tags || "");
  $("#pimgs").value = Array.isArray(p?.images) ? p.images.join("\n") : (p?.images || "");
  $("#pdesc").value = p?.description || "";

  $("#prodFormTitle").textContent = CURRENT_ID ? "Mahsulot tahrirlash" : "Mahsulot qo‘shish";
  $("#prodFormBadge").textContent = CURRENT_ID ? "edit" : "new";
  $("#btnDeleteProduct").style.display = CURRENT_ID ? "inline-block" : "none";

  setTab("products");
}

async function loadProducts(){
  toast("Mahsulotlar yuklanmoqda...");
  PRODUCTS = [];
  const tbody = $("#productsTable tbody");
  tbody.innerHTML = "";
  try {
    const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
    snap.forEach(d => {
      const data = d.data();
      PRODUCTS.push({ id:d.id, ...data });
    });
  } catch(e) {
    console.error(e);
    toast("Mahsulotlarni o‘qishda xatolik. Rules tekshiring.");
    return;
  }

  for (const p of PRODUCTS) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${escapeHtml(p.title || "")}</b><div class="note">${escapeHtml(p.id)}</div></td>
      <td>${fmtMoney(p.price)}</td>
      <td>${fmtMoney(p.oldPrice)}</td>
      <td>${escapeHtml(p.category || "")}</td>
      <td class="note">${escapeHtml(Array.isArray(p.tags)?p.tags.join(", "):(p.tags||""))}</td>
      <td>
        <div class="row-actions">
          <button class="btn small ok" data-act="edit" data-id="${p.id}">Edit</button>
          <button class="btn small danger" data-act="del" data-id="${p.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("button").forEach(b=>b.addEventListener("click", async (e)=>{
    const id = b.dataset.id;
    const act = b.dataset.act;
    const p = PRODUCTS.find(x=>x.id===id);
    if (!p) return;

    if (act==="edit") {
      openProductForm(p);
    } else if (act==="del") {
      if (!confirm("O‘chirasizmi?")) return;
      await deleteDoc(doc(db, "products", id));
      toast("O‘chirildi.");
      await refreshKPIs();
      await loadProducts();
    }
  }));

  await refreshKPIs();
  toast("Mahsulotlar: <b>"+PRODUCTS.length+"</b>");
}

async function saveProduct(ev){
  ev.preventDefault();

  const id = ($("#pid").value || "").trim();
  const payload = {
    title: ($("#ptitle").value || "").trim(),
    price: Number($("#pprice").value || 0),
    oldPrice: $("#pold").value ? Number($("#pold").value) : null,
    category: ($("#pcat").value || "").trim(),
    tags: ($("#ptags").value || "").split(",").map(s=>s.trim()).filter(Boolean),
    images: ($("#pimgs").value || "").split("\n").map(s=>s.trim()).filter(Boolean),
    description: ($("#pdesc").value || "").trim(),
    updatedAt: serverTimestamp()
  };

  if (!payload.title) return toast("Title kerak.");
  if (!Number.isFinite(payload.price) || payload.price < 0) return toast("Price xato.");

  try {
    if (id) {
      await updateDoc(doc(db, "products", id), payload);
      toast("Yangilandi ✅");
    } else {
      // create with random id
      const newId = "p_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
      await setDoc(doc(db, "products", newId), {
        ...payload,
        createdAt: serverTimestamp()
      });
      toast("Qo‘shildi ✅");
      openProductForm(null);
    }

    await refreshKPIs();
    await loadProducts();
  } catch(e) {
    console.error(e);
    toast("Saqlashda xatolik. Rules tekshiring.");
  }
}

async function deleteCurrentProduct(){
  const id = ($("#pid").value || "").trim();
  if (!id) return;
  if (!confirm("Mahsulotni o‘chirasizmi?")) return;
  try {
    await deleteDoc(doc(db, "products", id));
    toast("O‘chirildi ✅");
    openProductForm(null);
    await refreshKPIs();
    await loadProducts();
  } catch(e) {
    console.error(e);
    toast("O‘chirishda xatolik.");
  }
}

/* ===================== Orders (read-only) ===================== */
async function loadOrders(){
  toast("Buyurtmalar yuklanmoqda...");
  const tbody = $("#ordersTable tbody");
  tbody.innerHTML = "";
  try {
    const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200)));
    snap.forEach(d => {
      const o = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><b>${escapeHtml(d.id)}</b></td>
        <td class="note">${escapeHtml(o.userId || o.uid || "")}</td>
        <td>${fmtMoney(o.total || o.amount || 0)}</td>
        <td>${escapeHtml(o.status || "new")}</td>
        <td class="note">${escapeHtml(iso(o.createdAt))}</td>
      `;
      tbody.appendChild(tr);
    });
    await refreshKPIs();
    toast("Buyurtmalar OK");
  } catch(e) {
    console.error(e);
    toast("Buyurtmalarni o‘qishda xatolik.");
  }
}

/* ===================== Users (read-only) ===================== */
async function loadUsers(){
  toast("Foydalanuvchilar yuklanmoqda...");
  const tbody = $("#usersTable tbody");
  tbody.innerHTML = "";
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(300)));
    snap.forEach(d => {
      const u = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="note">${escapeHtml(d.id)}</td>
        <td><b>${escapeHtml(u.name || u.fullName || "")}</b></td>
        <td class="note">${escapeHtml(u.phone || "")}</td>
        <td class="note">${escapeHtml(u.role || "")}</td>
        <td class="note">${escapeHtml(iso(u.createdAt))}</td>
      `;
      tbody.appendChild(tr);
    });
    await refreshKPIs();
    toast("Users OK");
  } catch(e) {
    console.error(e);
    toast("Users o‘qishda xatolik.");
  }
}

/* ===================== Small utils ===================== */
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Lazy-load orders/users when tab opened
document.addEventListener("click", (e)=>{
  const b = e.target.closest("button[data-tab]");
  if (!b) return;
  const t = b.dataset.tab;
  if (t==="orders") loadOrders();
  if (t==="users") loadUsers();
});

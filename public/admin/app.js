import { FIREBASE_CONFIG, DEFAULT_ADMIN_EMAILS } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  writeBatch, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

function hasValidConfig(cfg){
  return cfg && typeof cfg === "object"
    && cfg.apiKey && cfg.projectId && cfg.authDomain;
}

if(!hasValidConfig(FIREBASE_CONFIG)){
  console.error("Firebase config is missing/invalid. Please provide firebaseConfig in /firebase-config.js or window.firebaseConfig.");
}

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const $ = (id)=>document.getElementById(id);

const state = {
  products: [],
  editingId: null,
  adminEmails: [...DEFAULT_ADMIN_EMAILS],
};

function isAdmin(user){
  if(!user?.email) return false;
  return state.adminEmails.map(x=>x.toLowerCase().trim()).includes(user.email.toLowerCase().trim());
}
function nowISO(){ return new Date().toISOString().split("T")[0]; }
function formatPrice(n){
  const v = Number(n||0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g," ") + " so'm";
}
function toast(msg, type="success"){
  const el = $("toast");
  $("toastMessage").textContent = msg;
  el.className = "toast show " + (type==="success"?"toast-success":"toast-error");
  el.querySelector("i").className = type==="success"?"fas fa-check-circle":"fas fa-exclamation-circle";
  setTimeout(()=>el.classList.remove("show"), 3000);
}
function esc(s){
  return (s??"").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function openModal(id){ $(id).style.display="flex"; }
function closeModal(id){ $(id).style.display="none"; }

async function loadAdminSettings(){
  try{
    const snap = await getDoc(doc(db,"meta","adminSettings"));
    if(snap.exists() && Array.isArray(snap.data().adminEmails) && snap.data().adminEmails.length){
      state.adminEmails = snap.data().adminEmails;
    }
  }catch(e){}
  $("adminEmailsInput").value = state.adminEmails.join(", ");
}
async function saveAdminSettings(){
  const user = auth.currentUser;
  if(!isAdmin(user)) return toast("Admin emas: saqlab bo'lmaydi","error");
  const arr = ($("adminEmailsInput").value||"").split(",").map(s=>s.trim()).filter(Boolean);
  state.adminEmails = arr.length?arr:[...DEFAULT_ADMIN_EMAILS];
  try{
    await setDoc(doc(db,"meta","adminSettings"), { adminEmails: state.adminEmails }, { merge:true });
    toast("Sozlamalar saqlandi");
  }catch(e){ toast("Xatolik: "+e.message,"error"); }
}

function normalize(p){
  const o = { ...p };
  o.id = o.id || p.id;
  o.price = Number(o.price||0);
  o.oldPrice = Number(o.oldPrice||0);
  o.popularScore = Number(o.popularScore||0);
  o.currency = o.currency || "UZS";
  o.tags = Array.isArray(o.tags)?o.tags:[];
  o.colors = Array.isArray(o.colors)?o.colors:[];
  o.sizes = Array.isArray(o.sizes)?o.sizes:[];
  o.images = Array.isArray(o.images)?o.images:[];
  o.variants = Array.isArray(o.variants)?o.variants:[];
  o.createdAt = o.createdAt || nowISO();
  if(o.imagesByColor && typeof o.imagesByColor !== "object") delete o.imagesByColor;
  return o;
}

async function fetchProducts(){
  try{
    $("syncState").textContent="Yuklanmoqda...";
    const snap = await getDocs(query(collection(db,"products"), orderBy("createdAt","desc")));
  state.products = snap.docs.map(d=>normalize({ id:d.id, ...d.data() }));
  renderTable();
  renderStats();
  $("syncState").textContent="Synced: "+new Date().toLocaleTimeString();
  }catch(e){
    console.error(e);
    $("syncState").textContent="Xato: yuklab bo'lmadi";
    toast("Firestore o'qishda xato: "+(e?.message||e), "error");
  }
}

function renderTable(list=null){
  const data = list || state.products;
  const body = $("productsTableBody");
  body.innerHTML="";
  if(!data.length){
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray)">Hech narsa topilmadi</td></tr>`;
    return;
  }
  data.forEach(p=>{
    const tr = document.createElement("tr");
    const old = p.oldPrice>0?`<span class="old-price">${formatPrice(p.oldPrice)}</span>`:"";
    const tags = (p.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join("") || `<span style="color:var(--gray)">-</span>`;
    const colors = (p.colors||[]).slice(0,3).map(c=>`<span class="color-preview" style="background:${esc(c.hex)}" title="${esc(c.name)}"></span>`).join("") || `<span style="color:var(--gray)">-</span>`;
    const sizes = (p.sizes||[]).slice(0,3).map(s=>`<span class="tag" style="background:rgba(76,201,240,.12);color:var(--success)">${esc(s)}</span>`).join(" ") || `<span style="color:var(--gray)">-</span>`;
    const popular = Math.max(0, Math.min(100, Number(p.popularScore||0)));
    const cls = popular>=80?"success":popular>=60?"warning":"danger";
    tr.innerHTML = `
      <td><span class="product-id">${esc(p.id)}</span></td>
      <td><div class="product-name" title="${esc(p.name||"")}">${esc(p.name||"")}</div>${p.subtitle?`<div style="font-size:.85rem;color:var(--gray);margin-top:5px">${esc(p.subtitle)}</div>`:""}</td>
      <td class="price-cell">${formatPrice(p.price)} ${old}<div style="font-size:.85rem;color:var(--gray)">${esc(p.currency||"UZS")}</div></td>
      <td><div class="tags-container">${tags}</div></td>
      <td>${colors}</td>
      <td>${sizes}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:60px;height:6px;background:var(--gray-light);border-radius:3px;overflow:hidden">
            <div style="width:${popular}%;height:100%;background:var(--${cls})"></div>
          </div>
          <span>${popular}</span>
        </div>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-light btn-sm edit-btn" data-id="${esc(p.id)}"><i class="fas fa-edit"></i></button>
          <button class="btn btn-light btn-sm del-btn" data-id="${esc(p.id)}"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
  document.querySelectorAll(".edit-btn").forEach(b=>b.addEventListener("click",()=>openEdit(b.dataset.id)));
  document.querySelectorAll(".del-btn").forEach(b=>b.addEventListener("click",()=>removeProduct(b.dataset.id)));
}

function renderStats(){
  $("totalProducts").textContent = state.products.length;
  const avgPrice = state.products.length ? Math.round(state.products.reduce((s,p)=>s+Number(p.price||0),0)/state.products.length) : 0;
  $("avgPrice").textContent = formatPrice(avgPrice).replace(" so'm","");
  const avgPopular = state.products.length ? Math.round(state.products.reduce((s,p)=>s+Number(p.popularScore||0),0)/state.products.length) : 0;
  $("avgPopular").textContent = avgPopular;
  const totalTags = state.products.reduce((s,p)=>s+(p.tags||[]).length,0);
  $("totalTags").textContent = totalTags;
}

function setView(view){
  $("productsView").classList.toggle("hidden", view!=="products");
  $("statsView").classList.toggle("hidden", view!=="stats");
  $("settingsView").classList.toggle("hidden", view!=="settings");
  document.querySelectorAll(".nav-link[data-view]").forEach(a=>a.classList.toggle("active", a.dataset.view===view));
  if(view==="stats") renderStatsPanels();
}

function renderStatsPanels(){
  const top = [...state.products].sort((a,b)=>Number(b.popularScore||0)-Number(a.popularScore||0)).slice(0,10);
  $("topPopularList").innerHTML = top.map(p=>`<div class="mini-row"><div class="k">${esc(p.id)} · ${esc((p.name||"").slice(0,34))}</div><div class="v">${Number(p.popularScore||0)}</div></div>`).join("");
  const map = new Map();
  state.products.forEach(p=>(p.tags||[]).forEach(t=>map.set(t,(map.get(t)||0)+1)));
  const topTags=[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
  $("topTagsList").innerHTML = topTags.map(([t,c])=>`<div class="mini-row"><div class="k">${esc(t)}</div><div class="v">${c}</div></div>`).join("");
}

/* ----- form helpers ----- */
function resetForm(){
  state.editingId=null;
  $("modalTitle").textContent="Yangi mahsulot";
  $("productForm").reset();
  $("createdAt").value = nowISO();
  $("currency").value = "UZS";
  $("tagsPreview").innerHTML="";
  $("colorsContainer").innerHTML="";
  $("sizesContainer").innerHTML="";
  $("imagesContainer").innerHTML="";
  $("variantsContainer").innerHTML='<p class="form-text">Variant narx qo\'yilsa ishlaydi.</p>';
  addColor(); addSize(); addImage();
  $("imagesByColorInput").value="";
}
function updateTagsPreview(){
  const tags = ($("tagsInput").value||"").split(",").map(s=>s.trim()).filter(Boolean);
  $("tagsPreview").innerHTML = tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("");
}
function addColor(name="", hex="#D4AF37"){
  const c=$("colorsContainer");
  const div=document.createElement("div");
  div.className="list-item";
  div.innerHTML=`<input class="form-control" placeholder="Rang nomi" value="${esc(name)}" style="flex:2">
    <input type="color" class="color-input" value="${esc(hex)}">
    <input class="form-control" placeholder="#HEX" value="${esc(hex)}" style="flex:1">
    <button type="button" class="btn btn-light btn-sm rm"><i class="fas fa-times"></i></button>`;
  c.appendChild(div);
  const color=div.querySelector('input[type="color"]');
  const hexInp=div.querySelectorAll("input")[2];
  color.addEventListener("input",()=>hexInp.value=color.value);
  hexInp.addEventListener("input",()=>{ if(/^#[0-9A-F]{6}$/i.test(hexInp.value)) color.value=hexInp.value; });
  div.querySelector(".rm").addEventListener("click",()=>{ if(c.querySelectorAll(".list-item").length>1) div.remove(); });
}
function addSize(val=""){
  const c=$("sizesContainer");
  const div=document.createElement("div");
  div.className="list-item";
  div.innerHTML=`<input class="form-control" placeholder="Masalan: M" value="${esc(val)}"><button type="button" class="btn btn-light btn-sm rm"><i class="fas fa-times"></i></button>`;
  c.appendChild(div);
  div.querySelector(".rm").addEventListener("click",()=>{ if(c.querySelectorAll(".list-item").length>1) div.remove(); });
}
function addImage(val=""){
  const c=$("imagesContainer");
  const div=document.createElement("div");
  div.className="list-item";
  div.innerHTML=`<input class="form-control" placeholder="https://..." value="${esc(val)}"><button type="button" class="btn btn-light btn-sm rm"><i class="fas fa-times"></i></button>`;
  c.appendChild(div);
  div.querySelector(".rm").addEventListener("click",()=>{ if(c.querySelectorAll(".list-item").length>1) div.remove(); });
}
function addVariant(v=null){
  const c=$("variantsContainer");
  const div=document.createElement("div");
  div.className="list-item";
  div.style.alignItems="flex-start";
  const o=v||{};
  div.innerHTML=`<div style="display:flex;flex-direction:column;gap:10px;flex:1">
      <div style="display:flex;gap:10px">
        <input class="form-control" placeholder="Color" value="${esc(o.color||"")}" style="flex:1">
        <input class="form-control" placeholder="Size" value="${esc(o.size||"")}" style="flex:1">
      </div>
      <div style="display:flex;gap:10px">
        <input type="number" class="form-control" placeholder="Price" value="${o.price??""}" style="flex:1">
        <input type="number" class="form-control" placeholder="Old" value="${o.oldPrice??0}" style="flex:1">
      </div>
      <input class="form-control" placeholder="Installment" value="${esc(o.installmentText||"")}">
    </div>
    <button type="button" class="btn btn-light btn-sm rm"><i class="fas fa-times"></i></button>`;
  c.appendChild(div);
  div.querySelector(".rm").addEventListener("click",()=>div.remove());
}

function parseImagesByColor(raw){
  if(!raw.trim()) return undefined;
  const obj={};
  raw.split(";").map(s=>s.trim()).filter(Boolean).forEach(pair=>{
    const [k,v]=pair.split("=").map(x=>(x||"").trim());
    if(!k||!v) return;
    obj[k]=v.split("|").map(x=>x.trim()).filter(Boolean);
  });
  return Object.keys(obj).length?obj:undefined;
}

function genId(){
  const nums=state.products.map(p=>String(p.id||"").replace(/^om/i,"")).map(s=>parseInt(s,10)).filter(n=>Number.isFinite(n));
  const last=nums.length?Math.max(...nums):0;
  return "om"+String(last+1).padStart(3,"0");
}

async function saveProduct(){
  const user=auth.currentUser;
  if(!isAdmin(user)) return toast("Admin emas: saqlab bo'lmaydi","error");
  const name=($("name").value||"").trim();
  const price=$("price").value;
  if(!name||!price) return toast("Nomi va narx shart","error");

  const id=state.editingId || genId();

  const tags=($("tagsInput").value||"").split(",").map(s=>s.trim()).filter(Boolean);

  const colors=[...document.querySelectorAll("#colorsContainer .list-item")].map(li=>{
    const ins=li.querySelectorAll("input");
    return { name: ins[0].value.trim(), hex: ins[2].value.trim() };
  }).filter(c=>c.name&&c.hex);

  const sizes=[...document.querySelectorAll("#sizesContainer .list-item input")].map(i=>i.value.trim()).filter(Boolean);
  const images=[...document.querySelectorAll("#imagesContainer .list-item input")].map(i=>i.value.trim()).filter(Boolean);

  const variants=[...document.querySelectorAll("#variantsContainer .list-item")].map(li=>{
    const ins=li.querySelectorAll("input");
    if(ins.length<5) return null;
    const price=ins[2].value.trim();
    if(!price) return null;
    return {
      color: ins[0].value.trim()||null,
      size: ins[1].value.trim()||null,
      price: Number(price),
      oldPrice: Number(ins[3].value||0),
      installmentText: ins[4].value.trim()||undefined
    };
  }).filter(Boolean);

  const data={
    name,
    subtitle:$("subtitle").value||"",
    description:$("description").value||"",
    price:Number(price),
    oldPrice:Number($("oldPrice").value||0),
    popularScore:Number($("popularScore").value||0),
    currency:$("currency").value||"UZS",
    installmentText:$("installmentText").value||"",
    createdAt:$("createdAt").value||nowISO(),
    tags, colors, sizes, images, variants,
    imagesByColor: parseImagesByColor($("imagesByColorInput").value||""),
    updatedAt: serverTimestamp(),
  };

  // clean empty
  Object.keys(data).forEach(k=>{
    const v=data[k];
    if(v==="" || (Array.isArray(v)&&v.length===0) || v===undefined) delete data[k];
  });

  try{
    await setDoc(doc(db,"products",id), data, { merge:true });
    toast(state.editingId?"Yangilandi":"Yangi mahsulot qo'shildi");
    closeModal("productModal");
    resetForm();
    await fetchProducts();
  }catch(e){ toast("Xatolik: "+e.message,"error"); }
}

function openEdit(id){
  const p=state.products.find(x=>x.id===id);
  if(!p) return;
  state.editingId=id;
  $("modalTitle").textContent="Tahrirlash";
  $("productId").value=p.id;
  $("name").value=p.name||"";
  $("subtitle").value=p.subtitle||"";
  $("price").value=Number(p.price||0);
  $("oldPrice").value=Number(p.oldPrice||0);
  $("popularScore").value=Number(p.popularScore||0);
  $("createdAt").value=p.createdAt||nowISO();
  $("description").value=p.description||"";
  $("installmentText").value=p.installmentText||"";
  $("currency").value=p.currency||"UZS";
  $("tagsInput").value=(p.tags||[]).join(", ");
  updateTagsPreview();

  $("colorsContainer").innerHTML="";
  (p.colors?.length?p.colors:[{name:"",hex:"#D4AF37"}]).forEach(c=>addColor(c.name,c.hex));
  $("sizesContainer").innerHTML="";
  (p.sizes?.length?p.sizes:[""]).forEach(s=>addSize(s));
  $("imagesContainer").innerHTML="";
  (p.images?.length?p.images:[""]).forEach(u=>addImage(u));

  if(p.imagesByColor && typeof p.imagesByColor==="object"){
    $("imagesByColorInput").value = Object.entries(p.imagesByColor).map(([k,arr])=>`${k}=${(arr||[]).join("|")}`).join("; ");
  }else $("imagesByColorInput").value="";

  $("variantsContainer").innerHTML='<p class="form-text">Variant narx qo\'yilsa ishlaydi.</p>';
  (p.variants||[]).forEach(v=>addVariant(v));

  openModal("productModal");
}

async function removeProduct(id){
  const user=auth.currentUser;
  if(!isAdmin(user)) return toast("Admin emas: o'chirib bo'lmaydi","error");
  if(!confirm(`"${id}" mahsulot o'chirilsinmi?`)) return;
  try{
    await deleteDoc(doc(db,"products",id));
    toast("O'chirildi");
    await fetchProducts();
  }catch(e){ toast("Xatolik: "+e.message,"error"); }
}

/* ---- JSON ---- */
function highlight(json){
  json=json.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (m)=>{
      let cls="json-number";
      if(/^"/.test(m)) cls=/:$/.test(m)?"json-key":"json-string";
      else if(/true|false/.test(m)) cls="json-boolean";
      else if(/null/.test(m)) cls="json-null";
      return `<span class="${cls}">${m}</span>`;
    });
}
function viewJson(){
  const data={ schemaVersion:7, items: state.products.map(p=>{const o={...p}; delete o.updatedAt; return o;}) };
  $("jsonViewer").innerHTML = highlight(JSON.stringify(data,null,2));
  openModal("jsonModal");
}
async function copyJson(){
  const data={ schemaVersion:7, items: state.products.map(p=>{const o={...p}; delete o.updatedAt; return o;}) };
  try{ await navigator.clipboard.writeText(JSON.stringify(data,null,2)); toast("Nusxalandi"); }
  catch(e){ toast("Clipboard xatolik: "+e.message,"error"); }
}
function downloadJson(){
  const data={ schemaVersion:7, items: state.products.map(p=>{const o={...p}; delete o.updatedAt; return o;}) };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="products.json";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  toast("Yuklab olindi");
}

/* ---- Import ---- */
function parseJsonText(text){
  const obj=JSON.parse(text);
  if(Array.isArray(obj)) return { schemaVersion:7, items: obj };
  if(obj && Array.isArray(obj.items)) return obj;
  throw new Error("items[] topilmadi");
}
async function importJson(){
  const user=auth.currentUser;
  if(!isAdmin(user)) return toast("Admin emas: import mumkin emas","error");

  let text=($("importPaste").value||"").trim();
  const file=$("importFile").files?.[0];
  if(!text && file) text=await file.text();
  if(!text) return toast("JSON kiriting yoki fayl tanlang","error");

  let obj;
  try{ obj=parseJsonText(text); }catch(e){ return toast("JSON xato: "+e.message,"error"); }
  const items=(obj.items||[]).map(normalize);
  if(!items.length) return toast("items[] bo'sh","error");

  const mode=$("importMode").value;
  try{
    if(mode==="replaceAll"){
      const snap=await getDocs(collection(db,"products"));
      const ids=snap.docs.map(d=>d.id);
      for(let i=0;i<ids.length;i+=450){
        const batch=writeBatch(db);
        ids.slice(i,i+450).forEach(id=>batch.delete(doc(db,"products",id)));
        await batch.commit();
      }
    }
    for(let i=0;i<items.length;i+=350){
      const batch=writeBatch(db);
      items.slice(i,i+350).forEach(p=>{
        const id=p.id || genId();
        const data={...p, updatedAt: serverTimestamp()};
        delete data.id;
        batch.set(doc(db,"products",id), data, { merge:true });
      });
      await batch.commit();
    }
    closeModal("importModal");
    toast("Import tugadi ✅");
    await fetchProducts();
  }catch(e){ toast("Import xatolik: "+e.message,"error"); }
}

/* ---- Auth ---- */
function renderUser(user){
  if(!user){
    $("adminName").textContent="Guest";
    $("adminEmail").textContent="—";
    $("adminAvatar").textContent="A";
    $("loginBtn").style.display="";
    $("logoutBtn").style.display="none";
    return;
  }
  $("adminName").textContent=user.displayName||"Admin";
  $("adminEmail").textContent=user.email||"—";
  $("adminAvatar").textContent=(user.displayName||user.email||"A").trim()[0].toUpperCase();
  $("loginBtn").style.display="none";
  $("logoutBtn").style.display="";
  if(!isAdmin(user)) toast("Read-only: admin emassiz","error");
  else toast("Admin ✅");
}

async function login(){
  try{ await signInWithPopup(auth, provider); }
  catch(e){ toast("Login xatolik: "+e.message,"error"); }
}
async function logout(){
  try{ await signOut(auth); toast("Chiqildi"); }
  catch(e){ toast("Chiqishda xatolik: "+e.message,"error"); }
}

/* ---- Events ---- */
function bind(){
  document.querySelectorAll(".nav-link[data-view]").forEach(a=>a.addEventListener("click",(e)=>{e.preventDefault(); setView(a.dataset.view);}));  
  $("addProductBtn").addEventListener("click",()=>{ resetForm(); openModal("productModal"); });
  $("saveProductBtn").addEventListener("click",saveProduct);
  $("closeModalBtn").addEventListener("click",()=>{ closeModal("productModal"); resetForm(); });
  $("cancelBtn").addEventListener("click",()=>{ closeModal("productModal"); resetForm(); });
  $("viewJsonBtn").addEventListener("click",viewJson);
  $("closeJsonModalBtn").addEventListener("click",()=>closeModal("jsonModal"));
  $("copyJsonBtn").addEventListener("click",copyJson);
  $("downloadJsonBtn").addEventListener("click",downloadJson);
  $("refreshBtn").addEventListener("click",fetchProducts);
  $("exportJsonNav").addEventListener("click",(e)=>{e.preventDefault(); downloadJson();});

  $("tagsInput").addEventListener("input",updateTagsPreview);
  $("addColorBtn").addEventListener("click",()=>addColor());
  $("addSizeBtn").addEventListener("click",()=>addSize());
  $("addImageBtn").addEventListener("click",()=>addImage());
  $("addVariantBtn").addEventListener("click",()=>addVariant());

  $("searchInput").addEventListener("input",()=>{
    const t=($("searchInput").value||"").toLowerCase().trim();
    if(!t) return renderTable();
    const filtered=state.products.filter(p=>
      (p.name||"").toLowerCase().includes(t) || (p.id||"").toLowerCase().includes(t) ||
      (p.subtitle||"").toLowerCase().includes(t) || (p.description||"").toLowerCase().includes(t) ||
      (p.tags||[]).some(x=>(x||"").toLowerCase().includes(t))
    );
    renderTable(filtered);
  });

  $("loginBtn").addEventListener("click",login);
  $("logoutBtn").addEventListener("click",logout);

  $("importJsonBtn").addEventListener("click",()=>openModal("importModal"));
  $("closeImportModalBtn").addEventListener("click",()=>closeModal("importModal"));
  $("importCancelBtn").addEventListener("click",()=>closeModal("importModal"));
  $("runImportBtn").addEventListener("click",importJson);

  $("saveSettingsBtn").addEventListener("click",saveAdminSettings);
  $("recalcStatsBtn").addEventListener("click",()=>{ renderStats(); renderStatsPanels(); toast("Hisoblandi"); });

  window.addEventListener("click",(e)=>{
    if(e.target===$("productModal")){ closeModal("productModal"); resetForm(); }
    if(e.target===$("jsonModal")) closeModal("jsonModal");
    if(e.target===$("importModal")) closeModal("importModal");
  });
}

onAuthStateChanged(auth, async (user)=>{
  renderUser(user);
  await loadAdminSettings();
  // refresh list after login/logout
  await fetchProducts();
});

document.addEventListener("DOMContentLoaded", async ()=>{
  bind();
  resetForm();
  if(!hasValidConfig(FIREBASE_CONFIG)){
    toast("Firebase config topilmadi. /firebase-config.js dagi firebaseConfig ni tekshiring.", "error");
  }
  await fetchProducts();
});

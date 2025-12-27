const ADMIN_EMAIL = "sohibjonmath@gmail.com";

// Firebase config ni o'zingnikiga qo'y:
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let state = {
  app: { version: 1, nav: [] },
  section: { title:"", chips:[{id:"all",label:"Hammasi"}], items:[] },
};

function parseChips(s){
  const out = [];
  (s||"").split(",").map(x=>x.trim()).filter(Boolean).forEach(pair=>{
    const [id,label] = pair.split(":").map(x=>x.trim());
    if(id && label) out.push({id,label});
  });
  return out.length ? out : [{id:"all",label:"Hammasi"}];
}

function renderNav(){
  const el = document.getElementById("navList");
  el.innerHTML = state.app.nav.map((n,i)=>`
    <div class="rowItem">
      <div style="font-weight:950">${n.icon||"✨"} ${n.label}</div>
      <div class="small">${n.id} → section: ${n.sectionId}</div>
      <button class="btnTiny" onclick="delNav(${i})" style="margin-top:8px">O'chirish</button>
    </div>
  `).join("");
}
window.delNav = (i)=>{ state.app.nav.splice(i,1); renderNav(); };

function renderItems(){
  const el = document.getElementById("itemsList");
  el.innerHTML = (state.section.items||[]).map((it,i)=>`
    <div class="rowItem">
      <div style="font-weight:950">${it.type} · ${it.title||""}</div>
      <div class="small">chip: ${it.chipId||"all"}</div>
      <div class="small">${it.imageUrl||""}</div>
      <button class="btnTiny" onclick="delItem(${i})" style="margin-top:8px">O'chirish</button>
    </div>
  `).join("");
}
window.delItem = (i)=>{ state.section.items.splice(i,1); renderItems(); };

async function guardAdmin(user){
  if(!user) throw new Error("Login yo'q");
  if(user.email !== ADMIN_EMAIL) throw new Error("Ruxsat yo'q (admin email mos emas)");
}

async function loadAll(){
  const appSnap = await db.collection("configs").doc("app").get();
  state.app = appSnap.exists ? appSnap.data() : { version:1, nav:[] };
  renderNav();
  await loadUsers();
}

async function loadUsers(){
  const top = await db.collection("users").orderBy("points","desc").limit(50).get();
  const el = document.getElementById("usersList");
  el.innerHTML = top.docs.map((d,i)=>{
    const u = d.data();
    const name = `${u?.profile?.firstName||"?"} ${u?.profile?.lastName||""}`.trim();
    return `<div class="rowItem">
      <div style="font-weight:950">#${i+1} · ${name}</div>
      <div class="small">${u.id} · ${u.points||0} pt</div>
    </div>`;
  }).join("");
}

document.getElementById("btnAuth").onclick = async ()=>{
  const provider = new firebase.auth.GoogleAuthProvider();
  const r = await auth.signInWithPopup(provider);
  await guardAdmin(r.user);
  await loadAll();
};

document.getElementById("btnLogout").onclick = ()=> auth.signOut();

document.getElementById("btnAddNav").onclick = ()=>{
  const label = document.getElementById("navLabel").value.trim();
  const icon = document.getElementById("navIcon").value.trim() || "✨";
  const sectionId = document.getElementById("navSectionId").value.trim();
  if(!label || !sectionId) return alert("Label va Section ID kerak");
  const id = label.toLowerCase().replace(/\s+/g,"-").slice(0,24);
  state.app.nav.push({ id, label, icon, sectionId });
  renderNav();
};

document.getElementById("btnAddItem").onclick = ()=>{
  const it = {
    type: document.getElementById("itType").value,
    chipId: document.getElementById("itChip").value.trim() || "all",
    title: document.getElementById("itTitle").value.trim(),
    subtitle: document.getElementById("itSub").value.trim(),
    imageUrl: document.getElementById("itImg").value.trim(),
    href: document.getElementById("itHref").value.trim()
  };
  if(!it.title || !it.imageUrl) return alert("Title va Image URL majburiy");
  if(it.type === "banner") delete it.subtitle;
  state.section.items.push(it);
  renderItems();
};

document.getElementById("btnPublish").onclick = async ()=>{
  const user = auth.currentUser;
  await guardAdmin(user);

  const secId = document.getElementById("secId").value.trim();
  if(!secId) return alert("Section ID kerak");
  state.section.title = document.getElementById("secTitle").value.trim() || secId;
  state.section.chips = parseChips(document.getElementById("secChips").value);

  state.app.version = (state.app.version || 1) + 1;

  await db.collection("configs").doc("app").set(state.app, { merge:true });
  await db.collection("sections").doc(secId).set(state.section, { merge:true });
  alert("✅ Publish bo'ldi (version yangilandi)");
};

auth.onAuthStateChanged(async (u)=>{
  if(!u) return;
  try{
    await guardAdmin(u);
    await loadAll();
  }catch(e){
    alert(e.message);
    auth.signOut();
  }
});
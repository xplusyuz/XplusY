import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const cfg = window.FIREBASE_CONFIG || {};
const ADMIN_EMAILS = window.ADMIN_EMAILS || ["sohibjonmath@gmail.com"];

const needs = !cfg.apiKey || cfg.apiKey==="PASTE_ME" || !cfg.projectId || cfg.projectId==="PASTE_ME";
const cfgWarn = document.getElementById("cfgWarn");
if(needs){ cfgWarn.hidden=false; }

const $ = (id)=>document.getElementById(id);

let app, auth, db;

let state = { navDoc:{version:1,nav:[]}, sections:{}, selectedNavId:null };

function ensureSection(sid){
  if(!state.sections[sid]) state.sections[sid]={ title:sid, chips:[{id:"all",label:"Hammasi"}], items:[] };
}
function selNav(){ return (state.navDoc.nav||[]).find(n=>n.id===state.selectedNavId)||null; }

function row(html){ const d=document.createElement("div"); d.className="itemRow"; d.innerHTML=html; return d; }

function renderNav(){
  const list=$("navList"); list.innerHTML="";
  (state.navDoc.nav||[]).forEach(n=>{
    list.appendChild(row(`<div class="grow"><div><b>${n.label||n.id}</b> <span class="meta">(${n.id})</span></div>
      <div class="meta">section: <span class="kbd">${n.sectionId||""}</span></div></div>
      <button class="btn small" data-act="select" data-id="${n.id}">Tanlash</button>
      <button class="btn small" data-act="del" data-id="${n.id}">O‘chirish</button>`));
  });
}
function renderSelected(){
  const n=selNav();
  if(!n){ $("selInfo").textContent="Hech narsa tanlanmagan"; $("secTitle").value=""; $("chipList").innerHTML=""; $("itemList").innerHTML=""; return; }
  $("selInfo").innerHTML=`Tanlangan: <b>${n.label}</b> · section: <span class="kbd">${n.sectionId}</span>`;
  ensureSection(n.sectionId);
  const s=state.sections[n.sectionId];
  $("secTitle").value=s.title||"";

  $("chipList").innerHTML="";
  (s.chips||[]).forEach((c,idx)=>{
    $("chipList").appendChild(row(`<div class="grow"><div><b>${c.label}</b> <span class="meta">(${c.id})</span></div></div>
      <button class="btn small" data-act="chipEdit" data-idx="${idx}">Edit</button>
      <button class="btn small" data-act="chipDel" data-idx="${idx}">Del</button>`));
  });

  $("itemList").innerHTML="";
  (s.items||[]).forEach((it,idx)=>{
    $("itemList").appendChild(row(`<div class="grow">
      <div><b>${it.title||"(no title)"}</b> <span class="meta">${it.kind||"card"}</span></div>
      <div class="meta">chip: <span class="kbd">${it.chipId||"all"}</span> · img: ${it.imageUrl?"yes":"no"}</div>
    </div>
    <button class="btn small" data-act="itemEdit" data-idx="${idx}">Edit</button>
    <button class="btn small" data-act="itemDel" data-idx="${idx}">Del</button>`));
  });
}

async function loadFromFS(){
  const navSnap = await getDoc(doc(db,"configs","nav"));
  state.navDoc = navSnap.exists()? navSnap.data(): {version:1, nav:[]};
  state.sections={};
  const ids=[...new Set((state.navDoc.nav||[]).map(n=>n.sectionId).filter(Boolean))];
  for(const sid of ids){
    const sSnap = await getDoc(doc(db,"sections",sid));
    state.sections[sid]=sSnap.exists()? sSnap.data(): {title:sid,chips:[{id:"all",label:"Hammasi"}],items:[]};
  }
  renderNav(); renderSelected();
}

function promptNav(){
  const label=prompt("Nav nomi (masalan: Bosh sahifa)","");
  if(!label) return;
  const id=(label.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")||("nav-"+Math.random().toString(16).slice(2,6)));
  const sectionId=id;
  (state.navDoc.nav||[]).push({id,label,icon:"✨",sectionId});
  ensureSection(sectionId);
  state.selectedNavId=id;
  renderNav(); renderSelected();
}
function promptChip(){
  const n=selNav(); if(!n) return alert("Nav tanlang");
  const label=prompt("Chip nomi (masalan: Algebra)","");
  if(!label) return;
  const id=(label.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")||("c-"+Math.random().toString(16).slice(2,5)));
  ensureSection(n.sectionId);
  state.sections[n.sectionId].chips.push({id,label});
  renderSelected();
}
function promptItem(kind){
  const n=selNav(); if(!n) return alert("Nav tanlang");
  ensureSection(n.sectionId);
  const s=state.sections[n.sectionId];
  const title=prompt(kind==="banner"?"Banner sarlavha":"Card sarlavha","")||"";
  const chipId=prompt("chipId (all yoki chip id)","all")||"all";
  const imageUrl=prompt("Rasm URL (https://...)","")||"";
  const href=prompt("Link (ixtiyoriy)","")||"";
  const subtitle=prompt("Qisqa matn (ixtiyoriy)","")||"";
  s.items.push({kind,title,subtitle,chipId,imageUrl,href});
  renderSelected();
}
function editChip(idx){
  const n=selNav(); ensureSection(n.sectionId);
  const s=state.sections[n.sectionId]; const c=s.chips[idx];
  const label=prompt("Chip label", c.label)||c.label;
  const id=prompt("Chip id", c.id)||c.id;
  s.chips[idx]={id,label};
  renderSelected();
}
function editItem(idx){
  const n=selNav(); ensureSection(n.sectionId);
  const s=state.sections[n.sectionId]; const it=s.items[idx];
  const title=prompt("Title", it.title||"") ?? it.title;
  const chipId=prompt("chipId", it.chipId||"all") ?? it.chipId;
  const imageUrl=prompt("imageUrl", it.imageUrl||"") ?? it.imageUrl;
  const href=prompt("href", it.href||"") ?? it.href;
  const subtitle=prompt("subtitle", it.subtitle||"") ?? it.subtitle;
  s.items[idx]={...it,title,chipId,imageUrl,href,subtitle};
  renderSelected();
}

async function publish(){
  const user=auth.currentUser;
  if(!user) return alert("Login qiling");
  if(!ADMIN_EMAILS.includes(user.email||"")) return alert("Admin emas");
  $("btnPublish").disabled=true;
  state.navDoc.version=(state.navDoc.version||1)+1;
  await setDoc(doc(db,"configs","nav"), state.navDoc, {merge:true});
  const ids=[...new Set((state.navDoc.nav||[]).map(n=>n.sectionId).filter(Boolean))];
  for(const sid of ids){ ensureSection(sid); await setDoc(doc(db,"sections",sid), state.sections[sid], {merge:true}); }
  alert("✅ Published!");
  $("btnPublish").disabled=false;
}

async function loadUsers(){
  const qy=query(collection(db,"users"), orderBy("points","desc"), limit(20));
  const snap=await getDocs(qy);
  $("users").innerHTML="";
  snap.forEach((d,i)=>{
    const u=d.data();
    const name=`${u?.profile?.firstName||""} ${u?.profile?.lastName||""}`.trim() || u.id;
    $("users").appendChild(row(`<div class="grow"><b>#${i+1} ${name}</b><div class="meta">${u.id} · ${u.points||0} pt</div></div>`));
  });
}

$("btnAddNav").onclick=promptNav;
$("btnAddChip").onclick=promptChip;
$("btnAddBanner").onclick=()=>promptItem("banner");
$("btnAddCard").onclick=()=>promptItem("card");
$("btnPublish").onclick=publish;

$("navList").addEventListener("click",(e)=>{
  const b=e.target.closest("button"); if(!b) return;
  const act=b.dataset.act, id=b.dataset.id;
  if(act==="select"){ state.selectedNavId=id; renderSelected(); }
  if(act==="del"){ if(confirm("O‘chirasizmi?")){ state.navDoc.nav=state.navDoc.nav.filter(x=>x.id!==id); if(state.selectedNavId===id) state.selectedNavId=null; renderNav(); renderSelected(); } }
});
$("chipList").addEventListener("click",(e)=>{
  const b=e.target.closest("button"); if(!b) return;
  const act=b.dataset.act, idx=Number(b.dataset.idx);
  const n=selNav(); if(!n) return;
  ensureSection(n.sectionId);
  const s=state.sections[n.sectionId];
  if(act==="chipEdit") editChip(idx);
  if(act==="chipDel"){ if(confirm("Chip o‘chirilsinmi?")){ s.chips.splice(idx,1); renderSelected(); } }
});
$("itemList").addEventListener("click",(e)=>{
  const b=e.target.closest("button"); if(!b) return;
  const act=b.dataset.act, idx=Number(b.dataset.idx);
  const n=selNav(); if(!n) return;
  ensureSection(n.sectionId);
  const s=state.sections[n.sectionId];
  if(act==="itemEdit") editItem(idx);
  if(act==="itemDel"){ if(confirm("Item o‘chirilsinmi?")){ s.items.splice(idx,1); renderSelected(); } }
});
$("secTitle").addEventListener("input",()=>{
  const n=selNav(); if(!n) return;
  ensureSection(n.sectionId);
  state.sections[n.sectionId].title=$("secTitle").value;
});

if(!needs){
  app=initializeApp(cfg);
  auth=getAuth(app);
  db=getFirestore(app);

  $("btnLogin").onclick=async()=>signInWithPopup(auth, new GoogleAuthProvider());
  $("btnLogout").onclick=async()=>signOut(auth);

  onAuthStateChanged(auth, async (user)=>{
    const ok=!!user && ADMIN_EMAILS.includes(user.email||"");
    $("btnLogout").disabled=!user;
    $("btnPublish").disabled=!ok;
    if(user && !ok){ alert("Bu email admin emas!"); await signOut(auth); return; }
    if(ok){ await loadFromFS(); await loadUsers(); }
  });
}

// admin.js — LeaderMath
// 1) firebaseConfig ni o'zingizning project config'ingiz bilan to'ldiring
const firebaseConfig = {
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME",
  projectId: "PASTE_ME",
};

const ADMIN_EMAIL = "sohibjonmath@gmail.com";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const el = (id) => document.getElementById(id);
const state = {
  nav: [],
  sections: {}, // sectionId -> {title, chips, items}
  selectedNavId: null,
  authed: false,
};

function showStatus(msg) {
  const s = el("status");
  s.style.display = "block";
  s.textContent = msg;
  setTimeout(() => (s.style.display = "none"), 4000);
}

function enableAll(on) {
  ["btnLogout","btnPublish","btnAddNav","btnAddChip","btnAddBanner","btnAddCard"].forEach(id => {
    const b = el(id);
    if (!b) return;
    if (id === "btnLogout") b.disabled = !on;
    else b.disabled = !on;
  });
  el("btnLogin").disabled = on;
}

function normId(s){
  return String(s||"").trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9\-]/g,"").slice(0,40) || ("p"+Math.random().toString(16).slice(2,6));
}

function currentNav(){
  return state.nav.find(n => n.id === state.selectedNavId) || null;
}

function currentSection(){
  const n = currentNav();
  if (!n) return null;
  const sid = n.sectionId;
  state.sections[sid] ||= { title: n.label || sid, chips:[{id:"all",label:"Hammasi"}], items:[] };
  return state.sections[sid];
}

function renderNav(){
  const list = el("navList");
  list.innerHTML = "";
  state.nav.forEach((n, idx) => {
    const row = document.createElement("div");
    row.className = "row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div>
        <b>${n.label || n.id}</b>
        <div class="tiny">${n.id} · section: <b>${n.sectionId}</b></div>
      </div>
      <div class="btnRow">
        <button class="btn2 btn" data-act="up" data-i="${idx}">↑</button>
        <button class="btn2 btn" data-act="down" data-i="${idx}">↓</button>
        <button class="btn2 btn" data-act="del" data-i="${idx}">🗑</button>
      </div>
    `;
    row.onclick = (e) => {
      if (e.target.closest("button")) return;
      state.selectedNavId = n.id;
      renderAll();
    };
    row.querySelectorAll("button").forEach(b=>{
      b.onclick=(e)=>{
        e.stopPropagation();
        const act=b.dataset.act; const i=Number(b.dataset.i);
        if(act==="up" && i>0){ const t=state.nav[i-1]; state.nav[i-1]=state.nav[i]; state.nav[i]=t; }
        if(act==="down" && i<state.nav.length-1){ const t=state.nav[i+1]; state.nav[i+1]=state.nav[i]; state.nav[i]=t; }
        if(act==="del"){ 
          const removed = state.nav.splice(i,1)[0];
          if(state.selectedNavId===removed.id) state.selectedNavId=null;
        }
        renderAll();
      }
    });
    if (state.selectedNavId === n.id) row.style.outline = "2px solid rgba(34,211,238,.6)";
    list.appendChild(row);
  });
}

function renderSectionEditor(){
  const info = el("selInfo");
  const secTitle = el("secTitle");
  const n = currentNav();
  if (!n){
    info.textContent = "Hech narsa tanlanmagan";
    secTitle.value = "";
    secTitle.disabled = true;
    el("chipList").innerHTML = "";
    el("itemList").innerHTML = "";
    ["btnAddChip","btnAddBanner","btnAddCard"].forEach(id=>el(id).disabled=true);
    return;
  }
  const sec = currentSection();
  info.textContent = `Tanlandi: ${n.label} (${n.id})  →  section: ${n.sectionId}`;
  secTitle.disabled = false;
  secTitle.value = sec.title || "";
  secTitle.oninput = ()=>{ sec.title = secTitle.value; };

  // chips
  const cl = el("chipList"); cl.innerHTML="";
  sec.chips ||= [{id:"all",label:"Hammasi"}];
  sec.chips.forEach((c, idx)=>{
    const row=document.createElement("div");
    row.className="row";
    row.innerHTML = `
      <div style="flex:1">
        <div class="tiny">id</div>
        <input class="inp" data-k="id" value="${c.id||""}">
      </div>
      <div style="flex:2">
        <div class="tiny">label</div>
        <input class="inp" data-k="label" value="${c.label||""}">
      </div>
      <button class="btn2 btn" data-del="${idx}">🗑</button>
    `;
    row.querySelectorAll("input").forEach(inp=>{
      inp.oninput=()=>{ c[inp.dataset.k]=inp.value; };
    });
    row.querySelector("button").onclick=()=>{
      if(c.id==="all") return showStatus("❗ 'all' chipni o‘chirmang");
      sec.chips.splice(idx,1);
      renderSectionEditor();
    };
    cl.appendChild(row);
  });

  // items
  const il=el("itemList"); il.innerHTML="";
  sec.items ||= [];
  sec.items.forEach((it, idx)=>{
    const row=document.createElement("div");
    row.className="row";
    row.innerHTML=`
      <div style="flex:1.5">
        <b>${it.type||"card"}</b>
        <div class="tiny">${it.title||""}</div>
      </div>
      <div class="btnRow">
        <button class="btn2 btn" data-act="edit" data-i="${idx}">✏️</button>
        <button class="btn2 btn" data-act="up" data-i="${idx}">↑</button>
        <button class="btn2 btn" data-act="down" data-i="${idx}">↓</button>
        <button class="btn2 btn" data-act="del" data-i="${idx}">🗑</button>
      </div>
    `;
    row.querySelectorAll("button").forEach(b=>{
      b.onclick=()=>{
        const act=b.dataset.act; const i=Number(b.dataset.i);
        if(act==="up"&&i>0){const t=sec.items[i-1];sec.items[i-1]=sec.items[i];sec.items[i]=t;}
        if(act==="down"&&i<sec.items.length-1){const t=sec.items[i+1];sec.items[i+1]=sec.items[i];sec.items[i]=t;}
        if(act==="del"){sec.items.splice(i,1);}
        if(act==="edit"){ openItemEditor(sec, i); return; }
        renderSectionEditor();
      }
    });
    il.appendChild(row);
  });

  ["btnAddChip","btnAddBanner","btnAddCard"].forEach(id=>el(id).disabled=false);
}

function openItemEditor(sec, idx){
  const it = sec.items[idx];
  const html = `
    Title\n${it.title||""}\n\nSubtitle\n${it.subtitle||""}\n\nImage URL\n${it.imageUrl||""}\n\nLink (href)\n${it.href||""}\n\nChipId (all yoki chip id)\n${it.chipId||"all"}\n\nBadge (ixtiyoriy)\n${it.badge||""}\n\nIcon (fa class)\n${it.icon||"fas fa-sparkles"}\n\nTag\n${it.tag||""}
  `;
  const out = prompt("Item edit (har qatorga mos qiymat):\n\n" + html, "");
  if (out===null) return;
  // simple parse: split lines, take every 2 lines as field? We'll parse by prompts: ask separately for reliability
  it.title = prompt("Title", it.title||"") ?? it.title;
  it.subtitle = prompt("Subtitle", it.subtitle||"") ?? it.subtitle;
  it.imageUrl = prompt("Image URL", it.imageUrl||"") ?? it.imageUrl;
  it.href = prompt("Link (href)", it.href||"") ?? it.href;
  it.chipId = prompt("ChipId (all yoki chip id)", it.chipId||"all") ?? it.chipId;
  it.badge = prompt("Badge (ixtiyoriy)", it.badge||"") ?? it.badge;
  it.icon = prompt("Icon (fa class)", it.icon||"fas fa-sparkles") ?? it.icon;
  it.tag = prompt("Tag", it.tag||"") ?? it.tag;
  renderSectionEditor();
}

function renderUsers(){
  const ul = el("userList"); ul.innerHTML="";
  db.collection("users").orderBy("points","desc").limit(20).get().then(snap=>{
    snap.forEach((d,i)=>{
      const u=d.data();
      const name = ((u.profile?.firstName||"") + " " + (u.profile?.lastName||"")).trim() || u.id;
      const row=document.createElement("div"); row.className="row";
      row.innerHTML=`<div><b>#${i+1} ${name}</b><div class="tiny">${u.id} · ${u.points||0} pt</div></div>
      <button class="btn2 btn" data-add="+10">+10</button>`;
      row.querySelector("button").onclick=async()=>{
        await db.collection("users").doc(u.id).update({points: (u.points||0)+10});
        showStatus("✅ +10 pt qo‘shildi");
        renderUsers();
      };
      ul.appendChild(row);
    });
  });
}

function renderAll(){
  renderNav();
  renderSectionEditor();
  renderUsers();
}

async function loadFromFirestore(){
  const doc = await db.collection("configs").doc("nav").get();
  if (doc.exists){
    const cfg = doc.data();
    state.nav = Array.isArray(cfg.nav) ? cfg.nav : [];
  } else {
    state.nav = [
      { id:"home", label:"Bosh sahifa", icon:"fas fa-home", sectionId:"home" },
      { id:"darsdan-tashqari", label:"Darsdan tashqari", icon:"fas fa-layer-group", sectionId:"darsdan-tashqari" },
    ];
  }
  // load sections
  for (const n of state.nav){
    const sid=n.sectionId;
    const s = await db.collection("sections").doc(sid).get();
    if (s.exists) state.sections[sid]=s.data();
  }
  renderAll();
}

async function publishAll(){
  // normalize chips and ensure 'all'
  for (const sid of Object.keys(state.sections)){
    const sec=state.sections[sid];
    sec.title = String(sec.title||sid);
    sec.chips = Array.isArray(sec.chips) ? sec.chips : [];
    if (!sec.chips.find(c=>c.id==="all")) sec.chips.unshift({id:"all",label:"Hammasi"});
    sec.items = Array.isArray(sec.items) ? sec.items : [];
    await db.collection("sections").doc(sid).set(sec, { merge:true });
  }
  await db.collection("configs").doc("nav").set({
    version: Date.now(),
    nav: state.nav.map(n=>({
      id: normId(n.id),
      label: String(n.label||n.id),
      icon: String(n.icon||"fas fa-sparkles"),
      sectionId: normId(n.sectionId||n.id),
    }))
  }, { merge:true });

  showStatus("✅ Publish bo‘ldi (configs/nav + sections/*)");
}

el("btnLogin").onclick = async ()=>{
  const prov = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithPopup(prov);
};
el("btnLogout").onclick = async ()=>{ await auth.signOut(); };

el("btnAddNav").onclick=()=>{
  const label = prompt("Nav nomi (label):","Yangi bo‘lim");
  if(!label) return;
  const id = normId(prompt("Nav id:", normId(label)));
  const sectionId = normId(prompt("sectionId:", id));
  const icon = prompt("Icon (fa class):", "fas fa-sparkles") || "fas fa-sparkles";
  state.nav.push({id, label, icon, sectionId});
  state.selectedNavId = id;
  state.sections[sectionId] ||= { title: label, chips:[{id:"all",label:"Hammasi"}], items:[] };
  renderAll();
};

el("btnAddChip").onclick=()=>{
  const sec=currentSection(); if(!sec) return;
  const label = prompt("Chip nomi:", "Yangi chip"); if(!label) return;
  const id = normId(prompt("Chip id:", normId(label)));
  sec.chips.push({id, label});
  renderSectionEditor();
};
el("btnAddBanner").onclick=()=>{
  const sec=currentSection(); if(!sec) return;
  sec.items.push({type:"banner", title:"Banner", subtitle:"", imageUrl:"", href:"", chipId:"all"});
  renderSectionEditor();
  openItemEditor(sec, sec.items.length-1);
};
el("btnAddCard").onclick=()=>{
  const sec=currentSection(); if(!sec) return;
  sec.items.push({type:"card", title:"Card", subtitle:"", imageUrl:"", href:"", chipId:"all", badge:"", icon:"fas fa-sparkles", tag:""});
  renderSectionEditor();
  openItemEditor(sec, sec.items.length-1);
};

el("btnPublish").onclick=publishAll;

auth.onAuthStateChanged(async(user)=>{
  if(!user){ 
    el("who").textContent="Kiring: faqat " + ADMIN_EMAIL;
    enableAll(false);
    return;
  }
  if(user.email !== ADMIN_EMAIL){
    await auth.signOut();
    return showStatus("❌ Admin emas: " + user.email);
  }
  el("who").textContent="✅ Admin: " + user.email;
  enableAll(true);
  await loadFromFirestore();
});


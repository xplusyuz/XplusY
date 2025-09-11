// js/leaderboard.js — Firestore-powered leaderboard with CSV fallback
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, startAfter, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let mounted=false, abortCtrl=null, cursor=null, sortField="gems", pageSize=30;
let list=[], my={ uid:null, data:null, rank:null };

const fbConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};
if (!getApps().length) initializeApp(fbConfig);
const auth = getAuth();
const db   = getFirestore();

const $=(s,r=document)=>r.querySelector(s);

function safe(v, d=""){ return v==null? d : v; }
function avatarOf(u){ return u.avatar || u.photoURL || "https://api.dicebear.com/7.x/initials/svg?seed="+encodeURIComponent(u.displayName||"User"); }

/* ===== CSV fallback ===== */
function parseCSV(t){
  const rows=[]; let row=[], cell='', q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){ if(ch=='"'){ if(t[i+1]=='"'){cell+='"'; i++;} else q=false; } else cell+=ch; }
    else { if(ch=='"') q=true; else if(ch==','){ row.push(cell.trim()); cell=''; }
      else if(ch=='\n'||ch=='\r'){ if(cell!==''||row.length){row.push(cell.trim()); rows.push(row); row=[]; cell='';} }
      else cell+=ch; }
  }
  if(cell!==''||row.length){ row.push(cell.trim()); rows.push(row); }
  return rows.filter(r=>r.length && r.some(v=>v!==''));
}
function csvToUsers(text){
  const rows = parseCSV(text);
  const head = rows[0].map(h=>h.trim().toLowerCase());
  const idx  = (k)=> head.indexOf(k);
  return rows.slice(1).map(r=> ({
    displayName: r[idx("displayname")] || r[idx("name")] || "User",
    numericId:   r[idx("numericid")] || "",
    avatar:      r[idx("avatar")] || r[idx("photo")] || "",
    gems:        +safe(r[idx("gems")], 0),
    score:       +safe(r[idx("score")], 0),
    testsTaken:  +safe(r[idx("teststaken")], 0),
  }));
}

/* ===== Rendering ===== */
function podiumHTML(users){
  return users.slice(0,3).map((u,i)=>`
  <div class="podium-card">
    <div class="rank">#${i+1}</div>
    <img src="${avatarOf(u)}" alt="">
    <div class="grow">
      <div class="name">${safe(u.displayName,"Foydalanuvchi")}</div>
      <div class="meta">ID: ${safe(u.numericId,"—")}</div>
    </div>
    <div class="podium-badge">💎 ${safe(u.gems,0)}</div>
  </div>`).join("");
}
function rowNode(u, rank){
  const li = document.createElement("div");
  li.className = "lb-row";
  li.innerHTML = `
    <div class="rank">#${rank}</div>
    <img src="${avatarOf(u)}" alt="">
    <div>
      <div class="name">${safe(u.displayName,"Foydalanuvchi")}</div>
      <div class="meta">ID: ${safe(u.numericId,"—")}</div>
    </div>
    <div class="chips">
      <span class="pill">💎 ${safe(u.gems,0)}</span>
      <span class="pill">⭐ ${safe(u.score,0)}</span>
      <span class="pill">📝 ${safe(u.testsTaken,0)}</span>
    </div>`;
  return li;
}
function renderAll(){
  const listBox = $("#lbList");
  listBox.innerHTML = "";
  $("#lbPodium").innerHTML = podiumHTML(list);
  list.slice(3).forEach((u, i)=> listBox.append(rowNode(u, i+4)));
}

function markSeg(){
  document.querySelectorAll(".lb-summary .seg-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.sort === sortField);
  });
}

async function fetchPage(){
  // Try Firestore
  try {
    const col = collection(db, "users");
    const q = cursor
      ? query(col, orderBy(sortField, "desc"), limit(pageSize), startAfter(cursor))
      : query(col, orderBy(sortField, "desc"), limit(pageSize));
    const snap = await getDocs(q);
    if (!snap.empty) {
      cursor = snap.docs[snap.docs.length - 1];
      const users = snap.docs.map(d=>({ uid: d.id, ...d.data() }));
      list = list.concat(users);
      renderAll();
      return true;
    }
  } catch (e) {
    console.warn("Firestore o‘qishda xato yoki ruxsat yo‘q, CSV fallback ishlatiladi:", e.message);
  }
  // Fallback to CSV (when first page only)
  if (list.length===0){
    let res = await fetch("csv/leaderboard.csv").catch(()=>({}));
    if (!res?.ok) res = await fetch("leaderboard.csv").catch(()=>({}));
    if (res?.ok){
      const users = csvToUsers(await res.text());
      users.sort((a,b)=> (b[sortField]||0) - (a[sortField]||0));
      list = users;
      cursor = null; // no pagination in CSV
      renderAll();
      return true;
    }
  }
  return false;
}

async function refresh(){
  list = []; cursor = null;
  $("#lbList").innerHTML = "";
  $("#lbPodium").innerHTML = "";
  await fetchPage();
}

function bind(){
  $("#lbRefresh").onclick = refresh;
  document.querySelectorAll(".lb-summary .seg-btn").forEach(b=>{
    b.onclick = async ()=>{
      sortField = b.dataset.sort;
      markSeg();
      await refresh();
    };
  });
  $("#lbMore").onclick = fetchPage;
}

export default {
  async init(){
    if (mounted) this.destroy();
    mounted = true;
    abortCtrl = new AbortController();
    bind();
    markSeg();
    await refresh();
  },
  destroy(){
    mounted=false;
    try{ abortCtrl?.abort(); }catch{}
    abortCtrl=null;
    list=[]; cursor=null;
  }
};

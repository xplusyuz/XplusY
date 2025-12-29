import { api } from "./api.js";
import { FIREBASE_WEB_CONFIG } from "./firebase-web-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, setPersistence, browserLocalPersistence, signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const $ = (id)=>document.getElementById(id);

function toast(msg){
  const el = $("toast");
  if(!el) return alert(msg);
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>el.classList.remove("show"), 2200);
}

function esc(s){ return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }

function fmtTime(ms){
  if(!ms) return "—";
  try{
    const d = new Date(ms);
    return d.toLocaleString("uz-UZ");
  }catch(_){ return "—"; }
}

function pickEmail(u){
  return String(u?.email || "").toLowerCase();
}

const ADMIN_EMAIL = "sohibjonmath@gmail.com";

let auth, user = null, idToken = "";
let usersCursor = null, commentsCursor = null, historyCursor = null;
let selected = new Map(); // loginId -> user
let lastUsers = [];
let lastComments = [];
let lastHistory = [];

async function ensureToken(){
  if(!user) throw new Error("Login yo‘q");
  idToken = await user.getIdToken(true);
  return idToken;
}

async function adminApi(path, {method="GET", body=null, query=null} = {}){
  const token = await ensureToken();
  return await api(path, { method, body, token, query });
}

function showLogin(err=""){
  $("loginCover").classList.add("show");
  $("loginErr").textContent = err || "";
}
function hideLogin(){ $("loginCover").classList.remove("show"); }

function setTab(name){
  const tabs = {
    dashboard: ["tabDashboard","paneDashboard"],
    users: ["tabUsers","paneUsers"],
    comments: ["tabComments","paneComments"],
    notify: ["tabNotify","paneNotify"],
    history: ["tabHistory","paneHistory"]
  };
  for(const k in tabs){
    const [t,p] = tabs[k];
    $(t).classList.toggle("active", k===name);
    $(p).classList.toggle("active", k===name);
  }
}

function renderSelectedPreview(){
  const box = $("selectedPreview");
  if(!box) return;
  if(selected.size===0){
    box.innerHTML = '<div class="muted">Tanlanganlar yo‘q.</div>';
    return;
  }
  const pills = [...selected.values()].slice(0, 18).map(u=>{
    const nm = esc(u.name || u.firstName || "User");
    const id = esc(u.loginId || "");
    return `<span class="chip" title="${id}">${nm} <b class="kbd">${id}</b></span>`;
  }).join(" ");
  const more = selected.size>18 ? `<span class="muted">+${selected.size-18} ta</span>` : "";
  box.innerHTML = `<div style="display:flex; gap:8px; flex-wrap:wrap;">${pills} ${more}</div>`;
}

function userRow(u){
  const id = esc(u.loginId||"");
  const nm = esc(u.name || `${u.firstName||""} ${u.lastName||""}`.trim() || "—");
  const pts = Number(u.points||0);
  const bal = Number(u.balance||0);
  const checked = selected.has(u.loginId) ? "checked" : "";
  return `
    <div class="selItem">
      <input type="checkbox" data-user="${id}" ${checked}/>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:baseline;">
          <b>${nm}</b>
          <span class="chip kbd">${id}</span>
        </div>
        <div class="muted" style="margin-top:4px;">🏆 ${pts} ball · 💰 ${bal}</div>
      </div>
    </div>
  `;
}

function commentRow(c){
  const cid = esc(c.id||"");
  const uid = esc(c.loginId||"");
  const name = esc(c.name||"User");
  const text = esc(c.text||"");
  const likes = Number(c.likeCount||0);
  const replies = Number(c.replyCount||0);
  const created = fmtTime(c.createdAt);
  return `
    <div class="selItem">
      <div style="flex:1; min-width:0;">
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:baseline;">
          <b>${name}</b>
          <span class="chip kbd">${uid}</span>
          <span class="muted">· ${created}</span>
        </div>
        <div style="margin-top:6px; line-height:1.45;">${text}</div>
        <div class="muted" style="margin-top:8px; display:flex; gap:10px; flex-wrap:wrap;">
          <span>👍 ${likes}</span>
          <span>↩️ ${replies}</span>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn miniBtn" data-cedit="${cid}">✎</button>
        <button class="btn miniBtn danger" data-cdel="${cid}">🗑</button>
      </div>
    </div>
  `;
}

function historyRow(n){
  const id = esc(n.id||"");
  const title = esc(n.title||"");
  const body = esc(n.body||"");
  const type = esc(n.type||"info");
  const created = fmtTime(n.createdAt);
  const readCount = Number(n.readCount||0);
  const scope = esc(n.scope||"");
  return `
    <div class="selItem">
      <div style="flex:1; min-width:0;">
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:baseline;">
          <b>${title}</b>
          <span class="chip">${type}</span>
          <span class="chip">${scope}</span>
          <span class="muted">· ${created}</span>
        </div>
        <div class="muted" style="margin-top:6px; line-height:1.45;">${body}</div>
        <div class="muted" style="margin-top:8px;">👀 O‘qiganlar: <b>${readCount}</b></div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn miniBtn" data-reads="${id}">👀</button>
      </div>
    </div>
  `;
}

async function loadStats(){
  try{
    const d = await adminApi("admin/notifications/sent", { query:{ limit: 1 }});
    const last = d.items?.[0] || null;
    $("statAt").textContent = new Date().toLocaleString("uz-UZ");
    // unread is for admin panel itself: show last readCount (not exact). Keep simple.
    $("statUnread").textContent = last ? String(Math.max(0, (last.deliveredCount||0) - (last.readCount||0))) : "0";
  }catch(_){}
}

async function loadUsers(reset=false){
  const q = ($("userSearch")?.value || "").trim();
  const limit = 40;
  if(reset){ usersCursor=null; lastUsers=[]; }
  const d = await adminApi("admin/users", { query:{ limit, cursor: usersCursor||"", q }});
  usersCursor = d.nextCursor || null;
  const items = d.items || [];
  lastUsers = reset ? items : lastUsers.concat(items);
  $("usersList").innerHTML = lastUsers.map(userRow).join("") || '<div class="muted">User topilmadi.</div>';
  $("statUsers").textContent = String(lastUsers.length);
  renderSelectedPreview();
}

async function loadComments(reset=false){
  const q = ($("commentSearch")?.value || "").trim();
  const limit = 30;
  if(reset){ commentsCursor=null; lastComments=[]; }
  const d = await adminApi("admin/comments", { query:{ limit, cursor: commentsCursor||"", q }});
  commentsCursor = d.nextCursor || null;
  const items = d.items || [];
  lastComments = reset ? items : lastComments.concat(items);
  $("commentsList").innerHTML = lastComments.map(commentRow).join("") || '<div class="muted">Sharh topilmadi.</div>';
  $("statComments").textContent = String(lastComments.length);
}

async function loadHistory(reset=false){
  const limit = 25;
  if(reset){ historyCursor=null; lastHistory=[]; }
  const d = await adminApi("admin/notifications/sent", { query:{ limit, cursor: historyCursor||"" }});
  historyCursor = d.nextCursor || null;
  const items = d.items || [];
  lastHistory = reset ? items : lastHistory.concat(items);
  $("historyList").innerHTML = lastHistory.map(historyRow).join("") || '<div class="muted">Tarix bo‘sh.</div>';
  // Dashboard last notif
  const last = lastHistory[0] || null;
  $("dashLastNotif").innerHTML = last ? `<div class="muted">${esc(last.title)} · ${fmtTime(last.createdAt)} · 👀 ${Number(last.readCount||0)}</div>` : '<div class="muted">—</div>';
}

async function loadDashboard(){
  // Top users preview
  try{
    const d = await adminApi("admin/users", { query:{ limit: 8 }});
    const items = d.items || [];
    $("dashTopUsers").innerHTML = items.map(u=>`<div class="muted">🏆 <b>${esc(u.name||"—")}</b> <span class="kbd">${esc(u.loginId||"")}</span> · ${Number(u.points||0)}</div>`).join("") || '<div class="muted">—</div>';
  }catch(_){ $("dashTopUsers").innerHTML = '<div class="muted">—</div>'; }

  // Last comments preview
  try{
    const d = await adminApi("admin/comments", { query:{ limit: 6 }});
    const items = d.items || [];
    $("dashLastComments").innerHTML = items.map(c=>`<div class="muted">💬 <b>${esc(c.name||"")}</b>: ${esc((c.text||"").slice(0,40))}${(c.text||"").length>40?"…":""}</div>`).join("") || '<div class="muted">—</div>';
  }catch(_){ $("dashLastComments").innerHTML = '<div class="muted">—</div>'; }
}

async function sendNotif(){
  const title = ($("notifTitle").value||"").trim();
  const body = ($("notifBody").value||"").trim();
  const type = ($("notifType").value||"info").trim();
  const aud = [...document.querySelectorAll('input[name="aud"]')].find(x=>x.checked)?.value || "all";
  const loginId = ($("singleUserId").value||"").trim();
  const loginIds = [...selected.keys()];

  if(!title || !body) return toast("Sarlavha va matn kerak");
  if(aud==="user" && !loginId) return toast("Bitta user ID kiriting");
  if(aud==="selected" && loginIds.length===0) return toast("Tanlangan user yo‘q");

  await adminApi("admin/notify", { method:"POST", body:{ audience: aud, title, body, type, loginId, loginIds }});
  toast("Yuborildi ✅");
  $("notifTitle").value=""; $("notifBody").value="";
  await loadHistory(true);
  setTab("history");
}

async function editComment(commentId){
  const cur = lastComments.find(x=>x.id===commentId);
  const oldText = cur?.text || "";
  const txt = prompt("Sharhni tahrirlash:", oldText);
  if(txt===null) return;
  const text = String(txt).trim().slice(0, 400);
  if(!text) return toast("Matn bo‘sh bo‘lishi mumkin emas");
  await adminApi("admin/comments/update", { method:"POST", body:{ commentId, text }});
  toast("Saqlangan ✅");
  await loadComments(true);
}

async function deleteComment(commentId){
  if(!confirm("Sharh o‘chirilsinmi?")) return;
  await adminApi("admin/comments/delete", { method:"POST", body:{ commentId }});
  toast("O‘chirildi ✅");
  await loadComments(true);
}

async function showReads(globalId){
  const d = await adminApi("admin/notifications/reads", { query:{ id: globalId, limit: 120 }});
  const items = d.items || [];
  const lines = items.map(x=>`${x.loginId||x.email||"—"} · ${fmtTime(x.readAt)}`).slice(0, 120).join("\n");
  alert(`O‘qiganlar (${items.length}):\n\n` + (lines || "—"));
}

function bindUI(){
  $("btnReload").onclick = ()=>location.reload();
  $("btnRefresh").onclick = async ()=>{ await loadStats(); await loadDashboard(); toast("Yangilandi ✅"); };
  $("btnLogout").onclick = async ()=>{ try{ await signOut(auth); }catch(_){ } location.reload(); };

  $("btnGoogleLogin").onclick = async ()=>{
    try{
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    }catch(e){
      showLogin("Login xato: " + (e?.message || e));
    }
  };

  $("tabDashboard").onclick = ()=>{ setTab("dashboard"); };
  $("tabUsers").onclick = ()=>{ setTab("users"); };
  $("tabComments").onclick = ()=>{ setTab("comments"); };
  $("tabNotify").onclick = ()=>{ setTab("notify"); };
  $("tabHistory").onclick = ()=>{ setTab("history"); };

  $("quickLoadUsers").onclick = async ()=>{ setTab("users"); await loadUsers(true); };
  $("quickLoadComments").onclick = async ()=>{ setTab("comments"); await loadComments(true); };
  $("quickLoadHistory").onclick = async ()=>{ setTab("history"); await loadHistory(true); };

  $("usersLoadMore").onclick = ()=>loadUsers(false);
  $("commentsLoadMore").onclick = ()=>loadComments(false);
  $("historyLoadMore").onclick = ()=>loadHistory(false);

  $("userSearch").addEventListener("input", ()=>loadUsers(true));
  $("commentSearch").addEventListener("input", ()=>loadComments(true));

  $("btnSendNotif").onclick = ()=>sendNotif();

  document.addEventListener("change", (e)=>{
    const cb = e.target;
    if(cb && cb.matches('input[type="checkbox"][data-user]')){
      const id = cb.getAttribute("data-user");
      const u = lastUsers.find(x=>x.loginId===id);
      if(cb.checked && u) selected.set(id, u);
      else selected.delete(id);
      renderSelectedPreview();
    }
  });

  document.addEventListener("click", (e)=>{
    const el = e.target;
    if(!el) return;
    const cid = el.getAttribute("data-cdel");
    if(cid) return deleteComment(cid);
    const ce = el.getAttribute("data-cedit");
    if(ce) return editComment(ce);
    const rid = el.getAttribute("data-reads");
    if(rid) return showReads(rid);
  });
}

async function boot(){
  bindUI();

  // Firebase config sanity
  if(!FIREBASE_WEB_CONFIG || String(FIREBASE_WEB_CONFIG.apiKey||"").includes("PASTE_")){
    showLogin("Firebase config qo‘yilmagan: assets/js/firebase-web-config.js");
    return;
  }

  const app = initializeApp(FIREBASE_WEB_CONFIG);
  auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);

  onAuthStateChanged(auth, async (u)=>{
    user = u;
    if(!u){
      $("adminEmail").textContent = "—";
      showLogin("");
      return;
    }
    const email = pickEmail(u);
    if(email !== ADMIN_EMAIL){
      await signOut(auth);
      showLogin("Bu email admin emas: " + email);
      return;
    }
    $("adminEmail").textContent = email;
    hideLogin();

    try{
      await ensureToken();
      // ping admin/me to validate server side
      await adminApi("admin/me", { method:"GET" });
      await loadStats();
      await loadDashboard();
      await loadHistory(true);
      toast("Admin tayyor ✅");
    }catch(e){
      showLogin("Server admin tekshiruvi xato: " + (e?.message || e));
    }
  });
}

boot();

import { api } from "./api.js";
import { getToken, logout } from "./auth.js";

const $ = (id)=>document.getElementById(id);

function toast(msg){
  const el = $("toast");
  if(!el) return alert(msg);
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>el.classList.remove("show"), 2200);
}

function escapeHtml(s){
  return String(s||"")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/\"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

let selected = new Set();
let usersCursor = null;
let usersCache = [];
let commentsCursor = null;
let sentCursor = null;

function setTab(name){
  const tabUsers = $("tabUsers");
  const tabComments = $("tabComments");
  const tabNotify = $("tabNotify");
  const tabSent = $("tabSent");
  const paneUsers = $("paneUsers");
  const paneComments = $("paneComments");
  const paneNotify = $("paneNotify");
  const paneSent = $("paneSent");

  const isUsers = name==="users";
  const isComments = name==="comments";
  const isNotify = name==="notify";
  const isSent = name==="sent";

  tabUsers.classList.toggle("active", isUsers);
  tabComments.classList.toggle("active", isComments);
  tabNotify.classList.toggle("active", isNotify);
  tabSent.classList.toggle("active", isSent);

  tabUsers.setAttribute("aria-selected", String(isUsers));
  tabComments.setAttribute("aria-selected", String(isComments));
  tabNotify.setAttribute("aria-selected", String(isNotify));
  tabSent.setAttribute("aria-selected", String(isSent));

  paneUsers.style.display = isUsers ? "block" : "none";
  paneComments.style.display = isComments ? "block" : "none";
  paneNotify.style.display = isNotify ? "block" : "none";
  paneSent.style.display = isSent ? "block" : "none";
}

function renderSentItem(n){
  const when = n.createdAt ? new Date(n.createdAt).toLocaleString() : "";
  const meta = `${escapeHtml(n.audience||"")} • 👥 ${Number(n.targetCount||0)} • ✅ ${Number(n.readCount||0)} • ${escapeHtml(when)}`;
  return `
    <li class="notifItem" data-gid="${escapeHtml(n.id)}">
      <div class="top">
        <div class="nameLine">${escapeHtml(n.title||"Xabar")}</div>
        <div class="small">${meta}</div>
      </div>
      <div class="notifBody">${escapeHtml(n.body||"")}</div>
      <div class="notifActions" style="gap:8px; justify-content:space-between;">
        <button class="miniBtn" data-act="toggleReads" type="button">👀 O‘qiganlar</button>
        <span class="small" style="opacity:.8;">ID: <b>${escapeHtml(n.id)}</b></span>
      </div>
      <div class="readsBox" style="display:none; margin-top:10px;"></div>
    </li>
  `;
}

async function loadSent(reset=false){
  const list = $("sentList");
  const more = $("sentLoadMore");
  try{
    more.disabled = true;
    if(reset){
      sentCursor = null;
      list.innerHTML = `<li class="small">Yuklanmoqda…</li>`;
    }
    const token = getToken();
    const data = await api("admin/notifications/sent", { token, query:{ limit: 20, cursor: sentCursor } });
    const items = data?.items || [];
    if(reset) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", items.map(renderSentItem).join(""));
    sentCursor = data?.nextCursor || null;
    more.style.display = sentCursor ? "inline-flex" : "none";
    if(!items.length && reset){
      list.innerHTML = `<li class="small">Hozircha yuborilgan bildirishnoma yo‘q</li>`;
      more.style.display = "none";
    }
  }catch(e){
    if(reset) $("sentList").innerHTML = `<li class="small">Xato: ${escapeHtml(e.message||"yuklanmadi")}</li>`;
  }finally{ more.disabled = false; }
}

async function loadReads(globalId){
  const token = getToken();
  const data = await api("admin/notifications/reads", { token, query:{ globalId, limit: 120 } });
  return data?.items || [];
}

function renderUsers(){
  const body = $("usersBody");
  const q = ($("userSearch").value||"").trim().toLowerCase();
  const list = q
    ? usersCache.filter(u=>
        String(u.loginId||"").toLowerCase().includes(q) ||
        String(u.name||"").toLowerCase().includes(q)
      )
    : usersCache;

  body.innerHTML = list.map(u=>{
    const id = String(u.loginId||"");
    const checked = selected.has(id);
    return `
      <tr>
        <td><input type="checkbox" data-act="sel" data-id="${escapeHtml(id)}" ${checked?"checked":""} /></td>
        <td>
          <div class="nameLine">${escapeHtml(u.name||id)}</div>
          <div class="small">${escapeHtml(id)}</div>
        </td>
        <td><b>${Number(u.points||0)}</b></td>
        <td><b>${Number(u.balance||0)}</b></td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="4" class="small">Natija yo‘q</td></tr>`;

  $("selCount").textContent = String(selected.size);
}

async function loadUsers(reset=false){
  const body = $("usersBody");
  const more = $("usersLoadMore");
  const q = ($("userSearch").value||"").trim();

  try{
    more.disabled = true;
    if(reset){
      usersCursor = null;
      usersCache = [];
      body.innerHTML = `<tr><td colspan="4" class="small">Yuklanmoqda…</td></tr>`;
    }
    const token = getToken();
    const data = await api("admin/users", { token, query:{ limit: 50, cursor: usersCursor, q } });
    const items = data?.items || [];
    if(reset) usersCache = [];
    usersCache.push(...items);
    usersCursor = data?.nextCursor || null;
    renderUsers();
    more.style.display = usersCursor ? "inline-flex" : "none";
  }catch(e){
    body.innerHTML = `<tr><td colspan="4" class="small">Xato: ${escapeHtml(e.message||"yuklanmadi")}</td></tr>`;
  }finally{ more.disabled = false; }
}

function renderAdminComment(c){
  return `
    <li class="commentItem" data-id="${escapeHtml(c.id)}">
      <div class="top">
        <div class="nameLine">${escapeHtml(c.name || c.loginId || "—")}</div>
        <div class="small">${escapeHtml(c.loginId)} • ${new Date(c.createdAt||Date.now()).toLocaleString()}</div>
      </div>
      <div class="commentText">${escapeHtml(c.text||"")}</div>
      <div class="commentActions compact">
        <button class="actBtn" data-act="delComment" type="button">🗑 O‘chirish</button>
        <span class="small" style="margin-left:auto;opacity:.85;">❤ ${Number(c.likeCount||0)} • ↩ ${Number(c.replyCount||0)}${c.edited?" • tahrirlangan":""}</span>
      </div>
    </li>
  `;
}

async function loadComments(reset=false){
  const list = $("adminCommentList");
  const more = $("commentsLoadMore");
  try{
    more.disabled = true;
    if(reset){
      commentsCursor = null;
      list.innerHTML = `<li class="small">Yuklanmoqda…</li>`;
    }
    const token = getToken();
    const data = await api("admin/comments", { token, query:{ limit: 40, cursor: commentsCursor } });
    const items = data?.items || [];
    if(reset) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", items.map(renderAdminComment).join(""));
    commentsCursor = data?.nextCursor || null;
    more.style.display = commentsCursor ? "inline-flex" : "none";
    if(!items.length && reset){
      list.innerHTML = `<li class="small">Sharh yo‘q</li>`;
      more.style.display = "none";
    }
  }catch(e){
    if(reset) list.innerHTML = `<li class="small">Xato: ${escapeHtml(e.message||"yuklanmadi")}</li>`;
  }finally{ more.disabled = false; }
}

async function deleteComment(commentId){
  const token = getToken();
  await api("admin/comments/delete", { method:"POST", token, body:{ commentId } });
}

async function sendNotification(){
  const audience = $("audience").value;
  const singleId = ($("singleId").value||"").trim();
  const title = ($("ntTitle").value||"").trim();
  const body = ($("ntBody").value||"").trim();

  if(!title || !body) return toast("Sarlavha va matn kerak");

  const token = getToken();
  const payload = { audience, title, body };

  if(audience === "single"){
    if(!singleId) return toast("Login ID kiriting");
    payload.loginId = singleId;
  }
  if(audience === "selected"){
    if(selected.size === 0) return toast("Tanlanganlar yo‘q");
    payload.loginIds = Array.from(selected);
  }

  const btn = $("sendNotif");
  try{
    btn.disabled = true;
    const out = await api("admin/notify", { method:"POST", token, body: payload });
    toast("Yuborildi ✅");
    // clear fields but keep selected
    $("ntTitle").value = "";
    $("ntBody").value = "";
    if(audience === "single") $("singleId").value = "";
    console.log(out);
  }catch(e){
    toast("Xato: " + (e.message||"yuborilmadi"));
  }finally{ btn.disabled = false; }
}

async function guardAdmin(){
  const token = getToken();
  if(!token){
    location.href = "./";
    return;
  }
  try{
    const me = await api("admin/me", { token });
    $("adminId").textContent = me.loginId;
    $("adminSub").textContent = "Admin tasdiqlandi";
  }catch(e){
    $("adminSub").textContent = "Kirish taqiqlangan";
    toast("Admin emas");
    setTimeout(()=>location.href = "./app.html", 800);
  }
}

function wire(){
  $("btnBack").onclick = ()=>location.href = "./app.html";
  $("btnLogout").onclick = ()=>{ logout(); location.href = "./"; };

  $("tabUsers").onclick = ()=>setTab("users");
  $("tabComments").onclick = ()=>{ setTab("comments"); loadComments(true); };
  $("tabNotify").onclick = ()=>setTab("notify");
  $("tabSent").onclick = ()=>{ setTab("sent"); loadSent(true); };

  $("usersReload").onclick = ()=>loadUsers(true);
  $("usersLoadMore").onclick = ()=>loadUsers(false);
  $("userSearch").addEventListener("input", ()=>{
    // for fast local filter
    renderUsers();
  });
  $("userSearch").addEventListener("keydown", (e)=>{
    if(e.key==="Enter") loadUsers(true);
  });

  $("usersBody").addEventListener("change", (e)=>{
    const cb = e.target.closest("input[type='checkbox'][data-act='sel']");
    if(!cb) return;
    const id = cb.getAttribute("data-id");
    if(cb.checked) selected.add(id); else selected.delete(id);
    $("selCount").textContent = String(selected.size);
  });

  $("commentsReload").onclick = ()=>loadComments(true);
  $("commentsLoadMore").onclick = ()=>loadComments(false);
  $("adminCommentList").addEventListener("click", async (e)=>{
    const b = e.target.closest("button[data-act='delComment']");
    if(!b) return;
    const li = e.target.closest(".commentItem");
    const id = li?.getAttribute("data-id");
    if(!id) return;
    if(!confirm("Sharh o‘chirilsinmi?")) return;
    try{
      b.disabled = true;
      await deleteComment(id);
      li.remove();
      toast("O‘chirildi ✅");
    }catch(err){
      toast("Xato: " + (err.message||""));
    }finally{ b.disabled = false; }
  });

  $("sendNotif").onclick = sendNotification;

  $("sentReload").onclick = ()=>loadSent(true);
  $("sentLoadMore").onclick = ()=>loadSent(false);
  $("sentList").addEventListener("click", async (e)=>{
    const btn = e.target.closest("button[data-act='toggleReads']");
    if(!btn) return;
    const li = e.target.closest(".notifItem");
    const gid = li?.getAttribute("data-gid");
    const box = li?.querySelector(".readsBox");
    if(!gid || !box) return;
    const isOpen = box.style.display !== "none";
    if(isOpen){
      box.style.display = "none";
      btn.textContent = "👀 O‘qiganlar";
      return;
    }
    try{
      btn.disabled = true;
      box.style.display = "block";
      box.innerHTML = `<div class="small">Yuklanmoqda…</div>`;
      const items = await loadReads(gid);
      box.innerHTML = items.length
        ? `<ul class="small" style="margin:0; padding-left:18px; line-height:1.7;">${items.map(r=>`<li><b>${escapeHtml(r.loginId)}</b> — ${escapeHtml(r.readAt? new Date(r.readAt).toLocaleString():"")}</li>`).join("")}</ul>`
        : `<div class="small">Hali hech kim o‘qimagan</div>`;
      btn.textContent = "🙈 Yopish";
    }catch(err){
      box.innerHTML = `<div class="small">Xato: ${escapeHtml(err.message||"")}</div>`;
    }finally{ btn.disabled = false; }
  });

  $("audience").addEventListener("change", ()=>{
    const v = $("audience").value;
    $("singleId").disabled = v !== "single";
  });
}

(async function boot(){
  wire();
  await guardAdmin();
  setTab("users");
  await loadUsers(true);
})();

import { api } from "./api.js";
import { toast, $, $all } from "./ui.js";
import { startClock, startSeasonParticles } from "./season.js";

startClock();
startSeasonParticles();

let adminKey = localStorage.getItem("lm_admin_key") || "";
let content = null;

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }

function show(panelId){
  $all(".panel").forEach(p=>p.style.display="none");
  $(panelId).style.display="block";
}

async function loadContent(){
  content = await api("/admin/content", {adminKey});
  renderContent();
}

function renderContent(){
  // banners
  const bWrap = $("#bannersList");
  bWrap.innerHTML = "";
  (content.banners||[]).forEach((b,idx)=>{
    const row = document.createElement("div");
    row.className="cardItem";
    row.innerHTML = `
      <div class="title">#${idx+1} — ${escapeHtml(b.title||"Banner")}</div>
      <div class="desc">img: ${escapeHtml(b.img||"-")}<br>href: ${escapeHtml(b.href||"-")}</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <button class="btn" data-act="toggle">active: ${b.active===false?"false":"true"}</button>
        <button class="btn danger" data-act="del">O‘chirish</button>
      </div>
    `;
    row.querySelector('[data-act="toggle"]').onclick = ()=>{
      b.active = !(b.active===false);
      renderContent();
    };
    row.querySelector('[data-act="del"]').onclick = ()=>{
      content.banners.splice(idx,1);
      renderContent();
    };
    bWrap.appendChild(row);
  });

  // cards
  const cWrap = $("#cardsList");
  cWrap.innerHTML = "";
  (content.cards||[]).forEach((c,idx)=>{
    const row = document.createElement("div");
    row.className="cardItem";
    row.innerHTML = `
      <div class="badge"><span>${escapeHtml(c.tag||"Boshqa")}</span><span style="color:var(--brand)">●</span></div>
      <div class="title">#${idx+1} — ${escapeHtml(c.title||"Card")}</div>
      <div class="desc">${escapeHtml(c.desc||"")}</div>
      <div class="desc">href: ${escapeHtml(c.href||"-")}</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <button class="btn" data-act="toggle">active: ${c.active===false?"false":"true"}</button>
        <button class="btn danger" data-act="del">O‘chirish</button>
      </div>
    `;
    row.querySelector('[data-act="toggle"]').onclick = ()=>{
      c.active = !(c.active===false);
      renderContent();
    };
    row.querySelector('[data-act="del"]').onclick = ()=>{
      content.cards.splice(idx,1);
      renderContent();
    };
    cWrap.appendChild(row);
  });
}

async function saveContent(){
  await api("/admin/content", {method:"POST", adminKey, body:content});
  toast("Saqlangan ✅");
}

async function loadUsers(){
  const d = await api("/admin/users", {adminKey});
  const wrap = $("#usersList");
  wrap.innerHTML = "";
  d.users.forEach(u=>{
    const row = document.createElement("div");
    row.className="cardItem";
    row.innerHTML = `
      <div class="title">${escapeHtml(u.loginId)} <span style="color:var(--muted); font-size:12px">(${escapeHtml(u.name||"")})</span></div>
      <div class="desc">points: <b>${u.points??0}</b> • balance: <b>${u.balance??0}</b></div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px">
        <input class="input" placeholder="Points" value="${u.points??0}" data-k="points"/>
        <input class="input" placeholder="Balance" value="${u.balance??0}" data-k="balance"/>
      </div>
      <input class="input" placeholder="Ism (ixtiyoriy)" value="${escapeHtml(u.name||"")}" data-k="name" style="margin-top:10px"/>
      <button class="btn primary" style="width:100%; margin-top:10px">Yangilash</button>
    `;
    row.querySelector("button").onclick = async ()=>{
      const points = Number(row.querySelector('[data-k="points"]').value||0);
      const balance = Number(row.querySelector('[data-k="balance"]').value||0);
      const name = row.querySelector('[data-k="name"]').value||"";
      await api("/admin/users", {method:"PATCH", adminKey, body:{loginId:u.loginId, points, balance, name}});
      toast("Yangilandi ✅");
      await loadUsers();
    };
    wrap.appendChild(row);
  });
}

$("#adminKey").value = adminKey;
$("#saveKey").onclick = ()=>{
  adminKey = $("#adminKey").value.trim();
  localStorage.setItem("lm_admin_key", adminKey);
  toast("Admin key saqlandi");
};

$("#loadContent").onclick = async ()=>{
  try{
    show("#panelContent");
    await loadContent();
    toast("Content yuklandi");
  }catch(e){ toast(e.message||"Xatolik"); }
};

$("#saveContent").onclick = async ()=>{
  try{ await saveContent(); }catch(e){ toast(e.message||"Xatolik"); }
};

$("#addBanner").onclick = ()=>{
  const img = $("#bannerImg").value.trim();
  const href = $("#bannerHref").value.trim();
  const title = $("#bannerTitle").value.trim();
  content.banners = content.banners || [];
  content.banners.unshift({id: crypto.randomUUID(), title, img, href, active:true});
  renderContent();
  toast("Banner qo‘shildi");
};

$("#addCard").onclick = ()=>{
  const title = $("#cardTitle").value.trim();
  const desc = $("#cardDesc").value.trim();
  const href = $("#cardHref").value.trim();
  const tag = $("#cardTag").value.trim() || "Boshqa";
  content.cards = content.cards || [];
  content.cards.unshift({id: crypto.randomUUID(), title, desc, href, tag, active:true});
  renderContent();
  toast("Card qo‘shildi");
};

$("#tabUsers").onclick = async ()=>{
  try{
    show("#panelUsers");
    await loadUsers();
  }catch(e){ toast(e.message||"Xatolik"); }
};

$("#tabContent").onclick = async ()=>{
  try{
    show("#panelContent");
    await loadContent();
  }catch(e){ toast(e.message||"Xatolik"); }
};

// default view
show("#panelContent");

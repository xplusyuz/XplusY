import { me, logout } from "./auth.js";
import { toast } from "./ui_toast.js";

async function loadFragment(selector, url){
  const host = document.querySelector(selector);
  if(!host) return null;
  const r = await fetch(url, { cache: "no-store" });
  const html = await r.text();
  host.innerHTML = html;
  return host;
}

function fmtDateTimeUz(){
  const d = new Date();
  const days = ["Yak","Dush","Sesh","Chor","Pay","Juma","Shan"];
  const months = ["Yan","Fev","Mar","Apr","May","Iyun","Iyl","Avg","Sen","Okt","Noy","Dek"];
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${days[d.getDay()]}, ${dd} ${months[d.getMonth()]} • ${hh}:${mm}`;
}

function setText(id, val){
  const el = document.getElementById(id);
  if(el) el.textContent = val ?? "—";
}

function setAvatar(src){
  const img = document.getElementById("userAvatar");
  if(!img) return;
  img.src = src || "assets/avatars/1.png";
}

function openModal(id, open){
  const m = document.getElementById(id);
  if(!m) return;
  m.setAttribute("aria-hidden", open? "false":"true");
  m.classList.toggle("open", !!open);
}

function ensureNotifModal(){
  if(document.getElementById("notifModal")) return;
  const overlay = document.createElement("div");
  overlay.className = "modalOverlay modalApp";
  overlay.id = "notifModal";
  overlay.setAttribute("aria-hidden","true");
  overlay.innerHTML = `
    <div class="modal glass" role="dialog" aria-modal="true" aria-label="Bildirishnomalar">
      <div class="modalHead">
        <div>
          <div class="modalTitle">Bildirishnomalar</div>
          <div class="small">Oxirgi yangiliklar</div>
        </div>
        <button class="iconBtn" id="notifClose" type="button" aria-label="Yopish">✕</button>
      </div>
      <div class="hr"></div>
      <div class="modalBody" style="max-height:55vh; overflow:auto;">
        <ul class="notifList" id="notifList"><li class="small">Hozircha bildirishnoma yo‘q.</li></ul>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

export async function initHeader({ requireAuth=true } = {}){
  // 1) mount fragment
  await loadFragment("#appHeader", "partials/header.html");

  // 2) show datetime under brand
  setText("lmHeaderSub", fmtDateTimeUz());
  setInterval(()=> setText("lmHeaderSub", fmtDateTimeUz()), 30_000);

  // 3) auth + profile
  let user = null;
  try{
    user = await me();
  }catch(e){
    if(requireAuth){
      location.href = "./";
      return;
    }
  }

  if(user){
    setText("userName", user?.profile?.fullName || user?.profile?.firstName || "Foydalanuvchi");
    setText("userId", user?.loginId || user?.id || "—");
    setText("userPoints", user?.profile?.points ?? 0);
    setText("userBalance", user?.profile?.balance ?? 0);
    setText("userAge", user?.profile?.age ?? "—");
    setAvatar(user?.profile?.avatarUrl || user?.profile?.avatar || "");
  }

  // 4) notifications
  ensureNotifModal();
  const btnBell = document.getElementById("btnBell");
  const notifClose = document.getElementById("notifClose");
  btnBell?.addEventListener("click", ()=> openModal("notifModal", true));
  notifClose?.addEventListener("click", ()=> openModal("notifModal", false));
  document.getElementById("notifModal")?.addEventListener("click", (e)=>{
    if(e.target?.id === "notifModal") openModal("notifModal", false);
  });

  // 5) profile click -> if page has profile modal hook, fire a custom event
  document.getElementById("profileMini")?.addEventListener("click", ()=>{
    window.dispatchEvent(new CustomEvent("lm:openProfile"));
  });

  // 6) logout
  document.getElementById("btnLogout")?.addEventListener("click", async ()=>{
    await logout();
    toast("Chiqildi", "ok");
    location.href = "./";
  });

  return user;
}

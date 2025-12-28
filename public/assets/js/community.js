import { api } from "./api.js";
import { getToken } from "./auth.js";

function escapeHtml(s=""){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

export async function loadLeaderboard({ limit=20 } = {}) {
  const list = document.getElementById("lbList");
  if (!list) return;
  list.innerHTML = `<li class="lbLoading">Yuklanmoqda…</li>`;
  try{
    const data = await api(`leaderboard?limit=${encodeURIComponent(limit)}`, { method:"GET" });
    const items = (data.items||[]);
    if (!items.length){
      list.innerHTML = `<li class="lbEmpty">Hali reyting yo‘q.</li>`;
      return;
    }
    list.innerHTML = items.map((u, i)=>`
      <li class="lbRow">
        <div class="lbRank">${i+1}</div>
        <div class="lbAvatar">${u.avatarUrl ? `<img src="${escapeHtml(u.avatarUrl)}" alt="">` : `<span>👤</span>`}</div>
        <div class="lbWho">
          <div class="lbName">${escapeHtml(u.name)}</div>
          <div class="lbMeta">${escapeHtml(u.publicId || u.loginId || "")}</div>
        </div>
        <div class="lbPts"><span>⭐</span>${Number(u.points||0)}</div>
      </li>
    `).join("");
  }catch(e){
    list.innerHTML = `<li class="lbError">Reytingni yuklab bo‘lmadi.</li>`;
  }
}

export async function wireComments(){
  const form = document.getElementById("commentForm");
  const input = document.getElementById("commentText");
  const list = document.getElementById("commentsList");
  if (!form || !input || !list) return;

  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    form.classList.add("busy");
    try{
      const token = getToken();
      if (!token) throw new Error("token");
      await api("comments", {
        method:"POST",
        headers:{ "Authorization": "Bearer " + token },
        body:{ text }
      });
      input.value="";
      await loadComments();
    }catch(e){
      alert("Izoh yuborilmadi. (Login bo‘lishingiz kerak)");
    }finally{
      form.classList.remove("busy");
    }
  });

  await loadComments();
}

export async function loadComments({ limit=20 } = {}) {
  const list = document.getElementById("commentsList");
  if (!list) return;
  list.innerHTML = `<div class="cmLoading">Yuklanmoqda…</div>`;
  try{
    const data = await api(`comments?limit=${encodeURIComponent(limit)}`, { method:"GET" });
    const items = (data.items||[]);
    if (!items.length){
      list.innerHTML = `<div class="cmEmpty">Hali izoh yo‘q. Birinchi bo‘lib yozing 😊</div>`;
      return;
    }
    list.innerHTML = items.map(c=>`
      <div class="cmItem">
        <div class="cmTop">
          <div class="cmName">${escapeHtml(c.name||"Foydalanuvchi")}</div>
          <div class="cmTime">${c.createdAt ? new Date(c.createdAt).toLocaleString("uz-UZ") : ""}</div>
        </div>
        <div class="cmText">${escapeHtml(c.text||"")}</div>
      </div>
    `).join("");
  }catch(e){
    list.innerHTML = `<div class="cmError">Izohlarni yuklab bo‘lmadi.</div>`;
  }
}


import { auth, getUserDoc, listUsersTop, adminAdjustByNumericId, createEvent } from "./firebase.js";

async function guardAdmin() {
  const u = auth.currentUser;
  if (!u) { alert("Kirish kerak"); location.href="/"; return; }
  const d = await getUserDoc(u.uid);
  if ((d.role!=="admin") && (d.numericId!==100)) {
    alert("Ruxsat yo'q (admin)");
    location.href="/";
  }
}
guardAdmin();

async function loadUsers() {
  const rows = await listUsersTop(20);
  const tb = document.querySelector("#adminUsers tbody");
  tb.innerHTML = rows.map(u => `
    <tr><td>${u.numericId||"—"}</td><td>${u.displayName||u.email||"User"}</td><td>${u.balance||0}</td><td>${u.gems||0}</td><td></td></tr>
  `).join("");
}
loadUsers();

document.getElementById("admApply")?.addEventListener("click", async ()=>{
  const id = document.getElementById("admTarget").value.trim();
  const dbal = Number(document.getElementById("admBalanceDelta").value||0);
  const dgem = Number(document.getElementById("admGemsDelta").value||0);
  try {
    await adminAdjustByNumericId(id, dbal, dgem);
    alert("Yangilandi");
    loadUsers();
  } catch (e) {
    alert(e.message);
  }
});

document.getElementById("evCreate")?.addEventListener("click", async ()=>{
  const title = document.getElementById("evTitle").value.trim();
  const start = document.getElementById("evStart").value;
  const duration = Number(document.getElementById("evDuration").value||0);
  const price = Number(document.getElementById("evPrice").value||0);
  if (!title || !start || !duration) return alert("To'ldiring");
  const startAt = { seconds: Math.floor(new Date(start).getTime()/1000) };
  await createEvent({ title, startAt, durationMin: duration, price });
  alert("Musobaqa yaratildi");
});

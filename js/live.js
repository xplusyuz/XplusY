
import { auth, onAuth, db, listenEvents, joinEvent } from "./firebase.js";

const elGrid = document.getElementById("events");
let selectedEvent = null;

function fmtDate(ts) {
  try { return new Date(ts.seconds*1000).toLocaleString(); } catch { return String(ts); }
}

function renderEvents(events) {
  elGrid.innerHTML = "";
  events.forEach(ev => {
    const card = document.createElement("div");
    card.className = "card";
    const when = fmtDate(ev.startAt);
    card.innerHTML = `
      <div class="title">${ev.title || "Musobaqa"}</div>
      <div class="meta">Boshlanish: ${when} — davomiyligi: ${ev.durationMin || 0} daq</div>
      <div class="row mt">
        <span class="chip">Narx: ${ev.price || 0} so'm</span>
        <button class="btn primary wide" data-id="${ev.id}">Qo'shilish</button>
      </div>
    `;
    elGrid.appendChild(card);
  });

  elGrid.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedEvent = events.find(e => e.id === btn.dataset.id);
      document.getElementById("joinInfo").textContent = `Narx: ${selectedEvent.price || 0} so'm.`;
      document.body.setAttribute("data-modal-open","true");
      document.getElementById("joinModal").setAttribute("aria-hidden","false");
    });
  });
}

document.getElementById("confirmJoin")?.addEventListener("click", async ()=>{
  const user = auth.currentUser;
  if (!user || !selectedEvent) return;
  try {
    await joinEvent(user.uid, selectedEvent.id, selectedEvent.price||0);
    document.getElementById("joinModal").setAttribute("aria-hidden","true");
    document.body.removeAttribute("data-modal-open");
    alert("Qo'shildingiz!");
  } catch (e) {
    alert(e.message);
  }
});

listenEvents(renderEvents);

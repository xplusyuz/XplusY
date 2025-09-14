import { attachAuthUI, initUX, db, ADMIN_NUMERIC_IDS } from "./common.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where,
  orderBy, limit, getDocs, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

// ==== CONFIG: Telegram =====
const TG_TOKEN = "8021293022:AAGud9dz-Dv_5RjsjF0RFaqgMR2LeKA6G7c";
const TG_CHAT_ID = "2049065724";
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`;
// ===========================

attachAuthUI({ requireSignIn: true });
initUX();

const qs = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => [...el.querySelectorAll(s)];
const show = el => el && el.classList.remove("hidden");
const hide = el => el && el.classList.add("hidden");

function openModal(id) { hideAll(); show(qs("#" + id)); }
function hideAll() { qsa(".modal").forEach(m => m.classList.add("hidden")); }

document.addEventListener("click", (e) => {
  const openId = e.target.getAttribute("data-open");
  if (openId) openModal(openId);
  if (e.target.hasAttribute("data-close")) e.target.closest(".modal")?.classList.add("hidden");
  if (e.target.classList.contains("modal")) e.target.classList.add("hidden");
});

let currentUser = null, currentDoc = null;
document.addEventListener("mc:user-ready", async () => {
  const { user, profile } = window.__mcUser;
  currentUser = user; currentDoc = profile;
  fillProfile(profile);
  renderBadges(profile.badges || []);
});

function fillProfile(d) {
  qs("#pf_numericId").value = d.numericId ?? "—";
  qs("#pf_firstName").value = d.firstName ?? "";
  qs("#pf_lastName").value = d.lastName ?? "";
  qs("#pf_middleName").value = d.middleName ?? "";
  qs("#pf_dob").value = d.dob ?? "";
  qs("#pf_region").value = d.region ?? "";
  qs("#pf_district").value = d.district ?? "";
  qs("#pf_phone").value = d.phone ?? "";
  qs("#pf_balance").value = d.balance ?? 0;
  qs("#pf_gems").value = d.gems ?? 0;
}

function setEditable(x) {
  ["#pf_firstName", "#pf_lastName", "#pf_middleName", "#pf_dob", "#pf_region", "#pf_district", "#pf_phone"]
    .forEach(s => { qs(s).readOnly = !x; });
  qs("#profileSave").disabled = !x;
}
qs("#profileEdit").addEventListener("click", () => setEditable(true));
qs("#profileSave").addEventListener("click", async () => {
  try {
    const ref = doc(db, "users", currentUser.uid);
    const data = {
      firstName: qs("#pf_firstName").value.trim(),
      lastName: qs("#pf_lastName").value.trim(),
      middleName: qs("#pf_middleName").value.trim(),
      dob: qs("#pf_dob").value,
      region: qs("#pf_region").value.trim(),
      district: qs("#pf_district").value.trim(),
      phone: qs("#pf_phone").value.trim(),
    };
    await updateDoc(ref, data);
    alert("Profil saqlandi ✅");
    setEditable(false);
    currentDoc = { ...currentDoc, ...data };
  } catch (e) { alert("Xato: " + e.message); }
});

// Results
async function loadResults() {
  const list = qs("#resultsList");
  list.innerHTML = '<div class="card">Yuklanmoqda…</div>';
  const col = collection(db, "users", currentUser.uid, "results");
  const snap = await getDocs(query(col, orderBy("createdAtFS", "desc"), limit(20)));
  list.innerHTML = "";
  if (snap.empty) { list.innerHTML = '<div class="hint">Hozircha natija yo‘q.</div>'; return; }
  snap.forEach(d => {
    const r = d.data();
    const when = r.createdAt || "";
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<div><b>${r.examName || "Sinov"}</b></div>
      <div class="sub">Score: ${r.score?.toFixed?.(2) ?? r.score} — ${when}</div>`;
    list.appendChild(el);
  });
}
document.querySelector("#cardResults .btn")?.addEventListener("click", loadResults);

// Badges
function renderBadges(arr) {
  const w = qs("#badgesWrap");
  w.innerHTML = "";
  if (!arr || !arr.length) { w.innerHTML = '<div class="hint">Hozircha yutuqlar yo‘q.</div>'; return; }
  arr.forEach(b => { const s = document.createElement("span"); s.className = "pill"; s.textContent = b; w.appendChild(s); });
}

// Promo apply (user)
qs("#promoApply").addEventListener("click", async () => {
  const msg = qs("#promoMsg"); msg.textContent = "";
  const code = qs("#promoInput").value.trim(); if (!code) { msg.textContent = "Kod kiriting"; return; }
  try {
    const promoRef = doc(db, "promoCodes", code);
    const userRef = doc(db, "users", currentUser.uid);
    const redRef = doc(db, "users", currentUser.uid, "promoRedemptions", code);
    await runTransaction(db, async (tx) => {
      const p = await tx.get(promoRef); if (!p.exists()) throw new Error("Kod topilmadi");
      const D = p.data();
      if (D.active === false) throw new Error("Kod faol emas");
      if (D.expiresAt && D.expiresAt.toDate && D.expiresAt.toDate() < new Date()) throw new Error("Muddati tugagan");
      const used = await tx.get(redRef); if (used.exists()) throw new Error("Bu kod allaqachon ishlatilgan");
      const u = await tx.get(userRef); if (!u.exists()) throw new Error("Foydalanuvchi topilmadi");
      tx.update(userRef, {
        balance: Number(u.data().balance || 0) + Number(D.balance || 0),
        gems: Number(u.data().gems || 0) + Number(D.gems || 0)
      });
      tx.set(redRef, { usedAt: serverTimestamp(), code });
    });
    msg.textContent = "✅ Qo‘llandi";
  } catch (e) { msg.textContent = "❌ " + (e.message || e); }
});

// Admin open (guarded)
document.getElementById("openAdmin")?.addEventListener("click", () => {
  if (!ADMIN_NUMERIC_IDS.includes(Number(currentDoc?.numericId))) return alert("Faqat 1000001/1000002");
  openModal("adminModal");
  document.getElementById("adm_pay_pending")?.click();
});

// ---------- Top-up: upload -> Firestore -> Telegram -> history ----------
function bindTopup() {
  const btn = document.getElementById("pay_submit");
  if (!btn || btn._bound) return;
  btn._bound = true;
  btn.addEventListener("click", async () => {
    const msg = qs("#pay_msg"); msg.className = "hint"; msg.textContent = "Yuborilmoqda…";
    btn.disabled = true;
    try {
      const amount = Number(qs("#pay_amount").value || 0);
      if (!amount || amount < 1000) throw new Error("Summani kiriting");
      const note = qs("#pay_note").value.trim();
      const file = qs("#pay_file").files?.[0];
      const refCol = collection(db, "users", currentUser.uid, "topups");
      const id = Math.random().toString(36).slice(2);
      let fileURL = null, fileName = null;
      try {
        if (file) {
          const storage = getStorage();
          fileName = file.name;
          const path = `users/${currentUser.uid}/topups/${id}/${fileName}`;
          const sref = sRef(storage, path);
          await uploadBytes(sref, file);
          fileURL = await getDownloadURL(sref);
        }
      } catch (err) { console.warn("Storage yuklashda xato:", err); }
      const payload = {
        amount, note, filename: fileName, fileURL: fileURL || null,
        createdAt: new Date(), createdAtFS: serverTimestamp(),
        status: "pending",
        userNumericId: currentDoc?.numericId || null,
        userName: `${currentDoc?.firstName || ""} ${currentDoc?.lastName || ""}`.trim(),
        userPhone: currentDoc?.phone || null
      };
      await setDoc(doc(refCol, id), payload);
      try {
        const caption =
          `🧾 Yangi to‘lov arizasi\n\n` +
          `💰 Summasi: ${amount.toLocaleString("uz-UZ")} so‘m\n` +
          `👤 ID: ${currentDoc?.numericId} | ${currentDoc?.firstName || ""} ${currentDoc?.lastName || ""}\n` +
          `📞 Tel: ${currentDoc?.phone || "-"}\n` +
          (note ? `📝 Izoh: ${note}\n` : "") +
          (fileURL ? `📎 Chek: ${fileURL}\n` : "");
        const url = fileURL ? `${TG_API}/sendDocument` : `${TG_API}/sendMessage`;
        const body = fileURL
          ? { chat_id: TG_CHAT_ID, caption, document: fileURL, parse_mode: "HTML" }
          : { chat_id: TG_CHAT_ID, text: caption };
        await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch (err) { console.warn("Telegram yuborilmadi:", err); }
      msg.className = "hint ok"; msg.textContent = "✅ Yuborildi. Arizangiz ko‘rib chiqiladi.";
      qs("#pay_amount").value = ""; qs("#pay_note").value = ""; if (qs("#pay_file")) qs("#pay_file").value = "";
      await loadPayHistory();
    } catch (e) {
      msg.className = "hint err"; msg.textContent = "❌ " + (e.message || e);
    } finally { btn.disabled = false; }
  });
}
bindTopup();

export async function loadPayHistory() {
  const wrap = qs("#pay_history"); if (!wrap) return;
  wrap.innerHTML = '<div class="card">Yuklanmoqda…</div>';
  const col = collection(db, "users", currentUser.uid, "topups");
  const snap = await getDocs(query(col, orderBy("createdAtFS", "desc"), limit(20)));
  wrap.innerHTML = "";
  if (snap.empty) { wrap.innerHTML = '<div class="hint">Hozircha ma’lumot yo‘q.</div>'; return; }
  snap.forEach(d => {
    const r = d.data();
    const st = r.status || "pending";
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML =
      `<div class="row"><b>${r.amount?.toLocaleString?.("uz-UZ")} so‘m</b>
        <span class="status-badge status-${st}">${st}</span></div>` +
      (r.note ? `<div class="sub">Izoh: ${r.note}</div>` : "") +
      (r.adminNote && st !== "pending" ? `<div class="sub"><b>Admin izohi:</b> ${r.adminNote}</div>` : "");
    wrap.appendChild(el);
  });
}
document.querySelector('#cardBalance [data-open="topUpModal"]')?.addEventListener("click", () => {
  try { loadPayHistory(); } catch {}
  bindTopup();
});

// ------------------- ADMIN: Users & Promo -------------------
function ensureAdminSync() {
  if (!ADMIN_NUMERIC_IDS.includes(Number(currentDoc?.numericId))) {
    throw new Error("Faqat 1000001/1000002 ruxsat etiladi");
  }
}

// Users list/search
async function adminListTop() {
  ensureAdminSync();
  const table = qs("#adm_table"); table.innerHTML = "";
  const snap = await getDocs(query(collection(db, "users"), orderBy("numericId", "asc"), limit(50)));
  renderAdminTable(snap);
}
async function adminSearch() {
  ensureAdminSync();
  const term = (qs("#adm_query").value || "").trim(); if (!term) return adminListTop();
  let snap;
  if (/^[0-9]+$/.test(term)) {
    snap = await getDocs(query(collection(db, "users"), where("numericId", "==", Number(term)), limit(20)));
  } else {
    snap = await getDocs(query(collection(db, "users"), where("phone", "==", term), limit(20)));
  }
  renderAdminTable(snap);
}
function renderAdminTable(snap) {
  const table = qs("#adm_table"); table.innerHTML = "";
  const head = document.createElement("div"); head.className = "card";
  head.innerHTML = "<b>ID</b> | Ism | Fam | Tel | Viloyat | Balans | Olmos | DOB | Amal";
  table.appendChild(head);
  if (snap.empty) { const d = document.createElement("div"); d.className = "hint"; d.textContent = "Hech narsa topilmadi"; table.appendChild(d); return; }
  snap.forEach(d => {
    const u = d.data();
    const row = document.createElement("div"); row.className = "card adm-row"; row.dataset.uid = d.id;
    row.innerHTML = `
      <input class="a_numericId" type="number" value="${u.numericId ?? ""}" />
      <input class="a_firstName" type="text" value="${u.firstName ?? ""}" />
      <input class="a_lastName" type="text" value="${u.lastName ?? ""}" />
      <input class="a_phone" type="text" value="${u.phone ?? ""}" />
      <input class="a_region" type="text" value="${u.region ?? ""}" />
      <input class="a_balance" type="number" value="${u.balance ?? 0}" />
      <input class="a_gems" type="number" value="${u.gems ?? 0}" />
      <input class="a_dob" type="date" value="${u.dob ?? ""}" />
      <button class="btn primary a_save">Saqlash</button>`;
    table.appendChild(row);
  });
}
document.getElementById("adm_list_all")?.addEventListener("click", adminListTop);
document.getElementById("adm_search")?.addEventListener("click", adminSearch);

// Save user row
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("a_save")) return;
  try {
    ensureAdminSync();
    const row = e.target.closest(".adm-row"); const uid = row.dataset.uid;
    const ref = doc(db, "users", uid);
    await updateDoc(ref, {
      numericId: Number(row.querySelector(".a_numericId").value) || null,
      firstName: row.querySelector(".a_firstName").value.trim(),
      lastName: row.querySelector(".a_lastName").value.trim(),
      phone: row.querySelector(".a_phone").value.trim(),
      region: row.querySelector(".a_region").value.trim(),
      balance: Number(row.querySelector(".a_balance").value),
      gems: Number(row.querySelector(".a_gems").value),
      dob: row.querySelector(".a_dob").value
    });
    alert("Saqlandi ✅");
  } catch (err) { alert("Xato: " + (err.message || err)); }
});

// Promo create (ADMIN)
document.getElementById("pr_create")?.addEventListener("click", async () => {
  try {
    ensureAdminSync();
    const code = qs("#pr_code").value.trim();
    if (!code) throw new Error("Kod kiriting");
    const payload = {
      code,
      active: qs("#pr_active").value === "true",
      balance: Number(qs("#pr_balance").value || 0),
      gems: Number(qs("#pr_gems").value || 0),
      percent: Number(qs("#pr_percent").value || 0),
      maxUses: Number(qs("#pr_max").value || 0),
      perUserLimit: Number(qs("#pr_peruser").value || 1),
      createdAt: serverTimestamp(),
      createdBy: currentUser.uid
    };
    const ex = qs("#pr_expires").value;
    if (ex) payload.expiresAt = new Date(ex + "T23:59:59");
    await setDoc(doc(db, "promoCodes", code), payload);
    qs("#pr_msg").textContent = "✅ Yaratildi";
  } catch (err) {
    qs("#pr_msg").textContent = "❌ " + (err.message || err);
  }
});

// ------------------- ADMIN: Payments list + approve/reject + filters -------------------
async function listPayments(filter = "pending") {
  ensureAdminSync();
  const wrap = qs("#adm_pay_table"); wrap.innerHTML = '<div class="card">Yuklanmoqda…</div>';
  const usersSnap = await getDocs(query(collection(db, "users"), orderBy("numericId", "asc"), limit(200)));
  wrap.innerHTML = "";
  let cnt = 0;
  for (const u of usersSnap.docs) {
    const uid = u.id;
    const col = collection(db, "users", uid, "topups");
    let qy = query(col, orderBy("createdAtFS", "desc"), limit(50));
    if (filter !== "all") qy = query(col, where("status", "==", filter), orderBy("createdAtFS", "desc"), limit(50));
    const snap = await getDocs(qy);
    snap.forEach(d => {
      const r = d.data();
      const nid = r.userNumericId ?? u.data().numericId ?? "—";
      const card = document.createElement("div"); card.className = "card adm-row"; card.dataset.uid = uid; card.dataset.id = d.id;
      card.innerHTML = `
        <div class="row">
          <b>${r.amount?.toLocaleString?.("uz-UZ")} so‘m</b>
          <span class="status-badge status-${r.status || "pending"}">${r.status || "pending"}</span>
        </div>
        <div class="sub">UserID: ${nid} | Name: ${r.userName || ""} | Tel: ${r.userPhone || ""}</div>
        <div class="sub">Topup Doc ID: ${d.id}</div>
        ${r.note ? `<div class="sub">Foydalanuvchi izohi: ${r.note}</div>` : ""}
        ${r.adminNote && r.status !== "pending" ? `<div class="sub"><b>Admin izohi:</b> ${r.adminNote}</div>` : ""}
        <textarea class="adm-note" placeholder="Admin izohi (faqat siz uchun)"></textarea>
        <div class="row">
          ${r.status === "pending" ? `<button class="btn primary a_approve">Qabul qilish</button>
          <button class="btn danger a_reject">Rad etish</button>` : ""}
        </div>`;
      wrap.appendChild(card);
      cnt++;
    });
  }
  if (!cnt) { wrap.innerHTML = '<div class="hint">Hech narsa yo‘q.</div>'; }
}
document.getElementById("adm_pay_pending")?.addEventListener("click", () => listPayments("pending"));
document.getElementById("adm_pay_approved")?.addEventListener("click", () => listPayments("approved"));
document.getElementById("adm_pay_rejected")?.addEventListener("click", () => listPayments("rejected"));
document.getElementById("adm_pay_all")?.addEventListener("click", () => listPayments("all"));

document.addEventListener("click", async (e) => {
  if (!(e.target.classList.contains("a_approve") || e.target.classList.contains("a_reject"))) return;
  try {
    ensureAdminSync();
    const row = e.target.closest(".adm-row");
    const uid = row.dataset.uid, id = row.dataset.id;
    const reason = row.querySelector(".adm-note")?.value?.trim() || "";
    const approved = e.target.classList.contains("a_approve");
    const userRef = doc(db, "users", uid);
    const topupRef = doc(db, "users", uid, "topups", id);
    await runTransaction(db, async (tx) => {
      const t = await tx.get(topupRef); if (!t.exists()) throw new Error("Top-up topilmadi");
      const R = t.data(); if (R.status !== "pending") throw new Error("Bu ariza allaqachon ko‘rilgan");
      const u = await tx.get(userRef); if (!u.exists()) throw new Error("User topilmadi");
      if (approved) {
        const newBal = Number(u.data().balance || 0) + Number(R.amount || 0);
        tx.update(userRef, { balance: newBal });
        tx.update(topupRef, { status: "approved", adminNote: reason, reviewedAt: serverTimestamp(), reviewedBy: currentUser.uid });
      } else {
        tx.update(topupRef, { status: "rejected", adminNote: reason, reviewedAt: serverTimestamp(), reviewedBy: currentUser.uid });
      }
    });
    const badge = row.querySelector(".status-badge");
    badge.textContent = approved ? "approved" : "rejected";
    badge.className = "status-badge " + (approved ? "status-approved" : "status-rejected");
    row.querySelectorAll(".a_approve,.a_reject").forEach(b => b.disabled = true);
    alert("Bajarildi ✅");
  } catch (err) { alert("Xato: " + (err.message || err)); }
});

// -------- Tabs switching --------
function setTab(tab) {
  const tabs = ["Payments", "Users", "Promo"];
  tabs.forEach((name) => {
    const btn = document.getElementById("tab" + name);
    const pane = document.getElementById("pane" + name);
    if (!btn || !pane) return;
    if (name === tab) { btn.classList.add("active"); pane.classList.remove("hidden"); }
    else { btn.classList.remove("active"); pane.classList.add("hidden"); }
  });
}
document.getElementById("tabPayments")?.addEventListener("click", () => { setTab("Payments"); document.getElementById("adm_pay_pending")?.click(); });
document.getElementById("tabUsers")?.addEventListener("click", () => { setTab("Users"); adminListTop(); });
document.getElementById("tabPromo")?.addEventListener("click", () => { setTab("Promo"); });

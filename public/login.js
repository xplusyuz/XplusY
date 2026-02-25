import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

let allowAutoRedirect = true;
let busy = false;

const els = {
  tabLogin: document.getElementById("tabLogin"),
  tabSignup: document.getElementById("tabSignup"),
  notice: document.getElementById("notice"),

  loginForm: document.getElementById("loginForm"),
  loginPhone: document.getElementById("loginPhone"),
  loginPass: document.getElementById("loginPass"),
  toggleLoginPass: document.getElementById("toggleLoginPass"),
  loginBtn: document.getElementById("loginBtn"),

  signupForm: document.getElementById("signupForm"),
  signupName: document.getElementById("signupName"),
  signupPhone: document.getElementById("signupPhone"),
  signupRegion: document.getElementById("signupRegion"),
  signupDistrict: document.getElementById("signupDistrict"),
  signupPost: document.getElementById("signupPost"),
  signupPass: document.getElementById("signupPass"),
  toggleSignupPass: document.getElementById("toggleSignupPass"),
  signupPass2: document.getElementById("signupPass2"),
  signupBtn: document.getElementById("signupBtn"),
};

function showNotice(text, kind = "info") {
  if (!els.notice) return;
  els.notice.textContent = text || "";
  els.notice.className = "notice " + kind;
  els.notice.style.display = text ? "block" : "none";
}

function setBusy(v) {
  busy = v;
  if (els.loginBtn) els.loginBtn.disabled = v;
  if (els.signupBtn) els.signupBtn.disabled = v;
}

function onlyDigits(s) { return (s || "").toString().replace(/\D/g, ""); }

function normalizePhone(raw) {
  const d = onlyDigits(raw);
  if (d.length === 12 && d.startsWith("998")) return d;
  if (d.length === 9) return "998" + d;
  return null;
}

function normalizeOmId(raw) {
  const s = (raw || "").toString().trim().toUpperCase();
  if (!s.startsWith("OM")) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return "OM" + digits.padStart(6, "0");
}

function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms)),
  ]);
}

async function api(path, data) {
  const res = await withTimeout(fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data || {}),
  }), 12000);

  const txt = await res.text();
  let j = null;
  try { j = JSON.parse(txt); } catch (e) {}

  if (!res.ok) {
    const msg = j?.message || "Xatolik. Qayta urinib ko‘ring.";
    const code = j?.code || ("http_" + res.status);
    const err = new Error(msg);
    err.code = code;
    err.http = res.status;
    throw err;
  }
  return j || {};
}

function switchTab(toSignup) {
  if (toSignup) {
    els.tabSignup?.classList.add("active");
    els.tabLogin?.classList.remove("active");
    els.signupForm?.classList.remove("hidden");
    els.loginForm?.classList.add("hidden");
  } else {
    els.tabLogin?.classList.add("active");
    els.tabSignup?.classList.remove("active");
    els.loginForm?.classList.remove("hidden");
    els.signupForm?.classList.add("hidden");
  }
  showNotice("");
}

function setupPasswordToggles() {
  if (els.toggleLoginPass) {
    els.toggleLoginPass.addEventListener("click", () => {
      els.loginPass.type = els.loginPass.type === "password" ? "text" : "password";
    });
  }
  if (els.toggleSignupPass) {
    els.toggleSignupPass.addEventListener("click", () => {
      els.signupPass.type = els.signupPass.type === "password" ? "text" : "password";
      els.signupPass2.type = els.signupPass2.type === "password" ? "text" : "password";
    });
  }
}

async function loadRegionJson() {
  try {
    const res = await fetch("./region.json", { cache: "no-store" });
    const data = await res.json();
    // data can be {regions:[...]} or single region object; support both
    const regions = Array.isArray(data?.regions) ? data.regions : (Array.isArray(data) ? data : [data]).filter(Boolean);

    const sel = els.signupRegion;
    if (!sel) return;

    // fill options
    sel.innerHTML = '<option value="">Viloyatni tanlang</option>';
    for (const r of regions) {
      const opt = document.createElement("option");
      opt.value = r.name || "";
      opt.textContent = r.name || "";
      sel.appendChild(opt);
    }

    sel.addEventListener("change", () => {
      const r = regions.find(x => (x.name || "") === sel.value);
      const dSel = els.signupDistrict;
      const pSel = els.signupPost;

      dSel.disabled = !r;
      pSel.disabled = true;
      pSel.innerHTML = '<option value="">Avval tuman/shaharni tanlang</option>';

      if (!r) {
        dSel.innerHTML = '<option value="">Avval viloyatni tanlang</option>';
        return;
      }

      dSel.innerHTML = '<option value="">Tumanni tanlang</option>';
      for (const d of (r.districts || [])) {
        const opt = document.createElement("option");
        opt.value = d.name || "";
        opt.textContent = d.name || "";
        dSel.appendChild(opt);
      }
    });

    els.signupDistrict.addEventListener("change", () => {
      const rName = els.signupRegion.value;
      const dName = els.signupDistrict.value;

      const r = regions.find(x => (x.name || "") === rName);
      const d = r?.districts?.find(x => (x.name || "") === dName);

      const pSel = els.signupPost;
      pSel.disabled = !d;
      if (!d) {
        pSel.innerHTML = '<option value="">Avval tuman/shaharni tanlang</option>';
        return;
      }

      const posts = d.posts || [];
      pSel.innerHTML = '<option value="">Pochta bo‘limini tanlang</option>';
      for (const p of posts) {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        pSel.appendChild(opt);
      }
    });

  } catch (e) {
    console.warn("region.json load failed", e);
  }
}

async function doLogin() {
  if (busy) return;
  showNotice("");
  setBusy(true);

  try {
    const raw = els.loginPhone.value.trim();
    const pass = els.loginPass.value;

    const om = normalizeOmId(raw);
    const phone = om ? null : normalizePhone(raw);

    if (!om && !phone) {
      showNotice("Telefon yoki OM ID noto‘g‘ri. Masalan: 998901234567 yoki OM000123", "error");
      return;
    }
    if (!pass) {
      showNotice("Parolni kiriting.", "error");
      return;
    }

    const resp = await api("/.netlify/functions/auth_login", {
      identifier: om || phone,
      password: pass,
    });

    await signInWithCustomToken(auth, resp.token);

    showNotice("Kirish muvaffaqiyatli. Yo‘naltirilmoqda...", "success");
    // redirect handled by onAuthStateChanged
  } catch (e) {
    if (e.message === "TIMEOUT") {
      showNotice("Internet sekin. Qayta urinib ko‘ring.", "error");
    } else {
      showNotice(e.message || "Kirishda xatolik.", "error");
    }
  } finally {
    setBusy(false);
  }
}

async function doRegister() {
  if (busy) return;
  showNotice("");
  setBusy(true);

  try {
    const name = els.signupName.value.trim();
    const phone = normalizePhone(els.signupPhone.value);
    const region = els.signupRegion?.value || "";
    const district = els.signupDistrict?.value || "";
    const post = els.signupPost?.value || "";
    const pass = els.signupPass.value;
    const pass2 = els.signupPass2.value;

    if (!name || name.length < 2) {
      showNotice("Ismni to‘g‘ri kiriting.", "error");
      return;
    }
    if (!phone) {
      showNotice("Telefon noto‘g‘ri. Masalan: 998901234567", "error");
      return;
    }
    if (!region || !district || !post) {
      showNotice("Profilni to‘liq to‘ldiring: viloyat, tuman, pochta.", "error");
      return;
    }
    if (!pass || pass.length < 6) {
      showNotice("Parol kamida 6 ta belgidan iborat bo‘lsin.", "error");
      return;
    }
    if (pass !== pass2) {
      showNotice("Parollar mos emas.", "error");
      return;
    }

    const resp = await api("/.netlify/functions/auth_register", {
      name,
      phone,
      region,
      district,
      post,
      password: pass,
    });

    await signInWithCustomToken(auth, resp.token);

    showNotice(`Ro‘yxatdan o‘tish muvaffaqiyatli! ID: ${resp.omId}`, "success");
  } catch (e) {
    if (e.message === "TIMEOUT") {
      showNotice("Internet sekin. Qayta urinib ko‘ring.", "error");
    } else {
      showNotice(e.message || "Ro‘yxatdan o‘tishda xatolik.", "error");
    }
  } finally {
    setBusy(false);
  }
}

function wireUi() {
  els.tabLogin?.addEventListener("click", () => switchTab(false));
  els.tabSignup?.addEventListener("click", () => switchTab(true));

  els.loginForm?.addEventListener("submit", (ev) => { ev.preventDefault(); doLogin(); });
  els.signupForm?.addEventListener("submit", (ev) => { ev.preventDefault(); doRegister(); });

  setupPasswordToggles();
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !allowAutoRedirect) return;

  // Optional: ensure profile exists (users doc). If missing, redirect to profile.
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      window.location.href = "/profile.html";
      return;
    }
  } catch (e) {}

  // Redirect to home
  window.location.href = "/index.html";
});

wireUi();
loadRegionJson();

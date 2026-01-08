/* LeaderMath.UZ PWA helper (safe, isolated) */
(() => {
  "use strict";

  const STORE_URLS = {
    play: "",      // optional: https://play.google.com/store/apps/details?id=...
    appstore: "",  // optional: https://apps.apple.com/app/id...
    msstore: ""    // optional: https://apps.microsoft.com/detail/...
  };

  const $ = (sel, root=document) => root.querySelector(sel);

  // --- install state detection ---
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
      || (window.navigator && window.navigator.standalone === true);
  }

  function platform() {
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);
    const isWindows = /Windows/.test(ua);
    const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(ua) && !isIOS;
    return { isIOS, isAndroid, isWindows, isMac };
  }

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    updateButtons();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    updateButtons();
  });

  // --- service worker registration ---
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    } catch (err) {
      // silent
    }
  }

  // --- bottom sheet (iOS / fallback instructions) ---
  function ensureSheet() {
    let sheet = $("#pwaSheet");
    if (sheet) return sheet;

    sheet = document.createElement("div");
    sheet.id = "pwaSheet";
    sheet.className = "pwaSheet";
    sheet.innerHTML = `
      <div class="backdrop" data-pwa-close></div>
      <div class="card" role="dialog" aria-modal="true" aria-label="O'rnatish">
        <div class="hd">
          <div>
            <div class="ttl">📲 Ilovani o‘rnatish</div>
            <div class="txt" id="pwaSheetText">Brauzerdan PWA sifatida o‘rnatasiz.</div>
          </div>
          <button class="x" type="button" aria-label="Yopish" data-pwa-close>✕</button>
        </div>
        <div class="pwaSteps" id="pwaSteps"></div>
      </div>
    `;
    document.body.appendChild(sheet);

    sheet.addEventListener("click", (e) => {
      if (e.target && e.target.hasAttribute("data-pwa-close")) closeSheet();
    });
    return sheet;
  }

  function openSheet(kind="ios") {
    const sheet = ensureSheet();
    const text = $("#pwaSheetText", sheet);
    const steps = $("#pwaSteps", sheet);

    const { isIOS, isAndroid, isWindows, isMac } = platform();

    let title = "📲 Ilovani o‘rnatish";
    let desc = "Brauzerdan PWA sifatida o‘rnatasiz.";
    let list = [];

    if (kind === "ios" || isIOS) {
      desc = "iPhone/iPad (Safari): 'Add to Home Screen' orqali o‘rnating.";
      list = [
        "Safari’da saytni oching",
        "Pastdagi 'Share' (□↑) tugmasini bosing",
        "'Add to Home Screen' ni tanlang",
        "‘Add’ bosing — tayyor ✅"
      ];
    } else if (kind === "store") {
      desc = "Store havolasi hozir sozlanmagan. Istasangiz PWA sifatida o‘rnatsangiz bo‘ladi.";
      list = [
        "Brauzer menyusidan 'Install app' yoki 'Add to Home screen' ni tanlang",
        "Yoki pastdagi 'O‘rnatish' tugmasini bosing (agar chiqsa)"
      ];
    } else if (isAndroid) {
      desc = "Android (Chrome/Edge): 'Install app' orqali o‘rnating.";
      list = [
        "Brauzer menyusini oching (⋮)",
        "'Install app' / 'Add to Home screen' ni tanlang",
        "Tasdiqlang — tayyor ✅"
      ];
    } else if (isWindows || isMac) {
      desc = "Kompyuter (Chrome/Edge): address bar yonida 'Install' chiqadi.";
      list = [
        "Address bar yonidagi install belgisini bosing",
        "Yoki menyudan 'Install' ni tanlang",
        "Tasdiqlang — tayyor ✅"
      ];
    } else {
      list = ["Brauzer menyusidan 'Install' / 'Add to Home screen' ni qidiring."];
    }

    if (text) text.textContent = desc;
    steps.innerHTML = list.map((t,i)=>`
      <div class="pwaStep">
        <div class="n">${i+1}</div>
        <div class="txt">${t}</div>
      </div>
    `).join("");

    sheet.classList.add("open");
    document.body.classList.add("noScroll");
  }

  function closeSheet() {
    const sheet = $("#pwaSheet");
    if (!sheet) return;
    sheet.classList.remove("open");
    document.body.classList.remove("noScroll");
  }

  // --- install action ---
  async function doInstall() {
    const { isIOS } = platform();
    if (isStandalone()) return;

    if (isIOS) {
      openSheet("ios");
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {}
      deferredPrompt = null;
      updateButtons();
      return;
    }

    // fallback instructions
    openSheet("other");
  }

  function setInstalled(btn, label="O‘rnatilgan ✅") {
    if (!btn) return;
    btn.classList.add("installed");
    btn.classList.remove("install");
    btn.setAttribute("aria-disabled", "true");
    btn.dataset.state = "installed";
    btn.innerHTML = `✅ ${label}`;
  }

  function setReady(btn, html, onClick) {
    if (!btn) return;
    btn.classList.remove("installed");
    btn.classList.add("install");
    btn.removeAttribute("aria-disabled");
    btn.dataset.state = "ready";
    btn.innerHTML = html;
    btn.onclick = onClick;
  }

  function updateButtons() {
    const installed = isStandalone();
    const { isIOS, isAndroid, isWindows, isMac } = platform();

    // main install button
    const installBtn = $("#btnInstallPWA");
    if (installBtn) {
      if (installed) setInstalled(installBtn, "Ilova o‘rnatilgan");
      else {
        const canPrompt = !!deferredPrompt && !isIOS;
        const label = canPrompt ? "O‘rnatish" : "O‘rnatish";
        setReady(installBtn, `⬇️ ${label}`, doInstall);
      }
    }

    // store buttons
    const playBtn = $("#btnPlayStore");
    const appBtn  = $("#btnAppStore");
    const msBtn   = $("#btnMsStore");

    // helper for each store button
    const setStore = (btn, name, url, active) => {
      if (!btn) return;
      if (installed && active) return setInstalled(btn, name);
      // On platform: if url present open it; otherwise open sheet
      btn.classList.remove("installed");
      btn.dataset.state = "ready";
      btn.setAttribute("aria-disabled","false");
      btn.onclick = (e) => {
        e.preventDefault();
        if (url) window.open(url, "_blank", "noopener");
        else openSheet("store");
      };
    };

    setStore(playBtn, "Play Market", STORE_URLS.play, isAndroid);
    setStore(appBtn,  "App Store",   STORE_URLS.appstore, isIOS);
    setStore(msBtn,   "Microsoft Store", STORE_URLS.msstore, isWindows);
  }

  function wireFooter() {
    // Only run if footer buttons exist
    const bar = $("#lmStoreBar");
    if (!bar) return;

    // attach click for install
    const installBtn = $("#btnInstallPWA");
    if (installBtn) installBtn.addEventListener("click", (e)=>{ e.preventDefault(); doInstall(); });

    updateButtons();
  }

  // run
  document.addEventListener("DOMContentLoaded", () => {
    registerSW();
    wireFooter();
    // update again after a moment (some browsers set display-mode late)
    setTimeout(updateButtons, 600);
  });
})();

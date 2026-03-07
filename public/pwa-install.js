(() => {
  const state = {
    deferredPrompt: null,
    topbarShown: false,
    dismissed: sessionStorage.getItem('om_pwa_hide') === '1'
  };

  const ua = navigator.userAgent || "";
  const isTelegram = /Telegram|Tg\//i.test(ua) || document.referrer.includes('t.me');
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isAndroid = /Android/i.test(ua);
  const currentUrl = new URL(location.href);
  const installEntry = `${location.origin}/install`;

  function cleanupLegacyCaches() {
    const run = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        }
      } catch (_) {}
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 250);
  }

  function addStyles() {
    if (document.getElementById('om-pwa-style')) return;
    const style = document.createElement('style');
    style.id = 'om-pwa-style';
    style.textContent = `
      .omPwaTop{position:fixed;top:12px;left:12px;right:12px;z-index:9999;display:none}
      .omPwaTop.show{display:block}
      .omPwaTopCard{
        max-width:980px;margin:0 auto;background:rgba(255,255,255,.95);backdrop-filter:blur(14px);
        border:1px solid rgba(15,23,42,.08);border-radius:22px;box-shadow:0 16px 42px rgba(15,23,42,.16);
        padding:12px 14px;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center
      }
      .omPwaIcon{width:48px;height:48px;border-radius:16px;overflow:hidden;background:#eef8f2;box-shadow:0 8px 18px rgba(46,139,87,.12)}
      .omPwaIcon img{width:100%;height:100%;object-fit:cover}
      .omPwaText b{display:block;font-size:16px;color:#0f172a;margin-bottom:3px}
      .omPwaText span{display:block;font-size:13px;line-height:1.4;color:#64748b}
      .omPwaActs{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .omPwaBtn{
        appearance:none;border:0;border-radius:14px;padding:11px 13px;font-weight:800;font-size:14px;cursor:pointer;
        display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none
      }
      .omPwaBtn.primary{background:linear-gradient(180deg,#2E8B57,#246c46);color:#fff;box-shadow:0 12px 28px rgba(46,139,87,.24)}
      .omPwaBtn.secondary{background:#fff;color:#0f172a;border:1px solid rgba(15,23,42,.08)}
      .omPwaBtn.ghost{background:#f8fafc;color:#475569;border:1px solid rgba(15,23,42,.06)}
      .omPwaToast{
        position:fixed;left:50%;bottom:20px;transform:translateX(-50%) translateY(20px);opacity:0;pointer-events:none;
        z-index:10000;background:#0f172a;color:#fff;padding:12px 14px;border-radius:14px;box-shadow:0 12px 28px rgba(0,0,0,.28);
        transition:.22s ease;font-size:14px;max-width:min(92vw,520px);text-align:center
      }
      .omPwaToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      @media (max-width:720px){
        .omPwaTopCard{grid-template-columns:1fr;gap:10px;padding:12px}
        .omPwaIcon{display:none}
        .omPwaActs{justify-content:stretch}
        .omPwaActs .omPwaBtn{flex:1 1 auto}
      }
    `;
    document.head.appendChild(style);
  }

  function toast(msg) {
    let el = document.getElementById('om-pwa-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'om-pwa-toast';
      el.className = 'omPwaToast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function canShowBanner() {
    const p = currentUrl.pathname;
    return !isStandalone && !state.dismissed && !/\/admin\//.test(p) && !/\/install(\.html)?$/.test(p);
  }

  function installSupported() { return !!state.deferredPrompt; }

  function buildTopbar() {
    if (document.getElementById('om-pwa-top')) return;
    addStyles();
    const wrap = document.createElement('div');
    wrap.className = 'omPwaTop';
    wrap.id = 'om-pwa-top';
    wrap.innerHTML = `
      <div class="omPwaTopCard">
        <div class="omPwaIcon"><img src="/pwa-192.png" alt="OrzuMall"></div>
        <div class="omPwaText">
          <b>OrzuMall ilovasini o‘rnating</b>
          <span id="omPwaDesc">Telefoningizga tez ochiladigan ilova sifatida qo‘shiladi.</span>
        </div>
        <div class="omPwaActs">
          <button type="button" class="omPwaBtn secondary" id="omPwaBrowserTop">🌐 Browserda ochish</button>
          <button type="button" class="omPwaBtn primary" id="omPwaInstallTop">📲 O‘rnatish</button>
          <button type="button" class="omPwaBtn ghost" id="omPwaCloseTop">✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    document.getElementById('omPwaBrowserTop')?.addEventListener('click', openInBrowser);
    document.getElementById('omPwaInstallTop')?.addEventListener('click', async () => {
      const ok = await triggerInstall();
      if (!ok) {
        if (isTelegram) toast("Avval Browserda ochish tugmasini bosing, keyin o‘sha yerda yana O‘rnatish ni bosing.");
        else toast("Brauzer menyusidan Add to Home Screen ham ishlaydi.");
      }
    });
    document.getElementById('omPwaCloseTop')?.addEventListener('click', () => {
      sessionStorage.setItem('om_pwa_hide', '1');
      state.dismissed = true;
      hideTopbar();
    });
    updateButtons();
  }

  function showTopbar() {
    if (!canShowBanner()) return;
    buildTopbar();
    document.getElementById('om-pwa-top')?.classList.add('show');
    state.topbarShown = true;
  }

  function hideTopbar() {
    document.getElementById('om-pwa-top')?.classList.remove('show');
  }

  async function triggerInstall() {
    if (!state.deferredPrompt) return false;
    try {
      state.deferredPrompt.prompt();
      const choice = await state.deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') toast("O‘rnatilmoqda...");
      return !!choice && choice.outcome === 'accepted';
    } catch (_) {
      return false;
    } finally {
      state.deferredPrompt = null;
      updateButtons();
    }
  }

  function updateButtons() {
    const desc = document.getElementById('omPwaDesc');
    const installBtn = document.getElementById('omPwaInstallTop');
    const browserBtn = document.getElementById('omPwaBrowserTop');
    if (desc) {
      desc.textContent = installSupported()
        ? "Bir bosishda install oynasi chiqadi."
        : (isTelegram
            ? "Telegram ichida bo‘lsangiz avval Browserda oching, keyin o‘rnating."
            : "Install chiqmasa brauzer menyusidan Add to Home Screen ni tanlang.");
    }
    if (installBtn) installBtn.textContent = installSupported() ? "📲 O‘rnatish" : "📲 O‘rnatish";
    if (browserBtn) browserBtn.style.display = isTelegram ? "" : "none";
  }

  function openInBrowser() {
    const target = `${installEntry}?src=browser`;
    if (isAndroid) {
      const clean = target.replace(/^https?:\/\//, '');
      location.href = `intent://${clean}#Intent;scheme=https;package=com.android.chrome;end`;
      setTimeout(() => toast("Agar ochilmasa, linkni nusxalab Chrome’da qo‘ying."), 900);
      return;
    }
    try {
      window.open(target, '_blank', 'noopener,noreferrer');
      setTimeout(() => toast("Yangi brauzer oynasida install tugmasini bosing."), 300);
    } catch (_) {
      location.href = target;
    }
  }

  async function copyInstallLink() {
    try {
      await navigator.clipboard.writeText(installEntry);
      toast("Install link nusxalandi.");
      return true;
    } catch (_) {
      return false;
    }
  }

  window.OrzuMallPWA = { triggerInstall, openInBrowser, copyInstallLink, installSupported: () => installSupported() };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    updateButtons();
    if (canShowBanner()) setTimeout(showTopbar, 250);
  });

  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    hideTopbar();
    updateButtons();
    toast("Ilova o‘rnatildi.");
    if (/\/install(\.html)?$/.test(currentUrl.pathname)) {
      setTimeout(() => location.replace('/'), 700);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    cleanupLegacyCaches();
    buildTopbar();
    if (canShowBanner()) setTimeout(showTopbar, 700);
    updateButtons();

    const openBtns = ['openBrowserBtn'];
    openBtns.forEach(id => document.getElementById(id)?.addEventListener('click', openInBrowser));

    const installBtns = ['installNowBtn'];
    installBtns.forEach(id => document.getElementById(id)?.addEventListener('click', async () => {
      const ok = await triggerInstall();
      if (!ok) {
        if (isTelegram) toast("Avval Browserda ochish tugmasini bosing.");
        else toast("Install chiqmasa brauzer menyusidan Add to Home Screen ni tanlang.");
      }
    }));

    const copyBtns = ['copyLinkBtn'];
    copyBtns.forEach(id => document.getElementById(id)?.addEventListener('click', async () => {
      const ok = await copyInstallLink();
      if (!ok) toast(installEntry);
    }));

    const onInstallPage = /\/install(\.html)?$/.test(currentUrl.pathname);
    if (isStandalone && onInstallPage) {
      location.replace('/');
      return;
    }
    if (onInstallPage && isTelegram) {
      toast("Avval Browserda ochish, keyin O‘rnatish.");
    }
  });
})();

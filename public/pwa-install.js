(() => {
  const state = {
    deferredPrompt: null,
    dismissed: localStorage.getItem('om_pwa_banner_closed') === '1'
  };

  const ua = navigator.userAgent || "";
  const isTelegram = /Telegram|Tg\//i.test(ua) || document.referrer.includes('t.me');
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const currentPath = location.pathname;

  function canShowBanner() {
    return !isStandalone && !state.dismissed && !/\/install(\.html)?$/.test(currentPath);
  }

  function addStyles() {
    if (document.getElementById('om-pwa-mini-style')) return;
    const style = document.createElement('style');
    style.id = 'om-pwa-mini-style';
    style.textContent = `
      .omMiniWrap{
        position:fixed;top:10px;left:10px;right:10px;z-index:9999;display:none;
      }
      .omMiniWrap.show{display:block}
      .omMiniBar{
        max-width:760px;margin:0 auto;
        background:rgba(255,255,255,.92);
        backdrop-filter:blur(12px);
        border:1px solid rgba(15,23,42,.08);
        border-radius:16px;
        box-shadow:0 10px 28px rgba(15,23,42,.12);
        padding:8px 10px;
        display:flex;align-items:center;gap:10px;
      }
      .omMiniIcon{
        width:34px;height:34px;border-radius:10px;flex:0 0 auto;overflow:hidden;
        background:#eef8f2;
      }
      .omMiniIcon img{width:100%;height:100%;object-fit:cover}
      .omMiniText{min-width:0;flex:1}
      .omMiniTitle{
        font-size:13px;font-weight:800;color:#0f172a;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .omMiniSub{
        font-size:11px;color:#64748b;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }
      .omMiniBtns{display:flex;gap:6px;align-items:center;flex:0 0 auto}
      .omMiniBtn{
        appearance:none;border:0;border-radius:10px;padding:8px 10px;
        font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap
      }
      .omMiniBtn.primary{background:#2E8B57;color:#fff}
      .omMiniBtn.secondary{background:#fff;color:#0f172a;border:1px solid rgba(15,23,42,.08)}
      .omMiniBtn.close{background:#f8fafc;color:#475569;border:1px solid rgba(15,23,42,.06);padding:8px 8px}
      .omMiniToast{
        position:fixed;left:50%;bottom:18px;transform:translateX(-50%) translateY(12px);
        opacity:0;pointer-events:none;transition:.2s ease;z-index:10000;
        background:#0f172a;color:#fff;padding:10px 12px;border-radius:12px;
        box-shadow:0 10px 24px rgba(0,0,0,.25);font-size:13px;max-width:min(92vw,440px);text-align:center;
      }
      .omMiniToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      @media (max-width:640px){
        .omMiniWrap{top:8px;left:8px;right:8px}
        .omMiniBar{padding:8px}
        .omMiniSub{display:none}
        .omMiniIcon{display:none}
        .omMiniBtn{padding:8px 9px;font-size:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function toast(msg) {
    let el = document.getElementById('om-mini-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'om-mini-toast';
      el.className = 'omMiniToast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function buildBanner() {
    if (document.getElementById('om-mini-wrap')) return;
    addStyles();
    const wrap = document.createElement('div');
    wrap.className = 'omMiniWrap';
    wrap.id = 'om-mini-wrap';
    wrap.innerHTML = `
      <div class="omMiniBar">
        <div class="omMiniIcon"><img src="/pwa-192.png" alt="OrzuMall"></div>
        <div class="omMiniText">
          <div class="omMiniTitle">OrzuMall ilovasini o‘rnating</div>
          <div class="omMiniSub" id="omMiniSub">Tez ochiladi va oddiy app kabi ishlaydi.</div>
        </div>
        <div class="omMiniBtns">
          <button type="button" class="omMiniBtn secondary" id="omMiniBrowser" style="display:none">Browser</button>
          <button type="button" class="omMiniBtn primary" id="omMiniInstall">O‘rnatish</button>
          <button type="button" class="omMiniBtn close" id="omMiniClose">✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    document.getElementById('omMiniBrowser')?.addEventListener('click', openInBrowser);
    document.getElementById('omMiniInstall')?.addEventListener('click', async () => {
      const ok = await triggerInstall();
      if (!ok) {
        if (isTelegram) toast("Avval Browserda oching.");
        else toast("Brauzer menyusidan Add to Home Screen ni tanlang.");
      }
    });
    document.getElementById('omMiniClose')?.addEventListener('click', () => {
      localStorage.setItem('om_pwa_banner_closed', '1');
      state.dismissed = true;
      hideBanner();
    });
    updateBanner();
  }

  function showBanner() {
    if (!canShowBanner()) return;
    buildBanner();
    document.getElementById('om-mini-wrap')?.classList.add('show');
  }

  function hideBanner() {
    document.getElementById('om-mini-wrap')?.classList.remove('show');
  }

  function updateBanner() {
    const sub = document.getElementById('omMiniSub');
    const browser = document.getElementById('omMiniBrowser');
    if (sub) {
      sub.textContent = state.deferredPrompt
        ? "Bir bosishda install oynasi chiqadi."
        : (isTelegram ? "Telegram ichida bo‘lsangiz avval browserda oching." : "Add to Home Screen ham ishlaydi.");
    }
    if (browser) browser.style.display = isTelegram ? "" : "none";
  }

  async function triggerInstall() {
    if (!state.deferredPrompt) return false;
    try {
      state.deferredPrompt.prompt();
      const choice = await state.deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        hideBanner();
        toast("O‘rnatilmoqda...");
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      state.deferredPrompt = null;
      updateBanner();
    }
  }

  function openInBrowser() {
    const target = `${location.origin}/install`;
    if (/Android/i.test(ua)) {
      const clean = target.replace(/^https?:\/\//, '');
      location.href = `intent://${clean}#Intent;scheme=https;package=com.android.chrome;end`;
      setTimeout(() => toast("Agar ochilmasa, linkni Chrome’da oching."), 900);
      return;
    }
    try {
      window.open(target, '_blank', 'noopener,noreferrer');
    } catch {
      location.href = target;
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    updateBanner();
    if (canShowBanner()) setTimeout(showBanner, 200);
  });

  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    hideBanner();
    toast("Ilova o‘rnatildi.");
    updateBanner();
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (isStandalone) {
      hideBanner();
      return;
    }
    buildBanner();
    updateBanner();
    if (canShowBanner()) setTimeout(showBanner, 700);
  });

  window.OrzuMallPWAMini = { showBanner, hideBanner, triggerInstall };
})();

(() => {
  const state = { deferredPrompt: null, shown: false, progressRunning: false };
  const ua = navigator.userAgent || "";
  const isTelegram = /Telegram|Tg\//i.test(ua) || document.referrer.includes('t.me');
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isAndroid = /Android/i.test(ua);
  const currentUrl = new URL(location.href);
  const chromeIntentUrl = (() => {
    const path = currentUrl.pathname.replace(/^\//, '') || '';
    const query = currentUrl.search || '';
    const hash = currentUrl.hash || '';
    return `intent://${location.host}/${path}${query}${hash}#Intent;scheme=https;package=com.android.chrome;end`;
  })();

  function qs(id){ return document.getElementById(id); }

  function cleanupLegacyCaches(){
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

  function paintProgress(percent, label){
    const bar = qs('installBar');
    const pct = qs('installPercent');
    const text = qs('installStatusText');
    const pill = qs('installStatusPill');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (pct) pct.textContent = `${Math.round(percent)}%`;
    if (text && label) text.textContent = label;
    if (pill && label) pill.textContent = label;
  }

  function markStep(id, cls){
    const el = qs(id);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (cls) el.classList.add(cls);
  }

  function resetProgress(){
    state.progressRunning = false;
    paintProgress(0, 'Tayyor');
    markStep('stepDownload', '');
    markStep('stepInstall', '');
    markStep('stepDone', '');
  }

  async function runProgress(){
    if (state.progressRunning) return;
    state.progressRunning = true;
    markStep('stepDownload', 'active');
    paintProgress(12, 'Yuklanmoqda');
    await wait(260);
    paintProgress(28, 'Yuklanmoqda');
    await wait(320);
    paintProgress(46, 'Yuklanmoqda');
    await wait(280);
    markStep('stepDownload', 'done');
    markStep('stepInstall', 'active');
    paintProgress(64, 'O‘rnatilmoqda');
    await wait(350);
    paintProgress(82, state.deferredPrompt ? 'O‘rnatilmoqda' : (isTelegram ? 'Brauzer orqali davom eting' : 'Menyu orqali qo‘shing'));
  }

  function finishProgress(installed){
    markStep('stepInstall', installed ? 'done' : '');
    markStep('stepDone', installed ? 'done' : '');
    paintProgress(installed ? 100 : 82, installed ? 'Tayyor' : 'Brauzer orqali davom eting');
    if (!installed) state.progressRunning = false;
  }

  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  function buildModal(){
    if (document.getElementById('om-pwa-modal')) return;
    const style = document.createElement('style');
    style.textContent = `.omPwaBackdrop{position:fixed;inset:0;background:rgba(2,6,23,.48);backdrop-filter:blur(8px);z-index:9998;display:none;align-items:flex-end;justify-content:center;padding:14px}.omPwaBackdrop.show{display:flex}.omPwaCard{width:min(100%,470px);background:rgba(255,255,255,.96);border:1px solid rgba(255,255,255,.68);border-radius:28px;box-shadow:0 28px 80px rgba(15,23,42,.24);overflow:hidden;color:#0f172a;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}.omPwaHead{padding:18px 18px 12px;display:flex;gap:14px;align-items:center}.omPwaIcon{width:58px;height:58px;border-radius:18px;background:#e9f6ee;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto}.omPwaIcon img{width:100%;height:100%;object-fit:cover}.omPwaHead h3{margin:0 0 4px;font-size:20px;line-height:1.1}.omPwaHead p{margin:0;color:#64748b;font-size:13px;line-height:1.45}.omPwaClose{margin-left:auto;border:0;background:#f1f5f9;width:36px;height:36px;border-radius:999px;font-size:18px;cursor:pointer}.omPwaBody{padding:0 18px 16px}.omPwaBadges{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px}.omPwaBadge{padding:8px 10px;border-radius:999px;background:#eef8f2;color:#1f6e44;font-size:12px;font-weight:800;border:1px solid rgba(46,139,87,.12)}.omPwaInfo{background:#f8fafc;border:1px solid rgba(15,23,42,.06);border-radius:18px;padding:14px 14px 10px}.omPwaInfo b{display:block;margin-bottom:8px}.omPwaInfo ul{margin:0;padding-left:18px;color:#475569;font-size:13px;line-height:1.55}.omPwaActions{display:grid;gap:10px;margin-top:14px}.omPwaBtn{appearance:none;border:0;border-radius:18px;padding:14px 16px;font-weight:800;font-size:15px;cursor:pointer}.omPwaBtn.primary{background:linear-gradient(180deg,#2E8B57,#246c46);color:#fff;box-shadow:0 16px 34px rgba(46,139,87,.26)}.omPwaBtn.secondary{background:#fff;color:#0f172a;border:1px solid rgba(15,23,42,.08)}.omPwaSub{font-size:12px;color:#64748b;text-align:center;margin-top:4px}`;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.className = 'omPwaBackdrop'; wrap.id = 'om-pwa-modal';
    wrap.innerHTML = `<div class="omPwaCard" role="dialog" aria-modal="true" aria-labelledby="omPwaTitle"><div class="omPwaHead"><div class="omPwaIcon"><img src="/pwa-192.png" alt="OrzuMall"></div><div><h3 id="omPwaTitle">OrzuMall ilovasini o‘rnating</h3><p>Play Marketga o‘xshash jarayon va tezkor PWA o‘rnatish.</p></div><button type="button" class="omPwaClose" id="omPwaCloseBtn" aria-label="Yopish">×</button></div><div class="omPwaBody"><div class="omPwaBadges"><span class="omPwaBadge">Cache ushlanmaydi</span><span class="omPwaBadge">Service worker yo‘q</span><span class="omPwaBadge">Yangilanish tez</span></div><div class="omPwaInfo"><b>Qanday o‘rnatiladi?</b><ul><li>“O‘rnatish” tugmasini bosing.</li><li>Sahifadagi yuklanmoqda va o‘rnatilmoqda holatlari ko‘rinadi.</li><li>Agar Telegram ichida install chiqmasa, Chrome’da oching.</li></ul></div><div class="omPwaActions"><button type="button" class="omPwaBtn primary" id="omPwaInstallBtn">O‘rnatish</button><button type="button" class="omPwaBtn secondary" id="omPwaBrowserBtn">Chrome’da ochish</button></div><div class="omPwaSub" id="omPwaSub"></div></div></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) closeModal(); });
    document.getElementById('omPwaCloseBtn')?.addEventListener('click', closeModal);
    document.getElementById('omPwaInstallBtn')?.addEventListener('click', () => triggerInstall());
    document.getElementById('omPwaBrowserBtn')?.addEventListener('click', openInBrowser);
    updateButtons();
  }

  function installSupported(){ return !!state.deferredPrompt; }

  async function triggerInstall(){
    await runProgress();
    if (!state.deferredPrompt) {
      finishProgress(false);
      showModal();
      return false;
    }
    try {
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice;
    } catch (_) {
      finishProgress(false);
      return false;
    } finally {
      state.deferredPrompt = null;
      updateButtons();
      closeModal();
    }
    return true;
  }

  function updateButtons(){
    const installBtn = document.getElementById('omPwaInstallBtn');
    const browserBtn = document.getElementById('omPwaBrowserBtn');
    const sub = document.getElementById('omPwaSub');
    const pageInstall = document.getElementById('installNowBtn');
    const pageChrome = document.getElementById('openChromeBtn');
    const text = installSupported() ? 'Bir bosishda qurilma install oynasi chiqadi.' : (isTelegram ? 'Telegram ichida chiqmasa, Chrome’da oching.' : 'Brauzer menyusidan “Add to Home Screen” orqali qo‘shing.');
    if (sub) sub.textContent = text;
    if (installBtn) installBtn.textContent = installSupported() ? 'O‘rnatish' : 'Yo‘riqnoma';
    if (browserBtn) browserBtn.style.display = (isTelegram || !installSupported()) ? '' : 'none';
    if (pageInstall) { pageInstall.textContent = installSupported() ? 'O‘rnatish' : 'Yo‘riqnoma'; pageInstall.onclick = () => triggerInstall(); }
    if (pageChrome) { pageChrome.onclick = (e) => { e.preventDefault(); openInBrowser(); }; pageChrome.style.display = (isTelegram || !installSupported()) ? '' : 'none'; }
  }

  function showModal(){ buildModal(); document.getElementById('om-pwa-modal')?.classList.add('show'); state.shown = true; }
  function closeModal(){ document.getElementById('om-pwa-modal')?.classList.remove('show'); }
  function openInBrowser(){ if (isAndroid) location.href = chromeIntentUrl; else window.open(location.href, '_blank', 'noopener'); }

  window.OrzuMallPWA = { triggerInstall, showModal, openInBrowser, isTelegram };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    updateButtons();
    if (isTelegram || currentUrl.pathname.endsWith('/install.html') || currentUrl.searchParams.get('install') === '1') setTimeout(showModal, 280);
  });

  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    closeModal();
    updateButtons();
    finishProgress(true);
    if (currentUrl.pathname.endsWith('/install.html') || currentUrl.pathname === '/install') {
      setTimeout(() => location.replace('/'), 700);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    cleanupLegacyCaches();
    buildModal();
    const onInstallPage = currentUrl.pathname.endsWith('/install.html') || currentUrl.pathname === '/install';
    if (isStandalone && onInstallPage) {
      location.replace('/');
      return;
    }
    resetProgress();
    if (!isStandalone && (isTelegram || onInstallPage || currentUrl.searchParams.get('install') === '1')) setTimeout(showModal, 550);
    updateButtons();
  });
})();
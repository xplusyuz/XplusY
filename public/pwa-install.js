(function(){
  const ua = navigator.userAgent || '';
  const path = location.pathname;
  const isTelegram = /Telegram|Tg\//i.test(ua) || document.referrer.includes('t.me');
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const state = { deferredPrompt: null, installing: false };

  function $(id){ return document.getElementById(id); }
  function onInstallPage(){ return path.endsWith('/install.html') || path === '/install'; }

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

  function setStatus(mode, title, text){
    const dot = $('installDot');
    const titleEl = $('installStatusTitle');
    const textEl = $('installStatusText');
    if (dot){
      dot.classList.remove('run','done');
      if (mode === 'run') dot.classList.add('run');
      if (mode === 'done') dot.classList.add('done');
    }
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
  }

  function recommendedBrowserName(){
    if (isIOS) return 'Safari';
    if (isAndroid) return 'Chrome yoki Edge';
    return 'asosiy brauzer';
  }

  function fallbackInstruction(){
    if (isIOS) return 'Safari’da Share → “Add to Home Screen” ni bosing.';
    if (isTelegram) return `${recommendedBrowserName()} da ochib, keyin o‘rnatishni davom ettiring.`;
    return 'Brauzer menyusidan “Install app” yoki “Add to Home Screen” ni tanlang.';
  }

  function updateText(){
    const fallback = $('fallbackText');
    const installBtn = $('installNowBtn');
    const browserBtn = $('openBrowserBtn');
    if (fallback) fallback.textContent = fallbackInstruction();

    if (isStandalone && onInstallPage()) {
      location.replace('/');
      return;
    }

    if (state.deferredPrompt) {
      setStatus('', 'Tayyor', 'Qurilmangiz o‘rnatishni qo‘llab-quvvatlaydi. Tugmani bossangiz install oynasi chiqadi.');
      if (installBtn) installBtn.textContent = 'Hozir o‘rnatish';
    } else {
      setStatus('', 'Yo‘riqnoma tayyor', fallbackInstruction());
      if (installBtn) installBtn.textContent = isIOS ? 'Safari yo‘riqnomasi' : 'O‘rnatish yo‘riqnomasi';
    }

    if (browserBtn) {
      browserBtn.style.display = (isTelegram || !state.deferredPrompt) ? '' : 'none';
    }
  }

  function openInBrowser(){
    const current = new URL(location.href);
    const cleanPath = current.pathname.replace(/^\//, '') || '';
    const target = `intent://${location.host}/${cleanPath}${current.search}${current.hash}#Intent;scheme=https;package=com.android.chrome;end`;
    if (isAndroid && isTelegram) {
      location.href = target;
      return;
    }
    window.open(location.href, '_blank', 'noopener');
  }

  function showInstructions(){
    alert(fallbackInstruction());
  }

  async function triggerInstall(){
    if (state.installing) return;
    if (!state.deferredPrompt) {
      showInstructions();
      return;
    }

    state.installing = true;
    setStatus('run', 'Yuklanmoqda', 'O‘rnatish oynasi tayyorlanmoqda...');

    try {
      await new Promise(r => setTimeout(r, 300));
      setStatus('run', 'O‘rnatilmoqda', 'Qurilma oynasida tasdiqlang.');
      state.deferredPrompt.prompt();
      const choice = await state.deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setStatus('done', 'Tayyor', 'Ilova o‘rnatildi. Bosh sahifaga o‘tilmoqda...');
      } else {
        setStatus('', 'Bekor qilindi', fallbackInstruction());
      }
    } catch (_) {
      setStatus('', 'Muammo chiqdi', fallbackInstruction());
    } finally {
      state.deferredPrompt = null;
      state.installing = false;
      updateText();
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    updateText();
  });

  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    setStatus('done', 'Tayyor', 'Ilova o‘rnatildi. Bosh sahifaga o‘tilmoqda...');
    setTimeout(() => {
      if (onInstallPage()) location.replace('/');
    }, 700);
  });

  document.addEventListener('DOMContentLoaded', () => {
    cleanupLegacyCaches();
    if ($('installNowBtn')) $('installNowBtn').addEventListener('click', triggerInstall);
    if ($('openBrowserBtn')) $('openBrowserBtn').addEventListener('click', openInBrowser);
    updateText();
    if (!state.deferredPrompt && isTelegram) {
      setStatus('', 'Tashqi brauzer tavsiya etiladi', `${recommendedBrowserName()} da ochsangiz install yaxshiroq ishlaydi.`);
    }
  });
})();

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
  function currentInstallUrl(){ return location.origin + '/install.html'; }
  function chromeIntentUrl(){
    const current = new URL(currentInstallUrl());
    return `intent://${current.host}${current.pathname}${current.search}${current.hash}#Intent;scheme=https;package=com.android.chrome;end`;
  }

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
    if (isAndroid) return 'Chrome';
    return 'asosiy brauzer';
  }

  function fallbackInstruction(){
    if (isIOS) return 'Safari’da Share → “Add to Home Screen” ni bosing.';
    if (isTelegram && isAndroid) return '“Brauzerda ochish” tugmasi Chrome’ni ochishga urinadi. Ishlamasa linkni nusxa olib Chrome’da oching.';
    if (isTelegram) return `${recommendedBrowserName()} da ochib, keyin o‘rnatishni davom ettiring.`;
    return 'Brauzer menyusidan “Install app” yoki “Add to Home Screen” ni tanlang.';
  }

  function updateBrowserButton(){
    const btn = $('openBrowserBtn');
    const text = $('installLinkText');
    const url = currentInstallUrl();
    if (text) text.textContent = url;
    if (!btn) return;

    btn.setAttribute('href', url);
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener');
    btn.textContent = isTelegram && isAndroid ? 'Chrome’da ochish' : (isIOS ? 'Safari’da ochish' : 'Brauzerda ochish');

    if (isTelegram && isAndroid) {
      btn.setAttribute('href', chromeIntentUrl());
      btn.removeAttribute('target');
    }
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

  async function copyLink(){
    const url = currentInstallUrl();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch(_) {}
    return false;
  }

  async function openInBrowser(ev){
    const url = currentInstallUrl();
    if (isTelegram && isAndroid) {
      // let the anchor navigate to intent://chrome
      setTimeout(async () => {
        const ok = await copyLink();
        if (document.visibilityState === 'visible') {
          setStatus('', 'Chrome ochilmadi', ok ? 'Link nusxalandi. Chrome’ga kirib paste qiling.' : 'Linkni bosib ushlab nusxa oling va Chrome’da oching.');
        }
      }, 1200);
      return;
    }

    if (isIOS) {
      setStatus('', 'Safari tavsiya etiladi', 'Pastdagi linkni Safari’da ochib, keyin Share → Add to Home Screen ni bosing.');
      return;
    }

    try {
      window.open(url, '_blank', 'noopener');
      setTimeout(async () => {
        if (document.visibilityState === 'visible') {
          const ok = await copyLink();
          setStatus('', 'Yangi oynada oching', ok ? 'Link nusxalandi. Asosiy brauzeringizga o‘tib paste qiling.' : 'Linkni qo‘lda nusxa olib brauzerga qo‘ying.');
        }
      }, 900);
    } catch (_) {
      const ok = await copyLink();
      setStatus('', 'Qo‘lda oching', ok ? 'Link nusxalandi. Chrome yoki Safari’da paste qiling.' : 'Linkni nusxa olib brauzerga qo‘ying.');
    }
    if (ev) ev.preventDefault();
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
    updateBrowserButton();
    if ($('installNowBtn')) $('installNowBtn').addEventListener('click', triggerInstall);
    if ($('openBrowserBtn')) $('openBrowserBtn').addEventListener('click', openInBrowser);
    updateText();
    if (!state.deferredPrompt && isTelegram) {
      setStatus('', 'Tashqi brauzer tavsiya etiladi', `${recommendedBrowserName()} da ochsangiz install yaxshiroq ishlaydi.`);
    }
  });
})();

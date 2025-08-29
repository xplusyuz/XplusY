// /assets/js/include.js
function resolve(relPath) {
  // sahifa qayerda bo‘lsa ham, shu joydan nisbiy bog‘laymiz
  const base = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
  return new URL(relPath, window.location.origin + base).toString();
}

export async function attachHeaderFooter() {
  const headerHost = document.getElementById('km-header');
  if (headerHost) {
    try {
      const res = await fetch(resolve('partials/header.html'), { cache: 'no-store' });
      if (!res.ok) throw new Error('header not ok');
      headerHost.innerHTML = await res.text();
    } catch (e) {
      console.error('Header fetch xato:', e);
      headerHost.innerHTML = '<div class="card">Header yuklanmadi. Yo‘lni tekshiring: partials/header.html</div>';
    }
  }

  const footerHost = document.getElementById('km-footer');
  if (footerHost) {
    try {
      const res = await fetch(resolve('partials/footer.html'), { cache: 'no-store' });
      if (!res.ok) throw new Error('footer not ok');
      footerHost.innerHTML = await res.text();
    } catch (e) {
      console.error('Footer fetch xato:', e);
      footerHost.innerHTML = '<div class="card">Footer yuklanmadi. Yo‘lni tekshiring: partials/footer.html</div>';
    }
  }
}

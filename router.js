
// js/router.js — Minimal SPA router that keeps header/footer fixed.
// Swaps only <main> content (prefers <main.container>) via fetch + History API.
(() => {
  const MAIN_CANDIDATES = ['main.container', 'main', '#page', '#app', '#content'];

  function pickMain(doc){
    for(const sel of MAIN_CANDIDATES){
      const el = doc.querySelector(sel);
      if(el) return el;
    }
    return null;
  }

  function highlightNav(pathname){
    document.querySelectorAll('.desktop-nav a, header a').forEach(a=>{
      const href = a.getAttribute('href');
      if(!href) return;
      const same = new URL(a.href, location.href).pathname === pathname;
      a.classList.toggle('active', same);
      if(same) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });
  }

  function isSPAEligible(a){
    if(!a) return false;
    if(a.target === '_blank' || a.hasAttribute('download')) return false;
    const u = new URL(a.href, location.href);
    if(u.origin !== location.origin) return false;
    if(u.hash && (u.pathname === location.pathname)) return false; // same-page anchors
    // Only intercept .html files (internal pages)
    return u.pathname.endsWith('.html');
  }

  async function fetchDoc(url){
    const res = await fetch(url, { credentials: 'same-origin' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text = await res.text();
    const parser = new DOMParser();
    return parser.parseFromString(text, 'text/html');
  }

  
  function collectPageScripts(container){
    const out = [];
    if(!container) return out;
    container.querySelectorAll('script[type="module"]').forEach(s=>{
      const src = s.getAttribute('src');
      if(src){
        const normalized = src.replace(location.origin,'');
        if(/common\.js(\?|$)/.test(normalized)) return;
        if(/router\.js(\?|$)/.test(normalized)) return;
        out.push({ kind:'external', src });
      }else{
        const code = (s.textContent || '').trim();
        if(!code) return;
        if(/from\s+['"]\.\/js\/common\.js['"]/.test(code)) return;
        if(/import\(['"]\.\/js\/common\.js['"]\)/.test(code)) return;
        if(/\battachAuthUI\s*\(/.test(code)) return;
        if(/\binitUX\s*\(/.test(code)) return;
        out.push({ kind:'inline', code });
      }
    });
    return out;
  }


  function removeOldPageScripts(){
    document.querySelectorAll('script[data-spa]').forEach(s=> s.remove());
  }

  function runPageScripts(list){
    removeOldPageScripts();
    const stamp = Date.now();
    list.forEach(item=>{
      const el = document.createElement('script');
      el.type = 'module';
      el.setAttribute('data-spa','');
      if(item.kind === 'external'){
        el.src = item.src + (item.src.includes('?') ? '&' : '?') + 'spa=' + stamp;
      }else{
        el.textContent = item.code;
      }
      document.body.appendChild(el);
    });
  }

  async function load(url, push=true){
    try{
      const doc = await fetchDoc(url);
      const newMain = pickMain(doc);
      const curMain = pickMain(document);
      if(!newMain || !curMain) { location.href = url; return; }

      // Replace main content
      curMain.replaceWith(newMain);

      // Update title
      const newTitle = doc.querySelector('title');
      if(newTitle) document.title = newTitle.textContent;

      // Run page-level scripts
      const scripts = collectPageScripts(newMain);
      runPageScripts(scripts);

      // Mark active nav + scroll top
      const pathname = new URL(url, location.href).pathname;
      highlightNav(pathname);
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch {}

      // Fire custom event for analytics/hooks
      document.dispatchEvent(new CustomEvent('spa:navigated', { detail: { url: pathname }}));

      if(push) history.pushState({ spa:true }, '', url);
    }catch(err){
      // Fallback to hard navigation
      console.warn('[SPA Router] Fallback navigation due to error:', err);
      location.href = url;
    }
  }

  function onClick(e){
    // Respect modifier keys (open in new tab/window)
    if(e.defaultPrevented) return;
    if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a');
    if(!isSPAEligible(a)) return;
    e.preventDefault();
    load(a.href, true);
  }

  function onPopState(){
    // Back/forward: sync to current URL
    load(location.href, false);
  }

  function init(){
    // Delegate link clicks globally
    document.addEventListener('click', onClick);
    // Handle back/forward
    window.addEventListener('popstate', onPopState);
    // Initial highlight
    highlightNav(location.pathname);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

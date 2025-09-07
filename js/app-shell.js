
// js/app-shell.js — Injects shared header/footer components into the page once.
(() => {
  async function injectIncludes(){
    const targets = Array.from(document.querySelectorAll('[data-include]'));
    await Promise.all(targets.map(async el => {
      const url = el.getAttribute('data-include');
      if(!url) return;
      try{
        const res = await fetch(url, { credentials: 'same-origin' });
        const html = await res.text();
        // Extract inner of the same tag to avoid nesting
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const sameTag = doc.body.firstElementChild;
        el.innerHTML = sameTag ? sameTag.innerHTML : html;
      }catch(e){
        console.warn('Include failed for', url, e);
      }
    }));
    document.dispatchEvent(new CustomEvent('appshell:ready'));
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectIncludes);
  } else {
    injectIncludes();
  }
})();

/* Minimal event de-dup patch (non-destructive) */
(() => {
  const origAdd = window.addEventListener;
  const seen = new WeakMap();
  window.addEventListener = function(type, listener, options){
    if (type === 'hashchange' || type === 'DOMContentLoaded') {
      let map = seen.get(this);
      if (!map) { map = new Map(); seen.set(this, map); }
      if (!map.has(type)) map.set(type, new Set());
      const set = map.get(type);
      if (set.has(listener)) return; // ignore duplicate same listener
      set.add(listener);
    }
    return origAdd.call(this, type, listener, options);
  };
})();

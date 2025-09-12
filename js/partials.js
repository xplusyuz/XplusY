export async function loadPartials() {
  const slots = Array.from(document.querySelectorAll('[data-include]'));
  await Promise.all(slots.map(async (slot) => {
    const url = slot.getAttribute('data-include');
    try{
      const res = await fetch(url, { cache: 'no-cache' });
      if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
      const html = await res.text();
      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();
      const node = tmp.firstElementChild || document.createTextNode('');
      slot.replaceWith(node);
    } catch(e){
      console.warn('Partial load failed:', url, e);
      const fallback = document.createElement('div');
      fallback.innerHTML = `<div class="card" style="margin:8px 0"><div class="sub">Partial topilmadi: ${url}</div></div>`;
      slot.replaceWith(fallback);
    }
  }));
}
export default loadPartials;

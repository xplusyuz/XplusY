
function resolve(relPath){
  const base = location.pathname.endsWith('/') ? location.pathname
    : location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
  return new URL(relPath, location.origin + base).toString();
}
export async function attachHeaderFooter(){
  const h = document.getElementById('km-header');
  if (h){ try{ const r=await fetch(resolve('partials/header.html'),{cache:'no-store'}); h.innerHTML=await r.text(); }catch(e){ console.error(e);} }
  const f = document.getElementById('km-footer');
  if (f){ try{ const r=await fetch(resolve('partials/footer.html'),{cache:'no-store'}); f.innerHTML=await r.text(); }catch(e){ console.error(e);} }
}
export { resolve };

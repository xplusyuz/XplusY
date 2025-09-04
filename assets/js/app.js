
const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
function absUrl(p){
  const baseEl = document.querySelector('base');
  const baseHref = baseEl ? baseEl.getAttribute('href') : '/';
  try{ return new URL(p, baseHref).href }catch{ return p }
}
async function loadFragment(el,url, fallback){
  try{
    const res=await fetch(absUrl(url), {cache:'no-store'});
    if(!res.ok) throw new Error(res.status+' '+res.statusText);
    el.innerHTML=await res.text();
  }catch(e){
    console.warn('Fragment yuklanmadi:', url, e);
    if(fallback) el.innerHTML=fallback;
  }
}
function initMenu(){
  const drawer=$('.drawer'); const backdrop=$('.drawer .backdrop');
  const openBtn=$('#menuOpenBtn'); const closeBtn=$('#menuCloseBtn');
  openBtn?.addEventListener('click', ()=>drawer?.classList.add('open'));
  closeBtn?.addEventListener('click', ()=>drawer?.classList.remove('open'));
  backdrop?.addEventListener('click', ()=>drawer?.classList.remove('open'));
  const here = location.pathname.replace(/\index\.html$/,'/');
  $$('.menu a').forEach(a=>{ const href=a.getAttribute('href'); if(!href) return; if(href===here || (href!=='/' && here.includes(href))) a.classList.add('active'); });
}
document.addEventListener('DOMContentLoaded', async ()=>{
  const headerFallback = `<div class='container' style='padding:10px'><div class='brand'><span class="mark"></span> ExamHouse.uz</div></div>`;
  const footerFallback = `<footer class='footer'><div class='container'><div class='brand'><span class="mark"></span> ExamHouse.uz</div></div></footer>`;
  await loadFragment($('#header-slot'), 'components/header.html', headerFallback);
  await loadFragment($('#menu-slot'), 'components/menu.html', '');
  await loadFragment($('#footer-slot'), 'components/footer.html', footerFallback);
  initMenu();
});

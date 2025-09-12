window.$ = (sel, root=document)=>root.querySelector(sel);
window.$$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));
window.toast = (msg)=>{ const el = $("#toast"); if(!el) return; el.textContent = msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"), 2000); };
window.qs = (k)=> new URL(location.href).searchParams.get(k);
window.formatMoney = (n)=> new Intl.NumberFormat('uz-UZ').format(n||0);
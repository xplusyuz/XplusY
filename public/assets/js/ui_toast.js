export function toast(message, type="info"){
  const el = document.getElementById("toast");
  if(!el){
    try{ alert(message); }catch(_){ }
    return;
  }
  el.textContent = String(message||"");
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.classList.remove("show"), 2400);
}

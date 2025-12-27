export function $(sel, root=document){ return root.querySelector(sel); }
export function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

let toastTimer = null;
export function toast(msg){
  const el = document.getElementById('toast');
  if(!el) { alert(msg); return; }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove('show'), 2400);
}

export function fmtUZDateTime(d=new Date()){
  const days = ["Yakshanba","Dushanba","Seshanba","Chorshanba","Payshanba","Juma","Shanba"];
  const months = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  const day = days[d.getDay()];
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return `${day}, ${dd} ${mm} ${yyyy} • ${hh}:${mi}`;
}

export function setText(id, v){
  const el = document.getElementById(id);
  if(el) el.textContent = v;
}

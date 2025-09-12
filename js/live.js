import { auth } from "./app.js";
let target = Date.now() + 3600*1000;
function tick(){
  const el = document.getElementById("cd");
  const left = Math.max(0, Math.floor((target-Date.now())/1000));
  const h = Math.floor(left/3600).toString().padStart(2,"0");
  const m = Math.floor((left%3600)/60).toString().padStart(2,"0");
  const s = (left%60).toString().padStart(2,"0");
  el.textContent = `${h}:${m}:${s}`;
}
setInterval(tick, 1000); tick();
document.addEventListener("DOMContentLoaded", ()=>{
  $("#btnJoin").addEventListener("click", ()=>{
    if (!auth.currentUser) { alert("Kirish talab qilinadi"); return; }
    toast("Pre-join qabul qilindi");
  });
  $("#btnStart").addEventListener("click", ()=>{ toast("Boshlash faqat admin (demo)"); });
});
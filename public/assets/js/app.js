
(function(){
  function $(id){ return document.getElementById(id); }

  function fmtDate(){
    const d = new Date();
    const days = ["yakshanba","dushanba","seshanba","chorshanba","payshanba","juma","shanba"];
    const months = ["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentabr","oktabr","noyabr","dekabr"];
    return `${days[d.getDay()]}, ${d.getDate()}-${months[d.getMonth()]} ${d.getFullYear()} • ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    const page = document.body?.dataset?.page;
    if(page !== "app") return;

    const sess = window.LeaderAuth?.requireAuth();
    if(!sess) return;

    $("headerDate") && ($("headerDate").textContent = fmtDate());
    $("chipId") && ($("chipId").textContent = sess.id);

    // Logout
    $("btnLogout")?.addEventListener("click", ()=> window.LeaderAuth.logout());
    $("btnBell")?.addEventListener("click", ()=> alert("Bildirishnoma: hozircha yo‘q"));
  });
})();

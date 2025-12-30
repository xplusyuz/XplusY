
/**
 * LeaderMath Starter Auth (Local-first)
 * - "Men yangiman" => creates new ID + password, stores in localStorage
 * - "Kirish" => validates and creates session
 * - Future: you can swap the storage or add API calls in the marked section
 */
(function(){
  const LS_USERS = "lm_users_v1";
  const LS_SESSION = "lm_session_v1";

  function nowISO(){ return new Date().toISOString(); }
  function randDigits(n){
    let s=""; for(let i=0;i<n;i++) s += Math.floor(Math.random()*10);
    return s;
  }
  function randPass(){
    // readable password: 2 letters + 4 digits
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const a = letters[Math.floor(Math.random()*letters.length)];
    const b = letters[Math.floor(Math.random()*letters.length)];
    return a + b + "-" + randDigits(4);
  }
  function loadUsers(){
    try{ return JSON.parse(localStorage.getItem(LS_USERS) || "[]"); }catch(e){ return []; }
  }
  function saveUsers(users){
    localStorage.setItem(LS_USERS, JSON.stringify(users));
  }
  function makeId(users){
    // LM-000001 style
    // ensure uniqueness
    for(let tries=0; tries<50; tries++){
      const num = randDigits(6);
      const id = "LM-" + num;
      if(!users.some(u => u.id === id)) return id;
    }
    // fallback sequential
    let max = 0;
    for(const u of users){
      const m = /^LM-(\d{6})$/.exec(u.id || "");
      if(m) max = Math.max(max, parseInt(m[1],10));
    }
    const next = String(max+1).padStart(6,"0");
    return "LM-" + next;
  }

  function setSession(user){
    const sess = { id:user.id, name:user.name || "", createdAt:user.createdAt, ts: nowISO() };
    localStorage.setItem(LS_SESSION, JSON.stringify(sess));
  }
  function getSession(){
    try{ return JSON.parse(localStorage.getItem(LS_SESSION) || "null"); }catch(e){ return null; }
  }
  function clearSession(){
    localStorage.removeItem(LS_SESSION);
  }

  // Toast
  function toast(msg){
    const el = document.getElementById("toast");
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.classList.remove("show"), 2600);
  }

  // Credentials modal
  function openCredsModal({id, password}){
    const modal = document.getElementById("credsModal");
    if(!modal) return;
    const idInp = document.getElementById("newId");
    const pwInp = document.getElementById("newPw");
    if(idInp) idInp.value = id;
    if(pwInp) pwInp.value = password;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeCredsModal(){
    const modal = document.getElementById("credsModal");
    if(!modal) return;
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }
  function copyText(val){
    try{
      navigator.clipboard.writeText(val);
      toast("Nusxa olindi!");
    }catch(e){
      // fallback
      const t = document.createElement("textarea");
      t.value = val; document.body.appendChild(t); t.select();
      document.execCommand("copy");
      t.remove();
      toast("Nusxa olindi!");
    }
  }

  // Public API for pages
  window.LeaderAuth = {
    getSession,
    clearSession,
    requireAuth(){
      const s = getSession();
      if(!s){ location.href = "index.html"; return null; }
      return s;
    },
    logout(){
      clearSession();
      location.href = "index.html";
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    // If on index page
    const isIndex = document.body && document.body.dataset && document.body.dataset.page === "login";
    if(!isIndex) return;

    const idInput = document.getElementById("loginId");
    const pwInput = document.getElementById("loginPw");

    const btnLogin = document.getElementById("btnLogin");
    const btnNew = document.getElementById("btnNew");

    const btnClose = document.getElementById("credsClose");
    const btnCopyId = document.getElementById("copyId");
    const btnCopyPw = document.getElementById("copyPw");
    const btnGoApp = document.getElementById("goApp");

    btnClose && btnClose.addEventListener("click", closeCredsModal);
    document.getElementById("credsBackdrop")?.addEventListener("click", closeCredsModal);
    btnCopyId && btnCopyId.addEventListener("click", ()=> copyText(document.getElementById("newId").value || ""));
    btnCopyPw && btnCopyPw.addEventListener("click", ()=> copyText(document.getElementById("newPw").value || ""));
    btnGoApp && btnGoApp.addEventListener("click", ()=> { closeCredsModal(); location.href="app.html"; });

    btnNew && btnNew.addEventListener("click", async () => {
      const users = loadUsers();
      const id = makeId(users);
      const password = randPass();
      const user = {
        id,
        password,
        name: "",
        createdAt: nowISO(),
        points: 0,
        balance: 0
      };

      // (Optional Future) API create user here; fallback to local
      users.push(user);
      saveUsers(users);
      setSession(user);

      openCredsModal({id, password});
      toast("ID + Parol yaratildi");
    });

    btnLogin && btnLogin.addEventListener("click", async () => {
      const id = (idInput?.value || "").trim().toUpperCase();
      const password = (pwInput?.value || "").trim();
      if(!id || !password){ toast("ID va Parolni kiriting"); return; }

      const users = loadUsers();
      const user = users.find(u => (u.id || "").toUpperCase() === id);
      if(!user){ toast("Bunday ID topilmadi"); return; }
      if(String(user.password) !== String(password)){ toast("Parol noto‘g‘ri"); return; }

      setSession(user);
      toast("Kirish muvaffaqiyatli");
      setTimeout(()=> location.href = "app.html", 300);
    });

    // If already logged in, go app
    const sess = getSession();
    if(sess){
      document.getElementById("already")?.classList.add("show");
    }
  });
})();

// auth.js — Faqat Firestore asosidagi oddiy login tizimi
// Kolleksiya: "foydalanuvchilar"

(function(){
  const COLL = "foydalanuvchilar";
  const SESSION_KEY = "imiSession";

  if (!window.firebase || !window.firebase.firestore) {
    alert("Firebase Firestore yuklanmagan. firebase-config.js ni tekshiring.");
    return;
  }

  const db = firebase.firestore();

  /* ===================== Yordamchi funksiyalar ===================== */

  // Local sessionni o'qish
  function getSession(){
    try{
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      console.error("Session parse xato", e);
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  // Local sessionni saqlash
  function setSession(docId, loginId){
    const s = { docId, loginId };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }

  function clearSession(){
    localStorage.removeItem(SESSION_KEY);
  }

  // Tasodifiy 6 xonali ID (foydalanuvchi ID)
  function randomId6(){
    return String(Math.floor(100000 + Math.random()*900000));
  }

  // Tasodifiy 8 belgili parol
  function randomPassword8(){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let s = "";
    for (let i=0; i<8; i++){
      s += chars.charAt(Math.floor(Math.random()*chars.length));
    }
    return s;
  }

  // Boshqa foydalanuvchilarda mavjud bo'lmagan unikal ID yasash
  async function generateUniqueLoginId(){
    while(true){
      const id = randomId6();
      const snap = await db.collection(COLL)
        .where("loginId","==",id)
        .limit(1)
        .get();
      if (snap.empty) return id;
    }
  }

  // Hozirgi foydalanuvchi docini Firestore'dan olish
  async function fetchCurrentUserDoc(){
    const sess = getSession();
    if (!sess || !sess.docId) return null;
    try{
      const snap = await db.collection(COLL).doc(sess.docId).get();
      if (!snap.exists){
        clearSession();
        return null;
      }
      return snap;
    }catch(e){
      console.error("Foydalanuvchini o'qishda xato:", e);
      return null;
    }
  }

  // UI: auth oynasini ko'rsatish/yopish
  function showAuthOverlay(){
    const ov = document.getElementById("auth-overlay");
    if (!ov) return;
    ov.style.display = "flex";
    document.body.classList.add("no-scroll");
  }
  function hideAuthOverlay(){
    const ov = document.getElementById("auth-overlay");
    if (!ov) return;
    ov.style.display = "none";
    document.body.classList.remove("no-scroll");
  }

  // Headerdagi kichik user infoni yangilash
  function updateAuthUserInfo(doc){
    const el = document.getElementById("auth-user-info");
    if (!el) return;
    if (!doc){
      el.textContent = "Anonim foydalanuvchi";
      return;
    }
    const data = doc.data ? doc.data() : doc;
    const name = data.fullName || ("ID: " + (data.loginId || "—"));
    el.textContent = name;
  }

  /* ===================== Login & ro'yxatdan o'tish ===================== */

  async function handleLogin(e){
    e.preventDefault();
    const idInput = document.getElementById("login-id");
    const pwInput = document.getElementById("login-password");
    if (!idInput || !pwInput) return;

    const loginId = idInput.value.trim();
    const password = pwInput.value;

    if (!loginId || !password){
      alert("ID va Parolni to'liq kiriting.");
      return;
    }

    try{
      const snap = await db.collection(COLL)
        .where("loginId","==",loginId)
        .where("password","==",password)
        .limit(1)
        .get();

      if (snap.empty){
        alert("ID yoki Parol noto'g'ri.");
        return;
      }

      const doc = snap.docs[0];
      setSession(doc.id, loginId);
      updateAuthUserInfo(doc.data());
      hideAuthOverlay();

      // Profil majburiymi? Buni profile.js ichida tekshirishingiz mumkin.
      if (window.afterSimpleLogin){
        window.afterSimpleLogin(doc);
      }
    }catch(err){
      console.error("Login xatosi:", err);
      alert("Kirishda xatolik: " + err.message);
    }
  }

  async function handleAutoRegister(){
    const btn = document.getElementById("btn-auto-register");
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = "Yaratilmoqda...";

    try{
      const loginId = await generateUniqueLoginId();
      const password = randomPassword8();

      const docRef = await db.collection(COLL).add({
        loginId,
        password,               // xohlasangiz keyin hash qilib saqlash mumkin
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        role: "foydalanuvchi",
        points: 0
      });

      setSession(docRef.id, loginId);

      // Ekranga ID + Parolni chiqaramiz
      const box = document.getElementById("auth-generated-credentials");
      if (box){
        box.style.display = "block";
        box.innerHTML = `
          <div class="auth-cred-title">Sizning ID va Parolingiz</div>
          <div class="auth-cred-row">
            <span>ID:</span>
            <code>${loginId}</code>
          </div>
          <div class="auth-cred-row">
            <span>Parol:</span>
            <code>${password}</code>
          </div>
          <div class="auth-cred-note">
            Ushbu ID va parolni yozib oling. Boshqa qurilmalardan kirishda ham shu orqali tizimga kirasiz.
          </div>
        `;
      }

      // Kichik user infoni yangilash
      updateAuthUserInfo({ fullName:null, loginId });

      hideAuthOverlay();

      if (window.afterSimpleLogin){
        const snap = await docRef.get();
        window.afterSimpleLogin(snap);
      }

    }catch(err){
      console.error("Auto register xatosi:", err);
      alert("Ro'yxatdan o'tishda xatolik: " + err.message);
    }finally{
      btn.disabled = false;
      btn.textContent = "ID + Parolni avtomatik berish";
    }
  }

  function handleLogout(){
    clearSession();
    // butun portalni "logout" holatiga qaytaramiz
    location.reload();
  }

  /* ===================== DOM tayyor bo'lgach ===================== */

  document.addEventListener("DOMContentLoaded", async ()=>{
    const loginForm   = document.getElementById("auth-login-form");
    const btnAutoReg  = document.getElementById("btn-auto-register");
    const btnLogout   = document.getElementById("btn-logout");
    const googleBtn   = document.getElementById("btn-google-login");

    if (loginForm){
      loginForm.addEventListener("submit", handleLogin);
    }
    if (btnAutoReg){
      btnAutoReg.addEventListener("click", handleAutoRegister);
    }
    if (btnLogout){
      btnLogout.addEventListener("click", handleLogout);
    }
    if (googleBtn){
      googleBtn.addEventListener("click", ()=>{
        alert("Bu versiyada Google bilan kirish o'chirilgan. ID + Parol orqali kiring.");
      });
    }

    // Sahifa ochilganda eski session bormi?
    const sess = getSession();
    if (!sess){
      showAuthOverlay();
      updateAuthUserInfo(null);
    }else{
      try{
        const snap = await db.collection(COLL).doc(sess.docId).get();
        if (!snap.exists){
          clearSession();
          showAuthOverlay();
          updateAuthUserInfo(null);
        }else{
          updateAuthUserInfo(snap.data());
          hideAuthOverlay();

          if (window.afterSimpleLogin){
            window.afterSimpleLogin(snap);
          }
        }
      }catch(e){
        console.error("Session tekshirish xatosi:", e);
        showAuthOverlay();
      }
    }
  });

  // Tizim bo'ylab ishlatish uchun global helper
  window.simpleAuth = {
    getSession,
    fetchCurrentUserDoc
  };

})();

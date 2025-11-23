// Custom "light" auth - faqat Firestore va localStorage asosida
// Collection: "foydalanuvchilar"
// Hujjatlarda: loginId (6 xonali), password, fullName, birthDate, region, district, points va hokazo

(function(){
  const LS_KEY = 'imiSession';

  function randomDigits(len){
    let s = '';
    for(let i=0;i<len;i++){
      s += Math.floor(Math.random()*10);
    }
    return s;
  }

  function randomPassword(len){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let s = '';
    for(let i=0;i<len;i++){
      s += chars[Math.floor(Math.random()*chars.length)];
    }
    return s;
  }

  let currentUser = null;
  const listeners = new Set();

  function emitUserChange(){
    listeners.forEach(fn=>{
      try{ fn(currentUser); }catch(e){ console.error(e); }
    });
  }

  async function loadUserFromStorage(){
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    let obj;
    try{
      obj = JSON.parse(raw);
    }catch(e){
      console.warn('Session parse error', e);
      return null;
    }
    if (!obj || !obj.docId) return null;

    const docRef = db.collection('foydalanuvchilar').doc(obj.docId);
    const snap = await docRef.get();
    if (!snap.exists){
      localStorage.removeItem(LS_KEY);
      return null;
    }
    const data = snap.data() || {};
    currentUser = {
      id: snap.id,
      data
    };
    emitUserChange();
    return currentUser;
  }

  async function saveSession(docId){
    localStorage.setItem(LS_KEY, JSON.stringify({docId}));
  }

  async function login(loginId, password){
    loginId = String(loginId || '').trim();
    password = String(password || '').trim();
    if (!loginId || !password) throw new Error("ID va parol majburiy.");

    const snap = await db.collection('foydalanuvchilar')
      .where('loginId', '==', loginId)
      .limit(1)
      .get();

    if (snap.empty) throw new Error("Bunday ID topilmadi.");
    const doc = snap.docs[0];
    const data = doc.data() || {};

    if (!data.password || data.password !== password){
      throw new Error("Parol noto'g'ri.");
    }

    currentUser = { id: doc.id, data };
    await saveSession(doc.id);
    emitUserChange();
    return currentUser;
  }

  async function autoRegister(){
    // loginId ni unik qilish uchun oddiy qayta urinish
    let loginId;
    let ok = false;
    for (let i=0;i<10;i++){
      loginId = randomDigits(6);
      const snap = await db.collection('foydalanuvchilar')
        .where('loginId','==',loginId)
        .limit(1)
        .get();
      if (snap.empty){ ok = true; break; }
    }
    if (!ok) throw new Error("ID generatsiyada xatolik. Qayta urinib ko'ring.");

    const password = randomPassword(8);

    const now = new Date();
    const docRef = db.collection('foydalanuvchilar').doc();
    const initData = {
      loginId,
      password,
      fullName: "",
      birthDate: "",
      region: "",
      district: "",
      points: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await docRef.set(initData);

    currentUser = { id: docRef.id, data: initData };
    await saveSession(docRef.id);
    emitUserChange();

    return { user: currentUser, loginId, password };
  }

  async function requireSession(){
    if (currentUser) return currentUser;

    // Avval localStorage dan topishga harakat qilamiz
    await loadUserFromStorage();
    if (currentUser) return currentUser;

    // Agar topilmasa — login sahifasiga yuboramiz
    const here = window.location.pathname;
    if (!here.endsWith('login.html')){
      window.location.href = 'login.html';
    }
    throw new Error("Session yo'q");
  }

  async function refreshUser(){
    if (!currentUser){
      return loadUserFromStorage();
    }
    const docRef = db.collection('foydalanuvchilar').doc(currentUser.id);
    const snap = await docRef.get();
    if (!snap.exists){
      localStorage.removeItem(LS_KEY);
      currentUser = null;
      emitUserChange();
      return null;
    }
    currentUser = { id: snap.id, data: snap.data() || {} };
    emitUserChange();
    return currentUser;
  }

  async function updateUserData(payload){
    await requireSession();
    const docRef = db.collection('foydalanuvchilar').doc(currentUser.id);
    await docRef.set(payload, {merge:true});
    return refreshUser();
  }

  function logout(){
    localStorage.removeItem(LS_KEY);
    currentUser = null;
    emitUserChange();
  }

  function onUserChange(cb){
    if (typeof cb === 'function'){
      listeners.add(cb);
      cb(currentUser);
      return () => listeners.delete(cb);
    }
  }

  // public API
  window.authLite = {
    login,
    autoRegister,
    requireSession,
    refreshUser,
    updateUserData,
    logout,
    onUserChange
  };

  // Sahifa yuklanganda, agar session bo'lsa - yuklab qo'yamiz
  loadUserFromStorage().catch(console.error);

})();

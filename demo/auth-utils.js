// improved auth-utils.js (compat-compatible, backward-compatible)
(function(){
  const STORAGE_KEY = 'leaderMathUserSession';
  const COL = 'foydalanuvchilar';

  let db = null;
  let currentUser = null;
  let isSessionLoading = false;
  let sessionPromise = null;

  function ensureDb(){
    if (db) return db;
    // Avval global db dan foydalanish
    if (window.db) {
      db = window.db;
      return db;
    }
    if (typeof window.firebase === 'undefined' || !firebase.firestore){
      console.error('Firestore topilmadi. Iltimos firebase-app-compat va firebase-firestore-compat yuklang.');
      return null;
    }
    try {
      db = firebase.firestore();
      return db;
    } catch (e) {
      console.error('Firestore init xatosi:', e);
      return null;
    }
  }

  async function loadSession(){
    // Agar sessiya yuklanayotgan bo'lsa, shu promise'ni qaytarish
    if (isSessionLoading && sessionPromise) {
      return sessionPromise;
    }

    isSessionLoading = true;
    sessionPromise = (async () => {
      const dbi = ensureDb();
      if (!dbi) {
        isSessionLoading = false;
        return null;
      }
      
      let docId = null;
      try{ 
        docId = localStorage.getItem(STORAGE_KEY); 
      } catch(e) {
        console.error('LocalStorage error:', e);
      }

      if (!docId){
        currentUser = null;
        isSessionLoading = false;
        return null;
      }

      try{
        const snap = await dbi.collection(COL).doc(docId).get();
        if (!snap.exists){
          try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
          currentUser = null;
          isSessionLoading = false;
          return null;
        }
        currentUser = { 
          docId: snap.id, 
          id: snap.id,
          data: snap.data() || {} 
        };
        isSessionLoading = false;
        return currentUser;
      }catch(err){
        console.error('Session yuklashda xatolik:', err);
        currentUser = null;
        isSessionLoading = false;
        return null;
      }
    })();

    return sessionPromise;
  }

  async function requireSession(){
    // Agar currentUser allaqachon mavjud bo'lsa, darhol qaytarish
    if (currentUser) {
      return currentUser;
    }

    // Sessionni yuklash
    const user = await loadSession();
    
    if (user) {
      return user;
    }

    // Agar session mavjud bo'lmasa, login sahifasiga yo'naltirish
    const currentPath = window.location.pathname;
    // Faqat login sahifasida bo'lmasak, redirect qilamiz
    if (!currentPath.includes('login.html')) {
      const redirect = encodeURIComponent(window.location.href);
      window.location.href = `login.html?redirect=${redirect}`;
      // Redirect qilgandan so'ng, yangi promise qaytaramiz, chunki bu sahifa yuklanmaydi
      return new Promise(() => {});
    }
    
    return null;
  }

  async function checkSession() {
    // Session borligini tekshirish, lekin redirect qilmaslik
    if (currentUser) return currentUser;
    
    const user = await loadSession();
    return user;
  }

  function getUser(){
    return currentUser;
  }

  async function loginWithIdPassword(loginId, password){
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');

    const id   = (loginId || '').trim();
    const pass = (password || '').trim();
    if (!id || !pass) throw new Error('ID va parol talab qilinadi');

    const snap = await dbi.collection(COL)
      .where('loginId','==',id)
      .limit(1)
      .get();

    if (snap.empty) throw new Error('Bunday ID topilmadi');

    const doc  = snap.docs[0];
    const data = doc.data() || {};

    // Plaintext password comparison
    if (!data.password || data.password !== pass){
      throw new Error('Parol noto‘g‘ri');
    }

    try{ 
      localStorage.setItem(STORAGE_KEY, doc.id); 
    } catch(e) {
      console.error('LocalStorage error:', e);
    }

    currentUser = { 
      docId: doc.id, 
      id: doc.id,
      data: data 
    };
    
    return currentUser;
  }

  async function registerAuto(){
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');

    const loginId = await generateUniqueId();
    const password = generatePassword(8);

    const payload = {
      loginId,
      password,
      fullName: '',
      birthDate: '',
      region: '',
      district: '',
      points: 0,
      rank: 'Yangi foydalanuvchi',
      bestScore: 0,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await dbi.collection(COL).add(payload);

    try{ 
      localStorage.setItem(STORAGE_KEY, docRef.id); 
    } catch(e) {
      console.error('LocalStorage error:', e);
    }

    currentUser = { 
      docId: docRef.id, 
      id: docRef.id,
      data: payload 
    };

    return { loginId, password, user: currentUser };
  }

  async function logout(){
    try{ 
      localStorage.removeItem(STORAGE_KEY); 
    } catch(e) {
      console.error('LocalStorage error:', e);
    }
    currentUser = null;
    isSessionLoading = false;
    sessionPromise = null;
  }

  async function updateUserData(partial){
    if (!currentUser) throw new Error('Foydalanuvchi topilmadi');
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');
    
    const updateData = {
      ...partial,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await dbi.collection(COL).doc(currentUser.docId).set(updateData, { merge: true });
    
    currentUser = {
      docId: currentUser.docId,
      id: currentUser.docId,
      data: { ...currentUser.data, ...updateData }
    };
    
    return currentUser;
  }

  async function generateUniqueId(){
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');

    for (let i=0;i<9999;i++){
      const id = String(Math.floor(100000 + Math.random()*900000));
      const q  = await dbi.collection(COL)
        .where('loginId','==',id)
        .limit(1)
        .get();
      if (q.empty) return id;
    }
    return String(Date.now()).slice(-6);
  }

  function generatePassword(len = 8){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i=0; i<len; i++){
      s += chars[Math.floor(Math.random()*chars.length)];
    }
    return s;
  }

  // Avvalgi sessionni yuklash
  loadSession();

  window.authUtils = {
    requireSession,
    checkSession,
    getUser,
    loadSession,
    loginWithIdPassword,
    registerAuto,
    logout,
    updateUserData,
    generateUniqueId,
    generatePassword
  };

})();
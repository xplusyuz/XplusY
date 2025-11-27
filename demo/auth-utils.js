// auth-utils.js - Foydalanuvchi uchun bitta document yaratish, session boshqarish, o'yin natijalari
(function(){
  const STORAGE_KEY = 'imiFoydalanuvchiDocId';
  const COL = 'foydalanuvchilar';

  let db = null;
  let currentUser = null;
  const listeners = [];

  /* =============== ASOSIY FUNKSIYALAR =============== */

  function ensureDb(){
    if (db) return db;
    if (!window.firebase || !firebase.firestore){
      console.error('Firestore topilmadi.');
      return null;
    }
    db = firebase.firestore();
    return db;
  }

  // Foydalanuvchi ID sini izchil olish
  function getConsistentUserId(user) {
    if (!user) return null;
    if (user.id) return String(user.id);
    if (user.uid) return String(user.uid);
    if (user.data?.loginId) return String(user.data.loginId);
    if (user.data?.id) return String(user.data.id);
    if (user.docId) return String(user.docId);
    console.warn('Foydalanuvchi ID si topilmadi:', user);
    return null;
  }

  /* =============== SESSION BOSHQARISH =============== */

  function onUserChange(cb){
    if (typeof cb === 'function') listeners.push(cb);
  }

  function notify(){
    listeners.forEach(fn=>{
      try{ fn(currentUser); }catch(e){ console.error(e); }
    });
  }

  function getUser(){
    return currentUser;
  }

  async function loadSession(){
    const dbi = ensureDb();
    if (!dbi) return null;
    
    let docId = null;
    try{ docId = localStorage.getItem(STORAGE_KEY); }catch(e){}

    if (!docId){
      currentUser = null;
      notify();
      return null;
    }

    try{
      const snap = await dbi.collection(COL).doc(docId).get();
      if (!snap.exists){
        localStorage.removeItem(STORAGE_KEY);
        currentUser = null;
        notify();
        return null;
      }
      currentUser = { 
        docId: snap.id, 
        id: snap.id,
        data: snap.data() || {} 
      };
      notify();
      return currentUser;
    }catch(err){
      console.error('Session yuklashda xatolik:', err);
      return null;
    }
  }

  async function requireSession(){
    ensureDb();
    if (!currentUser) await loadSession();
    if (currentUser) return currentUser;

    const redirect = encodeURIComponent(location.pathname + location.search + location.hash);
    location.href = 'login.html?redirect=' + redirect;
    return new Promise(()=>{}); // hech qachon resolve bo‘lmaydi
  }

  /* =============== LOGIN & REGISTER =============== */

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

    if (!data.password || data.password !== pass){
      throw new Error('Parol noto‘g‘ri');
    }

    try{ localStorage.setItem(STORAGE_KEY, doc.id); }catch(e){}

    currentUser = { 
      docId: doc.id, 
      id: doc.id,
      data: data 
    };
    notify();
    return currentUser;
  }

  async function generateUniqueId(){
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');

    while(true){
      const id = String(Math.floor(100000 + Math.random()*900000));
      const q  = await dbi.collection(COL)
        .where('loginId','==',id)
        .limit(1)
        .get();
      if (q.empty) return id;
    }
  }

  function generatePassword(len = 8){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i=0; i<len; i++){
      s += chars[Math.floor(Math.random()*chars.length)];
    }
    return s;
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
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await dbi.collection(COL).add(payload);

    try{ localStorage.setItem(STORAGE_KEY, docRef.id); }catch(e){}

    currentUser = { 
      docId: docRef.id, 
      id: docRef.id,
      data: payload 
    };
    notify();

    return { loginId, password, user: currentUser };
  }

  /* =============== PROFIL BOSHQARISH =============== */

  async function logout(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
    currentUser = null;
    notify();
  }

  async function refreshUser(){
    if (!currentUser) return loadSession();
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');
    
    const snap = await dbi.collection(COL).doc(currentUser.docId).get();
    if (!snap.exists){
      await logout();
      return null;
    }
    
    currentUser = { 
      docId: snap.id, 
      id: snap.id,
      data: snap.data() || {} 
    };
    notify();
    return currentUser;
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
    notify();
    return currentUser;
  }

  async function getUserProfile(userId = null) {
    const dbi = ensureDb();
    if (!dbi) return null;
    
    const targetUserId = userId || (currentUser ? currentUser.docId : null);
    if (!targetUserId) return null;
    
    try {
      const userDoc = await dbi.collection(COL).doc(targetUserId).get();
      return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
      console.error('Foydalanuvchi maʼlumotlarini o‘qishda xatolik:', error);
      return null;
    }
  }

  async function checkUserExists(userId) {
    if (!userId) return false;
    const dbi = ensureDb();
    if (!dbi) return false;
    
    try {
      const userDoc = await dbi.collection(COL).doc(userId).get();
      return userDoc.exists;
    } catch (error) {
      console.error('Foydalanuvchi mavjudligini tekshirishda xatolik:', error);
      return false;
    }
  }

  /* =============== O'YIN NATIJALARI =============== */

  async function saveGameResult(gameData) {
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');
    if (!currentUser) throw new Error('Foydalanuvchi topilmadi');

    const resultData = {
      userId: currentUser.docId,
      gameType: 'viet1',
      score: gameData.score || 0,
      correctAnswers: gameData.correctAnswers || 0,
      totalQuestions: gameData.totalQuestions || 0,
      timeSpent: gameData.timeSpent || 0,
      difficulty: gameData.difficulty || 1,
      xpEarned: gameData.xpEarned || 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await dbi.collection('gameResults').add(resultData);
      return { success: true };
    } catch (error) {
      console.error('Natijani saqlashda xatolik:', error);
      return { success: false, error: error.message };
    }
  }

  async function updateBestScore(newScore) {
    if (!currentUser) throw new Error('Foydalanuvchi topilmadi');
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');

    const userRef = dbi.collection(COL).doc(currentUser.docId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new Error('Foydalanuvchi topilmadi');

    const currentBest = userDoc.data().bestScore || 0;
    let isNewRecord = false;

    if (newScore > currentBest) {
      await userRef.update({
        bestScore: newScore,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      isNewRecord = true;
      currentUser.data.bestScore = newScore;
      notify();
    }

    return { success: true, isNewRecord, bestScore: Math.max(currentBest, newScore) };
  }

  async function getLeaderboard(limit = 10) {
    const dbi = ensureDb();
    if (!dbi) throw new Error('Firestore mavjud emas');

    try {
      const snapshot = await dbi.collection(COL)
        .orderBy('bestScore', 'desc')
        .limit(limit)
        .get();

      const leaderboard = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          fullName: data.fullName || 'Foydalanuvchi',
          bestScore: data.bestScore || 0
        };
      });

      return { success: true, leaderboard };
    } catch (error) {
      console.error('Reyting jadvalini olishda xatolik:', error);
      return { success: false, error: error.message };
    }
  }

  /* =============== INIT =============== */
  loadSession();

  // Global object
  window.authUtils = {
    // Session
    requireSession,
    getUser,
    onUserChange,
    loadSession,
    
    // Auth
    loginWithIdPassword,
    registerAuto,
    logout,
    refreshUser,
    
    // Profile management
    updateUserData,
    getUserProfile,
    checkUserExists,
    getConsistentUserId,
    
    // Game results
    saveGameResult,
    updateBestScore,
    getLeaderboard,
    
    // Utilities
    generatePassword,
    generateUniqueId
  };

  // authLite bilan moslik
  window.authLite = window.authUtils;

})();

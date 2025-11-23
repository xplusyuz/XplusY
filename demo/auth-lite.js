// auth-lite.js
// Faqat Firestore bilan ishlaydigan sodda auth tizim
// Kolleksiya: "foydalanuvchilar"

(function () {
  const SESSION_KEY = "imi_session_v1";

  let currentUser = null;
  let listeners = [];

  function saveSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error("Session parse xato:", e);
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(currentUser);
      } catch (e) {
        console.error(e);
      }
    });
  }

  async function fetchUserByDocId(docId) {
    const snap = await db.collection("foydalanuvchilar").doc(docId).get();
    if (!snap.exists) return null;
    return { id: snap.id, data: snap.data() };
  }

  async function fetchUserByLoginId(loginId) {
    const q = await db
      .collection("foydalanuvchilar")
      .where("loginId", "==", loginId)
      .limit(1)
      .get();
    if (q.empty) return null;
    const doc = q.docs[0];
    return { id: doc.id, data: doc.data() };
  }

  function generateId() {
    // 6 xonali tasodifiy ID
    const n = Math.floor(100000 + Math.random() * 900000);
    return String(n);
  }

  function generatePassword() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 8; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return p;
  }

  async function generateUniqueLoginId(maxTry = 7) {
    for (let i = 0; i < maxTry; i++) {
      const id = generateId();
      const ex = await fetchUserByLoginId(id);
      if (!ex) return id;
    }
    throw new Error("ID generatsiya qilishda xatolik, keyinroq urinib ko‘ring.");
  }

  // === Public API ===

  async function loginWithIdPassword(loginId, password) {
    const user = await fetchUserByLoginId(loginId);
    if (!user) throw new Error("Bunday ID topilmadi.");
    const data = user.data || {};
    if (!data.password) throw new Error("Bu hisob uchun parol o‘rnatilmagan.");
    if (data.password !== password) throw new Error("Parol noto‘g‘ri.");

    const session = { docId: user.id, loginId: data.loginId };
    saveSession(session);
    currentUser = user;
    notify();
    return user;
  }

  async function registerAuto() {
    const loginId = await generateUniqueLoginId();
    const password = generatePassword();

    const docRef = await db.collection("foydalanuvchilar").add({
      loginId,
      password,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      points: 0,
      xp: 0,
    });

    const snap = await docRef.get();
    const user = { id: snap.id, data: snap.data() };

    saveSession({ docId: user.id, loginId });
    currentUser = user;
    notify();

    return { loginId, password, user };
  }

  async function requireSession() {
    const sess = loadSession();
    if (!sess || !sess.docId) {
      // login sahifaga redirect
      const here = window.location.pathname + window.location.search;
      const q = encodeURIComponent(here);
      window.location.href = "/login.html?redirect=" + q;
      throw new Error("Session yo‘q, login sahifaga yuborildi.");
    }
    const user = await fetchUserByDocId(sess.docId);
    if (!user) {
      clearSession();
      const here = window.location.pathname + window.location.search;
      const q = encodeURIComponent(here);
      window.location.href = "/login.html?redirect=" + q;
      throw new Error("Foydalanuvchi topilmadi, login sahifaga yuborildi.");
    }
    currentUser = user;
    notify();
    return user;
  }

  async function refreshUser() {
    const sess = loadSession();
    if (!sess || !sess.docId) return null;
    const user = await fetchUserByDocId(sess.docId);
    if (!user) return null;
    currentUser = user;
    notify();
    return user;
  }

  async function updateUserData(payload) {
    const sess = loadSession();
    if (!sess || !sess.docId)
      throw new Error("Session topilmadi (updateUserData).");
    const docRef = db.collection("foydalanuvchilar").doc(sess.docId);
    await docRef.set(payload, { merge: true });
  }

  function getRedirectUrl(defaultPath) {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("redirect");
    if (r) return decodeURIComponent(r);
    return defaultPath || "/index.html";
  }

  function logout() {
    clearSession();
    currentUser = null;
    notify();
  }

  function onUserChange(cb) {
    if (typeof cb === "function") listeners.push(cb);
  }

  function getCurrentUser() {
    return currentUser;
  }

  // Export
  window.authLite = {
    loginWithIdPassword,
    registerAuto,
    requireSession,
    refreshUser,
    updateUserData,
    getRedirectUrl,
    logout,
    onUserChange,
    getCurrentUser,
  };
})();

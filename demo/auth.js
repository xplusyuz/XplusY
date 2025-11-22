// ===================== AUTH.JS =====================
// Firebase global bo'lishi kerak (firebase-config.js ichida bo'ladi)
if (!window.auth || !window.db) {
  alert("Auth tizimi yuklanmagan! firebase-config.js ni tekshiring.");
}

// Auth Overlay elementlari
const authOverlay = document.getElementById("auth-overlay");
const loginForm   = document.getElementById("auth-login-form");
const btnGoogle   = document.getElementById("btn-google-login");
const btnAutoReg  = document.getElementById("btn-auto-register");
const logoutBtn   = document.getElementById("btn-logout");

// ===================== AVTO ID + PAROL GENERATOR =====================
function generateRandomID() {
  return String(Math.floor(100000 + Math.random() * 900000));   // 6 xonali raqam
}
function generateRandomPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let pass = "";
  for (let i=0;i<8;i++) pass += chars[Math.floor(Math.random()*chars.length)];
  return pass;  // 8 belgili
}

// ===================== CHECK PROFILE FILL =====================
async function isProfileCompleted(uid){
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data();
  const needed = ["fullName","class","region","district","school"];
  return needed.every(f => data[f] && data[f] !== "");
}

// ===================== MAIN AUTH STATE LISTENER =====================
auth.onAuthStateChanged(async user => {
  if (!user) {
    authOverlay.style.display = "flex";
    return;
  }

  // 🔑 Login bo‘lgan foydalanuvchi
  authOverlay.style.display = "none";

  // Agar profil to‘ldirilmagan bo‘lsa – majburiy modal profil ochiladi!
  const done = await isProfileCompleted(user.uid);
  if (!done) {
    console.log("Profil to‘ldirilmagan → majburiy modal profil ochamiz");
    if (typeof openProfileModal === "function") {
      openProfileModal(); // profil-modaldagi funksiya – index.html ichida bor
    }
  }
});

// ===================== ID + PAROL BILAN LOGIN =====================
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const id   = document.getElementById("login-id").value.trim();
  const pass = document.getElementById("login-password").value.trim();

  // IDni email ko‘rinishiga o‘tkazamiz:
  const email = `${id}@1-imi.local`;

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    alert("Login xatosi: " + err.message);
  }
});

// ===================== GOOGLE BILAN LOGIN =====================
btnGoogle.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    // Firestore hujjat yaratiladi (agar bo'lmasa):
    await db.collection("users").doc(user.uid).set({
      fullName: user.displayName || "",
      email: user.email || "",
      points: 0,
      role: "student",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
    
  } catch (err) {
    alert("Google login xatosi: " + err.message);
  }
});

// ===================== AVTO RO‘YXATDAN O‘TISH =====================
btnAutoReg.addEventListener("click", async () => {
  const id    = generateRandomID();
  const pass  = generateRandomPassword();
  const email = `${id}@1-imi.local`;

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const user = cred.user;

    // Firestore hujjat
    await db.collection("users").doc(user.uid).set({
      fullName: "",
      email: email,
      points: 0,
      role: "student",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Ekranga ko‘rsatamiz
    const box = document.getElementById("auth-generated-credentials");
    box.innerHTML = `
      <div class="auth-cred-title">Sizga berilgan ID + Parol:</div>
      <div class="auth-cred-row"><b>ID:</b> <code>${id}</code></div>
      <div class="auth-cred-row"><b>Parol:</b> <code>${pass}</code></div>
      <p class="auth-cred-note">Diqqat! Shu maʼlumotni yozib oling, keyin yo‘qoladi.</p>
    `;
    box.style.display = "block";

  } catch (err) {
    alert("Ro'yxatdan o'tishda xato: " + err.message);
  }
});

// ===================== LOGOUT =====================
logoutBtn.addEventListener("click", async () => {
  try {
    await auth.signOut();
    authOverlay.style.display = "flex";
  } catch (err) {
    alert("Chiqishda xato: " + err.message);
  }
});

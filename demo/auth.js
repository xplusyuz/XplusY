// auth.js
// Firebase oldindan yuklangan bo'lishi kerak (firebase-app-compat, auth, firestore)

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// ID = 6 xonali ixtiyoriy son
function generateNumericId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Parol = 8 ta harf+raqam (biroz chiroyliroq)
function generatePassword(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// ID dan email alias yasash (Firebase Auth uchun)
function idToAliasEmail(id) {
  // Bu domen ixtiyoriy, faqat bir xil bo'lsa bo'ldi
  return `${id}@portal.1imi`;
}

// Ekranda ID + Parolni ko'rsatish
function showCredentials(id, password) {
  const box = document.getElementById("auth-generated-credentials");
  if (!box) return;
  box.innerHTML = `
    <div class="auth-cred-title">Sizning ID va Parolingiz</div>
    <div class="auth-cred-row">
      <span>ID:</span>
      <code>${id}</code>
    </div>
    <div class="auth-cred-row">
      <span>Parol:</span>
      <code>${password}</code>
    </div>
    <div class="auth-cred-note">
      Iltimos, ID va Parolni saqlab oling (skrinshtot yoki nusxa).
    </div>
  `;
  box.style.display = "block";
}

// Avto ro'yxatdan o'tish (ID+parolni o'zi beradi)
async function handleAutoRegister() {
  const btn = document.getElementById("btn-auto-register");
  if (btn) btn.disabled = true;

  try {
    let created = false;
    let numericId, password, email;

    while (!created) {
      numericId = generateNumericId();
      password = generatePassword(8);
      email = idToAliasEmail(numericId);

      try {
        // Agar email allaqachon ishlatilgan bo'lsa, qayta harakat qilamiz
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCred.user;

        await db.collection("users").doc(user.uid).set({
          numericId,
          aliasEmail: email,
          showPassword: password, // productionda saqlamaslik xavfsizroq
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          provider: "id_password",
        });

        showCredentials(numericId, password);
        created = true;
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          // ID to'qnashdi, qayta urinamiz
          continue;
        } else {
          console.error(err);
          alert("Ro'yxatdan o'tishda xatolik: " + err.message);
          break;
        }
      }
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ID + Parol bilan kirish
async function handleIdLogin(event) {
  event.preventDefault();
  const idInput = document.getElementById("login-id");
  const passInput = document.getElementById("login-password");
  if (!idInput || !passInput) return;

  const id = (idInput.value || "").trim();
  const password = passInput.value;

  if (!id || !password) {
    alert("ID va Parolni kiriting.");
    return;
  }

  const email = idToAliasEmail(id);

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged ichida modal yopiladi
  } catch (err) {
    console.error(err);
    if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
      alert("ID yoki Parol noto'g'ri.");
    } else {
      alert("Kirishda xatolik: " + err.message);
    }
  }
}

// Google bilan kirish (birinchi marta kirsa ID+Parol ham beramiz)
async function handleGoogleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    const userDocRef = db.collection("users").doc(user.uid);
    const snap = await userDocRef.get();

    if (!snap.exists) {
      // Yangi Google foydalanuvchi: unga ID+Parol beramiz va shu acc bilan bog'laymiz
      let created = false;
      let numericId, password, aliasEmail;

      while (!created) {
        numericId = generateNumericId();
        password = generatePassword(8);
        aliasEmail = idToAliasEmail(numericId);

        try {
          const cred = firebase.auth.EmailAuthProvider.credential(aliasEmail, password);
          // Google accountga email+password credentialni link qilamiz
          await user.linkWithCredential(cred);

          await userDocRef.set({
            numericId,
            aliasEmail,
            showPassword: password, // faqat ko'rsatish uchun
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            provider: "google",
            displayName: user.displayName || "",
            email: user.email || "",
          });

          showCredentials(numericId, password);
          created = true;
        } catch (err) {
          if (err.code === "auth/email-already-in-use") {
            // Tasodifan aynan shu ID kimdadir bor ekan, qayta ID generatsiya
            continue;
          } else {
            console.error(err);
            alert("Google bilan bog'lashda xatolik: " + err.message);
            break;
          }
        }
      }
    } else {
      // Eski Google foydalanuvchi: uning oldingi ID+Parolini ko'rsatishimiz mumkin
      const data = snap.data();
      if (data && data.numericId && data.showPassword) {
        showCredentials(data.numericId, data.showPassword);
      }
    }
  } catch (err) {
    console.error(err);
    if (err.code !== "auth/popup-closed-by-user") {
      alert("Google orqali kirishda xatolik: " + err.message);
    }
  }
}

// Auth modalni ochish/yopish
function openAuthModal() {
  const overlay = document.getElementById("auth-overlay");
  if (overlay) overlay.style.display = "flex";
  document.body.classList.add("no-scroll");
}

function closeAuthModal() {
  const overlay = document.getElementById("auth-overlay");
  if (overlay) overlay.style.display = "none";
  document.body.classList.remove("no-scroll");
}

// Sahifani himoyalash: login bo'lmasa modal ochiq turadi
function setupAuthGuard() {
  auth.onAuthStateChanged(async (user) => {
    const userInfoBox = document.getElementById("auth-user-info");

    if (!user) {
      // Kirilmagan – hamma sahifalarda blok
      if (userInfoBox) {
        userInfoBox.textContent = "Kirish talab qilinadi.";
      }
      openAuthModal();
    } else {
      // Kirgan – modalni yopamiz
      if (userInfoBox) {
        const snap = await db.collection("users").doc(user.uid).get();
        let numericIdText = "";
        if (snap.exists && snap.data().numericId) {
          numericIdText = `ID: ${snap.data().numericId}`;
        }
        userInfoBox.textContent = (user.displayName || "Foydalanuvchi") + (numericIdText ? ` (${numericIdText})` : "");
      }
      closeAuthModal();
    }
  });
}

// UI eventlarini bog'lash
function setupAuthUi() {
  const loginForm = document.getElementById("auth-login-form");
  const autoRegBtn = document.getElementById("btn-auto-register");
  const googleBtn = document.getElementById("btn-google-login");
  const logoutBtn = document.getElementById("btn-logout");

  if (loginForm) {
    loginForm.addEventListener("submit", handleIdLogin);
  }
  if (autoRegBtn) {
    autoRegBtn.addEventListener("click", handleAutoRegister);
  }
  if (googleBtn) {
    googleBtn.addEventListener("click", handleGoogleLogin);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => auth.signOut());
  }

  setupAuthGuard();
}

// DOM tayyor bo'lganda ishga tushirish
document.addEventListener("DOMContentLoaded", setupAuthUi);

// auth.js

// ====== Firebase init ======
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db   = firebase.firestore();

window.auth = auth;
window.db   = db;

// ====== Helpers ======

function loginIdToEmail(loginId) {
  // ID dan texnik email yasaymiz (faqat backend uchun)
  return `${loginId}@imi-portal.local`;
}

function generateRandomPassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < len; i++) {
    p += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return p;
}

async function generateUniqueLoginId() {
  while (true) {
    const id = String(Math.floor(100000 + Math.random() * 900000)); // 6 xonali
    const snap = await db.collection('users')
      .where('loginId', '==', id)
      .limit(1)
      .get();
    if (snap.empty) return id;
  }
}

function showGeneratedCredentials(id, password) {
  const box = document.getElementById('auth-generated-credentials');
  if (!box) return;

  box.style.display = 'block';
  box.innerHTML = `
    <div class="auth-cred-title">ID va Parol generatsiya qilindi</div>
    <div class="auth-cred-row">
      <span>ID:</span>
      <code>${id}</code>
    </div>
    <div class="auth-cred-row">
      <span>Parol:</span>
      <code>${password}</code>
    </div>
    <div class="auth-cred-note">
      Iltimos, ushbu ID va Parolni yozib oling yoki screenshot oling.
      Keyinchalik boshqa qurilmadan kirishda aynan shular kerak bo‘ladi.
    </div>
  `;
  alert(`Sizning ID'ingiz: ${id}\nParolingiz: ${password}\n\nUlarni albatta yozib oling!`);
}

// ====== Auth overlay + eventlar ======

document.addEventListener('DOMContentLoaded', () => {
  const authOverlay   = document.getElementById('auth-overlay');
  const authUserInfo  = document.getElementById('auth-user-info');

  const loginForm     = document.getElementById('auth-login-form');
  const loginIdInput  = document.getElementById('login-id');
  const loginPassInput= document.getElementById('login-password');

  const googleBtn     = document.getElementById('btn-google-login');
  const autoRegBtn    = document.getElementById('btn-auto-register');
  const logoutBtn     = document.getElementById('btn-logout');

  // === Auth state listener ===
  auth.onAuthStateChanged(async (user) => {
    if (!authOverlay || !authUserInfo) return;

    if (user) {
      // Tizimga kirgan
      authOverlay.style.display = 'none';

      try {
        const docRef = db.collection('users').doc(user.uid);
        let snap = await docRef.get();
        if (!snap.exists) {
          await docRef.set({
            uid: user.uid,
            email: user.email || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            points: 0
          }, { merge: true });
          snap = await docRef.get();
        }
        const data = snap.data() || {};
        const idText = data.loginId ? `ID: ${data.loginId}` : (user.email || 'Tizimga kirdingiz');
        authUserInfo.textContent = idText;
      } catch (err) {
        console.error('users/{uid} hujjatni o‘qishda xatolik:', err);
        authUserInfo.textContent = user.email || 'Tizimga kirdingiz';
      }

    } else {
      // Chiqib ketgan
      authOverlay.style.display = 'flex';
      authUserInfo.textContent = 'Anonim foydalanuvchi';
    }
  });

  // === ID + Parol bilan LOGIN ===
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = (loginIdInput.value || '').trim();
      const pwd = loginPassInput.value;

      if (id.length !== 6) {
        alert('ID 6 xonali bo‘lishi kerak.');
        return;
      }
      if (pwd.length < 6) {
        alert('Parol kamida 6 belgi bo‘lsin.');
        return;
      }

      const email = loginIdToEmail(id);
      try {
        await auth.signInWithEmailAndPassword(email, pwd);
        // onAuthStateChanged overlayni yashiradi
      } catch (err) {
        console.error('ID+Parol bilan kirishda xatolik:', err);
        alert('Kirishda xatolik: ' + (err.message || 'Tekshirib qaytadan urinib ko‘ring.'));
      }
    });
  }

  // === AUTO REGISTRATSIYA: ID + Parol generatsiya ===
  if (autoRegBtn) {
    autoRegBtn.addEventListener('click', async () => {
      try {
        const loginId = await generateUniqueLoginId();
        const password = generateRandomPassword(8);
        const email = loginIdToEmail(loginId);

        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;

        await db.collection('users').doc(user.uid).set({
          uid: user.uid,
          loginId,
          email: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          points: 0,
          role: null
        }, { merge: true });

        showGeneratedCredentials(loginId, password);
        // onAuthStateChanged overlayni yopadi

      } catch (err) {
        console.error('Auto registratsiyada xatolik:', err);
        alert('Ro‘yxatdan o‘tishda xatolik: ' + (err.message || 'Qayta urinib ko‘ring.'));
      }
    });
  }

  // === GOOGLE LOGIN + birinchi marta ID+Parol bog‘lash ===
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        if (!user) return;

        const docRef = db.collection('users').doc(user.uid);
        let snap = await docRef.get();
        let data = snap.exists ? (snap.data() || {}) : {};

        // Agar hali loginId yo‘q bo‘lsa — hozir generatsiya qilamiz
        if (!data.loginId) {
          const loginId = await generateUniqueLoginId();
          const password = generateRandomPassword(8);
          const email = loginIdToEmail(loginId);

          try {
            const cred = firebase.auth.EmailAuthProvider.credential(email, password);
            await user.linkWithCredential(cred);
          } catch (linkErr) {
            console.error('Email/Parol credential bilan bog‘lashda xatolik:', linkErr);
            // baribir users hujjatida loginId ni saqlaymiz, parolni keyin o‘zi o‘zgartirishi mumkin
          }

          await docRef.set({
            uid: user.uid,
            loginId,
            email: user.email || null,
            points: data.points || 0,
            createdAt: data.createdAt || firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          showGeneratedCredentials(loginId, password);
        } else {
          // loginId bor — faqat emailni yangilab qo‘yamiz
          await docRef.set({
            uid: user.uid,
            email: user.email || null
          }, { merge: true });
        }

      } catch (err) {
        console.error('Google bilan kirishda xatolik:', err);
        alert('Google bilan kirishda xatolik: ' + (err.message || 'Qayta urinib ko‘ring.'));
      }
    });
  }

  // === LOGOUT ===
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await auth.signOut();
      } catch (err) {
        console.error('Logout xatoligi:', err);
        alert('Chiqishda xatolik: ' + (err.message || 'Qayta urinib ko‘ring.'));
      }
    });
  }
});

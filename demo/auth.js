// auth.js — ID + Parol tizimi (boshqa qurilmadan ham kirish uchun)
(function () {
  // Firebase init
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();

  // Global qilib qo'yamiz (profil va boshqa skriptlar uchun)
  window.auth = auth;
  window.db   = db;

  // DOM elementlar
  const overlay        = document.getElementById('auth-overlay');
  const loginForm      = document.getElementById('auth-login-form');
  const loginIdInput   = document.getElementById('login-id');
  const loginPassInput = document.getElementById('login-password');
  const btnGoogle      = document.getElementById('btn-google-login');
  const btnAuto        = document.getElementById('btn-auto-register');
  const credBox        = document.getElementById('auth-generated-credentials');
  const txtUserInfo    = document.getElementById('auth-user-info');
  const btnLogout      = document.getElementById('btn-logout');

  // ID dan email yasash (faqat tizim ichida ishlatiladi)
  function makeEmailFromId(id) {
    return `${id}@imi1.local`;
  }

  // Tasodifiy 6 xonali ID
  function generateLoginId() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // 8 belgili parol
  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
  }

  // Firestore bo'yicha unikal ID topish
  async function ensureUniqueLoginId() {
    let id, exists = true;
    while (exists) {
      id = generateLoginId();
      const snap = await db.collection('users')
        .where('loginId', '==', id)
        .limit(1)
        .get();
      exists = !snap.empty;
    }
    return id;
  }

  // ID va Parolni ekranga chiqarish (foydalanuvchiga nusha olish uchun)
  function showCredentials(id, pass) {
    if (!credBox) return;
    credBox.style.display = 'block';
    credBox.innerHTML = `
      <div class="auth-cred-title">Sizning ID va Parolingiz</div>
      <div class="auth-cred-row"><span>ID:</span><code>${id}</code></div>
      <div class="auth-cred-row"><span>Parol:</span><code>${pass}</code></div>
      <div class="auth-cred-note">
        Ushbu ID va parolni yozib oling. Boshqa qurilmadan kirishda ham shu orqali tizimga kirasiz.
      </div>
    `;
  }

  // Auth holatini kuzatish
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Login bo'lgan
      if (overlay) overlay.style.display = 'none';
      document.body.classList.remove('no-scroll');

      if (txtUserInfo) {
        txtUserInfo.textContent = user.email || 'Tizimga kirdingiz';
      }

      // users/{uid} dan loginId ni olib user badge'ga yozamiz (agar bo'lsa)
      try {
        const snap = await db.collection('users').doc(user.uid).get();
        if (snap.exists) {
          const d = snap.data();
          if (d && d.loginId && txtUserInfo) {
            txtUserInfo.textContent = `ID: ${d.loginId}`;
          }
        }
      } catch (e) {
        console.warn('loginId o\'qishda xatolik:', e);
      }
    } else {
      // Logout holat
      if (overlay) overlay.style.display = 'flex';
      document.body.classList.add('no-scroll');

      if (txtUserInfo) {
        txtUserInfo.textContent = 'Anonim foydalanuvchi';
      }
    }
  });

  // ID + Parol bilan kirish
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id   = loginIdInput.value.trim();
      const pass = loginPassInput.value;
      if (!id || !pass) {
        alert('ID va Parolni kiriting.');
        return;
      }
      const email = makeEmailFromId(id);
      try {
        await auth.signInWithEmailAndPassword(email, pass);
        // muvaffaqiyatli bo'lsa overlay avtomatik yopiladi (onAuthStateChanged)
      } catch (err) {
        console.error(err);
        alert('Kirishda xatolik: ' + err.message);
      }
    });
  }

  // Google bilan kirish (ixtiyoriy)
  if (btnGoogle) {
    const provider = new firebase.auth.GoogleAuthProvider();
    btnGoogle.addEventListener('click', async () => {
      try {
        await auth.signInWithPopup(provider);
      } catch (err) {
        console.error(err);
        alert('Google bilan kirishda xatolik: ' + err.message);
      }
    });
  }

  // Avtomatik ID + Parol olish (yangi foydalanuvchi)
  if (btnAuto) {
    btnAuto.addEventListener('click', async () => {
      try {
        const id   = await ensureUniqueLoginId();
        const pass = generatePassword();
        const email = makeEmailFromId(id);

        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        const user = cred.user;

        await db.collection('users').doc(user.uid).set({
          loginId: id,
          points:  0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showCredentials(id, pass);
      } catch (err) {
        console.error(err);
        alert('Ro\'yxatdan o\'tishda xatolik: ' + err.message);
      }
    });
  }

  // Chiqish (logout) tugmasi
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await auth.signOut();
      } catch (err) {
        console.error(err);
        alert('Chiqishda xatolik: ' + err.message);
      }
    });
  }

})();

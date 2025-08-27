import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getDatabase, ref, set, get, update } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
    authDomain: "xplusy-760fa.firebaseapp.com",
    projectId: "xplusy-760fa",
    storageBucket: "xplusy-760fa.firebasestorage.app",
    messagingSenderId: "992512966017",
    appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
    measurementId: "G-459PLJ7P7L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Yangi foydalanuvchi ro'yxatdan o'tkazish
async function registerUser(email, password, username) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Foydalanuvchi profilini yangilash
        await updateProfile(user, {
            displayName: username
        });
        
        // Firebase Realtime Database-ga foydalanuvchi ma'lumotlarini saqlash
        const userCountRef = ref(database, 'userCount');
        const snapshot = await get(userCountRef);
        let userCount = snapshot.exists() ? snapshot.val() : 0;
        userCount++;
        
        await set(ref(database, 'users/' + user.uid), {
            username: username,
            email: email,
            userId: 100000 + userCount, // 100001, 100002, ...
            balance: 0,
            points: 0,
            registrationDate: new Date().toISOString()
        });
        
        await set(userCountRef, userCount);
        
        return { success: true, user: user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Foydalanuvchini tizimga kiritish
async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Foydalanuvchini chiqarish
async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Foydalanuvchi ma'lumotlarini yangilash (faqat yangilash tugmasi bosilganda)
async function refreshUserData(uid) {
    try {
        const userRef = ref(database, 'users/' + uid);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            return { success: true, data: snapshot.val() };
        } else {
            return { success: false, error: "Foydalanuvchi ma'lumotlari topilmadi" };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Balans yoki ballarni yangilash
async function updateUserStats(uid, updates) {
    try {
        const userRef = ref(database, 'users/' + uid);
        await update(userRef, updates);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export { auth, database, registerUser, loginUser, logoutUser, refreshUserData, updateUserStats, onAuthStateChanged };
 const assistiveTouch = document.getElementById('assistiveTouch');
  const assistiveMenu = document.getElementById('assistiveMenu');
  const closeMenuBtn = document.getElementById('closeMenu');
  const themeToggle = document.getElementById('themeToggle');
  const menuThemeToggle = document.getElementById('menuThemeToggle');
  const loginBtn = document.getElementById('loginBtn');
  const authModal = document.getElementById('authModal');
  const closeModalBtn = document.getElementById('closeModal');
  const userInfoBox = document.getElementById('userInfoBox');
  const welcomeMsg = document.getElementById('welcomeMsg');
  const userName = document.getElementById('userName');
  const balanceAmount = document.getElementById('balanceAmount');
  const creditAmount = document.getElementById('creditAmount');
  const userId = document.getElementById('userId');
  const refreshBalance = document.getElementById('refreshBalance');
  const userProfileModal = document.getElementById('userProfileModal');
  const closeProfileModal = document.getElementById('closeProfileModal');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileId = document.getElementById('profileId');
  const profileBalance = document.getElementById('profileBalance');
  const profileCredits = document.getElementById('profileCredits');
  const profilePhone = document.getElementById('profilePhone');
  const editNameBtn = document.getElementById('editName');
  const nameEditForm = document.getElementById('nameEditForm');
  const newNameInput = document.getElementById('newNameInput');
  const saveNameBtn = document.getElementById('saveNameBtn');
  const cancelNameBtn = document.getElementById('cancelNameBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const registerModal = document.getElementById('registerModal');
  const closeRegisterModal = document.getElementById('closeRegisterModal');
  const showRegister = document.getElementById('showRegister');
  const showLogin = document.getElementById('showLogin');
  const emailLoginForm = document.getElementById('emailLoginForm');
  const emailRegisterForm = document.getElementById('emailRegisterForm');
  const googleLoginBtn = document.getElementById('googleLogin');
  const telegramLoginBtn = document.getElementById('telegramLogin');

  // Modal ochish/yopish
  function openModal(modal) {
    modal.classList.add('force-open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(modal) {
    modal.classList.remove('force-open');
    document.body.style.overflow = 'auto';
  }

  // Assistive menyu
  assistiveTouch.addEventListener('click', () => {
    assistiveMenu.classList.toggle('show');
    assistiveTouch.classList.toggle('active');
  });
  closeMenuBtn.addEventListener('click', () => {
    assistiveMenu.classList.remove('show');
    assistiveTouch.classList.remove('active');
  });

  // Tema almashish
  function toggleTheme() {
    const body = document.body;
    if (body.classList.contains('dark')) {
      body.classList.remove('dark');
      body.classList.add('light');
      localStorage.setItem('theme', 'light');
      menuThemeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      body.classList.remove('light');
      body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      menuThemeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }
  themeToggle.addEventListener('click', toggleTheme);
  menuThemeToggle.addEventListener('click', toggleTheme);

  // Sahifa yuklanganda tema
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    menuThemeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }

  // Auth modal
  loginBtn.addEventListener('click', () => openModal(authModal));
  closeModalBtn.addEventListener('click', () => closeModal(authModal));

  // Register modal
  showRegister.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(authModal);
    openModal(registerModal);
  });
  showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal(registerModal);
    openModal(authModal);
  });
  closeRegisterModal.addEventListener('click', () => closeModal(registerModal));

  // Profil modal
  welcomeMsg.addEventListener('click', () => openModal(userProfileModal));
  closeProfileModal.addEventListener('click', () => closeModal(userProfileModal));

  // Ismni tahrirlash
  editNameBtn.addEventListener('click', () => {
    nameEditForm.style.display = 'block';
    newNameInput.value = profileName.textContent;
  });
  cancelNameBtn.addEventListener('click', () => {
    nameEditForm.style.display = 'none';
  });
  saveNameBtn.addEventListener('click', () => {
    const newName = newNameInput.value.trim();
    if (newName) {
      profileName.textContent = newName;
      userName.textContent = newName;
      nameEditForm.style.display = 'none';

      const user = auth.currentUser;
      if (user) {
        db.collection('users').doc(user.uid).update({ name: newName })
          .catch((error) => console.error("Ismni yangilashda xatolik:", error));
      }
    }
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
      closeModal(userProfileModal);
      userInfoBox.style.display = 'none';
      loginBtn.style.display = 'block';
    });
  });

  // Balansni yangilash
  refreshBalance.addEventListener('click', () => {
    const user = auth.currentUser;
    if (user) {
      db.collection('users').doc(user.uid).get()
        .then((doc) => {
          if (doc.exists) {
            const userData = doc.data();
            balanceAmount.textContent = userData.balance || 0;
            creditAmount.textContent = userData.credits || 0;
          }
        });
    }
  });

  // Email login
  emailLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    auth.signInWithEmailAndPassword(email, password)
      .then(() => closeModal(authModal))
      .catch((error) => alert('Xatolik: ' + error.message));
  });

  // Email register
  emailRegisterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        return db.collection('users').orderBy('userId', 'desc').limit(1).get()
          .then((querySnapshot) => {
            let newUserId = 100001;
            if (!querySnapshot.empty) {
              const lastUserId = querySnapshot.docs[0].data().userId;
              newUserId = lastUserId + 1;
            }
            return db.collection('users').doc(userCredential.user.uid).set({
              name, email,
              balance: 0, credits: 0,
              userId: newUserId,
              createdAt: new Date()
            });
          });
      })
      .then(() => closeModal(registerModal))
      .catch((error) => alert('Xatolik: ' + error.message));
  });

  // Google login
  function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    auth.signInWithPopup(provider)
      .then(() => closeModal(authModal))
      .catch((error) => alert('Google orqali kirishda xatolik: ' + error.message));
  }
  googleLoginBtn.addEventListener('click', signInWithGoogle);

  // Auth kuzatish
  auth.onAuthStateChanged((user) => {
    if (user) {
      loginBtn.style.display = 'none';
      userInfoBox.style.display = 'flex';
      const userRef = db.collection('users').doc(user.uid);
      userRef.get().then((doc) => {
        if (doc.exists) {
          updateUIWithUserData(user, doc.data());
        } else {
          db.collection('users').orderBy('userId', 'desc').limit(1).get()
            .then((querySnapshot) => {
              let newUserId = 100001;
              if (!querySnapshot.empty) {
                const lastUserId = querySnapshot.docs[0].data().userId;
                newUserId = lastUserId + 1;
              }
              const userData = {
                name: user.displayName || "Foydalanuvchi",
                email: user.email || "",
                phone: user.phoneNumber || "",
                balance: 0, credits: 0,
                userId: newUserId,
                createdAt: new Date()
              };
              return userRef.set(userData);
            })
            .then(() => userRef.get())
            .then((doc) => {
              if (doc.exists) updateUIWithUserData(user, doc.data());
            });
        }
      });
    } else {
      loginBtn.style.display = 'block';
      userInfoBox.style.display = 'none';
    }
  });

  // UI update
  function updateUIWithUserData(user, userData) {
    userName.textContent = userData.name;
    balanceAmount.textContent = userData.balance || 0;
    creditAmount.textContent = userData.credits || 0;
    userId.textContent = userData.userId;

    profileName.textContent = userData.name;
    profileEmail.textContent = user.email || "";
    profileId.textContent = userData.userId;
    profileBalance.textContent = userData.balance || 0;
    profileCredits.textContent = userData.credits || 0;
    profilePhone.textContent = userData.phone || "N/A";
  }

  // Sahifa navigatsiya
  function navigateToPage(page) {
    const mainContent = document.getElementById('main-content');
    const targetContent = document.getElementById(`${page}-content`);
    if (targetContent) {
      mainContent.classList.add('content-hidden');
      setTimeout(() => {
        mainContent.classList.remove('content-visible');
        targetContent.classList.add('content-visible');
        targetContent.classList.remove('content-hidden');
        assistiveMenu.classList.remove('show');
        assistiveTouch.classList.remove('active');
      }, 300);
    }
  }

  function showLoginModal() {
    openModal(authModal);
  }

  document.querySelectorAll('.require-login').forEach(link => {
    link.addEventListener('click', function(e) {
      if (!auth.currentUser) {
        e.preventDefault();
        showLoginModal();
      }
    });
  });

  // Modal tashqarisiga bosilganda yopish
  [authModal, userProfileModal, registerModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
 const firebaseConfig = {
      apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
      authDomain: "xplusy-760fa.firebaseapp.com",
      projectId: "xplusy-760fa",
      storageBucket: "xplusy-760fa.firebasestorage.app",
      messagingSenderId: "992512966017",
      appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
      measurementId: "G-459PLJ7P7L"
    };
    
    // Firebase ni ishga tushirish
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

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
    
    // Modalni ochish va yopish funksiyalari
    function openModal(modal) {
      modal.classList.add('force-open');
      document.body.style.overflow = 'hidden';
    }
    
    function closeModal(modal) {
      modal.classList.remove('force-open');
      document.body.style.overflow = 'auto';
    }
	 // Auth modal
    loginBtn.addEventListener('click', () => openModal(authModal));
    closeModalBtn.addEventListener('click', () => closeModal(authModal));
    
    // Ro'yxatdan o'tish modali
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
    
    // Foydalanuvchi profili
    welcomeMsg.addEventListener('click', () => openModal(userProfileModal));
    closeProfileModal.addEventListener('click', () => closeModal(userProfileModal));
    
    // Ism tahrirlash
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
        
        // Firebaseda yangi ismni saqlash
        const user = auth.currentUser;
        if (user) {
          db.collection('users').doc(user.uid).update({
            name: newName
          }).catch((error) => {
            console.error("Ismni yangilashda xatolik:", error);
          });
        }
      }
    });
    
    // Chiqish
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
          })
          .catch((error) => {
            console.error("Balansni yangilashda xatolik:", error);
          });
      }
    });
    
    // Email orqali kirish
    emailLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      
      auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          closeModal(authModal);
        })
        .catch((error) => {
          alert('Xatolik: ' + error.message);
        });
    });
    
    // Email orqali ro'yxatdan o'tish
    emailRegisterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      
      auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
          // Tartibli ID ni topish
          return db.collection('users').orderBy('userId', 'desc').limit(1).get()
            .then((querySnapshot) => {
              let newUserId = 100001;
              
              if (!querySnapshot.empty) {
                const lastUserId = querySnapshot.docs[0].data().userId;
                newUserId = lastUserId + 1;
              }
              
              // Foydalanuvchi ma'lumotlarini saqlash
              return db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                balance: 0,
                credits: 0,
                userId: newUserId,
                createdAt: new Date()
              });
            });
        })
        .then(() => {
          closeModal(registerModal);
        })
        .catch((error) => {
          alert('Xatolik: ' + error.message);
        });
    });
    
    // Google orqali kirish
    googleLoginBtn.addEventListener('click', () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider)
        .then((result) => {
          closeModal(authModal);
        })
        .catch((error) => {
          alert('Xatolik: ' + error.message);
        });
    });
    
    // Auth holatini kuzatish
    auth.onAuthStateChanged((user) => {
      if (user) {
        // Foydalanuvchi kirdi
        loginBtn.style.display = 'none';
        userInfoBox.style.display = 'flex';
        
        // Firebasedan foydalanuvchi ma'lumotlarini olish yoki yangi yaratish
        const userRef = db.collection('users').doc(user.uid);
        
        userRef.get().then((doc) => {
          if (doc.exists) {
            // Foydalanuvchi allaqachon mavjud
            const userData = doc.data();
            updateUIWithUserData(user, userData);
          } else {
            // Yangi foydalanuvchi - tartibli ID yaratish
            db.collection('users').orderBy('userId', 'desc').limit(1).get()
              .then((querySnapshot) => {
                let newUserId = 100001; // Boshlang'ich qiymat
                
                if (!querySnapshot.empty) {
                  // Oxirgi foydalanuvchi ID sini olish
                  const lastUserId = querySnapshot.docs[0].data().userId;
                  newUserId = lastUserId + 1;
                }
                
                // Yangi foydalanuvchi ma'lumotlarini yaratish
                const userData = {
  name: user.displayName || "Foydalanuvchi",
  email: user.email || "",
  phone: user.phoneNumber || "",   // <-- Telefon raqam qo‘shildi
  balance: 0,
  credits: 0,
  userId: newUserId,
  createdAt: new Date()
};

                
                // Firestore'ga yozish
                return userRef.set(userData);
              })
              .then(() => {
                // UI ni yangilash
                return userRef.get();
              })
              .then((doc) => {
                if (doc.exists) {
                  updateUIWithUserData(user, doc.data());
                }
              })
              .catch((error) => {
                console.error("Xatolik yangi foydalanuvchi yaratishda:", error);
              });
          }
        });
      } else {
        // Foydalanuvchi chiqdi
        loginBtn.style.display = 'block';
        userInfoBox.style.display = 'none';
      }
    });

    // UI ni yangilash funksiyasi
function updateUIWithUserData(user, userData) {
  userName.textContent = userData.name;
  balanceAmount.textContent = userData.balance || 0;
  creditAmount.textContent = userData.credits || 0;
  userId.textContent = userData.userId; // Endi tartibli ID ko'rsatiladi
  
  // Profil modaliga ham ma'lumotlarni yuklash
  profileName.textContent = userData.name;
  profileEmail.textContent = user.email || "";
  profileId.textContent = userData.userId; // Tartibli ID
  profileBalance.textContent = userData.balance || 0;
  profileCredits.textContent = userData.credits || 0;
  profilePhone.textContent = userData.phone || "N/A"; // Telefon raqam
}

    
    // Sahifa navigatsiyasi
    function navigateToPage(page) {
      const mainContent = document.getElementById('main-content');
      const targetContent = document.getElementById(`${page}-content`);
      
      if (targetContent) {
        // Kontentni yuklash animatsiyasi
        mainContent.classList.add('content-hidden');
        
        setTimeout(() => {
          mainContent.classList.remove('content-visible');
          targetContent.classList.add('content-visible');
          targetContent.classList.remove('content-hidden');
          
          // Assistive menyuni yopish
          assistiveMenu.classList.remove('show');
          assistiveTouch.classList.remove('active');
        }, 300);
      }
    }
    
    // Modal oynani ochish uchun funksiya
    function showLoginModal() {
      openModal(authModal);
    }
    
    // Foydalanuvchi sahifaga bossa modal oynani ochish
    document.querySelectorAll('.require-login').forEach(link => {
      link.addEventListener('click', function(e) {
        if (!auth.currentUser) {
          e.preventDefault();
          showLoginModal();
        }
      });
    });
    
    // Modal o'ziga bosganda yopilmasligi uchun
    authModal.addEventListener('click', function(e) {
      if (e.target === authModal) {
        closeModal(authModal);
      }
    });
    
    userProfileModal.addEventListener('click', function(e) {
      if (e.target === userProfileModal) {
        closeModal(userProfileModal);
      }
    });
    
    registerModal.addEventListener('click', function(e) {
      if (e.target === registerModal) {
        closeModal(registerModal);
      }
    });
  // Google avtorizatsiyasi uchun yangi funksiya
  function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    auth.signInWithPopup(provider)
      .then((result) => {
        // Kirish muvaffaqiyatli
        console.log('Google orqali kirish muvaffaqiyatli:', result.user);
        closeModal(authModal);
      })
      .catch((error) => {
        console.error('Google orqali kirishda xatolik:', error);
        alert('Google orqali kirishda xatolik: ' + error.message);
      });
  }

  // Google login tugmasiga bog'lash
  document.getElementById('googleLogin').addEventListener('click', signInWithGoogle);

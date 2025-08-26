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

  // ================= FIREBASE AUTH FUNCTIONS =================

  // Google orqali autentifikatsiya
  function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
      .then((result) => {
        // Kirish muvaffaqiyatli
        console.log("Google orqali kirish muvaffaqiyatli:", result.user);
        updateUserUI(result.user);
      })
      .catch((error) => {
        console.error("Google orqali kirishda xatolik:", error);
        alert("Kirishda xatolik yuz berdi: " + error.message);
      });
  }

  // Telegram orqali autentifikatsiya (namuna)
  function loginWithTelegram() {
    alert("Telegram orqali kirish hozircha ishlamaydi. Iltimos, boshqa usulni tanlang.");
  }

  // Email/parol orqali kirish
  document.getElementById('emailLoginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelector('input[type="password"]').value;
    
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        // Kirish muvaffaqiyatli
        console.log("Email orqali kirish muvaffaqiyatli:", userCredential.user);
        updateUserUI(userCredential.user);
      })
      .catch((error) => {
        console.error("Email orqali kirishda xatolik:", error);
        alert("Kirishda xatolik yuz berdi: " + error.message);
      });
  });

  // Ro'yxatdan o'tish funksiyalari
  function registerWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
      .then((result) => {
        // Ro'yxatdan o'tish muvaffaqiyatli
        console.log("Google orqali ro'yxatdan o'tish muvaffaqiyatli:", result.user);
        updateUserUI(result.user);
      })
      .catch((error) => {
        console.error("Google orqali ro'yxatdan o'tishda xatolik:", error);
        alert("Ro'yxatdan o'tishda xatolik yuz berdi: " + error.message);
      });
  }

  function registerWithTelegram() {
    alert("Telegram orqali ro'yxatdan o'tish hozircha ishlamaydi. Iltimos, boshqa usulni tanlang.");
  }

  document.getElementById('emailRegisterForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = this.querySelector('input[type="text"]').value;
    const email = this.querySelector('input[type="email"]').value;
    const password = this.querySelector('input[type="password"]').value;
    
    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        // Ro'yxatdan o'tish muvaffaqiyatli
        console.log("Email orqali ro'yxatdan o'tish muvaffaqiyatli:", userCredential.user);
        
        // Foydalanuvchi ma'lumotlarini yangilash
        return userCredential.user.updateProfile({
          displayName: name
        }).then(() => {
          updateUserUI(userCredential.user);
        });
      })
      .catch((error) => {
        console.error("Email orqali ro'yxatdan o'tishda xatolik:", error);
        alert("Ro'yxatdan o'tishda xatolik yuz berdi: " + error.message);
      });
  });

  // Foydalanuvchi chiqishi
  document.getElementById('logoutBtn').addEventListener('click', function() {
    firebase.auth().signOut().then(() => {
      console.log("Foydalanuvchi chiqdi");
      // UI ni yangilash
      document.getElementById('loginBtn').style.display = 'block';
      document.getElementById('userInfoBox').style.display = 'none';
      document.getElementById('userDetails').style.display = 'none';
      document.getElementById('loginTab').style.display = 'block';
      document.getElementById('registerTab').style.display = 'none';
      document.querySelector('.auth-tabs').style.display = 'flex';
    }).catch((error) => {
      console.error("Chiqishda xatolik:", error);
    });
  });

  // Foydalanuvchi ma'lumotlarini yangilash
  function updateUserUI(user) {
    if (user) {
      // Foydalanuvchi nomini yangilash
      const displayName = user.displayName || user.email.split('@')[0];
      document.getElementById('userName').textContent = displayName;
      document.getElementById('modalUserName').textContent = displayName;
      
      // Foydalanuvchi ID sini to'liq ko'rsatish
      document.getElementById('userId').textContent = user.uid;
      document.getElementById('modalUserId').textContent = user.uid;
      
      // UI elementlarini yangilash
      document.getElementById('loginBtn').style.display = 'none';
      document.getElementById('userInfoBox').style.display = 'flex';
      document.getElementById('userDetails').style.display = 'block';
      document.getElementById('loginTab').style.display = 'none';
      document.getElementById('registerTab').style.display = 'none';
      document.querySelector('.auth-tabs').style.display = 'none';
      
      // Modalni yopish
      document.getElementById('authModal').style.display = 'none';
      
      // Foydalanuvchi ma'lumotlarini Firestore'dan olish
      getUserData(user.uid);
    }
  }

  // Firestore'dan foydalanuvchi ma'lumotlarini olish
  function getUserData(userId) {
  const userRef = db.collection('users').doc(userId);
  
  userRef.get().then((doc) => {
    if (doc.exists) {
      const userData = doc.data();
      // Balans va ballarni yangilash
      document.getElementById('balanceAmount').textContent = userData.balance || 0;
      document.getElementById('creditAmount').textContent = userData.credits || 0;
      document.getElementById('modalBalanceAmount').textContent = userData.balance || 0;
      document.getElementById('modalCreditAmount').textContent = userData.credits || 0;

      // 🔥 Custom ID ni ko‘rsatish
      if (userData.id) {
        document.getElementById('userId').textContent = userData.id;
        document.getElementById('modalUserId').textContent = userData.id;
      } else {
        // agar `id` bo‘lmasa, fallback sifatida uid ko‘rsatish
        document.getElementById('userId').textContent = userId;
        document.getElementById('modalUserId').textContent = userId;
      }
    } else {
      // Yangi foydalanuvchi yaratish
      createUserData(userId);
    }
  }).catch((error) => {
    console.error("Foydalanuvchi ma'lumotlarini olishda xatolik:", error);
  });
}


  // Yangi foydalanuvchi yaratish
  function createUserData(userId) {
    const user = firebase.auth().currentUser;
    const displayName = user.displayName || user.email.split('@')[0];
    
    db.collection('users').doc(userId).set({
      name: displayName,
      email: user.email,
      balance: 0,
      credits: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      console.log("Yangi foydalanuvchi yaratildi");
      // UI ni yangilash
      document.getElementById('balanceAmount').textContent = 0;
      document.getElementById('creditAmount').textContent = 0;
      document.getElementById('modalBalanceAmount').textContent = 0;
      document.getElementById('modalCreditAmount').textContent = 0;
    }).catch((error) => {
      console.error("Foydalanuvchi yaratishda xatolik:", error);
    });
  }

  // Ismni tahrirlash
  document.getElementById('editNameBtn').addEventListener('click', function() {
    document.getElementById('nameEditForm').style.display = 'block';
  });

  document.getElementById('cancelEditBtn').addEventListener('click', function() {
    document.getElementById('nameEditForm').style.display = 'none';
  });

  document.getElementById('saveNameBtn').addEventListener('click', function() {
    const newName = document.getElementById('nameInput').value.trim();
    if (newName) {
      const user = firebase.auth().currentUser;
      
      // Firebase Auth'dagi ismni yangilash
      user.updateProfile({
        displayName: newName
      }).then(() => {
        // Firestore'dagi ismni yangilash
        db.collection('users').doc(user.uid).update({
          name: newName
        }).then(() => {
          // UI ni yangilash
          document.getElementById('userName').textContent = newName;
          document.getElementById('modalUserName').textContent = newName;
          document.getElementById('nameEditForm').style.display = 'none';
          alert("Ism muvaffaqiyatli yangilandi!");
        }).catch((error) => {
          console.error("Firestore'dagi ismni yangilashda xatolik:", error);
        });
      }).catch((error) => {
        console.error("Auth'dagi ismni yangilashda xatolik:", error);
        alert("Ismni yangilashda xatolik: " + error.message);
      });
    } else {
      alert("Iltimos, yangi ism kiriting");
    }
  });

  // Balansni yangilash
  document.getElementById('refreshBalance').addEventListener('click', function() {
    const user = firebase.auth().currentUser;
    if (user) {
      getUserData(user.uid);
      this.classList.add('rotating');
      setTimeout(() => {
        this.classList.remove('rotating');
      }, 1000);
    }
  });

  // Foydalanuvchi nomiga bosganda modalni ochish
  document.getElementById('welcomeMsg').addEventListener('click', function() {
    document.getElementById('authModal').style.display = 'flex';
  });

  // Auth holatini kuzatish
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // Foydalanuvchi kirgan
      updateUserUI(user);
    } else {
      // Foydalanuvchi chiqib ketgan
      document.getElementById('loginBtn').style.display = 'block';
      document.getElementById('userInfoBox').style.display = 'none';
    }
  });

  // Modalni ochish
  document.getElementById('loginBtn').addEventListener('click', function() {
    document.getElementById('authModal').style.display = 'flex';
  });

  // Modalni yopish
  document.querySelector('.close-modal').addEventListener('click', function() {
    document.getElementById('authModal').style.display = 'none';
  });

  // Tab'larni boshqarish
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', function() {
      const tab = this.getAttribute('data-tab');
      
      // Barcha tab'larni yashirish
      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      
      // Faqat tanlangan tab'ni ko'rsatish
      document.getElementById(tab + 'Tab').style.display = 'block';
      
      // Barcha tab tugmalaridan active klassini olib tashlash
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Faqat bosilgan tugmaga active klassini qo'shish
      this.classList.add('active');
    });
  });

  // Tashqariga bosganda modal yopilishi
  window.addEventListener('click', function(event) {
    if (event.target == document.getElementById('authModal')) {
      document.getElementById('authModal').style.display = 'none';
    }
  });
// ================= THEME TOGGLE FUNCTIONALITY =================
function initializeTheme() {
  const themeToggleBtn = document.getElementById('themeToggle');
  const menuThemeToggleBtn = document.getElementById('menuThemeToggle');
  const body = document.body;
  
  // LocalStorage'dan saqlangan temani olish
  const savedTheme = localStorage.getItem('theme');
  
  // Agar saqlangan tema bo'lsa, uni qo'llash
  if (savedTheme) {
    body.className = savedTheme;
    updateThemeIcon(savedTheme);
  }
  
  // Tema tugmasi bosilganda
  function toggleTheme() {
    if (body.classList.contains('dark')) {
      body.classList.remove('dark');
      body.classList.add('light');
      localStorage.setItem('theme', 'light');
      updateThemeIcon('light');
    } else {
      body.classList.remove('light');
      body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      updateThemeIcon('dark');
    }
  }
  
  // Tema ikonkasini yangilash
  function updateThemeIcon(theme) {
    const icon = theme === 'dark' ? 
      '<path d="M12 18c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6zm0-10c-2.206 0-4 1.794-4 4s1.794 4 4 4 4-1.794 4-4-1.794-4-4-4z"/>' : 
      '<path d="M21.64 13a9 9 0 01-10.63-10.63 1 1 0 00-1.27-1.27A11 11 0 1022.91 14.9a1 1 0 00-1.27-1.27z"/>';
    
    // Asosiy tema tugmasi
    themeToggleBtn.querySelector('svg').innerHTML = icon;
    
    // Menyu ichidagi tema tugmasi
    const menuIcon = theme === 'dark' ? 'fa-sun' : 'fa-moon';
    menuThemeToggleBtn.innerHTML = `<i class="fas ${menuIcon}"></i>`;
  }
  
  // Tugmalarga hodisa qo'shish
  themeToggleBtn.addEventListener('click', toggleTheme);
  menuThemeToggleBtn.addEventListener('click', toggleTheme);
}

// ================= ASSISTIVE MENU FUNCTIONALITY =================
function initializeAssistiveMenu() {
  const mathMenuBtn = document.getElementById('mathMenuBtn');
  const mathMenu = document.getElementById('mathMenu');
  const closeMenuBtn = document.getElementById('closeMenu');
  
  // Menyuni ochish
  mathMenuBtn.addEventListener('click', function() {
    mathMenu.style.display = 'flex';
  });
  
  // Menyuni yopish
  closeMenuBtn.addEventListener('click', function() {
    mathMenu.style.display = 'none';
  });
  
  // Tashqariga bosilganda menyuni yopish
  document.addEventListener('click', function(event) {
    if (!mathMenu.contains(event.target) && event.target !== mathMenuBtn) {
      mathMenu.style.display = 'none';
    }
  });
}

// ================= DOCUMENT READY =================
document.addEventListener('DOMContentLoaded', function() {
  initializeTheme();
  initializeAssistiveMenu();
  
  // Yilni yangilash
  document.getElementById('year').textContent = new Date().getFullYear();
});
    // ================= AUTH REQUIREMENT FUNCTIONALITY =================
    let authRequired = true; // Kirish talab qilinadimi?

    // Foydalanuvchi kirish qilganligini tekshirish
    function checkAuthState() {
      const user = firebase.auth().currentUser;
      
      if (!user && authRequired) {
        // Agar foydalanuvchi kirish qilmagan bo'lsa
        document.body.classList.add('auth-required');
        document.getElementById('authModal').classList.add('force-open');
      } else {
        // Agar foydalanuvchi kirish qilgan bo'lsa
        document.body.classList.remove('auth-required');
        document.getElementById('authModal').classList.remove('force-open');
      }
    }

    // Auth holatini kuzatish
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        // Foydalanuvchi kirgan
        updateUserUI(user);
        checkAuthState();
      } else {
        // Foydalanuvchi chiqib ketgan
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('userInfoBox').style.display = 'none';
        checkAuthState();
      }
    });

    // Sayt yuklanganda auth holatini tekshirish
    document.addEventListener('DOMContentLoaded', function() {
      checkAuthState();
      
      // Kirish talab qilinadigan elementlarga hodisa qo'shish
      document.querySelectorAll('.require-login').forEach(element => {
        element.addEventListener('click', function(e) {
          if (!firebase.auth().currentUser) {
            e.preventDefault();
            document.getElementById('authModal').classList.add('force-open');
            alert("Iltimos, avval tizimga kiring!");
          }
        });
      });
    });

    // Modalni yopish funksiyasini yangilash
    document.querySelector('.close-modal').addEventListener('click', function() {
      // Faqat kirish qilgan foydalanuvchilar modalni yopishi mumkin
      if (firebase.auth().currentUser) {
        document.getElementById('authModal').classList.remove('force-open');
      } else {
        // Kirish qilmagan foydalanuvchi modalni yopolmasligi kerak
        alert("Iltimos, saytdan foydalanish uchun tizimga kiring!");
      }
    });

    // Tashqariga bosganda modal yopilishi (faqat kirish qilganlar uchun)
    window.addEventListener('click', function(event) {
      if (event.target == document.getElementById('authModal')) {
        if (firebase.auth().currentUser) {
          document.getElementById('authModal').classList.remove('force-open');
        } else {
          alert("Iltimos, saytdan foydalanish uchun tizimga kiring!");
        }
      }
    });
  // Balans qo'shish tugmasi uchun funksiya
  document.getElementById('addBalanceBtn').addEventListener('click', function() {
    // Yangi oyna ochish yoki balansplus.html ga yo'naltirish
    window.open('balansplus.html', '_blank');
    // Yoki: window.location.href = 'balansplus.html';
  });
  
  // Headerdagi balans uchun ham xuddi shunday funksiya
  document.querySelector('.user-balance').addEventListener('click', function() {
    window.open('balansplus.html', '_blank');
  });
  // ================= ASSISTIVE MENU FUNCTIONALITY =================
  document.addEventListener('DOMContentLoaded', function() {
    const mathMenuBtn = document.getElementById('mathMenuBtn');
    const mathMenu = document.getElementById('mathMenu');
    const closeMenuBtn = document.getElementById('closeMenu');
    
    // Menyuni ochish
    if (mathMenuBtn && mathMenu) {
      mathMenuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        mathMenu.classList.toggle('show');
        mathMenuBtn.classList.toggle('active');
      });
    }
    
    // Menyuni yopish
    if (closeMenuBtn) {
      closeMenuBtn.addEventListener('click', function() {
        mathMenu.classList.remove('show');
        mathMenuBtn.classList.remove('active');
      });
    }
    
    // Tashqariga bosilganda menyuni yopish
    document.addEventListener('click', function(event) {
      if (mathMenu && mathMenu.classList.contains('show') && 
          !mathMenu.contains(event.target) && 
          event.target !== mathMenuBtn) {
        mathMenu.classList.remove('show');
        mathMenuBtn.classList.remove('active');
      }
    });
    
    // Menyu ichidagi linklarga bosilganda menyuni yopish
    const menuItems = mathMenu.querySelectorAll('.math-menu-item');
    menuItems.forEach(item => {
      if (item.id !== 'closeMenu') {
        item.addEventListener('click', function() {
          mathMenu.classList.remove('show');
          mathMenuBtn.classList.remove('active');
        });
      }
    });
  });
  // ================= THEME MANAGEMENT =================
const root = document.documentElement;
const themeMeta = document.getElementById('theme-color-meta');
const themeToggleBtn = document.getElementById('themeToggle');

/**
 * Apply theme to the website
 * @param {string} mode - 'dark' or 'light'
 */
function applyTheme(mode) {
    if (mode === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
        themeMeta.setAttribute('content', '#f7f9fc');
        localStorage.setItem('theme', 'light');
    } else {
        root.classList.add('dark');
        root.classList.remove('light');
        themeMeta.setAttribute('content', '#0b1220');
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcon(mode);
}

/**
 * Update theme toggle icon based on current theme
 * @param {string} theme - Current theme
 */
function updateThemeIcon(theme) {
    const icon = theme === 'dark' ? 
        '<path d="M12 18c-3.309 0-6-2.691-6-6s2.691-6 6-6 6 2.691 6 6-2.691 6-6 6zm0-10c-2.206 0-4 1.794-4 4s1.794 4 4 4 4-1.794 4-4-1.794-4-4-4z"/>' : 
        '<path d="M21.64 13a9 9 0 01-10.63-10.63 1 1 0 00-1.27-1.27A11 11 0 1022.91 14.9a1 1 0 00-1.27-1.27z"/>';
    
    if (themeToggleBtn.querySelector('svg')) {
        themeToggleBtn.querySelector('svg').innerHTML = icon;
    }
}

// Initialize theme from localStorage or default to dark
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    applyTheme(savedTheme || 'dark');
}

// ================= MOBILE MENU =================
function initMobileMenu() {
    const menuBtn = document.querySelector('.menu-toggle');
    const menu = document.getElementById('site-menu');
    
    if (menuBtn && menu) {
        menuBtn.addEventListener('click', () => {
            const isOpen = menu.classList.toggle('open');
            menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }
}

// ================= "SHOW MORE" BUTTONS =================
function initShowMoreButtons() {
    document.querySelectorAll('[data-more]').forEach(btn => {
        const gridSel = btn.getAttribute('data-more');
        const grid = document.querySelector(gridSel);
        let expanded = false;
        
        btn.addEventListener('click', () => {
            expanded = !expanded;
            grid.dataset.expanded = expanded;
            btn.textContent = expanded ? "Kamroq" : "Ko'proq";
        });
    });
}

// ================= CAROUSEL FUNCTIONALITY =================
function initCarousel() {
    const track = document.getElementById("carouselTrack");
    if (!track) return;
    
    const slides = Array.from(track.children);
    const prevBtn = document.querySelector(".carousel-btn.prev");
    const nextBtn = document.querySelector(".carousel-btn.next");
    
    let currentIndex = 0;
    let autoInterval;

    function updateCarousel() {
        const slideWidth = slides[0].getBoundingClientRect().width;
        track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
    }

    function goToSlide(index) {
        currentIndex = (index + slides.length) % slides.length;
        updateCarousel();
    }

    function nextSlide() {
        goToSlide(currentIndex + 1);
    }

    function prevSlide() {
        goToSlide(currentIndex - 1);
    }

    function startAutoPlay() {
        stopAutoPlay();
        autoInterval = setInterval(nextSlide, 4000);
    }

    function stopAutoPlay() {
        if (autoInterval) {
            clearInterval(autoInterval);
        }
    }

    // Event listeners
    if (prevBtn) prevBtn.addEventListener("click", prevSlide);
    if (nextBtn) nextBtn.addEventListener("click", nextSlide);

    // Pause autoplay on hover
    track.addEventListener('mouseenter', stopAutoPlay);
    track.addEventListener('mouseleave', startAutoPlay);

    // Accessibility: pause on focus
    track.addEventListener('focusin', stopAutoPlay);
    track.addEventListener('focusout', startAutoPlay);

    // Initialize
    updateCarousel();
    startAutoPlay();
}

// ================= 3D EFFECTS =================
function init3DEffects() {
    // Only apply 3D effects on devices that support hover
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    // Cards 3D effect
    document.querySelectorAll(".card").forEach(card => {
        card.addEventListener("mousemove", e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * 8;
            const rotateY = ((x - centerX) / centerX) * -8;

            card.style.transform = 
                `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
        });

        card.addEventListener("mouseleave", () => {
            card.style.transform = 
                "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
        });
    });

    // Logo 3D effects
    function addLogo3DEffect(selector) {
        const logo = document.querySelector(selector);
        if (!logo) return;

        logo.addEventListener("mousemove", e => {
            const rect = logo.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * 10;
            const rotateY = ((x - centerX) / centerX) * -10;

            logo.style.transform = 
                `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.1)`;
        });

        logo.addEventListener("mouseleave", () => {
            logo.style.transform = 
                "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)";
        });
    }

    addLogo3DEffect(".header-logo");
    addLogo3DEffect(".footer-logo");
}

// ================= BOUNCE ANIMATION =================
function initBounceAnimations() {
    function addLogoBounce(selector) {
        const logo = document.querySelector(selector);
        if (!logo) return;

        logo.addEventListener("click", () => {
            logo.classList.add("logo-bounce");
            
            // Remove the class after animation completes
            const handleAnimationEnd = () => {
                logo.classList.remove("logo-bounce");
                logo.removeEventListener("animationend", handleAnimationEnd);
            };
            
            logo.addEventListener("animationend", handleAnimationEnd, { once: true });
        });
    }

    addLogoBounce(".header-logo");
    addLogoBounce(".footer-logo");
}

// ================= LOAD ADS =================
async function loadAds() {
    const track = document.querySelector('.carousel-track');
    if (!track) return;

    try {
        const res = await fetch('ads.html', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const html = await res.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const adItems = tempDiv.querySelectorAll('.ad-item');
        if (!adItems.length) {
            track.innerHTML = `<div class="slide"><div class="muted" style="padding:1.5rem">Hech qanday reklama topilmadi</div></div>`;
            return;
        }

        // Clear existing content and add new ads
        track.innerHTML = '';
        adItems.forEach(ad => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.appendChild(ad.cloneNode(true));
            track.appendChild(slide);
        });

        // Reinitialize carousel with new ads
        initCarousel();
    } catch (error) {
        console.error('Reklamalarni yuklashda xatolik:', error);
        track.innerHTML = `<div class="slide"><div class="muted" style="padding:1.5rem">Reklamalarni yuklashda xatolik</div></div>`;
    }
}

// ================= AUTHENTICATION HANDLING =================
function initAuthHandling() {
    const loginBtn = document.getElementById('loginBtn');
    const welcomeMsg = document.getElementById('welcomeMsg');
    
    if (!loginBtn) return;

    // Check if user was previously logged in
    const savedUser = localStorage.getItem("telegramUser");
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            loginBtn.style.display = "none";
            if (welcomeMsg) {
                welcomeMsg.style.display = "inline";
                welcomeMsg.textContent = "SALOM, " + user.first_name + "!";
            }
        } catch (e) {
            console.error('Foydalanuvchi ma\'lumotlarini o\'qishda xatolik:', e);
            localStorage.removeItem("telegramUser");
        }
    }

    // Handle login requirement for protected links
    document.querySelectorAll("a.btn-primary.require-login, a.require-login").forEach(link => {
        link.addEventListener("click", function(e) {
            if (!localStorage.getItem("telegramUser")) {
                e.preventDefault();
                alert("❌ Iltimos, avval tizimga kiring!");
                document.getElementById('authModal').style.display = 'flex';
            }
        });
    });
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Initialize all components
    initTheme();
    initMobileMenu();
    initShowMoreButtons();
    initCarousel();
    init3DEffects();
    initBounceAnimations();
    initAuthHandling();
    
    // Load ads
    loadAds();
    
    // Theme toggle event
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isLight = root.classList.contains('light');
            applyTheme(isLight ? 'dark' : 'light');
        });
    }
});

// ================= ERROR HANDLING =================
window.addEventListener('error', function(e) {
    console.error('Xatolik yuz berdi:', e.error);
});

// ================= RESIZE HANDLING =================
window.addEventListener('resize', function() {
    // Reinitialize carousel on resize to handle responsive changes
    initCarousel();
});
const track = document.getElementById("carouselTrack");
const slides = Array.from(track.children);
const prevBtn = document.querySelector(".carousel-btn.prev");
const nextBtn = document.querySelector(".carousel-btn.next");

let currentIndex = 0;

function updateCarousel() {
  const slideWidth = slides[0].getBoundingClientRect().width;
  track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
}

// Oldingi banner
prevBtn.addEventListener("click", () => {
  currentIndex = (currentIndex - 1 + slides.length) % slides.length;
  updateCarousel();
});

// Keyingi banner
nextBtn.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % slides.length;
  updateCarousel();
});

// Avtomatik aylanish (har 3 soniyada)
setInterval(() => {
  currentIndex = (currentIndex + 1) % slides.length;
  updateCarousel();
}, 5000);

updateCarousel();

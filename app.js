/* THEME: dark default + remember */
const root = document.documentElement;
const themeMeta = document.getElementById('theme-color-meta');

function applyTheme(mode) { // 'dark' | 'light'
  if (mode === 'light') {
    root.classList.add('light');
    themeMeta.setAttribute('content', '#f7f9fc');
    localStorage.setItem('theme', 'light');
  } else {
    root.classList.remove('light');
    themeMeta.setAttribute('content', '#0b1220');
    localStorage.setItem('theme', 'dark');
  }
}

(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) { applyTheme(saved); }
  else {
    // default: dark
    applyTheme('dark');
  }
})();

document.getElementById('themeToggle').addEventListener('click', () => {
  const isLight = root.classList.contains('light');
  applyTheme(isLight ? 'dark' : 'light');
});

/* Header: mobile menu */
const menuBtn = document.querySelector('.menu-toggle');
const menu = document.getElementById('site-menu');
if (menuBtn && menu) {
  menuBtn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

/* Footer year */
const yearElement = document.getElementById('year');
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

/* Ko'proq tugmalari */
document.querySelectorAll('[data-more]').forEach(btn => {
  const gridSel = btn.getAttribute('data-more');
  const grid = document.querySelector(gridSel);
  if (grid) {
    let expanded = false;
    btn.addEventListener('click', () => {
      expanded = !expanded;
      grid.dataset.expanded = expanded ? 'true' : 'false';
      btn.textContent = expanded ? "Kamroq" : "Ko'proq";
    });
  }
});

/* Carousel functionality */
const track = document.getElementById("carouselTrack");
const prevBtn = document.querySelector(".carousel-btn.prev");
const nextBtn = document.querySelector(".carousel-btn.next");
let currentIndex = 0;
let slides = [];
let timer = null;
const INTERVAL = 4000;

if (track) {
  slides = Array.from(track.children);
}

function updateCarousel() {
  if (slides.length > 0) {
    const slideWidth = slides[0].getBoundingClientRect().width;
    track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
  }
}

if (prevBtn && nextBtn && slides.length > 0) {
  // oldingi banner
  prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarousel();
    resetAuto();
  });

  // keyingi banner
  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
    resetAuto();
  });

  // accessibility: focus bilan to'xtatish
  track.addEventListener('focusin', () => clearInterval(timer));
  track.addEventListener('focusout', () => auto());
}

function auto() {
  clearInterval(timer);
  timer = setInterval(() => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
  }, INTERVAL);
}

function resetAuto() {
  auto();
}

if (slides.length > 0) {
  updateCarousel();
  auto();
}

/* 3D Effects */
// Faqat PC'da ishlasin
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  function add3DEffect(selector) {
    const elements = document.querySelectorAll(selector);

    elements.forEach(el => {
      el.addEventListener("mousemove", e => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * 8;
        const rotateY = ((x - centerX) / centerX) * -8;

        el.style.transform =
          `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
      });

      el.addEventListener("mouseleave", () => {
        el.style.transform =
          "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
      });
    });
  }

  add3DEffect(".card");
  add3DEffect(".btn");

  // Logolar uchun 3D effekt
  function addLogo3DEffect(selector) {
    const logo = document.querySelector(selector);

    if (logo) {
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
  }

  // Ikkala logoga qo'llaymiz
  addLogo3DEffect(".header-logo");
  addLogo3DEffect(".footer-logo");
}

/* Bounce animatsiya qo'shish */
function addLogoBounce(selector) {
  const logo = document.querySelector(selector);
  if (logo) {
    logo.addEventListener("click", () => {
      logo.classList.add("logo-bounce");

      // animatsiya tugagach klassni olib tashlaymiz
      logo.addEventListener("animationend", () => {
        logo.classList.remove("logo-bounce");
      }, { once: true });
    });
  }
}

// Ikkala logoga qo'llaymiz
addLogoBounce(".header-logo");
addLogoBounce(".footer-logo");

/* Firebase Authentication */
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

let loggedInUser = null;
let pendingLink = null;

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
const emailLoginForm = document.getElementById('emailLoginForm');
if (emailLoginForm) {
  emailLoginForm.addEventListener('submit', function (e) {
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
}

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

const emailRegisterForm = document.getElementById('emailRegisterForm');
if (emailRegisterForm) {
  emailRegisterForm.addEventListener('submit', function (e) {
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
}

// Foydalanuvchi chiqishi
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', function () {
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
}

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

      // 🔥 Custom ID ni ko'rsatish
      if (userData.id) {
        document.getElementById('userId').textContent = userData.id;
        document.getElementById('modalUserId').textContent = userData.id;
      } else {
        // agar `id` bo'lmasa, fallback sifatida uid ko'rsatish
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
const editNameBtn = document.getElementById('editNameBtn');
if (editNameBtn) {
  editNameBtn.addEventListener('click', function () {
    document.getElementById('nameEditForm').style.display = 'block';
  });
}

const cancelEditBtn = document.getElementById('cancelEditBtn');
if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', function () {
    document.getElementById('nameEditForm').style.display = 'none';
  });
}

const saveNameBtn = document.getElementById('saveNameBtn');
if (saveNameBtn) {
  saveNameBtn.addEventListener('click', function () {
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
}

// Balansni yangilash
const refreshBalance = document.getElementById('refreshBalance');
if (refreshBalance) {
  refreshBalance.addEventListener('click', function () {
    const user = firebase.auth().currentUser;
    if (user) {
      getUserData(user.uid);
      this.classList.add('rotating');
      setTimeout(() => {
        this.classList.remove('rotating');
      }, 1000);
    }
  });
}

// Foydalanuvchi nomiga bosganda modalni ochish
const welcomeMsg = document.getElementById('welcomeMsg');
if (welcomeMsg) {
  welcomeMsg.addEventListener('click', function () {
    document.getElementById('authModal').style.display = 'flex';
  });
}

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
const loginBtn = document.getElementById('loginBtn');
if (loginBtn) {
  loginBtn.addEventListener('click', function () {
    document.getElementById('authModal').style.display = 'flex';
  });
}

// Modalni yopish
const closeModal = document.querySelector('.close-modal');
if (closeModal) {
  closeModal.addEventListener('click', function () {
    document.getElementById('authModal').style.display = 'none';
  });
}

// Tab'larni boshqarish
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', function () {
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
window.addEventListener('click', function (event) {
  const authModal = document.getElementById('authModal');
  if (event.target == authModal) {
    authModal.style.display = 'none';
  }
});

/* Assistive Menu */
const mathMenuBtn = document.getElementById('mathMenuBtn');
const mathMenu = document.getElementById('mathMenu');
const closeMenu = document.getElementById('closeMenu');
const menuThemeToggle = document.getElementById('menuThemeToggle');

if (mathMenuBtn && mathMenu) {
  mathMenuBtn.addEventListener('click', () => {
    mathMenu.style.display = mathMenu.style.display === 'flex' ? 'none' : 'flex';
  });
}

if (closeMenu) {
  closeMenu.addEventListener('click', () => {
    mathMenu.style.display = 'none';
  });
}

if (menuThemeToggle) {
  menuThemeToggle.addEventListener('click', () => {
    const isLight = root.classList.contains('light');
    applyTheme(isLight ? 'dark' : 'light');
  });
}

// Tashqariga bosganda menyu yopilishi
window.addEventListener('click', function (event) {
  if (mathMenu && mathMenuBtn && 
      event.target !== mathMenu && 
      !mathMenu.contains(event.target) && 
      event.target !== mathMenuBtn) {
    mathMenu.style.display = 'none';
  }
});

/* Login Modal */
const modal = document.getElementById("loginModal");
const modalClose = document.getElementById("modalClose");

if (modal && modalClose) {
  // ❌ tugma bosilganda yopiladi
  modalClose.addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Linkni bosganda modal ochiladi
  document.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", (e) => {
      if (!loggedInUser) {
        e.preventDefault();
        modal.style.display = "flex";
      }
    });
  });

  // Modal ichidagi Kirish tugmasi
  const modalLoginBtn = document.getElementById("modalLoginBtn");
  if (modalLoginBtn) {
    modalLoginBtn.addEventListener("click", () => {
      document.getElementById("loginBtn").click();
      modal.style.display = "none";
    });
  }
}

// DOM yuklanganda ishga tushirish
document.addEventListener("DOMContentLoaded", function () {
  // Login modalini boshqarish
  const savedUser = localStorage.getItem("telegramUser");
  if (savedUser) {
    loggedInUser = JSON.parse(savedUser);
    document.getElementById("loginBtn").style.display = "none";
    document.getElementById("welcomeMsg").style.display = "inline";
    document.getElementById("welcomeMsg").innerText = "SALOM, " + loggedInUser.first_name + "!";
  }

  // Barcha test tugmalarini tekshiramiz
  document.querySelectorAll("a.btn-primary").forEach(btn => {
    btn.addEventListener("click", function (e) {
      if (!loggedInUser) {
        e.preventDefault();
        pendingLink = this.href;
        alert("❌ Avval kirishingiz kerak!");
      }
    });
  });
});

// Bannerlarni yuklash
async function loadAds() {
  try {
    const res = await fetch('ads.html', { cache: 'no-store' });
    const html = await res.text();
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    // ads.html ichidagi .ad-item elementlarini olamiz
    const items = tmp.querySelectorAll('.ad-item');
    if (!items.length) {
      track.innerHTML = `<div class="slide"><div class="muted" style="padding:1.5rem">ads.html topildi, lekin .ad-item topilmadi.</div></div>`;
      return;
    }

    // Slaydlarni qo'shish
    const dotsWrap = document.querySelector('.carousel-dots');
    items.forEach((ad, idx) => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      // cheklangan kenglikda kontent yaxshi ko'rinsin:
      const frame = document.createElement('div');
      frame.style.width = '100%';
      frame.style.height = '100%';
      frame.style.display = 'grid';
      frame.style.placeItems = 'center';
      frame.appendChild(ad.cloneNode(true));
      slide.appendChild(frame);
      track.appendChild(slide);

      if (dotsWrap) {
        const dot = document.createElement('button');
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Slayd ${idx + 1}`);
        dot.addEventListener('click', () => goTo(idx));
        dotsWrap.appendChild(dot);
      }
    });

    slides = Array.from(track.children);
    updateUI();
    auto();
  } catch (e) {
    track.innerHTML = `<div class="slide"><div class="muted" style="padding:1.5rem">Bannerlarni yuklashda xatolik: ${e.message}</div></div>`;
  }
}

function updateUI() {
  const offset = -currentIndex * 100;
  track.style.transform = `translateX(${offset}%)`;
  const dotsWrap = document.querySelector('.carousel-dots');
  if (dotsWrap) {
    Array.from(dotsWrap.children).forEach((d, i) => {
      d.setAttribute('aria-selected', i === currentIndex ? 'true' : 'false');
    });
  }
}

function goTo(i) {
  currentIndex = i % slides.length;
  updateUI();
  resetAuto();
}

// DOM yuklanganda bannerlarni yuklash
if (track) {
  loadAds();
}
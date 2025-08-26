/* THEME: dark default + remember */
const root = document.documentElement;
const themeMeta = document.getElementById('theme-color-meta');

function applyTheme(mode) {
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
  if (saved) applyTheme(saved);
  else applyTheme('dark');
})();

document.getElementById('themeToggle')?.addEventListener('click', () => {
  const isLight = root.classList.contains('light');
  applyTheme(isLight ? 'dark' : 'light');
});

/* Footer year */
const yearElement = document.getElementById('year');
if (yearElement) yearElement.textContent = new Date().getFullYear();

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

if (track) slides = Array.from(track.children);

function updateCarousel() {
  if (slides.length > 0) {
    const slideWidth = slides[0].getBoundingClientRect().width;
    track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
  }
}

function auto() {
  clearInterval(timer);
  timer = setInterval(() => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
  }, INTERVAL);
}

function resetAuto() { auto(); }

if (prevBtn && nextBtn && slides.length > 0) {
  prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarousel();
    resetAuto();
  });
  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
    resetAuto();
  });
}

if (slides.length > 0) {
  updateCarousel();
  auto();
}

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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Google login
function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert(err.message));
}

// Email login
const emailLoginForm = document.getElementById('emailLoginForm');
if (emailLoginForm) {
  emailLoginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    const password = e.target.querySelector('input[type="password"]').value;
    auth.signInWithEmailAndPassword(email, password).catch(err => alert(err.message));
  });
}

// Email register
const emailRegisterForm = document.getElementById('emailRegisterForm');
if (emailRegisterForm) {
  emailRegisterForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = e.target.querySelector('input[type="text"]').value;
    const email = e.target.querySelector('input[type="email"]').value;
    const password = e.target.querySelector('input[type="password"]').value;
    auth.createUserWithEmailAndPassword(email, password)
      .then(userCredential => userCredential.user.updateProfile({ displayName: name }));
  });
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', () => auth.signOut());

// Update UI
auth.onAuthStateChanged(user => {
  const loginBtn = document.getElementById('loginBtn');
  const userInfoBox = document.getElementById('userInfoBox');
  const userDetails = document.getElementById('userDetails');
  if (user) {
    const name = user.displayName || user.email.split('@')[0];
    document.getElementById('userName').textContent = name;
    document.getElementById('modalUserName').textContent = name;
    document.getElementById('userId').textContent = user.uid;
    document.getElementById('modalUserId').textContent = user.uid;
    loginBtn.style.display = 'none';
    userInfoBox.style.display = 'flex';
    userDetails.style.display = 'block';
    document.getElementById('authModal').style.display = 'none';
  } else {
    loginBtn.style.display = 'block';
    userInfoBox.style.display = 'none';
    userDetails.style.display = 'none';
  }
});

/* Modal management */
const modal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const closeModal = document.querySelector('.close-modal');

if (loginBtn) loginBtn.addEventListener('click', () => modal.style.display = 'flex');
if (closeModal) closeModal.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

// Tab switching
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', function () {
    const tab = this.getAttribute('data-tab');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.getElementById(tab + 'Tab').style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

/* Assistive touch menu */
const assistiveTouch = document.querySelector('.assistive-touch');
const mathMenu = document.querySelector('.math-assistive-menu');
if (assistiveTouch && mathMenu) {
  assistiveTouch.addEventListener('click', () => {
    const isVisible = mathMenu.style.display === 'flex';
    mathMenu.style.display = isVisible ? 'none' : 'flex';
  });
}
document.addEventListener('click', e => {
  if (mathMenu && mathMenu.style.display === 'flex' && !mathMenu.contains(e.target) && !assistiveTouch.contains(e.target)) {
    mathMenu.style.display = 'none';
  }
});

/* Logo bounce */
const logo = document.querySelector('.xy-logo');
if (logo) {
  logo.addEventListener('click', () => {
    logo.classList.remove('logo-bounce');
    void logo.offsetWidth;
    logo.classList.add('logo-bounce');
  });
}

/* Require-login links */
document.querySelectorAll('.require-login').forEach(link => {
  link.addEventListener('click', e => {
    if (!auth.currentUser) {
      e.preventDefault();
      modal.style.display = 'flex';
    }
  });
});

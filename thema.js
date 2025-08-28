// Tema almashirish
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.body.setAttribute(
      'data-theme',
      document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    );
    themeToggle.innerHTML = document.body.getAttribute('data-theme') === 'dark'
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', document.body.getAttribute('data-theme'));
  });
}

// LocalStorage'dan yuklash
document.addEventListener("DOMContentLoaded", () => {
  let savedTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", savedTheme);
});

// Sidebar toggle
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
menuToggle?.addEventListener("click", () => {
  sidebar.classList.toggle("show");
});

// Modal boshqaruvlari
const loginBtn = document.getElementById("loginBtn");
const loginModal = document.getElementById("loginModal");
const registerBtn = document.getElementById("registerBtn");
const registerModal = document.getElementById("registerModal");
const closeLoginModal = document.getElementById("closeLoginModal");
const closeRegisterModal = document.getElementById("closeRegisterModal");

loginBtn?.addEventListener("click", () => loginModal.classList.add("show"));
registerBtn?.addEventListener("click", () => registerModal.classList.add("show"));
closeLoginModal?.addEventListener("click", () => loginModal.classList.remove("show"));
closeRegisterModal?.addEventListener("click", () => registerModal.classList.remove("show"));

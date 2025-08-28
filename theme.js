// Tema almashish
function toggleTheme() {
  const body = document.body;
  if (body.classList.contains('dark')) {
    body.classList.remove('dark');
    body.classList.add('light');
    localStorage.setItem('theme', 'light');
    if (menuThemeToggle) menuThemeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    body.classList.remove('light');
    body.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    if (menuThemeToggle) menuThemeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }
}

// Tema toggle elementlari
const themeToggle = document.getElementById('themeToggle');

if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
if (menuThemeToggle) menuThemeToggle.addEventListener('click', toggleTheme);

// Sahifa yuklanganda temani tiklash
document.addEventListener('DOMContentLoaded', function() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    if (menuThemeToggle) menuThemeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
});
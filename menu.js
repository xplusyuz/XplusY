// Assistive menyu elementlari
const assistiveTouch = document.getElementById('assistiveTouch');
const assistiveMenu = document.getElementById('assistiveMenu');
const closeMenuBtn = document.getElementById('closeMenu');
const menuThemeToggle = document.getElementById('menuThemeToggle');

// Assistive menyu
if (assistiveTouch) assistiveTouch.addEventListener('click', () => {
  assistiveMenu.classList.toggle('show');
  assistiveTouch.classList.toggle('active');
});

if (closeMenuBtn) closeMenuBtn.addEventListener('click', () => {
  assistiveMenu.classList.remove('show');
  assistiveTouch.classList.remove('active');
});

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
// Animatsiyalar va interaktiv effektlar
document.addEventListener('DOMContentLoaded', function() {
  // Scroll animatsiyalari
  const animatedElements = document.querySelectorAll('.service-card, .stat-item, .banner');
  
  function checkScroll() {
    animatedElements.forEach(element => {
      const elementPosition = element.getBoundingClientRect().top;
      const screenPosition = window.innerHeight / 1.3;
      
      if (elementPosition < screenPosition) {
        element.style.opacity = 1;
        element.style.transform = 'translateY(0)';
      }
    });
  }
  
  // Boshlang'ich holat
  animatedElements.forEach(element => {
    element.style.opacity = 0;
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });
  
  // Scrollni kuzatish
  window.addEventListener('scroll', checkScroll);
  checkScroll(); // Dastlabki tekshiruv
  
  // Statistik raqamlarni animatsiya bilan ko'rsatish
  function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const value = Math.floor(progress * (end - start) + start);
      element.textContent = value + (element.id === 'success-rate' ? '%' : '+');
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }
  
  // Statistikani faqat bir marta animatsiya qilish
  let statsAnimated = false;
  
  function animateStats() {
    if (!statsAnimated) {
      animateValue(document.getElementById('users-count'), 0, 5000, 2000);
      animateValue(document.getElementById('problems-count'), 0, 10000, 2000);
      animateValue(document.getElementById('success-rate'), 0, 95, 2000);
      statsAnimated = true;
    }
  }
  
  // Stats bo'limi ko'riniganda animatsiyani ishga tushirish
  const statsSection = document.querySelector('.stats');
  if (statsSection) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateStats();
        }
      });
    }, { threshold: 0.5 });
    
    observer.observe(statsSection);
  }
});

// Form validation
function validateForm(form) {
  let isValid = true;
  const inputs = form.querySelectorAll('input[required], select[required]');
  
  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.style.borderColor = 'var(--danger)';
      isValid = false;
      
      // Xatolik xabarini ko'rsatish
      if (!input.nextElementSibling || !input.nextElementSibling.classList.contains('error-message')) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.style.color = 'var(--danger)';
        errorMsg.style.fontSize = '0.8rem';
        errorMsg.style.marginTop = '5px';
        errorMsg.textContent = 'Bu maydon to\'ldirilishi shart';
        input.parentNode.insertBefore(errorMsg, input.nextSibling);
      }
    } else {
      input.style.borderColor = '';
      const errorMsg = input.nextElementSibling;
      if (errorMsg && errorMsg.classList.contains('error-message')) {
        errorMsg.remove();
      }
    }
  });
  
  return isValid;
}

// Profil sahifasida formani validatsiya qilish
if (document.getElementById('profileForm')) {
  document.getElementById('profileForm').addEventListener('submit', function(e) {
    if (!validateForm(this)) {
      e.preventDefault();
      
      // Xatolik bilan birinchi maydonga fokus
      const firstInvalid = this.querySelector('input[required]:invalid, select[required]:invalid');
      if (firstInvalid) {
        firstInvalid.focus();
      }
    }
  });
}
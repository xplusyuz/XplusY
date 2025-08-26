/* THEME: dark default + remember */
const root = document.documentElement;
const themeMeta = document.getElementById('theme-color-meta');

function applyTheme(mode){ // 'dark' | 'light'
  if(mode === 'light'){
    root.classList.add('light');
    themeMeta.setAttribute('content', '#f7f9fc');
    localStorage.setItem('theme','light');
  } else {
    root.classList.remove('light');
    themeMeta.setAttribute('content', '#0b1220');
    localStorage.setItem('theme','dark');
  }
}

(function initTheme(){
  const saved = localStorage.getItem('theme');
  if(saved){ applyTheme(saved); }
  else {
    // default: dark
    applyTheme('dark');
  }
})();

document.getElementById('themeToggle').addEventListener('click',()=>{
  const isLight = root.classList.contains('light');
  applyTheme(isLight ? 'dark' : 'light');
});

/* Header: mobile menu */
const menuBtn = document.querySelector('.menu-toggle');
const menu = document.getElementById('site-menu');
menuBtn.addEventListener('click', ()=>{
  const open = menu.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
});

/* Footer year */
document.getElementById('year').textContent = new Date().getFullYear();

/* Ko'proq tugmalari */
document.querySelectorAll('[data-more]').forEach(btn=>{
  const gridSel = btn.getAttribute('data-more');
  const grid = document.querySelector(gridSel);
  let expanded = false;
  btn.addEventListener('click', ()=>{
    expanded = !expanded;
    grid.dataset.expanded = expanded ? 'true' : 'false';
    btn.textContent = expanded ? "Kamroq" : "Ko'proq";
  });
});

async function loadAds(){
  try {
    const res = await fetch('ads.html', {cache: 'no-store'});
    const html = await res.text();
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    // ads.html ichidagi .ad-item elementlarini olamiz
    const items = tmp.querySelectorAll('.ad-item');
    if(!items.length){
      track.innerHTML = `<div class="slide"><div class="muted" style="padding:1.5rem">ads.html topildi, lekin .ad-item topilmadi.</div></div>`;
      return;
    }

    // Slaydlarni qo'shish
    items.forEach((ad, idx)=>{
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

      const dot = document.createElement('button');
      dot.setAttribute('role','tab');
      dot.setAttribute('aria-label', `Slayd ${idx+1}`);
      dot.addEventListener('click', ()=>goTo(idx));
      dotsWrap.appendChild(dot);
    });

    slides = Array.from(track.children);
    updateUI();
    auto();
  } catch (e){
    track.innerHTML = `<div class="slide"><div class="muted" style="padding:1.5rem">Bannerlarni yuklashda xatolik: ${e.message}</div></div>`;
  }
}

function updateUI(){
  const offset = -current * 100;
  track.style.transform = `translateX(${offset}%)`;
  Array.from(dotsWrap.children).forEach((d,i)=>{
    d.setAttribute('aria-selected', i===current ? 'true':'false');
  });
}

function prev(){ current = (current - 1 + slides.length) % slides.length; updateUI(); resetAuto(); }
function next(){ current = (current + 1) % slides.length; updateUI(); resetAuto(); }
function goTo(i){ current = i % slides.length; updateUI(); resetAuto(); }

function auto(){
  clearInterval(timer);
  timer = setInterval(next, INTERVAL);
}
function resetAuto(){ auto(); }

prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);

/* accessibility: focus bilan to'xtatish */
track.addEventListener('focusin', ()=> clearInterval(timer));
track.addEventListener('focusout', ()=> auto());
const track = document.getElementById("carouselTrack");
const slides = Array.from(track.children);
const prevBtn = document.querySelector(".carousel-btn.prev");
const nextBtn = document.querySelector(".carousel-btn.next");

let currentIndex = 0;

function updateCarousel() {
  const slideWidth = slides[0].getBoundingClientRect().width;
  track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
}

// oldingi banner
prevBtn.addEventListener("click", () => {
  currentIndex = (currentIndex - 1 + slides.length) % slides.length;
  updateCarousel();
});

// keyingi banner
nextBtn.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % slides.length;
  updateCarousel();
});

// avtomatik aylanish (har 3 soniyada)
setInterval(() => {
  currentIndex = (currentIndex + 1) % slides.length;
  updateCarousel();
}, 4000);

updateCarousel();
// Faqat PC’da ishlasin
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
}
// Footer logo 3D effekt
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  const footerLogo = document.querySelector(".footer-logo");

  if (footerLogo) {
    footerLogo.addEventListener("mousemove", e => {
      const rect = footerLogo.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * 10;
      const rotateY = ((x - centerX) / centerX) * -10;

      footerLogo.style.transform =
        `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.1)`;
    });

    footerLogo.addEventListener("mouseleave", () => {
      footerLogo.style.transform =
        "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)";
    });
  }
}
// Header va Footer logolar uchun 3D effekt
function addLogo3DEffect(selector) {
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
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
}

// Ikkala logoga qo‘llaymiz
addLogo3DEffect(".header-logo");
addLogo3DEffect(".footer-logo");
// Bounce animatsiya qo‘shish
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

// Ikkala logoga qo‘llaymiz
addLogoBounce(".header-logo");
addLogoBounce(".footer-logo");
    document.addEventListener("DOMContentLoaded", () => {
      let loggedInUser = localStorage.getItem("telegramUser");
      const modal = document.getElementById("loginModal");
      const modalClose = document.getElementById("modalClose");

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
      document.getElementById("modalLoginBtn").addEventListener("click", () => {
        document.getElementById("loginBtn").click();
        modal.style.display = "none";
      });
    });
 
let loggedInUser = null;
let pendingLink = null;

// Telegram login chaqiradigan funksiya
function showTelegramLogin() {
  const script = document.createElement("script");
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.setAttribute("data-telegram-login", "sinov12345_bot"); // bot usernameni qo'yasiz
  script.setAttribute("data-size", "medium");
  script.setAttribute("data-userpic", "false");
  script.setAttribute("data-onauth", "onTelegramAuth(user)");
  script.setAttribute("data-request-access", "write");
  document.body.appendChild(script);
}

// Telegram login bo‘lgandan keyin
function onTelegramAuth(user) {
  loggedInUser = user;
  localStorage.setItem("telegramUser", JSON.stringify(user));

  document.getElementById("loginBtn").style.display = "none";
  document.getElementById("welcomeMsg").style.display = "inline";
  document.getElementById("welcomeMsg").innerText = "SALOM, " + user.first_name + "!";

  // Agar login qilishdan oldin link bosilgan bo‘lsa, o‘sha linkka yo‘naltiramiz
  if (pendingLink) {
    window.location.href = pendingLink;
    pendingLink = null;
  }
}

// Sahifa yangilanda login eslatib qolish
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("telegramUser");
  if (saved) {
    loggedInUser = JSON.parse(saved);
    document.getElementById("loginBtn").style.display = "none";
    document.getElementById("welcomeMsg").style.display = "inline";
    document.getElementById("welcomeMsg").innerText = "SALOM, " + loggedInUser.first_name + "!";
  }

  // Login tugmasiga bosilganda Telegram login chiqsin
  document.getElementById("loginBtn").addEventListener("click", () => {
    showTelegramLogin();
  });

  // Barcha test tugmalarini tekshiramiz
  document.querySelectorAll("a.btn-primary").forEach(btn => {
    btn.addEventListener("click", function(e) {
      if (!loggedInUser) {
        e.preventDefault();
        pendingLink = this.href;
        alert("❌ Avval kirishingiz kerak!");
      }
    });
  });
});

loadAds();
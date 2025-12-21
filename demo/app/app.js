// =============== GLOBAL VARIABLES ===============
let scene, camera, renderer, controls;
let particles = [];
let isRotating = true;
let particleEffect = true;
let currentUserData = null;

// =============== 3D SCENE SETUP ===============
function initThreeJS() {
  if (!THREE) {
    console.warn('Three.js not loaded, skipping 3D effects');
    return;
  }

  try {
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 15;
    
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;
    
    renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      antialias: true,
      alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Make canvas non-interactive
    renderer.domElement.style.pointerEvents = 'none';
    
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI;
      controls.minDistance = 5;
      controls.maxDistance = 50;
      controls.enablePan = false;
      controls.enableZoom = false;
    }
    
    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0x007AFF, 0.3);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0x409CFF, 0.8);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0x007AFF, 0.5, 100);
    pointLight.position.set(-10, -10, 10);
    scene.add(pointLight);
    
    // CREATE GEOMETRIES
    createParticles();
    createFloatingShapes();
    
    // RESIZE HANDLER
    window.addEventListener('resize', onWindowResize);
    
    // Start animation
    animate();
    
  } catch (error) {
    console.error('Three.js initialization error:', error);
  }
}

function createParticles() {
  const particleCount = 1500;
  const particlesGeometry = new THREE.BufferGeometry();
  const posArray = new Float32Array(particleCount * 3);
  
  for(let i = 0; i < particleCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 100;
  }
  
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.08,
    color: 0x007AFF,
    transparent: true,
    opacity: 0.5
  });
  
  const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particlesMesh);
  particles.push(particlesMesh);
}

function createFloatingShapes() {
  // TORUS
  const torusGeometry = new THREE.TorusGeometry(3, 1, 16, 100);
  const torusMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x007AFF,
    transparent: true,
    opacity: 0.2,
    wireframe: true 
  });
  const torus = new THREE.Mesh(torusGeometry, torusMaterial);
  torus.position.x = -12;
  torus.position.y = 8;
  scene.add(torus);
  
  // ICOSAHEDRON
  const icosahedronGeometry = new THREE.IcosahedronGeometry(2);
  const icosahedronMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x409CFF,
    transparent: true,
    opacity: 0.3,
    wireframe: true 
  });
  const icosahedron = new THREE.Mesh(icosahedronGeometry, icosahedronMaterial);
  icosahedron.position.x = 12;
  icosahedron.position.y = -8;
  scene.add(icosahedron);
  
  // SPHERE
  const sphereGeometry = new THREE.SphereGeometry(2.5, 32, 32);
  const sphereMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x0056CC,
    transparent: true,
    opacity: 0.15,
    wireframe: true 
  });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.x = -10;
  sphere.position.y = -12;
  scene.add(sphere);
  
  // TETRAHEDRON
  const tetraGeometry = new THREE.TetrahedronGeometry(1.8);
  const tetraMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.25,
    wireframe: true 
  });
  const tetrahedron = new THREE.Mesh(tetraGeometry, tetraMaterial);
  tetrahedron.position.x = 8;
  tetrahedron.position.y = 12;
  scene.add(tetrahedron);
}

function onWindowResize() {
  if (!camera || !renderer) return;
  
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  if (!scene || !camera || !renderer) return;
  
  requestAnimationFrame(animate);
  
  if(isRotating) {
    scene.children.forEach(child => {
      if(child instanceof THREE.Mesh && child.geometry.type !== 'PlaneGeometry') {
        child.rotation.x += 0.003;
        child.rotation.y += 0.003;
      }
    });
  }
  
  particles.forEach(particle => {
    if(particleEffect) {
      particle.rotation.x += 0.0005;
      particle.rotation.y += 0.0005;
    }
  });
  
  if (controls) {
    controls.update();
  }
  
  renderer.render(scene, camera);
}

// =============== SCROLL FUNCTIONALITY ===============
function initScrollFunctionality() {
  const scrollProgress = document.getElementById('scrollProgress');
  const scrollToTopBtn = document.getElementById('scrollToTop');

  // Scroll progress tracking
  window.addEventListener('scroll', () => {
    const totalHeight = document.body.scrollHeight - window.innerHeight;
    const progress = (window.pageYOffset / totalHeight) * 100;
    if (scrollProgress) {
      scrollProgress.style.width = progress + '%';
    }
    
    // Show/hide scroll to top button
    if (scrollToTopBtn) {
      if (window.pageYOffset > 300) {
        scrollToTopBtn.classList.add('show');
      } else {
        scrollToTopBtn.classList.remove('show');
      }
    }
  });

  // Scroll to top functionality
  if (scrollToTopBtn) {
    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

// =============== THEME MANAGEMENT ===============
function initThemeManagement() {
  const themeToggle = document.getElementById('theme-toggle');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

  function setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-mode');
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark-mode');
    setTheme(isDark ? 'light' : 'dark');
  }

  // Initialize theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    setTheme(savedTheme);
  } else if (prefersDarkScheme.matches) {
    setTheme('dark');
  } else {
    setTheme('light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}

// =============== PAGE MANAGEMENT ===============
function initPageManagement() {
  function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
      page.classList.remove('active');
    });
    
    // Update ONLY bottom nav items
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Show selected page
    const pageElement = document.getElementById(`page-${pageId}`);
    if (pageElement) {
      pageElement.classList.add('active');
    }
    
    // Activate nav item ONLY in bottom-nav
    const navItem = document.querySelector(`.bottom-nav [data-page="${pageId}"]`);
    if (navItem) {
      navItem.classList.add('active');
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
  }

  // Bottom navigation
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.dataset.page;
      showPage(pageId);
    });
  });
  
  // Cards in main pages
  document.querySelectorAll('.card-3d, .action-button').forEach(element => {
    if (element.dataset.page) {
      element.addEventListener('click', () => {
        const pageId = element.dataset.page;
        showPage(pageId);
      });
    }
  });
  
  // Logo click to home
  document.querySelector('.brand-logo')?.addEventListener('click', () => {
    showPage('home');
  });
  
  // Brand title click to home
  document.querySelector('.brand-title')?.addEventListener('click', () => {
    showPage('home');
  });
}

// =============== 3D EFFECT CONTROLS ===============
function initEffectControls() {
  const effectRotateBtn = document.getElementById('effect-rotate');
  const effectZoomBtn = document.getElementById('effect-zoom');
  const effectParticlesBtn = document.getElementById('effect-particles');
  const effectResetBtn = document.getElementById('effect-reset');

  if (effectRotateBtn) {
    effectRotateBtn.addEventListener('click', () => {
      isRotating = !isRotating;
      effectRotateBtn.innerHTML = isRotating ? 
        '<i class="fa-solid fa-pause"></i> To\'xtatish' : 
        '<i class="fa-solid fa-play"></i> Davom ettirish';
    });
  }
  
  if (effectZoomBtn && camera) {
    effectZoomBtn.addEventListener('click', () => {
      camera.position.z = camera.position.z === 15 ? 8 : 15;
    });
  }
  
  if (effectParticlesBtn) {
    effectParticlesBtn.addEventListener('click', () => {
      particleEffect = !particleEffect;
      effectParticlesBtn.innerHTML = particleEffect ? 
        '<i class="fa-solid fa-sparkles"></i> Zarralar (ON)' : 
        '<i class="fa-solid fa-ban"></i> Zarralar (OFF)';
    });
  }
  
  if (effectResetBtn && camera && controls) {
    effectResetBtn.addEventListener('click', () => {
      camera.position.set(0, 0, 15);
      controls.reset();
      isRotating = true;
      particleEffect = true;
      
      if (effectRotateBtn) {
        effectRotateBtn.innerHTML = '<i class="fa-solid fa-pause"></i> To\'xtatish';
      }
      
      if (effectParticlesBtn) {
        effectParticlesBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> Zarralar (ON)';
      }
    });
  }
}

// =============== 3D CARD HOVER EFFECTS ===============
function initCardHoverEffects() {
  document.querySelectorAll('.card-3d').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      if (window.innerWidth > 768) {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateY = (x - centerX) / 20;
        const rotateX = (centerY - y) / 20;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
      }
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
  });
}

// =============== MATHLEAGUE TIMER ===============
function initMathLeagueTimer() {
  function updateTimer() {
    const now = new Date();
    const target = new Date(now);
    
    // Set target to next Saturday 20:00
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
    target.setDate(now.getDate() + daysUntilSaturday);
    target.setHours(20, 0, 0, 0);
    
    // If we've passed target this week, move to next week
    if (now > target) {
      target.setDate(target.getDate() + 7);
    }
    
    const diff = target - now;
    
    // Calculate time components
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Format display
    const timerElements = document.querySelectorAll('.timer');
    timerElements.forEach(timerElement => {
      timerElement.textContent = 
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}`;
    });
    
    // Update status
    const isActive = hours === 0 && minutes < 60;
    const statusEl = document.getElementById('timer-status');
    
    if (statusEl) {
      if (isActive) {
        statusEl.textContent = 'Musobaqa yaqinda boshlanadi';
        statusEl.style.background = 'rgba(52, 199, 89, 0.1)';
        statusEl.style.color = 'var(--color-accent)';
        statusEl.style.borderColor = 'rgba(52, 199, 89, 0.2)';
      } else {
        statusEl.textContent = 'Keyingi shanbaga qadar';
        statusEl.style.background = '';
        statusEl.style.color = '';
        statusEl.style.borderColor = '';
      }
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// =============== USER PROFILE ===============
function initUserProfile() {
  const userGreeting = document.getElementById('user-greeting');
  const userFirstName = document.getElementById('user-firstname');
  
  // Check if user is logged in
  try {
    const user = authUtils.getUser();
    if (user && user.data) {
      currentUserData = user.data;
      
      // Update greeting
      if (userFirstName && currentUserData.firstName) {
        userFirstName.textContent = currentUserData.firstName;
      }
      
      // Show greeting on desktop
      if (userGreeting && window.innerWidth >= 768) {
        userGreeting.style.display = 'flex';
      }
    }
  } catch (error) {
    console.log('User not logged in or authUtils not available');
  }
}

// =============== INITIALIZATION ===============
document.addEventListener('DOMContentLoaded', () => {
  console.log('LeaderMath 3D Portal loaded successfully!');
  
  // Initialize 3D effects
  if (typeof THREE !== 'undefined') {
    initThreeJS();
  }
  
  // Initialize all functionality
  initScrollFunctionality();
  initThemeManagement();
  initPageManagement();
  initEffectControls();
  initCardHoverEffects();
  initMathLeagueTimer();
  initUserProfile();
  
  // Add card animations
  const cards = document.querySelectorAll('.card-3d');
  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
    card.style.animation = 'slideUp 0.5s ease both';
  });
  
  console.log('3D Effects: Active');
  console.log('Scroll enabled: Yes');
});
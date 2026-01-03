
// === index1 core (background + scroll) with guards ===
(() => {
  // Scroll progress
  const scrollProgress = document.getElementById('scrollProgress');
  const scrollToTop = document.getElementById('scrollToTop');
  function onScroll(){
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const sc = docH > 0 ? (window.scrollY / docH) * 100 : 0;
    if(scrollProgress) scrollProgress.style.width = sc + '%';
    if(scrollToTop){
      if(window.scrollY > 300) scrollToTop.classList.add('show');
      else scrollToTop.classList.remove('show');
    }
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
  if(scrollToTop){
    scrollToTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  }

  // Three.js background
  const canvas = document.getElementById('three-canvas');
  if(!canvas || !window.THREE) return;

  let scene, camera, renderer, particles, shapes = [];
  const mouse = {x:0, y:0};
  const clock = new THREE.Clock();

  function initThreeJS(){
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.z = 15;

    renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Optional controls
    try{
      if(THREE.OrbitControls){
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
      }
    }catch(e){}

    createParticles();
    createFloatingShapes();
    animate();
  }

  function createParticles(){
    const geometry = new THREE.BufferGeometry();
    const count = 1200;
    const pos = new Float32Array(count*3);
    for(let i=0;i<count;i++){
      pos[i*3+0] = (Math.random()-0.5)*80;
      pos[i*3+1] = (Math.random()-0.5)*80;
      pos[i*3+2] = (Math.random()-0.5)*80;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const material = new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.12, transparent:true, opacity:0.55 });
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
  }

  function createFloatingShapes(){
    // Math sprites (π, ∑, √ ...) to make background feel "mathy"
    const glyphs = ["π","∑","√","∫","∞","Δ","θ","λ","μ","∂","≈","≠","≤","≥","x²","y²"];
    const mkTex = (text)=>{
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const x = c.getContext('2d');
      x.clearRect(0,0,256,256);
      x.textAlign='center'; x.textBaseline='middle';
      x.font = '900 120px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      x.shadowColor = 'rgba(56,189,248,.45)';
      x.shadowBlur = 18;
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.fillText(text, 128, 128);
      x.lineWidth = 6;
      x.strokeStyle = 'rgba(14,165,233,.25)';
      x.strokeText(text, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.needsUpdate = true;
      return t;
    };

    for(let i=0;i<12;i++){
      const g = glyphs[i % glyphs.length];
      const tex = mkTex(g);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, opacity: 0.35 });
      const spr = new THREE.Sprite(mat);
      spr.position.set((Math.random()-0.5)*26, (Math.random()-0.5)*16, (Math.random()-0.5)*18);
      const s = 2.0 + Math.random()*2.2;
      spr.scale.set(s, s, 1);
      spr.userData = { drift: (Math.random()*0.3+0.2), wob: Math.random()*1.8+0.6 };
      scene.add(spr);
      shapes.push(spr);
    }
    const light1 = new THREE.PointLight(0x38bdf8, 1.2);
    light1.position.set(10, 10, 12);
    scene.add(light1);

    const light2 = new THREE.PointLight(0x0ea5e9, 0.9);
    light2.position.set(-10, -6, 10);
    scene.add(light2);

    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(amb);
  }

  function onResize(){
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  window.addEventListener('resize', onResize);

  window.addEventListener('mousemove', (e)=>{
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, {passive:true});

  function animate(){
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    if(particles){
      particles.rotation.y = t * 0.03;
      particles.rotation.x = t * 0.01;
    }
    for(let i=0;i<shapes.length;i++){
      const s = shapes[i];
      const d = s.userData || {};
      // sprites don't have x/y rotation in the same way; use gentle bobbing + drift
      s.position.y += Math.sin(t*(0.45+(d.wob||1)) + i) * 0.003;
      s.position.x += Math.cos(t*(0.28+(d.wob||1)) + i) * 0.0012;
      s.material.opacity = 0.22 + (Math.sin(t*0.6 + i)*0.08 + 0.14);
    }
    camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 0.8 - camera.position.y) * 0.02;
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
  }

  document.addEventListener('DOMContentLoaded', initThreeJS);
})();

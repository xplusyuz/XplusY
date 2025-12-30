
// === index1 core (background + scroll) with guards ===
(() => {
  // Toast helper (shared)
  window.LeaderUI = window.LeaderUI || {};
  window.LeaderUI.toast = function(msg){
    const el = document.getElementById("toast");
    if(!el){ alert(msg); return; }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(window.LeaderUI.toast._t);
    window.LeaderUI.toast._t = setTimeout(()=> el.classList.remove("show"), 2600);
  };

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
    const colors = [0x0ea5e9, 0x38bdf8, 0x0369a1];
    const geoms = [
      new THREE.IcosahedronGeometry(1.2, 0),
      new THREE.TorusGeometry(1.0, 0.35, 12, 32),
      new THREE.OctahedronGeometry(1.1, 0),
    ];
    for(let i=0;i<10;i++){
      const g = geoms[i % geoms.length];
      const m = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.3,
        metalness: 0.65,
        transparent:true,
        opacity:0.35
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set((Math.random()-0.5)*24, (Math.random()-0.5)*16, (Math.random()-0.5)*18);
      mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      scene.add(mesh);
      shapes.push(mesh);
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
      s.rotation.x += 0.002 + i*0.00005;
      s.rotation.y += 0.003 + i*0.00005;
      s.position.y += Math.sin(t*0.6 + i) * 0.002;
    }
    camera.position.x += (mouse.x * 1.2 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 0.8 - camera.position.y) * 0.02;
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
  }

  document.addEventListener('DOMContentLoaded', initThreeJS);
})();


/* skin-bg.js — index1 3D background + scroll UI (namespaced) */
(function(){
  const d = document;
  const body = d.body;
  if(!body) return;

  // Scroll progress + toTop (create if missing)
  function ensureScrollUI(){
    if(!d.getElementById('scrollProgress')){
      const wrap = d.createElement('div');
      wrap.className = 'scroll-progress';
      wrap.innerHTML = '<div class="scroll-progress-bar" id="scrollProgress"></div>';
      body.prepend(wrap);
    }
    if(!d.getElementById('scrollToTop')){
      const btn = d.createElement('button');
      btn.className = 'scroll-to-top';
      btn.id = 'scrollToTop';
      btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
      body.appendChild(btn);
    }
  }

  function bindScroll(){
    const bar = d.getElementById('scrollProgress');
    const toTop = d.getElementById('scrollToTop');
    if(!bar || !toTop) return;

    window.addEventListener('scroll', () => {
      const total = Math.max(1, d.documentElement.scrollHeight - window.innerHeight);
      const prog = (window.scrollY / total) * 100;
      bar.style.width = prog + '%';
      if(window.scrollY > 300) toTop.classList.add('show');
      else toTop.classList.remove('show');
    }, {passive:true});

    toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  }

  // Three.js background
  function initThree(){
    const canvas = d.getElementById('three-canvas');
    if(!canvas || !window.THREE) return;

    let scene = new THREE.Scene();
    let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 15;

    let renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.pointerEvents = 'none';

    // lights
    scene.add(new THREE.AmbientLight(0x0ea5e9, 0.25));
    const dir = new THREE.DirectionalLight(0x38bdf8, 0.8);
    dir.position.set(10,10,5); scene.add(dir);
    const point = new THREE.PointLight(0x0ea5e9, 0.5, 100);
    point.position.set(-10,-10,10); scene.add(point);

    // particles
    const particleCount = 1200;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(particleCount * 3);
    for(let i=0;i<pos.length;i++) pos[i] = (Math.random()-0.5)*100;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({size:0.08, color:0x0ea5e9, transparent:true, opacity:0.45});
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // shapes
    function wire(geometry, color, opacity, x,y){
      const m = new THREE.MeshStandardMaterial({color, transparent:true, opacity, wireframe:true});
      const mesh = new THREE.Mesh(geometry, m);
      mesh.position.set(x,y,0);
      scene.add(mesh);
      return mesh;
    }
    const torus = wire(new THREE.TorusGeometry(3,1,16,100), 0x0ea5e9, 0.18, -12, 8);
    const ico   = wire(new THREE.IcosahedronGeometry(2),      0x38bdf8, 0.26,  12,-8);
    const sph   = wire(new THREE.SphereGeometry(2.5,32,32),    0x0369a1, 0.12, -10,-12);
    const tet   = wire(new THREE.TetrahedronGeometry(1.8),     0x7dd3fc, 0.22,   8,12);

    function onResize(){
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    let t=0;
    function anim(){
      requestAnimationFrame(anim);
      t += 0.003;
      torus.rotation.x += 0.003; torus.rotation.y += 0.003;
      ico.rotation.x   += 0.003; ico.rotation.y   += 0.003;
      sph.rotation.x   += 0.002; sph.rotation.y   += 0.002;
      tet.rotation.x   += 0.004; tet.rotation.y   += 0.004;

      points.rotation.x += 0.0005;
      points.rotation.y += 0.0005;

      // gentle camera drift
      camera.position.x = Math.sin(t)*0.6;
      camera.position.y = Math.cos(t)*0.4;

      renderer.render(scene, camera);
    }
    anim();
  }

  function ensureCanvas(){
    if(!d.getElementById('three-canvas')){
      const c = d.createElement('canvas');
      c.id = 'three-canvas';
      body.prepend(c);
    }
  }

  ensureScrollUI();
  ensureCanvas();
  bindScroll();
  initThree();
})();

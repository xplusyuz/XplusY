
/* index1-ui.js — extracted from index1.html and made reusable across pages */
(function(){
  // SCROLL UI
  const sp = document.getElementById('scrollProgress');
  const stt = document.getElementById('scrollToTop');
  if (sp) {
    window.addEventListener('scroll', () => {
      const totalHeight = document.body.scrollHeight - window.innerHeight;
      const progress = totalHeight>0 ? (window.pageYOffset / totalHeight) * 100 : 0;
      sp.style.width = progress + '%';
      if (stt) {
        if (window.pageYOffset > 300) stt.classList.add('show');
        else stt.classList.remove('show');
      }
    });
  }
  if (stt) {
    stt.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  }

  // THREE BACKGROUND
  let scene, camera, renderer, controls;
  let particles = [];
  let isRotating = true;
  let particleEffect = true;

  function initThreeJS(){
    const canvas = document.getElementById('three-canvas');
    if(!canvas || !window.THREE) return;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 15;

    renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.pointerEvents = 'none';

    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI;
      controls.minDistance = 5;
      controls.maxDistance = 50;
      controls.enablePan = false;
      controls.enableZoom = false;
    }

    const ambientLight = new THREE.AmbientLight(0x0ea5e9, 0.3); scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0x38bdf8, 0.8); directionalLight.position.set(10,10,5); scene.add(directionalLight);
    const pointLight = new THREE.PointLight(0x0ea5e9, 0.5, 100); pointLight.position.set(-10,-10,10); scene.add(pointLight);

    createParticles();
    createFloatingShapes();
    window.addEventListener('resize', onWindowResize);
    animate();
  }

  function createParticles(){
    const particleCount = 1500;
    const geo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount*3);
    for(let i=0;i<particleCount*3;i++) posArray[i]=(Math.random()-0.5)*100;
    geo.setAttribute('position', new THREE.BufferAttribute(posArray,3));
    const mat = new THREE.PointsMaterial({size:0.08, color:0x0ea5e9, transparent:true, opacity:0.5});
    const mesh = new THREE.Points(geo, mat);
    scene.add(mesh); particles.push(mesh);
  }

  function createFloatingShapes(){
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(3,1,16,100),
      new THREE.MeshStandardMaterial({color:0x0ea5e9, transparent:true, opacity:0.2, wireframe:true})
    );
    torus.position.set(-12,8,0); scene.add(torus);

    const icos = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2),
      new THREE.MeshStandardMaterial({color:0x38bdf8, transparent:true, opacity:0.3, wireframe:true})
    );
    icos.position.set(12,-8,0); scene.add(icos);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(2.5,32,32),
      new THREE.MeshStandardMaterial({color:0x0369a1, transparent:true, opacity:0.15, wireframe:true})
    );
    sphere.position.set(-10,-12,0); scene.add(sphere);

    const tetra = new THREE.Mesh(
      new THREE.TetrahedronGeometry(1.8),
      new THREE.MeshStandardMaterial({color:0x7dd3fc, transparent:true, opacity:0.25, wireframe:true})
    );
    tetra.position.set(8,12,0); scene.add(tetra);
  }

  function onWindowResize(){
    if(!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate(){
    requestAnimationFrame(animate);
    if(scene && isRotating){
      scene.children.forEach(child=>{
        if(child instanceof THREE.Mesh && child.geometry && child.geometry.type !== 'PlaneGeometry'){
          child.rotation.x += 0.003; child.rotation.y += 0.003;
        }
      });
    }
    particles.forEach(p=>{ if(particleEffect){ p.rotation.x+=0.0005; p.rotation.y+=0.0005; }});
    if(controls) controls.update();
    if(renderer && scene && camera) renderer.render(scene, camera);
  }

  // CARD tilt (desktop)
  function installCardTilt(){
    document.querySelectorAll('.card').forEach(card=>{
      card.addEventListener('mousemove',(e)=>{
        if(window.innerWidth<=768) return;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width/2;
        const centerY = rect.height/2;
        const rotateY = (x-centerX)/20;
        const rotateX = (centerY-y)/20;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
      });
      card.addEventListener('mouseleave',()=>{ card.style.transform='perspective(1000px) rotateX(0) rotateY(0) translateY(0)'; });
    });
  }

  // MODAL helper for cards with data-link (optional)
  function installModal(){
    const modal = document.getElementById('page-modal');
    const frame = document.getElementById('modal-frame');
    const closeBtn = document.getElementById('modal-close');
    if(!modal || !frame || !closeBtn) return;

    function close(){
      modal.classList.remove('open');
      frame.src = '';
      document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-link]').forEach(card=>{
      card.addEventListener('click',()=>{
        const url = card.dataset.link;
        if(!url) return;
        frame.src = url;
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });

    closeBtn.addEventListener('click', close);
    modal.addEventListener('click', e=>{ if(e.target===modal) close(); });
  }

  window.Index1UI = {
    setRotate:(v)=>{isRotating=!!v;},
    setParticles:(v)=>{particleEffect=!!v;}
  };

  document.addEventListener('DOMContentLoaded', ()=>{
    initThreeJS();
    installCardTilt();
    installModal();
  });
})();

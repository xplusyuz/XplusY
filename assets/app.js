
/* MathCenter frontend: loads admin.json and renders sections */
const state = {
  data: null,
  filters: {
    tests: { type: "all", tag: "all", q: "" }
  },
  profile: JSON.parse(localStorage.getItem("mc_profile")||"{}")
};

async function loadData() {
  try {
    const res = await fetch('admin.json', { cache:'no-store' });
    if(!res.ok) throw new Error(res.statusText);
    state.data = await res.json();
    localStorage.setItem("mc_admin_json_cache", JSON.stringify(state.data));
  } catch(e){
    // fallback to cache
    const cached = localStorage.getItem("mc_admin_json_cache");
    if(cached){ state.data = JSON.parse(cached); }
    else{
      console.warn("admin.json yuklanmadi va cache ham yo'q", e);
      state.data = { home:{banners:[]}, tests:[], courses:[], simulators:[] };
    }
  }
}

function h(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function mount(el, children){ el.innerHTML=''; children.forEach(c=>el.appendChild(c)); }

function renderBanners() {
  const wrap = document.getElementById('home-banners');
  const nodes = state.data.home.banners.map(b=>{
    const card = h(`<a class="banner-card" href="${b.link||'#'}">
      <img alt="${b.title}" loading="lazy" src="${b.image}"/>
      <div class="badge">${b.tag||''}</div>
      <div class="banner-title">${b.title}</div>
    </a>`);
    return card;
  });
  mount(wrap, nodes);
}

function pill(tag){ return tag ? `<span class="pill ${tag}">${tag}</span>` : ""; }

function card(item){
  const price = typeof item.price === 'number' ? `<span class="price">${item.price>0? (item.price+' so\'m') : 'Bepul'}</span>` : '';
  return h(`<a class="card" href="${item.link||'#'}">
    <img src="${item.image}" alt="${item.title}"/>
    <div class="content">
      <div class="row">
        ${pill(item.tag||'')}
        ${item.type? `<span class="pill">${item.type}</span>`:''}
        ${price}
      </div>
      <h3 class="title">${item.title}</h3>
      <p>${item.desc||''}</p>
    </div>
  </a>`);
}

function renderTests(){
  const { type, tag, q } = state.filters.tests;
  const list = (state.data.tests||[]).filter(x=>{
    const okType = type==='all' || x.type===type;
    const okTag = tag==='all' || (x.tag||'')===tag;
    const okQ = !q || (x.title+x.desc).toLowerCase().includes(q.toLowerCase());
    return okType && okTag && okQ;
  });
  const wrap = document.getElementById('tests-grid');
  mount(wrap, list.map(card));
  document.getElementById('tests-count').textContent = list.length;
}

function renderCourses(){
  const wrap = document.getElementById('courses-grid');
  mount(wrap, (state.data.courses||[]).map(card));
}

function renderSimulators(){
  const wrap = document.getElementById('sims-grid');
  mount(wrap, (state.data.simulators||[]).map(card));
}

function saveProfileLocally(){
  const name = document.getElementById('pf-name').value.trim();
  const region = document.getElementById('pf-region').value.trim();
  const district = document.getElementById('pf-district').value.trim();
  const uid = document.getElementById('pf-id').value.trim();
  const balance = Number(document.getElementById('pf-balance').value||0);
  const points = Number(document.getElementById('pf-points').value||0);
  state.profile = { name, region, district, uid, balance, points };
  localStorage.setItem('mc_profile', JSON.stringify(state.profile));
  renderProfileBadges();
}

function renderProfileBadges(){
  const b = document.getElementById('profile-badges');
  const P = state.profile || {};
  b.innerHTML = `
    <span class="kpi">ID: ${P.uid||'—'}</span>
    <span class="kpi">Balans: ${P.balance||0}</span>
    <span class="kpi">Ball: ${P.points||0}</span>
  `;
}

function initTabs(){
  const ids = ["home","tests","courses","sims","profile"];
  ids.forEach(id=>{
    document.getElementById(`tab-${id}`).addEventListener('click', ()=>{
      ids.forEach(x=>{
        document.getElementById(`tab-${x}`).classList.toggle('active', x===id);
        document.getElementById(`sec-${x}`).classList.toggle('active', x===id);
      });
      history.replaceState(null, "", `#${id}`);
    });
  });
  const hash = (location.hash||"#home").replace("#","");
  const start = ids.includes(hash) ? hash : "home";
  document.getElementById(`tab-${start}`).click();
}

async function boot(){
  await loadData();
  // Set theme from admin.json if provided
  if(state.data.meta && state.data.meta.theme){
    const t = state.data.meta.theme;
    for(const k of Object.keys(t)){
      document.documentElement.style.setProperty("--"+k, t[k]);
    }
  }
  renderBanners();
  renderTests();
  renderCourses();
  renderSimulators();
  // profile fill
  ["pf-name","pf-region","pf-district","pf-id","pf-balance","pf-points"].forEach(id=>{
    if(state.profile && state.profile[id.replace('pf-','')]!=null){
      document.getElementById(id).value = state.profile[id.replace('pf-','')];
    }
  });
  renderProfileBadges();
  initTabs();
  // events
  document.getElementById('tests-type').addEventListener('change', e=>{ state.filters.tests.type = e.target.value; renderTests(); });
  document.getElementById('tests-tag').addEventListener('change', e=>{ state.filters.tests.tag = e.target.value; renderTests(); });
  document.getElementById('tests-q').addEventListener('input', e=>{ state.filters.tests.q = e.target.value; renderTests(); });
  document.getElementById('pf-save').addEventListener('click', saveProfileLocally);
}
document.addEventListener('DOMContentLoaded', boot);


/* ===== Regions (Uzbekistan) ===== */
let UZ_REGIONS = {};
async function loadRegions(){
  try{
    const res = await fetch('assets/regions.json', { cache:'no-store' });
    if(res.ok){ UZ_REGIONS = await res.json(); }
  }catch(e){ console.warn('regions.json yuklanmadi', e); }
}
function fillRegionSelect(){
  const sel = document.getElementById('pf-region');
  sel.innerHTML = '<option value="" disabled selected>Viloyatni tanlang</option>' + 
    Object.keys(UZ_REGIONS).map(r=>`<option>${r}</option>`).join('');
  sel.addEventListener('change', ()=> fillDistrictSelect(sel.value));
}
function fillDistrictSelect(region){
  const sel = document.getElementById('pf-district');
  const arr = UZ_REGIONS[region] || [];
  sel.innerHTML = '<option value="" disabled selected>Tuman/Shahar</option>' + arr.map(d=>`<option>${d}</option>`).join('');
}

/* ===== Firebase Auth (Google) ===== */
const fbConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};
let auth, provider;
function initAuth(){
  if(!firebase.apps.length){ firebase.initializeApp(fbConfig); }
  auth = firebase.auth();
  provider = new firebase.auth.GoogleAuthProvider();
  // UI events
  const modal = document.getElementById('auth-modal');
  document.getElementById('btn-login').onclick = ()=> modal.classList.add('show');
  document.getElementById('auth-close').onclick = ()=> modal.classList.remove('show');
  document.getElementById('google-login').onclick = async ()=>{
    try{
      await auth.signInWithPopup(provider);
      modal.classList.remove('show');
    }catch(e){
      alert('Kirishda xatolik: ' + e.message);
    }
  };
  document.getElementById('btn-logout').onclick = ()=> auth.signOut();

  auth.onAuthStateChanged(user=>{
    if(user){
      // Greeter, set defaults
      state.profile = {
        ...state.profile,
        name: state.profile.name || (user.displayName || ''),
        uid: state.profile.uid || (user.uid.slice(0,8)), // app ichidagi ID alohida ham bo'lishi mumkin
      };
      localStorage.setItem('mc_profile', JSON.stringify(state.profile));
      document.getElementById('btn-login').style.display='none';
      document.getElementById('btn-logout').style.display='inline-flex';
    }else{
      document.getElementById('btn-login').style.display='inline-flex';
      document.getElementById('btn-logout').style.display='none';
    }
    updateGreeting();
    hydrateProfileForm();
  });
}

/* ===== Greeting bar ===== */
function updateGreeting(){
  const P = state.profile || {};
  const name = P.name || 'Mehmon';
  document.getElementById('greet-name').textContent = 'Salom, ' + name + '!';
  document.getElementById('greet-id').textContent = 'ID: ' + (P.uid || '—');
  document.getElementById('greet-balance').textContent = 'Balans: ' + (P.balance||0);
  document.getElementById('greet-points').textContent = 'Ball: ' + (P.points||0);
}

/* ===== Profile helpers ===== */
function hydrateProfileForm(){
  const ids = ["pf-name","pf-region","pf-district","pf-id","pf-balance","pf-points"];
  ids.forEach(id=>{
    const key = id.replace('pf-','');
    const el = document.getElementById(id);
    if(!el) return;
    if(key==='region' || key==='district'){
      if(state.profile[key]){
        // ensure the option exists first
        if(key==='region'){
          const r = state.profile.region;
          if(r && UZ_REGIONS[r]){
            document.getElementById('pf-region').value = r;
            fillDistrictSelect(r);
          }
        }
        if(key==='district'){
          document.getElementById('pf-district').value = state.profile.district;
        }
      }
    }else{
      if(state.profile && state.profile[key]!=null){ el.value = state.profile[key]; }
    }
  });
}

/* Extend saveProfile to read selects */
const origSave = saveProfileLocally;
saveProfileLocally = function(){
  origSave();
  updateGreeting();
};

/* ===== Boot patch ===== */
const origBoot = boot;
boot = async function(){
  await loadRegions();
  await origBoot();
  fillRegionSelect();
  // If profile already has a region, set districts
  if(state.profile && state.profile.region){ fillDistrictSelect(state.profile.region); }
  hydrateProfileForm();
  initAuth();
};

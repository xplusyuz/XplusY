const content = document.getElementById('content');
const tabbar = document.getElementById('tabbar');
const walletbar = document.getElementById('walletbar');
const topbar = document.getElementById('topbar');

const wbId = document.getElementById('wbId');
const wbBalance = document.getElementById('wbBalance');
const wbGems = document.getElementById('wbGems');
const userLine = document.getElementById('userLine');

let unsubUser=null, isAdmin=false, currentProfile=null;

async function loadPage(page){
  const res = await fetch(`./pages/${page}.html`, { cache: 'no-store' });
  const html = await res.text();
  content.innerHTML = html;
  if (page === 'settings') bindSettings();
  if (page === 'admin') bindAdmin();
}

function updateWallet(p){
  if (!p) return;
  wbId.textContent = p.numericId ?? '—';
  wbBalance.textContent = (p.balance ?? 0).toLocaleString('uz-UZ');
  wbGems.textContent = (p.gems ?? 0).toLocaleString('uz-UZ');
}
function updateHeader(p){
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(' ');
  userLine.innerHTML = `Salom, <b>${name || 'Foydalanuvchi'}</b>` + (isAdmin ? ' <span class="badge admin">Admin</span>' : '');
  updateWallet(p||{});
}

function bindSettings(){
  const adminEntry = document.getElementById('adminEntry');
  if (isAdmin && adminEntry){
    adminEntry.classList.remove('hidden');
    document.getElementById('openAdmin').onclick = ()=>{
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      loadPage('admin');
    };
  }
  document.getElementById('openProfile')?.addEventListener('click', ()=>alert('Profil modalini oldingi builddan olamiz.'));
  document.getElementById('openTopUpBtn')?.addEventListener('click', ()=>alert('TopUp modal – oldingi builddan olamiz.'));
  document.getElementById('openRatingsBtn')?.addEventListener('click', ()=>alert('Reyting modal – oldingi builddan olamiz.'));
  document.getElementById('signOut')?.addEventListener('click', ()=>auth.signOut());
}

function bindAdmin(){
  const tabSel = document.getElementById('adminTab');
  const show = (id)=>{
    ['courses','tests','promos','config'].forEach(k=>{
      document.getElementById('tab-'+k).classList.toggle('hidden', k!==id);
    });
  };
  tabSel.onchange = ()=>show(tabSel.value);
  show(tabSel.value);

  // Courses
  document.getElementById('btnAddCourse').onclick = async ()=>{
    const data = {
      title: document.getElementById('c_title').value.trim(),
      track: document.getElementById('c_track').value.trim(),
      price: Number(document.getElementById('c_price').value||0),
      bannerUrl: document.getElementById('c_banner').value.trim(),
      sortOrder: Number(document.getElementById('c_sort').value||0),
      active: document.getElementById('c_active').checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('courses').add(data);
    loadCoursesTable();
    alert('Kurs qo‘shildi');
  };
  async function loadCoursesTable(){
    const tb = document.querySelector('#coursesTable tbody');
    tb.innerHTML='';
    const qs = await db.collection('courses').orderBy('sortOrder').limit(20).get();
    qs.forEach(d=>{
      const v=d.data();
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${v.title}</td><td>${v.track}</td><td>${(v.price||0).toLocaleString('uz-UZ')}</td><td>${v.active?'✅':'❌'}</td>`;
      tb.appendChild(tr);
    });
  }
  loadCoursesTable();

  // Tests
  document.getElementById('btnAddTest').onclick = async ()=>{
    const map={A:0,B:1,C:2,D:3};
    const data={
      subject: document.getElementById('t_subject').value.trim(),
      question: document.getElementById('t_question').value.trim(),
      options: [
        document.getElementById('t_a').value.trim(),
        document.getElementById('t_b').value.trim(),
        document.getElementById('t_c').value.trim(),
        document.getElementById('t_d').value.trim()
      ],
      correctIndex: map[document.getElementById('t_correct').value] ?? 0,
      level: Number(document.getElementById('t_level').value||1),
      courseId: document.getElementById('t_courseId').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('tests').add(data);
    loadTestsTable();
    alert('Savol qo‘shildi');
  };
  async function loadTestsTable(){
    const tb = document.querySelector('#testsTable tbody');
    tb.innerHTML='';
    const qs = await db.collection('tests').orderBy('updatedAt','desc').limit(20).get();
    qs.forEach(d=>{
      const v=d.data();
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${v.subject}</td><td>${v.question.substring(0,80)}</td>`;
      tb.appendChild(tr);
    });
  }
  loadTestsTable();

  // Promos
  document.getElementById('btnAddPromo').onclick = async ()=>{
    const data={
      date: document.getElementById('p_date').value,
      gems: Number(document.getElementById('p_gems').value||0),
      terms: document.getElementById('p_terms').value.trim(),
      active: document.getElementById('p_active').checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('promos').add(data);
    loadPromosTable();
    alert('Promo qo‘shildi');
  };
  async function loadPromosTable(){
    const tb = document.querySelector('#promosTable tbody');
    tb.innerHTML='';
    const qs = await db.collection('promos').orderBy('date','desc').limit(20).get();
    qs.forEach(d=>{
      const v=d.data();
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${v.date||''}</td><td>${v.gems||0}</td><td>${v.active?'✅':'❌'}</td>`;
      tb.appendChild(tr);
    });
  }
  loadPromosTable();

  // Config
  document.getElementById('btnSaveCfg').onclick = async ()=>{
    const key = document.getElementById('cfg_key').value.trim();
    if(!key) return alert('key bo‘sh');
    await db.collection('config').doc(key).set({
      value: document.getElementById('cfg_value').value.trim(),
      note: document.getElementById('cfg_note').value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    loadCfgTable();
    alert('Config saqlandi');
  };
  async function loadCfgTable(){
    const tb = document.querySelector('#cfgTable tbody');
    tb.innerHTML='';
    const qs = await db.collection('config').limit(50).get();
    qs.forEach(d=>{
      const v=d.data();
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${d.id}</td><td>${v.value||''}</td><td>${v.note||''}</td>`;
      tb.appendChild(tr);
    });
  }
  loadCfgTable();
}

// Auth
auth.onAuthStateChanged(async (user)=>{
  if(!user){
    content.innerHTML = `<section class="section"><div class="card form">
      <h2>Kirish</h2>
      <button id="btnGoogle" class="btn">Google bilan kirish</button>
    </div></section>`;
    document.getElementById('btnGoogle').onclick = async ()=>{
      const provider = new firebase.auth.GoogleAuthProvider(); await auth.signInWithPopup(provider);
    };
    [tabbar, walletbar, topbar].forEach(el=>el.classList.add('hidden'));
    return;
  }
  [tabbar, walletbar, topbar].forEach(el=>el.classList.remove('hidden'));
  try{
    const tok = await user.getIdTokenResult(true);
    isAdmin = !!tok.claims.admin;
  }catch(e){ isAdmin = false; }

  const userRef = db.collection('users').doc(user.uid);
  if (unsubUser) unsubUser();
  unsubUser = userRef.onSnapshot(snap=>{
    currentProfile = snap.data() || { firstName: user.displayName||'Foydalanuvchi', balance:0, gems:0, numericId:'—' };
    updateHeader(currentProfile);
  });

  loadPage('home');
});

tabbar.addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab'); if(!btn) return;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t===btn));
  loadPage(btn.dataset.page);
});

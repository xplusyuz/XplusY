import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
const { db, auth, signIn, logOut, collection, addDoc, doc, setDoc, getDoc, getDocs, query, orderBy, serverTimestamp } = window.fb;

const authBtn = document.getElementById('authBtn');
const adminNotice = document.getElementById('adminNotice');
const tName = document.getElementById('tName'); const tDesc = document.getElementById('tDesc');
const tDuration = document.getElementById('tDuration'); const tDiff = document.getElementById('tDiff');
const tActive = document.getElementById('tActive'); const createBtn = document.getElementById('createTest');
const testTable = document.getElementById('testTable');

const qTest = document.getElementById('qTest'); const qText = document.getElementById('qText');
const optA = document.getElementById('optA'); const optB = document.getElementById('optB');
const optC = document.getElementById('optC'); const optD = document.getElementById('optD');
const correct = document.getElementById('correct'); const qPoints = document.getElementById('qPoints');
const qOrder = document.getElementById('qOrder'); const addQuestion = document.getElementById('addQuestion');
const qList = document.getElementById('qList');

let isAdmin = false; let tests = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) { authBtn.textContent = 'Google bilan kirish'; isAdmin=false; adminNotice.classList.remove('d-none'); testTable.innerHTML=''; qTest.innerHTML='<option value=\"\">Testni tanlang</option>'; return; }
  authBtn.textContent = 'Chiqish';
  const uref = doc(db, 'users', user.uid); const u = (await getDoc(uref)).data();
  isAdmin = (u?.role === 'admin'); adminNotice.classList.toggle('d-none', isAdmin); await loadTests();
});
authBtn.addEventListener('click', async ()=>{ if (auth.currentUser) await logOut(); else await signIn(); });

async function loadTests(){
  const qs = query(collection(db, 'tests'), orderBy('createdAt','desc'));
  const snap = await getDocs(qs);
  tests = await Promise.all(snap.docs.map(async d=>{
    const qSnap = await getDocs(collection(db, `tests/${d.id}/questions`));
    return { id:d.id, questionCount:qSnap.size, ...d.data() };
  }));
  renderTests(); fillTestSelect();
  typesetSoon();
}
function renderTests(){
  testTable.innerHTML='';
  tests.forEach(t=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${t.title}</td><td>${t.questionCount}</td><td>${t.duration}m</td><td>${t.isActive?'✅':'—'}</td>
      <td><button class="btn btn-sm btn-outline-primary" data-id="${t.id}">Savollar</button></td>`;
    testTable.appendChild(tr);
  });
  testTable.querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=> openQuestions(b.dataset.id)));
}
function fillTestSelect(){ qTest.innerHTML='<option value=\"\">Testni tanlang</option>'; tests.forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.title; qTest.appendChild(o); }); }

createBtn.addEventListener('click', async ()=>{
  if(!isAdmin) return alert('Siz admin emassiz');
  const title=tName.value.trim(); const description=tDesc.value.trim(); const duration=parseInt(tDuration.value||'20',10);
  const difficulty=tDiff.value; const isActive=tActive.checked; if(!title) return alert('Nomi kerak');
  const ref = doc(collection(db, 'tests')); await setDoc(ref,{ title, description, duration, difficulty, isActive, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
  tName.value=tDesc.value=tDuration.value=''; tActive.checked=false; tDiff.value="O'rta"; await loadTests();
});

addQuestion.addEventListener('click', async ()=>{
  if(!isAdmin) return alert('Siz admin emassiz');
  const testId=qTest.value; if(!testId) return alert('Test tanlang');
  const text=qText.value.trim(); if(!text) return alert('Savol matni');
  const options=[optA.value, optB.value, optC.value, optD.value]; if(options.some(v=>!v||!v.trim())) return alert('Barcha variantlar kerak');
  const correctMap={A:0,B:1,C:2,D:3}; const correctIndex=correctMap[correct.value];
  const points=parseInt(qPoints.value||'1',10); const order=parseInt(qOrder.value||'1',10);
  await addDoc(collection(db, `tests/${testId}/questions`),{ text, options, correctIndex, points, order, createdAt: serverTimestamp() });
  qText.value = optA.value = optB.value = optC.value = optD.value = ''; qPoints.value=1; qOrder.value=1;
  await openQuestions(testId);
});

async function openQuestions(testId){
  const snap = await getDocs(collection(db, `tests/${testId}/questions`));
  const arr = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.order??0)-(b.order??0));
  qList.innerHTML = `<div class="card"><div class="card-body"><h5 class="mb-3">Savollar (${arr.length}):</h5>${
    arr.map((q,i)=>`<div class="mb-2"><b>${i+1}.</b> <span class="qtex">${q.text}</span> <span class="badge bg-secondary ms-2">ball: ${q.points??1}</span></div>`).join('')
  }</div></div>`;
  typesetSoon();
}

// Debounced MathJax typeset for admin list
let mjTimer=null;
function typesetSoon(){ if(mjTimer) clearTimeout(mjTimer); mjTimer=setTimeout(()=>{ if(window.MathJax?.typesetPromise) window.MathJax.typesetPromise(); }, 150); }

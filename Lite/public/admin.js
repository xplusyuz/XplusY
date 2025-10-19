import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
const { db, storage, auth, signIn, logOut, collection, addDoc, doc, setDoc, getDoc, getDocs, query, orderBy, serverTimestamp, uploadAttachment } = window.fb;

const adminEmail = "sohibjonmath@gmail.com";
const authBtn = document.getElementById('authBtn');
const adminNotice = document.getElementById('adminNotice');

const tName = document.getElementById('tName'); const tDesc = document.getElementById('tDesc');
const tDuration = document.getElementById('tDuration'); const tDiff = document.getElementById('tDiff');
const tActive = document.getElementById('tActive'); const tTags = document.getElementById('tTags');
const tBacktrack = document.getElementById('tBacktrack'); const tRndQ = document.getElementById('tRndQ'); const tRndO = document.getElementById('tRndO');
const createBtn = document.getElementById('createTest'); const exportJSON = document.getElementById('exportJSON'); const exportCSV = document.getElementById('exportCSV');
const importFile = document.getElementById('importFile'); const importBtn = document.getElementById('importBtn');

const testTable = document.getElementById('testTable');
const qTest = document.getElementById('qTest'); const qText = document.getElementById('qText');
const optA = document.getElementById('optA'); const optB = document.getElementById('optB'); const optC = document.getElementById('optC'); const optD = document.getElementById('optD');
const correct = document.getElementById('correct'); const qPoints = document.getElementById('qPoints'); const qOrder = document.getElementById('qOrder');
const imgUrl = document.getElementById('imgUrl'); const pdfUrl = document.getElementById('pdfUrl'); const attachFile = document.getElementById('attachFile');
const addQuestion = document.getElementById('addQuestion'); const qList = document.getElementById('qList');

let isAdmin = false; let tests = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) { authBtn.textContent = 'Google hisob'; isAdmin=false; adminNotice.classList.remove('d-none'); clearUI(); return; }
  authBtn.textContent = 'Chiqish';
  isAdmin = (user.email === adminEmail);
  adminNotice.classList.toggle('d-none', isAdmin);
  await loadTests();
});
authBtn.addEventListener('click', async ()=>{ if (auth.currentUser) await logOut(); else await signIn(); });

function clearUI(){ testTable.innerHTML=''; qTest.innerHTML='<option value=\"\">Testni tanlang</option>'; qList.innerHTML=''; }

async function loadTests(){
  const qs = query(collection(db, 'tests'), orderBy('createdAt','desc'));
  const snap = await getDocs(qs);
  tests = await Promise.all(snap.docs.map(async d=>{
    const qSnap = await getDocs(collection(db, `tests/${d.id}/questions`));
    return { id:d.id, questionCount:qSnap.size, ...d.data() };
  }));
  renderTests(); fillTestSelect(); typesetSoon();
}
function renderTests(){
  testTable.innerHTML='';
  tests.forEach(t=>{
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${t.title}</td><td>${t.questionCount}</td><td>${t.duration}m</td><td>${t.isActive?'✅':'—'}</td>
      <td>${t.allowBacktracking!==false?'✅':'—'}</td><td>${t.randomizeQuestions?'✅':'—'}</td><td>${t.randomizeOptions?'✅':'—'}</td>
      <td><button class="btn btn-sm btn-outline-primary" data-id="${t.id}">Savollar</button></td>`;
    testTable.appendChild(tr);
  });
  testTable.querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=> openQuestions(b.dataset.id)));
}
function fillTestSelect(){ qTest.innerHTML='<option value=\"\">Testni tanlang</option>'; tests.forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.title; qTest.appendChild(o); }); }

createBtn.addEventListener('click', async ()=>{
  if(!isAdmin) return alert('Faqat admin!');
  const title=tName.value.trim(); const description=tDesc.value.trim(); const duration=parseInt(tDuration.value||'20',10);
  const difficulty=tDiff.value; const isActive=tActive.checked;
  const tags = tTags.value.split(',').map(s=>s.trim()).filter(Boolean);
  const allowBacktracking = tBacktrack.checked;
  const randomizeQuestions = tRndQ.checked;
  const randomizeOptions = tRndO.checked;
  if(!title) return alert('Nomi kerak');
  const ref = doc(collection(db, 'tests'));
  await setDoc(ref,{ title, description, duration, difficulty, isActive, tags, allowBacktracking, randomizeQuestions, randomizeOptions, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
  tName.value=tDesc.value=tDuration.value=''; tActive.checked=false; tDiff.value="O'rta"; tTags.value=''; tBacktrack.checked=true; tRndQ.checked=false; tRndO.checked=false;
  await loadTests();
});

addQuestion.addEventListener('click', async ()=>{
  if(!isAdmin) return alert('Faqat admin!');
  const testId=qTest.value; if(!testId) return alert('Test tanlang');
  const text=qText.value.trim(); if(!text) return alert('Savol matni');
  const options=[optA.value, optB.value, optC.value, optD.value]; if(options.some(v=>!v||!v.trim())) return alert('Barcha variantlar kerak');
  const correctMap={A:0,B:1,C:2,D:3}; const correctIndex=correctMap[correct.value];
  const points=parseInt(qPoints.value||'1',10); const order=parseInt(qOrder.value||'1',10);

  // upload if file selected
  let img = imgUrl.value.trim(); let pdf = pdfUrl.value.trim();
  const f = attachFile.files[0];
  if (f) {
    const path = f.type === 'application/pdf' ? `questions/${testId}/pdf/${Date.now()}_${f.name}` : `questions/${testId}/img/${Date.now()}_${f.name}`;
    const url = await uploadAttachment(f, path);
    if (f.type === 'application/pdf') pdf = url; else img = url;
  }

  await addDoc(collection(db, `tests/${testId}/questions`),{ text, options, correctIndex, points, order, imageUrl: img || null, pdfUrl: pdf || null, createdAt: serverTimestamp() });
  qText.value = optA.value = optB.value = optC.value = optD.value = ''; qPoints.value=1; qOrder.value=1; imgUrl.value=''; pdfUrl.value=''; attachFile.value='';
  await openQuestions(testId);
});

async function openQuestions(testId){
  const snap = await getDocs(collection(db, `tests/${testId}/questions`));
  const arr = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.order??0)-(b.order??0));
  qList.innerHTML = `<div class="card"><div class="card-body"><h5 class="mb-3">Savollar (${arr.length}):</h5>${
    arr.map((q,i)=>`<div class="mb-3"><b>${i+1}.</b> <span class="qtex">${q.text}</span> <span class="badge bg-secondary ms-2">ball: ${q.points??1}</span>${
      q.imageUrl? `<div><img src="${q.imageUrl}" class="attach-thumb"/></div>`:''
    }${ q.pdfUrl? `<div class="mt-1"><a class="pdf-link" href="${q.pdfUrl}" target="_blank"><i class="fa-regular fa-file-pdf"></i> PDF</a></div>`:''}
    </div>`).join('')
  }</div></div>`;
  typesetSoon();
}

// EXPORT / IMPORT
exportJSON.addEventListener('click', async ()=>{
  const testId=qTest.value; if(!testId) return alert('Test tanlang');
  const snap = await getDocs(collection(db, `tests/${testId}/questions`));
  const arr = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.order??0)-(b.order??0));
  const data = arr.map(({id,text,options,correctIndex,points,order,imageUrl,pdfUrl})=>({id,text,options,correctIndex,points,order,imageUrl,pdfUrl}));
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='questions.json'; a.click(); URL.revokeObjectURL(url);
});
exportCSV.addEventListener('click', async ()=>{
  const testId=qTest.value; if(!testId) return alert('Test tanlang');
  const snap = await getDocs(collection(db, `tests/${testId}/questions`));
  const arr = snap.docs.map(d=>({id:d.id, ...d.data()})).sort((a,b)=>(a.order??0)-(b.order??0));
  const header = ["order","points","text","A","B","C","D","correctIndex","imageUrl","pdfUrl"];
  const rows = arr.map(q=>[q.order||'', q.points||1, q.text||'', q.options?.[0]||'', q.options?.[1]||'', q.options?.[2]||'', q.options?.[3]||'', q.correctIndex??0, q.imageUrl||'', q.pdfUrl||'']);
  const csv = [header, *rows].map(r=> r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='questions.csv'; a.click(); URL.revokeObjectURL(url);
});
importBtn.addEventListener('click', async ()=>{
  if(!isAdmin) return alert('Faqat admin!');
  const testId=qTest.value; if(!testId) return alert('Test tanlang');
  const file = importFile.files[0]; if(!file) return alert('Fayl tanlang');
  const txt = await file.text();
  let items=[];
  try{
    if (file.name.endsWith('.json')) { items = JSON.parse(txt); }
    else if (file.name.endsWith('.csv')) {
      const lines = txt.split(/\r?\n/).filter(Boolean);
      const [header, *rows] = lines;
      const cols = header.split(',').map(s=>s.replace(/^"|"$/g,''));
      for (const line of rows){
        const parts = line.match(/("(?:[^"]|"")*"|[^,]+)/g)?.map(s=> s.replace(/^"|"$/g,'').replace(/""/g,'"')) || [];
        const obj = {}; cols.forEach((c,i)=> obj[c]=parts[i]||"");
        items.push({
          order: parseInt(obj.order||'0',10), points: parseInt(obj.points||'1',10),
          text: obj.text, options: [obj.A,obj.B,obj.C,obj.D],
          correctIndex: parseInt(obj.correctIndex||'0',10), imageUrl: obj.imageUrl||null, pdfUrl: obj.pdfUrl||null
        });
      }
    } else { return alert('Faqt .json yoki .csv'); }
  }catch(e){ console.error(e); return alert('Faylni o‘qib bo‘lmadi'); }
  // Write
  for (const q of items){
    await addDoc(collection(db, `tests/${testId}/questions`),{
      text: q.text, options: q.options, correctIndex: q.correctIndex||0, points: q.points||1, order: q.order||1,
      imageUrl: q.imageUrl||null, pdfUrl: q.pdfUrl||null, createdAt: serverTimestamp()
    });
  }
  await openQuestions(testId);
});

// MathJax debounce
let mjTimer=null;
function typesetSoon(){ if(mjTimer) clearTimeout(mjTimer); mjTimer=setTimeout(()=>{ if(window.MathJax?.typesetPromise) window.MathJax.typesetPromise(); }, 150); }

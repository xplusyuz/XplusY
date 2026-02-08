import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const fn = getFunctions(app);

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const importForm = document.getElementById("importForm");
const urlEl = document.getElementById("url");
const statusEl = document.getElementById("status");
const userLine = document.getElementById("userLine");
const btnImport = document.getElementById("btnImport");
const btnClear = document.getElementById("btnClear");
const recent = document.getElementById("recent");

function setStatus(msg, kind="muted"){
  statusEl.className = "status " + kind;
  statusEl.textContent = msg || "";
}
function fmtTime(ts){
  try{
    const d = ts?.toDate?.() ?? null;
    if(!d) return "";
    return new Intl.DateTimeFormat("uz-UZ", {dateStyle:"medium", timeStyle:"short"}).format(d);
  }catch{ return ""; }
}

btnLogin.addEventListener("click", async () => {
  setStatus("");
  const provider = new GoogleAuthProvider();
  try{
    await signInWithPopup(auth, provider);
  }catch(e){
    setStatus("Login xato: " + (e?.message || e), "muted");
  }
});

btnLogout.addEventListener("click", async () => {
  setStatus("");
  await signOut(auth);
});

btnClear.addEventListener("click", () => {
  urlEl.value = "";
  setStatus("");
});

onAuthStateChanged(auth, (user) => {
  if(user){
    userLine.textContent = `Kirdi: ${user.email || user.uid}`;
    btnLogout.disabled = false;
    btnImport.disabled = false;
  }else{
    userLine.textContent = "Kirmagan (admin bo‘lsangiz Google bilan kiring).";
    btnLogout.disabled = true;
    btnImport.disabled = true;
  }
});

importForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Import qilinmoqda...");
  btnImport.disabled = true;

  const url = urlEl.value.trim();
  if(!/^https?:\/\//i.test(url)){
    setStatus("URL noto‘g‘ri. https:// bilan boshlansin.", "muted");
    btnImport.disabled = false;
    return;
  }

  try{
    const call = httpsCallable(fn, "import1688Product");
    const res = await call({ url });
    const data = res?.data;
    if(data?.ok){
      setStatus("✅ Import bo‘ldi. ID: " + data.id, "muted");
      urlEl.value = "";
    }else{
      setStatus("Xato: " + (data?.error || "noma’lum"), "muted");
    }
  }catch(err){
    setStatus("Xato: " + (err?.message || err), "muted");
  }finally{
    btnImport.disabled = !auth.currentUser;
  }
});

// Recent imports
const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(12));
onSnapshot(q, (snap) => {
  recent.innerHTML = "";
  snap.docs.forEach(d => {
    const p = d.data();
    const wrap = document.createElement("div");
    wrap.className = "recentItem";

    const left = document.createElement("div");
    left.className = "left";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = p.title || "Nomsiz";
    const s = document.createElement("div");
    s.className = "s";
    s.textContent = `${p.priceText || ""} • ${fmtTime(p.createdAt)}`
    left.appendChild(t);
    left.appendChild(s);

    const right = document.createElement("a");
    right.className = "badge";
    right.href = p.sourceUrl || "#";
    right.target = "_blank";
    right.rel = "noreferrer";
    right.textContent = "Ochish";

    wrap.appendChild(left);
    wrap.appendChild(right);
    recent.appendChild(wrap);
  });
});

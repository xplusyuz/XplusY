import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
export const ADMIN_IDS = [1000001, 1000002];

async function ensureUser(user){
  const uref = doc(db, "users", user.uid);
  const snap = await getDoc(uref);
  if (!snap.exists()) {
    const cref = doc(db, "counters", "numericId");
    const numericId = await runTransaction(db, async (tx)=>{
      const csnap = await tx.get(cref);
      let last = 1000000;
      if (csnap.exists()) { last = csnap.data().last || 1000000; }
      const next = last + 1;
      tx.set(cref, { last: next }, { merge: true });
      return next;
    });
    await setDoc(uref, {
      numericId,
      firstName: user.displayName || "",
      phone: "",
      balance: 0,
      gems: 0,
      badges: [],
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
  } else {
    await updateDoc(uref, { lastLogin: serverTimestamp() });
  }
}

function bindHeader(uDoc){
  $("#uId").textContent = uDoc?.numericId ?? "—";
  $("#uBal").textContent = (uDoc?.balance ?? 0).toLocaleString('uz-UZ');
  $("#uGems").textContent = (uDoc?.gems ?? 0).toLocaleString('uz-UZ');
}

async function fetchUserDoc(uid){
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

document.addEventListener("DOMContentLoaded", ()=>{
  const btnLogin = $("#btnLogin");
  const btnLogout = $("#btnLogout");
  btnLogout.style.display = "none";

  btnLogin.addEventListener("click", async ()=>{
    try{ await signInWithPopup(auth, provider); }catch(e){ alert("Kirishda xato: "+(e?.message||e)); }
  });
  btnLogout.addEventListener("click", ()=> signOut(auth));

  onAuthStateChanged(auth, async (user)=>{
    if (user){
      btnLogin.style.display = "none"; btnLogout.style.display = "";
      await ensureUser(user);
      const uDoc = await fetchUserDoc(user.uid);
      bindHeader(uDoc);
      window.__user = { user, uDoc };
      document.dispatchEvent(new CustomEvent("auth:ready", { detail: { user, uDoc } }));
    } else {
      btnLogin.style.display = ""; btnLogout.style.display = "none";
      $("#uId").textContent = "—"; $("#uBal").textContent = "0"; $("#uGems").textContent = "0";
      window.__user = null;
      document.dispatchEvent(new CustomEvent("auth:ready", { detail: null }));
    }
  });
});

export async function updateBalance(uid, delta){
  await runTransaction(db, async (tx)=>{
    const ref = doc(db,"users",uid);
    const snap = await tx.get(ref);
    if(!snap.exists()) throw new Error("user missing");
    const cur = snap.data().balance||0;
    const next = cur + delta;
    if (next < 0) throw new Error("Balans yetarli emas");
    tx.update(ref, { balance: next });
  });
}
export async function updateGems(uid, delta){
  await runTransaction(db, async (tx)=>{
    const ref = doc(db,"users",uid);
    const snap = await tx.get(ref);
    if(!snap.exists()) throw new Error("user missing");
    const cur = snap.data().gems||0;
    const next = Math.max(0, cur + delta);
    tx.update(ref, { gems: next });
  });
}
export async function getTopGems(limitN=100){
  const q = query(collection(db,"users"), orderBy("gems","desc"), limit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map(d=> d.data());
}
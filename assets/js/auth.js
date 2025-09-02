
// assets/js/auth.js
import {
  auth, db, provider,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  doc, getDoc, setDoc, updateDoc, runTransaction, serverTimestamp
} from "./firebase.js";

const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

export let currentUser = null;
export let currentUserProfile = null;

export function titleFromPoints(points){
  const n = points || 0;
  if(n >= 10000) return "Legend";
  if(n >= 5000) return "Diamond";
  if(n >= 2000) return "Platinum";
  if(n >= 1000) return "Gold";
  if(n >= 500) return "Silver";
  if(n >= 100) return "Bronze";
  return "Newbie";
}

async function ensureUserProfile(user){
  const uref = doc(db, "users", user.uid);
  const snap = await getDoc(uref);

  if(!snap.exists()){
    await runTransaction(db, async (tx) => {
      const metaRef = doc(db, "meta", "counters");
      const metaSnap = await tx.get(metaRef);
      let last = metaSnap.exists() ? (metaSnap.data().lastUserId || 100000) : 100000;
      const next = last + 1;
      tx.set(metaRef, { lastUserId: next }, { merge: true });
      tx.set(uref, {
        uid: user.uid,
        idNumber: next,
        displayName: user.displayName || user.email?.split("@")[0] || "Foydalanuvchi",
        photoURL: user.photoURL || "",
        balance: 0,
        points: 0,
        title: "Newbie",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  }

  // derive
  const after = await getDoc(uref);
  const data = after.data() || {};
  const title = titleFromPoints(data.points || 0);
  if(data.title !== title){
    await updateDoc(uref, { title, updatedAt: serverTimestamp() });
  }
  return (await getDoc(uref)).data();
}

function updateHeaderUI(){
  const elGuest = $("#guest-actions");
  const elUser = $("#user-actions");
  const elHello = $("#menu-hello");
  const elHelloDetails = $("#menu-hello-details");

  if(currentUser && currentUserProfile){
    elGuest?.classList.add("hidden");
    elUser?.classList.remove("hidden");
    $("#chip-id .val")?.replaceChildren(document.createTextNode(String(currentUserProfile.idNumber || "")));
    $("#chip-balance .val")?.replaceChildren(document.createTextNode(String(currentUserProfile.balance ?? 0)));
    $("#chip-title .val")?.replaceChildren(document.createTextNode(currentUserProfile.title || ""));
    if(elHello) elHello.textContent = "Salom! " + (currentUserProfile.displayName || "Foydalanuvchi");
    if(elHelloDetails) elHelloDetails.textContent = `Ball: ${currentUserProfile.points || 0} • Unvon: ${currentUserProfile.title}`;
  }else{
    elGuest?.classList.remove("hidden");
    elUser?.classList.add("hidden");
    if(elHello) elHello.textContent = "Salom! Mehmon";
    if(elHelloDetails) elHelloDetails.textContent = "Kirish orqali imkoniyatlarni oching";
  }
}

export function openModal(sel){ $(sel)?.classList.add("show"); }
export function closeModal(sel){ $(sel)?.classList.remove("show"); }

export async function signInWithGoogle(){
  try{
    if(/Mobi|Android/i.test(navigator.userAgent)){
      await signInWithRedirect(auth, provider);
    }else{
      await signInWithPopup(auth, provider);
    }
  }catch(e){ alert("Google orqali kirishda xatolik: " + (e.message || e)); }
}
export async function emailPasswordLogin(email, password){ await signInWithEmailAndPassword(auth, email, password); }
export async function emailPasswordRegister(name, email, password){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if(name){ await updateProfile(cred.user, { displayName: name }); }
}
export async function doSignOut(){ await signOut(auth); }

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  currentUserProfile = user ? await ensureUserProfile(user) : null;
  updateHeaderUI();
  const requiresAuth = document.body.dataset.requireAuth === "1";
  if(requiresAuth && !currentUser){ openModal("#loginModal"); }
});

// Event bindings (use event delegation; header is injected later)
document.addEventListener("click", (e) => {
  const t = e.target;
  if(!(t instanceof HTMLElement)) return;
  if(t.closest("[data-open]")){
    const target = t.closest("[data-open]").getAttribute("data-open");
    if(target) openModal(target);
  }
  if(t.closest("[data-close]")){
    const target = t.closest("[data-close]").getAttribute("data-close");
    if(target) closeModal(target);
  }
  if(t.closest("#googleSignInBtn")){
    signInWithGoogle();
  }
  if(t.closest("#signOutBtn")){
    doSignOut();
  }
});

document.addEventListener("submit", async (e) => {
  const form = e.target;
  if(!(form instanceof HTMLFormElement)) return;
  if(form.matches("#loginForm")){
    e.preventDefault();
    try{
      await emailPasswordLogin(form.email.value.trim(), form.password.value);
      closeModal("#loginModal");
    }catch(err){ alert("Kirishda xatolik: " + (err.message || err)); }
  }
  if(form.matches("#registerForm")){
    e.preventDefault();
    try{
      await emailPasswordRegister(form.name.value.trim(), form.email.value.trim(), form.password.value);
      closeModal("#registerModal");
    }catch(err){ alert("Ro'yxatdan o'tishda xatolik: " + (err.message || err)); }
  }
});

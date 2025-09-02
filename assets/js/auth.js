
// assets/js/auth.js
import {
  auth, db, provider,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  doc, getDoc, setDoc, updateDoc, runTransaction, serverTimestamp
} from "./firebase.js";

// --- UI helpers ---
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

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

  // Create counters doc if needed via transaction when creating first user doc
  if(!snap.exists()){
    await runTransaction(db, async (tx) => {
      const metaRef = doc(db, "meta", "counters");
      const metaSnap = await tx.get(metaRef);
      let lastUserId = 100000; // start before the first id
      if(metaSnap.exists()){
        lastUserId = metaSnap.data().lastUserId || 100000;
      }
      const newId = lastUserId + 1;
      tx.set(metaRef, { lastUserId: newId }, { merge: true });

      const profile = {
        uid: user.uid,
        idNumber: newId,
        displayName: user.displayName || user.email?.split("@")[0] || "Foydalanuvchi",
        photoURL: user.photoURL || "",
        balance: 0,
        points: 0,
        title: "Newbie",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      tx.set(uref, profile, { merge: true });
    });
  }

  // Update derived fields just in case
  await updateDoc(uref, {
    title: titleFromPoints((await getDoc(uref)).data().points || 0),
    updatedAt: serverTimestamp(),
  });

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

    // Fill header user chips
    $("#chip-id .val")?.replaceChildren(document.createTextNode(String(currentUserProfile.idNumber || "")));
    $("#chip-balance .val")?.replaceChildren(document.createTextNode(String(currentUserProfile.balance ?? 0)));
    $("#chip-title .val")?.replaceChildren(document.createTextNode(currentUserProfile.title || ""));

    // Menu hello
    if(elHello) elHello.textContent = "Salom! " + (currentUserProfile.displayName || "Foydalanuvchi");
    if(elHelloDetails) elHelloDetails.textContent = `Ball: ${currentUserProfile.points || 0} • Unvon: ${currentUserProfile.title}`;
  }else{
    elGuest?.classList.remove("hidden");
    elUser?.classList.add("hidden");
    if(elHello) elHello.textContent = "Salom! Mehmon";
    if(elHelloDetails) elHelloDetails.textContent = "Kirish orqali imkoniyatlarni oching";
  }
}

export async function requireAuthIfNeeded(){
  const requiresAuth = document.body.dataset.requireAuth === "1";
  if(requiresAuth && !currentUser){
    openModal("#loginModal");
  }
}

export function openModal(sel){ $(sel)?.classList.add("show"); }
export function closeModal(sel){ $(sel)?.classList.remove("show"); }

// --- Auth flows ---
export async function signInWithGoogle(){
  try{
    if(/Mobi|Android/i.test(navigator.userAgent)){
      await signInWithRedirect(auth, provider);
    }else{
      await signInWithPopup(auth, provider);
    }
  }catch(e){
    console.error(e);
    alert("Google orqali kirishda xatolik: " + (e.message || e));
  }
}

export async function emailPasswordLogin(email, password){
  await signInWithEmailAndPassword(auth, email, password);
}

export async function emailPasswordRegister(name, email, password){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if(name){
    await updateProfile(cred.user, { displayName: name });
  }
}

export async function doSignOut(){
  await signOut(auth);
}

// Listen auth state
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  if(user){
    currentUserProfile = await ensureUserProfile(user);
  }else{
    currentUserProfile = null;
  }
  updateHeaderUI();
  requireAuthIfNeeded();
});

// Bind login/register forms if present
document.addEventListener("click", (e) => {
  const t = e.target;
  if(!(t instanceof HTMLElement)) return;
  if(t.matches("[data-open]")){
    const target = t.getAttribute("data-open");
    if(target) openModal(target);
  }
  if(t.matches("[data-close]")){
    const target = t.getAttribute("data-close");
    if(target) closeModal(target);
  }
  if(t.matches("#googleSignInBtn")){
    signInWithGoogle();
  }
});

document.addEventListener("submit", async (e) => {
  const form = e.target;
  if(!(form instanceof HTMLFormElement)) return;
  if(form.matches("#loginForm")){
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    try{
      await emailPasswordLogin(email, password);
      closeModal("#loginModal");
    }catch(err){
      alert("Kirishda xatolik: " + (err.message || err));
    }
  }
  if(form.matches("#registerForm")){
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    try{
      await emailPasswordRegister(name, email, password);
      closeModal("#registerModal");
    }catch(err){
      alert("Ro'yxatdan o'tishda xatolik: " + (err.message || err));
    }
  }
});

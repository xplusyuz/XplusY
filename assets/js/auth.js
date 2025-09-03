import { auth, db, provider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, doc, getDoc, setDoc, updateDoc, runTransaction, serverTimestamp } from "./firebase.js";
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
function titleFromPoints(n){ n=n||0; return n>=1e4?"Legend":n>=5e3?"Diamond":n>=2e3?"Platinum":n>=1e3?"Gold":n>=500?"Silver":n>=100?"Bronze":"Newbie"; }
async function ensureUserProfile(user){
  const uref = doc(db, "users", user.uid);
  const snap = await getDoc(uref);
  if(!snap.exists()){
    await runTransaction(db, async (tx)=>{
      const metaRef = doc(db, "meta", "counters");
      const metaSnap = await tx.get(metaRef);
      let last = 100000;
      if(metaSnap.exists() && typeof metaSnap.data().lastUserId === "number"){ last = metaSnap.data().lastUserId; tx.update(metaRef, { lastUserId: last + 1 }); }
      else if(metaSnap.exists() && typeof metaSnap.data().nextUserId === "number"){ last = metaSnap.data().nextUserId - 1; tx.update(metaRef, { nextUserId: last + 2 }); }
      else { tx.set(metaRef, { lastUserId: last + 1 }, { merge:true }); }
      const numericId = last + 1;
      tx.set(uref, { uid:user.uid, numericId, displayName:user.displayName || (user.email||'').split('@')[0] || 'Foydalanuvchi', photoURL:user.photoURL||'', balance:0, points:0, title:'Newbie', createdAt:serverTimestamp(), updatedAt:serverTimestamp() }, { merge:true });
    });
  }else{
    const d = snap.data()||{};
    if(typeof d.numericId !== 'number'){
      await runTransaction(db, async (tx)=>{
        const metaRef = doc(db, 'meta', 'counters');
        const metaSnap = await tx.get(metaRef);
        let last = 100000;
        if(metaSnap.exists() && typeof metaSnap.data().lastUserId === 'number'){ last = metaSnap.data().lastUserId; tx.update(metaRef, { lastUserId: last + 1 }); }
        else if(metaSnap.exists() && typeof metaSnap.data().nextUserId === 'number'){ last = metaSnap.data().nextUserId - 1; tx.update(metaRef, { nextUserId: last + 2 }); }
        else { tx.set(metaRef, { lastUserId: last + 1 }, { merge:true }); }
        const numericId = last + 1;
        tx.update(uref, { numericId, updatedAt:serverTimestamp() });
      });
    }
    const d2 = (await getDoc(uref)).data()||{}; const t = titleFromPoints(d2.points||0);
    if(d2.title !== t){ await updateDoc(uref, { title:t, updatedAt:serverTimestamp() }); }
  }
  return (await getDoc(uref)).data();
}
function setTextAll(sel, text){ $$(sel).forEach(el=>{ el.textContent = text }) }
function toggleAll(sel, show){ $$(sel).forEach(el=> el.classList[show?'remove':'add']('hidden')) }
function updateHeaderUI(user, profile){
  const logged = !!user && !!profile;
  toggleAll('.guest-actions', !logged);
  toggleAll('.user-actions', logged);
  if(logged){
    setTextAll('[data-val="id"]', String(profile.numericId || ""));
    setTextAll('[data-val="balance"]', String(profile.balance ?? 0));
    setTextAll('[data-val="title"]', profile.title || "");
    setTextAll('[data-val="hello-name"]', profile.displayName || "Foydalanuvchi");
    setTextAll('#menu-hello', "Salom! " + (profile.displayName || "Foydalanuvchi"));
    setTextAll('#menu-hello-details', `Ball: ${profile.points || 0} • Unvon: ${profile.title}`);
  }else{
    setTextAll('#menu-hello', "Salom! Mehmon");
    setTextAll('#menu-hello-details', "Kirish orqali imkoniyatlarni oching");
  }
}
export async function signInWithGoogle(){ try{ const { signInWithPopup, signInWithRedirect, GoogleAuthProvider } = await import("./firebase.js"); const isMobile=/Mobi|Android/i.test(navigator.userAgent); const provider=new GoogleAuthProvider(); if(isMobile) await signInWithRedirect(auth, provider); else await signInWithPopup(auth, provider); }catch(e){ alert("Google orqali kirishda xatolik: " + (e.message||e)); } }
export async function emailPasswordLogin(email, password){ const { signInWithEmailAndPassword } = await import("./firebase.js"); await signInWithEmailAndPassword(auth, email, password); }
export async function emailPasswordRegister(name, email, password){ const { createUserWithEmailAndPassword, updateProfile } = await import("./firebase.js"); const cred=await createUserWithEmailAndPassword(auth, email, password); if(name){ await updateProfile(cred.user, { displayName:name }); } }
export async function doSignOut(){ const { signOut } = await import("./firebase.js"); await signOut(auth); }
onAuthStateChanged(auth, async (user)=>{
  const profile = user ? await ensureUserProfile(user) : null;
  updateHeaderUI(user, profile);
  const requiresAuth = document.body.dataset.requireAuth === "1";
  if(requiresAuth && !user){ document.querySelector("#loginModal")?.classList.add("show"); }
});
document.addEventListener("click",(e)=>{
  const t=e.target; if(!(t instanceof HTMLElement)) return;
  if(t.closest("[data-open]")){ const id=t.closest("[data-open]").getAttribute("data-open"); document.querySelector(id)?.classList.add("show"); }
  if(t.closest("[data-close]")){ const id=t.closest("[data-close]").getAttribute("data-close"); document.querySelector(id)?.classList.remove("show"); }
  if(t.closest("#googleSignInBtn")){ import("./auth.js").then(m=>m.signInWithGoogle()); }
  if(t.closest("#signOutBtn")){ import("./auth.js").then(m=>m.doSignOut()); }
});
document.addEventListener("submit", async (e)=>{
  const f=e.target; if(!(f instanceof HTMLFormElement)) return;
  if(f.matches("#loginForm")){ e.preventDefault(); try{ const { emailPasswordLogin } = await import("./auth.js"); await emailPasswordLogin(f.email.value.trim(), f.password.value); document.querySelector("#loginModal")?.classList.remove("show"); }catch(err){ alert("Kirishda xatolik: " + (err.message||err)); } }
  if(f.matches("#registerForm")){ e.preventDefault(); try{ const { emailPasswordRegister } = await import("./auth.js"); await emailPasswordRegister(f.name.value.trim(), f.email.value.trim(), f.password.value); document.querySelector("#registerModal")?.classList.remove("show"); }catch(err){ alert("Ro'yxatdan o'tishda xatolik: " + (err.message||err)); } }
});

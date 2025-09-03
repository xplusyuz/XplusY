import { auth, db, provider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, doc, getDoc, setDoc, updateDoc, runTransaction, serverTimestamp } from "./firebase.js";
const $=(s,r=document)=>r.querySelector(s);

export let currentUser=null;
export let currentUserProfile=null;

function titleFromPoints(n){ n=n||0; return n>=1e4?"Legend":n>=5e3?"Diamond":n>=2e3?"Platinum":n>=1e3?"Gold":n>=500?"Silver":n>=100?"Bronze":"Newbie"; }

async function ensureUserProfile(user){
  const uref = doc(db, "users", user.uid);
  const snap = await getDoc(uref);
  if(!snap.exists()){
    await runTransaction(db, async (tx)=>{
      const metaRef = doc(db, "meta", "counters");
      const metaSnap = await tx.get(metaRef);
      let last = 100000;
      if(metaSnap.exists() && typeof metaSnap.data().lastUserId === "number"){
        last = metaSnap.data().lastUserId; tx.update(metaRef, { lastUserId: last + 1 });
      } else if(metaSnap.exists() && typeof metaSnap.data().nextUserId === "number"){
        last = metaSnap.data().nextUserId - 1; tx.update(metaRef, { nextUserId: last + 2 });
      } else {
        tx.set(metaRef, { lastUserId: last + 1 }, { merge:true });
      }
      const numericId = last + 1;
      tx.set(uref, {
        uid: user.uid, numericId,
        displayName: user.displayName || (user.email||"").split("@")[0] || "Foydalanuvchi",
        photoURL: user.photoURL || "", balance:0, points:0, title:"Newbie",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge:true });
    });
  }else{
    const d = snap.data()||{};
    if(typeof d.numericId !== "number"){
      await runTransaction(db, async (tx)=>{
        const metaRef = doc(db, "meta", "counters");
        const metaSnap = await tx.get(metaRef);
        let last = 100000;
        if(metaSnap.exists() && typeof metaSnap.data().lastUserId === "number"){
          last = metaSnap.data().lastUserId; tx.update(metaRef, { lastUserId: last + 1 });
        } else if(metaSnap.exists() && typeof metaSnap.data().nextUserId === "number"){
          last = metaSnap.data().nextUserId - 1; tx.update(metaRef, { nextUserId: last + 2 });
        } else {
          tx.set(metaRef, { lastUserId: last + 1 }, { merge:true });
        }
        const numericId = last + 1;
        tx.update(uref, { numericId, updatedAt: serverTimestamp() });
      });
    }
    const ref2 = await getDoc(uref); const d2 = ref2.data()||{};
    const title = titleFromPoints(d2.points||0);
    if(d2.title !== title){ await updateDoc(uref, { title, updatedAt: serverTimestamp() }); }
  }
  return (await getDoc(uref)).data();
}

function updateHeaderUI(){
  const elGuest=$("#guest-actions"), elUser=$("#user-actions");
  const elHello=$("#menu-hello"), elHelloDetails=$("#menu-hello-details");
  if(currentUser && currentUserProfile){
    elGuest?.classList.add("hidden"); elUser?.classList.remove("hidden");
    $("#chip-id .val")?.replaceChildren(document.createTextNode(String(currentUserProfile.numericId||"")));
    $("#chip-balance .val")?.replaceChildren(document.createTextNode(String(currentUserProfile.balance??0)));
    $("#chip-title .val")?.replaceChildren(document.createTextNode(currentUserProfile.title||""));
    if(elHello) elHello.textContent = "Salom! " + (currentUserProfile.displayName||"Foydalanuvchi");
    if(elHelloDetails) elHelloDetails.textContent = `Ball: ${currentUserProfile.points||0} • Unvon: ${currentUserProfile.title}`;
  }else{
    elGuest?.classList.remove("hidden"); elUser?.classList.add("hidden");
    if(elHello) elHello.textContent = "Salom! Mehmon";
    if(elHelloDetails) elHelloDetails.textContent = "Kirish orqali imkoniyatlarni oching";
  }
}
export function refreshHeaderUI(){ updateHeaderUI(); }

export async function signInWithGoogle(){
  try{ if(/Mobi|Android/i.test(navigator.userAgent)){ const { signInWithRedirect, provider } = await import("./firebase.js"); await signInWithRedirect(auth, provider); } else { const { signInWithPopup, provider } = await import("./firebase.js"); await signInWithPopup(auth, provider); } }
  catch(e){ alert("Google orqali kirishda xatolik: " + (e.message||e)); }
}
export async function emailPasswordLogin(email, password){ await signInWithEmailAndPassword(auth, email, password); }
export async function emailPasswordRegister(name, email, password){ const cred = await createUserWithEmailAndPassword(auth, email, password); if(name){ await updateProfile(cred.user, { displayName: name }); } }
export async function doSignOut(){ await signOut(auth); }

onAuthStateChanged(auth, async (user)=>{
  currentUser = user || null;
  currentUserProfile = user ? await ensureUserProfile(user) : null;
  updateHeaderUI();
  const requiresAuth = document.body.dataset.requireAuth === "1";
  if(requiresAuth && !currentUser){ document.querySelector("#loginModal")?.classList.add("show"); }
});

document.addEventListener("click",(e)=>{
  const t=e.target; if(!(t instanceof HTMLElement)) return;
  const openBtn=t.closest("[data-open]"), closeBtn=t.closest("[data-close]");
  if(openBtn){ const id=openBtn.getAttribute("data-open"); document.querySelector(id)?.classList.add("show"); }
  if(closeBtn){ const id=closeBtn.getAttribute("data-close"); document.querySelector(id)?.classList.remove("show"); }
  if(t.closest("#googleSignInBtn")){ signInWithGoogle(); }
  if(t.closest("#signOutBtn")){ doSignOut(); }
});
document.addEventListener("submit", async (e)=>{
  const f=e.target; if(!(f instanceof HTMLFormElement)) return;
  if(f.matches("#loginForm")){ e.preventDefault(); try{ await emailPasswordLogin(f.email.value.trim(), f.password.value); document.querySelector("#loginModal")?.classList.remove("show"); }catch(err){ alert("Kirishda xatolik: " + (err.message||err)); } }
  if(f.matches("#registerForm")){ e.preventDefault(); try{ await emailPasswordRegister(f.name.value.trim(), f.email.value.trim(), f.password.value); document.querySelector("#registerModal")?.classList.remove("show"); }catch(err){ alert("Ro'yxatdan o'tishda xatolik: " + (err.message||err)); } }
});

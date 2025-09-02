// Auth flow: email login/registr + Google + logout + numericId
const { auth, db } = window.EXH;

document.addEventListener("click", (e)=>{
  const t = e.target;
  if(t && t.id === "login-submit"){ e.preventDefault(); doLogin(); }
  else if(t && t.id === "register-submit"){ e.preventDefault(); doRegister(); }
  else if(t && t.id === "btn-logout"){ e.preventDefault(); doLogout(); }
});

async function doLogin(){
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;
  try{ await auth.signInWithEmailAndPassword(email, pass);
    document.getElementById("login-modal").close();
  }catch(err){ alert(err.message); }
}
async function doRegister(){
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const pass = document.getElementById("reg-pass").value;
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await ensureUserDoc(cred, { nameOverride: name });
    document.getElementById("register-modal").close();
  }catch(err){ alert(err.message); }
}
async function doLogout(){ try{ await auth.signOut(); }catch(err){ alert(err.message); }}

// Google sign-in: robust with redirect fallback + delegation
document.addEventListener("click", (e)=>{
  const btn = e.target && (e.target.closest("#login-google") || e.target.closest("#register-google"));
  if(btn){ e.preventDefault(); doGoogle(); }
});
async function doGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try{
      const cred = await auth.signInWithPopup(provider);
      await ensureUserDoc(cred);
    }catch(popupErr){
      await auth.signInWithRedirect(provider);
      return;
    }
    document.getElementById("login-modal")?.close();
    document.getElementById("register-modal")?.close();
  }catch(err){ alert(err?.message || String(err)); }
}
auth.getRedirectResult().then(async (res)=>{
  if(res && res.user){
    await ensureUserDoc(res);
    document.getElementById("login-modal")?.close();
    document.getElementById("register-modal")?.close();
  }
}).catch(err=>console.warn('Redirect auth error:', err?.message||err));

async function ensureUserDoc(cred, opts={}){
  const user = (cred && cred.user) ? cred.user : auth.currentUser;
  if(!user) return;
  const uid = user.uid;
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if(!snap.exists){
    let assignedId = null;
    await db.runTransaction(async (tx)=>{
      const counterRef = db.collection("meta").doc("counters");
      const csnap = await tx.get(counterRef);
      let last = 100000;
      if(csnap.exists && typeof csnap.data().lastUserId === "number"){ last = csnap.data().lastUserId; }
      assignedId = last + 1;
      tx.set(counterRef, { lastUserId: assignedId }, { merge:true });
    });
    await userRef.set({
      name: opts.nameOverride || user.displayName || user.email,
      email: user.email, numericId: assignedId, balance: 0, points: 0, title: "Yangi a’zo",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });
  }
}

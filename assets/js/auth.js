// Auth flow: login, register, logout + sequential numericId issuance
const { auth, db } = window.EXH;

// Elements are created after partial injection
document.addEventListener("click", (e)=>{
  const t = e.target;
  if(t && t.id === "login-submit"){
    e.preventDefault(); doLogin();
  } else if(t && t.id === "register-submit"){
    e.preventDefault(); doRegister();
  } else if(t && t.id === "btn-logout"){
    e.preventDefault(); doLogout();
  }
});

async function doLogin(){
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;
  try{
    await auth.signInWithEmailAndPassword(email, pass);
    document.getElementById("login-modal").close();
  }catch(err){
    alert(err.message);
  }
}

async function doRegister(){
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const pass = document.getElementById("reg-pass").value;
  try{
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;
    const userRef = db.collection("users").doc(uid);
    // Assign sequential numericId using a transaction on meta/counters.lastUserId
    // NOTE: Requires appropriate security rules!
    let assignedId = null;
    await db.runTransaction(async (tx)=>{
      const counterRef = db.collection("meta").doc("counters");
      const snap = await tx.get(counterRef);
      let last = 100000;
      if(snap.exists && typeof snap.data().lastUserId === "number"){
        last = snap.data().lastUserId;
      }
      assignedId = last + 1;
      tx.set(counterRef, { lastUserId: assignedId }, { merge:true });
    });
    await userRef.set({
      name,
      email,
      numericId: assignedId,
      balance: 0,
      points: 0,
      title: "Yangi a’zo",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    document.getElementById("register-modal").close();
  }catch(err){
    alert(err.message);
  }
}

async function doLogout(){
  try{
    await auth.signOut();
  }catch(err){
    alert(err.message);
  }
}

// Expose for other modules
window.EXH_AUTH = { doLogin, doRegister, doLogout };

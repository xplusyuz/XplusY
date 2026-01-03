import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Fill your Firebase web config here (Project settings -> Web app)
const firebaseConfig = window.FIREBASE_WEB_CONFIG || {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_AUTH_DOMAIN",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID"
};

let app;
let auth;

export function initFirebase(){
  if(!app){
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(()=>{});
  }
  return auth;
}

export async function getGoogleIdToken(interactive=false){
  const a = initFirebase();
  const provider = new GoogleAuthProvider();

  // If already signed in, return token
  if(a.currentUser){
    return await a.currentUser.getIdToken();
  }

  if(interactive){
    await signInWithPopup(a, provider);
    return await a.currentUser.getIdToken();
  }

  // Wait shortly for existing session to restore
  return await new Promise((resolve)=>{
    const off = onAuthStateChanged(a, async (user)=>{
      off();
      if(user){
        try{ resolve(await user.getIdToken()); }catch(_){ resolve(""); }
      }else{
        resolve("");
      }
    });
    setTimeout(()=>{ try{ off(); }catch(_){} resolve(""); }, 1200);
  });
}

export async function getSignedEmail(){
  const a = initFirebase();
  return a.currentUser ? (a.currentUser.email || "") : "";
}
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export function initFirebaseClient(){
  const cfg = window.FIREBASE_WEB_CONFIG;
  if(!cfg || !cfg.projectId){
    throw new Error("FIREBASE_WEB_CONFIG missing. Fill firebase-config.js");
  }
  const app = getApps().length ? getApps()[0] : initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  return { app, auth, db };
}

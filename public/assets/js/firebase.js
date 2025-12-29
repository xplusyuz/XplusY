import { firebaseConfig } from "./firebaseConfig.js";

let _app = null;
let _db = null;

function isConfigured(){
  return !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);
}

export async function getDb(){
  if(_db) return _db;
  if(!isConfigured()){
    const err = new Error("Firebase config to'ldirilmagan (assets/js/firebaseConfig.js)");
    err.code = "FIREBASE_NOT_CONFIGURED";
    throw err;
  }
  // Lazy-load firebase ESM (no bundler)
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  _app = initializeApp(firebaseConfig);
  _db = getFirestore(_app);
  return _db;
}

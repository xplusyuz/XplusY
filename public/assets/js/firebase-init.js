// Firebase init + anonymous sign-in
// Requires:
// - firebase-app-compat.js
// - firebase-auth-compat.js
// - firebase-firestore-compat.js
// - assets/js/firebase-config.js (window.FIREBASE_CONFIG)

(function(){
  const status = {
    ok: false,
    inited: false,
    user: null,
    db: null,
    auth: null,
    error: null
  };

  function log(...a){ console.log("[LM Firebase]", ...a); }

  async function init(){
    if(status.inited) return status;
    status.inited = true;
    try{
      if(!window.firebase){ throw new Error("Firebase SDK yuklanmadi"); }
      const cfg = window.FIREBASE_CONFIG;
      if(!cfg || !cfg.apiKey || String(cfg.apiKey).startsWith("PASTE_")){
        throw new Error("FIREBASE_CONFIG to'ldirilmagan (assets/js/firebase-config.js)");
      }

      if(!firebase.apps || !firebase.apps.length){
        firebase.initializeApp(cfg);
      }
      status.auth = firebase.auth();
      status.db = firebase.firestore();

      // Prefer existing sign-in
      if(!status.auth.currentUser){
        // Anonymous sign-in (enable in console)
        await status.auth.signInAnonymously();
      }
      status.user = status.auth.currentUser;
      status.ok = true;
      log("ready", {uid: status.user?.uid});
      return status;
    }catch(e){
      status.error = e;
      status.ok = false;
      console.warn("[LM Firebase] init error:", e);
      return status;
    }
  }

  // Public handle
  window.LM_FB = {
    init,
    get status(){ return status; }
  };
})();

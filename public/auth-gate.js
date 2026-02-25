import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

let _authReadyPromise = null;
let _cachedUser = null;

export function waitAuthReady(){
  if(_authReadyPromise) return _authReadyPromise;
  _authReadyPromise = new Promise((resolve)=>{
    const unsub = onAuthStateChanged(auth, (u)=>{
      _cachedUser = u || null;
      unsub();
      resolve(_cachedUser);
    });
  });
  return _authReadyPromise;
}

export async function requireAuth({ redirectTo="/login.html" } = {}){
  const u = await waitAuthReady();
  if(!u){
    location.replace(redirectTo);
    return null;
  }
  return u;
}

export function getCachedAuthUser(){ return _cachedUser; }

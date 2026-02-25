import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const LS_KEY = "orzumall_user_cache_v1";

let _unsub = null;
let _current = null;

export function getCachedProfile(){
  if(_current) return _current;
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    _current = JSON.parse(raw);
    return _current;
  }catch{
    return null;
  }
}

function setCache(p){
  _current = p;
  try{ localStorage.setItem(LS_KEY, JSON.stringify(p)); }catch{}
}

export function watchUserProfile(uid, onChange){
  if(_unsub){ _unsub(); _unsub=null; }
  const ref = doc(db, "users", uid);
  _unsub = onSnapshot(ref, { includeMetadataChanges:true }, (snap)=>{
    if(!snap.exists()) return;
    const d = snap.data() || {};
    const profile = {
      uid,
      name: d.name || "User",
      phone: d.phone || "",
      numericId: d.numericId ?? null,
      balanceUZS: Number(d.balanceUZS || d.balance || 0) || 0,
      points: Number(d.points || 0) || 0,
      avatarUrl: d.avatarUrl || "",
      updatedAt: d.updatedAt || null,
    };
    setCache(profile);
    onChange?.(profile);
  }, (err)=>console.warn("watchUserProfile error:", err));
  return ()=>{ if(_unsub){ _unsub(); _unsub=null; } };
}

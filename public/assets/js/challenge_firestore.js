import { collection, getDocs, orderBy, limit, query } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { initFirebaseClient } from "./firebase_client.js";

function tsToMs(v){
  if(!v) return NaN;
  // Firestore Timestamp
  if(typeof v.toMillis === "function") return v.toMillis();
  // ISO string
  if(typeof v === "string") return new Date(v).getTime();
  // ms
  if(typeof v === "number") return v;
  return NaN;
}

function fmtRange(sMs, eMs){
  const s = new Date(sMs);
  const e = new Date(eMs);
  const opt = { day:"2-digit", month:"short" };
  const a = s.toLocaleDateString("uz-UZ", opt);
  const b = e.toLocaleDateString("uz-UZ", opt);
  return `${a} – ${b}`;
}

function renderChallenge(ch){
  const box = document.getElementById("challengeBox");
  const title = document.getElementById("challengeTitle");
  const meta = document.getElementById("challengeMeta");
  const btn = document.getElementById("challengeBtn");
  const badge = document.getElementById("challengeBadge");
  const art = document.getElementById("challengeArt");

  const sMs = tsToMs(ch.startAt);
  const eMs = tsToMs(ch.endAt);
  const now = Date.now();
  const live = now>=sMs && now<=eMs;

  title.textContent = ch.title || "Challenge";
  meta.textContent = (isFinite(sMs)&&isFinite(eMs)) ? fmtRange(sMs,eMs) : "";
  badge.textContent = live ? "LIVE" : (now < sMs ? "KUTILMOQDA" : "TUGADI");
  badge.className = "cBadge " + (live ? "live" : (now < sMs ? "soon" : "done"));

  const href = ch.href || ch.link || ch.url || "#";
  btn.textContent = live ? (ch.cta || "Boshlash") : (now < sMs ? "Tez kunda" : "Yakunlangan");
  btn.className = "cBtn " + (live ? "live" : "disabled");
  btn.onclick = () => { if(live && href && href!=="#") location.href = href; };

  if(ch.banner){
    art.style.backgroundImage = `url('${ch.banner}')`;
    art.classList.add("has");
  }else{
    art.style.backgroundImage = "";
    art.classList.remove("has");
  }

  box.hidden = false;
}

async function loadFromFirestore(){
  const { db } = initFirebaseClient();
  const q = query(collection(db, "challenges"), orderBy("startAt", "desc"), limit(25));
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));

  if(!list.length) return null;

  const now = Date.now();
  // pick LIVE first, else nearest upcoming, else latest ended
  let live = list.find(c => now>=tsToMs(c.startAt) && now<=tsToMs(c.endAt));
  if(live) return live;

  const upcoming = list
    .filter(c => now < tsToMs(c.startAt))
    .sort((a,b)=>tsToMs(a.startAt)-tsToMs(b.startAt))[0];
  if(upcoming) return upcoming;

  const ended = list
    .filter(c => now > tsToMs(c.endAt))
    .sort((a,b)=>tsToMs(b.endAt)-tsToMs(a.endAt))[0];
  return ended || list[0];
}

async function loadFallbackJson(){
  try{
    const r = await fetch("challenge.json", { cache:"no-store" });
    if(!r.ok) return null;
    const arr = await r.json();
    if(!Array.isArray(arr) || !arr.length) return null;
    return arr[0];
  }catch(_){ return null; }
}

(async ()=>{
  const status = document.getElementById("challengeStatus");
  try{
    status.textContent = "Yuklanmoqda…";
    const ch = await loadFromFirestore();
    if(ch){ renderChallenge(ch); status.textContent = ""; return; }
    const fb = await loadFallbackJson();
    if(fb){ renderChallenge(fb); status.textContent=""; return; }
    status.textContent = "Challenge topilmadi.";
  }catch(e){
    console.warn("Challenge Firestore error:", e);
    // fallback
    const fb = await loadFallbackJson();
    if(fb){ renderChallenge(fb); status.textContent=""; return; }
    status.textContent = "Challenge yuklanmadi (config/rules).";
  }
})();

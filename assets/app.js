/* Firebase init + helpers shared across all pages */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, startAfter, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Admin gate: numeric ID must be 38864
const ADMIN_ID = 38864;
export function isAdmin() { return sessionStorage.getItem('adminOK') === '1'; }
export function requireAdmin() { if(!isAdmin()) throw new Error('ADMIN_ONLY'); }
export function openAdminGate() {
  const entered = prompt("Admin ID ni kiriting:");
  if(!entered) return false;
  const ok = String(entered).trim() === String(ADMIN_ID);
  sessionStorage.setItem('adminOK', ok ? '1':'0');
  return ok;
}
export function toast(msg) {
  const t = document.querySelector('.toast');
  if(!t) return alert(msg);
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}
export function activeNav() {
  document.querySelectorAll('nav a').forEach(a=>{
    if(a.href===location.href) a.classList.add('active');
  });
}
// Generic pagination loader (client-side filters for simplicity)
export async function pagedList(opts) {
  const { colName, pageSize = 12 } = opts;
  let qy = query(collection(db, colName), orderBy('createdAt','desc'), limit(pageSize));
  const snap = await getDocs(qy);
  return snap;
}
export async function createDoc(colName, data) {
  requireAdmin();
  const docRef = await addDoc(collection(db, colName), { ...data, createdAt: serverTimestamp() });
  return docRef.id;
}

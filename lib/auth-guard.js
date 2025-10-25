import { auth, onAuthStateChanged } from "./firebase.client.js";
export function requireAuth() {
  return new Promise((resolve)=>{
    onAuthStateChanged(auth,(user)=>{
      if(user) return resolve(user);
      const ret = encodeURIComponent(location.pathname + location.search + location.hash);
      location.replace(`./login.html?return=${ret}`);
    });
  });
}
export function watchAuth(cb){ return onAuthStateChanged(auth, cb); }
// lib/auth-guard.js
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/**
 * Admin sahifalar uchun guard.
 * Foydalanuvchi login qilmagan bo‘lsa — login sahifasiga yo‘naltiradi.
 * Login qilgan bo‘lsa, lekin email mos kelmasa — 403 (forbidden) holatni bildiradi.
 */
export function requireAdminEmail(auth, {
  allowedEmail,
  loginPath = './login.html',
  onAllowed = ()=>{},
  onForbidden = ()=>{},
} = {}) {

  const gotoLogin = () => {
    const back = location.pathname + location.search + location.hash;
    const u = new URL(loginPath, location.origin);
    u.searchParams.set('return', back);
    location.href = u.toString();
  };

  onAuthStateChanged(auth, (user) => {
    if (!user) { gotoLogin(); return; }

    const email = (user.email || '').toLowerCase();
    const allow = (allowedEmail || '').toLowerCase();

    if (allow && email !== allow) {
      onForbidden(user);
      return;
    }

    onAllowed(user);
  });
}

/**
 * Oddiy foydalanuvchi uchun guard (email tekshiruvisiz)
 */
export function requireSignIn(auth, {
  loginPath = './login.html',
  onAllowed = ()=>{},
} = {}) {
  const gotoLogin = () => {
    const back = location.pathname + location.search + location.hash;
    const u = new URL(loginPath, location.origin);
    u.searchParams.set('return', back);
    location.href = u.toString();
  };

  onAuthStateChanged(auth, (user) => {
    if (!user) { gotoLogin(); return; }
    onAllowed(user);
  });
}

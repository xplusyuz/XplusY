// lib/auth-guard.js
// — Eski sahifalar bilan moslikni SAQLAYMIZ —
// (requireAuth, watchAuth) avvalgidek qoladi.

import { auth, onAuthStateChanged } from "./firebase.client.js";

/** === 1) Eski API: majburiy login, user qaytaradi (Promise) === */
export function requireAuth({ loginPath = './login.html' } = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) return resolve(user);
      const ret = encodeURIComponent(location.pathname + location.search + location.hash);
      location.replace(`${loginPath}?return=${ret}`);
    });
  });
}

/** === 2) Eski API: kuzatish === */
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

/** === 3) Yangi: faqat kirgan bo‘lsin (email cheklovisiz) ===
 *  Sahifalarda: requireSignIn({ onAllowed(){ ... } })
 */
export function requireSignIn({
  loginPath = './login.html',
  onAllowed = () => {},
} = {}) {
  const gotoLogin = () => {
    const back = location.pathname + location.search + location.hash;
    const u = new URL(loginPath, location.origin);
    u.searchParams.set('return', back);
    location.replace(u.toString());
  };

  onAuthStateChanged(auth, (user) => {
    if (!user) { gotoLogin(); return; }
    onAllowed(user);
  });
}

/** === 4) Yangi: admin guard (majburiy login + aniq email) ===
 *  Moslik uchun auth parametrini qabul qiladi, lekin ichkarida o‘z auth’dan foydalanamiz.
 *  Foydalanish:
 *    import { requireAdminEmail } from './lib/auth-guard.js';
 *    requireAdminEmail(auth, {
 *      allowedEmail: 'sohibjonmath@gamil.com',
 *      loginPath: './login.html',
 *      onAllowed(){ ...initAdmin()... },
 *      onForbidden(){ ...403 ko‘rsat... },
 *    });
 */
export function requireAdminEmail(
  _authIgnored,
  {
    allowedEmail,
    loginPath = './login.html',
    onAllowed = () => {},
    onForbidden = () => {},
  } = {}
) {
  const gotoLogin = () => {
    const back = location.pathname + location.search + location.hash;
    const u = new URL(loginPath, location.origin);
    u.searchParams.set('return', back);
    location.replace(u.toString());
  };

  onAuthStateChanged(auth, (user) => {
    if (!user) { gotoLogin(); return; }

    const email = (user.email || '').toLowerCase();
    const allow = (allowedEmail || '').toLowerCase();

    if (allow && email !== allow) {
      onForbidden(user); // masalan: 403 panelni ko‘rsatish
      return;
    }
    onAllowed(user); // masalan: initAdmin()
  });
}

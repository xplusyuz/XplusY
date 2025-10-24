// /lib/auth-guard.js
import { auth, onAuthStateChanged } from "./firebase.client.js";

export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) return resolve(user);
      const ret = encodeURIComponent(location.pathname + location.search + location.hash);
      location.replace(`./login.html?return=${ret}`);
    });
  });
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, (user) => callback(user));
}

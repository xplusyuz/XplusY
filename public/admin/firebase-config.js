// Admin panel Firebase config resolver.
// It tries (in order):
// 1) Import ../firebase-config.js (recommended for shared config)
// 2) window.firebaseConfig (if you expose it globally)
// 3) Fallback placeholder (will show setup error in UI)
//
// NOTE: This file is a module and may use top-level await.

export const DEFAULT_ADMIN_EMAILS = [
  "sohibjonmath@gmail.com"
];

let cfg = null;

try {
  const mod = await import("../firebase-config.js");
  cfg = mod.firebaseConfig || mod.FIREBASE_CONFIG || mod.default || null;
} catch (e) {
  // ignore - we'll try window.firebaseConfig next
}

if (!cfg && typeof window !== "undefined") {
  cfg = window.firebaseConfig || window.FIREBASE_CONFIG || null;
}

export const FIREBASE_CONFIG = cfg || {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

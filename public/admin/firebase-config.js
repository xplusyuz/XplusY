import { firebaseConfig } from "../firebase-config.js";

// Admin emails allowlist (UI guard only). Real protection is Firestore rules + admin custom claim.
export const DEFAULT_ADMIN_EMAILS = [
  "sohibjonmath@gmail.com"
];

export const FIREBASE_CONFIG = firebaseConfig;

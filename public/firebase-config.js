import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// ⚠️ Firebase Console → Project settings → Your apps → Web app config'dan OLIB qo'ying.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID",
};

function looksPlaceholder(v){
  return !v || String(v).includes("YOUR_");
}
if (looksPlaceholder(firebaseConfig.apiKey) || looksPlaceholder(firebaseConfig.projectId)) {
  alert("Firebase Web config to'ldirilmagan! public/firebase-config.js ichidagi apiKey/authDomain/projectId/appId ni o'zingiznikiga almashtiring.");
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

await setPersistence(auth, browserLocalPersistence);

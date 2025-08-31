// Firebase init (CDN ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, increment, runTransaction, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Provided Firebase config
export const firebaseConfig = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.appspot.com",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Allocate numericId sequentially (100001..). Requires meta/counters.nextUserId initialized in Firestore.


export const ensureUserDoc = async (user) => {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if(!snap.exists()){
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
      balance: 0,
      points: 0,
      createdAt: serverTimestamp()
    });
  }
  return userRef;
};



export {
  onAuthStateChanged, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, increment,
  collection, query, orderBy, limit, getDocs
};

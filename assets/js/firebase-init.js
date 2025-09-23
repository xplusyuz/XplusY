export const firebaseConfig = {"apiKey":"AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM","authDomain":"xplusy-760fa.firebaseapp.com","projectId":"xplusy-760fa","storageBucket":"xplusy-760fa.appspot.com","messagingSenderId":"992512966017","appId":"1:992512966017:web:5e919dbc9b8d8abcb43c80","measurementId":"G-459PLJ7P7L"};
export async function bootFirebase(){
  const [{ initializeApp }] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js")
  ]);
  const app = initializeApp(firebaseConfig);
  const [ firestore, storage ] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js"),
  ]);
  const db = firestore.getFirestore(app);
  const st = storage.getStorage(app);
  window.db = db; window.storage = st; window.fs = firestore; window.st = storage;
  return { db, st, fs: firestore, stMod: storage };
}

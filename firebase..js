import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getDatabase, ref, set, get, update } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
    authDomain: "xplusy-760fa.firebaseapp.com",
    projectId: "xplusy-760fa",
    storageBucket: "xplusy-760fa.firebasestorage.app",
    messagingSenderId: "992512966017",
    appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
    measurementId: "G-459PLJ7P7L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Yangi foydalanuvchi ro'yxatdan o'tkazish
async function registerUser(email, password, username) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Foydalanuvchi profilini yangilash
        await updateProfile(user, {
            displayName: username
        });
        
        // Firebase Realtime Database-ga foydalanuvchi ma'lumotlarini saqlash
        const userCountRef = ref(database, 'userCount');
        const snapshot = await get(userCountRef);
        let userCount = snapshot.exists() ? snapshot.val() : 0;
        userCount++;
        
        await set(ref(database, 'users/' + user.uid), {
            username: username,
            email: email,
            userId: 100000 + userCount, // 100001, 100002, ...
            balance: 0,
            points: 0,
            registrationDate: new Date().toISOString()
        });
        
        await set(userCountRef, userCount);
        
        return { success: true, user: user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Foydalanuvchini tizimga kiritish
async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Foydalanuvchini chiqarish
async function logoutUser() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Foydalanuvchi ma'lumotlarini yangilash (faqat yangilash tugmasi bosilganda)
async function refreshUserData(uid) {
    try {
        const userRef = ref(database, 'users/' + uid);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            return { success: true, data: snapshot.val() };
        } else {
            return { success: false, error: "Foydalanuvchi ma'lumotlari topilmadi" };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Balans yoki ballarni yangilash
async function updateUserStats(uid, updates) {
    try {
        const userRef = ref(database, 'users/' + uid);
        await update(userRef, updates);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

export { auth, database, registerUser, loginUser, logoutUser, refreshUserData, updateUserStats, onAuthStateChanged };
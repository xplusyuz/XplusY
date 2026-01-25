// ==================== KONFIGURATSIYA ====================
const CONFIG = {
  // ===== Test Engine sozlamalari =====
  penaltyPerViolation: 5,
  enableSecurity: true,
  enableRandomOrder: true,
  enableRandomOptions: true,

  // ===== Ma'lumot yozish strategiyasi =====
  useFirebase: true, // Admin dashboard uchun true
  fallbackToJSON: true,

  // ===== Anti-cheat =====
  maxMinorViolations: 20,
  maxWindowSwitchViolations: 3,
  singleAttempt: true,

  // ===== Resurs tejamkorlik =====
  logUserActions: false,

  // ===== Mode bo‘yicha strategiya =====
  telegramNotifyOpen: false,
  telegramEndpoint: '',
  storeFullResultForChallenge: false,

  // ===== Ochiq javoblar =====
  openAnswerCheckType: 'strict',
  allowPartialCredit: false,
  minAnswerLength: 1,
  maxAnswerLength: 1000,
  checkOpenAnswers: true,
  strictOpenAnswerCheck: true,
  normalizeAnswers: true,
  allowMultipleFormats: true,

  // ===== Admin Dashboard uchun =====
  enableFirestorePersistence: false,
  autoLoadImages: true
};

// ==================== FIREBASE ====================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDYwHJou_9GqHZcf8XxtTByC51Z8un8rrM",
  authDomain: "xplusy-760fa.firebaseapp.com",
  databaseURL: "https://xplusy-760fa-default-rtdb.firebaseio.com",
  projectId: "xplusy-760fa",
  storageBucket: "xplusy-760fa.firebasestorage.app",
  messagingSenderId: "992512966017",
  appId: "1:992512966017:web:5e919dbc9b8d8abcb43c80",
  measurementId: "G-459PLJ7P7L"
};

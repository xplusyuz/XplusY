// ==================== KONFIGURATSIYA ====================
        const CONFIG = {
            penaltyPerViolation: 5,
            enableSecurity: true,
            enableRandomOrder: true,
            enableRandomOptions: true,
            useFirebase: false,
            // Test natijalari endi server API orqali yoziladi (Firebase client write yo'q).
            fallbackToJSON: true,
            maxMinorViolations: 20,
            maxWindowSwitchViolations: 3,
            autoLoadImages: true,
            singleAttempt: true,
            // Resurs tejamkorlik: defaultda user action log yozmaymiz (faqat kerak bo'lsa yoqing)
            logUserActions: false,

            // ===== Mode bo'yicha yozish strategiyasi =====
            // challenge: Firestore'ga yoziladi (reyting uchun)
            // open: Firestore'ga natija yozilmaydi (faqat Telegramga yuboriladi)
            telegramNotifyOpen: true,
            telegramEndpoint: '/.netlify/functions/notify-open',

            // Challengeda ham resurs tejash uchun default minimal natija yoziladi
            // (admin uchun ham yetarli: score/time/violations). Kerak bo'lsa true qiling.
            storeFullResultForChallenge: false,
            
            // Ochiq javoblar uchun yangi sozlamalar
            openAnswerCheckType: 'strict',
            allowPartialCredit: false,
            minAnswerLength: 1,
            maxAnswerLength: 1000,
            
            // Yangi: Ochiq javob tekshirish rejimlari
            checkOpenAnswers: true,
            strictOpenAnswerCheck: true,
            normalizeAnswers: true,
            allowMultipleFormats: true,
        };
        
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

// ==================== KONFIGURATSIYA ====================
        const CONFIG = {
            penaltyPerViolation: 5,
            enableSecurity: true,
            enableRandomOrder: true,
            enableRandomOptions: true,
            useFirebase: true,
            fallbackToJSON: true,
            maxMinorViolations: 20,
            maxWindowSwitchViolations: 3,
            autoLoadImages: true,
            singleAttempt: true,
            logUserActions: true,
            
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

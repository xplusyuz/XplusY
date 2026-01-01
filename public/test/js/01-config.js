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
            apiKey: "AIzaSyDJ46oKqDf52JQRaIqe8SJ5vYSfTpSYZKo",
            authDomain: "mathcenter-1c98d.firebaseapp.com",
            projectId: "mathcenter-1c98d",
            storageBucket: "mathcenter-1c98d.firebasestorage.app",
            messagingSenderId: "1016417719928",
            appId: "1:1016417719928:web:700b028da1312477c87f8d",
            measurementId: "G-JEECME5HMJ"
        };

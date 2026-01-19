// ==================== KONFIGURATSIYA ====================
        const CONFIG = {
            penaltyPerViolation: 5,
            enableSecurity: true,
            enableRandomOrder: true,
            enableRandomOptions: true,
            // ✅ Endi test tizimi Firestore client-config emas, Netlify API orqali ishlaydi.
            // (Resurs tejamkor, xavfsiz, yagona login token bilan.)
            useFirebase: false,
            // Offline/backup kerak bo'lsa true qoldiring (code.json orqali)
            fallbackToJSON: false,
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

        // API sozlamalar
        CONFIG.apiBase = '/.netlify/functions/api';
        CONFIG.apiPaths = {
          getTest: 'tests/get',
          startAttempt: 'tests/start',
          cancelAttempt: 'tests/cancel',
          attemptStatus: 'tests/attempt',
          submit: 'tests/submit'
        };

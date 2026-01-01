// ==================== GLOBAL O'ZGARUVCHILAR ====================
        let appState = {
            currentTestCode: '',
            testData: null,
            classes: [],
            students: [],
            currentClass: '',
            currentStudent: null,
            previousAttempt: null,
            currentQuestionIndex: 0,
            userAnswers: [],
            timerInterval: null,
            timeRemaining: 0,
            timeSpent: 0,
            testStarted: false,
            isFullScreen: false,
            securityEnabled: false,
            db: null,
            firebaseAvailable: false,
            
            violations: {
                fullScreenExit: 0,
                windowSwitch: 0,
                minorViolations: 0
            },
            
            violationHistory: [],
            userActions: [],
            shuffledQuestions: [],
            originalToShuffledMap: {},
            shuffledToOriginalMap: {},
            shuffledOptionsMap: {},
            
            lastBlurTime: 0,
            isSleepMode: false,
            
            // Math editor uchun
            mathEditorFrame: null,
            currentLatex: '',
            isModalOpen: false,
            
            // Yangi: Natijalar uchun
            detailedResults: []
        };

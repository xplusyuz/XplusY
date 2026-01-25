// ==================== APP INITIALIZATION ====================
        const app = {
            async initialize() {
                dom.init();
                dom.showScreen('loading');
                bannerManager.createInfiniteBanners();
                messageHandler.init();
                securityManager.init();
                modalManager.init();
                
                await firebaseManager.initialize();
                
                const urlParams = new URLSearchParams(window.location.search);
                const urlCode = urlParams.get('code');
                
                if (urlCode) {
                    dom.elements.testCodeInput.value = urlCode;
                    const loaded = await eventHandlers.loadTestData(urlCode);
                    if (loaded) {
                        // 1) URL orqali eski usul
                        const urlClass = urlParams.get('class');
                        const urlStudent = urlParams.get('student');

                        if (urlClass && urlStudent) {
                            appState.currentClass = urlClass;
                            appState.currentStudent = { id: urlStudent, fullName: "URL orqali kiritilgan" };
                            appState.previousAttempt = await testManager.checkPreviousAttempt();
                            if (testManager.blockTestAccess()) return;
                            await eventHandlers.openIntroForCurrentStudent();
                        } else {
                            // 2) LeaderMath login orqali avto aniqlash
                            const ok = await eventHandlers.autoIdentifyCurrentUser();
                            if (ok) {
                                await eventHandlers.openIntroForCurrentStudent();
                            } else {
                                // 3) Fallback: eski sinf/o'quvchi tanlash
                                await eventHandlers.populateClasses();
                                dom.showScreen('classSelection');
                            }
                        }
                    }
                } else {
                    dom.showScreen('codeInput');
                }
                
                this.setupEventListeners();
                
                console.log("✅ Test tizimi faollashtirildi");
                console.log("📊 Qulf tizimi o'chirilgan");
                console.log("👁️ Barcha savollar cheksiz ko'rinish imkoniyatiga ega");
            },
            
            setupEventListeners() {
                dom.elements.loadTestBtn.addEventListener('click', eventHandlers.handleTestCodeLoad.bind(eventHandlers));
                dom.elements.testCodeInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') eventHandlers.handleTestCodeLoad();
                });
                
                dom.elements.nextToStudentBtn.addEventListener('click', () => {
                    appState.currentClass = dom.elements.classSelect.value;
                    if (!appState.currentClass) {
                        utils.showMessage('Iltimos, sinfni tanlang', 'error');
                        return;
                    }
                    eventHandlers.populateStudents(appState.currentClass);
                    dom.showScreen('studentSelection');
                });
                
                dom.elements.backToCodeBtn.addEventListener('click', () => dom.showScreen('codeInput'));
                
                dom.elements.nextToIntroBtn.addEventListener('click', eventHandlers.handleNextToIntro.bind(eventHandlers));
                dom.elements.backToClassBtn.addEventListener('click', () => dom.showScreen('classSelection'));
                
                dom.elements.viewPreviousAttemptBtn.addEventListener('click', () => {
                    if (appState.previousAttempt) {
                        alert(
                            `Sizning oldingi natijangiz:\n\n` +
                            `Ball: ${appState.previousAttempt.score.toFixed(1)} / ${appState.previousAttempt.totalScore}\n` +
                            `To'g'ri javoblar: ${appState.previousAttempt.correctAnswers}\n` +
                            `Noto'g'ri javoblar: ${appState.previousAttempt.wrongAnswers}\n` +
                            `Vaqt: ${Math.floor(appState.previousAttempt.timeSpent / 60)}:${(appState.previousAttempt.timeSpent % 60).toString().padStart(2, '0')}\n` +
                            `Sana: ${new Date(appState.previousAttempt.completedAt).toLocaleDateString('uz-UZ')}`
                        );
                    }
                });
                
                dom.elements.prevBtn.addEventListener('click', testManager.goToPreviousQuestion.bind(testManager));
                dom.elements.nextBtn.addEventListener('click', testManager.goToNextQuestion.bind(testManager));
                dom.elements.finishBtn.addEventListener('click', () => {
                    if (confirm('Testni yakunlashni xohlaysizmi?')) {
                        testManager.finishTest();
                    }
                });
                
                dom.elements.restartBtn.addEventListener('click', () => window.location.href = window.location.pathname);
            }
        };

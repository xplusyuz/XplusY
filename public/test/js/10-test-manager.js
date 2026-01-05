// ==================== TEST MANAGER ====================
        const testManager = {
            // Test turi: faqat challengeda 1 marta ishlash cheklovi qo'llanadi
            isChallengeMode() {
                const raw = (appState.testData && (appState.testData.mode || appState.testData.type))
                    ? (appState.testData.mode || appState.testData.type)
                    : null;
                return ((raw || 'challenge') + '').toLowerCase() === 'challenge';
            },

            async checkPreviousAttempt() {
                // Single-attempt cheklovi faqat challengelar uchun
                if (!CONFIG.singleAttempt || !this.isChallengeMode() || !appState.currentStudent || !appState.currentTestCode) {
                    return null;
                }
                
                try {
                    const localStorageKey = `test_attempt_${appState.currentTestCode}_${appState.currentStudent.id}`;
                    const storedAttempt = localStorage.getItem(localStorageKey);
                    
                    if (storedAttempt) {
                        return JSON.parse(storedAttempt);
                    }
                    
                    if (CONFIG.useFirebase && appState.firebaseAvailable && appState.db) {
                        const attemptsRef = appState.db.collection('test_results')
                            .where('studentId', '==', appState.currentStudent.id)
                            .where('testCode', '==', appState.currentTestCode)
                            .limit(1);
                        
                        const snapshot = await attemptsRef.get();
                        
                        if (!snapshot.empty) {
                            const doc = snapshot.docs[0];
                            const attempt = {
                                id: doc.id,
                                ...doc.data()
                            };
                            
                            localStorage.setItem(localStorageKey, JSON.stringify(attempt));
                            return attempt;
                        }
                    }
                    
                    return null;
                } catch (error) {
                    console.error('Oldin urinishni tekshirishda xato:', error);
                    return null;
                }
            },
            
            blockTestAccess() {
                if (CONFIG.singleAttempt && appState.previousAttempt) {
                    document.body.innerHTML = `
                        <div style="
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 100000;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        ">
                            <div style="
                                background: white;
                                padding: 30px;
                                border-radius: 12px;
                                box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                                text-align: center;
                                max-width: 500px;
                                width: 90%;
                            ">
                                <div style="font-size: 60px; color: #dc2626; margin-bottom: 20px;">🚫</div>
                                <h1 style="color: #dc2626; margin-bottom: 15px;">Testga Kirish Bloklangan</h1>
                                <p style="color: #4b5563; margin-bottom: 20px; line-height: 1.6;">
                                    Hurmatli <strong>${appState.currentStudent.fullName}</strong>,<br>
                                    Siz bu testni <strong>${new Date(appState.previousAttempt.completedAt).toLocaleDateString('uz-UZ')}</strong> 
                                    sanaida ishlagansiz.
                                </p>
                                <div style="
                                    background: #fef3c7;
                                    border: 2px solid #f59e0b;
                                    border-radius: 8px;
                                    padding: 15px;
                                    margin: 20px 0;
                                    text-align: left;
                                ">
                                    <h3 style="color: #b45309; margin-bottom: 10px;">📊 Oldingi Natijangiz:</h3>
                                    <p><strong>Ball:</strong> ${appState.previousAttempt.score.toFixed(1)} / ${appState.previousAttempt.totalScore}</p>
                                    <p><strong>To'g'ri javoblar:</strong> ${appState.previousAttempt.correctAnswers}</p>
                                    <p><strong>Vaqt:</strong> ${Math.floor(appState.previousAttempt.timeSpent / 60)}:${(appState.previousAttempt.timeSpent % 60).toString().padStart(2, '0')}</p>
                                </div>
                                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                                    Har bir o'quvchi testni faqat bir marta ishlash huquqiga ega.
                                </p>
                                <button onclick="window.location.href = window.location.pathname" style="
                                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                                    color: white;
                                    border: none;
                                    padding: 12px 24px;
                                    border-radius: 8px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    margin-top: 20px;
                                    width: 100%;
                                ">
                                    🏠 Bosh Sahifaga Qaytish
                                </button>
                            </div>
                        </div>
                    `;
                    return true;
                }
                return false;
            },
            
            createRandomOrder() {
                try {
                    if (!appState.testData?.questions || !Array.isArray(appState.testData.questions) || appState.testData.questions.length === 0) {
                        return {
                            shuffledQuestions: [],
                            originalToShuffled: {},
                            shuffledToOriginal: {},
                            shuffledOptions: {}
                        };
                    }
                    
                    // Har bir urinishda yangi random bo'lishi uchun session salt qo'shamiz
                    const baseSeed = utils.generateSeed(appState.currentStudent?.id, appState.currentTestCode);
                    const sessionSalt = (appState.randomSessionSalt ?? Math.floor(Math.random() * 1e9));
                    appState.randomSessionSalt = sessionSalt;
                    const seed = baseSeed + sessionSalt;
                    
                    const questionsCopy = appState.testData.questions.map((q, idx) => ({...q, originalIndex: idx}));
                    const shuffledQuestions = utils.seededShuffle(questionsCopy, seed);
                    
                    const originalToShuffled = {};
                    const shuffledToOriginal = {};
                    const shuffledOptions = {};
                    
                    shuffledQuestions.forEach((question, shuffledIndex) => {
                        const originalIndex = question.originalIndex;
                        originalToShuffled[originalIndex] = shuffledIndex;
                        shuffledToOriginal[shuffledIndex] = originalIndex;
                        
                        if (question.type === 'variant' && question.options && 
                            Array.isArray(question.options) && CONFIG.enableRandomOptions) {
                            const optionsSeed = utils.generateSeed(`${appState.currentStudent?.id}_${appState.currentTestCode}_${originalIndex}`) + sessionSalt;
                            shuffledOptions[originalIndex] = utils.seededShuffle(question.options, optionsSeed);
                        } else if (question.type === 'variant' && question.options) {
                            shuffledOptions[originalIndex] = [...question.options];
                        }
                    });
                    
                    return {
                        shuffledQuestions: shuffledQuestions.map(q => {
                            const {originalIndex, ...rest} = q;
                            return rest;
                        }),
                        originalToShuffled,
                        shuffledToOriginal,
                        shuffledOptions
                    };
                } catch (error) {
                    console.error('Random tartib yaratishda xato:', error);
                    const simpleMap = {};
                    appState.testData.questions.forEach((_, i) => {
                        simpleMap[i] = i;
                    });
                    
                    return {
                        shuffledQuestions: [...appState.testData.questions],
                        originalToShuffled: simpleMap,
                        shuffledToOriginal: simpleMap,
                        shuffledOptions: {}
                    };
                }
            },
            
            async startTest() {
                try {
                    if (CONFIG.singleAttempt && appState.previousAttempt) {
                        alert("❌ Siz bu testni oldin ishlagansiz!\n\nHar bir o'quvchi testni faqat bir marta ishlash huquqiga ega.\n\nOldingi natijangizni ko'rish uchun 'Oldingi Natijani Ko'rish' tugmasini bosing.");
                        return;
                    }
                    
                    if (!appState.testData || !appState.testData.questions) {
                        throw new Error("Test ma'lumotlari yuklanmagan");
                    }
                    
                    if (!appState.currentStudent) {
                        throw new Error("O'quvchi tanlanmagan");
                    }
                    
                    await fullscreenManager.enable();
                    
                    appState.testStarted = true;
                    userActionLogger.log('test_started');
                    
                    document.body.classList.add('test-active');

                    // Har startda yangi random tartib (savollar + javoblar) bo'lishi uchun
                    appState.randomSessionSalt = Math.floor(Math.random() * 1e9);
                    
                    if (CONFIG.enableRandomOrder) {
                        const randomOrder = this.createRandomOrder();
                        appState.shuffledQuestions = randomOrder.shuffledQuestions;
                        appState.originalToShuffledMap = randomOrder.originalToShuffled;
                        appState.shuffledToOriginalMap = randomOrder.shuffledToOriginal;
                        appState.shuffledOptionsMap = randomOrder.shuffledOptions;
                    } else {
                        appState.shuffledQuestions = [...appState.testData.questions];
                        appState.testData.questions.forEach((_, index) => {
                            appState.originalToShuffledMap[index] = index;
                            appState.shuffledToOriginalMap[index] = index;
                        });
                    }
                    
                    appState.userAnswers = new Array(appState.testData.questions.length).fill(null);
                    appState.timeRemaining = (appState.testData.durationMinutes || 30) * 60;
                    appState.timeSpent = 0;
                    appState.violations = { fullScreenExit: 0, windowSwitch: 0, minorViolations: 0 };
                    appState.violationHistory = [];
                    appState.userActions = [];
                    appState.detailedResults = [];
                    
                    dom.elements.headerStudentName.textContent = appState.currentStudent.fullName;
                    dom.elements.headerStudentClass.textContent = appState.currentClass;
                    dom.elements.violationCount.textContent = '0';
                    
                    if (CONFIG.enableSecurity) {
                        securityManager.enable();
                    }
                    
                    dom.elements.testHeader.classList.remove('hidden');
                    this.startTimer();
                    
                    this.buildVerticalNavDots();
                    
                    appState.currentQuestionIndex = 0;
                    this.renderQuestion();
                    dom.showScreen('question');
                    
                    setTimeout(() => {
                        if (!appState.isFullScreen) {
                            utils.showMessage("⚠️ Iltimos, testni to'liq ekranda davom ettiring. (F11 tugmasi)", "warning");
                            dom.elements.monitorText.textContent = "⚠️ Full screen tavsiya etiladi! F11 tugmasini bosing";
                        }
                    }, 2000);
                    
                } catch (error) {
                    console.error('Testni boshlashda xato:', error);
                    utils.showMessage(error.message || "Testni boshlashda xato", 'error');
                    dom.showScreen('intro');
                }
            },
            
            startTimer() {
                this.updateTimerDisplay();
                clearInterval(appState.timerInterval);
                appState.timerInterval = setInterval(() => {
                    appState.timeRemaining--;
                    appState.timeSpent++;
                    
                    if (appState.timeRemaining <= 0) {
                        this.finishTest();
                        return;
                    }
                    
                    this.updateTimerDisplay();
                }, 1000);
            },
            
            updateTimerDisplay() {
                const minutes = Math.floor(appState.timeRemaining / 60);
                const seconds = appState.timeRemaining % 60;
                const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                dom.elements.timer.textContent = timeString;
                dom.elements.headerTimer.textContent = timeString;
            },
            
            buildVerticalNavDots() {
                if (!appState.shuffledQuestions || appState.shuffledQuestions.length === 0) return;
                
                dom.elements.verticalNavDots.innerHTML = '';
                
                appState.shuffledQuestions.forEach((_, randomIndex) => {
                    const originalIndex = appState.shuffledToOriginalMap[randomIndex] || randomIndex;
                    
                    const dot = document.createElement('div');
                    dot.className = 'vertical-dot';
                    if (CONFIG.enableRandomOrder) {
                        dot.classList.add('random');
                    }
                    
                    dot.textContent = randomIndex + 1;
                    dot.dataset.index = randomIndex;
                    dot.dataset.originalIndex = originalIndex;
                    
                    dot.addEventListener('click', () => {
                        if (appState.testStarted) {
                            appState.currentQuestionIndex = randomIndex;
                            this.renderQuestion();
                            userActionLogger.log('question_navigated', {
                                from: appState.currentQuestionIndex,
                                to: randomIndex
                            });
                        }
                    });
                    
                    dom.elements.verticalNavDots.appendChild(dot);
                });
                
                this.updateVerticalNavDots();
            },
            
            updateVerticalNavDots() {
                const dots = dom.elements.verticalNavDots.querySelectorAll('.vertical-dot');
                dots.forEach((dot, index) => {
                    const originalIndex = parseInt(dot.dataset.originalIndex) || index;
                    
                    dot.classList.remove('active', 'answered');
                    
                    if (index === appState.currentQuestionIndex) {
                        dot.classList.add('active');
                    }
                    
                    if (appState.userAnswers[originalIndex] !== null && appState.userAnswers[originalIndex] !== undefined && appState.userAnswers[originalIndex] !== '') {
                        dot.classList.add('answered');
                    }
                });
            },
            
            renderQuestion() {
                if (!appState.shuffledQuestions || !appState.shuffledQuestions[appState.currentQuestionIndex]) {
                    return;
                }

                const randomQuestion = appState.shuffledQuestions[appState.currentQuestionIndex];
                const originalIndex = appState.shuffledToOriginalMap[appState.currentQuestionIndex] !== undefined ?
                                    appState.shuffledToOriginalMap[appState.currentQuestionIndex] : appState.currentQuestionIndex;

                // Savol raqami
                dom.elements.currentQ.textContent = appState.currentQuestionIndex + 1;

                // Ko'rish ko'rsatkichini yangilash
                dom.elements.viewIndicator.classList.remove('viewed-first', 'viewed-second', 'viewed-third');
                dom.elements.viewIcon.textContent = '👁️';

                // Section va ballar
                dom.elements.sectionNameDisplay.textContent = randomQuestion.section || "Umumiy";
                dom.elements.currentSectionName.textContent = randomQuestion.section || "Umumiy";
                const points = randomQuestion.points || 1;
                dom.elements.currentQuestionPoints.textContent = `${points} ball`;

                // Ogohlantirish xabarini yashirish
                dom.elements.viewWarning.classList.add('hidden');

                // Rasm yuklash (mavjud DOM elementlarida)
                this.loadQuestionImage(randomQuestion, originalIndex);

                // Savol matni (mavjud elementga)
                dom.elements.questionText.innerHTML = randomQuestion.text || '';

                // Variantlar yoki ochiq javob (mavjud containerlarda)
                if (randomQuestion.type === 'variant') {
                    dom.elements.optionsContainer.classList.remove('hidden');
                    dom.elements.openAnswerContainer.classList.add('hidden');
                    this.renderOptions(randomQuestion, originalIndex);
                } else if (randomQuestion.type === 'open') {
                    dom.elements.optionsContainer.classList.add('hidden');
                    dom.elements.openAnswerContainer.classList.remove('hidden');
                    this.renderOpenAnswer(originalIndex);
                } else {
                    // fallback
                    dom.elements.optionsContainer.classList.add('hidden');
                    dom.elements.openAnswerContainer.classList.add('hidden');
                }

                // MathJax render qilish
                if (window.MathJax && MathJax.typesetPromise) {
                    setTimeout(() => {
                        MathJax.typesetPromise([dom.elements.questionText, dom.elements.optionsContainer, dom.elements.answerPreviewContent]);
                    }, 60);
                }

                // Navigation tugmalarini ko'rsatish (DOM o'chmaydi, doim ko'rinadi)
                dom.elements.prevBtn.style.display = 'flex';
                dom.elements.nextBtn.style.display = 'flex';
                dom.elements.finishBtn.style.display = 'flex';

                // User action log
                userActionLogger.log('question_viewed', {
                    questionIndex: appState.currentQuestionIndex
                });

                // Navigatsiya tugmalarini yangilash
                this.updateNavigationButtons();
                this.updateVerticalNavDots();
            },
            
            loadQuestionImage(randomQuestion, originalIndex) {
                const imgNum = originalIndex + 1;
                const imgPath = `images/${appState.currentTestCode}/${imgNum}.png`;

                const container = dom.elements.questionImageContainer;
                const img = dom.elements.questionImage;
                const placeholder = dom.elements.imageNotFound;

                // default state
                container.classList.remove('hidden');
                img.classList.add('hidden');
                placeholder.classList.remove('hidden');
                placeholder.textContent = 'Rasm yuklanmoqda...';

                // set src and handle events
                img.onload = () => {
                    img.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                    container.classList.remove('hidden');
                };

                img.onerror = () => {
                    // rasm yo'q bo'lsa, placeholder ko'rsatamiz
                    img.classList.add('hidden');
                    placeholder.classList.remove('hidden');
                    placeholder.textContent = 'Rasm mavjud emas';
                    container.classList.remove('hidden');
                };

                // cache-bust to avoid stale image after switching tests
                img.src = imgPath + `?v=${Date.now()}`;
            },
            
            renderOptions(randomQuestion, originalIndex) {
                const optionsContainer = dom.elements.optionsContainer;
                optionsContainer.innerHTML = '';
                optionsContainer.classList.remove('hidden');

                const options = appState.shuffledOptionsMap[originalIndex] || randomQuestion.options || [];

                options.forEach((option, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'option';
                    optionDiv.setAttribute('role', 'radio');
                    optionDiv.setAttribute('tabindex', '0');
                    optionDiv.setAttribute('aria-checked', 'false');

                    const input = document.createElement('input');
                    input.type = 'radio';
                    input.name = 'questionOption';
                    input.value = index;
                    input.id = `option_${index}`;

                    const label = document.createElement('label');
                    label.htmlFor = `option_${index}`;
                    label.innerHTML = option;

                    const applySelection = () => {
                        // clear selection UI
                        optionsContainer.querySelectorAll('.option').forEach(opt => {
                            opt.classList.remove('selected');
                            opt.setAttribute('aria-checked', 'false');
                        });

                        optionDiv.classList.add('selected');
                        optionDiv.setAttribute('aria-checked', 'true');
                        input.checked = true;

                        appState.userAnswers[originalIndex] = index;

                        userActionLogger.log('answer_selected', {
                            questionIndex: originalIndex,
                            answerIndex: index,
                            answerText: (typeof option === 'string' ? option : '').toString().substring(0, 50)
                        });

                        this.updateVerticalNavDots();
                    };

                    // Click anywhere on the card
                    optionDiv.addEventListener('click', (e) => {
                        e.preventDefault();
                        applySelection();
                    });

                    // Keyboard accessibility
                    optionDiv.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            applySelection();
                        }
                    });

                    // Keep change handler for direct input click (fallback)
                    input.addEventListener('change', applySelection);

                    // Restore previous selection
                    if (appState.userAnswers[originalIndex] === index) {
                        optionDiv.classList.add('selected');
                        optionDiv.setAttribute('aria-checked', 'true');
                        input.checked = true;
                    }

                    optionDiv.appendChild(input);
                    optionDiv.appendChild(label);
                    optionsContainer.appendChild(optionDiv);
                });
            },
            
            renderOpenAnswer(originalIndex) {
                const openAnswerContainer = dom.elements.openAnswerContainer;
                openAnswerContainer.classList.remove('hidden');

                const answerPreview = dom.elements.answerPreview;
                const answerPreviewContent = dom.elements.answerPreviewContent;
                const clearAnswerBtn = dom.elements.clearAnswerBtn;
                const openMathEditorBtn = dom.elements.openMathEditorBtn;

                // ensure handlers are wired (existing elements)
                openMathEditorBtn.onclick = modalManager.openMathModal.bind(modalManager);
                clearAnswerBtn.onclick = modalManager.clearAnswer.bind(modalManager);

                // Javobni yangilash
                const currentAnswer = appState.userAnswers[originalIndex] || '';
                if (currentAnswer) {
                    answerPreview.classList.remove('empty');
                    answerPreviewContent.innerHTML = utils.renderLatex(currentAnswer);

                    clearAnswerBtn.style.display = 'block';
                    openMathEditorBtn.textContent = '✏️ Javobni tahrirlash';
                } else {
                    answerPreview.classList.add('empty');
                    answerPreviewContent.innerHTML = '';
                    clearAnswerBtn.style.display = 'none';
                    openMathEditorBtn.innerHTML = '<i class="fas fa-calculator"></i> Matematik javob yozish';
                }

                if (window.MathJax && MathJax.typesetPromise) {
                    setTimeout(() => {
                        MathJax.typesetPromise([answerPreviewContent]);
                    }, 60);
                }
            },

            updateNavigationButtons() {
                const totalQuestions = appState.shuffledQuestions.length;
                
                // Oddiy navigation
                dom.elements.prevBtn.disabled = appState.currentQuestionIndex <= 0;
                dom.elements.nextBtn.disabled = appState.currentQuestionIndex >= totalQuestions - 1;
                dom.elements.finishBtn.disabled = false;
            },
            
            goToPreviousQuestion() {
                if (appState.currentQuestionIndex > 0) {
                    appState.currentQuestionIndex--;
                    this.renderQuestion();
                    userActionLogger.log('question_navigated', {
                        from: appState.currentQuestionIndex + 1,
                        to: appState.currentQuestionIndex,
                        direction: 'previous'
                    });
                }
            },
            
            goToNextQuestion() {
                if (appState.currentQuestionIndex < appState.shuffledQuestions.length - 1) {
                    appState.currentQuestionIndex++;
                    this.renderQuestion();
                    userActionLogger.log('question_navigated', {
                        from: appState.currentQuestionIndex - 1,
                        to: appState.currentQuestionIndex,
                        direction: 'next'
                    });
                }
            },
            
            cancelTest(reason) {
                clearInterval(appState.timerInterval);
                appState.testStarted = false;
                userActionLogger.log('test_cancelled', { reason: reason });
                
                securityManager.disable();
                dom.elements.testHeader.classList.add('hidden');
                document.body.classList.remove('test-active');
                
                let violationDetails = '';
                if (appState.violations.windowSwitch > 0) {
                    violationDetails += `🪟 Boshqa oynaga o'tish: ${appState.violations.windowSwitch} marta\n`;
                }
                if (appState.violations.minorViolations > 0) {
                    violationDetails += `⚠️ Mayda qoidabuzarliklar: ${appState.violations.minorViolations} marta\n`;
                }
                
                alert(`TEST BEKOR QILINDI!\n\nSabab: ${reason}\n\nQoidabuzarliklar:\n${violationDetails}`);
                window.location.reload();
            },
            
            checkOpenAnswer(userAnswer, correctAnswer) {
                if (!CONFIG.checkOpenAnswers || !correctAnswer) {
                    return userAnswer && userAnswer.trim() !== '';
                }
                
                if (!userAnswer || userAnswer.trim() === '') {
                    return false;
                }
                
                const normalizedUser = utils.normalizeMathExpression(userAnswer);
                const normalizedCorrect = utils.normalizeMathExpression(correctAnswer);
                
                if (CONFIG.strictOpenAnswerCheck) {
                    return normalizedUser === normalizedCorrect;
                }
                
                return utils.compareMathExpressions(userAnswer, correctAnswer);
            },
            
            isQuestionCorrect(originalIndex) {
                const question = appState.testData.questions[originalIndex];
                const userAnswer = appState.userAnswers[originalIndex];
                
                if (question.type === 'variant') {
                    if (question.correctIndex === undefined || userAnswer === null) {
                        return false;
                    }
                    
                    const randomOptions = appState.shuffledOptionsMap[originalIndex] || question.options;
                    if (!randomOptions || !randomOptions[userAnswer]) {
                        return false;
                    }
                    
                    const userAnswerText = randomOptions[userAnswer];
                    const correctAnswerText = question.options[question.correctIndex];
                    
                    return userAnswerText === correctAnswerText;
                } 
                else if (question.type === 'open') {
                    return this.checkOpenAnswer(userAnswer, question.correctAnswer);
                }
                
                return false;
            },
            
            getDetailedResults() {
                const detailed = [];
                
                appState.testData.questions.forEach((question, originalIndex) => {
                    const userAnswer = appState.userAnswers[originalIndex];
                    const shuffledIndex = appState.originalToShuffledMap[originalIndex];
                    const isCorrect = this.isQuestionCorrect(originalIndex);
                    
                    detailed.push({
                        questionNumber: shuffledIndex + 1,
                        originalNumber: originalIndex + 1,
                        questionText: question.text.substring(0, 100) + '...',
                        userAnswer: userAnswer || 'Javob berilmagan',
                        correctAnswer: question.type === 'variant' 
                            ? question.options[question.correctIndex]
                            : question.correctAnswer,
                        isCorrect: isCorrect,
                        points: question.points || 1,
                        pointsEarned: isCorrect ? (question.points || 1) : 0
                    });
                });
                
                return detailed;
            },
            
            async finishTest() {
                clearInterval(appState.timerInterval);
                appState.testStarted = false;
                userActionLogger.log('test_finished');
                
                if (document.fullscreenElement) {
                    fullscreenManager.exit();
                }
                
                securityManager.disable();
                document.body.classList.remove('test-active');
                
                const results = this.calculateResults();
                
                appState.detailedResults = this.getDetailedResults();
                results.detailedResults = appState.detailedResults;
                
                const saveSuccess = await firebaseManager.saveTestResult(results);
                if (saveSuccess) {
                    console.log('Natija muvaffaqiyatli saqlandi');
                } else {
                    // Challengeda ikkinchi marta yuborishni to'xtatamiz
                    if (CONFIG.singleAttempt && this.isChallengeMode()) {
                        utils.showMessage("❌ Siz bu challengeni oldin ishlagansiz. Natija qayta yuborilmadi.", 'error');
                    }
                }
                
                dom.elements.finalScore.textContent = results.finalScore.toFixed(1);
                dom.elements.correctCount.textContent = results.correctCount;
                dom.elements.wrongCount.textContent = results.wrongCount;
                dom.elements.totalScoreResult.textContent = results.totalScore.toFixed(1);
                
                const minutes = Math.floor(appState.timeSpent / 60);
                const seconds = appState.timeSpent % 60;
                dom.elements.timeUsed.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                // Sectionlar bo'yicha ball (UI'da savol tahlilisiz)
                const breakdownEl = document.getElementById('sectionScoreBreakdown');
                if (breakdownEl) {
                    const scores = results.sectionScores || {};
                    const entries = Object.entries(scores);
                    if (entries.length === 0) {
                        breakdownEl.innerHTML = '';
                    } else {
                        // Katta bo'limlar birinchi chiqishi uchun possible bo'yicha sort
                        entries.sort((a,b) => (b[1].possible||0) - (a[1].possible||0));
                        breakdownEl.innerHTML = `
                            <div class="section-breakdown-title">📌 Bo'limlar bo'yicha ball</div>
                            <div class="section-breakdown-grid">
                                ${entries.map(([name,s]) => {
                                    const earned = (s.earned||0);
                                    const possible = (s.possible||0);
                                    const correct = (s.correct||0);
                                    const total = (s.total||0);
                                    const pct = possible ? Math.round((earned/possible)*100) : 0;
                                    return `
                                        <div class="section-breakdown-card">
                                            <div class="section-breakdown-name">${name}</div>
                                            <div class="section-breakdown-score">${earned} / ${possible} <small>(${pct}%)</small></div>
                                            <div class="section-breakdown-meta">✅ ${correct}/${total} ta</div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>`;
                    }
                }

                
                dom.showScreen('results');
            },
            
            showDetailedResults() {
                let detailsHTML = `
                    <div style="text-align: left; margin: 20px 0;">
                        <h3 style="color: var(--brand); margin-bottom: 15px;">📊 Savol bo'yicha natijalar:</h3>
                `;
                
                appState.detailedResults.forEach(result => {
                    const statusIcon = result.isCorrect ? '✅' : '❌';
                    const statusColor = result.isCorrect ? 'var(--success)' : 'var(--danger)';
                    
                    detailsHTML += `
                        <div style="
                            background: ${result.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
                            border-left: 4px solid ${statusColor};
                            padding: 12px;
                            margin: 10px 0;
                            border-radius: 4px;
                        ">
                            <div style="font-weight: 600; color: var(--text);">
                                ${statusIcon} Savol ${result.questionNumber}
                                <span style="float: right; color: ${statusColor};">
                                    ${result.pointsEarned}/${result.points} ball
                                </span>
                            </div>
                            <div style="font-size: 14px; color: var(--text-light); margin: 5px 0;">
                                ${result.questionText}
                            </div>
                            <div style="font-size: 13px; margin-top: 8px;">
                                <div><strong>Sizning javobingiz:</strong> ${result.userAnswer}</div>
                                ${!result.isCorrect ? `<div><strong>To'g'ri javob:</strong> ${result.correctAnswer || 'Ko\'rsatilmagan'}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
                
                detailsHTML += `</div>`;
                
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100000;
                    padding: 20px;
                `;
                
                modal.innerHTML = `
                    <div style="
                        background: white;
                        border-radius: 12px;
                        width: 100%;
                        max-width: 800px;
                        max-height: 80vh;
                        overflow-y: auto;
                        padding: 20px;
                        position: relative;
                    ">
                        <button onclick="this.parentElement.parentElement.remove()" 
                                style="
                                    position: absolute;
                                    top: 15px;
                                    right: 15px;
                                    background: var(--danger);
                                    color: white;
                                    border: none;
                                    width: 30px;
                                    height: 30px;
                                    border-radius: 50%;
                                    cursor: pointer;
                                ">×</button>
                        <h2 style="color: var(--brand); margin-bottom: 20px;">📊 Tafsilotli natijalar</h2>
                        ${detailsHTML}
                        <div style="text-align: center; margin-top: 20px;">
                            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                    style="
                                        background: var(--brand);
                                        color: white;
                                        border: none;
                                        padding: 10px 20px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                    ">Yopish</button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
            },
            
            calculateResults() {
                let correctCount = 0;
                let totalScore = 0;

                const sectionScores = {}; // {section: {earned, possible, correct, total}}

                appState.testData.questions.forEach((question, originalIndex) => {
                    const userAnswer = appState.userAnswers[originalIndex];
                    const section = question.section || 'Umumiy';
                    const points = question.points || 1;

                    if (!sectionScores[section]) {
                        sectionScores[section] = { earned: 0, possible: 0, correct: 0, total: 0 };
                    }
                    sectionScores[section].possible += points;
                    sectionScores[section].total += 1;

                    let isCorrect = false;

                    if (question.type === 'variant') {
                        if (question.correctIndex !== undefined && userAnswer !== null) {
                            const randomOptions = appState.shuffledOptionsMap[originalIndex] || question.options;
                            if (randomOptions && randomOptions[userAnswer] !== undefined) {
                                const userAnswerText = randomOptions[userAnswer];
                                const correctAnswerText = question.options[question.correctIndex];
                                if (userAnswerText === correctAnswerText) {
                                    isCorrect = true;
                                }
                            }
                        }
                    } else if (question.type === 'open') {
                        if (userAnswer && userAnswer.trim() !== '') {
                            isCorrect = this.checkOpenAnswer(userAnswer, question.correctAnswer);
                        }
                    }

                    if (isCorrect) {
                        correctCount++;
                        totalScore += points;
                        sectionScores[section].earned += points;
                        sectionScores[section].correct += 1;
                    }
                });

                const penalty = (appState.violations.windowSwitch + appState.violations.minorViolations) * CONFIG.penaltyPerViolation;
                const finalScore = Math.max(0, totalScore - penalty);

                return {
                    correctCount,
                    wrongCount: appState.testData.questions.length - correctCount,
                    totalScore,
                    finalScore,
                    penalty,
                    sectionScores
                };
            }
        };

// expose for other modules
window.testManager = testManager;


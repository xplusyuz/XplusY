// ==================== TEST MANAGER ====================
        const testManager = {
            // Mobile fix: make sure fixed test header doesn't cover question content
            _headerOffsetBound: null,

            updateHeaderOffset() {
                try {
                    const headerEl = dom.elements.testHeader || document.getElementById('testHeader');
                    if (!headerEl || headerEl.classList.contains('hidden')) return;

                    const rect = headerEl.getBoundingClientRect();
                    const h = Math.max(0, Math.round(rect.height));
                    document.documentElement.style.setProperty('--testHeaderH', h + 'px');
                    document.body.style.setProperty('--testHeaderH', h + 'px');

                    // add padding-top to wrap only when header fixed/visible
                    const wrap = document.querySelector('.wrap');
                    if (wrap) wrap.style.paddingTop = `calc(var(--testHeaderH, 0px) + 10px)`;
                } catch (e) {}
            },

            bindHeaderOffset() {
                try {
                    if (this._headerOffsetBound) return;
                    this._headerOffsetBound = () => this.updateHeaderOffset();
                    window.addEventListener('resize', this._headerOffsetBound, { passive: true });
                    window.addEventListener('orientationchange', this._headerOffsetBound, { passive: true });
                    // slight delay (fonts/layout)
                    setTimeout(() => this.updateHeaderOffset(), 50);
                } catch (e) {}
            },

            // Test yuklash va boshlash funksiyasi
            async loadTestData(testCode) {
                try {
                    dom.hideAllCards();
                    dom.elements.loadingScreen.classList.remove('hidden');
                    dom.elements.loadingScreen.querySelector('h2').textContent = 'Yuklanmoqda...';
                    dom.elements.loadingScreen.querySelector('p').textContent = "Test ma'lumotlari yuklanmoqda...";

                    appState.testCode = testCode;

                    // Firestore dan testni olish
                    const testData = await firebaseService.getTest(testCode);

                    if (!testData) {
                        utils.showMessage("❌ Test topilmadi. Kodni tekshiring.", "error");
                        dom.elements.loadingScreen.classList.add('hidden');
                        dom.elements.codeInputCard.classList.remove('hidden');
                        return;
                    }

                    // Test ma'lumotlarini saqlash
                    appState.testData = testData;

                    // Test mode
                    appState.testMode = (testData.mode || testData.type || 'challenge').toLowerCase();

                    // Dastlabki mapping / shuffle
                    this.prepareQuestions();

                    // UI ga test intro chiqarish
                    this.renderTestIntro();

                    dom.elements.loadingScreen.classList.add('hidden');
                    dom.elements.introCard.classList.remove('hidden');

                    // Header info
                    dom.elements.testHeader.classList.add('hidden');
                    dom.elements.securityMonitor.classList.add('hidden');

                } catch (error) {
                    console.error("Test yuklashda xato:", error);
                    utils.showMessage("❌ Test yuklashda xatolik yuz berdi.", "error");
                    dom.elements.loadingScreen.classList.add('hidden');
                    dom.elements.codeInputCard.classList.remove('hidden');
                }
            },

            prepareQuestions() {
                const questions = (appState.testData && appState.testData.questions) ? appState.testData.questions : [];

                // Shuffle questions (seeded if user selected)
                appState.shuffledQuestions = [...questions];

                // Original mapping for logs / images etc.
                appState.shuffledToOriginalMap = {};
                appState.originalToShuffledMap = {};

                for (let i = 0; i < appState.shuffledQuestions.length; i++) {
                    appState.shuffledToOriginalMap[i] = i;
                    appState.originalToShuffledMap[i] = i;
                }

                // Prepare options shuffle map
                appState.shuffledOptionsMap = {};
                for (let i = 0; i < questions.length; i++) {
                    appState.shuffledOptionsMap[i] = (questions[i] && questions[i].options) ? [...questions[i].options] : [];
                }

                // answers array
                appState.userAnswers = {};

                // start index
                appState.currentQuestionIndex = 0;
            },

            renderTestIntro() {
                const testData = appState.testData;
                if (!testData) return;

                dom.elements.testTitle.textContent = testData.title || 'Test';
                dom.elements.testDescription.textContent = testData.description || '';

                const totalQuestions = (testData.questions || []).length;
                dom.elements.totalQuestions.textContent = totalQuestions;

                const duration = testData.durationMinutes || testData.duration || 0;
                dom.elements.testDuration.textContent = `${duration} daqiqa`;

                // total points
                let totalPoints = 0;
                (testData.questions || []).forEach(q => { totalPoints += (q.points || 1); });
                dom.elements.totalPoints.textContent = totalPoints;

                // sections count
                const sections = testData.sections || [];
                dom.elements.testSections.textContent = sections.length || 1;

                // section list
                if (dom.renderSectionList) {
                    dom.renderSectionList(sections, testData.questions || []);
                }
            },

            async startTest() {
                try {
                    // attempt rules: challenge only
                    if (appState.testMode === 'challenge') {
                        const ok = await firebaseService.createAttemptIfNotExists(
                            appState.testCode,
                            appState.selectedStudent ? appState.selectedStudent.id : 'anonymous',
                            {
                                studentName: appState.selectedStudent ? (appState.selectedStudent.name || appState.selectedStudent.fullName || '') : '',
                                className: appState.selectedClass || '',
                                startedAt: utils.nowISO(),
                                status: 'in_progress'
                            }
                        );

                        if (!ok) {
                            utils.showMessage("⚠️ Siz bu testni avval yechgansiz!", "warning");
                            return;
                        }
                    }

                    // Start time & duration
                    appState.startTime = Date.now();
                    appState.durationMinutes = Number(appState.testData.durationMinutes || appState.testData.duration || 0);
                    appState.timeLeftSec = Math.max(0, appState.durationMinutes * 60);

                    // Violations
                    appState.violations = [];
                    appState.violationCount = 0;

                    // UI
                    dom.hideAllCards();
                    dom.elements.questionCard.classList.remove('hidden');
                    dom.elements.testHeader.classList.remove('hidden');
                    dom.elements.securityMonitor.classList.remove('hidden');

                    // Header student info
                    if (dom.updateHeaderStudentInfo) {
                        dom.updateHeaderStudentInfo(appState.selectedStudent, appState.selectedClass);
                    }
                    if (dom.updateViolationCount) dom.updateViolationCount(0);

                    // security + fullscreen
                    try { security.initSecurity(); } catch (e) {}
                    try { fullscreen.initFullScreen(); } catch (e) {}

                    // timer
                    this.startTimer();

                    // header offset fix
                    this.bindHeaderOffset();
                    this.updateHeaderOffset();

                    // render first question
                    this.renderQuestion();

                } catch (e) {
                    console.error(e);
                    utils.showMessage("❌ Testni boshlashda xatolik", "error");
                }
            },

            startTimer() {
                if (appState.timerInterval) clearInterval(appState.timerInterval);

                const tick = () => {
                    if (appState.timeLeftSec <= 0) {
                        this.finishTest(true);
                        return;
                    }
                    appState.timeLeftSec -= 1;
                    if (dom.updateTimer) dom.updateTimer(appState.timeLeftSec);
                    if (dom.updateHeaderTimer) dom.updateHeaderTimer(appState.timeLeftSec);
                };

                if (dom.updateTimer) dom.updateTimer(appState.timeLeftSec);
                if (dom.updateHeaderTimer) dom.updateHeaderTimer(appState.timeLeftSec);

                appState.timerInterval = setInterval(tick, 1000);
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
                dom.elements.questionText.innerHTML = utils.normalizeMathDelimiters(randomQuestion.text || '');

                // KaTeX render (question)
                utils.renderMath(dom.elements.questionText);

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

                // KaTeX render (question + options + preview)
                utils.renderMath(dom.elements.questionText);
                utils.renderMath(dom.elements.optionsContainer);
                utils.renderMath(dom.elements.answerPreviewContent);

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
                const container = dom.elements.questionImageContainer;
                const img = dom.elements.questionImage;
                const placeholder = dom.elements.imageNotFound;

                // Hide by default
                container.classList.add('hidden');
                img.classList.add('hidden');
                placeholder.textContent = 'Savol yuklanmoqda...';

                const hasImage = !!randomQuestion.hasImage;
                if (!hasImage) {
                    placeholder.textContent = 'Rasm mavjud emas';
                    container.classList.add('hidden');
                    return;
                }

                container.classList.remove('hidden');

                // Determine image path
                let path = randomQuestion.imagePath || '';
                if (!path && randomQuestion.autoImagePath) {
                    const code = appState.testCode || 'test';
                    // images are named by question id or index (your system may vary)
                    const qid = randomQuestion.id != null ? randomQuestion.id : (originalIndex + 1);
                    path = `images/${code}/${qid}.webp`;
                }

                if (!path) {
                    placeholder.textContent = 'Rasm topilmadi';
                    img.classList.add('hidden');
                    return;
                }

                img.onload = () => {
                    img.classList.remove('hidden');
                    placeholder.textContent = '';
                };

                img.onerror = () => {
                    img.classList.add('hidden');
                    placeholder.textContent = 'Rasm topilmadi';
                };

                img.src = path;
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
                    label.innerHTML = utils.normalizeMathDelimiters(option);

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

                // KaTeX render (options)
                utils.renderMath(optionsContainer);
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
                    answerPreviewContent.innerHTML = (utils.wrapLatex ? utils.wrapLatex(currentAnswer) : utils.renderLatex(currentAnswer));

                    clearAnswerBtn.style.display = 'block';
                    openMathEditorBtn.textContent = '✏️ Javobni tahrirlash';
                } else {
                    answerPreview.classList.add('empty');
                    answerPreviewContent.innerHTML = '';
                    clearAnswerBtn.style.display = 'none';
                    openMathEditorBtn.innerHTML = '<i class="fas fa-calculator"></i> Matematik javob yozish';
                }

                // KaTeX render (open answer preview)
                utils.renderMath(answerPreviewContent);
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
                }
            },

            goToNextQuestion() {
                if (appState.currentQuestionIndex < appState.shuffledQuestions.length - 1) {
                    appState.currentQuestionIndex++;
                    this.renderQuestion();
                }
            },

            jumpToQuestion(index) {
                index = Number(index);
                if (Number.isNaN(index)) return;
                if (index < 0 || index >= appState.shuffledQuestions.length) return;
                appState.currentQuestionIndex = index;
                this.renderQuestion();
            },

            updateVerticalNavDots() {
                const dotsContainer = dom.elements.verticalNavDots;
                if (!dotsContainer) return;

                dotsContainer.innerHTML = '';
                const total = appState.shuffledQuestions.length;

                for (let i = 0; i < total; i++) {
                    const btn = document.createElement('button');
                    btn.className = 'nav-dot';
                    btn.type = 'button';
                    btn.textContent = String(i + 1);

                    if (i === appState.currentQuestionIndex) btn.classList.add('active');

                    const originalIndex = appState.shuffledToOriginalMap[i] !== undefined ? appState.shuffledToOriginalMap[i] : i;
                    const ans = appState.userAnswers[originalIndex];
                    const answered = (ans !== undefined && ans !== null && ans !== '');
                    if (answered) btn.classList.add('answered');

                    btn.addEventListener('click', () => this.jumpToQuestion(i));
                    dotsContainer.appendChild(btn);
                }
            },

            async finishTest(force = false) {
                try {
                    if (appState.timerInterval) {
                        clearInterval(appState.timerInterval);
                        appState.timerInterval = null;
                    }

                    const { score, correct, wrong, breakdown } = this.calculateScore();

                    const timeUsedSec = Math.max(0, (appState.durationMinutes * 60) - appState.timeLeftSec);
                    const timeUsedStr = utils.formatTime(timeUsedSec);

                    // persist attempt only for challenge
                    if ((appState.testMode || 'challenge') === 'challenge') {
                        await firebaseService.finishAttempt(appState.testCode, appState.selectedStudent ? appState.selectedStudent.id : 'anonymous', {
                            finishedAt: utils.nowISO(),
                            status: "finished",
                            score,
                            correct,
                            wrong,
                            timeUsed: timeUsedStr,
                            timeUsedSec,
                            violations: appState.violations || [],
                            violationCount: appState.violationCount || 0,
                            answers: appState.userAnswers || {},
                            sectionBreakdown: breakdown || {}
                        });
                    }

                    dom.elements.testHeader.classList.add('hidden');
                    dom.elements.securityMonitor.classList.add('hidden');

                    dom.hideAllCards();
                    dom.elements.resultsCard.classList.remove('hidden');

                    if (dom.renderResults) {
                        dom.renderResults({
                            score,
                            correct,
                            wrong,
                            totalQuestions: appState.shuffledQuestions.length,
                            timeUsed: timeUsedStr,
                            breakdown
                        });
                    } else {
                        // basic render fallback
                        dom.elements.finalScore.textContent = score;
                        dom.elements.correctCount.textContent = correct;
                        dom.elements.wrongCount.textContent = wrong;
                        dom.elements.totalScoreResult.textContent = score;
                        dom.elements.timeUsed.textContent = timeUsedStr;
                    }

                } catch (e) {
                    console.error(e);
                    utils.showMessage("❌ Testni yakunlashda xatolik", "error");
                }
            },

            calculateScore() {
                const test = appState.testData;
                const questions = appState.shuffledQuestions || [];
                let score = 0;
                let correct = 0;
                let wrong = 0;

                const breakdown = {}; // section -> {score, correct, wrong}

                for (let shuffledIndex = 0; shuffledIndex < questions.length; shuffledIndex++) {
                    const q = questions[shuffledIndex];
                    const originalIndex = appState.shuffledToOriginalMap[shuffledIndex] !== undefined ? appState.shuffledToOriginalMap[shuffledIndex] : shuffledIndex;

                    const pts = Number(q.points || 1);
                    const section = q.section || "Umumiy";
                    if (!breakdown[section]) breakdown[section] = { score: 0, correct: 0, wrong: 0 };

                    const ans = appState.userAnswers[originalIndex];

                    if (q.type === 'open') {
                        // open questions are not auto-graded
                        continue;
                    }

                    const ok = (Number(ans) === Number(q.correctIndex));
                    if (ok) {
                        score += pts;
                        correct += 1;
                        breakdown[section].score += pts;
                        breakdown[section].correct += 1;
                    } else {
                        wrong += 1;
                        breakdown[section].wrong += 1;
                    }
                }

                return { score, correct, wrong, breakdown };
            }
        };

        window.testManager = testManager;
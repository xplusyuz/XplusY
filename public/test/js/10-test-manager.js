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

            // ==================== STATE HELPERS ====================
            getCurrentQuestion() {
                return appState.shuffledQuestions[appState.currentQuestionIndex];
            },

            isOpenQuestion(q) {
                return q && (q.type === 'open' || q.type === 'open_answer' || q.type === 'openAnswer');
            },

            // ==================== TEST FLOW ====================
            async loadTestByCode(testCode) {
                try {
                    appState.testCode = testCode;
                    appState.testData = null;
                    appState.testLoaded = false;

                    // UI
                    dom.hideAllCards();
                    dom.show(dom.elements.loadingScreen);

                    // Fetch test
                    const testData = await firebaseService.getTest(testCode);
                    if (!testData) {
                        utils.showMessage(`❌ "${testCode}" test topilmadi`, "error");
                        dom.hide(dom.elements.loadingScreen);
                        dom.show(dom.elements.codeInputCard);
                        return;
                    }

                    appState.testData = testData;
                    appState.testLoaded = true;

                    // Prepare class + students
                    await this.prepareClassAndStudents();

                    // Go to class selection
                    dom.hide(dom.elements.loadingScreen);
                    dom.show(dom.elements.classSelectionCard);
                } catch (e) {
                    console.error(e);
                    utils.showMessage("❌ Testni yuklashda xatolik", "error");
                    dom.hide(dom.elements.loadingScreen);
                    dom.show(dom.elements.codeInputCard);
                }
            },

            async prepareClassAndStudents() {
                try {
                    // classes list
                    const classes = await firebaseService.getClasses();
                    appState.classes = classes || [];

                    dom.populateClassSelect(appState.classes);

                    // students are loaded later after class selection
                    appState.students = [];
                } catch (e) {
                    console.error(e);
                    appState.classes = [];
                    dom.populateClassSelect([]);
                }
            },

            async onClassSelected(className) {
                try {
                    appState.selectedClass = className;

                    // load students for class
                    const students = await firebaseService.getStudentsByClass(className);
                    appState.students = students || [];
                    dom.populateStudentSelect(appState.students);

                    dom.hide(dom.elements.classSelectionCard);
                    dom.show(dom.elements.studentSelectionCard);
                } catch (e) {
                    console.error(e);
                    utils.showMessage("❌ O'quvchilarni yuklashda xatolik", "error");
                }
            },

            async onStudentSelected(studentId) {
                const student = (appState.students || []).find(s => String(s.id) === String(studentId)) || null;
                if (!student) {
                    utils.showMessage("❌ O'quvchi topilmadi", "error");
                    return;
                }

                appState.selectedStudent = student;
                dom.updateSelectedStudentInfo(student);

                // Check previous attempt
                await this.checkPreviousAttempt();

                // Show intro
                dom.hide(dom.elements.studentSelectionCard);
                dom.show(dom.elements.introCard);

                this.renderIntro();
            },

            renderIntro() {
                const test = appState.testData;
                if (!test) return;

                dom.elements.testTitle.textContent = test.title || "📋 Test";
                dom.elements.testDescription.textContent = test.description || "";

                const questions = test.questions || [];
                dom.elements.totalQuestions.textContent = String(questions.length);

                const duration = Number(test.durationMinutes || test.duration || 0);
                dom.elements.testDuration.textContent = `${duration} daq`;

                // sections + total points
                const sections = test.sections || [];
                dom.elements.testSections.textContent = String(sections.length || 1);

                // total points
                let totalPoints = 0;
                questions.forEach(q => totalPoints += Number(q.points || 1));
                dom.elements.totalPoints.textContent = String(totalPoints);

                dom.renderSectionList(sections, questions);
            },

            async checkPreviousAttempt() {
                try {
                    const student = appState.selectedStudent;
                    const testCode = appState.testCode;
                    if (!student || !testCode) return;

                    const attempt = await firebaseService.getAttempt(testCode, student.id);
                    appState.previousAttempt = attempt || null;

                    if (attempt) {
                        dom.show(dom.elements.alreadyAttemptedWarning);
                        dom.elements.attemptDate.textContent = (attempt.finishedAt || attempt.startedAt || "oldin");

                        if (attempt.score != null || attempt.timeUsed != null) {
                            dom.show(dom.elements.previousResult);
                            dom.elements.previousScore.textContent = String(attempt.score ?? 0);
                            dom.elements.previousTime.textContent = String(attempt.timeUsed ?? "00:00");
                        } else {
                            dom.hide(dom.elements.previousResult);
                        }

                        // disable start
                        dom.elements.startTestBtn.disabled = true;
                        dom.elements.startTestBtn.style.opacity = "0.6";
                        dom.show(dom.elements.viewPreviousAttemptBtn);
                    } else {
                        dom.hide(dom.elements.alreadyAttemptedWarning);
                        dom.elements.startTestBtn.disabled = false;
                        dom.elements.startTestBtn.style.opacity = "1";
                        dom.hide(dom.elements.viewPreviousAttemptBtn);
                    }
                } catch (e) {
                    console.error(e);
                }
            },

            async startTest() {
                try {
                    const test = appState.testData;
                    const student = appState.selectedStudent;
                    if (!test || !student) return;

                    // challenge/open rules: attempts only for challenge mode
                    const mode = (test.mode || test.type || "challenge").toLowerCase();
                    appState.testMode = mode;

                    // create attempt in firestore (for challenge mode)
                    if (mode === "challenge") {
                        const attemptCreated = await firebaseService.createAttemptIfNotExists(
                            appState.testCode,
                            student.id,
                            {
                                studentName: student.name || student.fullName || "",
                                className: appState.selectedClass || "",
                                startedAt: utils.nowISO(),
                                status: "in_progress"
                            }
                        );

                        if (!attemptCreated) {
                            // already attempted
                            utils.showMessage("⚠️ Siz bu testni avval yechgansiz!", "warning");
                            await this.checkPreviousAttempt();
                            return;
                        }
                    }

                    // shuffle questions
                    appState.shuffledQuestions = utils.shuffleArray([...(test.questions || [])]);
                    appState.currentQuestionIndex = 0;
                    appState.answers = {};
                    appState.violations = [];
                    appState.violationCount = 0;
                    appState.startTime = Date.now();
                    appState.timerInterval = null;

                    // prepare per question time if needed
                    appState.durationMinutes = Number(test.durationMinutes || test.duration || 0);
                    appState.timeLeftSec = Math.max(0, appState.durationMinutes * 60);

                    // UI
                    dom.hide(dom.elements.introCard);
                    dom.show(dom.elements.questionCard);
                    dom.show(dom.elements.testHeader);
                    dom.show(dom.elements.securityMonitor);

                    // header info
                    dom.updateHeaderStudentInfo(appState.selectedStudent, appState.selectedClass);
                    dom.updateViolationCount(0);

                    this.bindHeaderOffset();
                    this.updateHeaderOffset();

                    // security + fullscreen
                    try { security.initSecurity(); } catch (e) {}
                    try { fullscreen.initFullScreen(); } catch (e) {}

                    // timer
                    this.startTimer();

                    // render first
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
                    dom.updateTimer(appState.timeLeftSec);
                    dom.updateHeaderTimer(appState.timeLeftSec);
                };

                // initial update
                dom.updateTimer(appState.timeLeftSec);
                dom.updateHeaderTimer(appState.timeLeftSec);

                appState.timerInterval = setInterval(tick, 1000);
            },

            // ==================== RENDER QUESTION ====================
            renderQuestion() {
                try {
                    const randomQuestion = this.getCurrentQuestion();
                    if (!randomQuestion) return;

                    // update UI header
                    dom.elements.currentQ.textContent = String(appState.currentQuestionIndex + 1);
                    dom.elements.currentQuestionPoints.textContent = `${randomQuestion.points || 1} ball`;

                    // section name
                    const sectionName = utils.getSectionName(appState.testData, randomQuestion);
                    dom.elements.sectionNameDisplay.textContent = sectionName || "Umumiy";
                    dom.elements.currentSectionName.textContent = sectionName || "Umumiy";

                    // image
                    dom.updateQuestionImage(randomQuestion);

                    // question text (KaTeX-ready)
                    const questionText = dom.elements.questionText;
                    questionText.innerHTML = utils.normalizeMathDelimiters(randomQuestion.text || '');
                    utils.renderMath(dom.elements.questionCard || dom.elements.questionText);

                    // options vs open answer
                    if (!this.isOpenQuestion(randomQuestion)) {
                        // variants
                        dom.elements.optionsContainer.classList.remove('hidden');
                        dom.elements.openAnswerContainer.classList.add('hidden');
                        dom.renderOptions(randomQuestion, appState.answers[randomQuestion.id]);

                        // render options math too
                        utils.renderMath(dom.elements.optionsContainer);
                    } else {
                        // open answer
                        dom.elements.optionsContainer.classList.add('hidden');
                        dom.elements.openAnswerContainer.classList.remove('hidden');

                        const prevAnswer = appState.answers[randomQuestion.id] || '';
                        this.updateOpenAnswerPreview(prevAnswer, false);
                    }

                // KaTeX render (utils.renderMath wraps window.__LM_KATEX_RENDER)
                try {
                    utils.renderMath(dom.elements.questionCard || dom.elements.questionText);
                    utils.renderMath(dom.elements.optionsContainer);
                    utils.renderMath(dom.elements.answerPreviewContent);
                } catch (e) {}

                } catch (e) {
                    console.error(e);
                }

                // Navigation buttons
                this.updateNavigationButtons();
                this.updateNavDots();
            },

            // called from dom.renderOptions -> event-handlers also update selected
            selectOption(questionId, optionIndex) {
                const q = this.getCurrentQuestion();
                if (!q || q.id !== questionId) return;

                appState.answers[questionId] = optionIndex;
                dom.highlightSelectedOption(optionIndex);
            },

            // ==================== OPEN ANSWER ====================
            updateOpenAnswerPreview(answer, userEdited = true) {
                const answerPreview = dom.elements.answerPreview;
                const answerPreviewContent = dom.elements.answerPreviewContent;
                const clearAnswerBtn = dom.elements.clearAnswerBtn;
                const openMathEditorBtn = dom.elements.openMathEditorBtn;

                const has = !!(answer && String(answer).trim());

                if (!has) {
                    answerPreview.classList.add('empty');
                    answerPreviewContent.innerHTML = '<div style="text-align:center; color:#94a3b8;">Javob yozilmagan</div>';
                    clearAnswerBtn.style.display = 'none';
                    openMathEditorBtn.innerHTML = '<i class="fas fa-calculator"></i> Matematik javob yozish';
                } else {
                    answerPreview.classList.remove('empty');

                    // support plain latex without delimiters
                    let out = String(answer);
                    if (utils && utils.wrapLatex) out = utils.wrapLatex(out);
                    else out = utils.normalizeMathDelimiters(out);

                    answerPreviewContent.innerHTML = out;
                    clearAnswerBtn.style.display = 'inline-flex';
                    openMathEditorBtn.innerHTML = '<i class="fas fa-edit"></i> Javobni tahrirlash';
                }

                // KaTeX render preview
                try { utils.renderMath(answerPreviewContent); } catch (e) {}
            },

            clearOpenAnswer() {
                const q = this.getCurrentQuestion();
                if (!q) return;
                appState.answers[q.id] = '';
                this.updateOpenAnswerPreview('', true);
            },

            // ==================== NAVIGATION ====================
            updateNavigationButtons() {
                const totalQuestions = appState.shuffledQuestions.length;
                const idx = appState.currentQuestionIndex;

                dom.elements.prevBtn.disabled = idx <= 0;
                dom.elements.nextBtn.disabled = idx >= totalQuestions - 1;

                // finish visible always but emphasis on last
                if (idx >= totalQuestions - 1) {
                    dom.elements.finishBtn.classList.add('pulse');
                } else {
                    dom.elements.finishBtn.classList.remove('pulse');
                }
            },

            prevQuestion() {
                if (appState.currentQuestionIndex <= 0) return;
                appState.currentQuestionIndex -= 1;
                this.renderQuestion();
            },

            nextQuestion() {
                if (appState.currentQuestionIndex >= appState.shuffledQuestions.length - 1) return;
                appState.currentQuestionIndex += 1;
                this.renderQuestion();
            },

            jumpToQuestion(index) {
                index = Number(index);
                if (Number.isNaN(index)) return;
                if (index < 0 || index >= appState.shuffledQuestions.length) return;
                appState.currentQuestionIndex = index;
                this.renderQuestion();
            },

            updateNavDots() {
                try {
                    const container = dom.elements.verticalNavDots;
                    if (!container) return;

                    container.innerHTML = '';

                    const total = appState.shuffledQuestions.length;
                    for (let i = 0; i < total; i++) {
                        const btn = document.createElement('button');
                        btn.className = 'nav-dot';
                        btn.type = 'button';
                        btn.title = `Savol ${i + 1}`;
                        btn.textContent = String(i + 1);

                        if (i === appState.currentQuestionIndex) btn.classList.add('active');

                        const q = appState.shuffledQuestions[i];
                        const answered = (appState.answers[q.id] !== undefined && appState.answers[q.id] !== null && appState.answers[q.id] !== '');
                        if (answered) btn.classList.add('answered');

                        btn.addEventListener('click', () => this.jumpToQuestion(i));
                        container.appendChild(btn);
                    }
                } catch (e) {}
            },

            // ==================== FINISH & RESULTS ====================
            async finishTest(force = false) {
                try {
                    // stop timer
                    if (appState.timerInterval) {
                        clearInterval(appState.timerInterval);
                        appState.timerInterval = null;
                    }

                    const test = appState.testData;
                    const mode = (appState.testMode || (test && test.mode) || "challenge").toLowerCase();

                    // compute score
                    const { score, correct, wrong, breakdown } = this.calculateScore();

                    const timeUsedSec = Math.max(0, (appState.durationMinutes * 60) - appState.timeLeftSec);
                    const timeUsedStr = utils.formatTime(timeUsedSec);

                    // persist attempt only for challenge
                    if (mode === "challenge") {
                        await firebaseService.finishAttempt(appState.testCode, appState.selectedStudent.id, {
                            finishedAt: utils.nowISO(),
                            status: "finished",
                            score,
                            correct,
                            wrong,
                            timeUsed: timeUsedStr,
                            timeUsedSec,
                            violations: appState.violations || [],
                            violationCount: appState.violationCount || 0,
                            answers: appState.answers || {},
                            sectionBreakdown: breakdown || {}
                        });
                    }

                    // update header points etc
                    dom.hide(dom.elements.testHeader);
                    dom.hide(dom.elements.securityMonitor);

                    // show results
                    dom.hide(dom.elements.questionCard);
                    dom.show(dom.elements.resultsCard);

                    dom.renderResults({
                        score,
                        correct,
                        wrong,
                        totalQuestions: appState.shuffledQuestions.length,
                        timeUsed: timeUsedStr,
                        breakdown
                    });

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

                for (const q of questions) {
                    const pts = Number(q.points || 1);
                    const section = utils.getSectionName(test, q) || "Umumiy";
                    if (!breakdown[section]) breakdown[section] = { score: 0, correct: 0, wrong: 0 };

                    const ans = appState.answers[q.id];

                    if (this.isOpenQuestion(q)) {
                        // open questions are not auto-graded
                        // keep as 0 here
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

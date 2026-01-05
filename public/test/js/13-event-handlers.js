// ==================== EVENT HANDLERS ====================
        const eventHandlers = {
            // LeaderMath foydalanuvchisini avto aniqlash
            async autoIdentifyCurrentUser() {
                try {
                    const lmUser = await (leaderMathAuth?.me?.() ?? Promise.resolve(null));
                    const student = leaderMathAuth?.toStudent?.(lmUser) || null;
                    if (!student) return false;

                    appState.currentStudent = student;
                    // LeaderMath user modelida sinf yo'q bo'lishi mumkin; bo'lsa olamiz.
                    const cls = lmUser?.className || lmUser?.studentClass || lmUser?.class || '';
                    appState.currentClass = cls;
                    return true;
                } catch (e) {
                    console.warn('LeaderMath user aniqlashda xato:', e);
                    return false;
                }
            },

            // Intro ekranini tayyorlash (manual tanlashsiz ham ishlaydi)
            async openIntroForCurrentStudent() {
                if (!appState.currentStudent) {
                    utils.showMessage('Foydalanuvchi aniqlanmadi. Iltimos, LeaderMathda login qiling.', 'error');
                    return false;
                }

                dom.elements.testTitle.textContent = appState.testData.title || "Test";
                dom.elements.testDescription.textContent = appState.testData.description || "";
                dom.elements.totalQuestions.textContent = appState.testData.questions.length;
                dom.elements.testDuration.textContent = (appState.testData.durationMinutes || 30) + ' daqiqa';

                const totalPoints = appState.testData.questions.reduce((sum, q) => sum + (q.points || 1), 0);
                dom.elements.totalPoints.textContent = totalPoints;

                if (appState.testData.sections && appState.testData.sections.length > 0) {
                    dom.elements.testSections.textContent = appState.testData.sections.length;
                    dom.elements.sectionList.innerHTML = '<h3>Bo\'limlar:</h3>';
                    appState.testData.sections.forEach(section => {
                        const div = document.createElement('div');
                        div.style.padding = '8px';
                        div.style.borderBottom = '1px solid var(--border)';
                        div.textContent = `${section.name} (${section.start}-${section.end})`;
                        dom.elements.sectionList.appendChild(div);
                    });
                } else {
                    dom.elements.testSections.textContent = '1';
                }

                dom.elements.studentName.textContent = appState.currentStudent.fullName;

                // Single-attempt cheklovi faqat challengelar uchun
                if (CONFIG.singleAttempt && testManager.isChallengeMode()) {
                    appState.previousAttempt = await testManager.checkPreviousAttempt();

                    if (appState.previousAttempt) {
                        dom.elements.alreadyAttemptedWarning.classList.remove('hidden');

                        const attemptDate = new Date(appState.previousAttempt.completedAt);
                        dom.elements.attemptDate.textContent = attemptDate.toLocaleDateString('uz-UZ', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });

                        if (appState.previousAttempt.score !== undefined) {
                            dom.elements.previousResult.classList.remove('hidden');
                            dom.elements.previousScore.textContent = appState.previousAttempt.score.toFixed(1);

                            const minutes = Math.floor(appState.previousAttempt.timeSpent / 60);
                            const seconds = appState.previousAttempt.timeSpent % 60;
                            dom.elements.previousTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        }

                        dom.elements.viewPreviousAttemptBtn.classList.remove('hidden');

                        dom.elements.startTestBtn.disabled = true;
                        dom.elements.startTestBtn.textContent = "🚫 Siz bu testni oldin ishlagansiz";
                        dom.elements.startTestBtn.style.background = "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)";
                        dom.elements.startTestBtn.style.cursor = "not-allowed";
                        dom.elements.startTestBtn.onclick = null;

                        dom.elements.studentName.style.color = "var(--danger)";
                        document.getElementById('selectedStudentInfo').style.borderLeftColor = "var(--danger)";
                    } else {
                        dom.elements.alreadyAttemptedWarning.classList.add('hidden');
                        dom.elements.viewPreviousAttemptBtn.classList.add('hidden');

                        dom.elements.startTestBtn.disabled = false;
                        dom.elements.startTestBtn.textContent = "🚀 Testni Boshlash";
                        dom.elements.startTestBtn.style.background = "";
                        dom.elements.startTestBtn.style.cursor = "pointer";
                        dom.elements.startTestBtn.onclick = testManager.startTest.bind(testManager);

                        dom.elements.studentName.style.color = "";
                        document.getElementById('selectedStudentInfo').style.borderLeftColor = "var(--brand)";
                    }
                } else {
                    // Oddiy testlar uchun cheklov yo'q
                    dom.elements.alreadyAttemptedWarning.classList.add('hidden');
                    dom.elements.viewPreviousAttemptBtn.classList.add('hidden');

                    dom.elements.startTestBtn.disabled = false;
                    dom.elements.startTestBtn.textContent = "🚀 Testni Boshlash";
                    dom.elements.startTestBtn.style.background = "";
                    dom.elements.startTestBtn.style.cursor = "pointer";
                    dom.elements.startTestBtn.onclick = testManager.startTest.bind(testManager);

                    dom.elements.studentName.style.color = "";
                    document.getElementById('selectedStudentInfo').style.borderLeftColor = "var(--brand)";
                }

                dom.showScreen('intro');
                return true;
            },

            async handleTestCodeLoad() {
                const code = dom.elements.testCodeInput.value.trim();
                if (!code) {
                    utils.showMessage('Test kodini kiriting', 'error');
                    return;
                }
                
                const loaded = await this.loadTestData(code);
                if (loaded) {
                    // LeaderMath orqali avto user aniqlashga urinamiz
                    const ok = await this.autoIdentifyCurrentUser();
                    if (ok) {
                        await this.openIntroForCurrentStudent();
                    } else {
                        // Fallback: eski sinf/o'quvchi oqimi
                        await this.populateClasses();
                        dom.showScreen('classSelection');
                    }
                }
            },
            
            async loadTestData(code) {
                try {
                    dom.showScreen('loading');
                    appState.currentTestCode = code;
                    
                    if (CONFIG.useFirebase && appState.firebaseAvailable) {
                        appState.testData = await firebaseManager.loadTest(code);
                    }
                    
                    if (!appState.testData && CONFIG.fallbackToJSON) {
                        appState.testData = await utils.loadJSON(`${code}.json`);
                    }
                    
                    if (!appState.testData) {
                        throw new Error(`"${code}" testi topilmadi`);
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Test yuklashda xato:', error);
                    utils.showMessage(error.message || "Test yuklashda xato", 'error');
                    dom.showScreen('codeInput');
                    return false;
                }
            },
            
            async populateClasses() {
                try {
                    appState.classes = await firebaseManager.loadClasses();
                    
                    dom.elements.classSelect.innerHTML = '<option value="">Sinfni tanlang</option>';
                    if (appState.classes.length > 0) {
                        appState.classes.forEach(cls => {
                            const option = document.createElement('option');
                            option.value = cls.id || cls.name;
                            option.textContent = cls.name || cls.id;
                            dom.elements.classSelect.appendChild(option);
                        });
                    }
                } catch (error) {
                    console.error('Sinf ma\'lumotlarini yuklashda xato:', error);
                }
            },
            
            async populateStudents(className) {
                try {
                    appState.students = await firebaseManager.loadStudents(className);
                    
                    dom.elements.studentSelect.innerHTML = '<option value="">O\'quvchini tanlang</option>';
                    if (appState.students.length > 0) {
                        appState.students.forEach(student => {
                            const option = document.createElement('option');
                            option.value = student.id;
                            option.textContent = student.fullName;
                            dom.elements.studentSelect.appendChild(option);
                        });
                    }
                } catch (error) {
                    console.error('O\'quvchilarni yuklashda xato:', error);
                }
            },
            
            async handleNextToIntro() {
                const studentId = dom.elements.studentSelect.value;
                if (!studentId) {
                    utils.showMessage('O\'quvchini tanlang', 'error');
                    return;
                }
                
                appState.currentStudent = appState.students.find(s => s.id == studentId);
                if (!appState.currentStudent) {
                    utils.showMessage('O\'quvchi topilmadi', 'error');
                    return;
                }

                await this.openIntroForCurrentStudent();
            }
        };

// ==================== DOM MANAGER ====================
        const dom = {
            elements: {},
            
            init() {
                const elementIds = [
                    'loadingScreen', 'codeInputCard', 'classSelectionCard', 'studentSelectionCard',
                    'introCard', 'questionCard', 'resultsCard', 'fullscreenWarning',
                    'alreadyAttemptedWarning', 'attemptDate', 'previousResult', 'previousScore',
                    'previousTime', 'viewPreviousAttemptBtn', 'testHeader', 'headerStudentName',
                    'headerStudentClass', 'currentSectionName', 'currentQuestionPoints',
                    'violationCount', 'headerTimer', 'securityMonitor', 'monitorText',
                    'violationHistoryPanel', 'violationHistoryList', 'testCodeInput',
                    'loadTestBtn', 'classSelect', 'backToCodeBtn', 'nextToStudentBtn',
                    'studentSelect', 'backToClassBtn', 'nextToIntroBtn', 'testTitle',
                    'testDescription', 'totalQuestions', 'testDuration', 'totalPoints',
                    'testSections', 'sectionList', 'studentName', 'startTestBtn',
                    'currentQ', 'timer', 'sectionNameDisplay', 'questionImageContainer',
                    'questionImage', 'imageNotFound', 'questionText', 'optionsContainer',
                    'openAnswerContainer', 'viewWarning', 'verticalNavDots',
                    'prevBtn', 'nextBtn', 'finishBtn', 'finalScore', 'resultsTitle',
                    'correctCount', 'wrongCount', 'totalScoreResult', 'timeUsed',
                    'restartBtn', 'homeBtn', 'topBanner', 'bottomBanner',
                    'mathModal', 'mathEditorFrame', 'openMathEditorBtn', 'clearAnswerBtn',
                    'answerPreview', 'answerPreviewContent', 'viewIndicator', 'viewIcon',
                    'warningContent'
                ];
                
                elementIds.forEach(id => {
                    this.elements[id] = document.getElementById(id);
                });
                
                appState.mathEditorFrame = this.elements.mathEditorFrame;
            },
            
            showScreen(screenName) {
                const screens = [
                    'loadingScreen', 'codeInputCard', 'classSelectionCard', 
                    'studentSelectionCard', 'introCard', 'questionCard', 'resultsCard'
                ];
                
                screens.forEach(screen => {
                    if (this.elements[screen]) {
                        this.elements[screen].classList.add('hidden');
                    }
                });
                
                const screenMap = {
                    'loading': 'loadingScreen',
                    'codeInput': 'codeInputCard',
                    'classSelection': 'classSelectionCard',
                    'studentSelection': 'studentSelectionCard',
                    'intro': 'introCard',
                    'question': 'questionCard',
                    'results': 'resultsCard'
                };
                
                const element = this.elements[screenMap[screenName]];
                if (element) element.classList.remove('hidden');
            }
        };

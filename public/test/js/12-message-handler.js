// ==================== MESSAGE HANDLER ====================
        const messageHandler = {
            init() {
                window.addEventListener('message', this.handleMessage.bind(this));
            },
            
            handleMessage(event) {
                if (event.origin !== window.location.origin && 
                    !event.origin.includes('localhost') && 
                    !event.origin.includes('127.0.0.1')) {
                    return;
                }
                
                const data = event.data;
                
                if (data.type === 'mathFormulaInserted') {
                    const latex = data.latex;
                    const originalIndex = (appState.shuffledToOriginalMap[appState.currentQuestionIndex] !== undefined)
                        ? appState.shuffledToOriginalMap[appState.currentQuestionIndex]
                        : appState.currentQuestionIndex;
                    const previousAnswer = appState.userAnswers[originalIndex];
                    
                    appState.userAnswers[originalIndex] = latex;
                    appState.currentLatex = latex;
                    
                    modalManager.updateAnswerPreview(latex);
                    modalManager.updateAnswerButtons(!!latex);
                    
                    if (previousAnswer !== latex) {
                        userActionLogger.log('open_answer_edited', {
                            questionIndex: originalIndex,
                            latexLength: latex.length,
                            hasAnswer: !!latex
                        });
                    }
                    
                    testManager.updateVerticalNavDots();
                }
            }
        };

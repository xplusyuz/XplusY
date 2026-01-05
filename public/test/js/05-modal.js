// ==================== MODAL MANAGER ====================
        const modalManager = {
            openMathModal() {
                if (appState.isModalOpen) return;
                
                appState.isModalOpen = true;
                const modal = dom.elements.mathModal;
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                
                const originalIndex = (appState.shuffledToOriginalMap[appState.currentQuestionIndex] !== undefined)
                    ? appState.shuffledToOriginalMap[appState.currentQuestionIndex]
                    : appState.currentQuestionIndex;
                const currentAnswer = appState.userAnswers[originalIndex];
                
                const frame = appState.mathEditorFrame;
                const onLoad = () => {
                    if (currentAnswer && currentAnswer.trim() !== '') {
                        frame.contentWindow.postMessage({
                            type: 'loadFormula',
                            latex: currentAnswer
                        }, '*');
                    }
                    frame.removeEventListener('load', onLoad);
                };
                
                frame.addEventListener('load', onLoad);
                
                if (frame.contentWindow) {
                    if (currentAnswer && currentAnswer.trim() !== '') {
                        setTimeout(() => {
                            frame.contentWindow.postMessage({
                                type: 'loadFormula',
                                latex: currentAnswer
                            }, '*');
                        }, 500);
                    }
                }
                
                userActionLogger.log('math_modal_opened', {
                    questionIndex: originalIndex
                });
            },
            
            closeMathModal() {
                appState.isModalOpen = false;
                const modal = dom.elements.mathModal;
                modal.classList.remove('active');
                document.body.style.overflow = '';
                
                userActionLogger.log('math_modal_closed');
            },
            
            saveMathAnswer() {
                const frame = appState.mathEditorFrame;
                if (!frame || !frame.contentWindow) {
                    utils.showMessage("Matematik editor bilan aloqa yo'q", 'error');
                    return;
                }
                
                frame.contentWindow.postMessage({
                    type: 'getFormula'
                }, '*');
                
                const messageHandler = (event) => {
                    if (event.origin !== window.location.origin && 
                        !event.origin.includes('localhost') && 
                        !event.origin.includes('127.0.0.1')) {
                        return;
                    }
                    
                    if (event.data.type === 'mathFormulaResponse') {
                        const latex = event.data.latex;
                        const originalIndex = (appState.shuffledToOriginalMap[appState.currentQuestionIndex] !== undefined)
                            ? appState.shuffledToOriginalMap[appState.currentQuestionIndex]
                            : appState.currentQuestionIndex;
                        const previousAnswer = appState.userAnswers[originalIndex];
                        
                        appState.userAnswers[originalIndex] = latex;
                        appState.currentLatex = latex;
                        
                        this.updateAnswerPreview(latex);
                        
                        if (previousAnswer !== latex) {
                            userActionLogger.log('open_answer_edited', {
                                questionIndex: originalIndex,
                                latexLength: latex.length,
                                hasAnswer: !!latex
                            });
                        }
                        
                        this.closeMathModal();
                        utils.showMessage("Javob saqlandi!", 'success');
                        testManager.updateVerticalNavDots();
                        this.updateAnswerButtons(!!latex);
                        window.removeEventListener('message', messageHandler);
                    }
                };
                
                window.addEventListener('message', messageHandler);
                
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                }, 3000);
            },
            
            updateAnswerPreview(latex) {
                const preview = dom.elements.answerPreview;
                const content = dom.elements.answerPreviewContent;
                
                if (!latex || latex.trim() === '') {
                    preview.classList.add('empty');
                    preview.classList.remove('empty');
                    content.innerHTML = '';
                } else {
                    preview.classList.remove('empty');
                    const latexHtml = utils.renderLatex(latex);
                    content.innerHTML = latexHtml;
                    
                    if (window.MathJax && MathJax.typesetPromise) {
                        setTimeout(() => {
                            MathJax.typesetPromise([content]);
                        }, 100);
                    }
                }
            },
            
            updateAnswerButtons(hasAnswer) {
                const clearBtn = dom.elements.clearAnswerBtn;
                const openBtn = dom.elements.openMathEditorBtn;
                
                if (hasAnswer) {
                    clearBtn.style.display = 'block';
                    openBtn.textContent = '✏️ Javobni tahrirlash';
                } else {
                    clearBtn.style.display = 'none';
                    openBtn.textContent = '🧮 Matematik javob yozish';
                }
            },
            
            clearAnswer() {
                const originalIndex = (appState.shuffledToOriginalMap[appState.currentQuestionIndex] !== undefined)
                    ? appState.shuffledToOriginalMap[appState.currentQuestionIndex]
                    : appState.currentQuestionIndex;
                const previousAnswer = appState.userAnswers[originalIndex];
                
                if (!previousAnswer || previousAnswer.trim() === '') {
                    return;
                }
                
                if (confirm("Javobni o'chirishni tasdiqlaysizmi?")) {
                    appState.userAnswers[originalIndex] = '';
                    appState.currentLatex = '';
                    
                    this.updateAnswerPreview('');
                    this.updateAnswerButtons(false);
                    
                    userActionLogger.log('answer_cleared', {
                        questionIndex: originalIndex
                    });
                    
                    testManager.updateVerticalNavDots();
                    utils.showMessage("Javob o'chirildi", 'info');
                }
            },
            
            init() {
                if (dom.elements.openMathEditorBtn) {
                    dom.elements.openMathEditorBtn.addEventListener('click', () => {
                        this.openMathModal();
                    });
                }
                
                if (dom.elements.clearAnswerBtn) {
                    dom.elements.clearAnswerBtn.addEventListener('click', () => {
                        this.clearAnswer();
                    });
                }
                
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && appState.isModalOpen) {
                        this.closeMathModal();
                    }
                });
                
                dom.elements.mathModal.addEventListener('click', (e) => {
                    if (e.target === dom.elements.mathModal) {
                        this.closeMathModal();
                    }
                });
            }
        };

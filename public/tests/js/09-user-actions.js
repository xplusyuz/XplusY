// ==================== USER ACTION LOGGER ====================
        const userActionLogger = {
            log(action, details = {}) {
                if (!CONFIG.logUserActions || !appState.testStarted) return;
                
                const actionLog = {
                    timestamp: new Date().toISOString(),
                    action: action,
                    details: details,
                    questionIndex: appState.currentQuestionIndex,
                    timeRemaining: appState.timeRemaining
                };
                
                appState.userActions.push(actionLog);
                
                if (CONFIG.useFirebase && appState.firebaseAvailable && appState.db && appState.currentStudent) {
                    try {
                        const logRef = appState.db.collection('user_actions').doc();
                        logRef.set({
                            studentId: appState.currentStudent.id,
                            studentName: appState.currentStudent.fullName,
                            testCode: appState.currentTestCode,
                            ...actionLog
                        });
                    } catch (error) {
                        console.error('User action log yozishda xato:', error);
                    }
                }
            }
        };

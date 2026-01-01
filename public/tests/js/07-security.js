// ==================== SECURITY MANAGER ====================
        const securityManager = {
            init() {
                dom.elements.securityMonitor.addEventListener('mouseenter', () => {
                    dom.elements.violationHistoryPanel.style.display = 'block';
                });
                
                dom.elements.securityMonitor.addEventListener('mouseleave', () => {
                    setTimeout(() => {
                        if (!dom.elements.violationHistoryPanel.matches(':hover')) {
                            dom.elements.violationHistoryPanel.style.display = 'none';
                        }
                    }, 300);
                });
                
                dom.elements.violationHistoryPanel.addEventListener('mouseleave', () => {
                    dom.elements.violationHistoryPanel.style.display = 'none';
                });
            },
            
            addViolation(type, description) {
                if (type === 'fullScreenExit') return;
                
                const timestamp = new Date().toLocaleTimeString();
                
                appState.violations[type]++;
                
                appState.violationHistory.unshift({
                    time: timestamp,
                    type: type,
                    description: description
                });
                
                if (appState.violationHistory.length > 10) {
                    appState.violationHistory.pop();
                }
                
                this.updateDisplay();
                this.updateHistory();
                userActionLogger.log('violation', { type, description, count: appState.violations[type] });
                this.checkLimits();
            },
            
            updateDisplay() {
                const total = appState.violations.windowSwitch + appState.violations.minorViolations;
                dom.elements.violationCount.textContent = total;
                
                let monitorText = '';
                if (appState.violations.windowSwitch > 0) {
                    monitorText += `🪟 Oyna o'tish: ${appState.violations.windowSwitch}/3 `;
                }
                if (appState.violations.minorViolations > 0) {
                    monitorText += `⚠️ Mayda: ${appState.violations.minorViolations}/20`;
                }
                
                dom.elements.monitorText.textContent = monitorText.trim() || 'Xavfsizlik rejimi faol';
                
                if (!appState.isFullScreen && appState.testStarted) {
                    dom.elements.monitorText.textContent = "⚠️ Full screen tavsiya etiladi! F11 tugmasini bosing";
                }
                
                dom.elements.securityMonitor.style.animation = 'none';
                setTimeout(() => {
                    dom.elements.securityMonitor.style.animation = 'pulseDanger 1.5s infinite';
                }, 10);
            },
            
            updateHistory() {
                dom.elements.violationHistoryList.innerHTML = '';
                
                appState.violationHistory.forEach(violation => {
                    const item = document.createElement('div');
                    item.className = 'violation-item';
                    
                    const typeIcon = {
                        'fullScreenExit': '🚫',
                        'windowSwitch': '🪟',
                        'minorViolations': '⚠️'
                    }[violation.type] || '⚠️';
                    
                    item.innerHTML = `
                        <span>${typeIcon} ${violation.description}</span>
                        <span class="violation-time">${violation.time}</span>
                    `;
                    
                    dom.elements.violationHistoryList.appendChild(item);
                });
            },
            
            checkLimits() {
                if (appState.violations.windowSwitch >= CONFIG.maxWindowSwitchViolations) {
                    testManager.cancelTest("3 marta boshqa oynaga o'tilgani uchun test bekor qilindi");
                    return;
                }
                
                if (appState.violations.minorViolations >= CONFIG.maxMinorViolations) {
                    testManager.cancelTest("20 marta mayda qoidabuzarlik sodir etilgani uchun test bekor qilindi");
                    return;
                }
            },
            
            enable() {
                if (appState.securityEnabled) return;
                
                dom.elements.securityMonitor.classList.remove('hidden');
                dom.elements.monitorText.textContent = "Xavfsizlik rejimi faol - Full screen tavsiya etiladi";
                
                fullscreenManager.setupListeners();
                
                window.addEventListener('blur', this.handleWindowBlur.bind(this));
                window.addEventListener('focus', this.handleWindowFocus.bind(this));
                document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
                document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
                document.addEventListener('keydown', this.handleKeyDown.bind(this));
                document.addEventListener('copy', this.handleCopyPaste.bind(this));
                document.addEventListener('cut', this.handleCopyPaste.bind(this));
                document.addEventListener('paste', this.handleCopyPaste.bind(this));
                
                appState.securityEnabled = true;
                
                setTimeout(() => {
                    fullscreenManager.handleFullScreenChange();
                }, 1000);
            },
            
            disable() {
                dom.elements.securityMonitor.classList.add('hidden');
                dom.elements.violationHistoryPanel.style.display = 'none';
                
                fullscreenManager.removeListeners();
                
                window.removeEventListener('blur', this.handleWindowBlur);
                window.removeEventListener('focus', this.handleWindowFocus);
                document.removeEventListener('visibilitychange', this.handleVisibilityChange);
                document.removeEventListener('contextmenu', this.handleContextMenu);
                document.removeEventListener('keydown', this.handleKeyDown);
                document.removeEventListener('copy', this.handleCopyPaste);
                document.removeEventListener('cut', this.handleCopyPaste);
                document.removeEventListener('paste', this.handleCopyPaste);
                
                if (appState.isFullScreen) {
                    fullscreenManager.exit();
                }
                
                appState.securityEnabled = false;
                appState.isFullScreen = false;
            },
            
            // Event handlers
            handleWindowBlur() {
                if (!appState.testStarted || appState.isSleepMode) return;
                
                appState.lastBlurTime = Date.now();
                
                setTimeout(() => {
                    if (appState.testStarted && !document.hasFocus() && !appState.isSleepMode) {
                        this.addViolation('windowSwitch', "Boshqa oynaga o'tildi");
                        userActionLogger.log('window_switched');
                    }
                }, 1000);
            },
            
            handleWindowFocus() {
                if (!appState.testStarted) return;
                
                const timeSinceBlur = Date.now() - appState.lastBlurTime;
                if (timeSinceBlur > 2000) {
                    appState.isSleepMode = true;
                    setTimeout(() => {
                        appState.isSleepMode = false;
                    }, 3000);
                }
            },
            
            handleVisibilityChange() {
                if (appState.testStarted && document.hidden) {
                    this.addViolation('windowSwitch', "Boshqa tabga o'tildi");
                    userActionLogger.log('tab_switched');
                }
            },
            
            handleContextMenu(e) {
                if (appState.testStarted) {
                    e.preventDefault();
                    this.addViolation('minorViolations', "O'ng tugma bosildi");
                    userActionLogger.log('context_menu_opened');
                }
            },
            
            handleKeyDown(e) {
                if (!appState.testStarted) return;
                
                if (e.key === 'F12' || 
                    (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
                    (e.ctrlKey && e.key === 'u') ||
                    (e.key === 'Escape' && document.fullscreenElement)) {
                    
                    e.preventDefault();
                    this.addViolation('minorViolations', `Ruxsat etilmagan tugma: ${e.key}`);
                    userActionLogger.log('restricted_key_pressed', { key: e.key });
                }
            },
            
            handleCopyPaste(e) {
                if (appState.testStarted) {
                    e.preventDefault();
                    this.addViolation('minorViolations', "Copy/paste bloklandi");
                    userActionLogger.log('copy_paste_attempted', { type: e.type });
                }
            }
        };

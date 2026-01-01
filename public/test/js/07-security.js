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

            // Oyna/tab almashtirishni ishonchli sanash (blur + visibilitychange double-triggerlarini oldini olamiz)
            _isAway: false,
            _lastLeaveAt: 0,
            _countWindowSwitch(description) {
                if (!appState.testStarted || appState.isSleepMode) return;
                const now = Date.now();
                if (this._isAway) return;
                if (now - this._lastLeaveAt < 200) return;
                this._isAway = true;
                this._lastLeaveAt = now;
                this.addViolation('windowSwitch', description);
            },
            _markBackIfReady() {
                if (!document.hidden && document.hasFocus()) {
                    this._isAway = false;
                }
            },
            
            addViolation(type, description) {
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
                
                // Bind'larni saqlab qo'yamiz — disable() da to'g'ri remove bo'lishi uchun
                this._bound = this._bound || {
                    blur: this.handleWindowBlur.bind(this),
                    focus: this.handleWindowFocus.bind(this),
                    vis: this.handleVisibilityChange.bind(this),
                    ctx: this.handleContextMenu.bind(this),
                    key: this.handleKeyDown.bind(this),
                    copy: this.handleCopyPaste.bind(this)
                };

                window.addEventListener('blur', this._bound.blur);
                window.addEventListener('focus', this._bound.focus);
                document.addEventListener('visibilitychange', this._bound.vis);
                document.addEventListener('contextmenu', this._bound.ctx);
                document.addEventListener('keydown', this._bound.key);
                document.addEventListener('copy', this._bound.copy);
                document.addEventListener('cut', this._bound.copy);
                document.addEventListener('paste', this._bound.copy);
                
                appState.securityEnabled = true;
                
                setTimeout(() => {
                    fullscreenManager.handleFullScreenChange();
                }, 1000);
            },
            
            disable() {
                dom.elements.securityMonitor.classList.add('hidden');
                dom.elements.violationHistoryPanel.style.display = 'none';
                
                fullscreenManager.removeListeners();
                
                if (this._bound) {
                    window.removeEventListener('blur', this._bound.blur);
                    window.removeEventListener('focus', this._bound.focus);
                    document.removeEventListener('visibilitychange', this._bound.vis);
                    document.removeEventListener('contextmenu', this._bound.ctx);
                    document.removeEventListener('keydown', this._bound.key);
                    document.removeEventListener('copy', this._bound.copy);
                    document.removeEventListener('cut', this._bound.copy);
                    document.removeEventListener('paste', this._bound.copy);
                }
                
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

                // Oldin 1s kutib, focus qaytsa sanamas edi. Endi blur bo'lishi bilan sanaymiz.
                this._countWindowSwitch("Boshqa oynaga o'tildi");
                userActionLogger.log('window_switched');
            },
            
            handleWindowFocus() {
                if (!appState.testStarted) return;
                this._markBackIfReady();
                
                const timeSinceBlur = Date.now() - appState.lastBlurTime;
                if (timeSinceBlur > 2000) {
                    appState.isSleepMode = true;
                    setTimeout(() => {
                        appState.isSleepMode = false;
                    }, 3000);
                }
            },
            
            handleVisibilityChange() {
                if (!appState.testStarted) return;
                if (document.hidden) {
                    this._countWindowSwitch("Boshqa tabga o'tildi");
                    userActionLogger.log('tab_switched');
                } else {
                    this._markBackIfReady();
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

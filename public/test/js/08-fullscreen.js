// ==================== FULLSCREEN MANAGER ====================
        const fullscreenManager = {
            async enable() {
                try {
                    if (!document.fullscreenEnabled && 
                        !document.webkitFullscreenEnabled && 
                        !document.mozFullScreenEnabled && 
                        !document.msFullscreenEnabled) {
                        return true;
                    }
                    
                    const element = document.documentElement;
                    let fullscreenSuccess = false;
                    
                    if (element.requestFullscreen) {
                        await element.requestFullscreen();
                        fullscreenSuccess = true;
                    } else if (element.webkitRequestFullscreen) {
                        await element.webkitRequestFullscreen();
                        fullscreenSuccess = true;
                    } else if (element.mozRequestFullScreen) {
                        await element.mozRequestFullScreen();
                        fullscreenSuccess = true;
                    } else if (element.msRequestFullscreen) {
                        await element.msRequestFullscreen();
                        fullscreenSuccess = true;
                    }
                    
                    if (fullscreenSuccess) {
                        appState.isFullScreen = true;
                        userActionLogger.log('fullscreen_entered');
                        return true;
                    }
                    
                    return true;
                } catch (error) {
                    console.error('Full screen ga o\'tishda xato:', error);
                    utils.showMessage("Full screen rejimini yoqishda xatolik. Test davom etadi.", "warning");
                    return true;
                }
            },
            
            handleFullScreenChange() {
                const isCurrentlyFullScreen = !!(
                    document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement
                );
                
                if (appState.testStarted && !isCurrentlyFullScreen && appState.isFullScreen) {
                    console.log("Full screendan chiqildi, lekin test davom etadi");
                    userActionLogger.log('fullscreen_exited');
                    if (window.securityManager && securityManager._countWindowSwitch) {
                        securityManager._countWindowSwitch("Full screen dan chiqildi");
                    }

                    
                    utils.showMessage("⚠️ Iltimos, testni to'liq ekranda davom ettiring. (F11 tugmasi)", "warning");
                    dom.elements.monitorText.textContent = "⚠️ Full screen tavsiya etiladi! F11 tugmasini bosing";
                    dom.elements.securityMonitor.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
                    
                    this.showWarning();
                    
                    setTimeout(() => {
                        if (appState.testStarted && !appState.isFullScreen) {
                            this.enable();
                        }
                    }, 3000);
                } else if (isCurrentlyFullScreen) {
                    dom.elements.monitorText.textContent = "Xavfsizlik rejimi faol";
                    dom.elements.securityMonitor.style.background = "linear-gradient(135deg, var(--danger) 0%, #ef4444 100%)";
                    this.hideWarning();
                }
                
                appState.isFullScreen = isCurrentlyFullScreen;
            },
            
            setupListeners() {
                this._boundChange = this._boundChange || this.handleFullScreenChange.bind(this);
                document.addEventListener('fullscreenchange', this._boundChange);
                document.addEventListener('webkitfullscreenchange', this._boundChange);
                document.addEventListener('mozfullscreenchange', this._boundChange);
                document.addEventListener('MSFullscreenChange', this._boundChange);

                this._boundKeydown = this._boundKeydown || ((e) => {
                    if (appState.testStarted && e.key === 'F11') {
                        e.preventDefault();
                        setTimeout(() => this.handleFullScreenChange(), 100);
                    }
                });
                document.addEventListener('keydown', this._boundKeydown);
            },

            removeListeners() {
                if (this._boundChange) {
                    document.removeEventListener('fullscreenchange', this._boundChange);
                    document.removeEventListener('webkitfullscreenchange', this._boundChange);
                    document.removeEventListener('mozfullscreenchange', this._boundChange);
                    document.removeEventListener('MSFullscreenChange', this._boundChange);
                }
                if (this._boundKeydown) {
                    document.removeEventListener('keydown', this._boundKeydown);
                }
            },
            
            exit() {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            },
            
            showWarning() {
                if (!appState.testStarted) return;
                dom.elements.fullscreenWarning.classList.remove('hidden');
                setTimeout(() => {
                    if (appState.isFullScreen) {
                        dom.elements.fullscreenWarning.classList.add('hidden');
                    }
                }, 10000);
            },
            
            hideWarning() {
                dom.elements.fullscreenWarning.classList.add('hidden');
            }
        };

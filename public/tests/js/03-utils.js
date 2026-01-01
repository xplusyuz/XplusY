// ==================== UTILITY FUNKSIYALARI ====================
        const utils = {
            debounce(func, wait) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                    };
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                };
            },
            
            throttle(func, limit) {
                let inThrottle;
                return function(...args) {
                    if (!inThrottle) {
                        func.apply(this, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            },
            
            seededRandom(seed) {
                if (typeof seed !== 'number') {
                    seed = parseInt(seed) || 12345;
                }
                let x = Math.sin(seed) * 10000;
                return x - Math.floor(x);
            },
            
            seededShuffle(array, seed) {
                const result = [...array];
                let randomFunc;
                
                if (typeof seed === 'number') {
                    randomFunc = () => utils.seededRandom(seed++);
                } else {
                    randomFunc = Math.random;
                }
                
                for (let i = result.length - 1; i > 0; i--) {
                    const j = Math.floor(randomFunc() * (i + 1));
                    [result[i], result[j]] = [result[j], result[i]];
                }
                
                return result;
            },
            
            generateSeed(studentId, testCode) {
                if (!studentId) studentId = 'anonymous';
                if (!testCode) testCode = 'test';
                
                let hash = 0;
                const str = `${studentId}_${testCode}`;
                
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                
                return Math.abs(hash);
            },
            
            async loadJSON(file) {
                try {
                    const response = await fetch(file);
                    if (!response.ok) return null;
                    return await response.json();
                } catch (error) {
                    console.error(`JSON yuklashda xato (${file}):`, error);
                    return null;
                }
            },
            
            showMessage(message, type = 'info') {
                const alertDiv = document.createElement('div');
                alertDiv.style.cssText = `
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#28a745'};
                    color: white;
                    padding: 10px 20px;
                    border-radius: 6px;
                    z-index: 10001;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    font-weight: 500;
                    min-width: 250px;
                    max-width: 90%;
                    text-align: center;
                `;
                alertDiv.textContent = message;
                document.body.appendChild(alertDiv);
                
                setTimeout(() => {
                    if (alertDiv.parentNode) {
                        document.body.removeChild(alertDiv);
                    }
                }, 3000);
            },
            
            // LaTeX ni MathJax formatiga o'tkazish
            renderLatex(latex) {
                if (!latex || latex.trim() === '') return '';
                return `\\(${latex}\\)`;
            },
            
            normalizeMathExpression(expr) {
                if (!expr) return '';
                
                return expr
                    .toLowerCase()
                    .replace(/\s+/g, '')
                    .replace(/\\/g, '')
                    .replace(/\$/g, '')
                    .replace(/\{/g, '(')
                    .replace(/\}/g, ')')
                    .replace(/\[/g, '(')
                    .replace(/\]/g, ')')
                    .replace(/cdot/g, '*')
                    .replace(/times/g, '*')
                    .replace(/div/g, '/')
                    .replace(/frac{([^}]+)}{([^}]+)}/g, '($1)/($2)')
                    .replace(/\^/g, '**')
                    .replace(/sqrt{([^}]+)}/g, 'sqrt($1)')
                    .trim();
            },
            
            compareMathExpressions(expr1, expr2) {
                if (!expr1 || !expr2) return false;
                
                const normalized1 = this.normalizeMathExpression(expr1);
                const normalized2 = this.normalizeMathExpression(expr2);
                
                if (normalized1 === normalized2) {
                    return true;
                }
                
                const extractNumbers = (str) => {
                    return (str.match(/[-+]?\d*\.?\d+/g) || []).map(Number);
                };
                
                const nums1 = extractNumbers(normalized1);
                const nums2 = extractNumbers(normalized2);
                
                if (nums1.length === nums2.length && nums1.length > 0) {
                    const allMatch = nums1.every((num, idx) => {
                        if (idx < nums2.length) {
                            return Math.abs(num - nums2[idx]) < 0.001;
                        }
                        return false;
                    });
                    
                    if (allMatch) {
                        return true;
                    }
                }
                
                const simpleExprs = [expr1, expr2].map(expr => {
                    return expr
                        .replace(/\s+/g, '')
                        .replace(/\(/g, '')
                        .replace(/\)/g, '')
                        .replace(/=/g, '')
                        .toLowerCase();
                });
                
                if (simpleExprs[0] === simpleExprs[1]) {
                    return true;
                }
                
                return false;
            }
        };

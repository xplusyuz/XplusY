[file name]: seasons.js
[file content begin]
// Fasllar bo'yicha animatsiya tizimi
export class SeasonalAnimations {
    constructor() {
        this.currentSeason = this.getCurrentSeason();
        this.theme = this.getSeasonTheme();
        this.init();
    }

    // Joriy faslni aniqlash
    getCurrentSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return 'spring';
        if (month >= 6 && month <= 8) return 'summer';
        if (month >= 9 && month <= 11) return 'autumn';
        return 'winter';
    }

    // Fasllar uchun mavzular
    getSeasonTheme() {
        const themes = {
            spring: {
                name: "🌸 Bahor",
                bg1: "#ffebf3",  // Och pushti
                bg2: "#e8fff0",  // Yashil
                primary: "#FF6B8B", // Bahor pushtisi
                accent: "#4CAF50",   // Yangi yashil
                particles: ["🌸", "🌱", "🌼", "🦋"],
                gradient: "linear-gradient(135deg, #ffebf3 0%, #e8fff0 100%)"
            },
            summer: {
                name: "☀️ Yoz",
                bg1: "#e3f2fd",  // Havo rang
                bg2: "#fff3e0",  // Quyoshli sariq
                primary: "#2196F3", // Havo ko'k
                accent: "#FF9800",  // Quyosh sariq
                particles: ["☀️", "🌊", "🏖️", "🍉"],
                gradient: "linear-gradient(135deg, #e3f2fd 0%, #fff3e0 100%)"
            },
            autumn: {
                name: "🍂 Kuz",
                bg1: "#fff3e0",  // Oltin sariq
                bg2: "#ffebee",  // Qizil
                primary: "#FF9800", // Oltin jigarrang
                accent: "#D32F2F",   // Qizil
                particles: ["🍂", "🍁", "🌰", "🍎"],
                gradient: "linear-gradient(135deg, #fff3e0 0%, #ffebee 100%)"
            },
            winter: {
                name: "❄️ Qish",
                bg1: "#e3f2fd",  // Muz ko'k
                bg2: "#f3e5f5",  // Buz rang
                primary: "#03A9F4", // Qor ko'k
                accent: "#9C27B0",   // Binafsha
                particles: ["❄️", "⛄", "🎄", "🧤"],
                gradient: "linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)"
            }
        };
        return themes[this.currentSeason];
    }

    // Asosiy CSS o'zgaruvchilarini yangilash
    applySeasonalCSS() {
        const root = document.documentElement;
        root.style.setProperty('--season-bg1', this.theme.bg1);
        root.style.setProperty('--season-bg2', this.theme.bg2);
        root.style.setProperty('--season-primary', this.theme.primary);
        root.style.setProperty('--season-accent', this.theme.accent);
        
        // Yangi gradient fon
        document.body.style.background = `
            radial-gradient(1200px 600px at 20% 0%, ${this.theme.bg1}, transparent 60%),
            radial-gradient(1200px 700px at 90% 10%, ${this.theme.bg2}, transparent 60%),
            ${this.theme.gradient}
        `;
    }

    // Particle animatsiyasi
    createParticles() {
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'season-particles';
        particlesContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
            overflow: hidden;
        `;
        
        document.body.appendChild(particlesContainer);
        
        // Particle'larni yaratish
        for (let i = 0; i < 25; i++) {
            setTimeout(() => this.createParticle(particlesContainer), i * 100);
        }
    }

    createParticle(container) {
        const particle = document.createElement('div');
        const emoji = this.theme.particles[Math.floor(Math.random() * this.theme.particles.length)];
        
        particle.textContent = emoji;
        particle.style.cssText = `
            position: absolute;
            font-size: ${24 + Math.random() * 20}px;
            opacity: ${0.3 + Math.random() * 0.4};
            animation: floatParticle ${15 + Math.random() * 20}s linear infinite;
            animation-delay: ${Math.random() * 5}s;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
            z-index: 1;
        `;
        
        // Boshlang'ich pozitsiya
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${-50}px`;
        
        container.appendChild(particle);
        
        // Animation tugagandan so'ng o'chirish
        particle.addEventListener('animationiteration', () => {
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${-50}px`;
        });
    }

    // Button va card'larga seasonal effektlar
    enhanceUIElements() {
        // Primary button'larni yangilash
        document.querySelectorAll('.btn.primary').forEach(btn => {
            btn.style.background = `linear-gradient(135deg, ${this.theme.primary}, ${this.theme.accent})`;
            btn.style.boxShadow = `0 10px 24px ${this.theme.primary}40`;
            btn.style.border = `1px solid ${this.theme.primary}80`;
            
            // Hover effekti
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px) scale(1.02)';
                btn.style.boxShadow = `0 15px 30px ${this.theme.primary}60`;
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
                btn.style.boxShadow = `0 10px 24px ${this.theme.primary}40`;
            });
        });

        // Glass card'larni yangilash
        document.querySelectorAll('.glass').forEach(card => {
            const originalBackground = window.getComputedStyle(card).background;
            card.style.background = `
                linear-gradient(135deg, 
                    rgba(255,255,255,0.85) 0%, 
                    rgba(255,255,255,0.75) 100%
                ),
                ${this.theme.primary}05
            `;
            card.style.border = `1px solid ${this.theme.primary}20`;
            
            // Hover effekti
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-4px) scale(1.01)';
                card.style.boxShadow = `0 25px 50px ${this.theme.primary}15`;
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.boxShadow = 'var(--shadow)';
            });
        });

        // Header uchun seasonal effekt
        const header = document.querySelector('.header');
        if (header) {
            header.style.background = `
                linear-gradient(135deg, 
                    ${this.theme.bg1}40 0%, 
                    ${this.theme.bg2}40 100%
                )
            `;
        }
    }

    // Fasl nomini ko'rsatish
    showSeasonIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'season-indicator';
        indicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">${this.theme.name.split(' ')[0]}</span>
                <span style="font-weight: 800; font-size: 12px; opacity: 0.8;">${this.theme.name.split(' ')[1]}</span>
            </div>
        `;
        
        indicator.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            padding: 8px 16px;
            background: rgba(255,255,255,0.9);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.3);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            z-index: 1000;
            font-family: var(--font);
            font-weight: 900;
            color: var(--text);
            animation: slideInRight 0.5s ease-out;
        `;
        
        document.body.appendChild(indicator);
        
        // 3 soniyadan keyin yo'qolish
        setTimeout(() => {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateY(-20px)';
            setTimeout(() => indicator.remove(), 500);
        }, 3000);
    }

    // Animatsiyalarni ishga tushirish
    init() {
        this.applySeasonalCSS();
        this.createParticles();
        this.enhanceUIElements();
        this.showSeasonIndicator();
        
        // Fasl o'zgarganda yangilash
        setInterval(() => {
            const newSeason = this.getCurrentSeason();
            if (newSeason !== this.currentSeason) {
                this.currentSeason = newSeason;
                this.theme = this.getSeasonTheme();
                this.applySeasonalCSS();
                this.showSeasonIndicator();
                
                // Particle'larni yangilash
                document.querySelector('.season-particles')?.remove();
                this.createParticles();
                
                // UI elementlarini yangilash
                this.enhanceUIElements();
            }
        }, 60000); // Har daqiqa tekshiradi
    }
}

// Floating particle animatsiyasi uchun CSS
const particleStyles = document.createElement('style');
particleStyles.textContent = `
    @keyframes floatParticle {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.8;
        }
        100% {
            transform: translateY(calc(100vh + 100px)) rotate(360deg);
            opacity: 0;
        }
    }
    
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(30px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    /* Seasonal transition animation */
    body {
        transition: background 1.5s ease-in-out;
    }
    
    .glass {
        transition: all 0.3s ease;
    }
    
    .btn.primary {
        transition: all 0.3s ease !important;
    }
`;
document.head.appendChild(particleStyles);
[file content end]
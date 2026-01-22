// ==================== BANNER MANAGER ====================
        const bannerManager = {
            createInfiniteBanners() {
                const bannerContent = [
                    "LeaderMath.uz | Matematika Platformasi",
                    "Namangan shahar 1-IMI | Raqamli Ta'lim Markazi",
                    "|www.LeaderMath.uz"
                ];
                
                let topHTML = '';
                for (let i = 0; i < 30; i++) {
                    bannerContent.forEach(item => {
                        topHTML += `<div class="banner-item">${item}</div>`;
                    });
                }
                dom.elements.topBanner.innerHTML = `<div class="banner-wrapper">${topHTML}</div>`;
                
                const bottomContent = [
                    "LeaderMath - Matematika Olamiga Sayohat",
                    "Telegram: @Help_LeaderMath_bot",
                    "Tel: +998 97 336 69 39"
                ];
                
                let bottomHTML = '';
                for (let i = 0; i < 30; i++) {
                    bottomContent.forEach(item => {
                        bottomHTML += `<div class="bottom-banner-item">${item}</div>`;
                    });
                }
                dom.elements.bottomBanner.innerHTML = `<div class="bottom-banner-wrapper">${bottomHTML}</div>`;
            }
        };

# NO SETTINGS version — har bir bo‘lim mustaqil sahifa

**Settings** butkul olib tashlandi. Endi har bir bo‘lim alohida partial va alohida JS modulga ega:

Routes:
- `#/profile`  → `partials/profile.html`  + `js/profile.js`
- `#/results`  → `partials/results.html`  + `js/results.js`
- `#/topup`    → `partials/topup.html`    + `js/topup.js`
- `#/badges`   → `partials/badges.html`   + `js/badges.js`
- `#/promo`    → `partials/promo.html`    + `js/promo.js`
- `#/admin`    → `partials/admin.html`    + `js/admin.js`

Router:
- `js/router.js` (v5) default-export aware, `router.go('profile')` ishlaydi.

Integratsiya:
1) `partials/*.html`, `js/*.js` va `css/settings.css` fayllarini loyihaga qo‘ying.
2) Eski `settings.html` va `settings/*` papkalari **kerak emas** — o‘chirib yuborishingiz mumkin.
3) FAB tugmachadagi yo‘nalishlarni `profile/results/topup/badges/promo/admin` ga yangilang.
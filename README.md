# LeaderMath Test Starter

Tayyor loyiha: Hosting + Cloud Functions (callable) + Firestore rules.

## O'rnatish

```bash
npm i -g firebase-tools
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
```

### Functions
```bash
cd functions
npm i
npm run build
firebase deploy --only functions:submitTestResult
```

### Firestore rules
```bash
firebase deploy --only firestore:rules
```

### Hosting
`public/` ichida `index.html` va `test.json` bor.

```bash
firebase deploy --only hosting
```

## Muhim sozlamalar
- `public/index.html` ichida Firebase configingiz va reCAPTCHA v3 kalitingizni (`YOUR_RECAPTCHA_V3_KEY`) kiriting.
- `.firebaserc` da project idni to'ldiring.
- `firestore.rules` yozilishiga ko'ra points va results'ga **faqat Functions** yozadi.

## Ishlash mantig'i
- Foydalanuvchi testni yakunlaganda frontend `submitTestResult` callable funksiyasini chaqiradi.
- Funksiya Firestore tranzaksiyada `results/{testId}/users/{uid}` hujjatini birinchi marta yaratadi va `users/{uid}.points` maydonini `total` ga oshiradi.
- Agar foydalanuvchi testni takror topshirsa — `skipped: true` qaytadi va ball qo'shilmaydi.

Yaratildi: 2025-10-25T04:18:29.120411Z


KiberMath.uz — Starter Kit (FULL)
=================================

Fayllar: index/register/profile/namuna + partials + assets (css/js/img) + bannerlar.

Sozlash:
- Firebase Authentication: Email/Password va Google ni yoqing.
- Firestore Database: production rules (quyidagi misol) bilan ishga tushiring.
- `assets/js/firebase-config.js` allaqachon siz bergan config bilan to'ldirilgan.

Minimal Firestore Rules (demo):
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, update: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid;
    }
    match /meta/{document=**} {
      allow read: if false;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}

Eslatma: user ID ketma-ket tayinlash uchun `meta/counters` yozuviga clientdan transaction ishlatilmoqda (demo).
Prod uchun bu qismni server (Cloud Functions)ga ko'chirish tavsiya etiladi.

Yaratilgan sana: 2025-08-29

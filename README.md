# Leader Platform (Netlify Functions + Firestore)

## 1) Netlify ENV (shart)
Netlify → Site settings → Environment variables:

- JWT_SECRET = uzun random string (40+ belgili)
- FIREBASE_SERVICE_ACCOUNT_JSON = Firebase service account JSON (to‘liq string)

Firebase Console → Project settings → Service accounts → Generate new private key.

## 2) Firestore
Collections:
- meta/counters  -> { nextUserId: 1000 }
- users/{id}     -> user hujjatlari

Tavsiya rules (client’dan yopiq):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{doc=**} { allow read, write: if false; }
  }
}
```
API (Admin SDK) baribir ishlaydi.

## 3) Ishga tushirish (lokal)
1) `npm i`
2) local dev uchun xohlasangiz rootga `firebase-admin-key.json` qo‘ying (Netlify’da kerak emas).
3) Netlify CLI bilan run qiling yoki Netlify deploy.

## 4) Endpoints
- POST /.netlify/functions/api/auth/register
- POST /.netlify/functions/api/auth/login
- GET  /.netlify/functions/api/auth/me

## Eslatma
Parol hech qachon qaytarilmaydi. Profil kartadagi "ko‘z" UX uchun. Keyin "parolni almashtirish" qo‘shamiz.


## Netlify build
Bu repo statik HTML. Netlify build fail bo'lmasligi uchun `npm run build` faqat echo qiladi.

# LeaderMath.UZ SPA — ZIP project

## Deploy (Netlify)
1) `npm i`
2) Set Netlify env vars:
- FIREBASE_SERVICE_ACCOUNT_JSON
- SESSION_JWT_SECRET
- FIREBASE_STORAGE_BUCKET (optional; default from service account project)
3) Deploy.

## Firebase
- Enable Google Auth (if you want Google login)
- Create Storage bucket (default)
- Firestore used only by server (rules can be closed).

## Admin
- Admin button appears only for: sohibjonmath@gmail.com
- Admin API endpoints require that email too.

## Region JSON
- region.json is used for Viloyat → Tuman selects.


## v3 Admin login
Netlify env qo‘ying:
- ADMIN_EMAIL (optional, default sohibjonmath@gmail.com)
- ADMIN_PASSWORD (required)
Admin login Firebase Web SDKsiz ishlaydi.


## v7 O‘zgarishlar
- Index: admin login olib tashlandi, admin tugmasi yo‘q.
- Admin: alohida Firebase Auth (Google) bilan kiradi va serverga idToken yuborib sessiya oladi.

### Netlify env
- FIREBASE_SERVICE_ACCOUNT (yoki FIREBASE_SERVICE_ACCOUNT_JSON) — service account JSON string
- SESSION_JWT_SECRET
- ADMIN_EMAIL (default sohibjonmath@gmail.com)

### Admin Firebase config
admin.html ichida firebaseConfig ni to‘ldiring (apiKey/authDomain/projectId).


### Storage bucket
Avatar upload ishlatmoqchi bo‘lsangiz Netlify env:
- FIREBASE_STORAGE_BUCKET (masalan: your-project-id.appspot.com)
Aks holda register/login/menu ishlashi uchun shart emas.


Note: Agar FIREBASE_STORAGE_BUCKET qo‘ymasangiz, server projectId'dan avtomatik <projectId>.appspot.com deb taxmin qiladi. Eng yaxshisi baribir env bilan aniq qo‘ying.

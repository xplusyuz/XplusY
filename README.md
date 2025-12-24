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

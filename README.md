# LeaderMath API-only (Rebuild)

## Netlify ENV
- FIREBASE_KEY = Firebase service account JSON (string)

Optional:
- SESSION_DAYS = 30 (default)

## Firestore Rules (tavsiya)
Hamma narsani yopib qo‘ying — API (Admin SDK) baribir ishlaydi:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

## Run locally
```
npm i
npx netlify dev
```

Open: /login.html

## Collection
users/{loginId}
fields: firstName,lastName,region,district,birthdate,password,points,updatedAt (+ sessionId/sessionExp)


## Premium UI
- assets/anim-bg.js adds neon math particles background.
- login.html + index.html redesigned with glassmorphism + microinteractions.

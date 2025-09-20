# X+Y MathCenter SPA (green/white)

Single-page app with Firebase Auth + Firestore, partials-based router, mobile-first header with ID / Balans / Ball chips.

## Structure
- `index.html` — main SPA
- `partials/home.html`
- `partials/profile.html`

## Setup
1. Host the folder (Netlify, Vercel, Firebase Hosting, etc.).
2. In Firebase Console → Authentication → **Authorized domains**, add your domain (e.g. `xplusy.netlify.app`).
3. Enable Firestore (in production set secure rules).

## Run locally
Just open `index.html` via a static server (not file://). For example:
- VS Code Live Server
- `npx serve`

## Notes
- ID login uses Firestore `users` collection to map `numericId` → email, then signs in with email+password.
- After first login, profile modal is required; saved to Firestore `users/{uid}`.
- Region → District select is dependent and localized.

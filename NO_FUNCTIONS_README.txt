NO-FUNCTIONS BUILD

- Firebase Cloud Functions removed.
- Admin access is enforced via Firestore Rules email allowlist (sohibjonmath@gmail.com). Update firestore.rules to add more admins.
- Telegram login serverless verification disabled in this build; use Google Auth.

Deploy:
1) firebase deploy --only firestore:rules,hosting
2) Netlify deploy public/ if using Netlify.

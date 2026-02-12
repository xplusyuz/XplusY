# OrzuMall 2.0 — Variant C (Vite + React + Firebase + Functions)

This is a clean starter for **Variant C**:
- Vite + React (Netlify-friendly)
- Firebase Auth (Phone), Firestore, Storage
- **OMXXXXXX** user ID via Firestore transaction counter
- Cart (single doc per user), Orders flow, Admin panel (minimal)
- Cloud Functions skeleton: **Payme verify** + **Telegram notify** + triggers
- Firestore rules/indexes template

## Frontend setup
```bash
npm install
cp .env.example .env
# fill Firebase keys
npm run dev
```

## Firestore deploy
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Functions deploy
```bash
cd functions
npm install
# set env vars:
firebase functions:config:set tg.token="YOUR_BOT_TOKEN" tg.admin_chat="YOUR_ADMIN_CHAT_ID"
firebase deploy --only functions
```

## Variant C principle
Frontend never sets `payment.status="paid"`. Only server verifies and updates.

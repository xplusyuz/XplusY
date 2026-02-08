# OrzuMall + Payme (Netlify) Setup

## 1) Netlify Environment variables
Set these in Netlify -> Project configuration -> Environment variables:

- PAYME_KASSA_KEY = (Payme Business'dagi Kassa kaliti / Secret key)
- FIREBASE_SERVICE_ACCOUNT_JSON = Firebase service account JSON (to'liq JSON)

## 2) Frontend merchant ID
Edit: public/payme-config.js
- PAYME_MERCHANT_ID = Payme Merchant ID

## 3) Deploy
Deploy after adding env vars.

Endpoint:
https://<your-site>.netlify.app/.netlify/functions/payme

## 4) Firestore rules
This zip includes firestore.rules. Deploy with Firebase console or CLI:
firebase deploy --only firestore:rules

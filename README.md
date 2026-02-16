# Payme endpoint (Netlify Functions)

## Endpoint URL
After deploy:
`https://<your-site>.netlify.app/.netlify/functions/payme`

## Required environment variables (Netlify UI -> Site settings -> Environment variables)
- PAYME_LOGIN
- PAYME_KEY

## Notes
This is a minimal implementation for activation/sandbox testing.
For real production, persist transactions and verify order/amount in a database (e.g., Firestore).

## Payme (Paycom) — Netlify Functions setup

### 1) Endpoint
`https://<your-site>.netlify.app/.netlify/functions/payme`

### 2) Netlify Environment Variables
Set these in Netlify → Site settings → Build & deploy → Environment:
- `PAYME_LOGIN` = `Paycom`
- `PAYME_KEY`   = (TEST key in test mode, PROD key in prod mode)
- `FIREBASE_SERVICE_ACCOUNT_JSON` = (Firebase Service Account JSON, single-line)

### 3) Firestore order document
Create `/orders/{orderId}` with:
- `totalUZS` (number)
- `status` = `pending`

When Payme performs the transaction, order will be updated to `status: paid`.

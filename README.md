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
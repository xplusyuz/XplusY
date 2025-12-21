# LeaderMath — Dizayn saqlangan + API moslangan

## Netlify settings
- Publish directory: public
- Functions directory: netlify/functions

## ENV
- FIREBASE_SERVICE_ACCOUNT: service account JSON (string)
- APP_JWT_SECRET: uzun secret

## Eslatma
Sizning dizayndagi JS /api/auth/register, /api/auth/login, /api/auth/session/:id,
 /api/user/:sessionId (GET/PATCH), /api/user/:sessionId/avatar, /api/user/:sessionId/password,
 /api/nav, /api/ranking endpointlarni ishlatadi — hammasi API’da bor.

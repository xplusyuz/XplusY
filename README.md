# OrzuMall — Telegram + Google Login + products.json (Netlify + Firebase)

## Nima bor?
- Google Sign-In (popup) + auto-login (browserLocalPersistence)
- Telegram Login Widget (@OrzuMallUZ_bot) → Netlify Function → Firebase Custom Token
- `public/products.json` dan mahsulotlar chiqadi (qidiruv + sort)

## Netlify ENV (sizning screenshot’ga mos)
- `FIREBASE_SERVICE_ACCOUNT_BASE64`  ✅
- `TG_BOT_TOKEN` ✅

### FIREBASE_SERVICE_ACCOUNT_BASE64 qanday tayyorlanadi?
1) Firebase Console → Project settings → Service accounts → Generate new private key
2) JSON faylni base64 qiling (misol):
   - Windows PowerShell:
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))`
   - macOS/Linux:
     `base64 -w 0 serviceAccount.json`
3) chiqqan uzun stringni Netlify env ga qo'ying.

## Firebase Web Config
`public/firebase-config.js` ichidagi quyidagilarni o'zingiznikiga almashtiring:
- apiKey
- authDomain
- projectId
- appId

## Deploy
- Netlify’da repository’ni ulang yoki zipni upload qilib deploy qiling
- Publish folder: `public` (netlify.toml bor)
- Deploydan keyin saytingiz ochiladi

## Eslatma (Telegram)
Telegram widget allaqachon `@OrzuMallUZ_bot` bilan sozlangan.
Agar Telegram login ishlamasa:
- bot token (`TG_BOT_TOKEN`) to’g’ri ekanini tekshiring
- domen/https: Netlify’da URL `https://...netlify.app` bo’lishi kerak

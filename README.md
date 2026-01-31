# OrzuMall — Telegram + Google Login + products.json (Netlify + Firebase) — v2 (fix)

## Netlify ENV (SIZDA BOR)
- FIREBASE_SERVICE_ACCOUNT_BASE64
- TG_BOT_TOKEN

### FIREBASE_SERVICE_ACCOUNT_BASE64 ni to'g'ri qilish
Bu qiymat 2 xil ko'rinishda bo'lishi mumkin — v2 funksiya ikkalasini ham qabul qiladi:

1) **Base64** (tavsiya):
- Windows PowerShell:
  `[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))`
- macOS/Linux:
  `base64 -w 0 serviceAccount.json`

2) **JSON string** (agar base64 qilmasdan qo'yib yuborgan bo'lsangiz):
- Netlify env ga to'liq JSON ni qo'ysangiz ham bo'ladi (v2 avtomatik aniqlaydi).

⚠️ Private key ichida `\n` bo'lsa — bu normal.

## Firebase Web Config
`public/firebase-config.js` ichidagi apiKey/authDomain/projectId/appId ni o'zingiznikiga almashtiring.

## Debug
Agar Telegram login xatolik bersa:
- Browser console → Network → /.netlify/functions/telegramAuth → response’da `details` chiqadi.
- Netlify → Functions logs’da ham ko'rinadi.

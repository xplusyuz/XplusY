DEPLOY (FINAL):
1) Push this repo to GitHub (or upload as Netlify manual deploy).
2) Netlify → Environment variables:
   - PAYME_KEY = <your Payme key (test/prod)>
   - FIREBASE_SERVICE_ACCOUNT_B64 = <base64 of serviceAccount.json (ONE line)>
3) Netlify → Deploys → Clear cache and deploy site.
4) Payme endpoint:
   https://YOUR-SITE/.netlify/functions/payme

Note:
- This project uses Netlify Functions bundler 'zisi' to avoid protobufjs missing module errors.

============================
RECEIPT -> TELEGRAM (NO STORAGE)
============================
Bu build'da to'lov cheki (screenshot/PDF) ni Firebase Storage'ga yuklamasdan, to'g'ridan-to'g'ri Telegram botga yuborish uchun Netlify Function qo'shildi:

  /.netlify/functions/receipt

Server ENV:
  TELEGRAM_BOT_TOKEN=...
  TELEGRAM_ADMIN_CHAT_ID=...

Xavfsizlik (tanlang):
A) Tavsiya (Firebase ID token bilan):
  FIREBASE_SERVICE_ACCOUNT_B64=...  (service account JSON base64)
  Frontend: Authorization: Bearer <Firebase ID token>

B) Soddaroq (secret bilan):
  RECEIPT_UPLOAD_SECRET=some-strong-secret
  Frontend: header x-upload-secret: some-strong-secret

POST JSON body:
  {
    "orderType": "topup",
    "amountUZS": 100000,
    "card": "8600 1234 5678 9012",
    "fullName": "Sohibjon Sattorov",
    "note": "ixtiyoriy izoh",
    "fileName": "chek.jpg",
    "mimeType": "image/jpeg",
    "fileB64": "<BASE64>"
  }

Eslatma: Base64 file hajmi kattalashadi, chek faylini 2-5MB dan kichik saqlang.

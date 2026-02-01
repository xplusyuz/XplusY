# OrzuMall — v4

Sizning screenshot’da ko‘rinayotgan xatolar:

## 1) Google login ishlamayapti (API key not valid)
Bu Firebase Web config noto‘g‘ri degani.
`public/firebase-config.js` ichidagi:
- apiKey
- authDomain
- projectId
- appId

ni Firebase Console → Project settings → Your apps → Web app config’dan ko‘chirib qo‘ying.

## 2) Telegram login 500 (Function error)
Bu service account env parse bo‘lmayapti degani.
v4 quyidagilarni qabul qiladi:
- FIREBASE_SERVICE_ACCOUNT_BASE64 (base64 string)
- yoki FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string)

Netlify env:
- TG_BOT_TOKEN
- FIREBASE_SERVICE_ACCOUNT_BASE64  (yoki FIREBASE_SERVICE_ACCOUNT_JSON)

Telegram bosganda NOTICE’da `DETAILS` va `ENV` chiqadi.


## v5
- Login (Kirish) bloki: user kirgandan keyin avtomatik yashirinadi (authCard.hidden=true).


## v6
- Kirgandan keyin 'Kirish' bo'limi 2 yo'l bilan yashiriladi: body.signed-in CSS + authCard.style.display.


## v7
- TelegramAuth: updateUser/createUser endi faqat mavjud property'larni yuboradi (undefined yubormaydi). Error bo'lsa `stage` qaytaradi.

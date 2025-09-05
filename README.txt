# MathCenter.uz — Test moduli qo‘shildi
- `public/tests/test.html|css|js` — DTM uslubidagi test: taymer (20 daq), savol grid, +3 / −0.75 scoring
- Natija oynasi: to‘g‘ri/noto‘g‘ri/bo‘sh, foiz, ball, vaqt, jami savollar, testID
- Firestore: `attempts` kolleksiyasiga yozadi
- Telegram: `test.js` ichida `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` to‘ldirsangiz, natija jo‘natadi
- Rasmlar: agar `public/img/1.jpg` (yoki .png) bo‘lsa, 1-savolga avtomatik chiqadi; shu tartibda 2.jpg ...

## Deploy
1) `firebase deploy --only functions`
2) `firebase deploy --only firestore:rules`
3) Hostingga `public/` ni joylang (Firebase Hosting yoki Netlify).


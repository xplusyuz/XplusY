# Mini loyiha: 1688 link → Import → Saytingda ko‘rsatish (Firebase)

Bu demo loyiha 1688 mahsulot linkini admin panel orqali kiritib, backend (Firebase Functions) orqali sahifadan minimal ma’lumotlarni (nom, rasm(lar), narx) ajratib, Firestore'ga saqlaydi va storefront sahifada ko‘rsatadi.

> Eslatma: 1688 anti-bot himoyasi kuchli. Demo parser "best-effort" — ayrim linklarda CAPTCHA yoki blok sabab ishlamasligi mumkin.
> Ishonchli production uchun: proxy + cookie/session yoki sourcing-agent API tavsiya qilinadi.

---

## 1) Talablar
- Node.js 18+
- Firebase CLI (`npm i -g firebase-tools`)
- Firebase loyihangiz (Firestore + Functions + Hosting yoqilgan)

---

## 2) O‘rnatish
1. Firebase'ga login:
   ```bash
   firebase login
   ```
2. Loyihani init/deploy:
   ```bash
   cd .
   firebase init
   # Hosting + Functions + Firestore ni tanlang
   ```
   - Functions: **JavaScript**
   - Node runtime: **18**
3. `public/firebase-config.js` ichidagi config'ni o‘zingiznikiga almashtiring (Firebase Console → Project settings → Web app).

---

## 3) Deploy
```bash
npm --prefix functions install
firebase deploy
```

Deploydan keyin:
- Storefront: `https://<project-id>.web.app/`
- Admin: `https://<project-id>.web.app/admin.html`

---

## 4) Adminlar
Admin email ro‘yxatini `functions/index.js` ichidan topasiz:
```js
const ADMIN_EMAILS = ["sohibjonmath@gmail.com"];
```
o‘zingizniki bilan to‘ldiring, qayta deploy qiling.

---

## 5) Qanday ishlaydi?
- Admin Google orqali kiradi
- 1688 (yoki boshqa) product URL qo‘yadi → **Import**
- Cloud Function sahifani olib kelib, HTML ichidan:
  - title/meta
  - og:image
  - script ichidagi JSON bo‘laklar (heuristic)
  ni ajratadi va `products` kolleksiyasiga saqlaydi.
- Storefront `products` kolleksiyasini real-time o‘qiydi.

---

## 6) Firestore struktura (products)
```json
{
  "source": "1688",
  "sourceUrl": "https://detail.1688.com/....",
  "title": "Product title",
  "priceText": "¥12.50",
  "images": ["https://..."],
  "createdAt": "serverTimestamp",
  "status": "active"
}
```

---

## 7) Keyingi bosqich (kuchaytirish)
- Markup (USTAMA) + UZS narx kalkulyatori
- Variantlar (rang/razmer) ajratish
- Proxy + cookie session qo‘llash (CAPTCHA bypass emas — qonuniy yo‘l bilan)
- Buyurtma (order) + delivery hisoblash

# MathCenter.uz — v3 (Live + Test Player)

## Yangi funksiyalar
- **Test Player:**
  - Variant tanlanganda **yechim avtomatik** ochiladi (tugma bilan yopib/ochish ham mumkin).
  - **Seeded randomizatsiya** (savol/variantlar): sessiya davomida tartib saqlanadi.
  - Yakunda **“shu tartib”** va **“yangi tartib”** bilan qayta yechish.
  - Minimal **anti-cheat**: tabdan chiqsa ogohlantiradi.
  - Agar URL `?event=<id>` bo‘lsa, natija **live scores** ga yoziladi (score = foiz).

- **Live:**
  - Kartalarda **real-time ishtirokchilar** va **countdown**.
  - Modal ichida **real-time leaderboard**.
  - Live sahifaning yuqorisida **global leaderboard** (dropdown orqali event tanlash).

## CSV formatlari
- `content/home.csv`: `title, tag, meta, image, link`
- `content/courses.csv`: `name, tag, meta, link`
- `content/tests.csv`: `name, tag, meta, price, productId, link, durationSec`
- `content/sim.csv`: `name, tag, meta, link`
- `content/live.csv`: `title, tag, meta, entryPrice, prize, startAt, endAt, startLink, modalText`
- Savollar: `content/tests_data/<productId>.csv` — `id, text, a, b, c, d, ans, ex`

## Ishga tushirish
1) Firebase Authentication: Google + Email/Password — **Enable**; Authorized domainsga deploy domeningizni qo‘shing.
2) Firestore: `firestore.rules`'ni **Publish** qiling.
3) Statik server orqali HTTP(S)da ishga tushiring. `file://`da auth ishlamaydi.

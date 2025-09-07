# MathCenter.uz — v3 Cards PLUS

To'liq tayyor build:
- Google + Email autentifikatsiya (popup→redirect), redirect auto-complete, localPersistence
- Profil modal (birinchi kirishda majburiy)
- Mobil UI, pastki menyu
- **Universal Cards** (.ucard) — premium gradient/glass + inline SVG, barcha sahifalarga mos
- Home: Reklama kartalari (rasm bilan)
- Courses/Tests/Sim: universal kartalar + mos CTA'lar
- Live: universal karta + **tafsilot modal** (countdown, participants, pre-join, startda lock, kirish)
- Admin CRUD (content va live), Hamyon & xaridlar
- Firestore rules — admin CRUD va Live join lock

## Sozlash
1) Firebase → Authentication → Sign-in method: Google va Email/Password → **Enable**.
   Authentication → Settings → **Authorized domains**ga deploy domeningizni qo'shing.
2) Firestore → **Rules**: shu repodagi `firestore.rules` ni **Publish** qiling.
3) Lokal server (`npx serve` yoki `python -m http.server`) yoki Netlify/Vercel. `file://` ishlamaydi.

## Admin
- `users/{uid}` da `isAdmin: true` qo'ying — Settings → Admin panel orqali CRUD ishlaydi.

## Live
- Admin paneldan `live_events` hujjatiga `startAt/endAt` (Timestamp) qo'ying. UI va Rules join lockni nazorat qiladi.

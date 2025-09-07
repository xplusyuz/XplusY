# MathCenter.uz — Full v3 (Robust Auth + Full App)

**Noldan moslangan** build:
- Popup→Redirect Google kirish, redirect natijasini sahifa yuklanganda yakunlaydi.
- Email/Parol login & sign up, tugma holatlari va xatolar ko‘rinadi.
- Profil modali (birinchi kirishda majburiy). Keyin faqat **telefon** va **manzil** UI orqali tahrir.
- Uy: barcha foydalanuvchilar **💎 kamayish** tartibida **ro‘yxat** (rank) ko‘rinishida.
- Live: **Oldindan qo‘shilish** (entry yechimi), **startda lock**, kirganlar uchun **Kirish**.
- Admin CRUD: `content_*` va `live_events` uchun eng sodda qo‘shish/tahrirlash/o‘chirish.
- Hamyon: demo top-up; pullik test—xarid → `purchases`.
- Firestore **rules** moslangan (admin CRUD, live join lock, users read).
- CSV fallback (Firestore bo‘sh bo‘lsa, `content/*.csv`dan o‘qiydi).

## Tez start
1) Firebase → Authentication → **Sign-in method**: Google va Email/Password → **Enable**.  
   Settings → **Authorized domains**: hosting domeningizni qo‘shing.  
2) Firestore → **Rules**: shu loyihadagi `firestore.rules` → **Publish**.  
3) Static hosting (Netlify/Vercel) yoki lokal server (`npx serve`). `file://` orqali ochmang.  
4) Admin bo‘lish uchun `users/{uid}` hujjatingizda `isAdmin: true` qo‘yib, CRUD’ni sinang.

## Eslatma
- Live join lock qayta ishlashi uchun admin panelda `startAt/endAt` **Timestamp** sifatida saqlanadi (panel buni avtomatik qiladi).
- Agar login muammosi bo‘lsa, auth xato kodi **qizil blok**da chiqadi — shu kodni yuborsangiz, qo‘shimcha tuzatish kiritaman.

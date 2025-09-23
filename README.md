
# XplusY — Firebase (Firestore + Storage) real loyiha

## Ishga tushirish
1) Firebase project yarating va Web App qo'shing.
2) `assets/js/firebase-init.js` ichidagi `firebaseConfig` ni o'zingiznikiga almashtiring.
3) Firebase Console → Firestore/Storage → Rules: `firestore.rules` va `storage.rules` fayllarini qo'ying.
4) Fayllarni hostingga yoki local serverga qo'ying (oddiy `Live Server` yetadi).

## Admin
- `admin.html` — katalogga hujjat qo'shadi/tahrirlaydi/o'chiradi
- Rasm tanlansa, Storage'ga yuklanadi va `image` maydoni URL bilan to'ldiriladi
- JSON import/eksport bor

## Public sahifalar
- `home.html` — oxirgi `type=home` hujjatidan banner
- `courses.html` — `type=course`
- `simulators.html` — `type=sim`
- `tests.html` — `type=test` (vaqtli taymer bilan)

## Ma'lumot modeli (catalog)
```
{
  type: "home|course|sim|test",
  title, desc, image, link, button,
  price, tag, cat, cat2, cat3,
  mode, start, end, promotag,
  updatedAt
}
```

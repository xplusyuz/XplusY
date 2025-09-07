# MathCenter.uz — Final v2
- **Uy** sahifasi oxirida: *barcha foydalanuvchilar* 💎 kamayish tartibida, **Load more** bilan (Firestore pagination).
- **Top-100** alohida sahifasi olib tashlandi.
- **Barcha sahifalar grid-cards**.
- **Admin CRUD**: `content_home|courses|tests|sim` uchun qo'shish, tahrirlash, o'chirish — eng sodda UI (inline).
- Yagona Firestore importlar; Google+Email auth; profil majburiy; ID 1000001+; balans+olmos; pullik test gating.

## Qadamlar
1) `firestore.rules` ni Firebase'ga joylab **Publish** qiling.
2) Authentication → Google va Email/Password **Enabled**.
3) Authorized domains — hosting domeningiz qo'shilgan.

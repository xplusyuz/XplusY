# MathCenter.uz — v3 (Access Gate + Admin Panel)
**Yangi**:
- (2) **Xarid qilingan kontentga kirish tekshiruvi**: `Boshlash` tugmasi bepul bo'lmasa — avval `users/{uid}/purchases` ichida ayni `productId` mavjudligini tekshiradi.
- (3) **Admin Panel**: `users/{uid}.isAdmin = true` bo'lsa, Sozlamalarda kontentni Firestore'da boshqarish (collections: `content_home`, `content_courses`, `content_tests`, `content_sim`). Renderer birinchi bo'lib Firestore'dan o'qiydi, bo'sh bo'lsa CSVga qaytadi.

**Rules** yangilandi: `content_*` kolleksiyalarida CRUD faqat `isAdmin=true` foydalanuvchiga ruxsat.

*Yaratilgan sana:* 2025-09-07

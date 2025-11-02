LeaderMath.UZ — Firestore-backed config + Admin guard
1) AUTH: Authentication → yoqing (Google + Email/Password), Authorized domainsga domenlaringizni kiriting.
2) ADMIN: admin.html ichidagi ADMIN_EMAILS ro'yxatini o'zingizga moslang.
3) RULES: firestore.rules faylini konsolda publish qiling va UID'ni o'zingizniki bilan almashtiring (Users ro'yxatidan ko'riladi).
4) ADMIN: /admin.html orqali bo'limlarni tahrirlab 'Firestore’ga chiqarish' ni bosing.
5) INDEX: / sayti configs/home dan o'qiydi; bo'lmasa home.json'dan fallback.

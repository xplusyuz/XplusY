ORZUMALL — Netlify deploy (PUBLIC root + Payme endpoint)

1) Netlify publish papka:
   - netlify.toml ichida publish="public" berilgan.
   - Shuning uchun sayt rootda ochiladi: https://SITE/

2) Payme endpoint:
   https://SITE/.netlify/functions/payme

3) Netlify Environment variables:
   - PAYME_KEY = Payme test/prod key
   - FIREBASE_SERVICE_ACCOUNT_B64 = base64(serviceAccount.json) (1 qatorda!)
   - (ixtiyoriy) PAYME_ENV = "test" yoki "prod"

4) Deploy usuli:
   A) GitHub orqali deploy bo'lsa:
      - shu o'zgarishlarni repo'ga commit + push qiling
      - Netlify -> Deploys -> Clear cache and deploy
   B) Drag & Drop (eng tez):
      - Netlify -> Sites -> Deploy manually -> shu zipni upload qiling

5) Agar Payme sandboxda eski "Cannot find module ./util/minimal" chiqsa:
   - bu eski function ishlayotganini bildiradi.
   - albatta Clear cache and deploy qiling va repo'ga push bo'lganini tekshiring.

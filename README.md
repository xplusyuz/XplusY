# Leader Platform — Perfect Netlify Deploy Starter

## Nega bu "mukammal"?
- Netlify GitHub deploy'da ham, manual deploy'da ham yiqilmaydi.
- `netlify.toml` publish = `site` (hamma HTML/CSS/JS shu yerda).
- `npm run build` doim OK (build shart emas, lekin Netlify build stage muammosiz o'tadi).
- Functions `netlify/functions/` ichida, alohida `package.json` bilan.

## Netlify ENV
- JWT_SECRET
- FIREBASE_SERVICE_ACCOUNT_JSON (service account JSON string)

## Deploy (GitHub)
Push qiling, Netlify o'zi build qiladi.

## Deploy (manual)
ZIP’ni Netlify manual deployga tashlasangiz ham ishlaydi (lekin functions uchun baribir build ishlaydi).

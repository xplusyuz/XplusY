DEPLOY (FINAL):
1) Push this repo to GitHub (or upload as Netlify manual deploy).
2) Netlify → Environment variables:
   - PAYME_KEY = <your Payme key (test/prod)>
   - FIREBASE_SERVICE_ACCOUNT_B64 = <base64 of serviceAccount.json (ONE line)>
3) Netlify → Deploys → Clear cache and deploy site.
4) Payme endpoint:
   https://YOUR-SITE/.netlify/functions/payme

Note:
- This project uses Netlify Functions bundler 'zisi' to avoid protobufjs missing module errors.

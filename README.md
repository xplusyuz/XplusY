# ExamHouse.uz — Clean Rebuild

## Deploy (Netlify/Hostinger)
1. Ushbu papkani yuklang (root’da `index.html` bor).
2. Firebase Console → Authentication → **Sign-in method** → **Google** → Enable.
3. Authentication → **Settings** → **Authorized domains**: Netlify domeningizni qo‘shing.
4. Firestore: `meta/counters` hujjatini yarating:
   ```json
   { "lastUserId": 100000 }
   ```

## Firestore Rules (starter)
`firestore.rules` faylini Project Settings → Firestore Rules-ga qo‘ying va Deploy qiling.

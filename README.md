# MathCenter.uz — v3 (Tests + Live Realtime)

- Universal `ucard` kartalar (reklama/kurs/test/sim/live)
- Live kartalarda **real-time ishtirokchilar** (👥 badge) + **countdown**
- Test Player (math): savollar (CSV), taymer, natijalar, Firestore'ga saqlash
- Router (`/test/:slug`) — CSV'dagi `link`lar bilan ishlaydi
- Admin CRUD, Hamyon (demo), Purchase → access

## Sozlash
1) Firebase Authentication: Google + Email/Password — **Enable**; Authorized domainsga deploy domeningizni qo'shing.
2) Firestore: `firestore.rules`'ni **Publish** qiling.
3) Statik serverda ishga tushiring (HTTP).

## CSV
- `content/home.csv`: title, tag, meta, image, link
- `content/courses.csv`: name, tag, meta, link (Kurslarda faqat **Kirish**)
- `content/tests.csv`: name, tag, meta, price, productId, link, durationSec (Testlarda **faqat Boshlash**, narx tekshiradi)
- `content/sim.csv`: name, tag, meta, link (Simda **Ochish**)
- `content/live.csv`: title, tag, meta, entryPrice, prize, startAt, endAt, startLink, modalText (Live kartada taymer, badge, modal)

## Savollar CSV
`content/tests_data/<productId>.csv` → ustunlar: `id,text,a,b,c,d,ans` (faqat matematika)

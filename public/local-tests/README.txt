LOCAL TESTS (fallback)

test.html sahifasi avval Firebase (tests collection) dan `code` bo'yicha qidiradi.
Agar topilmasa, mana shu papkadan qidiradi:

1) local-tests/<CODE>.json  (masalan: local-tests/8001.json)
2) local-tests/index.json  (tests ro'yxati: { tests:[{code, file}] })

Rasm fayllari:
 - Agar test JSON ichida `folder` berilsa, rasmlar shu papkadan olinadi:
   local-tests/<folder>/1.png, 2.png...
 - Agar `folder` bo'lmasa, CODE ishlatiladi:
   local-tests/<CODE>/1.png, 2.png...

Minimal JSON namunasi (local-tests/8001.json):
{
  "id": "8001",
  "code": "8001",
  "title": "Namuna test",
  "durationSec": 600,
  "folder": "8001",
  "questions": [
    {"type":"mcq","img":"1.png","options":["2","3","4"],"correct":"2","points":1},
    {"type":"open","img":"2.png","answers":["12"],"points":1}
  ]
}

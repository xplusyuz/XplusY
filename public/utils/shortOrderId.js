
// ===============================
// ORZUMALL SHORT NUMERIC ORDER ID
// 6-digit random → auto expand 7,8...
// ===============================

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function randomDigits(len) {
  const max = 10 ** len;
  const n = Math.floor(Math.random() * (max - 1)) + 1;
  return String(n).padStart(len, "0");
}

export async function createOrderWithShortId(db, orderData) {
  let len = 6;

  while (true) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const id = randomDigits(len);
      const ref = doc(db, "orders", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, {
          ...orderData,
          orderId: id,
          createdAt: serverTimestamp()
        });
        return id;
      }
    }
    len++;
  }
}

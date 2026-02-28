// ===============================
// ORZUMALL SHORT NUMERIC ORDER ID
// 6-digit random → auto expand 7,8...
// ===============================

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function randomDigits(len) {
  const max = 10 ** len;
  const n = Math.floor(Math.random() * (max - 1)) + 1; // 1..max-1
  return String(n).padStart(len, "0");
}

// Returns an unused numeric id as string (digits only), starting at 6 digits.
// If collisions happen too often, grows to 7,8...
export async function generateShortOrderId(db) {
  let len = 6;

  while (true) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const id = randomDigits(len);
      const ref = doc(db, "orders", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return id;
    }
    len++;
  }
}

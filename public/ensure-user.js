import { db } from "./firebase-config.js";
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/**
 * World-class optimized ensureUser:
 * - 1 transaction
 * - 1 read of /users/{uid}
 * - only reads /meta/counters if numericId missing
 * - writes users_by_numeric mapping when assigning
 */
export async function ensureUserDocFast({ uid, phone="", name="" }){
  const userRef = doc(db, "users", uid);
  const counterRef = doc(db, "meta", "counters");

  const res = await runTransaction(db, async (tx)=>{
    const uSnap = await tx.get(userRef);
    const existing = uSnap.exists() ? (uSnap.data() || {}) : {};

    let numericId = existing.numericId;
    if(!Number.isFinite(Number(numericId))){
      const cSnap = await tx.get(counterRef);
      const c = cSnap.exists() ? (cSnap.data() || {}) : {};
      let next = 1000;
      if(Number.isFinite(Number(c.nextUserId))) next = Number(c.nextUserId);
      else if(Number.isFinite(Number(c.userIdCounter))) next = Number(c.userIdCounter);
      numericId = next;

      tx.set(counterRef, { nextUserId: Number(numericId) + 1 }, { merge:true });

      const mapRef = doc(db, "users_by_numeric", String(numericId));
      tx.set(mapRef, { uid }, { merge:true });
    }

    const payload = {
      numericId: Number(numericId),
      phone: phone || existing.phone || "",
      name: name || existing.name || "",
      updatedAt: serverTimestamp(),
      ...(uSnap.exists() ? {} : { createdAt: serverTimestamp(), balanceUZS: 0, points: 0 })
    };

    tx.set(userRef, payload, { merge:true });

    return { numericId: Number(numericId), name: payload.name || "User", phone: payload.phone || "" };
  });

  return res;
}

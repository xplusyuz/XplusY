import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

admin.initializeApp();
const db = admin.firestore();

/**
 * Callable: submitTestResult
 * Server-side secure points add (first attempt only).
 */
export const submitTestResult = onCall(
  { enforceAppCheck: true, consumeAppCheckToken: true, maxInstances: 10, cors: true },
  async (req) => {
    const auth = req.auth;
    if (!auth || !auth.uid) {
      throw new Error("UNAUTHENTICATED");
    }
    const uid = auth.uid;

    const { testId, total, max, detail, spentSeconds } = req.data || {};
    if (typeof testId !== "string" || !testId) throw new Error("INVALID_TEST_ID");
    if (typeof total !== "number" || total < 0 || total > 1000) throw new Error("INVALID_TOTAL");
    if (typeof max !== "number" || max <= 0 || max > 2000) throw new Error("INVALID_MAX");
    if (total > max) throw new Error("TOTAL_GT_MAX");

    const resRef = db.doc(`results/${testId}/users/${uid}`);
    const userRef = db.doc(`users/${uid}`);

    try {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(resRef);
        if (snap.exists) {
          return { skipped: true };
        }

        tx.set(resRef, {
          uid, testId, firstTotal: total, max,
          detail: detail ?? null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          spentSeconds: typeof spentSeconds === "number" ? spentSeconds : null
        });

        tx.set(
          userRef,
          {
            points: admin.firestore.FieldValue.increment(total),
            lastEarned: { testId, points: total, at: admin.firestore.FieldValue.serverTimestamp() }
          },
          { merge: true }
        );

        return { skipped: false, added: total };
      });

      return result;
    } catch (e) {
      logger.error("submitTestResult failed", e);
      throw new Error("INTERNAL");
    }
  }
);

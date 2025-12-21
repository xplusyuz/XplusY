import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_KEY)
    )
  });
}

const db = admin.firestore();

export async function handler(event) {
  try {
    const data = JSON.parse(event.body || "{}");

    if (!data.action) {
      return { statusCode: 400, body: "No action" };
    }

    // 🔹 YOZISH
    if (data.action === "save") {
      await db.collection("orders").add({
        ...data.payload,
        createdAt: Date.now()
      });
      return { statusCode: 200, body: "Saved" };
    }

    // 🔹 O‘QISH
    if (data.action === "list") {
      const snap = await db
        .collection("orders")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

      const res = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      return {
        statusCode: 200,
        body: JSON.stringify(res)
      };
    }

    return { statusCode: 400, body: "Unknown action" };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
}

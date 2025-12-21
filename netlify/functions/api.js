import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_KEY)
    )
  });
}

export async function handler() {
  return {
    statusCode: 200,
    body: "Firebase OK"
  };
}

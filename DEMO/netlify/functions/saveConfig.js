// netlify/functions/saveConfig.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}
const db = admin.firestore();

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Missing token', { status: 401 });

  let decoded;
  try { decoded = await admin.auth().verifyIdToken(token); }
  catch (e) { return new Response('Invalid token', { status: 401 }); }

  const allowEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s=>s.trim()).filter(Boolean);
  const isAllowed = decoded.admin === true || allowEmails.includes(decoded.email);
  if (!isAllowed) return new Response('Forbidden', { status: 403 });

  let body;
  try { body = await req.json(); } catch(e) { return new Response('Bad JSON', { status: 400 }); }
  if (!body || !Array.isArray(body.sections)) return new Response('Invalid payload', { status: 422 });

  await db.collection('configs').doc('home').set({ sections: body.sections }, { merge: false });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const { getDb, hashPassword, signJwt, json, readJsonBody } = require('./_firebase');

function randPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = readJsonBody(event);
  if (!body) return json(400, { error: 'JSON xato' });

  const db = getDb();
  const counterRef = db.doc('meta/counters');
  const usersCol = db.collection('users');

  try {
    const { newId } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists && typeof snap.data().nextUserId === 'number' ? snap.data().nextUserId : 100000;
      const next = current + 1;
      tx.set(counterRef, { nextUserId: next }, { merge: true });
      return { newId: current };
    });

    const id = String(newId); // numeric only
    const password = randPassword(10);
    const pass = hashPassword(password);

    await usersCol.doc(id).set({
      id,
      createdAt: new Date().toISOString(),
      points: 0,
      balance: 0,
      profile: { firstName: '', lastName: '', birthdate: '' },
      pass,
      mustCompleteProfile: true,
    }, { merge: true });

    const token = signJwt({ uid: id });

    return json(200, { ok: true, id, password, token });
  } catch (e) {
    return json(500, { error: 'Server xatosi', detail: String(e.message || e) });
  }
};

const { getDb, verifyJwt, hashPassword, json, readJsonBody } = require('./_firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = verifyJwt(token);
  if (!payload || !payload.uid) return json(401, { error: 'Auth kerak' });

  const body = readJsonBody(event);
  if (!body) return json(400, { error: 'JSON xato' });

  const patch = {};
  if (body.profile && typeof body.profile === 'object') {
    const p = body.profile;
    patch.profile = {
      firstName: String(p.firstName || '').slice(0, 60),
      lastName: String(p.lastName || '').slice(0, 60),
      birthdate: String(p.birthdate || '').slice(0, 20),
    };
  }
  if (body.newPassword) {
    const np = String(body.newPassword);
    if (np.length < 6) return json(400, { error: 'Yangi parol kamida 6 ta belgi' });
    patch.pass = hashPassword(np);
  }
  // if any profile field filled, mark completed
  if (patch.profile && (patch.profile.firstName || patch.profile.lastName || patch.profile.birthdate)) {
    patch.mustCompleteProfile = false;
  }

  try {
    const db = getDb();
    await db.collection('users').doc(String(payload.uid)).set(patch, { merge: true });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: 'Server xatosi', detail: String(e.message || e) });
  }
};

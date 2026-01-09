// ==================== GAMES: SUBMIT (record + points delta) ====================
// POST /.netlify/functions/api?path=/games/submit
// Body: { gameId, xp, pointsDelta, meta }
// Auth: Bearer token (requireToken)
if(path === "/games/submit" && method === "POST"){
  const auth = requireToken(event);
  if(!auth.ok) return auth.error;

  try{
    const body = parseBody(event);
    const gameId = String(body.gameId || "").trim() || "game001";
    const xp = Math.max(0, Math.floor(Number(body.xp || 0) || 0));
    const pointsDelta = Math.max(0, Math.floor(Number(body.pointsDelta || 0) || 0));
    const meta = (body.meta && typeof body.meta === "object") ? body.meta : null;

    const ts = admin.firestore.FieldValue.serverTimestamp();
    const userRef = db.collection("users").doc(auth.loginId);
    const recordsRef = db.collection("games").doc(gameId).collection("records").doc();

    await db.runTransaction(async (tx) => {
      const uSnap = await tx.get(userRef);
      if(!uSnap.exists) throw new Error("User topilmadi: " + auth.loginId);

      // 1) record (har urinish)
      tx.set(recordsRef, {
        uid: auth.loginId,
        xp,
        pointsDelta,
        meta,
        createdAt: ts,
      });

      // 2) points += pointsDelta (increment)
      if(pointsDelta > 0){
        tx.set(userRef, { points: admin.firestore.FieldValue.increment(pointsDelta) }, { merge:true });
      }

      // 3) per-user game stats
      const cur = uSnap.data() || {};
      const curBest = (((cur.games||{})[gameId]||{}).bestXp) || 0;
      const bestXp = Math.max(curBest, xp);
      tx.set(userRef, { games: { [gameId]: { bestXp, lastXp: xp, lastPlayedAt: ts } } }, { merge:true });
    });

    return json(200, { ok:true, gameId, xp, pointsDelta, recordId: recordsRef.id });
  }catch(e){
    return json(400, { error: e.message || "Submit game error" });
  }
}
// ==================== /GAMES: SUBMIT ====================

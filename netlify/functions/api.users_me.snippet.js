// ==================== USERS: ME (Firestore users/{loginId}) ====================
// GET /.netlify/functions/api?path=users/me
if(path === "users/me" && method === "GET"){
  const auth = requireToken(event);
  if(!auth.ok) return auth.error;

  try{
    const ref = db.collection("users").doc(auth.loginId);
    const snap = await ref.get();
    if(!snap.exists) return json(404, { error: "User doc topilmadi", loginId: auth.loginId });

    const user = snap.data();
    return json(200, { ok:true, user });
  }catch(e){
    return json(500, { error: e.message || "users/me error" });
  }
}
// ==================== /USERS: ME ====================

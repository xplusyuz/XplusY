// Render header and menu greeting
const { auth, db } = window.EXH;
auth.onAuthStateChanged(async (user)=>{ await renderAfterAuth(user); });

async function renderAfterAuth(user = auth.currentUser){
  const el = document.getElementById("header-auth");
  const greet = document.getElementById("menu-greeting");
  if(!el) return;
  if(!user){
    el.innerHTML = `<button class="btn ghost" id="btn-login" type="button">Kirish</button>
                    <button class="btn" id="btn-register" type="button">Registr</button>`;
    if(greet){ greet.textContent = "Salom mehmon!"; }
    return;
  }
  const doc = await db.collection("users").doc(user.uid).get();
  const u = doc.exists ? doc.data() : { name:user.email, balance:0, points:0, title:"Foydalanuvchi", numericId:"—" };

  el.innerHTML = `
    <div class="tag" title="Foydalanuvchi ID">${badgeSVG()} <strong>${u.numericId || "—"}</strong></div>
    <a class="tag" href="balans.html" title="Balans">💳 <strong>${(u.balance||0).toLocaleString("uz-UZ")} so‘m</strong>
      <span class="btn" style="padding:4px 8px;border-radius:8px;margin-left:6px;">+</span></a>
    <a class="btn ghost" href="profil.html">Profil</a>`;

  if(greet){
    greet.innerHTML = `Salom, <strong>${escapeHtml(u.name || user.email)}</strong> — ball: <strong>${u.points||0}</strong> • unvon: <strong>${escapeHtml(u.title||"-")}</strong>`;
  }
  const pb = document.getElementById("profile-block");
  if(pb){
    pb.innerHTML = `
      <div class="tag" title="Unvon">${badgeSVG()} ${escapeHtml(u.title||"-")}</div>
      <div class="tag">ID: <strong>${u.numericId||"—"}</strong></div>
      <div class="tag">Ball: <strong>${u.points||0}</strong></div>
      <div class="tag">Balans: <strong>${(u.balance||0).toLocaleString("uz-UZ")} so‘m</strong></div>`;
  }
}
function badgeSVG(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2l3 6 6 .9-4.5 4.2 1 6L12 16l-5.5 3.9 1-6L3 8.9 9 8l3-6z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`; }
function escapeHtml(str){ return String(str).replace(/[&<>\"']/g, s=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[s])); }
async function userUpdateBalanceDelta(delta){
  const user = auth.currentUser; if(!user) return;
  const ref = db.collection("users").doc(user.uid);
  await db.runTransaction(async (tx)=>{
    const snap = await tx.get(ref); const cur = snap.exists ? (snap.data().balance||0) : 0;
    tx.set(ref, { balance: cur + delta, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
  });
}
window.EXH_USER = { userUpdateBalanceDelta };

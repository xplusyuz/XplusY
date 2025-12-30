// Rating + Comment system (Firestore)
// UI elements expected on page:
// - #rateStars (buttons with data-star)
// - #rateValue, #rateAvg, #rateCount
// - #commentText, #btnSendComment
// - #commentsList

(function(){
  function $(id){ return document.getElementById(id); }
  function toast(msg){ window.LeaderUI?.toast ? window.LeaderUI.toast(msg) : alert(msg); }
  function pageId(){
    // One feedback room for whole app for now
    return document.body?.dataset?.page || "app";
  }

  async function ensure(){
    const s = await window.LM_FB?.init?.();
    if(!s || !s.ok) throw (s?.error || new Error("Firebase init xato"));
    return s;
  }

  async function setRating(star){
    const {db} = await ensure();
    const sess = window.LeaderAuth?.getSession?.();
    const localUserId = sess?.id || "guest";
    const pid = pageId();

    const metaRef = db.collection("feedback").doc(pid);
    const userRef = metaRef.collection("ratings").doc(localUserId);

    await db.runTransaction(async (tx) => {
      const metaSnap = await tx.get(metaRef);
      const userSnap = await tx.get(userRef);
      const meta = metaSnap.exists ? metaSnap.data() : { sum: 0, count: 0 };
      const prev = userSnap.exists ? Number(userSnap.data().star || 0) : 0;
      let sum = Number(meta.sum || 0);
      let count = Number(meta.count || 0);

      if(!prev){ count += 1; sum += star; }
      else { sum += (star - prev); }

      tx.set(metaRef, {
        sum,
        count,
        avg: count ? (sum / count) : 0,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      tx.set(userRef, {
        star,
        userId: localUserId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });
  }

  function renderStars(active){
    document.querySelectorAll("[data-star]").forEach(btn => {
      const v = Number(btn.getAttribute("data-star"));
      btn.classList.toggle("on", v <= active);
    });
    $("rateValue") && ($("rateValue").textContent = active ? `${active}/5` : "—");
  }

  async function loadMyRating(){
    const {db} = await ensure();
    const sess = window.LeaderAuth?.getSession?.();
    const localUserId = sess?.id || "guest";
    const pid = pageId();
    const userRef = db.collection("feedback").doc(pid).collection("ratings").doc(localUserId);
    userRef.onSnapshot(snap => {
      const star = snap.exists ? Number(snap.data().star || 0) : 0;
      renderStars(star);
    });
  }

  async function watchMeta(){
    const {db} = await ensure();
    const pid = pageId();
    db.collection("feedback").doc(pid).onSnapshot(snap => {
      const d = snap.exists ? snap.data() : null;
      const avg = d ? Number(d.avg || 0) : 0;
      const count = d ? Number(d.count || 0) : 0;
      $("rateAvg") && ($("rateAvg").textContent = avg ? avg.toFixed(2) : "0.00");
      $("rateCount") && ($("rateCount").textContent = String(count));
    });
  }

  async function sendComment(){
    const {db} = await ensure();
    const sess = window.LeaderAuth?.getSession?.();
    const userId = sess?.id || "guest";
    const text = ($("commentText")?.value || "").trim();
    if(text.length < 2){ toast("Izoh yozing"); return; }
    const pid = pageId();
    await db.collection("feedback").doc(pid).collection("comments").add({
      userId,
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    $("commentText").value = "";
    toast("Izoh yuborildi");
  }

  async function watchComments(){
    const {db} = await ensure();
    const pid = pageId();
    db.collection("feedback").doc(pid).collection("comments")
      .orderBy("createdAt","desc").limit(30)
      .onSnapshot(snap => {
        const list = $("commentsList");
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(doc => {
          const d = doc.data() || {};
          const item = document.createElement("div");
          item.className = "comment-item";
          const who = document.createElement("div");
          who.className = "comment-who";
          who.textContent = d.userId || "—";
          const txt = document.createElement("div");
          txt.className = "comment-text";
          txt.textContent = d.text || "";
          item.appendChild(who);
          item.appendChild(txt);
          list.appendChild(item);
        });
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if(document.body?.dataset?.page !== "app") return;

    // Bind stars
    document.querySelectorAll("[data-star]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const v = Number(btn.getAttribute("data-star"));
        try{
          await setRating(v);
          toast("Reyting saqlandi");
        }catch(e){
          toast("Firestore ulanmagan: config/rules tekshiring");
          console.error(e);
        }
      });
    });

    $("btnSendComment")?.addEventListener("click", () => sendComment().catch(e => {
      toast("Izoh yuborilmadi (Firestore)" ); console.error(e);
    }));

    // Live
    loadMyRating().catch(()=>{});
    watchMeta().catch(()=>{});
    watchComments().catch(()=>{});
  });
})();

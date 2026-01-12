/* ===== Rating System: from scratch ===== */
(function(){
  const $ = (id)=>document.getElementById(id);
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,(c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

  function openRating(){
    const m = $("ratingModal");
    if(!m) return;
    m.classList.add("open");
    m.setAttribute("aria-hidden","false");
    document.documentElement.classList.add("noScroll");
    loadAndRender();
  }
  function closeRating(){
    const m = $("ratingModal");
    if(!m) return;
    m.classList.remove("open");
    m.setAttribute("aria-hidden","true");
    document.documentElement.classList.remove("noScroll");
  }

  function medalByRank(i){
    if(i===0) return "🥇";
    if(i===1) return "🥈";
    if(i===2) return "🥉";
    return "🏅";
  }
  function calcAge(b){
    if(!b) return null;
    try{
      const d = (typeof b==="number") ? new Date(b) : new Date(String(b));
      if(!isFinite(d.getTime())) return null;
      const now = new Date();
      let a = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if(m<0 || (m===0 && now.getDate()<d.getDate())) a--;
      return (a>=0 && a<=120) ? a : null;
    }catch(_){ return null; }
  }
  function pick(u, keys, fallback=null){
    for(const k of keys){
      if(u && u[k]!=null && u[k]!== "") return u[k];
    }
    return fallback;
  }

  function getAge(u){
    const direct = pick(u, ["age","userAge"]);
    if(direct!=null){
      const n = parseInt(direct,10);
      if(Number.isFinite(n)) return n;
    }
    const b = pick(u, ["birth","birthdate","birthDate","bday","dob"]);
    const a = calcAge(b);
    return a;
  }

  function normalize(items){
    const arr = (items||[]).map((u)=>({
      uid: pick(u, ["uid","userUid"], ""),
      numericId: String(pick(u, ["loginId","numericId","id","userId"], "")),
      name: String(pick(u, ["name","fullName","displayName"], "—")),
      avatar: String(pick(u, ["avatar","photoURL","photo","avatarUrl","avatarURL"], "icon.png")),
      points: Number(pick(u, ["points","xp","totalXP","totalPoints"], 0)) || 0,
      level: (typeof levelFromPoints==="function") ? levelFromPoints(Number(pick(u, ["points","xp","totalXP","totalPoints"], 0))||0) : 1,
      age: getAge(u),
      raw: u
    }));
    arr.sort((a,b)=>b.points-a.points);
    // attach rank + medal
    arr.forEach((x,i)=>{ x.rank=i+1; x.medal=medalByRank(i); });
    return arr;
  }

  function agePass(age, sel){
    if(sel==="all") return true;
    if(age==null) return false;
    if(sel==="18+") return age>=18;
    const n = parseInt(sel,10);
    return Number.isFinite(n) ? age===n : true;
  }

  function getSelAge(){
    const wrap = $("rtAgeChips");
    const act = wrap ? wrap.querySelector(".rtChip.active") : null;
    return act ? act.getAttribute("data-age") : "all";
  }

  function onlyMeOn(){
    const b = $("rtOnlyMe");
    return b && b.getAttribute("aria-pressed")==="true";
  }

  function matchMe(u){
    const myLoginId = window.currentUserNumericId || window.myLoginId || "";
    const myUid = window.currentUserUid || window.myUid || "";
    if(myLoginId && String(u.numericId)===String(myLoginId)) return true;
    if(myUid && String(u.uid)===String(myUid)) return true;
    return false;
  }

  async function loadAllLeaderboard(){
    // cache
    if(Array.isArray(window.__rtCache) && window.__rtCache.length) return window.__rtCache;

    // Use existing api() helper from assets/js/api.js
    if(typeof window.api !== "function"){
      throw new Error("api() not found");
    }
    // Pull a bigger limit so rating isn't empty
    const data = await window.api("leaderboard", { query: { limit: 500 } });
    const items = data?.items || [];
    window.__rtCache = normalize(items);
    return window.__rtCache;
  }

  function render(state, rows, meRow){
    rows = Array.isArray(rows) ? rows : [];
    const st = $("rtState");
    const pod = $("rtPodium");
    const list = $("rtList");
    const me = $("rtMeCard");

    if(st){
      st.style.display = state ? "flex":"none";
      if(state){
        st.innerHTML = `<div class="rtSpin"></div><div>${esc(state)}</div>`;
      }
    }
    if(!pod || !list) return;

    // Me card
    if(me){
      if(meRow){
        me.hidden = false;
        me.innerHTML = `
          <div class="rtMeGlow"></div>
          <div class="rtRow">
            <img class="rtAv rtMedalImg" data-level="${meRow.level}" src="logo.png" alt="medal">
            <div style="min-width:0">
              <div class="rtName">${esc(meRow.name)}</div>
              <div class="rtMeta">${esc(meRow.medal)} • LM-${esc(meRow.numericId||"—")} • ${meRow.age!=null ? esc(meRow.age+" yosh") : "—"}</div>
            </div>
            <div class="rtRankTag">#${meRow.rank}</div>
          </div>
          <div class="rtXPbig">${meRow.points} XP</div>
        `;
      }else{
        me.hidden = true;
        me.innerHTML = "";
      }
    }

    // Podium
    pod.innerHTML = "";
    rows.slice(0,3).forEach((r)=>{
      const card = document.createElement("div");
      card.className = "rtPodCard";
      card.innerHTML = `
        <div class="rtBadge">#${r.rank}</div>
        <div class="rtRow">
          <img class="rtAv rtMedalImg" data-level="${r.level}" src="logo.png" alt="medal">
          <div class="rtInfo">
            <div class="rtName">${esc(r.name)}</div>
            <div class="rtMeta"><span class="rtMedal">${esc(r.medal)}</span> LM-${esc(r.numericId||"—")} • ${r.age!=null ? esc(r.age+" yosh") : "—"}</div>
          </div>
        </div>
        <div class="rtPodXP">${r.points} XP</div>
      `;
      pod.appendChild(card);
    });

    // List
    list.innerHTML = "";
    if(!rows.length){
      list.innerHTML = `<div class="rtState" style="margin-top:0"><div>Natija topilmadi</div></div>`;
      return;
    }
    rows.forEach((r)=>{
      const it = document.createElement("div");
      const isMe = matchMe(r);
      it.className = "rtItem" + (isMe ? " rtMeRow" : "");
      if(isMe) it.setAttribute("data-me","1");
      it.innerHTML = `
        <div class="rtIdx">${r.rank}</div>
        <img class="rtAv rtMedalImg" data-level="${r.level}" src="logo.png" alt="medal">
        <div class="rtInfo">
          <div class="rtName">${esc(r.name)}</div>
          <div class="rtMeta">${esc(r.medal)} • LM-${esc(r.numericId||"—")} • ${r.age!=null ? esc(r.age+" yosh") : "—"}</div>
        </div>
        <div class="rtRight">
          <div class="rtXP">${r.points}</div>
          <div class="rtAgeTxt">${r.age!=null ? esc(r.age+" yosh") : ""}</div>
        </div>
      `;
      list.appendChild(it);
    });

    // pulse my row (for quick finding)
    try{
      const meEl = list.querySelector('[data-me="1"]');
      if(meEl && !onlyMeOn()){
        meEl.classList.remove("rtPulse");
        void meEl.offsetWidth;
        meEl.classList.add("rtPulse");
      }
    }catch(_){ }

    // hydrate medal images
    try{
      document.querySelectorAll(".rtMedalImg").forEach(img=>{
        const L = parseInt(img.getAttribute("data-level")||"1",10) || 1;
        if(typeof setMedalImg === "function") setMedalImg(img, L);
      });
    }catch(_){}

  }

  async function loadAndRender(){
    try{
      render("Reyting yuklanmoqda…");
      const all = await loadAllLeaderboard();
      const sel = getSelAge();
      const onlyMe = onlyMeOn();

      let rows = all.slice();
      if(onlyMe){
        rows = rows.filter(matchMe);
      }
      rows = rows.filter(r => agePass(r.age, sel));

      // find my row in unfiltered all (for analysis among peers)
      let meRow = null;
      if(window.currentUserNumericId || window.currentUserUid){
        meRow = all.find(matchMe) || null;
      }

      render(null, rows, meRow);
    }catch(err){
      console.error(err);
      render("Reytingni yuklab bo‘lmadi");
      const pod = $("rtPodium"); const list = $("rtList");
      if(pod) pod.innerHTML = "";
      if(list) list.innerHTML = `<div class="rtState"><div>❌ Xatolik: reyting maʼlumoti kelmadi</div></div>`;
    }
  }

  function wire(){
    // open button in page
    const openBtn = $("openRating");
    if(openBtn) openBtn.addEventListener("click", openRating);
    const openBtn2 = $("openRatingInline");
    if(openBtn2) openBtn2.addEventListener("click", openRating);

    const closeBtn = $("rtClose");
    if(closeBtn) closeBtn.addEventListener("click", closeRating);

    const overlay = $("ratingModal");
    if(overlay){
      overlay.addEventListener("click", (e)=>{ if(e.target===overlay) closeRating(); });
    }

    const ages = $("rtAgeChips");
    if(ages){
      ages.addEventListener("click", (e)=>{
        const b = e.target.closest(".rtChip");
        if(!b) return;
        ages.querySelectorAll(".rtChip").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        loadAndRender();
      });
    }

    const me = $("rtOnlyMe");
    if(me){
      me.addEventListener("click", ()=>{
        const on = me.getAttribute("aria-pressed")==="true";
        me.setAttribute("aria-pressed", on ? "false":"true");
        loadAndRender();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", wire);
})();

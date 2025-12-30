
import { me, logout, updateProfile, changePassword, setAvatar, getToken } from "./assets/js/auth.js";
    import { api } from "./assets/js/api.js";

    const $ = (id)=>document.getElementById(id);

    // UZ date formatter
    const months = ["yanvar","fevral","mart","aprel","may","iyun","iyul","avgust","sentabr","oktabr","noyabr","dekabr"];
    const days = ["yakshanba","dushanba","seshanba","chorshanba","payshanba","juma","shanba"];
    function setDate(){
      const d = new Date();
      const s = `${days[d.getDay()]}, ${d.getDate()}-${months[d.getMonth()]} ${d.getFullYear()} • ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      $("dt").textContent = s;
    }
    setDate(); setInterval(setDate, 15000);

    // Toast
    const toastEl = $("toast");
    function toast(msg){
      toastEl.textContent = msg;
      toastEl.classList.add("show");
      clearTimeout(window.__t);
      window.__t = setTimeout(()=>toastEl.classList.remove("show"), 1800);
    }

    function escapeHtml(s){
      return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[m]));
    }

    // Simple modal helpers
    function openModal(el){
      if(!el) return;
      el.style.display = "flex";
      el.setAttribute("aria-hidden","false");
      document.body.style.overflow = "hidden";
    }
    function closeModal(el){
      if(!el) return;
      el.style.display = "none";
      el.setAttribute("aria-hidden","true");
      document.body.style.overflow = "";
    }

    function calcAgePrecise(iso){
      if(!iso) return "—";
      const b = new Date(iso);
      if(Number.isNaN(b.getTime())) return "—";
      const n = new Date();
      let y=n.getFullYear()-b.getFullYear();
      let m=n.getMonth()-b.getMonth();
      let d=n.getDate()-b.getDate();
      if(d<0){ m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
      if(m<0){ y--; m+=12; }
      return `${y} yosh ${m} oy ${d} kun`;
    }

    // Avatar helpers (auto-detect avatar/1.png,2.png...) by probing images
    function avatarUrl(id){
      if(!id) return "";
      return `avatar/${id}.png`;
    }
    function setUserAvatar(id){
      const img = $("userAvatar");
      if(!img) return;
      const src = avatarUrl(id);
      if(!src){
        img.removeAttribute("src");
        img.dataset.avatarId = "";
        return;
      }
      img.src = src;
      img.dataset.avatarId = String(id);
      img.onerror = ()=>{
        img.removeAttribute("src");
        img.dataset.avatarId = "";
      };
    }

    async function probeAvatar(id){
      return new Promise((resolve)=>{
        const im = new Image();
        const t = setTimeout(()=>resolve(false), 900);
        im.onload = ()=>{ clearTimeout(t); resolve(true); };
        im.onerror = ()=>{ clearTimeout(t); resolve(false); };
        im.src = avatarUrl(id) + `?v=${Date.now()}`;
      });
    }

    async function loadAvatarGrid(){
      const grid = $("avatarGrid");
      const hint = $("avatarHint");
      if(!grid) return;
      grid.innerHTML = "";
      hint.textContent = "Tekshirilmoqda…";
      const found = [];
      // probe 1..60 (fast) and keep those that exist
      for(let i=1;i<=60;i++){
        // eslint-disable-next-line no-await-in-loop
        const ok = await probeAvatar(i);
        if(ok) found.push(i);
      }
      if(!found.length){
        hint.textContent = "avatar/ papkada 1.png,2.png... topilmadi (kamida bitta rasm qo‘ying)";
        return;
      }
      const cur = Number($("userAvatar")?.dataset?.avatarId || 0);
      grid.innerHTML = found.map(i=>`
        <button class="avaBtn ${i===cur?"active":""}" type="button" data-ava="${i}">
          <img alt="Avatar ${i}" src="${avatarUrl(i)}" />
          <div class="small">#${i}</div>
        </button>
      `).join("");
      hint.textContent = `${found.length} ta avatar topildi`;
    }

    function setupAvatarPicker(){
      const modal = $("avatarModal");
      const openTargets = [$("profileMini"), $("userAvatar")].filter(Boolean);
      const closeBtn = $("avatarClose");
      const refresh = $("avatarRefresh");
      openTargets.forEach(el=>el.addEventListener("click", async ()=>{
        openModal(modal);
        await loadAvatarGrid();
      }));
      closeBtn?.addEventListener("click", ()=>closeModal(modal));
      modal?.addEventListener("click", (e)=>{ if(e.target===modal) closeModal(modal); });
      refresh?.addEventListener("click", loadAvatarGrid);
      $("avatarGrid")?.addEventListener("click", async (e)=>{
        const b = e.target.closest("[data-ava]");
        if(!b) return;
        const id = Number(b.getAttribute("data-ava"));
        try{
          b.disabled = true;
          const r = await setAvatar(id);
          setUserAvatar(r.user?.avatarId || id);
          toast("Avatar saqlandi");
          await loadAvatarGrid();
        }catch(err){
          toast(err.message||"Xatolik");
        }finally{
          b.disabled = false;
        }
      });
    }

    // Feature cards (TEST Builder faqat admin ko‘rsin)
    let FEATURES = [
      { title:"Online Challenge", label:"Challenge", icon:"fa-bolt", tag:"Jonli", metaLeft:"Kundalik", desc:"Kunlik/haftalik jonli masalalar", img:"assets/images/online_challenge.svg", href:"challenge.html" },
      { title:"EXAM", label:"Exam", icon:"fa-graduation-cap", tag:"Imtihon", metaLeft:"Vaqt + Ball", desc:"Imtihon rejimi: vaqt, ball, natija", img:"assets/images/exam.svg", href:"exam.html" },
      { title:"PLAY", label:"Play", icon:"fa-gamepad", tag:"O‘yin", metaLeft:"Mantiq", desc:"O‘yin tarzida mantiqiy mashqlar", img:"assets/images/play.svg", href:"play.html" },
      { title:"TEST", label:"Test", icon:"fa-clipboard-question", tag:"JSON", metaLeft:"Sinov", desc:"Oddiy test + Challenge (kod bilan)", img:"assets/images/exam.svg", href:"test.html" },
    ];

        function renderSections(){
      const root = $("sections");
      root.innerHTML = FEATURES.map(f=>`
        <div class="card" tabindex="0" data-link="${f.href}" data-title="${escapeHtml(f.title)}">
          <div class="card-img-wrap">
            <img src="${f.img}" alt="${escapeHtml(f.title)}" loading="lazy">
            <div class="card-label">
              <i class="fa-solid ${f.icon||"fa-cube"}"></i> ${escapeHtml(f.label||f.title)}
            </div>
          </div>
          <div class="card-body">
            <div class="card-title">${escapeHtml(f.title)}</div>
            <div class="card-desc">${escapeHtml(f.desc)}</div>
            <div class="card-meta-row">
              <div class="card-meta-left">
                <span class="dot"></span>
                <span>${escapeHtml(f.metaLeft||"Boshlash")}</span>
              </div>
              <span class="card-tag-mini">${escapeHtml(f.tag||"LeaderMath")}</span>
            </div>
            <div class="card-footer">
              <button class="btn" type="button">
                <i class="fa-solid fa-eye"></i>Ko'rish
              </button>
            </div>
          </div>
        </div>
      `).join("");

      function go(card){
        const href = card.getAttribute("data-link");
        if(href) location.href = href;
      }

      root.addEventListener("click", (e)=>{
        const card = e.target.closest(".card");
        if(card) go(card);
      }, { passive:true });

      root.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter") return;
        const card = e.target.closest(".card");
        if(card) go(card);
      });
    }

    async function runOnboarding(){
      return new Promise((resolve)=>{
        const overlay=$("onboardOverlay");
        const bSave=$("obSave");
        overlay.style.display="flex";
        bSave.onclick = async ()=>{
          bSave.disabled=true;
          try{
            const first=$("obFirst").value.trim();
            const last=$("obLast").value.trim();
            const birth=$("obBirth").value.trim();
            const p1=$("obPass1").value, p2=$("obPass2").value;
            if(first.length<2) throw new Error("Ism kamida 2 ta harf bo‘lsin");
            if(last.length<2) throw new Error("Familiya kamida 2 ta harf bo‘lsin");
            if(!birth) throw new Error("Tug‘ilgan sanani kiriting");
            if(p1.length<6) throw new Error("Yangi parol kamida 6 belgidan iborat bo‘lsin");
            if(p1!==p2) throw new Error("Parollar mos emas");
            await changePassword(p1);
            await updateProfile(first,last,birth);
            overlay.style.display="none";
            resolve(true);
          }catch(e){ toast(e.message||"Xatolik"); }
          finally{ bSave.disabled=false; }
        };
      });
    }

    // Leaderboard (interactive)
    let lbAll = [];
    let lbMeOnly = false;
    let lbQuery = "";
    let myLoginId = null;

    function medal(i){
      return i===0 ? "🥇" : i===1 ? "🥈" : i===2 ? "🥉" : "";
    }

    function renderLeaderboard(){
      const body = $("lbBody");
      const podium = $("lbPodium");
      const q = (lbQuery||"").toLowerCase();

      let items = lbAll.slice();
      if(lbMeOnly && myLoginId){
        items = items.filter(u=>String(u.loginId||"")===String(myLoginId));
      }
      if(q){
        items = items.filter(u=>
          String(u.loginId||"").toLowerCase().includes(q) ||
          String(u.name||"").toLowerCase().includes(q)
        );
      }

      const top = items.slice(0,3);
      const topPts = Number(top?.[0]?.points || 0) || 1;

      // Podium (Top-3)
      podium.innerHTML = top.map((u,i)=>{
        const pts = Number(u.points||0);
        const pct = Math.max(8, Math.round((pts/topPts)*100));
        const me = myLoginId && String(u.loginId||"")===String(myLoginId);
        return `
          <button class="podCard ${me?"me":""}" type="button" data-pick="${escapeHtml(u.loginId||"")}" title="${escapeHtml(u.name||u.loginId||"")}">
            <div class="podTop">
              <div class="podMedal">${medal(i)}</div>
              <div class="podRank">#${i+1}</div>
            </div>
            <div class="podName">${escapeHtml(u.name || u.loginId || "—")}</div>
            <div class="podId">${escapeHtml(u.loginId || "")}</div>
            <div class="podBar"><span style="width:${pct}%"></span></div>
            <div class="podPts">${pts} ball</div>
          </button>
        `;
      }).join("") || `<div class="small">Hozircha reyting yo‘q</div>`;

      // Table (Top-20 of filtered)
      const show = items.slice(0,20);
      body.innerHTML = show.map((u,i)=>{
        const pts = Number(u.points||0);
        const me = myLoginId && String(u.loginId||"")===String(myLoginId);
        const pct = Math.max(6, Math.round((pts/topPts)*100));
        return `
          <tr class="lbRow ${me?"me":""}" data-pick="${escapeHtml(u.loginId||"")}">
            <td><span class="rankBadge">${i+1}</span></td>
            <td>
              <div class="nameLine">${escapeHtml(u.name || u.loginId || "—")}</div>
              <div class="small">${escapeHtml(u.loginId || "")}</div>
              <div class="miniBar"><span style="width:${pct}%"></span></div>
            </td>
            <td><b>${pts}</b></td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="3" class="small">Mos natija topilmadi</td></tr>`;
    }

    async function loadLeaderboard(){
      const body = $("lbBody");
      body.innerHTML = `<tr><td colspan="3" class="small">Yuklanmoqda…</td></tr>`;
      try{
        const data = await api("leaderboard", { query: { limit: 120 } });
        lbAll = (data?.items || []);
        renderLeaderboard();
      }catch(_){
        body.innerHTML = `<tr><td colspan="3" class="small">Reytingni yuklab bo‘lmadi</td></tr>`;
      }
    }

    // ===== Leaderboard modal (all with paging) =====
    let lbCursor = null;
    let lbRankBase = 0;
    async function loadLeaderboardMore(reset=false){
      const body = $("lbAllBody");
      const btn = $("lbLoadMore");
      try{
        btn.disabled = true;
        if(reset){
          lbCursor = null;
          lbRankBase = 0;
          body.innerHTML = `<tr><td colspan="3" class="small">Yuklanmoqda…</td></tr>`;
        }
        const data = await api("leaderboard", { query: { limit: 60, cursor: lbCursor } });
        const items = data?.items || [];
        if(reset) body.innerHTML = "";
        body.insertAdjacentHTML("beforeend", items.map((u,i)=>`
          <tr>
            <td><span class="rankBadge">${lbRankBase + i + 1}</span></td>
            <td>
              <div class="nameLine">${escapeHtml(u.name || u.loginId || "—")}</div>
              <div class="small">${escapeHtml(u.loginId || "")}</div>
            </td>
            <td><b>${Number(u.points||0)}</b></td>
          </tr>
        `).join(""));
        lbRankBase += items.length;
        lbCursor = data?.nextCursor || null;
        btn.style.display = lbCursor ? "inline-flex" : "none";
        if(!items.length && reset){
          body.innerHTML = `<tr><td colspan="3" class="small">Hozircha reyting yo‘q</td></tr>`;
          btn.style.display = "none";
        }
      }catch(_){
        if(reset) body.innerHTML = `<tr><td colspan="3" class="small">Reytingni yuklab bo‘lmadi</td></tr>`;
      }finally{
        btn.disabled = false;
      }
    }

    // Comments
    function fmtTime(ts){
      const d = ts ? new Date(ts) : new Date();
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    let likedSet = new Set();

    function renderReplies(replies){
      const items = (replies||[]).map(r=>`
        <li class="replyItem">
          <div class="top">
            <div class="nameLine">${escapeHtml(r.name || r.loginId || "—")}</div>
            <div class="small">${escapeHtml(fmtTime(r.createdAt))}</div>
          </div>
          <div class="replyText">${escapeHtml(r.text || "")}</div>
        </li>
      `).join("");
      return items || `<li class="small">Hozircha javob yo‘q</li>`;
    }

    function renderCommentItem(c){
      const liked = likedSet.has(String(c.id));
      const isOwner = myLoginId && String(c.loginId||"") === String(myLoginId);
      const edited = c.edited === true;
      return `
        <li class="commentItem" data-id="${escapeHtml(c.id)}">
          <div class="top">
            <div class="nameLine">${escapeHtml(c.name || c.loginId || "—")}</div>
            <div class="small">${escapeHtml(fmtTime(c.createdAt))}</div>
          </div>
          <div class="commentText" data-role="text">${escapeHtml(c.text || "")}</div>
          ${edited ? `<div class="small editedTag">tahrirlangan</div>` : ``}

          ${isOwner ? `
            <div class="ownerActions">
              <button class="miniBtn" data-act="edit" type="button" title="Tahrirlash">✎</button>
              <button class="miniBtn danger" data-act="delete" type="button" title="O‘chirish">🗑</button>
            </div>
          ` : ``}

          <div class="commentActions compact">
            <button class="actBtn ${liked?"liked":""}" data-act="like" type="button" aria-label="Like">
              <span class="ic">❤</span>
              <span class="lbl">Like</span>
              <span class="cnt" data-k="likeCount">${Number(c.likeCount||0)}</span>
            </button>
            <button class="actBtn" data-act="toggleReplies" type="button" aria-label="Javoblar">
              <span class="ic">↩</span>
              <span class="lbl">Reply</span>
              <span class="cnt" data-k="replyCount">${Number(c.replyCount||0)}</span>
            </button>
          </div>

          <div class="repliesWrap" data-open="0">
            <ul class="replyList" data-loaded="0"></ul>
            <div class="replyBox">
              <input class="replyInput" maxlength="160" placeholder="Javob yozing… (160)" />
              <button class="btn btnPrimary replySend" data-act="sendReply" type="button">Yuborish</button>
            </div>
          </div>
        </li>
      `;
    }

    async function loadLiked(){
      likedSet = new Set();
      try{
        const token = await getToken();
        const data = await api("comments/liked", { token });
        for(const id of (data?.ids || [])) likedSet.add(String(id));
      }catch(_){ /* ignore */ }
    }

    // ===== Comments (always show all, paging in the panel) =====
    let cmCursor = null;
    async function loadComments(reset=false){
      const list = $("commentList");
      const btn = $("cmLoadMoreInline");
      const count = $("commentCount");
      try{
        btn.disabled = true;
        if(reset){
          cmCursor = null;
          list.innerHTML = `<li class="small">Yuklanmoqda…</li>`;
        }
        await loadLiked();
        const data = await api("comments", { query: { limit: 30, cursor: cmCursor } });
        const items = data?.items || [];
        if(reset) list.innerHTML = "";
        list.insertAdjacentHTML("beforeend", items.map(renderCommentItem).join(""));
        cmCursor = data?.nextCursor || null;
        btn.style.display = cmCursor ? "inline-flex" : "none";
        // total (if server returns it), else show loaded count
        const total = Number(data?.total || 0);
        const loaded = list.querySelectorAll(".commentItem").length;
        count.textContent = total ? String(total) : String(loaded);
        if(!items.length && reset){
          list.innerHTML = `<li class="small">Hozircha izoh yo‘q. Birinchi bo‘ling 🙂</li>`;
          btn.style.display = "none";
          count.textContent = "0";
        }
      }catch(_){
        if(reset) list.innerHTML = `<li class="small">Izohlarni yuklab bo‘lmadi</li>`;
      }finally{
        btn.disabled = false;
      }
    }

    async function loadReplies(commentId, li){
      const wrap = li.querySelector(".repliesWrap");
      const ul = li.querySelector(".replyList");
      if(!wrap || !ul) return;
      try{
        const data = await api("comments/replies", { method:"POST", body:{ commentId, limit: 30 } });
        ul.innerHTML = renderReplies(data?.items || []);
        ul.setAttribute("data-loaded","1");
      }catch(_){
        ul.innerHTML = `<li class="small">Javoblarni yuklab bo‘lmadi</li>`;
      }
    }

    function setRepliesOpen(li, open){
      const wrap = li.querySelector(".repliesWrap");
      if(!wrap) return;
      wrap.setAttribute("data-open", open?"1":"0");
    }

    // Delegated actions on comment lists (preview + modal)
    async function handleCommentActions(e){
      const btn = e.target.closest("button[data-act]");
      if(!btn) return;
      const li = e.target.closest(".commentItem");
      if(!li) return;
      const id = li.getAttribute("data-id");
      const act = btn.getAttribute("data-act");

      if(act === "like"){
        try{
          const token = await getToken();
          const out = await api("comments/like", { method:"POST", token, body:{ commentId: id } });
          const liked = !!out.liked;
          if(liked) likedSet.add(String(id)); else likedSet.delete(String(id));
          btn.classList.toggle("liked", liked);
          const cnt = li.querySelector('[data-k="likeCount"]');
          if(cnt) cnt.textContent = String(out.likeCount ?? 0);
        }catch(_){ toast("Like uchun kirish kerak"); }
        return;
      }

      if(act === "toggleReplies"){
        const wrap = li.querySelector(".repliesWrap");
        const isOpen = wrap?.getAttribute("data-open") === "1";
        setRepliesOpen(li, !isOpen);
        const ul = li.querySelector(".replyList");
        if(!isOpen && ul && ul.getAttribute("data-loaded") !== "1"){
          await loadReplies(id, li);
        }
        return;
      }

      if(act === "sendReply"){
        const input = li.querySelector(".replyInput");
        const text = (input?.value || "").trim();
        if(!text) return toast("Javob bo‘sh");
        try{
          const token = await getToken();
          btn.disabled = true;
          await api("comments/reply", { method:"POST", token, body:{ commentId: id, text } });
          if(input) input.value = "";
          toast("Javob yuborildi ✅");
          // update reply count UI
          const rc = li.querySelector('[data-k="replyCount"]');
          if(rc) rc.textContent = String(Number(rc.textContent||0) + 1);
          await loadReplies(id, li);
          setRepliesOpen(li, true);
        }catch(_){ toast("Reply uchun kirish kerak"); }
        finally{ btn.disabled = false; }
        return;
      }

      if(act === "edit"){
        const textEl = li.querySelector('[data-role="text"]');
        const cur = textEl ? (textEl.textContent || "") : "";
        // swap to editor
        li.classList.add("editing");
        if(textEl){
          textEl.innerHTML = `
            <textarea class="editArea" maxlength="140">${escapeHtml(cur)}</textarea>
            <div class="editBar">
              <button class="btn btnPrimary btnSm" data-act="saveEdit" type="button">Saqlash</button>
              <button class="btn btnSm" data-act="cancelEdit" type="button">Bekor</button>
            </div>
          `;
        }
        return;
      }

      if(act === "cancelEdit"){
        // easiest: reload comments to restore template
        await loadComments(true);
        return;
      }

      if(act === "saveEdit"){
        const area = li.querySelector(".editArea");
        const text = (area?.value || "").trim();
        if(!text) return toast("Izoh bo‘sh");
        try{
          const token = await getToken();
          btn.disabled = true;
          await api("comments/update", { method:"POST", token, body:{ commentId: id, text } });
          toast("Tahrirlandi ✅");
          await loadComments(true);
        }catch(_){ toast("Tahrirlash uchun ruxsat yo‘q"); }
        finally{ btn.disabled = false; }
        return;
      }

      if(act === "delete"){
        if(!confirm("Izoh o‘chirilsinmi?")) return;
        try{
          const token = await getToken();
          btn.disabled = true;
          await api("comments/delete", { method:"POST", token, body:{ commentId: id } });
          toast("O‘chirildi ✅");
          await loadComments(true);
        }catch(_){ toast("O‘chirish uchun ruxsat yo‘q"); }
        finally{ btn.disabled = false; }
        return;
      }
    }

    $("commentList").addEventListener("click", handleCommentActions, { passive:false });
    async function sendComment(){
      const input = $("commentInput");
      const text = (input.value||"").trim();
      if(!text) return toast("Izoh bo‘sh");
      input.value = "";
      try{
        const token = await getToken();
        await api("comments", { method:"POST", token, body: { text } });
        toast("Yuborildi ✅");
        await loadComments(true);
      }catch(e){
        toast("Xato: yuborilmadi");
      }
    }

    // Modal wiring (leaderboard only)
    const lbModal = $("lbModal");
    $("btnLbAll").onclick = async ()=>{ openModal(lbModal); await loadLeaderboardMore(true); };
    $("lbModalClose").onclick = ()=>closeModal(lbModal);
    $("lbLoadMore").onclick = ()=>loadLeaderboardMore(false);

    // close on backdrop click
    lbModal.addEventListener("click", (e)=>{ if(e.target === lbModal) closeModal(lbModal); });

    // ===== Notifications =====
    const notifModal = $("notifModal");
    let notifCursor = null;
    async function refreshUnread(){
      try{
        const token = await getToken();
        const d = await api("notifications/unread-count", { token });
        const n = Number(d?.unreadCount||0);
        const b = $("notifBadge");
        const bell = $("btnBell");
        if(b){
          b.textContent = String(n);
          b.style.display = n>0 ? "inline-flex" : "none";
        }
        if(bell) bell.classList.toggle("hasUnread", n>0);
      }catch(_){
        const b = $("notifBadge");
        if(b) b.style.display = "none";
        const bell = $("btnBell");
        if(bell) bell.classList.remove("hasUnread");
      }
    }

    function renderNotifItem(n){
      const read = !!n.read;
      return `
        <li class="notifItem ${read?"read":"unread"}" data-id="${escapeHtml(n.id)}">
          <div class="top">
            <div class="nameLine">${escapeHtml(n.title||"Xabar")}</div>
            <div class="small">${escapeHtml(fmtTime(n.createdAt))}</div>
          </div>
          <div class="notifBody">${escapeHtml(n.body||"")}</div>
          <div class="notifActions">
            <button class="miniBtn ghost" data-act="delNotif" type="button" aria-label="O‘chirish">🗑</button>
            ${read?"":"<button class=\"miniBtn\" data-act=\"readNotif\" type=\"button\">O‘qildi</button>"}
          </div>
        </li>
      `;
    }

    async function loadNotifs(reset=false){
      const list = $("notifList");
      const btn = $("notifLoadMore");
      try{
        btn.disabled = true;
        if(reset){
          notifCursor = null;
          list.innerHTML = `<li class="small">Yuklanmoqda…</li>`;
        }
        const token = await getToken();
        const data = await api("notifications", { token, query:{ limit: 20, cursor: notifCursor } });
        const items = data?.items || [];
        if(reset) list.innerHTML = "";
        list.insertAdjacentHTML("beforeend", items.map(renderNotifItem).join(""));
        notifCursor = data?.nextCursor || null;
        btn.style.display = notifCursor ? "inline-flex" : "none";
        const unreadCount = Number(data?.unreadCount||0);
        const b = $("notifBadge");
        if(b){
          b.textContent = String(unreadCount);
          b.style.display = unreadCount>0 ? "inline-flex" : "none";
        }
        if(!items.length && reset){
          list.innerHTML = `<li class="small">Hozircha bildirishnoma yo‘q 🙂</li>`;
          btn.style.display = "none";
        }
      }catch(_){
        if(reset) $("notifList").innerHTML = `<li class="small">Yuklab bo‘lmadi</li>`;
      }finally{ btn.disabled = false; }
    }

    async function markNotifRead(id){
      const token = await getToken();
      await api("notifications/read", { method:"POST", token, body:{ id } });
    }
    async function deleteNotif(id){
      const token = await getToken();
      await api("notifications/delete", { method:"POST", token, body:{ id } });
    }
    async function markAllRead(){
      const token = await getToken();
      await api("notifications/read", { method:"POST", token, body:{ all:true } });
    }

    $("btnBell")?.addEventListener("click", async ()=>{ openModal(notifModal); await loadNotifs(true); });
    $("notifClose")?.addEventListener("click", ()=>closeModal(notifModal));
    $("notifLoadMore")?.addEventListener("click", ()=>loadNotifs(false));
    $("notifMarkAll")?.addEventListener("click", async ()=>{ try{ await markAllRead(); await loadNotifs(true); await refreshUnread(); }catch(_){ toast("Xato"); } });
    notifModal.addEventListener("click", (e)=>{ if(e.target===notifModal) closeModal(notifModal); });
    $("notifList")?.addEventListener("click", async (e)=>{
      const li = e.target.closest(".notifItem");
      const id = li?.getAttribute("data-id");
      if(!id) return;

      const del = e.target.closest("button[data-act='delNotif']");
      if(del){
        try{ del.disabled = true; await deleteNotif(id); li.remove(); await refreshUnread(); }
        catch(_){ toast("Xato"); }
        finally{ del.disabled = false; }
        return;
      }

      const b = e.target.closest("button[data-act='readNotif']");
      if(!b) return;
      try{ b.disabled = true; await markNotifRead(id); li.classList.add("read"); li.classList.remove("unread"); await refreshUnread(); }
      catch(_){ toast("Xato"); }
      finally{ b.disabled=false; }
    });

    $("btnLogout").onclick = ()=>{ logout(); location.href="./"; };
    $("commentSend").onclick = sendComment;
    $("commentInput").addEventListener("keydown", (e)=>{ if(e.key==="Enter") sendComment(); });
    $("cmLoadMoreInline").onclick = ()=>loadComments(false);

    // Leaderboard interactivity
    $("lbSearch")?.addEventListener("input", (e)=>{
      lbQuery = e.target.value || "";
      renderLeaderboard();
    });
    $("lbOnlyMe")?.addEventListener("click", (e)=>{
      lbMeOnly = !lbMeOnly;
      e.currentTarget.setAttribute("aria-pressed", String(lbMeOnly));
      e.currentTarget.classList.toggle("active", lbMeOnly);
      renderLeaderboard();
    });
    // Click to spotlight a user in the table/podium
    function pickUser(loginId){
      if(!loginId) return;
      lbQuery = String(loginId);
      const inp = $("lbSearch");
      if(inp) inp.value = lbQuery;
      renderLeaderboard();
    }
    $("lbPodium")?.addEventListener("click", (e)=>{
      const b = e.target.closest("[data-pick]");
      if(b) pickUser(b.getAttribute("data-pick"));
    });
    $("lbBody")?.addEventListener("click", (e)=>{
      const r = e.target.closest("[data-pick]");
      if(r) pickUser(r.getAttribute("data-pick"));
    });

    async function boot(){
      setupSidePanel();
      setupAvatarPicker();

      try{
        const r = await me();
        const u = r.user;

        // Admin bo‘lsa: TEST Builder ko‘rsatamiz (bosh sahifada oddiy user ko‘rmasin)
        if(u && (u.role === "admin" || u.isAdmin === true)){
          FEATURES.push({ title:"TEST Builder", desc:"Test yaratish: Firestore + JSON eksport", img:"assets/images/play.svg", href:"test_builder.html" });
        }

        setUserAvatar(u.avatarId);
        $("userId").textContent = u.loginId;
        $("userName").textContent = u.name || u.loginId;
        $("userPoints").textContent = String(u.points ?? 0);
        $("userBalance").textContent = String(u.balance ?? 0);
        $("userAge").textContent = calcAgePrecise(u.birthdate);

        myLoginId = u.loginId;
        await refreshUnread();
        renderSections();
        loadLeaderboard();
        loadComments(true);

        if(!u.profileComplete){
          await runOnboarding();
          const r2 = await me();
          $("userName").textContent = r2.user.name || r2.user.loginId;
          $("userAge").textContent = calcAgePrecise(r2.user.birthdate);
          setUserAvatar(r2.user.avatarId);
        }
      }catch(e){
        toast(e.message||"Kirish yo‘q");
        setTimeout(()=>location.href="./", 600);
      }
    }
    
    function setupSidePanel(){
      const btn = $("sidePanelBtn");
      const overlay = $("sidePanelOverlay");
      const closeBtn = $("sideClose");
      const panel = $("sidePanel");

      const tabLb = $("sideTabLb");
      const tabCm = $("sideTabComments");
      const paneLb = $("sidePaneLb");
      const paneCm = $("sidePaneComments");

      function open(){
        overlay.setAttribute("aria-hidden","false");
        overlay.classList.add("open");
        // focus
        setTimeout(()=>closeBtn?.focus(), 50);
        document.body.classList.add("noScroll");
      }
      function close(){
        overlay.setAttribute("aria-hidden","true");
        overlay.classList.remove("open");
        document.body.classList.remove("noScroll");
      }
      function setTab(which){
        const isLb = which==="lb";
        tabLb.classList.toggle("active", isLb);
        tabCm.classList.toggle("active", !isLb);
        tabLb.setAttribute("aria-selected", String(isLb));
        tabCm.setAttribute("aria-selected", String(!isLb));
        paneLb.classList.toggle("active", isLb);
        paneCm.classList.toggle("active", !isLb);
      }

      btn?.addEventListener("click", ()=> {
        open();
        // default tab: if user last used keep in session
        const last = sessionStorage.getItem("sideTab") || "lb";
        setTab(last);
      });
      closeBtn?.addEventListener("click", close);
      overlay?.addEventListener("click", (e)=>{ if(e.target===overlay) close(); });

      tabLb?.addEventListener("click", ()=>{ sessionStorage.setItem("sideTab","lb"); setTab("lb"); });
      tabCm?.addEventListener("click", ()=>{ sessionStorage.setItem("sideTab","cm"); setTab("cm"); });

      document.addEventListener("keydown",(e)=>{
        if(e.key==="Escape" && overlay.classList.contains("open")) close();
      });
    }

    boot();

  
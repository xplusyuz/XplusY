import { auth, db, updateBalance, updateGems } from "./app.js";
import { doc, serverTimestamp, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

let Q=[], i=0, sel={}, timer=null, tLeft=0;
const qi=$("#qi"), qn=$("#qn"), tim=$("#tim"), tt=$("#tt"), priceEl=$("#price");
const pre=$("#prepay"), exam=$("#exam"), qimg=$("#qimg"), qtext=$("#qtext"), opts=$("#opts");

function fmt(sec){ const m=Math.floor(sec/60).toString().padStart(2,'0'); const s=(sec%60).toString().padStart(2,'0'); return m+':'+s; }

async function loadCSV(){
  const src = qs("src") || "/csv/test/demo.csv";
  const title = qs("title") || "Test";
  tt.textContent = decodeURIComponent(title);
  const res = await fetch(src, {cache:"no-store"});
  const text = await res.text();
  const rows = text.split(/\r?\n/).filter(Boolean).map(l=>l.split("|"));
  Q = rows.slice(1).map(r=>({
    img:r[0]||"", q:r[1]||"", a:[r[2],r[3],r[4],r[5]].filter(Boolean),
    plus:Number(r[6]||1), minus:Number(r[7]||0), correct: (r[8]? Number(r[8]): 1)-1
  }));
  qn.textContent = Q.length;
  const perMin = 2;
  tLeft = Q.length * perMin * 60;
}

function draw(){
  const x = Q[i];
  qi.textContent = i+1;
  qimg.innerHTML = x.img ? '<img src="'+x.img+'" class="cover"/>' : '';
  qtext.textContent = x.q;
  opts.innerHTML = "";
  x.a.forEach((opt, idx)=>{
    const b = document.createElement("button");
    b.className = "btn ghost";
    b.textContent = (idx+1)+") "+opt;
    b.onclick = ()=>{ sel[i]=idx; draw(); };
    if (sel[i]===idx) b.style.borderColor = "var(--primary)";
    opts.appendChild(b);
  });
  if (window.MathJax) MathJax.typesetPromise?.();
}

function tick(){
  tim.textContent = fmt(tLeft);
  tLeft--; if (tLeft<0){ finish(); return; }
}

function startTimer(){
  clearInterval(timer); timer = setInterval(tick, 1000);
}

async function doPayment(){
  const user = auth.currentUser;
  if (!user) { alert("Kirish talab qilinadi"); return false; }
  const price = Number(qs("price")||0);
  if (price>0){
    try{
      await updateBalance(user.uid, -price);
      await addDoc(collection(db,"payments"),{ uid:user.uid, amount:price, type:"test", src: qs("src"), at:serverTimestamp() });
      toast("To'lov qabul qilindi");
    }catch(e){
      alert("To'lovda xatolik: "+(e?.message||e)); return false;
    }
  }
  return true;
}

function next(){ if (i<Q.length-1){ i++; draw(); } }
function prev(){ if (i>0){ i--; draw(); } }

async function finish(){
  clearInterval(timer);
  let gain=0;
  Q.forEach((x, idx)=>{
    if (sel[idx]===undefined) return;
    if (sel[idx]===x.correct) gain += x.plus;
    else gain -= x.minus;
  });
  const user = auth.currentUser;
  if (user){
    try{
      await updateGems(user.uid, gain);
      await addDoc(collection(db,"attempts"),{ uid:user.uid, src: qs("src"), gain, sel, at:serverTimestamp() });
      toast("Yakunlandi. Olmos: "+gain);
    }catch(e){ console.error(e); }
  }
  exam.innerHTML = "<h3>Natija</h3><p>Olmos: <b>"+gain+"</b></p><a class='btn' href='#/tests'>Testlarga qaytish</a>";
}

document.addEventListener("DOMContentLoaded", async ()=>{
  const price = Number(qs("price")||0); priceEl.textContent = price.toLocaleString('uz-UZ');
  $("#next").onclick = next; $("#prev").onclick = prev; $("#finish").onclick = finish;
  await loadCSV();
  $("#btnPayStart").onclick = async ()=>{
    if (await doPayment()){
      pre.classList.add("hide"); exam.classList.remove("hide");
      draw(); startTimer();
    }
  };
});
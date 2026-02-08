import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const grid = document.getElementById("grid");
const tpl = document.getElementById("cardTpl");

function esc(s){ return (s ?? "").toString(); }

function render(items){
  grid.innerHTML = "";
  for(const p of items){
    const node = tpl.content.cloneNode(true);
    const img = node.querySelector(".img");
    const title = node.querySelector(".title");
    const price = node.querySelector(".price");
    const src = node.querySelector(".src");

    img.src = (p.images && p.images[0]) ? p.images[0] : "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'><rect width='100%' height='100%' fill='rgba(255,255,255,.06)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='rgba(255,255,255,.55)' font-family='Arial' font-size='28'>No image</text></svg>`);
    img.alt = esc(p.title);
    title.textContent = esc(p.title || "Nomsiz mahsulot");
    price.textContent = esc(p.priceText || "");
    src.href = esc(p.sourceUrl || "#");

    grid.appendChild(node);
  }
}

const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(80));
onSnapshot(q, (snap) => {
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render(arr);
});

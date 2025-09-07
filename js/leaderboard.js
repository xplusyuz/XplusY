
import { listenTopGems } from "./firebase.js";

const tbody = document.querySelector("#lbTable tbody");
listenTopGems(100, (rows)=>{
  tbody.innerHTML = "";
  rows.forEach((u, i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${u.displayName||u.email||"User"}</td><td>${u.numericId||"—"}</td><td>${u.gems||0}</td>`;
    tbody.appendChild(tr);
  });
});

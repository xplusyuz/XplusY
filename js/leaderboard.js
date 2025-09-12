import { getTopGems } from "./app.js";

document.addEventListener("DOMContentLoaded", async ()=>{
  const tb = document.querySelector("#tblLb tbody");
  tb.innerHTML = "<tr><td colspan='4'>Yuklanmoqda...</td></tr>";
  try{
    const rows = await getTopGems(100);
    tb.innerHTML = "";
    rows.forEach((u, idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${idx+1}</td><td>${u.firstName||'—'}</td><td>${u.numericId||'—'}</td><td>${u.gems||0}</td>`;
      tb.appendChild(tr);
    });
  }catch(e){
    tb.innerHTML = "<tr><td colspan='4'>Xatolik</td></tr>";
    console.error(e);
  }
});
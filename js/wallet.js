
import { auth, getUserDoc, updateUser } from "./firebase.js";
const balChip = document.getElementById("balanceChip");
const gemsChip = document.getElementById("gemsChip");

async function refresh() {
  const u = auth.currentUser;
  if (!u) return;
  const d = await getUserDoc(u.uid);
  if (balChip) balChip.textContent = `${d.balance||0} so'm`;
  if (gemsChip) gemsChip.textContent = `💎 ${d.gems||0}`;
}
refresh();

document.querySelectorAll("button[data-amount]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const amt = Number(btn.getAttribute("data-amount"));
    const u = auth.currentUser;
    if (!u) return alert("Kirish talab qilinadi");
    const d = await getUserDoc(u.uid);
    await updateUser(u.uid, { balance: (d.balance||0) + amt });
    await refresh();
    alert("Balans to'ldirildi (demo)");
  });
});

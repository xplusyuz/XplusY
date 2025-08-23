let pullikUnlocked = localStorage.getItem("pullikUnlocked") === "true";

function injectPullikModal() {
  if (document.getElementById("pullikModal")) return;

  const modal = document.createElement("div");
  modal.id = "pullikModal";
  modal.style.cssText = `
    display:none;position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.7);z-index:2000;
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:#fff;padding:25px;border-radius:16px;
                max-width:420px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,0.3)">
      <h2 style="margin-bottom:10px;">🔒 Pullik sahifa</h2>
      <p>Davom etish uchun kod kiriting yoki sotib oling 👇</p>
      <input type="text" id="pullikCode" placeholder="Kodni kiriting"
        style="padding:10px;width:85%;margin:12px 0;border:1px solid #ccc;border-radius:8px;">
      <br>
      <button id="pullikCheck"
        style="padding:10px 16px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;">
        ✅ Tekshirish
      </button>
      <button id="pullikBuy"
        style="padding:10px 16px;background:#0284c7;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-left:10px;">
        💳 Kod sotib olish
      </button>
      <p id="pullikResult" style="margin-top:12px;color:red;"></p>
    </div>
  `;
  document.body.appendChild(modal);

  // Kodni tekshirish
  document.getElementById("pullikCheck").addEventListener("click", async () => {
    const code = document.getElementById("pullikCode").value.trim();
    const res = await fetch("/.netlify/functions/useCode", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    const result = document.getElementById("pullikResult");

    if (data.success) {
      pullikUnlocked = true;
      localStorage.setItem("pullikUnlocked", "true");
      document.getElementById("pullikModal").style.display = "none";
      alert("✅ Kod to‘g‘ri! Endi barcha pullik sahifalar ochildi.");
    } else {
      result.textContent = data.message;
    }
  });

  // Sotib olish tugmasi
  document.getElementById("pullikBuy").addEventListener("click", () => {
    window.location.href = "/buy.html"; // keyin to‘lov sahifangizni ulaysiz
  });
}

function lockPullikLinks() {
  document.querySelectorAll(".pullik").forEach(el => {
    el.addEventListener("click", e => {
      if (!pullikUnlocked) {
        e.preventDefault();
        document.getElementById("pullikModal").style.display = "flex";
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  injectPullikModal();
  lockPullikLinks();
});

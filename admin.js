// LocalStorage'da foydalanuvchilar ro'yxati
let usersList = JSON.parse(localStorage.getItem("usersList") || "[]");
let loggedInUser = null;

// Telegram login funksiyasi
async function onTelegramAuth(user) {
  loggedInUser = user;

  // Agar foydalanuvchi ro'yxatda yo'q bo'lsa, qo'shish
  let existing = usersList.find(u => u.id === user.id);
  if (!existing) {
    usersList.push({ id: user.id, first_name: user.first_name, username: user.username, balans: 0 });
    localStorage.setItem("usersList", JSON.stringify(usersList));
  }

  localStorage.setItem("telegramUser", JSON.stringify(user));

  updateUserUI(user);
}

// Foydalanuvchi sahifasi UI yangilash
function updateUserUI(user) {
  document.getElementById("loginBtn").style.display = "none";
  document.getElementById("welcomeMsg").innerText = `Salom, ${user.first_name} (ID: ${user.id})`;
  document.getElementById("welcomeMsg").style.display = "inline";

  let u = usersList.find(x => x.id === user.id);
  let balansValue = u ? u.balans : 0;

  document.getElementById("balanceBox").innerText = `💰 ${balansValue} so‘m`;
  document.getElementById("balanceBox").style.display = "inline";

  const modal = document.getElementById("loginModal");
  if (modal) { modal.style.display = "none"; modal.remove(); }
}

// DOM tayyor bo'lganda foydalanuvchi saqlangan bo'lsa ko'rsatish
document.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("telegramUser");
  if (savedUser) {
    loggedInUser = JSON.parse(savedUser);
    updateUserUI(loggedInUser);
  }

  // Login tugmasi
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const modal = document.getElementById("loginModal");
      if (modal) modal.style.display = "flex";
    });
  }

  // Modal yopish
  const modalClose = document.getElementById("modalClose");
  if (modalClose) {
    modalClose.addEventListener("click", () => {
      const modal = document.getElementById("loginModal");
      if (modal) modal.style.display = "none";
    });
  }

  // Agar admin sahifasi bo'lsa, jadvalni yaratish
  const usersTableBody = document.querySelector("#usersTable tbody");
  const searchInput = document.getElementById("searchUser");

  if (usersTableBody) {
    function renderTable(filter="") {
      usersTableBody.innerHTML = "";
      usersList
        .filter(u => u.first_name.toLowerCase().includes(filter.toLowerCase()) || String(u.id).includes(filter))
        .forEach(u => {
          const tr = document.createElement("tr");

          tr.innerHTML = `
            <td>${u.first_name}</td>
            <td>${u.id}</td>
            <td><input type="number" value="${u.balans}" data-id="${u.id}" class="balansInput" style="width:80px;"></td>
            <td><button data-id="${u.id}" class="saveBtn">Saqlash</button></td>
          `;
          usersTableBody.appendChild(tr);
        });

      // Saqlash tugmasi
      document.querySelectorAll(".saveBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const input = document.querySelector(`.balansInput[data-id='${id}']`);
          const u = usersList.find(x => x.id == id);
          if (u && input) {
            u.balans = Number(input.value);
            localStorage.setItem("usersList", JSON.stringify(usersList));
            alert("Balans yangilandi!");
          }
        });
      });
    }

    renderTable();

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderTable(searchInput.value);
      });
    }
  }
});

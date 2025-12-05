/* leaderboard.js - injected helper (mock loader) */
async function loadLeaderboard() {
    try {
        const list = document.getElementById("leaderboard-list");
        if (!list) return;
        list.innerHTML = '';

        // MOCK data - replace with real DB calls (Firestore) as needed
        const mockUsers = [
            { id: 'u1', name: 'Ali', totalXP: 950, highestLevel: 5 },
            { id: 'u2', name: 'Vali', totalXP: 840, highestLevel: 4 },
            { id: 'u3', name: 'Sana', totalXP: 720, highestLevel: 4 }
        ];

        let rank = 1;
        let userRankFound = false;

        for (const u of mockUsers) {
            const li = document.createElement('div');
            li.classList.add('leaderboard-item');
            if (window.currentUser && u.id === window.currentUser.uid) {
                li.classList.add('current-user');
                document.getElementById('user-rank').textContent = rank;
                document.getElementById('user-total-xp').textContent = u.totalXP;
                document.getElementById('user-highest-level').textContent = u.highestLevel;
                userRankFound = true;
            }
            li.innerHTML = `
                <div class="leaderboard-rank">${rank}</div>
                <div class="leaderboard-avatar">${u.name ? u.name[0].toUpperCase() : '?'}</div>
                <div class="leaderboard-user-info">
                    <div class="leaderboard-user-name">${u.name}</div>
                    <div class="leaderboard-user-level">Daraja ${u.highestLevel}</div>
                </div>
                <div class="leaderboard-user-stats">
                    <div class="leaderboard-user-xp">${u.totalXP}</div>
                </div>
            `;
            list.appendChild(li);
            rank++;
        }

        if (!userRankFound && window.currentUser) {
            document.getElementById('user-rank').textContent = '-';
        }
    } catch (err) {
        console.error('loadLeaderboard error', err);
    }
}

// Attach click handler for the "Reyting" button to open modal and load leaderboard
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('level-info-btn');
    if (btn) btn.addEventListener('click', () => {
        const modal = document.getElementById('leaderboard-modal');
        if (modal) modal.style.display = 'flex';
        loadLeaderboard();
    });

    const modalClose = document.getElementById('leaderboard-modal-close');
    if (modalClose) modalClose.addEventListener('click', () => {
        const modal = document.getElementById('leaderboard-modal');
        if (modal) modal.style.display = 'none';
    });
});
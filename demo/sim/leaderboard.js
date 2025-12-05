// leaderboard.js
// Call loadLeaderboard() when opening the leaderboard modal.
// Requires a Firestore-like `db` and `currentUser` with uid property.
// If you're not using Firestore, adapt data loading accordingly.

async function loadLeaderboard() {
    try {
        const list = document.getElementById("leaderboard-list");
        list.innerHTML = '';

        // Example Firestore query (uncomment and adapt if using Firestore)
        // const snap = await db.collection("vietUsers").orderBy("totalXP","desc").get();

        // MOCK DATA fallback (if no db available) - remove when using real DB
        const mockUsers = [
            { id: 'u1', name: 'Ali', totalXP: 950, highestLevel: 5 },
            { id: 'u2', name: 'Vali', totalXP: 840, highestLevel: 4 },
            { id: 'u3', name: 'Sana', totalXP: 720, highestLevel: 4 }
        ];

        // Use mockUsers for now. Replace with real snapshot iteration below.
        let rank = 1;
        let userRankFound = false;

        // If using Firestore, replace this loop with: snap.forEach(doc => { const u = doc.data(); ... })
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
            // If current user not in first page, show user's rank area using provided data from server
            document.getElementById('user-rank').textContent = '-';
        }
    } catch (err) {
        console.error('loadLeaderboard error', err);
    }
}
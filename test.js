
const questions = [
  { q: "2 + 2 =", options: [2, 3, 4, 5], correct: 2 },
  { q: "5 * 3 =", options: [15, 10, 8, 20], correct: 0 }
];

window.onload = () => {
  const container = document.getElementById("questions");
  questions.forEach((item, index) => {
    const qBlock = document.createElement("div");
    qBlock.innerHTML = `<p>${item.q}</p>` + item.options.map((opt, i) =>
      `<label><input type='radio' name='q${index}' value='${i}'> ${opt}</label><br>`
    ).join('');
    container.appendChild(qBlock);
  });

  loadTopRanking();
};

function submitAnswers() {
  let score = 0;
  questions.forEach((item, i) => {
    const answer = document.querySelector(`input[name='q${i}']:checked`);
    if (answer && parseInt(answer.value) === item.correct) {
      score++;
    }
  });
  alert("To'g'ri javoblar: " + score + " ta");

  const user = auth.currentUser;
  if (user) {
    db.collection("results").add({
      uid: user.uid,
      score: score,
      timestamp: new Date()
    });

    db.collection("users").doc(user.uid).update({
      balance: firebase.firestore.FieldValue.increment(score)
    });
  }
}

// Reyting ro‘yxatini yuklash
function loadTopRanking() {
  const list = document.getElementById("rankingList");
  db.collection("users")
    .orderBy("balance", "desc")
    .limit(10)
    .get()
    .then(snapshot => {
      list.innerHTML = "";
      snapshot.forEach(doc => {
        const data = doc.data();
        const name = data.name || 'Noma'lum';
        const balance = data.balance || 0;
        const li = document.createElement("li");
        li.textContent = `${name}: ${balance} ball`;
        list.appendChild(li);
      });
    });
}

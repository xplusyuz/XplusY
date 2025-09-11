// js/simulator-csv.js — SPA-friendly simulator (init/destroy), keyboard + timer
let mounted = false;
let el = null;
let idx = 0;
let qList = [];
let answers = [];
let timer = null;
let endAt = 0;

const $ = (s, r = document) => r.querySelector(s);
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function genQuestion(level = "easy") {
  let A, B, op, correct;
  if (level === "hard") { A = randInt(10, 99); B = randInt(10, 99); op = choice(["+", "-", "×", "÷"]); }
  else if (level === "mid") { A = randInt(10, 60); B = randInt(2, 30); op = choice(["+", "-", "×"]); }
  else { A = randInt(1, 20); B = randInt(1, 10); op = choice(["+", "-"]); }

  switch (op) {
    case "+": correct = A + B; break;
    case "-": correct = A - B; break;
    case "×": correct = A * B; break;
    case "÷":
      correct = A; const mul = randInt(2, 9); B = mul; A = correct * B; correct = A / B; op = "÷";
      break;
  }
  const opts = new Set([correct]);
  while (opts.size < 4) {
    let delta = randInt(-9, 9);
    if (delta === 0) delta = 1;
    opts.add(correct + delta);
  }
  const order = shuffle(Array.from(opts));
  const correctKey = ["a", "b", "c", "d"][order.indexOf(correct)];
  return {
    text: `${A} ${op} ${B} = ?`,
    choices: { a: String(order[0]), b: String(order[1]), c: String(order[2]), d: String(order[3]) },
    correct: correctKey
  };
}

function buildRefs() {
  el = {
    root: document.getElementById("simulator-page"),
    level: $("#sim-level"),
    countIn: $("#sim-count"),
    timeIn: $("#sim-time"),
    start: $("#sim-start"),
    play: $("#sim-play"),
    countLb: $("#sim-count-label"),
    timer: $("#sim-timer"),
    qtext: $("#sim-qtext"),
    choices: $("#sim-choices"),
    prev: $("#sim-prev"),
    next: $("#sim-next"),
    finish: $("#sim-finish"),
    result: $("#sim-result"),
  };
}

function startGame() {
  const n = parseInt(el.countIn.value, 10);
  const level = el.level.value;
  const minutes = parseInt(el.timeIn.value, 10);

  qList = Array.from({ length: n }, () => genQuestion(level));
  answers = Array(n).fill(null);
  idx = 0;

  el.play.style.display = "";
  el.result.style.display = "none";

  endAt = Date.now() + minutes * 60 * 1000;
  runTimer();
  renderQuestion();
}

function renderQuestion() {
  const q = qList[idx];
  if (!q) return;
  el.countLb.textContent = `${idx + 1}/${qList.length}`;
  el.qtext.textContent = q.text;
  el.choices.innerHTML = "";

  ["a", "b", "c", "d"].forEach(k => {
    const wrap = document.createElement("label");
    wrap.className = "eh-choice";
    const input = document.createElement("input");
    input.type = "radio"; input.name = "sim-ans"; input.value = k;
    input.checked = answers[idx] === k;
    input.onchange = () => { answers[idx] = k; };
    const span = document.createElement("div"); span.textContent = q.choices[k];
    wrap.append(input, span); el.choices.append(wrap);
  });

  el.prev.disabled = idx === 0;
  el.next.disabled = idx === qList.length - 1;
}

function runTimer() {
  stopTimer();
  timer = setInterval(() => {
    const left = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
    const m = String(Math.floor(left / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    el.timer.textContent = `${m}:${s}`;
    if (left <= 0) finishGame();
  }, 250);
}
function stopTimer() { try { clearInterval(timer); } catch {} timer = null; }

function finishGame() {
  stopTimer();
  let ok = 0, bad = 0, empty = 0;
  qList.forEach((q, i) => {
    if (!answers[i]) empty++;
    else if (answers[i] === q.correct) ok++;
    else bad++;
  });

  el.result.style.display = "";
  el.play.style.display = "none";

  const n = qList.length;
  const pct = Math.round((ok / n) * 100);

  el.result.innerHTML = `
    <div class="res-center">
      <div class="res-card">
        <div class="ring" style="--p:${pct}">
          <div class="ring-hole"></div>
          <div class="ring-label">${ok}/${n}</div>
        </div>
        <div class="res-title">Simulyator natijasi</div>
        <div class="res-chips">
          <span class="chip ok">To‘g‘ri: ${ok}</span>
          <span class="chip bad">Xato: ${bad}</span>
          <span class="chip mute">Bo‘sh: ${empty}</span>
        </div>
        <div class="res-actions" style="margin-top:8px">
          <button class="eh-btn" id="sim-again">Qayta boshlash</button>
        </div>
      </div>
    </div>
  `;

  $("#sim-again", el.result).onclick = () => startGame();
}

function bindEvents() {
  el.start.onclick = () => startGame();
  el.prev.onclick  = () => { if (idx > 0) { idx--; renderQuestion(); } };
  el.next.onclick  = () => { if (idx < qList.length - 1) { idx++; renderQuestion(); } };
  el.finish.onclick= () => finishGame();

  // Keyboard shortcuts
  el._kbd = (e) => {
    if (el.play.style.display === "none") return;
    const map = { "1": "a", "2": "b", "3": "c", "4": "d", "a": "a", "b": "b", "c": "c", "d": "d",
                  "A": "a", "B": "b", "C": "c", "D": "d" };
    if (map[e.key]) {
      e.preventDefault();
      answers[idx] = map[e.key];
      renderQuestion();
      return;
    }
    if (e.key === "ArrowLeft") { e.preventDefault(); if (idx > 0) { idx--; renderQuestion(); } }
    if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); if (idx < qList.length - 1) { idx++; renderQuestion(); } }
    if (e.ctrlKey && e.key.toLowerCase() === "enter") { e.preventDefault(); finishGame(); }
  };
  window.addEventListener("keydown", el._kbd);
}

/* ===== PUBLIC ===== */
function init() {
  if (mounted) destroy();
  mounted = true;
  buildRefs();
  bindEvents();
}
function destroy() {
  mounted = false;
  stopTimer();
  try { window.removeEventListener("keydown", el?._kbd); } catch {}
  el = null;
}

export default { init, destroy };

/* 
  test.js
  - test.html (test yechish) va admintest.html (admin) uchun umumiy JS
  - Sahifani tanlash: <body data-page="runner"> yoki <body data-page="admin">
*/

document.addEventListener("DOMContentLoaded", () => {
  const pageType = document.body.getAttribute("data-page");
  if (pageType === "runner") {
    initTestRunner();
  } else if (pageType === "admin") {
    initAdmin();
  }
});

/* ===============================
   Kichik util funksiyalar
   =============================== */

function byId(id) {
  return document.getElementById(id);
}

function createEl(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v);
  });
  children.forEach((ch) => el.appendChild(ch));
  return el;
}

// Rasmlarni avtomatik topish: 1.jpg, 2.jpg, ... ketma-ket
// stopAfterFirstMiss — true bo'lsa, 1-marta yo'q bo'lganda to'xtaydi (agar hech bo'lmasa 1 ta topilgan bo'lsa)
function detectImagesSequential(maxCheck = 500, stopAfterFirstMiss = true) {
  return new Promise((resolve) => {
    let index = 1;
    let found = [];
    let misses = 0;

    function tryNext() {
      if (index > maxCheck) {
        return resolve(found);
      }
      const img = new Image();
      img.onload = () => {
        found.push(index);
        index++;
        misses = 0;
        tryNext();
      };
      img.onerror = () => {
        index++;
        misses++;
        if (stopAfterFirstMiss && found.length > 0) {
          return resolve(found);
        }
        if (!stopAfterFirstMiss && misses >= 3 && found.length > 0) {
          return resolve(found);
        }
        tryNext();
      };
      img.src = `${found.length === 0 ? "" : ""}${index}.jpg`;
    }

    tryNext();
  });
}

/* ===============================
   1) TEST RUNNER (test.html)
   =============================== */

function initTestRunner() {
  const state = {
    config: null,
    questions: [],
    sections: [],
    currentQuestionIndex: 0,
    answers: {}, // questionId -> {type, letters[] or text}
    timerSecondsLeft: 0,
    timerId: null,
  };

  const dom = {
    title: byId("testTitle"),
    timerDisplay: byId("timerDisplay"),
    timerLabel: byId("timerLabel"),
    progressBarInner: byId("progressBarInner"),
    progressMetaLeft: byId("progressMetaLeft"),
    progressMetaRight: byId("progressMetaRight"),
    sectionList: byId("sectionList"),
    qPills: byId("questionPills"),
    questionImage: byId("questionImage"),
    questionSectionLabel: byId("questionSectionLabel"),
    questionTypeLabel: byId("questionTypeLabel"),
    answersContainer: byId("answersContainer"),
    openAnswer: byId("openAnswer"),
    openAnswerWrap: byId("openAnswerWrap"),
    btnPrev: byId("btnPrev"),
    btnNext: byId("btnNext"),
    btnFinish: byId("btnFinish"),
    currentQuestionLabel: byId("currentQuestionLabel"),
    resultOverlay: byId("resultOverlay"),
    resultCloseBtn: byId("resultCloseBtn"),
    resultScore: byId("resultScore"),
    resultDetails: byId("resultDetails"),
  };

  // Config.json ni o'qish
  fetch("config.json?_=" + Date.now())
    .then((res) => {
      if (!res.ok) throw new Error("config.json topilmadi");
      return res.json();
    })
    .then((config) => {
      setupTestWithConfig(config, state, dom);
    })
    .catch((err) => {
      console.error(err);
      alert(
        "config.json topilmadi yoki xato. Iltimos, admintest orqali config.json ni yarating."
      );
    });

  dom.btnPrev.addEventListener("click", () => goToRelativeQuestion(-1, state, dom));
  dom.btnNext.addEventListener("click", () => goToRelativeQuestion(1, state, dom));
  dom.btnFinish.addEventListener("click", () => finishTest(state, dom));
  dom.resultCloseBtn.addEventListener("click", () => {
    dom.resultOverlay.style.display = "none";
  });
}

function setupTestWithConfig(config, state, dom) {
  state.config = config;
  state.questions = (config.questions || []).slice().sort((a, b) => a.id - b.id);

  if (!state.questions.length) {
    alert("config.json ichida 'questions' bo'sh. Admin panelda savollarni kiriting.");
    return;
  }

  // Title
  dom.title.textContent = config.title || "Test";

  // Timer
  const duration = Number(config.durationMinutes || 0);
  if (duration > 0) {
    state.timerSecondsLeft = duration * 60;
    dom.timerLabel.textContent = "Qolgan vaqt";
    startTimer(state, dom);
  } else {
    dom.timerLabel.textContent = "Vaqt cheklanmagan";
    dom.timerDisplay.textContent = "--:--";
  }

  // Sections: savollar ichidagi sectionName bo'yicha
  const sectionMap = {};
  state.questions.forEach((q) => {
    const s = q.sectionName || "Bo'limsiz";
    if (!sectionMap[s]) sectionMap[s] = [];
    sectionMap[s].push(q.id);
  });

  state.sections = Object.entries(sectionMap).map(([name, ids]) => ({
    name,
    ids,
  }));

  renderSections(state, dom);
  renderQuestionPills(state, dom);
  renderQuestion(state, dom);
  updateProgress(state, dom);
}

function startTimer(state, dom) {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.timerSecondsLeft--;
    if (state.timerSecondsLeft <= 0) {
      clearInterval(state.timerId);
      state.timerSecondsLeft = 0;
      dom.timerDisplay.textContent = "00:00";
      finishTest(state, dom, true);
      return;
    }
    const m = Math.floor(state.timerSecondsLeft / 60);
    const s = state.timerSecondsLeft % 60;
    dom.timerDisplay.textContent = `${String(m).padStart(2, "0")}:${String(
      s
    ).padStart(2, "0")}`;
  }, 1000);
}

function renderSections(state, dom) {
  dom.sectionList.innerHTML = "";
  state.sections.forEach((section, idx) => {
    const chip = createEl(
      "button",
      { class: "section-chip" + (idx === 0 ? " active" : ""), type: "button" },
      []
    );
    const left = createEl("div", { class: "section-chip-title", text: section.name });
    const right = createEl("div", { class: "section-chip-count", text: section.ids.length });
    chip.appendChild(left);
    chip.appendChild(right);
    chip.addEventListener("click", () => {
      [...dom.sectionList.children].forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      // birinchi savoli shu bo'limdagi eng kichik id bo'ladi
      const firstId = section.ids[0];
      const idxQ = state.questions.findIndex((q) => q.id === firstId);
      if (idxQ >= 0) {
        state.currentQuestionIndex = idxQ;
        renderQuestion(state, dom);
        renderQuestionPills(state, dom);
      }
    });
    dom.sectionList.appendChild(chip);
  });
}

function renderQuestionPills(state, dom) {
  dom.qPills.innerHTML = "";
  state.questions.forEach((q, idx) => {
    const pill = createEl(
      "button",
      {
        class:
          "q-pill" +
          (idx === state.currentQuestionIndex ? " current" : "") +
          (state.answers[q.id] ? " answered" : ""),
        type: "button",
      },
      []
    );
    pill.textContent = q.id;
    pill.addEventListener("click", () => {
      state.currentQuestionIndex = idx;
      renderQuestion(state, dom);
      renderQuestionPills(state, dom);
    });
    dom.qPills.appendChild(pill);
  });
}

function renderQuestion(state, dom) {
  const q = state.questions[state.currentQuestionIndex];
  if (!q) return;

  dom.currentQuestionLabel.textContent = `Savol ${q.id}/${state.questions.length}`;
  dom.questionImage.src = q.image || `${q.id}.jpg`;
  dom.questionImage.alt = `Savol ${q.id}`;

  dom.questionSectionLabel.textContent = q.sectionName || "Bo'limsiz";
  const typeText =
    q.type === "open"
      ? "Ochiq savol"
      : q.type === "multi"
      ? "Yopiq savol — ko‘p javob"
      : "Yopiq savol — bitta javob";
  dom.questionTypeLabel.textContent = typeText;

  dom.answersContainer.innerHTML = "";
  dom.openAnswerWrap.style.display = "none";

  const saved = state.answers[q.id];

  if (q.type === "open") {
    dom.openAnswerWrap.style.display = "block";
    dom.openAnswer.value = saved?.text || "";
    dom.openAnswer.oninput = () => {
      state.answers[q.id] = { type: "open", text: dom.openAnswer.value.trim() };
      updateProgress(state, dom);
      renderQuestionPills(state, dom);
    };
  } else {
    const variantCount = Number(q.variantCount || 4);
    const savedLetters = saved?.letters || [];

    for (let i = 0; i < variantCount; i++) {
      const letter = String.fromCharCode(65 + i); // A, B, C...
      const option = createEl(
        "label",
        {
          class:
            "answer-option" + (savedLetters.includes(letter) ? " selected" : ""),
        },
        []
      );
      const input = document.createElement("input");
      input.type = q.type === "multi" ? "checkbox" : "radio";
      input.name = "answer-" + q.id;
      input.value = letter;
      input.checked = savedLetters.includes(letter);

      const circle = createEl("div", { class: "answer-letter", text: letter }, []);
      const text = createEl("div", { class: "answer-text", text: `${letter} javob` }, []);

      option.appendChild(input);
      option.appendChild(circle);
      option.appendChild(text);

      option.addEventListener("click", (e) => {
        if (e.target.tagName === "INPUT") return;
        input.checked = !input.checked;
        if (input.type === "radio") {
          // radio: faqat bitta qoladi
          const others = dom.answersContainer.querySelectorAll("input");
          others.forEach((o) => {
            if (o !== input) {
              o.checked = false;
              o.closest(".answer-option").classList.remove("selected");
            }
          });
        }
        if (input.checked) option.classList.add("selected");
        else option.classList.remove("selected");

        const chosen = Array.from(
          dom.answersContainer.querySelectorAll("input:checked")
        ).map((i) => i.value);

        if (chosen.length) {
          state.answers[q.id] = { type: q.type, letters: chosen };
        } else {
          delete state.answers[q.id];
        }
        updateProgress(state, dom);
        renderQuestionPills(state, dom);
      });

      dom.answersContainer.appendChild(option);
    }
  }

  // Navigatsiya tugmalari holati
  dom.btnPrev.disabled = state.currentQuestionIndex === 0;
  dom.btnNext.disabled = state.currentQuestionIndex === state.questions.length - 1;
}

function goToRelativeQuestion(delta, state, dom) {
  const newIdx = state.currentQuestionIndex + delta;
  if (newIdx < 0 || newIdx >= state.questions.length) return;
  state.currentQuestionIndex = newIdx;
  renderQuestion(state, dom);
  renderQuestionPills(state, dom);
}

function updateProgress(state, dom) {
  const total = state.questions.length || 0;
  const answered = Object.values(state.answers).filter((a) => {
    if (!a) return false;
    if (a.type === "open") return (a.text || "").length > 0;
    return (a.letters || []).length > 0;
  }).length;

  const pct = total ? Math.round((answered / total) * 100) : 0;
  dom.progressBarInner.style.width = `${pct}%`;
  dom.progressMetaLeft.textContent = `${answered} / ${total} savol belgilangan`;
  dom.progressMetaRight.textContent = `${pct}%`;

  dom.btnFinish.disabled = total !== 0 && answered === 0;
}

function finishTest(state, dom, auto = false) {
  if (!auto) {
    const ok = confirm("Testni yakunlamoqchimisiz?");
    if (!ok) return;
  }

  // Timer to'xtatish
  if (state.timerId) clearInterval(state.timerId);

  const questions = state.questions;
  let totalPoints = 0;
  let earnedPoints = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let openCount = 0;

  questions.forEach((q) => {
    const points = Number(q.points || 1);
    totalPoints += points;
    if (q.type === "open") {
      // avtomatik baholanmaydi
      if (state.answers[q.id]?.text) {
        openCount++;
      }
      return;
    }

    const correctLetters = (q.correctLetters || []).map((x) => String(x).toUpperCase());
    if (!correctLetters.length) return;

    const given = (state.answers[q.id]?.letters || []).map((x) =>
      String(x).toUpperCase()
    );

    // to'liq moslik kerak: hamma to'g'ri va ortiqcha yo'q
    const isSameLength = correctLetters.length === given.length;
    const allIncluded = correctLetters.every((c) => given.includes(c));
    const isCorrect = isSameLength && allIncluded;

    if (isCorrect) {
      earnedPoints += points;
      correctCount++;
    } else if (given.length) {
      incorrectCount++;
    }
  });

  const scorePct = totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  dom.resultScore.textContent = `${scorePct}%`;
  dom.resultDetails.textContent = `To‘g‘ri: ${correctCount} ta, noto‘g‘ri: ${incorrectCount} ta, ochiq savollar: ${openCount} ta. Ball: ${earnedPoints}/${totalPoints}`;

  dom.resultOverlay.style.display = "flex";
}

/* ===============================
   2) ADMIN PANEL (admintest.html)
   =============================== */

function initAdmin() {
  const state = {
    questions: [],
    config: {
      title: "",
      durationMinutes: 0,
      questions: [],
    },
  };

  const dom = {
    titleInput: byId("adminTitle"),
    durationInput: byId("adminDuration"),
    scanBtn: byId("btnScanImages"),
    questionsWrap: byId("adminQuestionsWrap"),
    loadJsonInput: byId("adminLoadJsonInput"),
    loadJsonBtn: byId("btnLoadJson"),
    saveJsonBtn: byId("btnSaveJson"),
  };

  dom.scanBtn.addEventListener("click", async () => {
    dom.scanBtn.disabled = true;
    dom.scanBtn.textContent = "Skanerlanmoqda...";
    const indices = await detectImagesSequential(500, true);
    dom.scanBtn.disabled = false;
    dom.scanBtn.textContent = "1.jpg, 2.jpg, ... rasmlarni topish";

    if (!indices.length) {
      alert("Bu papkada 1.jpg, 2.jpg, ... ko‘rinishida rasm topilmadi.");
      return;
    }

    state.questions = indices.map((id) => {
      const existing = state.config.questions?.find((q) => q.id === id);
      return (
        existing || {
          id,
          image: `${id}.jpg`,
          type: "single",
          variantCount: 4,
          correctLetters: [],
          sectionName: "",
          points: 1,
        }
      );
    });

    state.config.questions = state.questions;
    renderAdminQuestions(state, dom);
  });

  dom.loadJsonBtn.addEventListener("click", () => {
    dom.loadJsonInput.click();
  });

  dom.loadJsonInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        state.config = parsed;
        dom.titleInput.value = parsed.title || "";
        dom.durationInput.value = parsed.durationMinutes || "";
        state.questions = (parsed.questions || []).slice().sort((a, b) => a.id - b.id);
        renderAdminQuestions(state, dom);
        alert("config.json muvaffaqiyatli yuklandi.");
      } catch (err) {
        console.error(err);
        alert("JSON format xato.");
      }
    };
    reader.readAsText(file, "utf-8");
  });

  dom.saveJsonBtn.addEventListener("click", () => {
    // inputlardan yangi qiymatlarni state.config ga yozamiz
    state.config.title = dom.titleInput.value.trim() || "Test";
    state.config.durationMinutes = Number(dom.durationInput.value || 0);
    state.config.questions = state.questions;

    const jsonStr = JSON.stringify(state.config, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Agar papkada allaqachon config.json bo'lsa, uni avtomatik o'qishga urinib ko'ramiz
  fetch("config.json?_=" + Date.now())
    .then((r) => (r.ok ? r.json() : null))
    .then((cfg) => {
      if (!cfg) return;
      state.config = cfg;
      state.questions = (cfg.questions || []).slice().sort((a, b) => a.id - b.id);
      dom.titleInput.value = cfg.title || "";
      dom.durationInput.value = cfg.durationMinutes || "";
      renderAdminQuestions(state, dom);
    })
    .catch(() => {});
}

function renderAdminQuestions(state, dom) {
  dom.questionsWrap.innerHTML = "";

  if (!state.questions.length) {
    dom.questionsWrap.innerHTML =
      "<div class='admin-help'>Rasmlarni skan qilish uchun yuqoridagi tugmani bosing.</div>";
    return;
  }

  state.questions.forEach((q) => {
    const row = createEl(
      "div",
      { class: "admin-q-row", "data-id": String(q.id) },
      []
    );

    const idCol = createEl("div", { class: "admin-q-id", text: q.id }, []);
    const imgCol = createEl("div", {}, []);
    const img = createEl("img", { src: q.image || `${q.id}.jpg`, alt: "q" }, []);
    imgCol.appendChild(img);

    // Section name input
    const sectionInput = createEl(
      "input",
      { class: "input", value: q.sectionName || "", placeholder: "Bo‘lim" },
      []
    );

    sectionInput.addEventListener("input", () => {
      q.sectionName = sectionInput.value.trim();
    });

    // Type select
    const typeSelect = createEl(
      "select",
      { class: "select" },
      []
    );
    [
      { value: "single", label: "Yopiq (1 javob)" },
      { value: "multi", label: "Yopiq (ko‘p javob)" },
      { value: "open", label: "Ochiq savol" },
    ].forEach((opt) => {
      const o = createEl("option", { value: opt.value, text: opt.label }, []);
      if (q.type === opt.value) o.selected = true;
      typeSelect.appendChild(o);
    });

    // Variant count input
    const varInput = createEl(
      "input",
      {
        class: "input",
        type: "number",
        min: "1",
        max: "8",
        value: String(q.variantCount || 4),
      },
      []
    );

    // Correct letters input (ACD kabi)
    const corrInput = createEl(
      "input",
      {
        class: "input",
        value: (q.correctLetters || []).join(""),
        placeholder: "To‘g‘ri javob (masalan: AC)",
      },
      []
    );

    // Points
    const pointsInput = createEl(
      "input",
      {
        class: "input",
        type: "number",
        min: "0",
        value: String(q.points || 1),
      },
      []
    );

    typeSelect.addEventListener("change", () => {
      q.type = typeSelect.value;
      const isOpen = q.type === "open";
      varInput.disabled = isOpen;
      corrInput.disabled = isOpen;
      if (isOpen) {
        q.correctLetters = [];
      }
    });

    varInput.addEventListener("input", () => {
      let v = Number(varInput.value || 4);
      if (v < 1) v = 1;
      if (v > 8) v = 8;
      q.variantCount = v;
      varInput.value = String(v);
    });

    corrInput.addEventListener("input", () => {
      const raw = corrInput.value
        .toUpperCase()
        .replace(/[^A-Z]/g, "");
      const arr = Array.from(new Set(raw.split("")));
      q.correctLetters = arr;
      corrInput.value = arr.join("");
    });

    pointsInput.addEventListener("input", () => {
      const v = Number(pointsInput.value || 0);
      q.points = v;
    });

    row.appendChild(idCol);
    row.appendChild(imgCol);
    row.appendChild(sectionInput);
    row.appendChild(typeSelect);
    row.appendChild(varInput);
    row.appendChild(corrInput);
    row.appendChild(pointsInput);

    dom.questionsWrap.appendChild(row);
  });

  const help = createEl(
    "div",
    {
      class: "admin-help",
      text:
        "• Ochiq savollar uchun to‘g‘ri javob yozilmaydi (keyin qo‘lda tekshiriladi). • Yopiq savollar uchun to‘g‘ri javoblarni harf ko‘rinishida yozing: A, B, AC, BCD va hokazo.",
    },
    []
  );
  dom.questionsWrap.appendChild(help);
}

// ==================== RESULT MANAGER (API-based) ====================
// Compatibility: the app calls `firebaseManager.saveTestResult(results)`.
// This implementation uses server API only (no Firebase client writes).
//
// ✅ Fixes in this version:
// 1) pointsDelta endi 100 ga bo‘linmaydi (ball => points)
// 2) OPEN mode: points faqat BIRINCHI marta qo‘shiladi (localStorage lock)
// 3) Telegram notify: /.netlify/functions/notify-open ga to‘g‘ri formatda yuboradi
//    va real javob (ok:true) bo‘lsa telegramSent=true bo‘ladi

(function () {
  function getToken() {
    try {
      return localStorage.getItem("lm_token") || "";
    } catch (_) {
      return "";
    }
  }

  function getApiCandidates() {
    let stored = "";
    try {
      stored = localStorage.getItem("lm_api_base") || "";
    } catch (_) {}
    const c = [];
    if (stored) c.push(stored);
    c.push("/.netlify/functions/api");
    c.push("/api");
    return [...new Set(c)];
  }

  async function apiFetch(path, { method = "GET", body = null, token = "" } = {}) {
    const candidates = getApiCandidates();
    let lastErr = null;

    const p = String(path || "").startsWith("/") ? String(path || "") : "/" + String(path || "");

    for (const base of candidates) {
      try {
        const u = new URL(base, location.origin);
        u.searchParams.set("path", p);

        const headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = "Bearer " + token;

        const res = await fetch(u.toString(), {
          method,
          headers,
          body: body ? JSON.stringify(body) : null,
        });

        const ct = (res.headers.get("content-type") || "").toLowerCase();
        const data = ct.includes("application/json")
          ? await res.json().catch(() => ({}))
          : { raw: await res.text().catch(() => "") };

        if (!res.ok) {
          const err = new Error(data?.error || data?.message || "HTTP " + res.status);
          err.status = res.status;
          err.data = data;
          throw err;
        }

        try {
          localStorage.setItem("lm_api_base", base);
        } catch (_) {}
        return data;
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("API error");
  }

  function buildAnswersForApi(test) {
    const qs = Array.isArray(test?.questions) ? test.questions : [];
    const out = new Array(qs.length).fill("");

    for (let i = 0; i < qs.length; i++) {
      const q = qs[i] || {};
      const ua = window.appState && Array.isArray(appState.userAnswers) ? appState.userAnswers[i] : undefined;

      // OPEN
      if (String(q.type || "").toLowerCase() === "open") {
        out[i] = ua == null ? "" : String(ua);
        continue;
      }

      // MCQ/VARIANT
      if (typeof ua === "number") {
        const shuffled = window.appState && appState.shuffledOptionsMap ? appState.shuffledOptionsMap[i] : null;
        const opts = Array.isArray(shuffled) && shuffled.length ? shuffled : Array.isArray(q.options) ? q.options : [];
        out[i] = opts[ua] == null ? "" : String(opts[ua]);
      } else {
        out[i] = ua == null ? "" : String(ua);
      }
    }

    return out;
  }

  // ✅ ENDI 100 GA BO‘LINMAYDI: ball qancha bo‘lsa, shuncha points
  function safePointsDeltaFromFinalScore(finalScore) {
    const fs = Number(finalScore);
    if (!Number.isFinite(fs) || fs <= 0) return 0;
    return Math.floor(fs); // 7.9 -> 7, 12 -> 12
  }

  // ✅ foydalanuvchini barqaror aniqlash (OPEN once lock uchun)
  function getUserKey() {
    const a = window.appState || {};
    const uid =
      a?.currentUser?.uid ||
      a?.user?.uid ||
      a?.auth?.uid ||
      a?.profile?.uid ||
      a?.me?.uid;

    if (uid) return String(uid);

    const numeric =
      a?.currentUser?.numericId ||
      a?.user?.numericId ||
      a?.profile?.numericId ||
      a?.me?.numericId;

    if (numeric != null && numeric !== "") return "num_" + String(numeric);

    const t = getToken();
    if (t) return "t_" + String(t).slice(0, 16);

    return "anon";
  }

  // ✅ OPEN mode: faqat birinchi marta points qo‘shish lock
  function openOnceKey(testCode) {
    return `lm_open_points_once__${String(testCode || "local")}__${getUserKey()}`;
  }
  function hasOpenOnce(testCode) {
    try {
      return !!localStorage.getItem(openOnceKey(testCode));
    } catch (_) {
      return false;
    }
  }
  function markOpenOnce(testCode) {
    try {
      localStorage.setItem(openOnceKey(testCode), new Date().toISOString());
    } catch (_) {}
  }

  // ✅ Telegram notify (notify-open.js bilan mos)
  function buildTelegramPayload({ test, results }) {
    const testId = String(test?.id || test?.docId || test?.code || "").trim();
    const testCode = String(test?.code || testId || "").trim();
    const title = String(test?.title || test?.name || testCode || "Test").trim();

    const timeSpentSec = Number(window.appState?.timeSpent || 0) || 0;

    return {
      testCode,
      testTitle: title,
      uid: getUserKey(),
      correct: Number(results?.correctCount || 0) || 0,
      wrong: Number(results?.wrongCount || 0) || 0,
      score: Number(results?.finalScore || 0) || 0,
      time: timeSpentSec,
    };
  }

  async function notifyTelegramOpen({ token, payload }) {
    const endpoint =
      window.CONFIG && CONFIG.telegramEndpoint
        ? String(CONFIG.telegramEndpoint)
        : "/.netlify/functions/notify-open";

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = "Bearer " + token;

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload || {}),
      });

      const data = await res.json().catch(() => ({}));
      return !!(res.ok && data && data.ok === true);
    } catch (_) {
      return false;
    }
  }

  window.firebaseManager = {
    _initDone: false,

    async initialize() {
      this._initDone = true;
      return true;
    },

    async saveTestResult(results) {
      let telegramSent = false;

      try {
        await this.initialize();

        const test = window.appState?.testData || {};
        const testId = String(test?.id || test?.docId || test?.code || "").trim();
        const testCode = String(test?.code || testId || "").trim();
        const mode =
          String(test?.mode || "open").toLowerCase() === "challenge" ? "challenge" : "open";

        const token = getToken();

        // 🔔 OPEN mode tugaganda Telegramga yuborish (CONFIG.telegramNotifyOpen=true bo‘lsa)
        if (mode === "open" && window.CONFIG && CONFIG.telegramNotifyOpen) {
          const payload = buildTelegramPayload({ test, results });
          telegramSent = await notifyTelegramOpen({ token, payload });
        }

        // Token yo'q bo‘lsa — points yozolmaymiz, lekin telegram holatini qaytaramiz
        if (!token) {
          return {
            ok: false,
            mode,
            pointsDelta: 0,
            pointsAdded: false,
            telegramSent,
            reason: "no_token",
          };
        }

        // 1) Firestore-backed testlar: /tests/submit
        if (testId) {
          try {
            const answers = buildAnswersForApi(test);
            const timeSpentSec = Number(window.appState?.timeSpent || 0) || 0;

            const resp = await apiFetch("/tests/submit", {
              method: "POST",
              token,
              body: { id: testId, answers, timeSpentSec },
            });

            const score = Number(resp?.result?.score || 0) || 0;

            return {
              ok: true,
              mode,
              pointsDelta: mode === "challenge" ? score : 0,
              pointsAdded: mode === "challenge" ? score > 0 : false,
              telegramSent,
              reason: "submitted_via_api",
            };
          } catch (e) {
            // test topilmasa fallbackga tushadi
            const msg = String(e?.message || "");
            const st = Number(e?.status || 0) || 0;
            if (!(st === 404 || msg.toLowerCase().includes("topilmadi"))) {
              throw e;
            }
          }
        }

        // 2) Local JSON testlar fallback: /games/submit
        // ✅ OPEN mode: faqat BIRINCHI marta points qo‘shilsin
        if (mode === "open" && hasOpenOnce(testCode || "local")) {
          return {
            ok: true,
            mode,
            pointsDelta: 0,
            pointsAdded: false,
            telegramSent,
            reason: "open_already_added",
          };
        }

        const pointsDelta = safePointsDeltaFromFinalScore(results?.finalScore);
        if (pointsDelta <= 0) {
          return { ok: true, mode, pointsDelta: 0, pointsAdded: false, telegramSent, reason: "no_points" };
        }

        await apiFetch("/games/submit", {
          method: "POST",
          token,
          body: {
            gameId: "test_" + (testCode || "local"),
            xp: Math.floor(Number(results?.finalScore || 0) || 0),
            pointsDelta, // ✅ endi 100 ga bo‘linmaydi
          },
        });

        // ✅ OPEN mode: muvaffaqiyatli yozilgandan keyin lock qo‘yamiz
        if (mode === "open") {
          markOpenOnce(testCode || "local");
        }

        return { ok: true, mode, pointsDelta, pointsAdded: true, telegramSent, reason: "local_test_points" };
      } catch (e) {
        console.error("saveTestResult error:", e);
        return { ok: false, mode: "challenge", pointsDelta: 0, pointsAdded: false, telegramSent: false, reason: "error" };
      }
    },
  };
})();

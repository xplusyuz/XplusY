// ==================== RESULT MANAGER (API-based) ====================
// Compatibility: the app calls `firebaseManager.saveTestResult(results)`.
// This implementation uses server API only (no Firebase client writes).
// Telegram integratsiya YO'Q.

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

      if (String(q.type || "").toLowerCase() === "open") {
        out[i] = ua == null ? "" : String(ua);
        continue;
      }

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

  // ball qancha bo'lsa, shuncha points (0 dan kichik bo'lmaydi)
  function safePointsDeltaFromFinalScore(finalScore) {
    const fs = Number(finalScore);
    if (!Number.isFinite(fs) || fs <= 0) return 0;
    return Math.floor(fs);
  }

  // OPEN mode: faqat birinchi marta points qo'shish lock
  function getUserKey() {
    const a = window.appState || {};
    const uid = a?.currentUser?.uid || a?.user?.uid || a?.auth?.uid || a?.profile?.uid || a?.me?.uid;
    if (uid) return String(uid);

    const numeric = a?.currentUser?.numericId || a?.user?.numericId || a?.profile?.numericId || a?.me?.numericId;
    if (numeric != null && numeric !== "") return "num_" + String(numeric);

    const t = getToken();
    if (t) return "t_" + String(t).slice(0, 16);

    return "anon";
  }

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

  window.firebaseManager = {
    _initDone: false,

    async initialize() {
      this._initDone = true;
      return true;
    },

    async saveTestResult(results) {
      try {
        await this.initialize();

        const test = window.appState?.testData || {};
        const testId = String(test?.id || test?.docId || test?.code || "").trim();
        const testCode = String(test?.code || window.appState?.currentTestCode || testId || "local").trim();
        const title = String(test?.title || test?.name || testCode || "Test").trim();
        const mode = String(test?.mode || "open").toLowerCase() === "challenge" ? "challenge" : "open";

        const token = getToken();
        if (!token) {
          return { ok: false, mode, pointsDelta: 0, pointsAdded: false, reason: "no_token" };
        }

        const timeSpentSec = Number(window.appState?.timeSpent || 0) || 0;
        const score = Math.floor(Number(results?.finalScore || 0) || 0);

        // 1) Har doim natijani test_codes/{testCode}/... ga yozamiz
        await apiFetch("/results/submit", {
          method: "POST",
          token,
          body: {
            testCode,
            testTitle: title,
            mode,
            score,
            correct: Number(results?.correctCount || 0) || 0,
            wrong: Number(results?.wrongCount || 0) || 0,
            timeSpentSec,
            penalty: Number(results?.penaltyPoints || 0) || 0,
            violations: window.appState?.violations || null,
            answers: buildAnswersForApi(test),
          },
        });

        // 2) Points yozish (agar sizda /games/submit ishlasa)
        let pointsDelta = safePointsDeltaFromFinalScore(results?.finalScore);

        if (mode === "open") {
          if (hasOpenOnce(testCode)) pointsDelta = 0;
        }

        if (pointsDelta > 0) {
          await apiFetch("/games/submit", {
            method: "POST",
            token,
            body: {
              gameId: "test_" + testCode,
              xp: score,
              pointsDelta,
            },
          });

          if (mode === "open") markOpenOnce(testCode);

          return { ok: true, mode, pointsDelta, pointsAdded: true, reason: "saved" };
        }

        return { ok: true, mode, pointsDelta: 0, pointsAdded: false, reason: "saved_no_points" };
      } catch (e) {
        console.error("saveTestResult error:", e);
        return { ok: false, mode: "open", pointsDelta: 0, pointsAdded: false, reason: "error", error: String(e?.message || e) };
      }
    },
  };
})();

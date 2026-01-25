// ==================== RESULT MANAGER (Professional) ====================
// The app calls `firebaseManager.saveTestResult(results)`.
// This implementation:
// 1) Sends per-testCode results to Firestore via server API: /results/submit
//    -> writes to: test_codes/{testCode}/results/{uid}  (latest)
//    -> and:       test_codes/{testCode}/attempts/{autoId} (history)
// 2) Telegram is removed completely.
// 3) Points are optional:
//    - Challenge mode: pointsDelta = score (returned by /tests/submit if used)
//    - Open mode: points are NOT added by default (safer).
//
// If you want open-mode points, enable it from CONFIG.enableOpenPoints = true.

(function () {
  function getToken() {
    try { return localStorage.getItem("lm_token") || ""; } catch (_) { return ""; }
  }

  function getApiCandidates() {
    let stored = "";
    try { stored = localStorage.getItem("lm_api_base") || ""; } catch (_) {}
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
          const err = new Error(data?.error || data?.message || ("HTTP " + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }

        try { localStorage.setItem("lm_api_base", base); } catch (_) {}
        return data;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("API error");
  }

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
        const opts = Array.isArray(shuffled) && shuffled.length ? shuffled : (Array.isArray(q.options) ? q.options : []);
        out[i] = opts[ua] == null ? "" : String(opts[ua]);
      } else {
        out[i] = ua == null ? "" : String(ua);
      }
    }
    return out;
  }

  function getTestMeta() {
    const test = window.appState?.testData || {};
    const testId = String(test?.id || test?.docId || test?.code || "").trim();
    const testCode = String(test?.code || testId || window.appState?.currentTestCode || "").trim();
    const title = String(test?.title || test?.name || testCode || "Test").trim();
    const mode = String(test?.mode || "open").toLowerCase() === "challenge" ? "challenge" : "open";
    return { test, testId, testCode, title, mode };
  }

  async function submitPerTestCode({ token, testCode, title, mode, results, test }) {
    if (!token || !testCode) return { ok: false, reason: "no_token_or_testCode" };

    const timeSpentSec = Number(window.appState?.timeSpent || 0) || 0;
    const payload = {
      testCode,
      testTitle: title,
      mode,
      score: Number(results?.finalScore || 0) || 0,
      correct: Number(results?.correctCount || 0) || 0,
      wrong: Number(results?.wrongCount || 0) || 0,
      timeSpentSec,
      penalty: Number(results?.penaltyPoints || 0) || 0,
      violations: window.appState?.violations || null,
      // optional:
      answers: buildAnswersForApi(test),
      uidHint: getUserKey(),
    };

    const resp = await apiFetch("/results/submit", { method: "POST", token, body: payload });
    return resp || { ok: true };
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

        const { test, testId, testCode, title, mode } = getTestMeta();
        const token = getToken();

        // 1) Always try to write per-testCode result history (professional requirement)
        let perResp = null;
        try {
          perResp = await submitPerTestCode({ token, testCode, title, mode, results, test });
        } catch (e) {
          console.warn("Per-testCode submit failed:", e);
          perResp = { ok: false, reason: "results_submit_failed", error: String(e?.message || e) };
        }

        // 2) If Firestore-backed test exists, submit to /tests/submit (challenge scoring)
        // This part is optional and depends on your existing backend.
        let pointsDelta = 0;
        let pointsAdded = false;

        if (token && testId) {
          try {
            const answers = buildAnswersForApi(test);
            const timeSpentSec = Number(window.appState?.timeSpent || 0) || 0;

            const resp = await apiFetch("/tests/submit", {
              method: "POST",
              token,
              body: { id: testId, answers, timeSpentSec },
            });

            const score = Number(resp?.result?.score || 0) || 0;

            if (mode === "challenge") {
              pointsDelta = score;
              pointsAdded = score > 0;
            } else if (window.CONFIG && CONFIG.enableOpenPoints) {
              // optional
              pointsDelta = score;
              pointsAdded = score > 0;
            }
          } catch (e) {
            // ignore if endpoint not present
          }
        }

        return {
          ok: true,
          mode,
          pointsDelta,
          pointsAdded,
          savedToTestCode: !!(perResp && perResp.ok !== false),
          reason: "saved_professional",
          perResp,
        };
      } catch (e) {
        console.error("saveTestResult error:", e);
        return {
          ok: false,
          mode: "open",
          pointsDelta: 0,
          pointsAdded: false,
          savedToTestCode: false,
          reason: "error",
          error: String(e?.message || e),
        };
      }
    },
  };
})();

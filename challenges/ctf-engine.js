/* SOC CTF Lab v3 — shared engine (UTF-8) */
(function (global) {
  const STORAGE_NS = "soc_ctf_v3_";
  const HINT_COST = 5;
  const POINTS = 20;
  const WRONG_COST = 3;

  function initCTF(cfg) {
    if (!document.querySelector('link[href*="font-awesome"]')) {
      const fa = document.createElement("link");
      fa.rel = "stylesheet";
      fa.href =
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css";
      document.head.appendChild(fa);
    }
    const taskCount = cfg.taskCount || 5;
    const $ = (id) => document.getElementById(id);
    const state = {
      score: 0,
      tasks: {},
      hintsUsed: 0,
      taskHints: {},
      wrongAttempts: {},
    };
    const storageKey = STORAGE_NS + cfg.id;
    const progressKey = STORAGE_NS + "progress";

    function allTasksCorrect() {
      for (let i = 1; i <= taskCount; i++) {
        if (state.tasks[i] !== "ok") return false;
      }
      return true;
    }

    function load() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);
        state.score = data.score || 0;
        state.tasks = data.tasks || {};
        state.hintsUsed = data.hintsUsed || 0;
        state.taskHints = data.taskHints || {};
        state.wrongAttempts = data.wrongAttempts || {};
      } catch (e) {}
    }

    function saveProgress() {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          score: state.score,
          tasks: state.tasks,
          hintsUsed: state.hintsUsed,
          taskHints: state.taskHints,
          wrongAttempts: state.wrongAttempts,
        })
      );
      const all = JSON.parse(localStorage.getItem(progressKey) || "{}");
      if (allTasksCorrect()) {
        all[cfg.id] = {
          done: true,
          flag: cfg.flag,
          score: state.score,
          at: Date.now(),
        };
      } else if (all[cfg.id]) {
        delete all[cfg.id];
      }
      localStorage.setItem(progressKey, JSON.stringify(all));
    }

    function showCongrats() {
      let modal = $("ctfCongrats");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "ctfCongrats";
        modal.className = "ctf-congrats";
        modal.innerHTML =
          '<div class="ctf-congrats-box">' +
          '<div class="ctf-congrats-icon"><i class="fa fa-trophy"></i></div>' +
          "<h2>Challenge Cleared!</h2>" +
          '<p class="ctf-congrats-msg">All investigation tasks completed.</p>' +
          '<p class="ctf-congrats-score">Final score: <strong id="ctfCongratsScore">0</strong>/100</p>' +
          '<p class="ctf-congrats-flag" id="ctfCongratsFlag"></p>' +
          '<button type="button" class="ctf-congrats-close" id="ctfCongratsClose">Continue</button>' +
          "</div>";
        document.body.appendChild(modal);
        $("ctfCongratsClose").onclick = () => modal.classList.remove("show");
        modal.onclick = (e) => {
          if (e.target === modal) modal.classList.remove("show");
        };
      }
      const scoreEl = $("ctfCongratsScore");
      if (scoreEl) scoreEl.textContent = state.score;
      const flagEl = $("ctfCongratsFlag");
      if (flagEl) flagEl.textContent = cfg.flag || "";
      modal.classList.add("show");
    }

    function updateUI() {
      const scoreEl = $("score");
      if (scoreEl) scoreEl.textContent = state.score;
      const bar = $("bar");
      if (bar) bar.style.width = state.score + "%";
      const flag = $("flag");
      if (flag) flag.classList.toggle("show", allTasksCorrect());
      const sub = $("scoreSub");
      if (sub) {
        sub.textContent = allTasksCorrect()
          ? "All tasks complete" +
            (state.score < 100 ? " (hints/wrong answers reduced score)" : "")
          : "";
      }
      if (allTasksCorrect() && !state._congratsShown) {
        const congratsKey = STORAGE_NS + "congrats_" + cfg.id;
        if (!sessionStorage.getItem(congratsKey)) {
          state._congratsShown = true;
          sessionStorage.setItem(congratsKey, "1");
          showCongrats();
        }
      }
    }

    function cardHasAnswer(feedbackId) {
      const fb = $(feedbackId);
      if (!fb) return false;
      const card = fb.closest(".card") || fb.closest(".task-card");
      if (!card) return true;
      const fields = card.querySelectorAll("input, select, textarea");
      const radioNames = new Set();
      let radioAnswered = false;
      for (const f of fields) {
        if (f.type === "radio") {
          radioNames.add(f.name);
          continue;
        }
        if (f.type === "checkbox" && f.checked) return true;
        if (f.tagName === "SELECT" && f.value.trim()) return true;
        if (
          (f.type === "text" || f.type === "number" || f.type === "password") &&
          f.value.trim()
        )
          return true;
      }
      for (const name of radioNames) {
        if (card.querySelector('input[name="' + name + '"]:checked'))
          radioAnswered = true;
      }
      return radioAnswered || false;
    }

    function check(taskNum, isCorrect, feedbackId) {
      const fb = $(feedbackId);
      if (!fb) return;
      if (!cardHasAnswer(feedbackId)) {
        fb.className = "fb bad";
        fb.textContent = "Enter or select an answer before checking.";
        return;
      }
      const prev = state.tasks[taskNum];
      if (isCorrect) {
        if (prev !== "ok") {
          state.tasks[taskNum] = "ok";
          state.score = Math.min(100, state.score + POINTS);
        }
        fb.className = "fb ok";
        fb.textContent = "Correct (+" + POINTS + ").";
        if (cfg.onCorrect) cfg.onCorrect(taskNum);
      } else {
        if (prev === "ok") {
          state.tasks[taskNum] = "wrong";
          state.score = Math.max(0, state.score - POINTS);
          fb.className = "fb bad";
          fb.textContent =
            "Wrong — previous points for this task removed (-" + POINTS + ").";
        } else {
          state.tasks[taskNum] = "wrong";
          state.wrongAttempts[taskNum] = (state.wrongAttempts[taskNum] || 0) + 1;
          state.score = Math.max(0, state.score - WRONG_COST);
          fb.className = "fb bad";
          fb.textContent =
            "Incorrect (-" +
            WRONG_COST +
            "). Review the evidence or use Hint (-" +
            HINT_COST +
            " pts, once per task).";
        }
      }
      updateUI();
      saveProgress();
    }

    function hint(taskNum, hintText, hintElId) {
      const el = $(hintElId || "hint-" + taskNum);
      if (!el) return;
      if (state.taskHints[taskNum]) {
        el.textContent =
          "Hint already used for this task (points were permanently deducted).";
        return;
      }
      if (state.score < HINT_COST) {
        el.textContent =
          "Hints cost " +
          HINT_COST +
          " points. Complete any task first so your score is at least " +
          HINT_COST +
          ".";
        return;
      }
      state.score = Math.max(0, state.score - HINT_COST);
      state.hintsUsed++;
      state.taskHints[taskNum] = true;
      el.textContent = "Hint: " + hintText;
      updateUI();
      saveProgress();
    }

    function reset() {
      state.score = 0;
      state.tasks = {};
      state.hintsUsed = 0;
      state.taskHints = {};
      state.wrongAttempts = {};
      state._congratsShown = false;
      sessionStorage.removeItem(STORAGE_NS + "congrats_" + cfg.id);
      document.querySelectorAll(".fb").forEach((e) => {
        e.className = "fb";
        e.textContent = "";
      });
      document.querySelectorAll("[id^=hint-]").forEach((e) => (e.textContent = ""));
      const congrats = $("ctfCongrats");
      if (congrats) congrats.classList.remove("show");
      const root = document.querySelector("main") || document.body;
      root.querySelectorAll("input").forEach((i) => {
        if (i.type === "checkbox" || i.type === "radio") i.checked = false;
        else i.value = "";
      });
      root.querySelectorAll("select").forEach((s) => (s.selectedIndex = 0));
      const flag = $("flag");
      if (flag) flag.classList.remove("show");
      localStorage.removeItem(storageKey);
      const all = JSON.parse(localStorage.getItem(progressKey) || "{}");
      delete all[cfg.id];
      localStorage.setItem(progressKey, JSON.stringify(all));
      updateUI();
      if (cfg.onReset) cfg.onReset();
    }

    load();
    if (allTasksCorrect()) saveProgress();
    updateUI();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => window.scrollTo(0, 0));
    } else {
      window.scrollTo(0, 0);
    }

    return {
      check,
      hint,
      reset,
      getScore: () => state.score,
      allTasksCorrect,
      state,
    };
  }

  global.initCTF = initCTF;
  global.SOC_CTF_V3_NS = "soc_ctf_v3_";
})(window);

/* ============================================================
 * storage.js — local persistence (offline, no backend)
 * ============================================================ */
(function (global) {
  "use strict";

  const KEY = "shooter2048_save_v1";

  const DEFAULTS = {
    best: 0,
    coins: 0,
    highestExp: 1,
    scores: [],            // leaderboard (top scores)
    settings: { sound: true, music: false, shake: true },
    daily: { lastClaim: null, streak: 0 },
    milestones: {},        // claimed milestone exponents
    progress: null,        // saved in-progress game (board + score)
  };

  function deepMerge(base, over) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (over && typeof over === "object" && !Array.isArray(over)) {
      for (const k in over) {
        if (base && typeof base[k] === "object" && base[k] && !Array.isArray(base[k])) {
          out[k] = deepMerge(base[k], over[k]);
        } else {
          out[k] = over[k];
        }
      }
    }
    return out;
  }

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return deepMerge(DEFAULTS, {});
      return deepMerge(DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return deepMerge(DEFAULTS, {});
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* storage may be unavailable (private mode) — game still runs */
    }
  }

  const Storage = {
    get all() { return data; },
    get(key) { return data[key]; },
    set(key, value) { data[key] = value; save(); },

    getSetting(key) { return data.settings[key]; },
    setSetting(key, value) { data.settings[key] = value; save(); },

    addScore(score) {
      data.scores.push(score);
      data.scores.sort((a, b) => b - a);
      data.scores = data.scores.slice(0, 10);
      if (score > data.best) data.best = score;
      save();
    },

    saveProgress(progress) { data.progress = progress; save(); },
    clearProgress() { data.progress = null; save(); },

    reset() {
      data = deepMerge(DEFAULTS, {});
      save();
    },
  };

  global.Storage = Storage;
})(window);

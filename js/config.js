/* ============================================================
 * config.js — game constants, number progression, colors
 * Values are stored as EXPONENTS of 2:
 *   exp 1 = "2", exp 10 = "1K", exp 20 = "1M", exp 31 = "2048M", exp 32 = "∞"
 * ============================================================ */
(function (global) {
  "use strict";

  const INFINITY_EXP = 32; // highest tier = ∞

  /** Convert an exponent into its display label (2, 4, ... 1K ... 1M ... ∞). */
  function label(exp) {
    if (exp >= INFINITY_EXP) return "\u221E"; // ∞
    if (exp < 10) return String(1 << exp);          // 2 .. 512
    if (exp < 20) return (1 << (exp - 10)) + "K";    // 1K .. 512K
    return (1 << (exp - 20)) + "M";                  // 1M .. 2048M
  }

  /** Score awarded for forming a block of this exponent. Scales fast. */
  function mergeScore(exp) {
    return Math.round(Math.pow(2, exp) / 2) || 1;
  }

  /** Coins awarded for forming a block of this exponent. */
  function mergeCoins(exp) {
    if (exp <= 3) return 1;
    if (exp <= 6) return 3;
    if (exp <= 10) return 8;
    if (exp <= 14) return 20;
    if (exp <= 18) return 50;
    return 120; // huge merges
  }

  /* ---- Vibrant color per tier. Returns [topColor, bottomColor, glow]. ---- */
  const PALETTE = [
    null,                                  // exp 0 (unused)
    ["#7af0c8", "#33c896", "#33c896"],     // 2
    ["#9fe88a", "#5fc24a", "#5fc24a"],     // 4
    ["#ffe680", "#f5c531", "#f5c531"],     // 8
    ["#ffc46b", "#f59331", "#f59331"],     // 16
    ["#ff9a6b", "#f56331", "#f56331"],     // 32
    ["#ff6b8a", "#f53163", "#f53163"],     // 64
    ["#ff6bd0", "#e231b0", "#e231b0"],     // 128
    ["#d98bff", "#a531f5", "#a531f5"],     // 256
    ["#9b8bff", "#6331f5", "#6331f5"],     // 512
    ["#6ba8ff", "#3168f5", "#3168f5"],     // 1K
    ["#6bd6ff", "#31b6f5", "#31b6f5"],     // 2K
    ["#6bffe8", "#31f5d2", "#31f5d2"],     // 4K
    ["#7af0c8", "#1fd6a0", "#1fd6a0"],     // 8K
    ["#b6ff6b", "#7ef531", "#7ef531"],     // 16K
    ["#ffe066", "#ffb831", "#ffb831"],     // 32K
    ["#ff9d5c", "#ff6a31", "#ff6a31"],     // 64K
    ["#ff5c7a", "#ff3163", "#ff3163"],     // 128K
    ["#ff5cc4", "#ff31a8", "#ff31a8"],     // 256K
    ["#c45cff", "#9a31ff", "#9a31ff"],     // 512K
    ["#7d5cff", "#5a31ff", "#5a31ff"],     // 1M
    ["#5c8cff", "#3163ff", "#3163ff"],     // 2M
    ["#5cc4ff", "#319aff", "#319aff"],     // 4M
    ["#5cffe8", "#31ffd2", "#31ffd2"],     // 8M
    ["#9dff5c", "#6aff31", "#6aff31"],     // 16M
    ["#fff05c", "#ffe031", "#ffe031"],     // 32M
    ["#ffb05c", "#ff8c31", "#ff8c31"],     // 64M
    ["#ff7a5c", "#ff4f31", "#ff4f31"],     // 128M
    ["#ff5c9d", "#ff317e", "#ff317e"],     // 256M
    ["#e85cff", "#cf31ff", "#cf31ff"],     // 512M
    ["#a05cff", "#7e31ff", "#7e31ff"],     // 1024M
    ["#ff5cf0", "#ff31e0", "#ff31e0"],     // 2048M
    ["#ffffff", "#b9c6ff", "#8bb4ff"],     // ∞ (exp 32)
  ];

  function colors(exp) {
    if (exp >= PALETTE.length) return PALETTE[PALETTE.length - 1];
    return PALETTE[exp] || PALETTE[1];
  }

  /** Pick a spawn exponent given the current difficulty floor. */
  function spawnExp(minExp) {
    // base distribution relative to minExp: +0:70%, +1:20%, +2:8%, +3:2%
    const r = Math.random();
    let off;
    if (r < 0.70) off = 0;
    else if (r < 0.90) off = 1;
    else if (r < 0.98) off = 2;
    else off = 3;
    return Math.min(minExp + off, INFINITY_EXP - 1);
  }

  const CONFIG = {
    COLS: 5,
    ROWS: 7,             // grid rows (top-anchored). Reaching bottom = game over.
    INFINITY_EXP,
    // How many shots between a new descending row being pushed in.
    ROW_INTERVAL_START: 7,
    ROW_INTERVAL_MIN: 3,
    // Booster costs.
    BOOSTER_COST: { hammer: 200, bomb: 350, shuffle: 150, undo: 100 },
    BOMB_RADIUS: 1.5,
    // Daily reward amounts per day (7-day cycle).
    DAILY_REWARDS: [50, 75, 100, 150, 200, 300, 500],
    // Milestone rewards keyed by exponent of highest block reached.
    MILESTONES: { 7: 100, 9: 250, 11: 500, 14: 1000, 17: 2500, 20: 5000 },
    label,
    mergeScore,
    mergeCoins,
    colors,
    spawnExp,
  };

  global.CONFIG = CONFIG;
})(window);

/* ============================================================
 * ui.js — screen manager, HUD, popups, settings, leaderboard,
 *          daily rewards. All DOM interaction lives here.
 * ============================================================ */
(function (global) {
  "use strict";

  const C = CONFIG;
  const $ = (id) => document.getElementById(id);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const OVERLAYS = [
    "menuScreen", "pauseScreen", "settingsScreen",
    "gameOverScreen", "leaderboardScreen", "dailyScreen",
  ];

  let el = {};
  let toastTimer = null;

  const UI = {
    init() {
      el = {
        score: $("scoreValue"),
        best: $("bestValue"),
        coin: $("coinValue"),
        high: $("highBlock"),
        combo: $("comboVal"),
        menuBest: $("menuBest"),
        menuCoins: $("menuCoins"),
        menuHigh: $("menuHigh"),
        targetHint: $("targetHint"),
        toast: $("toast"),
      };
      this._bind();
      this._syncToggles();
      this.updateHUD();
    },

    /* ---------------- screens ---------------- */
    showScreen(name) {
      OVERLAYS.forEach((id) => $(id).classList.add("hidden"));
      if (name) $(name).classList.remove("hidden");
    },

    showGame() { this.showScreen(null); },

    showMenu() {
      el.menuBest.textContent = fmt(Storage.get("best"));
      el.menuCoins.textContent = fmt(Game.coins);
      el.menuHigh.textContent = C.label(Storage.get("highestExp") || 1);
      const playBtn = $("playBtn");
      playBtn.textContent = Game.hasSavedGame() ? "CONTINUE" : "PLAY";
      this.showScreen("menuScreen");
    },

    showGameOver(score, isBest, bonusCoins) {
      $("goScore").textContent = fmt(score);
      $("goBest").textContent = fmt(Storage.get("best"));
      $("goHigh").textContent = C.label(Storage.get("highestExp") || 1);
      $("goCoins").textContent = fmt(bonusCoins);
      $("newBestBadge").classList.toggle("hidden", !isBest);
      this.showScreen("gameOverScreen");
    },

    /* ---------------- HUD ---------------- */
    updateHUD() {
      el.score.textContent = fmt(Game.score);
      el.best.textContent = fmt(Storage.get("best"));
      el.coin.textContent = fmt(Game.coins);
      el.high.textContent = C.label(Storage.get("highestExp") || 1);
      el.combo.textContent = "x" + (Game.combo || 0);

      qsa(".booster").forEach((b) => {
        const type = b.dataset.booster;
        let disabled = !Boosters.canAfford(type);
        if (type === "undo" && !Game.snapshot) disabled = true;
        b.disabled = disabled && Game.armedBooster !== type;
      });
    },

    setBoosterArmed(type) {
      qsa(".booster").forEach((b) =>
        b.classList.toggle("armed", b.dataset.booster === type)
      );
      el.targetHint.classList.toggle("hidden", !type);
      if (type) el.targetHint.textContent = type === "bomb" ? "Tap to bomb" : "Tap a block";
    },

    toast(msg) {
      el.toast.textContent = msg;
      el.toast.classList.remove("hidden");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2200);
    },

    /* ---------------- leaderboard ---------------- */
    showLeaderboard() {
      const list = $("leaderboardList");
      const scores = Storage.get("scores") || [];
      list.innerHTML = "";
      if (!scores.length) {
        list.innerHTML = '<li><span class="rank">-</span>No scores yet. Play a round!</li>';
      } else {
        scores.forEach((s, i) => {
          const li = document.createElement("li");
          if (i === 0) li.className = "top";
          li.innerHTML =
            '<span class="rank">' + (i + 1) + '</span>' +
            '<span>Run ' + (i + 1) + '</span>' +
            '<span class="lb-score">' + fmt(s) + '</span>';
          list.appendChild(li);
        });
      }
      this.showScreen("leaderboardScreen");
    },

    /* ---------------- daily reward ---------------- */
    showDaily() {
      const daily = Storage.get("daily");
      const todayStr = new Date().toDateString();
      const dayIndex = this._dailyDayIndex();
      const claimedToday = daily.lastClaim === todayStr;

      const grid = $("dailyGrid");
      grid.innerHTML = "";
      C.DAILY_REWARDS.forEach((amt, i) => {
        const d = document.createElement("div");
        d.className = "daily-day";
        if (i < dayIndex || (i === dayIndex && claimedToday)) d.classList.add("claimed");
        else if (i === dayIndex && !claimedToday) d.classList.add("today");
        d.innerHTML = "Day " + (i + 1) + '<span class="dd-amt">' +
          '<span class="coin-icon">\u25CF</span>' + amt + "</span>";
        grid.appendChild(d);
      });

      const btn = $("dailyClaimBtn");
      btn.disabled = claimedToday;
      btn.textContent = claimedToday ? "Come back tomorrow" : "Claim Day " + (dayIndex + 1);
      this.showScreen("dailyScreen");
    },

    _dailyDayIndex() {
      const daily = Storage.get("daily");
      if (!daily.lastClaim) return 0;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (daily.lastClaim === today.toDateString()) {
        return Math.max(0, (daily.streak - 1) % 7);
      }
      if (daily.lastClaim === yesterday.toDateString()) {
        return daily.streak % 7;     // continue streak
      }
      return 0;                       // streak broken
    },

    _claimDaily() {
      const daily = Storage.get("daily");
      const todayStr = new Date().toDateString();
      if (daily.lastClaim === todayStr) return;
      const dayIndex = this._dailyDayIndex();
      const reward = C.DAILY_REWARDS[dayIndex];

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const continued = daily.lastClaim === yesterday.toDateString();

      daily.streak = continued ? daily.streak + 1 : 1;
      daily.lastClaim = todayStr;
      Storage.set("daily", daily);

      Game.addCoins(reward, true);
      Audio2048.reward();
      this.toast("Daily reward!  +" + reward + " coins");
      this.showDaily();
      this.updateHUD();
    },

    /* ---------------- settings / toggles ---------------- */
    _syncToggles() {
      qsa(".toggle").forEach((t) => {
        const key = t.dataset.key;
        t.classList.toggle("on", !!Storage.getSetting(key));
      });
    },

    _toggle(key) {
      const val = !Storage.getSetting(key);
      Storage.setSetting(key, val);
      qsa('.toggle[data-key="' + key + '"]').forEach((t) =>
        t.classList.toggle("on", val)
      );
      if (key === "music") {
        if (val) Audio2048.startMusic();
        else Audio2048.stopMusic();
      }
      Audio2048.click();
    },

    /* ---------------- event wiring ---------------- */
    _bind() {
      $("playBtn").onclick = () => { Audio2048.click(); Main.startGame(); };
      $("pauseBtn").onclick = () => Main.pause();
      $("resumeBtn").onclick = () => Main.resume();
      $("pauseRestartBtn").onclick = () => Main.restart();
      $("pauseMenuBtn").onclick = () => Main.toMenu();
      $("retryBtn").onclick = () => Main.restart();
      $("goMenuBtn").onclick = () => Main.toMenu();

      $("settingsBtn").onclick = () => { Audio2048.click(); this.showScreen("settingsScreen"); };
      $("settingsCloseBtn").onclick = () => { Audio2048.click(); this.showMenu(); };
      $("leaderboardBtn").onclick = () => { Audio2048.click(); this.showLeaderboard(); };
      $("lbCloseBtn").onclick = () => { Audio2048.click(); this.showMenu(); };
      $("dailyBtn").onclick = () => { Audio2048.click(); this.showDaily(); };
      $("dailyCloseBtn").onclick = () => { Audio2048.click(); this.showMenu(); };
      $("dailyClaimBtn").onclick = () => this._claimDaily();

      $("resetBtn").onclick = () => {
        Storage.reset();
        Game.coins = 0;
        this._syncToggles();
        this.updateHUD();
        this.toast("All data reset");
      };

      qsa(".toggle").forEach((t) => {
        t.onclick = () => this._toggle(t.dataset.key);
      });

      qsa(".booster").forEach((b) => {
        b.onclick = () => {
          Audio2048.click();
          Boosters.activate(b.dataset.booster);
          this.updateHUD();
        };
      });
    },
  };

  function fmt(n) {
    n = n || 0;
    if (n < 1000) return String(n);
    if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + "K";
    return (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + "M";
  }

  global.UI = UI;
})(window);

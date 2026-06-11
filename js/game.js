/* ============================================================
 * game.js — central game controller: state, scoring, coins,
 *           difficulty, rewards, save/restore.
 *
 * Rendering of the flying ball + grid->pixel mapping lives in
 * main.js (exposed as window.Grid). This module owns game rules.
 * ============================================================ */
(function (global) {
  "use strict";

  const C = CONFIG;

  const Game = {
    board: null,
    score: 0,
    coins: 0,
    ball: 1,        // exponent of the ball ready to shoot
    nextBall: 1,
    minExp: 1,      // difficulty floor for ball spawns
    shotCount: 0,
    combo: 0,
    armedBooster: null,
    snapshot: null,
    running: false,
    paused: false,
    over: false,

    init() {
      this.board = new Board();
      this.coins = Storage.get("coins") || 0;
    },

    /* ---------------- lifecycle ---------------- */
    start(loadSaved) {
      this.board.reset();
      this.score = 0;
      this.coins = Storage.get("coins") || 0;
      this.shotCount = 0;
      this.combo = 0;
      this.armedBooster = null;
      this.snapshot = null;
      this.over = false;
      this.paused = false;

      // accumulators used while a turn's merge chain plays out step-by-step
      this._turnGained = 0;
      this._turnCoins = 0;
      this._turnCombo = 0;
      this._turnTopExp = 1;

      const saved = Storage.get("progress");
      if (loadSaved && saved && saved.grid && saved.grid.some((c) => c.length)) {
        this.board.restore(saved.grid);
        this.score = saved.score || 0;
        this.shotCount = saved.shotCount || 0;
        this.ball = saved.ball || this._spawnExp();
        this.nextBall = saved.nextBall || this._spawnExp();
      } else {
        // start completely empty — only the player's shots add blocks
        this.ball = this._spawnExp();
        this.nextBall = this._spawnExp();
      }
      this._updateDifficulty();

      this.running = true;
      Effects.clear();
      this._saveProgress();
      if (global.UI) UI.updateHUD();
    },

    _spawnExp() {
      const floor = Math.max(1, this.board.maxExp() - 5);
      return C.spawnExp(floor);
    },

    _updateDifficulty() {
      this.minExp = Math.max(1, this.board.maxExp() - 5);
    },

    /* ---------------- shooting ---------------- */
    /** Called at release; records undo snapshot. Returns ball exponent. */
    beginShot() {
      this._takeSnapshot();
      return this.ball;
    },

    _takeSnapshot() {
      this.snapshot = {
        grid: this.board.clone(),
        score: this.score,
        coins: this.coins,
        ball: this.ball,
        nextBall: this.nextBall,
        shotCount: this.shotCount,
      };
    },

    /** Place the just-landed ball into column `col`; merges play out via step(). */
    placeLanded(col) {
      this.board.placeBall(col, this.ball);
      Audio2048.land();
      this._turnGained = 0;
      this._turnCoins = 0;
      this._turnCombo = 0;
      this._turnTopExp = this.ball;
    },

    /**
     * Advance the landed ball's merge chain by one step. Returns the merge
     * event (for animation), or null when the chain is done. Driven on a timer
     * by main.js so the numbers visibly add up one tier at a time.
     */
    stepMerge() {
      const ev = this.board.nextMerge();
      if (!ev) return null;

      this._turnCombo++;
      ev.combo = this._turnCombo;

      const s = C.mergeScore(ev.exp) * (ev.size - 1);
      const co = C.mergeCoins(ev.exp) * ev.combo + Math.max(0, ev.size - 2) * 5;
      this.score += s;
      this._turnGained += s;
      this._turnCoins += co;
      this._turnTopExp = Math.max(this._turnTopExp, ev.exp);
      this.combo = this._turnCombo;

      this.addCoins(co, true);
      this._mergeEffect(ev);
      Audio2048.merge(this._turnCombo);
      if (this._turnCombo >= 3) {
        Audio2048.combo(this._turnCombo);
        this._comboBanner(ev);
      }

      if (global.UI) UI.updateHUD();
      return ev;
    },

    /** Wrap up the turn after all merges finished. */
    finishTurn() {
      if (this._turnCombo === 0) this.combo = 0;
      this._checkMilestone(this._turnTopExp);

      this.shotCount++;
      this._updateDifficulty();

      this.ball = this.nextBall;
      this.nextBall = this._spawnExp();

      this._saveProgress();
      if (global.UI) UI.updateHUD();

      // game over only when the whole board is full and nothing can be placed
      if (this.board.isFull()) this.gameOver();
    },

    _mergeEffect(ev) {
      if (!global.Grid) return;
      const x = Grid.cx(ev.c);
      const y = Grid.cy(ev.r);
      const cols = C.colors(ev.exp);
      // pull particles in from each source cell toward the merged block
      if (ev.fromCells) {
        for (const fc of ev.fromCells) {
          Effects.burst(Grid.cx(fc.c), Grid.cy(fc.r), cols[0], 5, 3);
        }
      }
      Effects.burst(x, y, cols[0], 12 + ev.size * 4, 4 + ev.combo);
      Effects.ring(x, y, cols[0], Grid.cell * (1 + ev.size * 0.2));
      Effects.pop(ev.c, ev.r, Grid.cell);
      Effects.floatText(x, y - Grid.cell * 0.3, C.label(ev.exp), cols[0]);
    },

    _comboBanner(ev) {
      if (!global.Grid) return;
      const x = Grid.cx(ev.c);
      const y = Grid.cy(Math.max(0, ev.r - 1));
      Effects.floatText(x, y - Grid.cell * 0.6, "COMBO x" + ev.combo, "#ffd24a");
    },

    /* ---------------- coins & rewards ---------------- */
    addCoins(n, silent) {
      if (n <= 0) return;
      this.coins += n;
      Storage.set("coins", this.coins);
      if (!silent) Audio2048.coin();
      if (global.UI) UI.updateHUD();
    },

    spendCoins(n) {
      if (this.coins < n) return false;
      this.coins -= n;
      Storage.set("coins", this.coins);
      if (global.UI) UI.updateHUD();
      return true;
    },

    _checkMilestone(exp) {
      const prevHigh = Storage.get("highestExp") || 1;
      if (exp > prevHigh) {
        Storage.set("highestExp", exp);
        const claimed = Storage.get("milestones") || {};
        const reward = C.MILESTONES[exp];
        if (reward && !claimed[exp]) {
          claimed[exp] = true;
          Storage.set("milestones", claimed);
          this.addCoins(reward, true);
          Audio2048.reward();
          if (global.UI) UI.toast("Milestone " + C.label(exp) + "!  +" + reward + " coins");
        }
      }
    },

    /* ---------------- game over ---------------- */
    gameOver() {
      this.over = true;
      this.running = false;
      Audio2048.gameOver();
      Effects.shake(14);

      const bonusCoins = Math.floor(this.score / 500);
      if (bonusCoins > 0) this.addCoins(bonusCoins, true);

      const prevBest = Storage.get("best") || 0;
      const isBest = this.score > prevBest;
      Storage.addScore(this.score);
      Storage.clearProgress();

      if (global.UI) UI.showGameOver(this.score, isBest, bonusCoins);
    },

    /* ---------------- persistence ---------------- */
    _saveProgress() {
      if (this.over) return;
      const progress = {
        grid: this.board.clone(),
        score: this.score,
        ball: this.ball,
        nextBall: this.nextBall,
        shotCount: this.shotCount,
      };
      Storage.saveProgress(progress);
      if (global.Playables) {
        Playables.save({
          best: Storage.get("best"),
          coins: this.coins,
          highestExp: Storage.get("highestExp"),
          progress: progress,
        });
      }
    },

    hasSavedGame() {
      const s = Storage.get("progress");
      return !!(s && s.grid && s.grid.some((c) => c.length));
    },
  };

  global.Game = Game;
})(window);

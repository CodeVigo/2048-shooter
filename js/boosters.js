/* ============================================================
 * boosters.js — Hammer, Bomb, Shuffle, Undo.
 * Operates on the global Game. Hammer/Bomb require a target tap
 * (handled in main.js), so they only get "armed" here.
 * ============================================================ */
(function (global) {
  "use strict";

  const C = CONFIG;

  const Boosters = {
    cost(type) { return C.BOOSTER_COST[type]; },

    canAfford(type) { return Game.coins >= this.cost(type); },

    /** Returns true if the booster needs a target tap after activating. */
    needsTarget(type) { return type === "hammer" || type === "bomb"; },

    activate(type) {
      if (Game.over || !Game.running) return false;
      if (!this.canAfford(type)) {
        if (global.UI) UI.toast("Not enough coins");
        return false;
      }
      if (this.needsTarget(type)) {
        // arm — coins are spent only once a valid target is tapped
        Game.armedBooster = Game.armedBooster === type ? null : type;
        if (global.UI) UI.setBoosterArmed(Game.armedBooster);
        return true;
      }
      if (type === "shuffle") return this._shuffle();
      if (type === "undo") return this._undo();
      return false;
    },

    /** Apply an armed Hammer/Bomb at grid cell (c, r). */
    applyTarget(c, r) {
      const type = Game.armedBooster;
      if (!type) return false;
      if (r >= Game.board.height(c)) { // tapped empty cell — ignore
        return false;
      }
      if (!Game.spendCoins(this.cost(type))) return false;

      if (type === "hammer") this._hammer(c, r);
      else if (type === "bomb") this._bomb(c, r);

      Game.armedBooster = null;
      if (global.UI) UI.setBoosterArmed(null);
      Game._saveProgress();
      if (global.UI) UI.updateHUD();
      return true;
    },

    _hammer(c, r) {
      const exp = Game.board.removeAt(c, r);
      if (global.Grid && exp) {
        const cols = C.colors(exp);
        Effects.burst(Grid.cx(c), Grid.cy(r), cols[0], 18, 6);
        Effects.ring(Grid.cx(c), Grid.cy(r), cols[0], Grid.cell);
      }
      Effects.shake(5);
      Audio2048.boom();
    },

    _bomb(c, r) {
      const cleared = Game.board.bombAt(c, r, C.BOMB_RADIUS);
      if (global.Grid) {
        for (const cell of cleared) {
          const cols = C.colors(cell.exp);
          Effects.burst(Grid.cx(cell.c), Grid.cy(cell.r), cols[0], 10, 5);
        }
        Effects.ring(Grid.cx(c), Grid.cy(r), "#ff7a31", Grid.cell * (C.BOMB_RADIUS + 1) * 2);
      }
      Effects.shake(12);
      Audio2048.boom();
    },

    _shuffle() {
      if (!Game.spendCoins(this.cost("shuffle"))) return false;
      Game.board.shuffle();
      Effects.shake(6);
      Audio2048.combo(3);
      Game._saveProgress();
      if (global.UI) UI.updateHUD();
      return true;
    },

    _undo() {
      if (!Game.snapshot) {
        if (global.UI) UI.toast("Nothing to undo");
        return false;
      }
      if (!Game.spendCoins(this.cost("undo"))) return false;
      const s = Game.snapshot;
      Game.board.restore(s.grid);
      Game.score = s.score;
      Game.shotCount = s.shotCount;
      Game.ball = s.ball;
      Game.nextBall = s.nextBall;
      Game.snapshot = null;
      Game._updateDifficulty();
      Audio2048.click();
      Game._saveProgress();
      if (global.UI) UI.updateHUD();
      return true;
    },
  };

  global.Boosters = Boosters;
})(window);

/* ============================================================
 * board.js — the column grid model.
 *
 * Blocks are TOP-ANCHORED. Each column is an array of exponents
 * stacked from the top (index 0 = top row). Balls are shot UP from
 * the bottom and land just below the lowest block in a column, then
 * merge UPWARD (cascade). New rows are pushed in from the top.
 * ============================================================ */
(function (global) {
  "use strict";

  const INF = CONFIG.INFINITY_EXP;

  function Board() {
    this.cols = CONFIG.COLS;
    this.rows = CONFIG.ROWS;
    this.grid = [];
    this.reset();
  }

  Board.prototype.reset = function () {
    this.grid = [];
    for (let c = 0; c < this.cols; c++) this.grid.push([]);
  };

  Board.prototype.height = function (c) { return this.grid[c].length; };

  Board.prototype.get = function (c, r) {
    return r < this.grid[c].length ? this.grid[c][r] : 0;
  };

  Board.prototype.maxHeight = function () {
    let m = 0;
    for (let c = 0; c < this.cols; c++) m = Math.max(m, this.grid[c].length);
    return m;
  };

  Board.prototype.maxExp = function () {
    let m = 1;
    for (let c = 0; c < this.cols; c++)
      for (let r = 0; r < this.grid[c].length; r++)
        m = Math.max(m, this.grid[c][r]);
    return m;
  };

  Board.prototype.isOver = function () { return this.maxHeight() > this.rows; };

  /** True only when every column is filled to the top (no move possible). */
  Board.prototype.isFull = function () {
    for (let c = 0; c < this.cols; c++) {
      if (this.grid[c].length < this.rows) return false;
    }
    return true;
  };

  /** A ball can be dropped into column c only if it still has room. */
  Board.prototype.columnFull = function (c) {
    return this.grid[c].length >= this.rows;
  };

  Board.prototype.isEmpty = function () { return this.maxHeight() === 0; };

  /** Row index where a ball would come to rest in column c. */
  Board.prototype.landingRow = function (c) { return this.grid[c].length; };

  /** Smallest k such that 2^k >= n  (number of doublings to cover n blocks). */
  function ceilLog2(n) {
    let k = 0, p = 1;
    while (p < n) { p *= 2; k++; }
    return k;
  }

  /** Flood-fill the connected group of cells (4-directional) sharing value v. */
  Board.prototype._flood = function (c, r, v) {
    const key = (a, b) => a + "," + b;
    const seen = new Set([key(c, r)]);
    const stack = [{ c, r }];
    const out = [{ c, r }];
    while (stack.length) {
      const cur = stack.pop();
      const nbrs = [
        [cur.c - 1, cur.r], [cur.c + 1, cur.r],
        [cur.c, cur.r - 1], [cur.c, cur.r + 1],
      ];
      for (let i = 0; i < nbrs.length; i++) {
        const nc = nbrs[i][0], nr = nbrs[i][1];
        if (nc < 0 || nc >= this.cols || nr < 0) continue;
        if (seen.has(key(nc, nr))) continue;
        if (this.get(nc, nr) === v) {
          seen.add(key(nc, nr));
          const cell = { c: nc, r: nr };
          out.push(cell);
          stack.push(cell);
        }
      }
    }
    return out;
  };

  Board.prototype._recompact = function () {
    for (let c = 0; c < this.cols; c++) {
      this.grid[c] = this.grid[c].filter((x) => x !== 0);
    }
  };

  /**
   * Place a ball at the bottom of column `c` (no merging yet) and arm the
   * stepped merge resolver. Returns the row the ball came to rest in.
   */
  Board.prototype.placeBall = function (c, exp) {
    const landRow = this.grid[c].length;
    this.grid[c].push(exp);
    this._anchor = { c: c, r: landRow };
    return landRow;
  };

  /**
   * Resolve ONE merge step at the current anchor: if the anchor block touches
   * (up/down/left/right) a connected group of equal values, combine the whole
   * group into the next tier (total rounds up: 5×"2" => "16", 4×"2" => "8").
   * Returns the merge event, or null when nothing more merges.
   * Call repeatedly (e.g. on a timer) to animate the chain.
   */
  Board.prototype.nextMerge = function () {
    const pos = this._anchor;
    if (!pos) return null;
    const v = this.get(pos.c, pos.r);
    if (!v) { this._anchor = null; return null; }

    const group = this._flood(pos.c, pos.r, v);
    if (group.length < 2) { this._anchor = null; return null; }

    const resultExp = v >= INF ? INF : Math.min(INF, v + ceilLog2(group.length));
    const fromCells = group.map((g) => ({ c: g.c, r: g.r }));

    const SENTINEL = 1000 + resultExp;
    for (let i = 0; i < group.length; i++) {
      this.grid[group[i].c][group[i].r] = 0;
    }
    this.grid[pos.c][pos.r] = SENTINEL;
    this._recompact();

    let nc = pos.c, nr = 0;
    outer:
    for (let cc = 0; cc < this.cols; cc++) {
      for (let rr = 0; rr < this.grid[cc].length; rr++) {
        if (this.grid[cc][rr] === SENTINEL) {
          this.grid[cc][rr] = resultExp;
          nc = cc; nr = rr;
          break outer;
        }
      }
    }

    this._anchor = { c: nc, r: nr };
    return { exp: resultExp, c: nc, r: nr, size: group.length, fromCells: fromCells };
  };

  /** Hammer: remove a single block; column above collapses toward top. */
  Board.prototype.removeAt = function (c, r) {
    if (r < this.grid[c].length) {
      const exp = this.grid[c][r];
      this.grid[c].splice(r, 1);
      return exp;
    }
    return 0;
  };

  /** Bomb: clear all blocks within `radius` (grid units) of (c,r). */
  Board.prototype.bombAt = function (cc, rr, radius) {
    const cleared = [];
    for (let c = 0; c < this.cols; c++) {
      const keep = [];
      for (let r = 0; r < this.grid[c].length; r++) {
        const dist = Math.hypot(c - cc, r - rr);
        if (dist <= radius) cleared.push({ c, r, exp: this.grid[c][r] });
        else keep.push(this.grid[c][r]);
      }
      this.grid[c] = keep;
    }
    return cleared;
  };

  /** Shuffle: redistribute all existing blocks across columns. */
  Board.prototype.shuffle = function () {
    const all = [];
    for (let c = 0; c < this.cols; c++)
      for (let r = 0; r < this.grid[c].length; r++) all.push(this.grid[c][r]);
    for (let i = all.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = all[i]; all[i] = all[j]; all[j] = t;
    }
    this.reset();
    let idx = 0;
    const base = Math.floor(all.length / this.cols);
    let extra = all.length % this.cols;
    for (let c = 0; c < this.cols; c++) {
      let n = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
      for (let k = 0; k < n && idx < all.length; k++) this.grid[c].push(all[idx++]);
    }
  };

  Board.prototype.allCells = function () {
    const out = [];
    for (let c = 0; c < this.cols; c++)
      for (let r = 0; r < this.grid[c].length; r++)
        out.push({ c, r, exp: this.grid[c][r] });
    return out;
  };

  Board.prototype.clone = function () {
    return this.grid.map((col) => col.slice());
  };

  Board.prototype.restore = function (snapshot) {
    this.grid = snapshot.map((col) => col.slice());
  };

  global.Board = Board;
})(window);

/* ============================================================
 * main.js — canvas setup, layout, rendering, input/aiming,
 *           the 60fps loop, and the Main controller.
 * ============================================================ */
(function (global) {
  "use strict";

  const C = CONFIG;
  const COLS = C.COLS;
  const ROWS = C.ROWS;
  const TAU = Math.PI * 2;

  const Main = {
    canvas: null,
    ctx: null,
    dpr: 1,
    cssW: 0, cssH: 0,
    cell: 0, boardW: 0, boardH: 0, shooterH: 0,
    origin: { x: 0, y: 0 },
    ballR: 10,
    aiming: false,
    aimCol: 2,
    flying: null,
    resolving: false,
    mergeTimer: 0,
    started: false,

    init() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d");

      Game.init();
      UI.init();
      Audio2048.init();
      Playables.bind();

      this._bindInput();
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 200));

      this.resize();
      UI.showMenu();

      this.lastT = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    },

    /* ---------------- layout ---------------- */
    resize() {
      const wrap = document.getElementById("canvasWrap");
      const availW = wrap.clientWidth - 8;
      const availH = wrap.clientHeight - 8;
      const shooterRows = 2;
      const cell = Math.floor(
        Math.min(availW / COLS, availH / (ROWS + shooterRows))
      );
      this.cell = cell;
      this.boardW = cell * COLS;
      this.boardH = cell * ROWS;
      this.shooterH = cell * shooterRows;
      this.cssW = this.boardW;
      this.cssH = this.boardH + this.shooterH;
      this.ballR = cell * 0.42;
      this.origin = { x: this.boardW / 2, y: this.boardH + this.shooterH * 0.5 };

      this.dpr = Math.min(global.devicePixelRatio || 1, 2.5);
      this.canvas.width = this.cssW * this.dpr;
      this.canvas.height = this.cssH * this.dpr;
      this.canvas.style.width = this.cssW + "px";
      this.canvas.style.height = this.cssH + "px";
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // expose grid mapping for other modules (effects positions)
      const cellSize = cell;
      global.Grid = {
        cell: cellSize,
        cols: COLS,
        rows: ROWS,
        boardW: this.boardW,
        boardH: this.boardH,
        cx: (c) => (c + 0.5) * cellSize,
        cy: (r) => (r + 0.5) * cellSize,
      };
    },

    /* ---------------- controller ---------------- */
    startGame() {
      Audio2048.resume();
      Game.start(Game.hasSavedGame());
      this.flying = null;
      this.resolving = false;
      this.aiming = false;
      this.aimCol = 2;
      UI.showGame();
      if (Storage.getSetting("music")) Audio2048.startMusic();
    },

    restart() {
      Audio2048.resume();
      Game.start(false);
      this.flying = null;
      this.resolving = false;
      this.aiming = false;
      this.aimCol = 2;
      UI.showGame();
      if (Storage.getSetting("music")) Audio2048.startMusic();
    },

    pause() {
      if (!Game.running || Game.over) return;
      Game.paused = true;
      Game.armedBooster = null;
      UI.setBoosterArmed(null);
      UI.showScreen("pauseScreen");
    },

    resume() {
      Game.paused = false;
      UI.showGame();
    },

    toMenu() {
      Game.paused = true;
      Audio2048.stopMusic();
      UI.showMenu();
    },

    /* ---------------- input ---------------- */
    _bindInput() {
      const cv = this.canvas;
      const pos = (e) => {
        const r = cv.getBoundingClientRect();
        return {
          x: (e.clientX - r.left) * (this.cssW / r.width),
          y: (e.clientY - r.top) * (this.cssH / r.height),
        };
      };

      cv.addEventListener("pointerdown", (e) => {
        if (!this._canInteract()) return;
        cv.setPointerCapture(e.pointerId);
        if (Game.armedBooster) return; // wait for tap-up to target
        this.aiming = true;
        this._aim(pos(e));
      });

      cv.addEventListener("pointermove", (e) => {
        if (this.aiming) this._aim(pos(e));
      });

      cv.addEventListener("pointerup", (e) => {
        if (!this._canInteract()) { this.aiming = false; return; }
        const p = pos(e);
        if (Game.armedBooster) { this._target(p); return; }
        if (this.aiming) { this._aim(p); this._shoot(); }
        this.aiming = false;
      });

      cv.addEventListener("pointercancel", () => { this.aiming = false; });
      cv.addEventListener("contextmenu", (e) => e.preventDefault());
    },

    _canInteract() {
      return Game.running && !Game.paused && !Game.over && !this.flying && !this.resolving;
    },

    /** Pointer just selects which column to drop into — always straight up. */
    _aim(p) {
      this.aimCol = Math.max(0, Math.min(COLS - 1, Math.floor(p.x / this.cell)));
    },

    _target(p) {
      const c = Math.max(0, Math.min(COLS - 1, Math.floor(p.x / this.cell)));
      const r = Math.floor(p.y / this.cell);
      if (r < 0 || r >= ROWS) return;
      Boosters.applyTarget(c, r);
    },

    _shoot() {
      if (this.flying || this.resolving) return;
      const col = this.aimCol;
      const landRow = Game.board.height(col);
      if (landRow >= ROWS) {            // column full — reject the shot
        Audio2048.click();
        const x = (col + 0.5) * this.cell;
        Effects.ring(x, this.cell * 0.5, "#ff5d6c", this.cell);
        return;
      }
      const colX = (col + 0.5) * this.cell;
      const startY = this.origin.y;
      const landY = (landRow + 0.5) * this.cell;
      const exp = Game.beginShot();
      this.flying = {
        x: colX, y: startY, colX: colX,
        targetY: landY, c: col, exp: exp,
      };
      Audio2048.shoot();
    },

    /* ---------------- loop ---------------- */
    loop(t) {
      const dt = Math.min(50, t - this.lastT);
      this.lastT = t;

      if (this.flying && !Game.paused) {
        const speed = Math.max(12, this.cell * 0.7) * (dt / 16.67);
        this.flying.y -= speed;                 // straight up, no bounce
        if (this.flying.y <= this.flying.targetY) {
          this.flying.y = this.flying.targetY;
          const col = this.flying.c;
          this.flying = null;
          Game.placeLanded(col);
          this.resolving = true;
          this.mergeTimer = 400;                // first merge after a clear beat
        }
      }

      // play the merge chain one tier at a time, slowly, so the numbers
      // visibly add up — easy for a young child to follow and learn from.
      if (this.resolving && !Game.paused) {
        this.mergeTimer -= dt;
        if (this.mergeTimer <= 0) {
          const ev = Game.stepMerge();
          if (ev) {
            this.mergeTimer = 650;              // slow pause between merge steps
          } else {
            this.resolving = false;
            Game.finishTurn();
          }
        }
      }

      Effects.update();
      this.render();

      if (!this._firstFrame) {
        this._firstFrame = true;
        Playables.firstFrameReady();
        Playables.gameReady();
      }
      requestAnimationFrame((tt) => this.loop(tt));
    },

    /* ---------------- rendering ---------------- */
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.cssW, this.cssH);

      const sh = Effects.getShake();
      ctx.save();
      ctx.translate(sh.x, sh.y);

      this._drawBoardBg(ctx);
      this._drawBlocks(ctx);
      Effects.draw(ctx);

      if (this.aiming && this._canInteract()) this._drawAim(ctx);

      this._drawShooter(ctx);
      if (this.flying) this._drawFlying(ctx);

      ctx.restore();
    },

    _drawBoardBg(ctx) {
      const cell = this.cell;
      const gap = cell * 0.09;
      const laneW = cell - gap;
      const r = cell * 0.28;
      ctx.save();
      // dark rounded column lanes (like the reference photo)
      for (let c = 0; c < COLS; c++) {
        const x = c * cell + gap / 2;
        roundRect(ctx, x, 2, laneW, this.boardH - 4, r);
        ctx.fillStyle = "#15161d";
        ctx.fill();
        // subtle inner top sheen
        ctx.fillStyle = "rgba(255,255,255,0.025)";
        roundRect(ctx, x, 2, laneW, this.boardH * 0.5, r);
        ctx.fill();
      }
      ctx.restore();
    },

    _drawBlocks(ctx) {
      if (!Game.board) return;
      const cells = Game.board.allCells();
      for (const cellData of cells) {
        const scale = Effects.popScale(cellData.c, cellData.r);
        this._drawTile(
          ctx,
          cellData.c * this.cell,
          cellData.r * this.cell,
          this.cell,
          cellData.exp,
          false,
          scale
        );
      }
    },

    _drawTile(ctx, x, y, size, exp, circle, scale) {
      if (scale && scale !== 1) {
        const cx = x + size / 2, cy = y + size / 2;
        const ns = size * scale;
        x = cx - ns / 2; y = cy - ns / 2; size = ns;
      }
      const pad = size * 0.06;
      const s = size - pad * 2;
      const px = x + pad, py = y + pad;
      const cols = C.colors(exp);
      const grad = ctx.createLinearGradient(px, py, px, py + s);
      grad.addColorStop(0, cols[0]);
      grad.addColorStop(1, cols[1]);

      ctx.save();
      ctx.shadowColor = cols[2];
      ctx.shadowBlur = size * 0.25;
      ctx.fillStyle = grad;
      if (circle) {
        ctx.beginPath();
        ctx.arc(px + s / 2, py + s / 2, s / 2, 0, TAU);
        ctx.fill();
      } else {
        roundRect(ctx, px, py, s, s, s * 0.26);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // glossy top highlight
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#ffffff";
      if (circle) {
        ctx.beginPath();
        ctx.ellipse(px + s / 2, py + s * 0.32, s * 0.32, s * 0.18, 0, 0, TAU);
        ctx.fill();
      } else {
        roundRect(ctx, px + s * 0.12, py + s * 0.1, s * 0.76, s * 0.3, s * 0.14);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // label
      const label = C.label(exp);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let fs = s * (label.length >= 4 ? 0.3 : label.length === 3 ? 0.38 : 0.46);
      if (label === "\u221E") fs = s * 0.6;
      ctx.font = "800 " + fs + "px 'Segoe UI', sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 2;
      ctx.fillText(label, px + s / 2, py + s / 2 + s * 0.02);
      ctx.restore();
    },

    _drawAim(ctx) {
      const col = this.aimCol;
      const colX = (col + 0.5) * this.cell;
      const landRow = Game.board.height(col);
      const full = landRow >= ROWS;
      const color = full ? "#ff5d6c" : C.colors(Game.ball)[0];

      ctx.save();
      if (full) {
        // column is full — show it as blocked, no landing spot
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = color;
        ctx.fillRect(col * this.cell, 0, this.cell, this.boardH);
        ctx.restore();
        return;
      }
      const landY = (landRow + 0.5) * this.cell;
      // straight vertical guide up the chosen column
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      let y = this.origin.y - this.cell * 0.6;
      while (y > landY) {
        ctx.beginPath();
        ctx.arc(colX, y, this.cell * 0.06, 0, TAU);
        ctx.fill();
        y -= this.cell * 0.45;
      }
      // highlight the whole target column + landing cell
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = color;
      ctx.fillRect(col * this.cell, 0, this.cell, this.boardH);
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRect(ctx, col * this.cell + 3, landRow * this.cell + 3, this.cell - 6, this.cell - 6, this.cell * 0.2);
      ctx.stroke();
      ctx.restore();
    },

    _drawShooter(ctx) {
      // base platform
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, 0, this.boardH, this.boardW, this.shooterH, 12);
      ctx.fill();
      ctx.restore();

      if (!Game.running && !Game.over) return;

      // ready ball — sits under the currently aimed column
      if (!this.flying && !this.resolving) {
        const bx = (this.aimCol + 0.5) * this.cell;
        this._drawTile(ctx, bx - this.cell / 2, this.origin.y - this.cell / 2, this.cell, Game.ball, true);
      }
    },

    _drawFlying(ctx) {
      const f = this.flying;
      this._drawTile(ctx, f.x - this.cell / 2, f.y - this.cell / 2, this.cell, f.exp, true);
    },
  };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  global.Main = Main;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Main.init());
  } else {
    Main.init();
  }
})(window);

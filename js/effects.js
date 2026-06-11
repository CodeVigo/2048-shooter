/* ============================================================
 * effects.js — particles, floating score text, screen shake,
 *               merge flashes (drawn on the game canvas).
 * ============================================================ */
(function (global) {
  "use strict";

  const particles = [];
  const floaters = [];
  const flashes = [];
  const pops = [];
  let shake = { mag: 0, x: 0, y: 0 };

  function rand(a, b) { return a + Math.random() * (b - a); }

  const Effects = {
    /* burst of glowing particles */
    burst(x, y, color, count, power) {
      count = count || 16;
      power = power || 5;
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(power * 0.3, power);
        particles.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 1,
          life: 1,
          decay: rand(0.012, 0.03),
          size: rand(2, 6),
          color,
        });
      }
    },

    ring(x, y, color, maxR) {
      flashes.push({ x, y, r: 0, maxR: maxR || 60, color, life: 1 });
    },

    floatText(x, y, text, color) {
      floaters.push({ x, y, text, color: color || "#fff", life: 1, vy: -1.1 });
    },

    shake(mag) {
      if (!Storage.getSetting("shake")) return;
      shake.mag = Math.max(shake.mag, mag);
    },

    getShake() { return shake; },

    /* register a scale "pop" on the tile at grid cell (c,r) */
    pop(c, r) { pops.push({ c, r, life: 1 }); },

    /* scale factor (>=1) to apply when drawing the tile at (c,r) */
    popScale(c, r) {
      for (let i = 0; i < pops.length; i++) {
        if (pops[i].c === c && pops[i].r === r) {
          return 1 + Math.sin(pops[i].life * Math.PI) * 0.28;
        }
      }
      return 1;
    },

    update() {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.25;        // gravity
        p.vx *= 0.98;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.y += f.vy; f.vy *= 0.97; f.life -= 0.009;
        if (f.life <= 0) floaters.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        fl.r += (fl.maxR - fl.r) * 0.2;
        fl.life -= 0.06;
        if (fl.life <= 0) flashes.splice(i, 1);
      }
      for (let i = pops.length - 1; i >= 0; i--) {
        pops[i].life -= 0.04;
        if (pops[i].life <= 0) pops.splice(i, 1);
      }
      if (shake.mag > 0.1) {
        shake.x = rand(-shake.mag, shake.mag);
        shake.y = rand(-shake.mag, shake.mag);
        shake.mag *= 0.86;
      } else {
        shake.mag = 0; shake.x = 0; shake.y = 0;
      }
    },

    draw(ctx) {
      // expanding rings
      for (const fl of flashes) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fl.life) * 0.6;
        ctx.strokeStyle = fl.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // particles
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // floating texts
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "800 22px 'Segoe UI', sans-serif";
      for (const f of floaters) {
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 12;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.restore();
    },

    clear() {
      particles.length = 0;
      floaters.length = 0;
      flashes.length = 0;
      pops.length = 0;
      shake = { mag: 0, x: 0, y: 0 };
    },
  };

  global.Effects = Effects;
})(window);

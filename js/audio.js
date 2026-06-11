/* ============================================================
 * audio.js — fully synthesized sound via Web Audio API.
 * No external files => perfect for offline / YouTube Playables.
 * ============================================================ */
(function (global) {
  "use strict";

  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;

  function ensure() {
    if (ctx) return;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.0;
    musicGain.connect(master);
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function tone(freq, dur, type, vol, when, glideTo) {
    if (!ctx || global.__ytAudioOff || !Storage.getSetting("sound")) return;
    const t = (when || ctx.currentTime);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || global.__ytAudioOff || !Storage.getSetting("sound")) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const Audio = {
    init: ensure,
    resume,

    shoot() {
      resume();
      tone(420, 0.12, "triangle", 0.22, undefined, 720);
    },

    land() {
      resume();
      tone(180, 0.08, "sine", 0.18, undefined, 120);
    },

    merge(combo) {
      resume();
      const base = 360 + Math.min(combo, 10) * 70;
      tone(base, 0.18, "triangle", 0.28, undefined, base * 1.6);
      tone(base * 1.5, 0.16, "sine", 0.16);
    },

    combo(n) {
      resume();
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < Math.min(n, 5); i++) {
        tone(600 + i * 180, 0.12, "sine", 0.18, t + i * 0.05);
      }
    },

    reward() {
      resume();
      if (!ctx) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.22, "triangle", 0.24, t + i * 0.08)
      );
    },

    coin() {
      resume();
      tone(880, 0.07, "square", 0.12, undefined, 1320);
    },

    gameOver() {
      resume();
      if (!ctx) return;
      const t = ctx.currentTime;
      [440, 349, 262, 196].forEach((f, i) =>
        tone(f, 0.4, "sawtooth", 0.2, t + i * 0.14)
      );
    },

    boom() {
      resume();
      noise(0.4, 0.35, 600);
      tone(90, 0.4, "sawtooth", 0.3, undefined, 40);
    },

    click() {
      resume();
      tone(660, 0.05, "square", 0.1);
    },

    /* ---- ambient music loop (procedural) ---- */
    startMusic() {
      resume();
      if (!ctx || musicTimer) return;
      musicGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.5);
      const scale = [220, 262, 294, 330, 392, 440, 523];
      let step = 0;
      const play = () => {
        if (!Storage.getSetting("music")) return;
        const f = scale[step % scale.length];
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.5, t + 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
        osc.connect(g); g.connect(musicGain);
        osc.start(t); osc.stop(t + 1.7);
        step += (Math.random() < 0.5 ? 1 : 2);
      };
      play();
      musicTimer = setInterval(play, 900);
    },

    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (musicGain && ctx) musicGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.5);
    },
  };

  global.Audio2048 = Audio;
})(window);

/* ============================================================
 * playables.js — YouTube Playables SDK integration.
 *
 * The SDK (loaded from youtube.com in index.html) exposes a global
 * `ytgame`. It runs as a no-op locally, and may be absent entirely
 * when testing offline, so EVERY call is guarded. This lets the same
 * build run as a normal web page AND as a certified Playable.
 *   Docs: https://developers.google.com/youtube/gaming/playables
 * ============================================================ */
(function (global) {
  "use strict";

  const has = () => typeof global.ytgame !== "undefined" && global.ytgame;
  let firstFrameSent = false;
  let gameReadySent = false;

  const Playables = {
    inEnv() { return !!(has() && global.ytgame.IN_PLAYABLES_ENV); },

    /** Call once after the very first frame is painted. */
    firstFrameReady() {
      if (firstFrameSent || !has()) return;
      firstFrameSent = true;
      try { global.ytgame.game.firstFrameReady(); } catch (e) {}
    },

    /** Call once the player can interact (menu is shown). */
    gameReady() {
      if (gameReadySent || !has()) return;
      gameReadySent = true;
      try { global.ytgame.game.gameReady(); } catch (e) {}
    },

    /** Wire platform lifecycle + audio into the game. */
    bind() {
      if (!has()) return;
      const yt = global.ytgame;
      try {
        yt.system.onPause(() => { if (global.Main) Main.pause(); });
        yt.system.onResume(() => { /* stay paused until user resumes */ });
      } catch (e) {}
      try {
        global.__ytAudioOff = !yt.system.isAudioEnabled();
        yt.system.onAudioEnabledChange((enabled) => {
          global.__ytAudioOff = !enabled;
          if (!enabled) Audio2048.stopMusic();
          else if (Storage.getSetting("music")) Audio2048.startMusic();
        });
      } catch (e) {}
    },

    /** Best-effort cloud save mirror (localStorage stays primary). */
    save(obj) {
      if (!has()) return;
      try {
        const json = JSON.stringify(obj);
        if (json.length < 60000) global.ytgame.game.saveData(json);
      } catch (e) {}
    },
  };

  global.Playables = Playables;
})(window);

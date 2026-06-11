# 2048 Shooter: Number Match

A polished, mobile-friendly **column merge shooter** built with vanilla HTML5 +
Canvas + ES6 JavaScript. Shoot numbered balls up into columns of blocks; matching
numbers merge into the next value, cascading for big combos. Fully offline, no
backend, and integrated with the **YouTube Playables SDK** so it can be submitted
as a Playable.

```
2 → 4 → 8 → 16 → 32 → 64 → 128 → 256 → 512 → 1K → 2K → 4K → 8K → 16K → 32K →
64K → 128K → 256K → 512K → 1M → 2M → 4M → 8M → 16M → 32M → 64M → 128M → 256M →
512M → 1024M → 2048M → ∞
```

## Features

- **Gameplay**: aim (drag) and shoot a ball up a column; it lands below the lowest
  block and merges **upward**, cascading. Balls bounce off side walls. A new row
  descends from the top on a timer — clear columns before they reach the bottom.
- **Progression**: endless mode with rising difficulty (rows arrive faster, spawn
  values scale up as your board grows). Auto-saves after every shot.
- **Spawn odds** (relative to difficulty floor): 70% / 20% / 8% / 2%.
- **Scoring**: score + coins per merge, combo bonuses, milestone & daily rewards.
- **Boosters**: Hammer (destroy a block), Bomb (clear a radius), Shuffle, Undo.
- **Juice**: particle bursts, merge flashes, floating score text, combo banners,
  screen shake, smooth tweened ball flight, glossy gradient tiles.
- **Audio**: all sounds synthesized at runtime via the Web Audio API (no files),
  plus an optional procedural music loop. Sound/music/shake toggles.
- **UI**: main menu, pause, settings, game over, leaderboard, daily reward popup,
  coin counter, booster bar.
- **Saving**: high score, coins, highest block, settings, in-progress game —
  stored in `localStorage` and mirrored to Playables cloud save when available.

## Folder structure

```
2048_playable/
├── index.html          # markup + all UI screens, loads the Playables SDK first
├── css/
│   └── style.css        # dark glowing theme, responsive layout, popups
└── js/
    ├── config.js        # number progression, labels, tier colors, spawn odds
    ├── storage.js       # localStorage persistence
    ├── playables.js     # YouTube Playables SDK integration (guarded)
    ├── audio.js         # Web Audio synthesized SFX + music
    ├── effects.js       # particles, floating text, screen shake, flashes
    ├── board.js         # column grid model: land, merge cascade, add-row
    ├── boosters.js      # hammer / bomb / shuffle / undo
    ├── game.js          # state, scoring, coins, difficulty, rewards, saving
    ├── ui.js            # screen manager, HUD, popups, settings, leaderboard
    └── main.js          # canvas, layout, rendering, input/aiming, game loop
```

## Run locally

The game needs to be served over HTTP (not opened as a `file://` path) so the
modules load correctly. From this folder:

```bash
# Python (any OS)
python -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>. On desktop, drag the mouse to aim and release
to shoot. On mobile, drag/release with your finger.

> The Playables SDK script loads from youtube.com and is a no-op outside the
> YouTube environment. If you are fully offline it simply won't load, and the game
> still runs because every SDK call is guarded.

---

## How to publish on YouTube Playables — step by step

YouTube Playables is invite/early-access. Here is the full path:

### 1. Request developer access
- Go to the [YouTube Playables developer site](https://developers.google.com/youtube/gaming/playables)
  and fill out the **Playables interest form**. Access is granted per developer/company.

### 2. Confirm the technical requirements (this build already follows them)
- ✅ HTML5 using standard web APIs (Canvas / JS).
- ✅ `index.html` at the **root** of the bundle.
- ✅ Playables SDK loaded **before** any game code (already done in `index.html`).
- ✅ **Relative paths only** (we use `css/...` and `js/...`).
- ✅ **No external network calls** other than the SDK.
- ✅ Filenames use only letters, numbers, `_`, `-`, `.`.
- ✅ Initial bundle **< 30 MiB** (this game is only a few KB).
- ✅ Loads and is interactive in **< 5 seconds**.
- ✅ Lifecycle handlers implemented in `js/playables.js`:
  `firstFrameReady()`, `gameReady()`, `onPause`/`onResume`, `saveData`,
  and audio gating via `isAudioEnabled` / `onAudioEnabledChange`.

### 3. Package the build
Create a ZIP whose **root** contains `index.html` (do **not** zip a parent folder
that contains the game folder):

```bash
# from inside 2048_playable/
# PowerShell (Windows):
Compress-Archive -Path index.html, css, js -DestinationPath 2048_shooter.zip

# macOS/Linux:
zip -r 2048_shooter.zip index.html css js
```

Verify the ZIP opens to `index.html`, `css/`, `js/` at the top level.

### 4. Validate with the SDK Test Suite
- Use the official **Playables SDK Test Suite** (linked from the developer docs)
  pointed at your `index.html` to confirm SDK integration, bundle size, and CSP
  compliance before submitting.

### 5. Submit through the Developer Portal
- Upload the ZIP in the Playables Developer Portal, fill in store metadata
  (title, description, icon/screenshots, category = Puzzle/Arcade, age rating),
  and submit for moderation.

### 6. Moderation & publish
- YouTube reviews the build. Once approved it becomes available in
  **youtube.com/playables** and the YouTube mobile apps.

### Notes for monetization / content video
If your real goal is a YouTube **video** about the game (gameplay/devlog) rather
than the Playables program, you can also just host this folder on any static host
(GitHub Pages, Netlify, itch.io) and record/screen-capture it — no SDK or approval
needed. The Playables SDK integration here is purely additive and does not affect
normal web hosting.

## License / assets
All code, colors, sounds, and effects are original and generated at runtime —
there are no third-party assets, so the bundle is safe to publish.

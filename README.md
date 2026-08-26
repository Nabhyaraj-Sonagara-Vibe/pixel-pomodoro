# Pixel Pomodoro

A tiny, offline, ad-free pixel-art Pomodoro timer. Pure HTML/CSS/JS, zero
dependencies, zero network calls, zero accounts. Open it and it just works.

**Live app (after merge):** https://Nabhyaraj-Sonagara-Vibe.github.io/pixel-pomodoro/

## Why I built this

Most web Pomodoro timers are bloated with ads, analytics, account walls, or
"upgrade to premium" nags for a feature as simple as "count down 25 minutes
and beep." This is the opposite: a single static page, retro Game Boy-style
pixel art, synthesized chimes (no audio files to download), and everything
persisted locally in your browser. No signup, no tracking, no internet
required after the first load — it even works completely offline once
cached.

## What it does

- Classic Pomodoro cycle: **Work → Short Break**, repeated, with a
  **Long Break** every 4th work session — fully automatic.
- Configurable durations (defaults: 25 / 5 / 15 minutes) via a settings
  panel. Changing settings mid-timer doesn't corrupt the running session.
- Session counter + a running tally of completed pomodoros saved in
  `localStorage` (survives refresh/close).
- A task/label input so you can note what you're working on this session
  (also persisted).
- Desktop notifications when a session ends (asks permission gracefully;
  degrades silently if denied or unsupported).
- A distinct audible chime per session type, synthesized live with the Web
  Audio API — no bundled audio files.
- A pixel-art scene that visibly changes between "working" (person at a
  desk) and "on break" (person lounging) states, plus a blocky pixel
  progress bar.

## How to run it

No build step, no install. Either:

```bash
# Option 1 — just open the file
open index.html

# Option 2 — serve it locally (recommended, needed for Notification API in some browsers)
python3 -m http.server 8000
# then visit http://localhost:8000
```

That's it. It's a static site — once cloned, it never phones home.

## Keyboard shortcuts

| Key     | Action         |
|---------|----------------|
| `Space` | Pause / Resume |
| `R`     | Reset current session |
| `S`     | Skip current session |

## Project structure

```
index.html              — markup
assets/css/style.css    — pixel/retro styling
assets/js/timer.js      — pure timer-logic functions (unit-tested)
assets/js/app.js        — DOM wiring, audio chimes, notifications, persistence
assets/fonts/           — bundled "Press Start 2P" font (OFL licensed) + OFL.txt
tests/timer.test.js     — smoke test for timer.js (run: node tests/timer.test.js)
.github/workflows/deploy.yml — auto-deploy to GitHub Pages on merge to main
```

## Tests

```bash
node tests/timer.test.js
```

Checks the pure session-transition, duration, formatting, and input-clamping
logic — no DOM, no browser needed.

## Credits / licenses

- App code: MIT — see [LICENSE](LICENSE).
- Font: **Press Start 2P** by CodeMan38, licensed under the SIL Open Font
  License 1.1. Bundled locally at `assets/fonts/PressStart2P-Regular.ttf`
  with the full license text at `assets/fonts/OFL.txt`. No CDN/Google Fonts
  used at runtime — the font is self-hosted and loaded via a relative
  `@font-face` rule.
- All chimes are synthesized in-browser via the Web Audio API — no bundled
  audio files, no licensing concerns there either.

## Privacy

Zero external network calls at runtime. No analytics, no fonts/scripts from
a CDN, no fetch to any third-party host. Everything needed to run this app
ships in this repo.

# Aircraft Mechanic Tycoon

A production-ready, mobile-friendly browser management game built with HTML, CSS, and JavaScript.

## Play Locally

1. Open this folder in VS Code.
2. Run with a local static server (recommended):

```bash
cd aircraft-mechanic-tycoon
python3 -m http.server 8080
```

3. Open http://localhost:8080 in your browser.

## Controls

- Desktop movement: WASD or Arrow Keys
- Desktop action: Hold E or Space to repair/collect
- Mobile movement: On-screen joystick
- Mobile action: Hold Repair / Collect button
- Tap/click aircraft to diagnose or move toward it

## Features

- Top-down mechanic movement with smooth controls
- Aircraft queue: small plane, helicopter, jet
- Diagnose and hold-to-repair gameplay
- Wait timers, payments, and difficulty scaling
- XP, leveling, combo bonus, idle income
- Upgrades: speed, repair tools, value, hangar expansion, worker hiring
- AI workers auto-repair nearby aircraft
- Daily reward system
- Settings (sound and vibration)
- Fullscreen mode
- Auto-save/load using localStorage

## Publish To GitHub Pages

1. Create a new empty repository on GitHub named `aircraft-mechanic-tycoon`.
2. Run:

```bash
git init
git add .
git commit -m "Initial release: Aircraft Mechanic Tycoon"
git branch -M main
git remote add origin https://github.com/<your-username>/aircraft-mechanic-tycoon.git
git push -u origin main
```

3. In GitHub repo settings:
   - Go to **Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** and folder **/ (root)**

4. Your live URL will be:

```text
https://<your-username>.github.io/aircraft-mechanic-tycoon/
```

## Notes

- Game progress is stored in localStorage on the current device/browser.
- No external game framework is required.

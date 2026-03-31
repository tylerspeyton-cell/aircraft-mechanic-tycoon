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
- Mechanic of the Year cloud leaderboard (optional Supabase)

## Mechanic Of The Year (Cross-Device Board)

This project now supports a global competition board with a personal character name.

- Your local progress still saves in `localStorage`.
- Your board entry syncs through Supabase (if configured).
- Use the same character name on any device to keep a consistent identity on the board.

### 1. Create Supabase table

In Supabase SQL editor, run:

```sql
create table if not exists public.mechanic_leaderboard (
   player_id text primary key,
   character_name text not null,
   score integer not null default 0,
   level integer not null default 1,
   total_repairs integer not null default 0,
   money integer not null default 0,
   updated_at timestamptz not null default now()
);

alter table public.mechanic_leaderboard enable row level security;

create policy "Public can read leaderboard"
on public.mechanic_leaderboard
for select
to anon
using (true);

create policy "Public can upsert own player id"
on public.mechanic_leaderboard
for insert
to anon
with check (true);

create policy "Public can update leaderboard rows"
on public.mechanic_leaderboard
for update
to anon
using (true)
with check (true);
```

### 2. Add cloud config

1. Copy `config.example.js` into `config.js`.
2. Fill in your Supabase URL and anon key.
3. Keep table as `mechanic_leaderboard` unless you changed it.

`index.html` already loads `config.js` before `main.js`.

### 3. Use in game

1. Open **Mechanic of the Year**.
2. Enter your character name and click **Save Name**.
3. Click **Submit Current Score**.
4. On other devices, use the same hosted game + same character name to compete on the same board.

Board sync also runs automatically every ~35 seconds while playing.

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
- Global board sync requires setting `window.MOTY_CONFIG` in `config.js`.
- No external game framework is required.

## Portal Publishing Kit

- Submission copy and checklist: `PORTAL_SUBMISSION_KIT.md`
- Privacy Policy page: `privacy.html`
- Terms of Use page: `terms.html`

# TackEff Group Dashboard

A self-contained, full-screen TV/monitor dashboard for the TackEff Group.

- **Backend:** single-file Python 3 HTTP server (`server.py`), stdlib only.
- **Frontend:** plain HTML/CSS/JS, no CDN, no build step, no internet at runtime.
- **Design:** fixed 3840×2160 canvas, JS-scaled to fit any viewport (works great on 1080p and 4K TVs).
- **Fonts:** Inter Tight + JetBrains Mono embedded as base64 in `static/fonts.css` (~360 KB).
- **Data:** rendered from `/api/data` — config + iCal-fetched events + project/capability JSON.

Designed for Debian 13. No `pip install` required.

---

## Quick start

```bash
cd BackToWork
python3 server.py
# → http://localhost:8181
```

First-run tip: `config/config.json` ships pointing at the local `static/sample.ics` so the dashboard has content immediately. Replace that URL with your real iCal feed(s) when ready.

To run on a TV: open the URL in fullscreen kiosk mode (e.g. `chromium --kiosk http://dash-host:8181`).

---

## File layout

```
BackToWork/
├── server.py                    # The whole server. Run this.
├── generate_fonts.py            # One-shot fonts.css rebuilder (needs internet).
├── README.md
├── config/
│   ├── config.json              # Port, iCal URLs, countdown, refresh interval
│   ├── projects.json            # Project Status view data
│   └── capabilities.json        # Capabilities view data
└── static/
    ├── index.html
    ├── fonts.css                # Embedded fonts (base64)
    ├── styles.css               # 4K canvas styles
    ├── data-loader.js           # Fetches /api/data, injects other scripts
    ├── dashboard.js             # Shell + rotator + stage scaling
    ├── calendar-view.js         # 14-day grid + upcoming sidebar
    ├── status-view.js           # Projects × phases matrix + countdown
    ├── capabilities-view.js     # Capability cards + task lists
    ├── tweaks.js                # Runtime tweaks panel (press 't')
    └── sample.ics               # Demo calendar data
```

---

## Configuration — `config/config.json`

```json
{
  "port": 8181,
  "reload_interval_seconds": 300,

  "countdown": {
    "label": "Critical Deadline",
    "target": "2026-12-31",
    "target_label": "Q4 Demo Day"
  },

  "ical_urls": [
    {"url": "https://example.com/team.ics", "category": 1},
    {"url": "https://example.com/external.ics", "category": 3}
  ],

  "phases": ["Initial Concept", "Hardware Design", "..."]
}
```

- **`ical_urls`** — list of strings or `{url, category}` objects. `category` (1–5) controls event color: 1=Sync, 2=Review, 3=External, 4=Field, 5=Offsite.
- **`reload_interval_seconds`** — background refresh cadence for iCal sources. The UI **Reload** button forces an immediate refresh regardless.
- **`countdown.target`** — ISO date. Leave empty (`""`) to hide the countdown.

The config file is **live-reloaded** — edit and save; the server picks up the change on the next request (or on `/api/reload`).

`projects.json` and `capabilities.json` — edit freely; same live-reload behavior.

---

## Endpoints

| Method | Path           | Purpose                                       |
|--------|----------------|-----------------------------------------------|
| GET    | `/`            | Dashboard UI                                  |
| GET    | `/api/data`    | All view data as JSON                          |
| GET    | `/api/config`  | Public config snapshot                         |
| GET    | `/api/reload`  | Force re-fetch all iCal sources + bust caches  |
| POST   | `/api/reload`  | Same                                           |
| GET    | `/<file>`      | Static files from `static/` (path-traversal blocked) |

---

## Keyboard shortcuts & footer controls

| Key / button       | Action                  |
|--------------------|-------------------------|
| `←`                | Previous view           |
| `→`                | Next view               |
| `Space`            | Pause / resume rotation |
| `t`                | Toggle tweaks panel     |
| Footer `↻ Reload`  | Force re-fetch data     |
| Footer dots        | Jump directly to a view |

The footer auto-hides 3 seconds after the last mouse move.

---

## Tweaks panel (press `t`)

Runtime-adjustable, saved to `localStorage`:

- **Rotation speed** (10–180s per view)
- **Accent color** (6 presets)
- **Clock display** (prominent / subtle / off)
- **Density** (compact / normal / roomy)
- **Pause / play** + manual next/prev
- **View order** — reorder the three views

---

## Notes & limits

- **iCal parser** handles plain `VEVENT` blocks with `DTSTART`/`DTEND`/`DURATION`/`SUMMARY`/`LOCATION`/`DESCRIPTION` and basic `TZID=` parameters. It does **not** expand recurring events (`RRULE`) — if you need that, point the URL at a service that pre-expands them, or extend `_fetch_ical` in `server.py`.
- **Fonts** are committed pre-embedded so the dashboard works fully offline. If you want to rebuild `static/fonts.css` (different weights, different fonts), edit and run `generate_fonts.py` (needs internet, one-time only).
- **No auth.** Run on a trusted LAN, or front it with nginx + basic auth if you need to expose it.
- **Threading:** the server uses `ThreadingHTTPServer` so it can serve concurrent requests and fetch iCal from itself (e.g. when pointed at the bundled `sample.ics`).

---

## Service install (optional)

Drop this at `/etc/systemd/system/tackeff-dashboard.service`:

```ini
[Unit]
Description=TackEff Group Dashboard
After=network-online.target

[Service]
Type=simple
User=dashboard
WorkingDirectory=/opt/BackToWork
ExecStart=/usr/bin/python3 /opt/BackToWork/server.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tackeff-dashboard
```

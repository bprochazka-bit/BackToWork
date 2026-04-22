# TackEff Group Dashboard

A self-contained, full-screen TV/monitor dashboard for the TackEff Group.

- **Backend:** single-file Python 3 HTTP server (`server.py`), stdlib only.
- **Frontend:** plain HTML/CSS/JS, no CDN, no build step, no internet.
- **Fonts:** Inter Tight + JetBrains Mono embedded as base64 in `static/fonts.css` (~360 KB).
- **Data:** rendered from `/api/data` — config + iCal-fetched events + project/capability JSON.

Designed for Debian 13. No `pip install` required.

---

## Quick start

```bash
cd dashboard
python3 server.py
```

Then open `http://localhost:8181` in a browser.

To run on a TV: open the URL in fullscreen kiosk mode (e.g. `chromium --kiosk http://dash-host:8181`).

---

## File layout

```
dashboard/
├── server.py                    # The whole server. Run this.
├── README.md
├── config/
│   ├── config.json              # Port, ical URLs, countdown, refresh interval
│   ├── projects.json            # Project Status view data
│   └── capabilities.json        # Capabilities view data
└── static/
    ├── index.html
    ├── fonts.css                # Embedded fonts (auto-generated, base64)
    ├── styles.css
    ├── dashboard.js             # Rotator + data loader
    ├── calendar-view.js
    ├── status-view.js
    ├── capabilities-view.js
    └── tweaks.js                # Press 't' in the UI to open
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

- **`ical_urls`** — list of strings or `{url, category}` objects. `category` (1–5) controls the event color on the calendar (1=Sync, 2=Review, 3=External, 4=Field, 5=Offsite).
- **`reload_interval_seconds`** — background refresh cadence for iCal sources. The UI **Reload** button forces an immediate refresh regardless.
- **`countdown.target`** — ISO date. Leave empty (`""`) to hide the countdown.

The config file is **live-reloaded** — edit and save; the server picks up the change on the next request (or on `/api/reload`).

`projects.json` and `capabilities.json` — edit freely; same live-reload behavior.

---

## Endpoints

| Method | Path           | Purpose                                       |
|--------|----------------|-----------------------------------------------|
| GET    | `/`            | Dashboard UI                                  |
| GET    | `/api/data`    | All view data (events, projects, etc.) as JSON |
| GET    | `/api/config`  | Public config snapshot                         |
| POST   | `/api/reload`  | Force re-fetch all iCal sources + bust caches  |
| GET    | `/api/reload`  | Same as POST (for convenience)                 |
| GET    | `/<file>`      | Static files from `static/` (path-traversal blocked) |

---

## Keyboard shortcuts

| Key            | Action                  |
|----------------|-------------------------|
| `←` / `p`      | Previous view           |
| `→` / `n`      | Next view               |
| `Space`        | Pause / resume rotation |
| `r`            | Reload data             |
| `t`            | Toggle tweaks panel     |

The footer has buttons for the same actions, plus per-view dots.

---

## Notes & limits

- **iCal parser** handles plain `VEVENT` blocks with `DTSTART`/`DTEND`/`DURATION`/`SUMMARY`/`LOCATION`/`DESCRIPTION` and basic `TZID=` parameters. It does **not** expand recurring events (`RRULE`) — if you need that, point the URL at a service that pre-expands them, or extend `_fetch_ical` in `server.py`.
- **Fonts** are committed pre-embedded so the dashboard works fully offline. To regenerate them after editing the font set, see the comment block in `server.py` or re-run the embedding step.
- **No auth.** Run on a trusted LAN, or front it with nginx + basic auth if you need to expose it.

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
WorkingDirectory=/opt/tackeff-dashboard
ExecStart=/usr/bin/python3 /opt/tackeff-dashboard/server.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tackeff-dashboard
```

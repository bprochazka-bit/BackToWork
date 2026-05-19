# TackEff Group Dashboard

A self-contained, full-screen TV/monitor dashboard for the TackEff Group.

- **Backend:** single-file Python 3 HTTP server (`server.py`), stdlib only.
- **Frontend:** plain HTML/CSS/JS, no CDN, no build step, no internet at runtime.
- **Design:** fixed 3840×2160 canvas, JS-scaled to fit any viewport (works great on 1080p and 4K TVs).
- **Fonts:** Inter Tight + JetBrains Mono embedded as base64 in `static/fonts.css` (~360 KB).
- **Data:** rendered from `/api/data` — a list of **pages**, each one a *View Template* bound to a data source (Vikunja or iCal).

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
│   ├── config.json              # Port, Vikunja conn, pages, refresh interval
│   ├── projects.json            # Offline-demo data for a Project View page
│   └── capabilities.json        # Offline-demo data for a Card View page
└── static/
    ├── index.html
    ├── fonts.css                # Embedded fonts (base64)
    ├── styles.css               # 4K canvas styles
    ├── data-loader.js           # Fetches /api/data (pages), injects scripts
    ├── dashboard.js             # Shell + rotator, builds views from pages
    ├── calendar-view.js         # Calendar template (iCal-backed)
    ├── card-view.js             # Card View template (Vikunja-backed)
    ├── pseudo-gantt-view.js     # Project View template (Vikunja-backed)
    ├── kanban-view.js           # Kanban View template (Vikunja-backed)
    ├── lyteworks-view.js        # Lyteworks Slide template (Course Architect)
    ├── tweaks.js                # Runtime tweaks panel (press 't')
    └── sample.ics               # Demo calendar data
```

Each view is a **template** registered in `window.VIEW_TEMPLATES`
(`calendar`, `card`, `pseudo_gantt`, `kanban`, `lyteworks`). A **page** =
one template + one source. Add a new template by registering one render
function and adding a page entry in `config.json`.

---

## Configuration — `config/config.json`

```json
{
  "port": 8181,
  "reload_interval_seconds": 300,

  "vikunja": {
    "base_url": "https://vikunja.example.com",
    "token": "",
    "token_env": "VIKUNJA_TOKEN"
  },

  "pages": [
    {"id": "cal-1",  "template": "calendar",     "name": "Team Calendar",
     "ical_urls": [{"url": "https://example.com/team.ics", "category": 1}]},
    {"id": "prj-1",  "template": "pseudo_gantt",  "vikunja_project_id": 8},
    {"id": "cap-1",  "template": "card",          "vikunja_project_id": 5}
  ]
}
```

- **`pages`** — ordered list. Each entry binds one **template** to one
  source. Pages render and rotate in array order.
  - `calendar` → `ical_urls` (list of strings or `{url, category}`;
    category 1–5 sets event color: 1=Sync 2=Review 3=External 4=Field
    5=Offsite).
  - `card` / `pseudo_gantt` / `kanban` → `vikunja_project_id`. The view
    title is the Vikunja project name; its **subprojects** populate the
    view. **Card View** = one card per subproject (its tasks listed,
    completed/total counted). **Project View** = the first subproject's
    tasks become the column headers; every subproject is a row with cells
    aligned by task position showing completion. **Kanban View** = every
    subproject is a row showing **its own** kanban buckets as swimlanes;
    each cell is that lane's task count. Row width scales with the
    project's lane count, capped so one lane never spans the whole row.
    An empty lane with no tasks in any preceding lane reads "Completed".
  - `lyteworks` → `lyteworks_course_id`. Pulls a Course Architect
    course's slide-deck-status dashboard. One row per module; each of
    the 5 production phases (Topic Validation, Content Review,
    Formatting Review, Sign Off, Dry Run) shows decks-complete / total
    decks, color-coded (green = all, amber = partial, grey = none). A
    lecture with no slide deck counts as one incomplete deck toward the
    totals. Requires the `lyteworks.base_url` block.
  - For an offline demo, replace the Vikunja source with
    `"local_json": "projects.json"` (or `capabilities.json`).
- **`vikunja.base_url`** — host root (no `/api/v1`). Provide the API token
  via `token`, or leave it blank and set the env var named by `token_env`.
- **`reload_interval_seconds`** — background refresh cadence for all
  sources. The UI **Reload** button forces an immediate refresh.
- **`countdown.target`** — optional ISO date on a `pseudo_gantt` page
  (or top-level default). Leave empty (`""`) to hide the countdown.

The config file is **live-reloaded** — edit and save; the server picks up the change on the next request (or on `/api/reload`).

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

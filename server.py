#!/usr/bin/env python3
"""TackEff Group Dashboard — Python native HTTP server (Debian 13, stdlib only)"""

import json
import os
import sys
import time
import threading
import mimetypes
import re
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from datetime import datetime, timezone, timedelta
import urllib.request
import urllib.error
import urllib.parse

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
CONFIG_DIR = BASE_DIR / "config"

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")

# ─────────────────────────────────────────
# Config management (live-reload on change)
# ─────────────────────────────────────────
_config_cache: dict = {}
_config_mtime: float = 0.0
_config_lock = threading.Lock()


def load_config() -> dict:
    global _config_cache, _config_mtime
    path = CONFIG_DIR / "config.json"
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return _config_cache or {}
    with _config_lock:
        if mtime != _config_mtime:
            with open(path, encoding="utf-8") as f:
                _config_cache = json.load(f)
            _config_mtime = mtime
    return _config_cache


# ─────────────────────────────────────────
# iCal fetching + parsing (pure stdlib)
# ─────────────────────────────────────────
_ical_cache: dict = {}   # url -> {"events": [...], "fetched_at": float}
_ical_lock = threading.Lock()


def _unfold(text: str) -> str:
    """Unfold RFC 5545 line continuations."""
    return re.sub(r"\r?\n[ \t]", "", text)


def _parse_dt(value: str, tzid: str | None = None) -> datetime | None:
    """Parse an iCal DTSTART/DTEND value into a naive local datetime."""
    value = value.strip()
    try:
        if value.endswith("Z"):
            dt = datetime.strptime(value[:-1], "%Y%m%dT%H%M%S")
            dt = dt.replace(tzinfo=timezone.utc).astimezone().replace(tzinfo=None)
        elif "T" in value:
            dt = datetime.strptime(value, "%Y%m%dT%H%M%S")
        else:
            dt = datetime.strptime(value, "%Y%m%d")
        return dt
    except ValueError:
        return None


def _parse_duration(s: str) -> timedelta | None:
    m = re.match(r"P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", s)
    if not m:
        return None
    w, d, h, mi, sec = (int(x or 0) for x in m.groups())
    return timedelta(weeks=w, days=d, hours=h, minutes=mi, seconds=sec)


def _fetch_ical(url: str) -> list[dict]:
    """Fetch an iCal URL and return a list of event dicts."""
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "TackEff-Dashboard/1.0"}
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"[ical] fetch error {url}: {exc}", file=sys.stderr)
        return []

    raw = _unfold(raw)
    events: list[dict] = []
    cur: dict | None = None

    for line in raw.splitlines():
        line = line.rstrip()
        if not line:
            continue

        if line == "BEGIN:VEVENT":
            cur = {}
            continue
        if line == "END:VEVENT":
            if cur is not None and cur.get("summary"):
                events.append(cur)
            cur = None
            continue

        if cur is None:
            continue

        # Split name;params:value
        colon = line.find(":")
        if colon < 0:
            continue
        name_params = line[:colon]
        value = line[colon + 1:]

        # Extract bare property name and optional TZID param
        parts = name_params.split(";")
        prop = parts[0].upper()
        tzid = None
        for p in parts[1:]:
            if p.upper().startswith("TZID="):
                tzid = p[5:]

        if prop == "SUMMARY":
            cur["summary"] = value
        elif prop == "DTSTART":
            cur["dtstart"] = value
            cur["dtstart_tzid"] = tzid
        elif prop == "DTEND":
            cur["dtend"] = value
            cur["dtend_tzid"] = tzid
        elif prop == "DURATION":
            cur["duration"] = value
        elif prop == "LOCATION":
            cur["location"] = value
        elif prop == "DESCRIPTION":
            cur["description"] = value
        elif prop == "CATEGORIES":
            cur["categories"] = value
        elif prop == "UID":
            cur["uid"] = value

    result = []
    for ev in events:
        start = _parse_dt(ev.get("dtstart", ""), ev.get("dtstart_tzid"))
        if start is None:
            continue
        end = None
        if "dtend" in ev:
            end = _parse_dt(ev["dtend"], ev.get("dtend_tzid"))
        elif "duration" in ev:
            dur = _parse_duration(ev["duration"])
            if dur:
                end = start + dur
        if end is None:
            end = start + timedelta(hours=1)

        result.append(
            {
                "title": ev.get("summary", "Event"),
                "start": start.isoformat(),
                "end": end.isoformat(),
                "loc": ev.get("location", ""),
                "description": ev.get("description", ""),
                "categories": ev.get("categories", ""),
                "cat": 1,  # overridden per-source below
            }
        )
    return result


def _get_cached_events(url: str, max_age: float) -> list[dict] | None:
    with _ical_lock:
        entry = _ical_cache.get(url)
    if entry and (time.time() - entry["fetched_at"]) < max_age:
        return entry["events"]
    return None


def _store_cache(url: str, events: list[dict]) -> None:
    with _ical_lock:
        _ical_cache[url] = {"events": events, "fetched_at": time.time()}


def get_all_events(config: dict) -> list[dict]:
    """Return merged events from all configured iCal sources."""
    sources = config.get("ical_urls", [])
    reload_interval = config.get("reload_interval_seconds", 300)
    all_events: list[dict] = []

    for src in sources:
        if isinstance(src, str):
            url, cat = src, 1
        else:
            url = src.get("url", "")
            cat = src.get("category", 1)
        if not url:
            continue

        cached = _get_cached_events(url, reload_interval)
        if cached is None:
            cached = _fetch_ical(url)
            _store_cache(url, cached)

        for ev in cached:
            ev2 = dict(ev)
            ev2["cat"] = cat
            all_events.append(ev2)

    return all_events


def refresh_all_ical(config: dict) -> None:
    """Force-refresh every iCal source (used by background thread and /api/reload)."""
    for src in config.get("ical_urls", []):
        url = src if isinstance(src, str) else src.get("url", "")
        if url:
            events = _fetch_ical(url)
            _store_cache(url, events)
    print(f"[ical] refreshed {datetime.now().strftime('%H:%M:%S')}", flush=True)


# ─────────────────────────────────────────
# Background refresh thread
# ─────────────────────────────────────────

def _start_refresh_thread() -> None:
    def loop() -> None:
        while True:
            try:
                cfg = load_config()
                interval = cfg.get("reload_interval_seconds", 300)
                time.sleep(interval)
                refresh_all_ical(cfg)
            except Exception as exc:
                print(f"[refresh-thread] {exc}", file=sys.stderr)

    t = threading.Thread(target=loop, daemon=True, name="ical-refresh")
    t.start()


# ─────────────────────────────────────────
# Project status computation
# ─────────────────────────────────────────

def _compute_overall(phases: list[dict]) -> tuple[float, str]:
    """Return (overall_fraction, status) from a phase list.

    Overall is the mean of per-phase completion (`p`). Status escalates to the
    worst per-phase state: any `bad` → bad, else any `warn` → warn, else if
    every phase is `done` → done, else `ok`.
    """
    if not phases:
        return 0.0, "idle"
    total = sum(ph.get("p", 0.0) for ph in phases)
    overall = round(total / len(phases), 4)

    states = [ph.get("s", "idle") for ph in phases]
    if "bad" in states:
        status = "bad"
    elif "warn" in states:
        status = "warn"
    elif all(s == "done" for s in states):
        status = "done"
    else:
        status = "ok"
    return overall, status


# ─────────────────────────────────────────
# HTTP Handler
# ─────────────────────────────────────────

class DashboardHandler(BaseHTTPRequestHandler):
    server_version = "TackEff/1.0"
    sys_version = ""

    def log_message(self, fmt: str, *args) -> None:
        print(f"  {self.address_string()} {fmt % args}", flush=True)

    # ── helpers ──────────────────────────

    def _send_json(self, data: object, status: int = 200) -> None:
        body = json.dumps(data, default=str, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path: Path) -> None:
        try:
            data = path.read_bytes()
        except FileNotFoundError:
            self.send_error(404, f"Not found: {path.name}")
            return
        mime, _ = mimetypes.guess_type(str(path))
        mime = mime or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        # Reasonable cache for static assets
        self.send_header("Cache-Control", "max-age=60")
        self.end_headers()
        self.wfile.write(data)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else b""

    # ── routing ──────────────────────────

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ("/", "/index.html"):
            self._send_file(STATIC_DIR / "index.html")
        elif path in ("/admin", "/admin/", "/admin.html"):
            self._send_file(STATIC_DIR / "admin.html")
        elif path == "/api/data":
            self._api_data()
        elif path == "/api/reload":
            self._api_reload()
        elif path == "/api/config":
            self._api_config()
        elif path == "/api/projects":
            self._api_projects_get()
        elif path == "/api/capabilities":
            self._api_capabilities_get()
        else:
            # Static files
            target = (STATIC_DIR / path.lstrip("/")).resolve()
            # Security: stay inside STATIC_DIR
            try:
                target.relative_to(STATIC_DIR.resolve())
            except ValueError:
                self.send_error(403)
                return
            if target.is_file():
                self._send_file(target)
            else:
                self.send_error(404)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/reload":
            self._api_reload()
        elif path == "/api/projects":
            self._api_projects_put()
        elif path == "/api/capabilities":
            self._api_capabilities_put()
        else:
            self.send_error(404)

    def do_PUT(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/projects":
            self._api_projects_put()
        elif path == "/api/capabilities":
            self._api_capabilities_put()
        else:
            self.send_error(404)

    # ── API handlers ─────────────────────

    def _api_data(self) -> None:
        try:
            config = load_config()

            with open(CONFIG_DIR / "projects.json", encoding="utf-8") as f:
                projects = json.load(f)
            with open(CONFIG_DIR / "capabilities.json", encoding="utf-8") as f:
                capabilities = json.load(f)

            events = get_all_events(config)

            cd = config.get("countdown", {})
            countdown = {
                "label": cd.get("label", "Critical Deadline"),
                "target": cd.get("target", ""),
                "targetLabel": cd.get("target_label", "TBD"),
            }

            phases = config.get(
                "phases",
                [
                    "Initial Concept", "Hardware Design", "Software Design",
                    "Hardware Purchase", "Hardware Received", "Initial Build",
                    "Dry Run", "Final Build", "Deploy",
                ],
            )

            self._send_json(
                {
                    "events": events,
                    "projects": projects,
                    "capabilities": capabilities,
                    "phases": phases,
                    "countdown": countdown,
                    "reload_interval_seconds": config.get("reload_interval_seconds", 300),
                    "last_updated": datetime.now().isoformat(),
                }
            )
        except Exception as exc:
            import traceback
            traceback.print_exc()
            self._send_json({"error": str(exc)}, 500)

    def _api_reload(self) -> None:
        try:
            # Bust config cache
            global _config_mtime
            with _config_lock:
                _config_mtime = 0.0
            config = load_config()
            # Clear iCal cache so next request re-fetches
            with _ical_lock:
                _ical_cache.clear()
            # Eagerly refresh in background to avoid making caller wait
            t = threading.Thread(
                target=refresh_all_ical, args=(config,), daemon=True
            )
            t.start()
            self._send_json({"ok": True, "reloaded_at": datetime.now().isoformat()})
        except Exception as exc:
            self._send_json({"error": str(exc)}, 500)

    def _api_projects_get(self) -> None:
        try:
            with open(CONFIG_DIR / "projects.json", encoding="utf-8") as f:
                projects = json.load(f)
            config = load_config()
            phases = config.get("phases", [])
            self._send_json({"projects": projects, "phases": phases})
        except Exception as exc:
            self._send_json({"error": str(exc)}, 500)

    def _api_projects_put(self) -> None:
        try:
            raw = self._read_body()
            if not raw:
                self._send_json({"error": "empty body"}, 400)
                return
            data = json.loads(raw.decode("utf-8"))
            projects = data.get("projects") if isinstance(data, dict) else data
            if not isinstance(projects, list):
                self._send_json({"error": "expected {projects: [...]}"}, 400)
                return

            phase_count = len(load_config().get("phases", []))
            cleaned = []
            for proj in projects:
                if not isinstance(proj, dict):
                    continue
                name = str(proj.get("name", "")).strip()
                code = str(proj.get("code", "")).strip()
                if not name:
                    continue
                phases_in = proj.get("phases", []) or []
                phases_out = []
                for i in range(phase_count):
                    src = phases_in[i] if i < len(phases_in) else {}
                    s = src.get("s", "idle")
                    if s not in ("idle", "ok", "warn", "bad", "done"):
                        s = "idle"
                    try:
                        p = float(src.get("p", 0.0))
                    except (TypeError, ValueError):
                        p = 0.0
                    if s == "done":
                        p = 1.0
                    elif s == "idle":
                        p = 0.0
                    p = max(0.0, min(1.0, p))
                    try:
                        d = int(src.get("d", 0))
                    except (TypeError, ValueError):
                        d = 0
                    phases_out.append({"s": s, "p": p, "d": d})

                overall, status = _compute_overall(phases_out)
                cleaned.append({
                    "name": name,
                    "code": code,
                    "phases": phases_out,
                    "overall": overall,
                    "status": status,
                })

            path = CONFIG_DIR / "projects.json"
            tmp = path.with_suffix(".json.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(cleaned, f, indent=2, ensure_ascii=False)
            os.replace(tmp, path)

            self._send_json({"ok": True, "projects": cleaned})
        except json.JSONDecodeError as exc:
            self._send_json({"error": f"invalid JSON: {exc}"}, 400)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            self._send_json({"error": str(exc)}, 500)

    def _api_capabilities_get(self) -> None:
        try:
            with open(CONFIG_DIR / "capabilities.json", encoding="utf-8") as f:
                caps = json.load(f)
            self._send_json({"capabilities": caps})
        except Exception as exc:
            self._send_json({"error": str(exc)}, 500)

    def _api_capabilities_put(self) -> None:
        try:
            raw = self._read_body()
            if not raw:
                self._send_json({"error": "empty body"}, 400)
                return
            data = json.loads(raw.decode("utf-8"))
            caps = data.get("capabilities") if isinstance(data, dict) else data
            if not isinstance(caps, list):
                self._send_json({"error": "expected {capabilities: [...]}"}, 400)
                return

            cleaned = []
            for cap in caps:
                if not isinstance(cap, dict):
                    continue
                name = str(cap.get("name", "")).strip()
                code = str(cap.get("code", "")).strip()
                if not name:
                    continue
                tasks_in = cap.get("tasks", []) or []
                tasks_out = []
                for task in tasks_in:
                    if not isinstance(task, dict):
                        continue
                    t_name = str(task.get("name", "")).strip()
                    if not t_name:
                        continue
                    tasks_out.append({
                        "name": t_name,
                        "owner": str(task.get("owner", "")).strip(),
                        "done": bool(task.get("done", False)),
                    })
                cleaned.append({"name": name, "code": code, "tasks": tasks_out})

            path = CONFIG_DIR / "capabilities.json"
            tmp = path.with_suffix(".json.tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(cleaned, f, indent=2, ensure_ascii=False)
            os.replace(tmp, path)

            self._send_json({"ok": True, "capabilities": cleaned})
        except json.JSONDecodeError as exc:
            self._send_json({"error": f"invalid JSON: {exc}"}, 400)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            self._send_json({"error": str(exc)}, 500)

    def _api_config(self) -> None:
        try:
            config = load_config()
            self._send_json(
                {
                    "port": config.get("port", 8181),
                    "reload_interval_seconds": config.get("reload_interval_seconds", 300),
                    "countdown": config.get("countdown", {}),
                    "ical_urls": config.get("ical_urls", []),
                    "phases": config.get("phases", []),
                }
            )
        except Exception as exc:
            self._send_json({"error": str(exc)}, 500)


# ─────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────

def main() -> None:
    config = load_config()
    port = config.get("port", 8181)

    _start_refresh_thread()

    server = ThreadingHTTPServer(("0.0.0.0", port), DashboardHandler)
    print(f"TackEff Dashboard  →  http://0.0.0.0:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()

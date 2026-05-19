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


def _events_from_sources(sources: list, reload_interval: float) -> list[dict]:
    """Return merged events from a list of iCal source entries."""
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


# ─────────────────────────────────────────
# Vikunja client (subproject-backed pages)
# ─────────────────────────────────────────
_vk_cache: dict = {}   # project_id -> {"tree": {...}, "fetched_at": float}
_vk_lock = threading.Lock()


def _vk_token(vk: dict) -> str:
    tok = vk.get("token")
    if tok:
        return tok
    return os.environ.get(vk.get("token_env", "VIKUNJA_TOKEN"), "")


def _vk_request(api_base: str, path: str, token: str, params: dict | None = None):
    url = api_base.rstrip("/") + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "TackEff-Dashboard/1.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _vk_paginated(api_base: str, path: str, token: str, params: dict | None = None) -> list:
    params = dict(params or {})
    params.setdefault("per_page", 50)
    out: list = []
    page = 1
    while page <= 100:
        params["page"] = page
        batch = _vk_request(api_base, path, token, params)
        if not isinstance(batch, list) or not batch:
            break
        out.extend(batch)
        if len(batch) < params["per_page"]:
            break
        page += 1
    return out


def _vk_buckets(api_base: str, token: str, pid: int) -> list:
    """Return kanban buckets for a project, ordered by position.

    Handles both the views-aware API (Vikunja >= 0.22) and the legacy
    /projects/{id}/buckets endpoint. Returns [] if neither works.
    """
    buckets = None
    try:
        views = _vk_request(api_base, f"/projects/{pid}/views", token)
        if isinstance(views, list):
            kb = next((v for v in views
                       if str(v.get("view_kind", "")).lower() == "kanban"), None)
            if kb:
                buckets = _vk_request(
                    api_base,
                    f"/projects/{pid}/views/{kb['id']}/buckets", token)
    except Exception:
        buckets = None
    if not isinstance(buckets, list):
        try:
            buckets = _vk_request(api_base, f"/projects/{pid}/buckets", token)
        except Exception:
            buckets = []
    if not isinstance(buckets, list):
        return []
    norm = [
        {
            "id": b.get("id"),
            "title": b.get("title") or f"Lane {b.get('id')}",
            "position": b.get("position") or 0,
            "tasks": b.get("tasks") or [],
        }
        for b in buckets if isinstance(b, dict)
    ]
    norm.sort(key=lambda b: (b["position"], b["id"] or 0))
    return norm


def _fetch_vikunja_tree(vk: dict, project_id: int, ttl: float) -> dict:
    """Fetch a Vikunja project, its subprojects, and each subproject's tasks.

    On fetch failure, falls back to the last cached tree if one exists.
    """
    now = time.time()
    with _vk_lock:
        ent = _vk_cache.get(project_id)
    if ent and (now - ent["fetched_at"]) < ttl:
        return ent["tree"]

    api_base = vk.get("base_url", "").rstrip("/") + "/api/v1"
    token = _vk_token(vk)
    try:
        proj = _vk_request(api_base, f"/projects/{project_id}", token)
        all_projects = _vk_paginated(api_base, "/projects", token)
        subs = [p for p in all_projects
                if isinstance(p, dict) and p.get("parent_project_id") == project_id]
        subs.sort(key=lambda p: (p.get("position") or 0, p.get("id") or 0))

        tree = {
            "title": proj.get("title") or f"Project {project_id}",
            "subprojects": [],
        }
        for s in subs:
            tasks = _vk_paginated(
                api_base, f"/projects/{s['id']}/tasks", token,
                {"sort_by": "index", "order_by": "asc"},
            )
            tasks = [t for t in tasks if isinstance(t, dict)]
            tasks.sort(key=lambda t: (t.get("index")
                                      if t.get("index") is not None
                                      else (t.get("id") or 0)))
            tree["subprojects"].append({
                "id": s["id"],
                "title": s.get("title") or f"#{s['id']}",
                "tasks": tasks,
                "buckets": _vk_buckets(api_base, token, s["id"]),
            })
    except Exception as exc:
        print(f"[vikunja] fetch error project {project_id}: {exc}", file=sys.stderr)
        if ent:
            return ent["tree"]
        raise

    with _vk_lock:
        _vk_cache[project_id] = {"tree": tree, "fetched_at": now}
    return tree


def _vk_task_owner(t: dict) -> str:
    assignees = t.get("assignees") or []
    if assignees:
        u = assignees[0]
        return u.get("name") or u.get("username") or ""
    return ""


def _vk_task_progress(t: dict) -> float:
    if t.get("done"):
        return 1.0
    pd = t.get("percent_done")
    if pd is None:
        return 0.0
    try:
        pd = float(pd)
    except (TypeError, ValueError):
        return 0.0
    if pd > 1:
        pd = pd / 100.0
    return max(0.0, min(1.0, pd))


def _card_data_from_tree(tree: dict) -> dict:
    cards = []
    for s in tree["subprojects"]:
        tasks = [
            {
                "name": t.get("title") or "Untitled",
                "owner": _vk_task_owner(t),
                "done": bool(t.get("done")),
            }
            for t in s["tasks"]
        ]
        cards.append({"name": s["title"], "code": f"#{s['id']}", "tasks": tasks})
    return {"title": tree["title"], "cards": cards}


def _gantt_data_from_tree(tree: dict) -> dict:
    subs = tree["subprojects"]
    columns = ([t.get("title") or f"T{i+1}"
                for i, t in enumerate(subs[0]["tasks"])] if subs else [])
    rows = []
    for s in subs:
        cells, ps = [], []
        for i in range(len(columns)):
            if i < len(s["tasks"]):
                p = _vk_task_progress(s["tasks"][i])
                st = "done" if p >= 1.0 else "idle" if p <= 0.0 else "ok"
                cells.append({"s": st, "p": round(p, 3), "d": 0})
                ps.append(p)
            else:
                cells.append({"s": "idle", "p": 0.0, "d": 0})
                ps.append(0.0)
        overall = round(sum(ps) / len(ps), 3) if ps else 0.0
        if ps and all(x >= 1.0 for x in ps):
            status = "done"
        elif not ps or all(x <= 0.0 for x in ps):
            status = "idle"
        else:
            status = "ok"
        rows.append({
            "name": s["title"], "code": f"#{s['id']}",
            "cells": cells, "overall": overall, "status": status,
        })
    return {"title": tree["title"], "columns": columns, "rows": rows}


def _kanban_data_from_tree(tree: dict) -> dict:
    """Each subproject shows its OWN kanban buckets as swimlanes."""
    rows = []
    for s in tree["subprojects"]:
        buckets = s["buckets"]
        counts = {b["id"]: 0 for b in buckets}
        matched = False
        for t in s["tasks"]:
            bid = t.get("bucket_id")
            if bid in counts:
                counts[bid] += 1
                matched = True
        # Fallback: tasks didn't carry a usable bucket_id — use the
        # task lists embedded in the bucket objects.
        if not matched and s["tasks"]:
            for b in buckets:
                counts[b["id"]] = len(b.get("tasks") or [])
        lanes = [{"name": b["title"], "count": counts.get(b["id"], 0)}
                 for b in buckets]
        rows.append({
            "name": s["title"],
            "code": f"#{s['id']}",
            "lanes": lanes,
            "total": sum(l["count"] for l in lanes),
        })
    return {"title": tree["title"], "rows": rows}


# ─────────────────────────────────────────
# Lyteworks / Course Architect (slide-deck status)
# ─────────────────────────────────────────
_lw_cache: dict = {}   # course_id -> {"status": {...}, "fetched_at": float}
_lw_lock = threading.Lock()

LW_PHASES = [
    "topic_validation", "content_review", "formatting_review",
    "sign_off", "dry_run",
]
LW_PHASE_LABELS = {
    "topic_validation": "Topic Validation",
    "content_review": "Content Review",
    "formatting_review": "Formatting Review",
    "sign_off": "Sign Off",
    "dry_run": "Dry Run",
}


def _fetch_lyteworks_status(lw: dict, course_id, ttl: float) -> dict:
    """GET the slide-deck-status dashboard for a course. Falls back to
    the last cached payload on a fetch failure."""
    now = time.time()
    with _lw_lock:
        ent = _lw_cache.get(course_id)
    if ent and (now - ent["fetched_at"]) < ttl:
        return ent["status"]

    base = lw.get("base_url", "").rstrip("/")
    headers = {
        "User-Agent": "TackEff-Dashboard/1.0",
        "Accept": "application/json",
    }
    token = lw.get("token") or os.environ.get(
        lw.get("token_env", "LYTEWORKS_TOKEN"), "")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = f"{base}/api/courses/{course_id}/slide-deck-status"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            status = json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception as exc:
        print(f"[lyteworks] fetch error course {course_id}: {exc}",
              file=sys.stderr)
        if ent:
            return ent["status"]
        raise

    with _lw_lock:
        _lw_cache[course_id] = {"status": status, "fetched_at": now}
    return status


def _lw_name(node: dict, default: str = "") -> str:
    return (node.get("name") or node.get("title")
            or node.get("label") or default)


def _lw_deck_phase_map(deck: dict) -> dict:
    """Return a {phase: bool} map for a deck, tolerating a few likely
    field names for the per-phase completion data."""
    for key in ("phases", "phase_completion", "completion",
                "completion_map", "phase_status"):
        m = deck.get(key)
        if isinstance(m, dict):
            return m
    # Deck-level "done" status implies every phase is complete.
    if str(deck.get("status", "")).lower() == "done":
        return {p: True for p in LW_PHASES}
    return {}


def _lw_phase_done(pmap: dict, phase: str) -> bool:
    v = pmap.get(phase)
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("done", "complete", "completed", "true", "yes")
    if isinstance(v, dict):
        return bool(v.get("done") or v.get("complete") or v.get("completed"))
    return bool(v)


def _lyteworks_data_from_status(status: dict) -> dict:
    """One row per module. Each of the 5 phases gets a count of decks
    complete for that phase over the module's total deck count. A
    lecture with no deck counts as one (incomplete) deck toward totals.
    """
    rows = []
    for m in status.get("modules", []) or []:
        total_decks = 0
        done = [0] * len(LW_PHASES)
        lectures = m.get("lectures", []) or []
        for lec in lectures:
            decks = lec.get("decks", []) or []
            if not decks:
                # Deckless lecture: counts toward the total, complete
                # for no phase.
                total_decks += 1
                continue
            for deck in decks:
                total_decks += 1
                pmap = _lw_deck_phase_map(deck)
                for i, ph in enumerate(LW_PHASES):
                    if _lw_phase_done(pmap, ph):
                        done[i] += 1

        cells = []
        for i in range(len(LW_PHASES)):
            d, t = done[i], total_decks
            s = ("done" if t > 0 and d == t
                 else "idle" if d == 0 else "ok")
            cells.append({"done": d, "total": t, "s": s})

        dl = m.get("done_lectures")
        tl = m.get("total_lectures", len(lectures))
        rows.append({
            "name": _lw_name(m, "Module"),
            "code": (f"{dl}/{tl} lectures" if dl is not None
                     else f"{tl} lectures"),
            "total": total_decks,
            "cells": cells,
        })

    return {
        "title": _lw_name(status, "Slide Production"),
        "phases": [LW_PHASE_LABELS[p] for p in LW_PHASES],
        "rows": rows,
    }


# ─────────────────────────────────────────
# Page assembly (template + source binding)
# ─────────────────────────────────────────

def _default_pages(config: dict) -> list[dict]:
    """Backward-compatible pages when config has no explicit `pages`."""
    return [
        {"id": "calendar-1", "template": "calendar",
         "ical_urls": config.get("ical_urls", [])},
        {"id": "projects-1", "template": "pseudo_gantt",
         "local_json": "projects.json"},
        {"id": "capabilities-1", "template": "card",
         "local_json": "capabilities.json"},
    ]


def _build_calendar_page(config: dict, pc: dict) -> dict:
    sources = pc.get("ical_urls") or config.get("ical_urls", [])
    events = _events_from_sources(
        sources, config.get("reload_interval_seconds", 300))
    cd = pc.get("countdown") or config.get("countdown", {}) or {}
    return {
        "title": pc.get("name") or "Calendar",
        "events": events,
        "countdown": {
            "label": cd.get("label", "Critical Deadline"),
            "target": cd.get("target", ""),
            "targetLabel": cd.get("target_label", cd.get("targetLabel", "TBD")),
        },
    }


def _build_local_page(config: dict, pc: dict, tpl: str) -> dict:
    with open(CONFIG_DIR / pc["local_json"], encoding="utf-8") as f:
        content = json.load(f)
    if tpl == "card":
        cards = [
            {"name": c.get("name"), "code": c.get("code", ""),
             "tasks": c.get("tasks", [])}
            for c in content
        ]
        return {"title": pc.get("name") or "Capabilities", "cards": cards}
    rows = []
    for p in content:
        cells = [
            {"s": ph.get("s", "idle"), "p": ph.get("p", 0.0), "d": ph.get("d", 0)}
            for ph in p.get("phases", [])
        ]
        rows.append({
            "name": p.get("name"), "code": p.get("code", ""), "cells": cells,
            "overall": p.get("overall", 0.0), "status": p.get("status", "idle"),
        })
    return {
        "title": pc.get("name") or "Projects",
        "columns": config.get("phases", []),
        "rows": rows,
        "countdown": config.get("countdown", {}),
    }


def _build_vikunja_page(config: dict, pc: dict, tpl: str) -> dict:
    if pc.get("local_json"):
        return _build_local_page(config, pc, tpl)
    vk = config.get("vikunja") or {}
    pid = pc.get("vikunja_project_id")
    if not vk.get("base_url") or pid is None:
        return {"title": pc.get("name") or tpl,
                "error": "Vikunja not configured for this page"}
    tree = _fetch_vikunja_tree(
        vk, pid, config.get("reload_interval_seconds", 300))
    if tpl == "card":
        data = _card_data_from_tree(tree)
    elif tpl == "kanban":
        data = _kanban_data_from_tree(tree)
    else:
        data = _gantt_data_from_tree(tree)
    if pc.get("name"):
        data["title"] = pc["name"]
    return data


def _build_lyteworks_page(config: dict, pc: dict) -> dict:
    lw = config.get("lyteworks") or {}
    cid = pc.get("lyteworks_course_id")
    if not lw.get("base_url") or cid is None:
        return {"title": pc.get("name") or "Lyteworks Slide",
                "error": "Lyteworks not configured for this page"}
    status = _fetch_lyteworks_status(
        lw, cid, config.get("reload_interval_seconds", 300))
    data = _lyteworks_data_from_status(status)
    if pc.get("name"):
        data["title"] = pc["name"]
    return data


def build_pages(config: dict) -> list[dict]:
    pages_cfg = config.get("pages") or _default_pages(config)
    out = []
    for i, pc in enumerate(pages_cfg):
        tpl = pc.get("template")
        pid = pc.get("id") or f"{tpl or 'page'}-{i+1}"
        try:
            if tpl == "calendar":
                data = _build_calendar_page(config, pc)
            elif tpl in ("card", "pseudo_gantt", "kanban"):
                data = _build_vikunja_page(config, pc, tpl)
            elif tpl == "lyteworks":
                data = _build_lyteworks_page(config, pc)
            else:
                data = {"title": pc.get("name") or str(tpl),
                        "error": f"Unknown template: {tpl}"}
        except Exception as exc:
            import traceback
            traceback.print_exc()
            data = {"title": pc.get("name") or str(tpl), "error": str(exc)}
        out.append({
            "id": pid,
            "template": tpl,
            "name": data.get("title") or pc.get("name") or str(tpl),
            "data": data,
        })
    return out


def refresh_all(config: dict) -> None:
    """Pre-warm caches for every page (background thread + /api/reload)."""
    try:
        build_pages(config)
        print(f"[refresh] {datetime.now().strftime('%H:%M:%S')}", flush=True)
    except Exception as exc:
        print(f"[refresh] {exc}", file=sys.stderr)


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
                refresh_all(cfg)
            except Exception as exc:
                print(f"[refresh-thread] {exc}", file=sys.stderr)

    t = threading.Thread(target=loop, daemon=True, name="ical-refresh")
    t.start()


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
        elif path == "/api/data":
            self._api_data()
        elif path == "/api/reload":
            self._api_reload()
        elif path == "/api/config":
            self._api_config()
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
        else:
            self.send_error(404)

    # ── API handlers ─────────────────────

    def _api_data(self) -> None:
        try:
            config = load_config()
            self._send_json(
                {
                    "pages": build_pages(config),
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
            # Clear source caches so next request re-fetches
            with _ical_lock:
                _ical_cache.clear()
            with _vk_lock:
                _vk_cache.clear()
            with _lw_lock:
                _lw_cache.clear()
            # Eagerly refresh in background to avoid making caller wait
            t = threading.Thread(
                target=refresh_all, args=(config,), daemon=True
            )
            t.start()
            self._send_json({"ok": True, "reloaded_at": datetime.now().isoformat()})
        except Exception as exc:
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

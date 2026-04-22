/* TackEff Group Dashboard — main controller (rotator + data loader) */

(function () {
  "use strict";

  // ─── State ───────────────────────────────────────
  const state = {
    views: [],        // [{key, name, render}]
    idx: 0,
    paused: false,
    tickMs: 100,
    rotateMs: 30000,
    elapsed: 0,
    timer: null,
    data: null,
    lastRender: null, // currently mounted view key
  };

  // ─── DOM refs ────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const els = {
    host:        $("view-host"),
    splash:      $("splash"),
    viewIdx:     $("view-idx"),
    viewName:    $("view-name"),
    statusDot:   $("status-dot"),
    statusLabel: $("status-label"),
    clockTime:   $("clock-time"),
    clockDate:   $("clock-date"),
    progressFill:$("progress-fill"),
    footerDots:  $("footer-dots"),
    reloadBtn:   $("reload-btn"),
  };

  // ─── Status pill ─────────────────────────────────
  function setStatus(kind, label) {
    els.statusDot.classList.remove("ok", "warn", "bad");
    if (kind) els.statusDot.classList.add(kind);
    els.statusLabel.textContent = label;
  }

  // ─── Clock ───────────────────────────────────────
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function tickClock() {
    const d = new Date();
    els.clockTime.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    els.clockDate.textContent = days[d.getDay()] + " " + pad(d.getDate()) + " " + months[d.getMonth()] + " " + d.getFullYear();
  }
  setInterval(tickClock, 1000);
  tickClock();

  // ─── Data fetch ──────────────────────────────────
  async function fetchData() {
    const resp = await fetch("/api/data", { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const json = await resp.json();
    if (json.error) throw new Error(json.error);
    return normalize(json);
  }

  function normalize(json) {
    return {
      events: (json.events || []).map((ev) => ({
        title: ev.title || "Event",
        start: new Date(ev.start),
        end:   new Date(ev.end),
        loc:   ev.loc || "",
        cat:   ev.cat || 1,
        description: ev.description || "",
      })),
      projects:     json.projects     || [],
      capabilities: json.capabilities || [],
      phases:       json.phases       || [],
      countdown: json.countdown
        ? {
            label: json.countdown.label || "Critical Deadline",
            target: json.countdown.target ? new Date(json.countdown.target) : null,
            targetLabel: json.countdown.targetLabel || "TBD",
          }
        : null,
      lastUpdated: json.last_updated ? new Date(json.last_updated) : new Date(),
      reloadIntervalSec: json.reload_interval_seconds || 300,
    };
  }

  function showError(msg) {
    let banner = document.querySelector(".err-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "err-banner";
      document.body.appendChild(banner);
    }
    banner.textContent = msg;
    setTimeout(() => banner && banner.remove(), 5000);
  }

  // ─── View registry ───────────────────────────────
  function registerViews() {
    state.views = [];
    if (window.CalendarView)     state.views.push({ key: "cal",  name: "Calendar",     render: window.CalendarView.render });
    if (window.StatusView)       state.views.push({ key: "stv",  name: "Project Status", render: window.StatusView.render });
    if (window.CapabilitiesView) state.views.push({ key: "capv", name: "Capabilities", render: window.CapabilitiesView.render });
  }

  function renderDots() {
    els.footerDots.innerHTML = "";
    state.views.forEach((v, i) => {
      const b = document.createElement("button");
      b.className = "gf-dot" + (i === state.idx ? " active" : "");
      b.title = v.name;
      b.addEventListener("click", () => goTo(i));
      els.footerDots.appendChild(b);
    });
  }

  function mount(idx) {
    if (!state.views.length) return;
    const v = state.views[idx];
    if (!v) return;
    state.idx = idx;
    state.elapsed = 0;
    els.viewIdx.textContent = pad(idx + 1) + " / " + pad(state.views.length);
    els.viewName.textContent = v.name;

    els.host.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "view";
    els.host.appendChild(wrap);

    try {
      v.render(wrap, state.data);
    } catch (e) {
      console.error(e);
      wrap.innerHTML = '<div class="cal-empty">View error: ' + (e.message || e) + '</div>';
    }
    renderDots();
    state.lastRender = v.key;
  }

  function next() { mount((state.idx + 1) % state.views.length); }
  function prev() { mount((state.idx - 1 + state.views.length) % state.views.length); }
  function goTo(i) { mount(i % state.views.length); }

  function tick() {
    if (state.paused || !state.views.length) return;
    state.elapsed += state.tickMs;
    const pct = Math.min(100, (state.elapsed / state.rotateMs) * 100);
    els.progressFill.style.width = pct + "%";
    if (state.elapsed >= state.rotateMs) {
      next();
    }
  }

  function startTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(tick, state.tickMs);
  }

  function setPaused(p) {
    state.paused = !!p;
    setStatus(state.paused ? "warn" : "ok", state.paused ? "Paused" : "Live");
  }

  function setRotateMs(ms) {
    state.rotateMs = Math.max(2000, ms | 0);
    state.elapsed = 0;
  }

  // ─── Reload ──────────────────────────────────────
  async function reloadDashboardData() {
    if (!els.reloadBtn) return;
    els.reloadBtn.classList.add("loading");
    setStatus("warn", "Reloading");
    try {
      await fetch("/api/reload", { method: "POST" });
      // small delay so the server can refresh ical
      await new Promise((r) => setTimeout(r, 500));
      state.data = await fetchData();
      mount(state.idx);  // re-render current view with new data
      setStatus("ok", "Live");
    } catch (e) {
      console.error(e);
      showError("Reload failed: " + (e.message || e));
      setStatus("bad", "Error");
    } finally {
      setTimeout(() => els.reloadBtn.classList.remove("loading"), 400);
    }
  }
  window.reloadDashboardData = reloadDashboardData;

  // ─── Boot ────────────────────────────────────────
  async function boot() {
    setStatus(null, "Loading");
    try {
      state.data = await fetchData();
    } catch (e) {
      console.error(e);
      setStatus("bad", "No data");
      els.host.innerHTML = '<div class="cal-empty">Could not load data: ' + (e.message || e) + '<br/><br/>Check /api/data and your config.json.</div>';
      els.splash.classList.add("hidden");
      return;
    }
    registerViews();
    if (!state.views.length) {
      els.host.innerHTML = '<div class="cal-empty">No views registered.</div>';
      els.splash.classList.add("hidden");
      return;
    }
    els.splash.classList.add("hidden");
    setStatus("ok", "Live");
    mount(0);
    startTimer();

    // Auto-refresh data once per server-configured interval
    const refreshMs = Math.max(60000, state.data.reloadIntervalSec * 1000);
    setInterval(async () => {
      try {
        const fresh = await fetchData();
        state.data = fresh;
        // Re-render current view in place (no rotate reset)
        const savedElapsed = state.elapsed;
        mount(state.idx);
        state.elapsed = savedElapsed;
      } catch (e) {
        console.warn("background refresh failed:", e);
      }
    }, refreshMs);

    // Initialize tweaks panel if available
    if (window.Tweaks && typeof window.Tweaks.init === "function") {
      window.Tweaks.init({
        getRotateMs: () => state.rotateMs,
        setRotateMs,
        setPaused,
        getPaused: () => state.paused,
        getStage: () => document.getElementById("stage"),
      });
    }
  }

  // ─── Keyboard ────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "ArrowRight" || e.key === "n") next();
    else if (e.key === "ArrowLeft" || e.key === "p") prev();
    else if (e.key === " ") { e.preventDefault(); setPaused(!state.paused); }
    else if (e.key === "r") reloadDashboardData();
    else if (e.key === "t") {
      const tw = document.getElementById("tweaks-panel");
      if (tw) tw.classList.toggle("open");
    }
  });

  // Public API for footer buttons
  window.DashRotator = {
    next, prev, goTo, setPaused, setRotateMs,
    getState: () => ({ idx: state.idx, paused: state.paused, rotateMs: state.rotateMs }),
  };

  // Go.
  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();
})();

/* Data loader — fetches /api/data (a list of pages), exposes
   window.DASHBOARD_PAGES, then injects the view-template scripts
   and the dashboard shell. Each page = { id, template, name, data }. */

(function () {
  "use strict";

  const STATIC_SCRIPTS = [
    "calendar-view.js",
    "card-view.js",
    "pseudo-gantt-view.js",
    "kanban-view.js",
    "lyteworks-view.js",
    "tweaks.js",
    "dashboard.js",
  ];

  function applyData(json) {
    window.DASHBOARD_PAGES = json.pages || [];
    window.DASHBOARD_LAST_UPDATED = json.last_updated || null;
    window.DASHBOARD_RELOAD_INTERVAL = json.reload_interval_seconds || 300;
  }

  function loadScriptsSequential(names) {
    return names.reduce((chain, name) => chain.then(() => new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = name;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + name));
      document.body.appendChild(s);
    })), Promise.resolve());
  }

  async function fetchAndBoot() {
    const resp = await fetch("/api/data", { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const json = await resp.json();
    if (json.error) throw new Error(json.error);
    applyData(json);
  }

  function showFatal(msg) {
    const host = document.getElementById("view-host");
    if (!host) return;
    host.innerHTML = `<div class="view is-active" style="padding:64px; font-family: var(--font-mono); color: var(--bad);">
      <div style="font-size:32px; margin-bottom:16px;">Dashboard data error</div>
      <div style="font-size:18px; color: var(--fg-2);">${String(msg)}</div>
      <div style="font-size:14px; color: var(--fg-3); margin-top:24px; letter-spacing:0.2em;">CHECK /api/data AND config/config.json</div>
    </div>`;
  }

  function rebuild() {
    if (window.DashRotator && window.DashRotator.rebuild) {
      window.DashRotator.rebuild(window.DASHBOARD_PAGES);
    }
  }

  /* Public reload entry — used by the footer "Reload" button */
  window.DashReload = async function () {
    const btn = document.getElementById("reload-btn");
    if (btn) btn.classList.add("is-on");
    try {
      await fetch("/api/reload", { method: "POST" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 600)); // let server re-fetch sources
      const resp = await fetch("/api/data", { cache: "no-store" });
      if (resp.ok) {
        const json = await resp.json();
        if (!json.error) {
          applyData(json);
          rebuild();
        }
      }
    } finally {
      if (btn) setTimeout(() => btn.classList.remove("is-on"), 400);
    }
  };

  /* Background refresh: re-fetch /api/data once per reload interval
     so long-lived displays pick up server-side source refreshes. */
  function startBackgroundRefresh() {
    const ms = Math.max(60000, (window.DASHBOARD_RELOAD_INTERVAL || 300) * 1000);
    setInterval(async () => {
      try {
        const r = await fetch("/api/data", { cache: "no-store" });
        if (!r.ok) return;
        const json = await r.json();
        if (json.error) return;
        applyData(json);
        rebuild();
      } catch (_) { /* silent */ }
    }, ms);
  }

  /* Boot */
  fetchAndBoot()
    .then(() => loadScriptsSequential(STATIC_SCRIPTS))
    .then(startBackgroundRefresh)
    .catch((err) => {
      console.error("Dashboard boot failed:", err);
      showFatal(err.message || err);
    });
})();

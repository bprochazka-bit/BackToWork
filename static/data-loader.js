/* Data loader — fetches /api/data from the Python server,
   populates the globals expected by the prototype's views
   (window.DASHBOARD_EVENTS / PROJECTS / CAPABILITIES / PHASES / COUNTDOWN),
   then injects the remaining scripts so they can render. */

(function () {
  "use strict";

  const STATIC_SCRIPTS = [
    "calendar-view.js",
    "status-view.js",
    "capabilities-view.js",
    "tweaks.js",
    "dashboard.js",
  ];

  function toDate(x) { return x ? new Date(x) : null; }

  function applyData(json) {
    window.DASHBOARD_EVENTS = (json.events || []).map((e) => ({
      title: e.title,
      start: toDate(e.start),
      end:   toDate(e.end),
      loc:   e.loc || "",
      cat:   e.cat || 1,
    }));

    window.DASHBOARD_PROJECTS     = json.projects     || [];
    window.DASHBOARD_CAPABILITIES = json.capabilities || [];
    window.DASHBOARD_PHASES       = json.phases       || [];

    const cd = json.countdown || {};
    window.DASHBOARD_COUNTDOWN = {
      label: cd.label || "Critical Deadline",
      target: toDate(cd.target) || (() => {
        const d = new Date(); d.setDate(d.getDate() + 63); return d;
      })(),
      targetLabel: cd.targetLabel || "TBD",
    };

    window.DASHBOARD_LAST_UPDATED    = toDate(json.last_updated);
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

  /* Public reload entry — used by the footer "Reload" button */
  window.DashReload = async function () {
    const btn = document.getElementById("reload-btn");
    if (btn) btn.classList.add("is-on");
    try {
      await fetch("/api/reload", { method: "POST" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 400)); // let server re-fetch iCal
      const resp = await fetch("/api/data", { cache: "no-store" });
      if (resp.ok) {
        const json = await resp.json();
        if (!json.error) {
          applyData(json);
          if (window.DashRotator) {
            const st = window.DashRotator.getState();
            window.DashRotator.show(st.cur);
          }
        }
      }
    } finally {
      if (btn) setTimeout(() => btn.classList.remove("is-on"), 400);
    }
  };

  /* Background refresh: re-fetch /api/data once per reload interval
     so long-lived displays pick up server-side iCal refreshes. */
  function startBackgroundRefresh() {
    const ms = Math.max(60000, (window.DASHBOARD_RELOAD_INTERVAL || 300) * 1000);
    setInterval(async () => {
      try {
        const r = await fetch("/api/data", { cache: "no-store" });
        if (!r.ok) return;
        const json = await r.json();
        if (json.error) return;
        applyData(json);
        if (window.DashRotator) {
          const st = window.DashRotator.getState();
          window.DashRotator.show(st.cur);
        }
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

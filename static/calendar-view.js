/* Calendar view — week view with hourly grid */

(function () {
  "use strict";

  const HOURS_START = 7;   // 07:00
  const HOURS_END   = 21;  // 21:00 (exclusive)
  const HOUR_COUNT  = HOURS_END - HOURS_START;

  function startOfWeek(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const dow = x.getDay();              // 0=Sun … 6=Sat
    const offset = dow === 0 ? -6 : 1 - dow; // make Monday the start
    x.setDate(x.getDate() + offset);
    return x;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function fmtTimeRange(s, e) {
    return pad(s.getHours()) + ":" + pad(s.getMinutes()) + "–" + pad(e.getHours()) + ":" + pad(e.getMinutes());
  }

  function renderCountdown(cd) {
    if (!cd || !cd.target) return "";
    const now = new Date();
    const diffMs = cd.target.getTime() - now.getTime();
    const days = Math.ceil(diffMs / 86400000);
    const cls = days < 0 ? "bad" : (days < 14 ? "" : "ok");
    const label = days < 0 ? Math.abs(days) + "d overdue" : days + "d";
    return '<span class="countdown">' + cd.label + ' · ' + cd.targetLabel +
           ' <b class="' + cls + '">' + label + '</b></span>';
  }

  function render(host, data) {
    const events = data.events || [];
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

    // Filter events in this week and within visible hours
    const weekEvents = events.filter((ev) => ev.end > weekStart && ev.start < weekEnd);

    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const today = new Date();

    // Build header
    let head = '<div class="cal-head"><div></div>';
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(d.getDate() + i);
      const isToday = sameDay(d, today);
      head += '<div class="' + (isToday ? "cal-day-today" : "") + '">' +
              days[i] +
              '<div class="cal-day-num">' + d.getDate() + '</div></div>';
    }
    head += '</div>';

    // Build grid
    let grid = '<div class="cal-grid"><div class="cal-hours">';
    for (let h = HOURS_START; h < HOURS_END; h++) {
      grid += '<div class="cal-hour-label">' + pad(h) + ':00</div>';
    }
    grid += '</div>';

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(d.getDate() + i);
      const isToday = sameDay(d, today);
      grid += '<div class="cal-col' + (isToday ? " cal-col-today" : "") + '" data-day="' + i + '">';
      for (let h = HOURS_START; h < HOURS_END; h++) {
        grid += '<div class="cal-col-slot"></div>';
      }
      grid += '</div>';
    }
    grid += '</div>';

    // Title bar
    const range = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                  " – " +
                  new Date(weekEnd.getTime() - 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    const legend = '<div class="cal-legend">' +
      '<div class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--cat-1)"></span>Sync</div>' +
      '<div class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--cat-2)"></span>Review</div>' +
      '<div class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--cat-3)"></span>External</div>' +
      '<div class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--cat-4)"></span>Field</div>' +
      '<div class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--cat-5)"></span>Offsite</div>' +
      '</div>';

    host.innerHTML =
      '<div class="view-title">' +
        '<h2>This Week</h2>' +
        '<span class="view-sub">' + range + '</span>' +
        '<span class="spacer"></span>' +
        legend +
        renderCountdown(data.countdown) +
      '</div>' +
      '<div class="cal">' + head + grid + '</div>';

    // Position events
    const grid_el = host.querySelector(".cal-grid");
    if (!weekEvents.length) {
      const empty = document.createElement("div");
      empty.className = "cal-empty";
      empty.style.position = "absolute";
      empty.style.left = "56px"; empty.style.right = "0";
      empty.style.top = "50%"; empty.style.transform = "translateY(-50%)";
      empty.textContent = "No events this week";
      grid_el.appendChild(empty);
    }

    weekEvents.forEach((ev) => {
      const dayIdx = Math.floor((ev.start - weekStart) / 86400000);
      if (dayIdx < 0 || dayIdx > 6) return;

      const startMin = ev.start.getHours() * 60 + ev.start.getMinutes();
      const endMin   = ev.end.getHours()   * 60 + ev.end.getMinutes();
      const visStart = HOURS_START * 60;
      const visEnd   = HOURS_END   * 60;

      const sMin = Math.max(startMin, visStart);
      const eMin = Math.min(endMin,   visEnd);
      if (eMin <= sMin) return;

      const totalMin = HOUR_COUNT * 60;
      const topPct    = ((sMin - visStart) / totalMin) * 100;
      const heightPct = Math.max(2.5, ((eMin - sMin) / totalMin) * 100);

      const col = grid_el.querySelector('.cal-col[data-day="' + dayIdx + '"]');
      if (!col) return;
      const evEl = document.createElement("div");
      evEl.className = "cal-event cat-" + (ev.cat || 1);
      evEl.style.top    = topPct + "%";
      evEl.style.height = heightPct + "%";
      evEl.innerHTML =
        '<div class="cal-event-title">' + escape(ev.title) + '</div>' +
        '<div class="cal-event-meta">' + fmtTimeRange(ev.start, ev.end) +
          (ev.loc ? ' · ' + escape(ev.loc) : '') + '</div>';
      col.appendChild(evEl);
    });

    // Now-line (only if today is visible in the current week)
    if (today >= weekStart && today < weekEnd) {
      const nowMin = today.getHours() * 60 + today.getMinutes();
      if (nowMin >= HOURS_START * 60 && nowMin <= HOURS_END * 60) {
        const totalMin = HOUR_COUNT * 60;
        const dayIdx = Math.floor((today - weekStart) / 86400000);
        const topPct = ((nowMin - HOURS_START * 60) / totalMin) * 100;
        const colWidthPct = 100 / 7;
        const line = document.createElement("div");
        line.className = "cal-now-line";
        line.style.top = "calc(" + topPct + "% )";
        line.style.left = "calc(56px + " + (dayIdx * colWidthPct) + "% * (1 - 56px / 100%))";
        // Simpler: put it across the whole grid
        line.style.left = "56px";
        line.style.right = "0";
        // Highlight just today's column
        line.style.background = "var(--bad)";
        const grid = host.querySelector(".cal-grid");
        grid.appendChild(line);
      }
    }
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  window.CalendarView = { render };
})();

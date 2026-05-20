/* Calendar View template — two-week grid + upcoming sidebar.
   Source: a list of iCal feeds (per-page). */

(window.VIEW_TEMPLATES = window.VIEW_TEMPLATES || {}).calendar = function (host, data) {
  data = data || {};
  if (data.error) {
    host.innerHTML = `<div class="cal"><div class="cal-main"><div class="cal-header">
      <h2 class="cal-title">${data.title || "Calendar"}</h2>
      <div class="cal-subtitle" style="color:var(--bad);">${data.error}</div>
    </div></div></div>`;
    return;
  }

  const events = (data.events || []).map((e) => ({
    title: e.title,
    start: e.start ? new Date(e.start) : null,
    end: e.end ? new Date(e.end) : null,
    loc: e.loc || "",
    cat: e.cat || 1,
    color: e.color || "",
    catName: e.catName || "",
  })).filter((e) => e.start);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() - today.getDay());

  const cells = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const monthNames = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const dowNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtTime = (d) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${pad2(m)}${ap}`;
  };

  const first = cells[0], last = cells[cells.length - 1];
  const monthRange = first.getMonth() === last.getMonth()
    ? `${monthNames[first.getMonth()]} ${first.getFullYear()}`
    : `${monthNames[first.getMonth()]} – ${monthNames[last.getMonth()]} ${last.getFullYear()}`;

  const windowEnd = new Date(today); windowEnd.setDate(today.getDate() + 30);
  const in30 = events.filter((e) => e.start >= today && e.start <= windowEnd);

  const todayEvents = events.filter((e) => sameDay(e.start, today));
  const thisWeekEnd = new Date(today); thisWeekEnd.setDate(today.getDate() + (6 - today.getDay()));
  const thisWeek = events.filter((e) => e.start >= today && e.start <= thisWeekEnd);
  const uniqueLocs = new Set(events.map((e) => e.loc)).size;

  const cellHtml = cells.map((d) => {
    const dayEvents = events
      .filter((e) => sameDay(e.start, d))
      .sort((a, b) => a.start - b.start);

    const isToday = sameDay(d, today);
    const isInMonth = d.getMonth() === today.getMonth();
    const cls = `cal-cell ${isToday ? "is-today" : ""} ${!isInMonth ? "is-other" : ""}`;

    const evHtml = dayEvents.slice(0, 3).map((e) => `
      <div class="cal-event c-${e.cat}"${e.color ? ` style="border-left-color:${e.color}"` : ""}>
        <span class="t">${fmtTime(e.start)}</span>
        <span>${e.title}</span>
      </div>
    `).join("");
    const more = dayEvents.length > 3
      ? `<div class="cal-event more">+ ${dayEvents.length - 3} more</div>` : "";

    const monLabel = d.getDate() === 1 || d === cells[0]
      ? `<span class="mo">${monthNames[d.getMonth()]}</span>` : "";

    return `
      <div class="${cls}">
        <div class="cal-cell-num">${d.getDate()}${monLabel}</div>
        ${evHtml}${more}
      </div>
    `;
  }).join("");

  const upcoming = events
    .filter((e) => e.start >= new Date())
    .sort((a, b) => a.start - b.start)
    .slice(0, 8);

  const catLabel = (c) =>
    ({1:"SYNC",2:"REVIEW",3:"EXTERNAL",4:"FIELD",5:"OFFSITE"})[c] || "EVENT";

  const upcomingHtml = upcoming.map((e) => {
    const isToday = sameDay(e.start, today);
    const dowShort = dowNames[e.start.getDay()];
    return `
      <div class="cal-up ${isToday ? "is-today" : ""}">
        <div class="cal-up-day">
          <div class="dow">${dowShort}</div>
          <div class="num">${e.start.getDate()}</div>
        </div>
        <div class="cal-up-body">
          <div class="cal-up-title">${e.title}</div>
          <div class="cal-up-meta">
            <span>${fmtTime(e.start)}</span>
            <span>•</span>
            <span>${e.loc}</span>
          </div>
        </div>
        <div class="cal-up-tag c-${e.cat}"${e.color ? ` style="border-color:${e.color};color:${e.color}"` : ""}>${e.catName || catLabel(e.cat)}</div>
      </div>
    `;
  }).join("");

  host.innerHTML = `
    <div class="cal">
      <div class="cal-main">
        <div class="cal-header">
          <h2 class="cal-title">${data.title || "Calendar"}</h2>
          <div class="cal-subtitle">${monthRange} · ${in30.length} events scheduled · 30-day window</div>
        </div>

        <div class="cal-grid">
          ${dowNames.map((d) => `<div class="cal-dow">${d}</div>`).join("")}
          ${cellHtml}
        </div>
      </div>

      <div class="cal-side">
        <div class="cal-side-stats">
          <div class="cal-stat">
            <div class="cal-stat-label">Today</div>
            <div class="cal-stat-value"><em>${todayEvents.length}</em></div>
          </div>
          <div class="cal-stat">
            <div class="cal-stat-label">This Week</div>
            <div class="cal-stat-value">${thisWeek.length}</div>
          </div>
          <div class="cal-stat">
            <div class="cal-stat-label">Next 30d</div>
            <div class="cal-stat-value">${in30.length}</div>
          </div>
          <div class="cal-stat">
            <div class="cal-stat-label">Locations</div>
            <div class="cal-stat-value">${uniqueLocs}</div>
          </div>
        </div>

        <div class="cal-upcoming">
          <div class="panel-h">
            <span>Up Next</span>
            <span style="margin-left:auto; color: var(--fg-3);">${upcoming.length} events</span>
          </div>
          <div class="cal-upcoming-list">
            ${upcomingHtml}
          </div>
        </div>
      </div>
    </div>
  `;
};

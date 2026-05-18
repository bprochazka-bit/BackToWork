/* PseudoGantt / Project View template — first source group defines the
   column headers; every group is a row with cells aligned by position,
   each cell showing that task's completion level. */

(window.VIEW_TEMPLATES = window.VIEW_TEMPLATES || {}).pseudo_gantt = function (host, data) {
  data = data || {};
  if (data.error) {
    host.innerHTML = `<div class="ps"><div class="ps-header"><div>
      <h2 class="ps-title">${data.title || "Project View"}</h2>
      <div class="ps-sub" style="color:var(--bad);">${data.error}</div>
    </div></div></div>`;
    return;
  }

  const columns = data.columns || [];
  const rows = data.rows || [];

  const cd = data.countdown || {};
  const cdTarget = cd.target ? new Date(cd.target) : null;
  const hasCountdown = !!(cdTarget && !isNaN(cdTarget));
  const daysLeft = hasCountdown
    ? Math.ceil((cdTarget - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  let headHtml = `<div class="ps-head">Project</div>`;
  columns.forEach((c, i) => {
    headHtml += `<div class="ps-head num"><span class="i">P${String(i + 1).padStart(2, "0")}</span><span>${c}</span></div>`;
  });
  headHtml += `<div class="ps-head">Overall</div>`;

  const rowsHtml = rows.map((proj) => {
    const cells = (proj.cells || []).map((ph) => {
      const statusLabel = ({
        idle: "Not started",
        ok: "In progress",
        warn: "Tight",
        bad: "Over",
        done: "Complete",
      })[ph.s] || ph.s;
      const pctText = ph.s === "done" ? "✓"
        : ph.s === "idle" ? "—"
        : `${Math.round((ph.p || 0) * 100)}%`;
      return `
        <div class="ps-cell ps-phase s-${ph.s}">
          <div class="ps-phase-bar"><div class="fill" style="width:${Math.round((ph.p || 0) * 100)}%"></div></div>
          <div class="ps-phase-status"><span class="dot"></span><span>${statusLabel}</span></div>
          <div class="ps-phase-days">${pctText}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="ps-cell ps-project">
        <div class="ps-project-code">${proj.code || ""}</div>
        <div class="ps-project-name">${proj.name}</div>
      </div>
      ${cells}
      <div class="ps-cell ps-summary s-${proj.status}">
        <div class="ps-summary-pct">${Math.round((proj.overall || 0) * 100)}%</div>
        <div class="ps-summary-bar"><div class="fill" style="width:${Math.round((proj.overall || 0) * 100)}%"></div></div>
        <div class="ps-summary-status">${({ok:"In Progress",warn:"At Risk",bad:"Behind",done:"Delivered",idle:"Not started"})[proj.status] || proj.status}</div>
      </div>
    `;
  }).join("");

  const countdownHtml = hasCountdown ? `
        <div class="ps-countdown">
          <div class="ps-countdown-label">
            <div class="k">${cd.label || "Critical Deadline"}</div>
            <div class="v">${cd.targetLabel || "TBD"}</div>
          </div>
          <div class="ps-countdown-days">
            <div class="ps-countdown-num">${Math.max(0, daysLeft)}</div>
            <div class="ps-countdown-unit">Days<br/>Remaining</div>
          </div>
        </div>` : "";

  host.innerHTML = `
    <div class="ps">
      <div class="ps-header">
        <div>
          <h2 class="ps-title">${data.title || "Project View"}</h2>
          <div class="ps-sub">${rows.length} projects · ${columns.length}-task pipeline · refreshed live</div>
        </div>
        ${countdownHtml}
      </div>

      <div class="ps-board" style="grid-template-rows: 64px repeat(${Math.max(rows.length, 1)}, 1fr);">
        ${headHtml}
        ${rowsHtml}
      </div>

      <div class="ps-legend">
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--idle)"></div>Not started</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--ok)"></div>In progress</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--done)"></div>Complete</div>
        <div style="margin-left:auto;">Updated ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
      </div>
    </div>
  `;
};

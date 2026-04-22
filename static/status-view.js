/* Project Status View — grid of 12 projects × 9 phases + countdown */

window.renderStatusView = function(host) {
  const phases = window.DASHBOARD_PHASES;
  const projects = window.DASHBOARD_PROJECTS;
  const cd = window.DASHBOARD_COUNTDOWN;

  const daysLeft = Math.ceil((cd.target - new Date()) / (1000 * 60 * 60 * 24));

  // Header row
  let headHtml = `<div class="ps-head">Project</div>`;
  phases.forEach((p, i) => {
    headHtml += `<div class="ps-head num"><span class="i">P${String(i+1).padStart(2,"0")}</span><span>${p}</span></div>`;
  });
  headHtml += `<div class="ps-head">Overall</div>`;

  // Project rows
  const rowsHtml = projects.map(proj => {
    const phaseCells = proj.phases.map((ph, idx) => {
      const statusLabel = ({
        idle: "Not started",
        ok: "On track",
        warn: "Tight",
        bad: "Over",
        done: "Complete",
      })[ph.s];
      const daysText = ph.s === "done" ? "✓"
        : ph.s === "idle" ? "—"
        : ph.d < 0 ? `+${Math.abs(ph.d)}d over`
        : `${ph.d}d left`;
      return `
        <div class="ps-cell ps-phase s-${ph.s}">
          <div class="ps-phase-bar"><div class="fill" style="width:${Math.round(ph.p * 100)}%"></div></div>
          <div class="ps-phase-status"><span class="dot"></span><span>${statusLabel}</span></div>
          <div class="ps-phase-days">${daysText}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="ps-cell ps-project">
        <div class="ps-project-code">${proj.code}</div>
        <div class="ps-project-name">${proj.name}</div>
      </div>
      ${phaseCells}
      <div class="ps-cell ps-summary s-${proj.status}">
        <div class="ps-summary-pct">${Math.round(proj.overall * 100)}%</div>
        <div class="ps-summary-bar"><div class="fill" style="width:${Math.round(proj.overall * 100)}%"></div></div>
        <div class="ps-summary-status">${({ok:"On Track",warn:"At Risk",bad:"Behind",done:"Delivered"})[proj.status]}</div>
      </div>
    `;
  }).join("");

  host.innerHTML = `
    <div class="ps">
      <div class="ps-header">
        <div>
          <h2 class="ps-title">Project <em>Status</em></h2>
          <div class="ps-sub">${projects.length} active programs · ${phases.length}-phase pipeline · refreshed live</div>
        </div>

        <div class="ps-countdown">
          <div class="ps-countdown-label">
            <div class="k">${cd.label}</div>
            <div class="v">${cd.targetLabel}</div>
          </div>
          <div class="ps-countdown-days">
            <div class="ps-countdown-num">${Math.max(0, daysLeft)}</div>
            <div class="ps-countdown-unit">
              Days<br/>Remaining
            </div>
          </div>
        </div>
      </div>

      <div class="ps-board" style="grid-template-rows: 64px repeat(${projects.length}, 1fr);">
        ${headHtml}
        ${rowsHtml}
      </div>

      <div class="ps-legend">
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--idle)"></div>Not started</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--ok)"></div>On track</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--warn)"></div>Tight</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--bad)"></div>Over budget</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--done)"></div>Complete</div>
        <div style="margin-left:auto;">Updated ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
      </div>
    </div>
  `;
};

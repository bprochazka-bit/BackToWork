/* Kanban View template — first source group's buckets define the
   swimlanes; every group is a row counting its tasks per lane.
   An empty lane with no tasks in any preceding lane reads "Completed". */

(window.VIEW_TEMPLATES = window.VIEW_TEMPLATES || {}).kanban = function (host, data) {
  data = data || {};
  if (data.error) {
    host.innerHTML = `<div class="ps"><div class="ps-header"><div>
      <h2 class="ps-title">${data.title || "Kanban"}</h2>
      <div class="ps-sub" style="color:var(--bad);">${data.error}</div>
    </div></div></div>`;
    return;
  }

  const lanes = data.lanes || [];
  const rows = data.rows || [];

  let headHtml = `<div class="ps-head">Project</div>`;
  lanes.forEach((name, i) => {
    headHtml += `<div class="ps-head num"><span class="i">L${String(i + 1).padStart(2, "0")}</span><span>${name}</span></div>`;
  });
  headHtml += `<div class="ps-head">Total</div>`;

  const rowsHtml = rows.map((proj) => {
    const counts = proj.counts || [];
    let precedingEmpty = true; // all lanes before the current one are empty

    const laneCells = lanes.map((_, i) => {
      const n = counts[i] || 0;
      const completed = n === 0 && precedingEmpty;
      precedingEmpty = precedingEmpty && n === 0;

      if (completed) {
        return `
          <div class="ps-cell kb-cell s-done">
            <div class="kb-num">✓</div>
            <div class="kb-label">Completed</div>
          </div>`;
      }
      const cls = n === 0 ? "kb-cell s-idle" : "kb-cell s-ok";
      return `
        <div class="ps-cell ${cls}">
          <div class="kb-num">${n}</div>
          <div class="kb-label">${n === 1 ? "task" : "tasks"}</div>
        </div>`;
    }).join("");

    return `
      <div class="ps-cell ps-project">
        <div class="ps-project-code">${proj.code || ""}</div>
        <div class="ps-project-name">${proj.name}</div>
      </div>
      ${laneCells}
      <div class="ps-cell kb-cell kb-total">
        <div class="kb-num">${proj.total || 0}</div>
        <div class="kb-label">total</div>
      </div>
    `;
  }).join("");

  host.innerHTML = `
    <div class="ps">
      <div class="ps-header">
        <div>
          <h2 class="ps-title">${data.title || "Kanban"}</h2>
          <div class="ps-sub">${rows.length} projects · ${lanes.length} swimlanes · refreshed live</div>
        </div>
      </div>

      <div class="ps-board" style="grid-template-columns: 280px repeat(${Math.max(lanes.length, 1)}, 1fr) 200px; grid-template-rows: 64px repeat(${Math.max(rows.length, 1)}, 1fr);">
        ${headHtml}
        ${rowsHtml}
      </div>

      <div class="ps-legend">
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--ok)"></div>Active tasks</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--idle)"></div>Empty lane</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--done)"></div>Completed</div>
        <div style="margin-left:auto;">Updated ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
      </div>
    </div>
  `;
};

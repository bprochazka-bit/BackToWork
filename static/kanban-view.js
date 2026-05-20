/* Kanban View template — each subproject shows its OWN kanban buckets
   as swimlanes. Row width scales with that project's lane count, capped
   so a single lane never spans the whole row. An empty lane with no
   tasks in any preceding lane reads "Completed". */

(window.VIEW_TEMPLATES = window.VIEW_TEMPLATES || {}).kanban = function (host, data) {
  data = data || {};
  if (data.error) {
    host.innerHTML = `<div class="ps"><div class="ps-header"><div>
      <h2 class="ps-title">${data.title || "Kanban"}</h2>
      <div class="ps-sub" style="color:var(--bad);">${data.error}</div>
    </div></div></div>`;
    return;
  }

  const rows = data.rows || [];
  const LANE_W = 360;   // px per lane before the row hits its cap
  const MAX_W = 3000;   // px — row never grows past this

  const rowsHtml = rows.map((proj) => {
    const lanes = proj.lanes || [];
    let precedingEmpty = true;

    const laneCells = lanes.map((lane) => {
      const n = lane.count || 0;
      const completed = n === 0 && precedingEmpty;
      precedingEmpty = precedingEmpty && n === 0;

      if (completed) {
        return `
          <div class="kb-cell s-done">
            <div class="kb-num">✓</div>
            <div class="kb-label">${lane.name}</div>
            <div class="kb-tag">Completed</div>
          </div>`;
      }
      const cls = n === 0 ? "kb-cell s-idle" : "kb-cell s-ok";
      return `
        <div class="${cls}">
          <div class="kb-num">${n}</div>
          <div class="kb-label">${lane.name}</div>
        </div>`;
    }).join("");

    const lanesWidth = `min(${lanes.length} * ${LANE_W}px, ${MAX_W}px)`;

    return `
      <div class="kb-row">
        <div class="kb-rowhead">
          <div class="kb-rowhead-code">${proj.code || ""}</div>
          <div class="kb-rowhead-name">${proj.name}</div>
        </div>
        <div class="kb-lanes" style="width:${lanesWidth};">
          ${laneCells || `<div class="kb-cell s-idle"><div class="kb-label">No lanes</div></div>`}
        </div>
        <div class="kb-cell kb-total">
          <div class="kb-num">${proj.total || 0}</div>
          <div class="kb-label">total</div>
        </div>
      </div>
    `;
  }).join("");

  host.innerHTML = `
    <div class="ps">
      <div class="ps-header">
        <div>
          <h2 class="ps-title">${data.title || "Kanban"}</h2>
          <div class="ps-sub">${rows.length} projects · per-project swimlanes · refreshed live</div>
        </div>
      </div>

      <div class="kb-board">
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

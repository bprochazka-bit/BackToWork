/* Lyteworks Slide View template — one row per course module. Each of
   the 5 production phases shows decks-complete / total decks, color
   coded (green = all done, amber = partial, grey = none). Lectures
   without a slide deck still count toward the totals. */

(window.VIEW_TEMPLATES = window.VIEW_TEMPLATES || {}).lyteworks = function (host, data) {
  data = data || {};
  if (data.error) {
    host.innerHTML = `<div class="ps"><div class="ps-header"><div>
      <h2 class="ps-title">${data.title || "Lyteworks Slide"}</h2>
      <div class="ps-sub" style="color:var(--bad);">${data.error}</div>
    </div></div></div>`;
    return;
  }

  const phases = data.phases || [];
  const rows = data.rows || [];

  let headHtml = `<div class="ps-head">Module</div>`;
  phases.forEach((p, i) => {
    headHtml += `<div class="ps-head num"><span class="i">S${String(i + 1).padStart(2, "0")}</span><span>${p}</span></div>`;
  });
  headHtml += `<div class="ps-head">Decks</div>`;

  const rowsHtml = rows.map((mod) => {
    const cells = (mod.cells || []).map((c) => {
      const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
      return `
        <div class="kb-cell s-${c.s}">
          <div class="kb-num">${c.done}<span class="kb-den">/${c.total}</span></div>
          <div class="kb-label">${pct}% complete</div>
        </div>`;
    }).join("");

    return `
      <div class="ps-cell ps-project">
        <div class="ps-project-code">${mod.code || ""}</div>
        <div class="ps-project-name">${mod.name}</div>
      </div>
      ${cells}
      <div class="ps-cell kb-cell kb-total">
        <div class="kb-num">${mod.total || 0}</div>
        <div class="kb-label">decks</div>
      </div>
    `;
  }).join("");

  host.innerHTML = `
    <div class="ps">
      <div class="ps-header">
        <div>
          <h2 class="ps-title">${data.title || "Lyteworks Slide"}</h2>
          <div class="ps-sub">${rows.length} modules · ${phases.length}-phase production · refreshed live</div>
        </div>
      </div>

      <div class="ps-board" style="grid-template-columns: 280px repeat(${Math.max(phases.length, 1)}, 1fr) 200px; grid-template-rows: 64px repeat(${Math.max(rows.length, 1)}, 1fr);">
        ${headHtml}
        ${rowsHtml}
      </div>

      <div class="ps-legend">
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--done)"></div>All decks done</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--ok)"></div>In progress</div>
        <div class="ps-legend-item"><div class="ps-legend-swatch" style="background: var(--idle)"></div>Not started</div>
        <div style="margin-left:auto;">Updated ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
      </div>
    </div>
  `;
};

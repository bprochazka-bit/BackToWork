/* Project status view — projects × phases matrix */

(function () {
  "use strict";

  function shortPhaseLabel(name) {
    // Compact phase header: take first letter of each word, max 3 chars
    return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  }

  function fmtDelta(d) {
    if (!d) return "";
    if (d > 0) return "+" + d + "d";
    return d + "d";
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function render(host, data) {
    const projects = data.projects || [];
    const phases   = data.phases   || [];

    const counts = {
      ok:   projects.filter((p) => p.status === "ok").length,
      warn: projects.filter((p) => p.status === "warn").length,
      bad:  projects.filter((p) => p.status === "bad").length,
    };

    const summary =
      '<span class="cal-legend">' +
        '<span class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--ok)"></span>' + counts.ok + ' OK</span>' +
        '<span class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--warn)"></span>' + counts.warn + ' Warn</span>' +
        '<span class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--bad)"></span>' + counts.bad + ' Risk</span>' +
      '</span>';

    let head = '<div class="stv-head"><div>Project</div><div>Code</div>';
    phases.forEach((ph) => {
      head += '<div title="' + escape(ph) + '">' + shortPhaseLabel(ph) + '</div>';
    });
    head += '<div>Overall</div></div>';

    let body = '<div class="stv-body">';
    projects.forEach((p) => {
      body += '<div class="stv-row">';
      body += '<div class="stv-name"><div class="stv-name-label">' + escape(p.name) + '</div></div>';
      body += '<div class="stv-code">' + escape(p.code || "") + '</div>';

      (p.phases || []).forEach((cell) => {
        const s = cell.s || "idle";
        const d = cell.d || 0;
        const sym = ({
          done: "■",
          ok:   "●",
          warn: "▲",
          bad:  "✕",
          idle: "·",
        })[s] || "·";
        const deltaCls = d < 0 ? "neg" : (d > 0 ? "pos" : "");
        const deltaTxt = d ? '<span class="stv-pip-delta ' + deltaCls + '">' + fmtDelta(d) + '</span>' : "";
        body += '<div class="stv-cell">' +
                  '<div class="stv-pip s-' + s + '">' + sym + '</div>' +
                  deltaTxt +
                '</div>';
      });

      const overallPct = Math.round((p.overall || 0) * 100);
      body += '<div class="stv-overall s-' + (p.status || "ok") + '">' +
                overallPct + '%' +
                '<div class="bar"><span style="width:' + overallPct + '%"></span></div>' +
              '</div>';

      body += '</div>';
    });
    body += '</div>';

    host.innerHTML =
      '<div class="view-title">' +
        '<h2>Project Status</h2>' +
        '<span class="view-sub">' + projects.length + ' active</span>' +
        '<span class="spacer"></span>' +
        summary +
      '</div>' +
      '<div class="stv">' +
        '<div class="stv-table">' + head + body + '</div>' +
      '</div>';
  }

  window.StatusView = { render };
})();

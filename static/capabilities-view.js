/* Capabilities view — capability cards with task checklists */

(function () {
  "use strict";

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function render(host, data) {
    const caps = data.capabilities || [];

    const totals = caps.reduce(
      (acc, c) => {
        const t = c.tasks || [];
        acc.total += t.length;
        acc.done  += t.filter((x) => x.done).length;
        return acc;
      },
      { total: 0, done: 0 }
    );

    const overallPct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;

    let cards = '<div class="capv-grid">';
    caps.forEach((c) => {
      const tasks = c.tasks || [];
      const doneCount = tasks.filter((t) => t.done).length;
      const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

      cards += '<div class="cap-card">';
      cards +=   '<div class="cap-card-head">' +
                   '<div class="cap-card-name">' + escape(c.name) + '</div>' +
                   '<div class="cap-card-code">' + escape(c.code || "") + '</div>' +
                 '</div>';
      cards +=   '<div class="cap-card-progress">' +
                   '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
                   '<div class="count">' + doneCount + '/' + tasks.length + '</div>' +
                 '</div>';

      cards += '<ul class="cap-tasks">';
      tasks.forEach((t) => {
        cards += '<li class="cap-task' + (t.done ? " done" : "") + '">' +
                   '<div class="cap-task-box"></div>' +
                   '<div class="cap-task-name">' + escape(t.name) + '</div>' +
                   '<div class="cap-task-owner">' + escape(t.owner || "") + '</div>' +
                 '</li>';
      });
      cards += '</ul>';

      cards += '</div>';
    });
    cards += '</div>';

    const summary = '<span class="cal-legend">' +
      '<span class="cal-legend-item"><span class="cal-legend-swatch" style="background:var(--ok)"></span>' +
        totals.done + '/' + totals.total + ' tasks · ' + overallPct + '%</span>' +
      '</span>';

    host.innerHTML =
      '<div class="view-title">' +
        '<h2>Capabilities</h2>' +
        '<span class="view-sub">' + caps.length + ' tracked</span>' +
        '<span class="spacer"></span>' +
        summary +
      '</div>' +
      '<div class="capv">' + cards + '</div>';
  }

  window.CapabilitiesView = { render };
})();

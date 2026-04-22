/* Capabilities View — 12 cards with task lists; completed tasks hidden */

window.renderCapabilitiesView = function(host) {
  const caps = window.DASHBOARD_CAPABILITIES;

  // Overall stats
  const totalTasks = caps.reduce((s, c) => s + c.tasks.length, 0);
  const doneTasks = caps.reduce((s, c) => s + c.tasks.filter(t => t.done).length, 0);
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const cardHtml = caps.map((cap, idx) => {
    const done = cap.tasks.filter(t => t.done).length;
    const total = cap.tasks.length;
    const pct = total ? (done / total) * 100 : 0;
    const isDone = done === total;

    const remaining = cap.tasks.filter(t => !t.done);

    // First incomplete task is the "active" one
    const tasksHtml = isDone
      ? `<div class="cap-card-empty"><span>All tasks complete</span></div>`
      : `<div class="cap-card-tasks">
          ${remaining.slice(0, 5).map((task, i) => `
            <div class="cap-task ${i === 0 ? "is-active" : ""}">
              <div class="cap-task-box"></div>
              <div class="cap-task-name">${task.name}</div>
              <div class="cap-task-owner">${task.owner}</div>
            </div>
          `).join("")}
          ${remaining.length > 5
            ? `<div class="cap-task"><div></div><div class="cap-task-name" style="color:var(--fg-3);font-family:var(--font-mono);font-size:13px;letter-spacing:0.2em;">+ ${remaining.length - 5} more</div><div></div></div>`
            : ""}
        </div>`;

    return `
      <div class="cap-card ${isDone ? "is-done" : ""}">
        <div class="cap-card-h">
          <div class="cap-card-idx">${String(idx + 1).padStart(2,"0")}</div>
          <div class="cap-card-name">
            <span class="code">${cap.code}</span>
            ${cap.name}
          </div>
          <div class="cap-card-count">
            <span class="done">${done}</span>
            <span class="sep">/</span>
            <span class="tot">${total}</span>
          </div>
        </div>
        <div class="cap-card-prog"><div class="fill" style="width:${pct}%"></div></div>
        ${tasksHtml}
      </div>
    `;
  }).join("");

  host.innerHTML = `
    <div class="cap">
      <div class="cap-header">
        <div>
          <h2 class="cap-title">New <em>Capabilities</em></h2>
          <div class="cap-sub">${caps.length} in flight · ${totalTasks - doneTasks} open tasks · completed tasks hidden</div>
        </div>
        <div class="cap-meter">
          <div>
            <div class="cap-meter-label">Portfolio Progress</div>
            <div class="cap-meter-num"><em>${doneTasks}</em> / ${totalTasks}</div>
          </div>
          <div class="cap-meter-bar"><div class="fill" style="width:${overallPct}%"></div></div>
          <div class="cap-meter-num" style="font-size:48px;"><em>${overallPct}%</em></div>
        </div>
      </div>

      <div class="cap-grid">
        ${cardHtml}
      </div>
    </div>
  `;
};

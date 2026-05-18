/* Card View template — one card per source group (Vikunja subproject),
   tasks listed inside, completed/total counted. Completed tasks hidden. */

(window.VIEW_TEMPLATES = window.VIEW_TEMPLATES || {}).card = function (host, data) {
  data = data || {};
  if (data.error) {
    host.innerHTML = `<div class="cap"><div class="cap-header"><div>
      <h2 class="cap-title">${data.title || "Card View"}</h2>
      <div class="cap-sub" style="color:var(--bad);">${data.error}</div>
    </div></div></div>`;
    return;
  }

  const cards = data.cards || [];

  const totalTasks = cards.reduce((s, c) => s + (c.tasks || []).length, 0);
  const doneTasks = cards.reduce(
    (s, c) => s + (c.tasks || []).filter((t) => t.done).length, 0);
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const cardHtml = cards.map((cap, idx) => {
    const tasks = cap.tasks || [];
    const done = tasks.filter((t) => t.done).length;
    const total = tasks.length;
    const pct = total ? (done / total) * 100 : 0;
    const isDone = total > 0 && done === total;
    const remaining = tasks.filter((t) => !t.done);

    const tasksHtml = isDone
      ? `<div class="cap-card-empty"><span>All tasks complete</span></div>`
      : `<div class="cap-card-tasks">
          ${remaining.slice(0, 5).map((task, i) => `
            <div class="cap-task ${i === 0 ? "is-active" : ""}">
              <div class="cap-task-box"></div>
              <div class="cap-task-name">${task.name}</div>
              <div class="cap-task-owner">${task.owner || ""}</div>
            </div>
          `).join("")}
          ${remaining.length > 5
            ? `<div class="cap-task"><div></div><div class="cap-task-name" style="color:var(--fg-3);font-family:var(--font-mono);font-size:13px;letter-spacing:0.2em;">+ ${remaining.length - 5} more</div><div></div></div>`
            : ""}
        </div>`;

    return `
      <div class="cap-card ${isDone ? "is-done" : ""}">
        <div class="cap-card-h">
          <div class="cap-card-idx">${String(idx + 1).padStart(2, "0")}</div>
          <div class="cap-card-name">
            <span class="code">${cap.code || ""}</span>
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
          <h2 class="cap-title">${data.title || "Card View"}</h2>
          <div class="cap-sub">${cards.length} in flight · ${totalTasks - doneTasks} open tasks · completed tasks hidden</div>
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

/* TackEff Admin — Project Status + Capabilities
 *
 * Two tabs sharing the header's Add/Save buttons:
 *   • Projects: per-phase state, progress, days; overall % auto-computed.
 *   • Capabilities: list of checklists (name + owner + done) per capability.
 *
 * Each tab is a small module with the same shape:
 *   { load(), render(), addItem(), saveAll() }
 * The header dispatches to whichever tab is currently active.
 */
(function () {
  "use strict";

  // ── Shared helpers ─────────────────────────────────────────

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function flash(msg, kind) {
    const el = document.getElementById("adm-status");
    el.textContent = msg;
    el.dataset.kind = kind || "info";
    if (msg) {
      clearTimeout(flash._t);
      flash._t = setTimeout(() => { el.textContent = ""; }, 4000);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════
  const Projects = (function () {
    const STATE_OPTIONS = [
      { key: "idle", label: "Not started" },
      { key: "ok",   label: "On track"    },
      { key: "warn", label: "Tight"       },
      { key: "bad",  label: "Over"        },
      { key: "done", label: "Complete"    },
    ];

    const STATUS_LABEL = {
      ok: "On Track", warn: "At Risk", bad: "Behind",
      done: "Delivered", idle: "Not Started",
    };

    let phases = [];
    let projects = [];

    function computeOverall(proj) {
      const ps = proj.phases || [];
      if (!ps.length) return { overall: 0, status: "idle" };
      const sum = ps.reduce((a, ph) => a + (Number(ph.p) || 0), 0);
      const overall = sum / ps.length;
      const states = ps.map((ph) => ph.s);
      let status;
      if (states.includes("bad")) status = "bad";
      else if (states.includes("warn")) status = "warn";
      else if (states.every((s) => s === "done")) status = "done";
      else status = "ok";
      return { overall, status };
    }

    function recomputeAll() {
      projects.forEach((p) => {
        const { overall, status } = computeOverall(p);
        p.overall = overall; p.status = status;
      });
    }

    function normalisePhaseForState(ph) {
      if (ph.s === "done") ph.p = 1.0;
      else if (ph.s === "idle") { ph.p = 0.0; ph.d = 0; }
      else ph.p = Math.max(0, Math.min(1, Number(ph.p) || 0));
    }

    const $list = () => document.getElementById("projects-list");

    function render() {
      recomputeAll();
      if (!projects.length) {
        $list().innerHTML = `<div class="adm-empty">No projects yet. Click <b>+ New</b> to add one.</div>`;
        return;
      }
      $list().innerHTML = projects.map(renderProject).join("");
      wireEvents();
    }

    function renderProject(proj, pIdx) {
      const overallPct = Math.round((proj.overall || 0) * 100);
      const statusClass = `s-${proj.status || "idle"}`;
      const statusText = STATUS_LABEL[proj.status || "idle"];

      const phasesHtml = (proj.phases || []).map((ph, phIdx) => {
        const name = phases[phIdx] || `Phase ${phIdx + 1}`;
        const pct = Math.round((ph.p || 0) * 100);
        const disabled = ph.s === "done" || ph.s === "idle";
        return `
          <div class="adm-phase s-${ph.s}" data-p="${pIdx}" data-ph="${phIdx}">
            <div class="adm-phase-head">
              <span class="adm-phase-idx">P${String(phIdx + 1).padStart(2, "0")}</span>
              <span class="adm-phase-name">${escapeHtml(name)}</span>
            </div>
            <label class="adm-field">
              <span class="lbl">State</span>
              <select class="adm-in js-state">
                ${STATE_OPTIONS.map((o) => `<option value="${o.key}" ${o.key === ph.s ? "selected" : ""}>${o.label}</option>`).join("")}
              </select>
            </label>
            <label class="adm-field">
              <span class="lbl">Progress <span class="v">${pct}%</span></span>
              <input class="adm-in js-progress" type="range" min="0" max="100" step="1"
                value="${pct}" ${disabled ? "disabled" : ""}/>
            </label>
            <label class="adm-field">
              <span class="lbl">Days (+left / −over)</span>
              <input class="adm-in js-days" type="number" step="1"
                value="${Number.isFinite(+ph.d) ? +ph.d : 0}"
                ${ph.s === "idle" || ph.s === "done" ? "disabled" : ""}/>
            </label>
          </div>`;
      }).join("");

      return `
        <article class="adm-project" data-p="${pIdx}">
          <header class="adm-project-head">
            <div class="adm-project-meta">
              <label class="adm-field inline">
                <span class="lbl">Code</span>
                <input class="adm-in js-code" type="text" value="${escapeHtml(proj.code || "")}" placeholder="PRJ-000"/>
              </label>
              <label class="adm-field inline grow">
                <span class="lbl">Name</span>
                <input class="adm-in js-name" type="text" value="${escapeHtml(proj.name || "")}" placeholder="Project name"/>
              </label>
            </div>
            <div class="adm-project-summary ${statusClass}">
              <div class="adm-project-pct">${overallPct}%</div>
              <div class="adm-project-bar"><div class="fill" style="width:${overallPct}%"></div></div>
              <div class="adm-project-status">${statusText}</div>
            </div>
            <button class="adm-btn adm-btn-danger js-delete" type="button" title="Delete project">Remove</button>
          </header>
          <div class="adm-phases">${phasesHtml}</div>
        </article>`;
    }

    function wireEvents() {
      $list().querySelectorAll(".adm-project").forEach((card) => {
        const pIdx = +card.dataset.p;
        const proj = projects[pIdx];
        if (!proj) return;

        card.querySelector(".js-name").addEventListener("input", (e) => { proj.name = e.target.value; });
        card.querySelector(".js-code").addEventListener("input", (e) => { proj.code = e.target.value; });
        card.querySelector(".js-delete").addEventListener("click", () => {
          if (!confirm(`Remove "${proj.name || "this project"}"?`)) return;
          projects.splice(pIdx, 1);
          render();
        });

        card.querySelectorAll(".adm-phase").forEach((phEl) => {
          const phIdx = +phEl.dataset.ph;
          const ph = proj.phases[phIdx];
          if (!ph) return;

          phEl.querySelector(".js-state").addEventListener("change", (e) => {
            ph.s = e.target.value;
            normalisePhaseForState(ph);
            render();
          });

          const prog = phEl.querySelector(".js-progress");
          prog.addEventListener("input", (e) => {
            ph.p = (+e.target.value || 0) / 100;
            const pctSpan = phEl.querySelector(".adm-field .v");
            if (pctSpan) pctSpan.textContent = `${Math.round(ph.p * 100)}%`;
            updateSummary(card, proj);
          });
          prog.addEventListener("change", render);

          phEl.querySelector(".js-days").addEventListener("input", (e) => {
            ph.d = parseInt(e.target.value, 10) || 0;
          });
        });
      });
    }

    function updateSummary(card, proj) {
      const { overall, status } = computeOverall(proj);
      proj.overall = overall; proj.status = status;
      const pct = Math.round(overall * 100);
      const sum = card.querySelector(".adm-project-summary");
      sum.className = `adm-project-summary s-${status}`;
      sum.querySelector(".adm-project-pct").textContent = `${pct}%`;
      sum.querySelector(".adm-project-bar .fill").style.width = `${pct}%`;
      sum.querySelector(".adm-project-status").textContent = STATUS_LABEL[status];
    }

    function addItem() {
      const nextNum = projects.length + 1;
      const code = `PRJ-${String(100 + nextNum).slice(-3)}`;
      projects.push({
        name: "New Project", code,
        phases: phases.map(() => ({ s: "idle", p: 0.0, d: 0 })),
        overall: 0, status: "idle",
      });
      render();
      const cards = $list().querySelectorAll(".adm-project");
      const last = cards[cards.length - 1];
      if (last) last.querySelector(".js-name").focus();
    }

    async function saveAll() {
      recomputeAll();
      const valid = projects.filter((p) => (p.name || "").trim());
      if (valid.length !== projects.length) flash("Skipped projects with empty names.", "warn");
      try {
        const resp = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projects: valid }),
        });
        const body = await resp.json();
        if (!resp.ok || body.error) throw new Error(body.error || `HTTP ${resp.status}`);
        projects = body.projects;
        render();
        flash("Projects saved.", "ok");
      } catch (err) {
        flash(`Save failed: ${err.message}`, "bad");
      }
    }

    async function load() {
      try {
        const resp = await fetch("/api/projects", { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json();
        phases = body.phases || [];
        projects = body.projects || [];
        projects.forEach((p) => {
          p.phases = p.phases || [];
          while (p.phases.length < phases.length) p.phases.push({ s: "idle", p: 0.0, d: 0 });
          p.phases.length = phases.length;
        });
        render();
      } catch (err) {
        $list().innerHTML = `<div class="adm-empty">Load failed: ${err.message}</div>`;
      }
    }

    return { load, render, addItem, saveAll };
  })();

  // ═══════════════════════════════════════════════════════════
  // CAPABILITIES
  // ═══════════════════════════════════════════════════════════
  const Capabilities = (function () {
    let caps = [];

    const $list = () => document.getElementById("capabilities-list");

    function stats(cap) {
      const total = cap.tasks.length;
      const done = cap.tasks.filter((t) => t.done).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      return { total, done, pct, allDone: total > 0 && done === total };
    }

    function render() {
      if (!caps.length) {
        $list().innerHTML = `<div class="adm-empty">No capabilities yet. Click <b>+ New</b> to add one.</div>`;
        return;
      }
      $list().innerHTML = caps.map(renderCap).join("");
      wireEvents();
    }

    function renderCap(cap, cIdx) {
      const { total, done, pct, allDone } = stats(cap);

      const tasksHtml = (cap.tasks || []).map((t, tIdx) => `
        <div class="adm-task ${t.done ? "is-done" : ""}" data-c="${cIdx}" data-t="${tIdx}">
          <label class="adm-task-check">
            <input type="checkbox" class="js-task-done" ${t.done ? "checked" : ""}/>
            <span class="adm-task-box" aria-hidden="true"></span>
          </label>
          <input class="adm-in js-task-name" type="text"
            value="${escapeHtml(t.name)}" placeholder="Task description"/>
          <input class="adm-in js-task-owner" type="text"
            value="${escapeHtml(t.owner || "")}" placeholder="Owner"/>
          <button class="adm-btn adm-btn-icon js-task-remove" type="button" title="Remove task">×</button>
        </div>`).join("");

      return `
        <article class="adm-cap ${allDone ? "is-done" : ""}" data-c="${cIdx}">
          <header class="adm-project-head">
            <div class="adm-project-meta">
              <label class="adm-field inline">
                <span class="lbl">Code</span>
                <input class="adm-in js-cap-code" type="text" value="${escapeHtml(cap.code || "")}" placeholder="CAP-000"/>
              </label>
              <label class="adm-field inline grow">
                <span class="lbl">Name</span>
                <input class="adm-in js-cap-name" type="text" value="${escapeHtml(cap.name || "")}" placeholder="Capability name"/>
              </label>
            </div>
            <div class="adm-project-summary ${allDone ? "s-done" : "s-ok"}">
              <div class="adm-project-pct">${pct}%</div>
              <div class="adm-project-bar"><div class="fill" style="width:${pct}%"></div></div>
              <div class="adm-project-status">${done} / ${total} tasks ${allDone ? "— delivered" : ""}</div>
            </div>
            <button class="adm-btn adm-btn-danger js-cap-delete" type="button" title="Delete capability">Remove</button>
          </header>

          <div class="adm-tasks">
            ${tasksHtml || `<div class="adm-tasks-empty">No tasks — add one below.</div>`}
            <button class="adm-btn js-task-add" type="button">+ Add Task</button>
          </div>
        </article>`;
    }

    function wireEvents() {
      $list().querySelectorAll(".adm-cap").forEach((card) => {
        const cIdx = +card.dataset.c;
        const cap = caps[cIdx];
        if (!cap) return;

        card.querySelector(".js-cap-name").addEventListener("input", (e) => { cap.name = e.target.value; });
        card.querySelector(".js-cap-code").addEventListener("input", (e) => { cap.code = e.target.value; });

        card.querySelector(".js-cap-delete").addEventListener("click", () => {
          if (!confirm(`Remove "${cap.name || "this capability"}"?`)) return;
          caps.splice(cIdx, 1);
          render();
        });

        card.querySelector(".js-task-add").addEventListener("click", () => {
          cap.tasks.push({ name: "", owner: "", done: false });
          render();
          const rows = $list().querySelectorAll(`.adm-cap[data-c="${cIdx}"] .adm-task`);
          const last = rows[rows.length - 1];
          if (last) last.querySelector(".js-task-name").focus();
        });

        card.querySelectorAll(".adm-task").forEach((row) => {
          const tIdx = +row.dataset.t;
          const task = cap.tasks[tIdx];
          if (!task) return;

          row.querySelector(".js-task-name").addEventListener("input", (e) => {
            task.name = e.target.value;
          });
          row.querySelector(".js-task-owner").addEventListener("input", (e) => {
            task.owner = e.target.value;
          });
          row.querySelector(".js-task-done").addEventListener("change", (e) => {
            task.done = !!e.target.checked;
            updateSummary(card, cap);
            row.classList.toggle("is-done", task.done);
          });
          row.querySelector(".js-task-remove").addEventListener("click", () => {
            cap.tasks.splice(tIdx, 1);
            render();
          });
        });
      });
    }

    function updateSummary(card, cap) {
      const { total, done, pct, allDone } = stats(cap);
      const sum = card.querySelector(".adm-project-summary");
      sum.className = `adm-project-summary ${allDone ? "s-done" : "s-ok"}`;
      sum.querySelector(".adm-project-pct").textContent = `${pct}%`;
      sum.querySelector(".adm-project-bar .fill").style.width = `${pct}%`;
      sum.querySelector(".adm-project-status").textContent =
        `${done} / ${total} tasks ${allDone ? "— delivered" : ""}`;
      card.classList.toggle("is-done", allDone);
    }

    function addItem() {
      const nextNum = caps.length + 1;
      const code = `CAP-${String(100 + nextNum).slice(-3)}`;
      caps.push({ name: "New Capability", code, tasks: [] });
      render();
      const cards = $list().querySelectorAll(".adm-cap");
      const last = cards[cards.length - 1];
      if (last) last.querySelector(".js-cap-name").focus();
    }

    async function saveAll() {
      const valid = caps.filter((c) => (c.name || "").trim());
      if (valid.length !== caps.length) flash("Skipped capabilities with empty names.", "warn");
      try {
        const resp = await fetch("/api/capabilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ capabilities: valid }),
        });
        const body = await resp.json();
        if (!resp.ok || body.error) throw new Error(body.error || `HTTP ${resp.status}`);
        caps = body.capabilities;
        render();
        flash("Capabilities saved.", "ok");
      } catch (err) {
        flash(`Save failed: ${err.message}`, "bad");
      }
    }

    async function load() {
      try {
        const resp = await fetch("/api/capabilities", { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const body = await resp.json();
        caps = body.capabilities || [];
        caps.forEach((c) => { c.tasks = c.tasks || []; });
        render();
      } catch (err) {
        $list().innerHTML = `<div class="adm-empty">Load failed: ${err.message}</div>`;
      }
    }

    return { load, render, addItem, saveAll };
  })();

  // ═══════════════════════════════════════════════════════════
  // TAB SWITCHER — dispatches Add/Save buttons to the active tab.
  // ═══════════════════════════════════════════════════════════

  const TABS = {
    projects:     { mod: Projects,     addLabel: "+ New Project"   },
    capabilities: { mod: Capabilities, addLabel: "+ New Capability" },
  };

  let activeTab = "projects";

  function switchTab(name) {
    if (!TABS[name]) return;
    activeTab = name;

    document.querySelectorAll(".adm-tab").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.tab === name);
    });
    document.querySelectorAll(".adm-tab-panel").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.panel === name);
    });

    document.getElementById("btn-add").textContent = TABS[name].addLabel;
  }

  document.querySelectorAll(".adm-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("btn-add").addEventListener("click", () => TABS[activeTab].mod.addItem());
  document.getElementById("btn-save").addEventListener("click", () => TABS[activeTab].mod.saveAll());

  switchTab("projects");
  Projects.load();
  Capabilities.load();
})();

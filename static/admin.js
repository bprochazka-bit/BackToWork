/* Project Status Admin
 *
 * Loads /api/projects, lets the user add/remove projects and edit each phase
 * (state + progress % + days), recomputes the overall % live, and persists
 * the whole list back via POST /api/projects.
 */
(function () {
  "use strict";

  const STATE_OPTIONS = [
    { key: "idle", label: "Not started" },
    { key: "ok",   label: "On track"    },
    { key: "warn", label: "Tight"       },
    { key: "bad",  label: "Over"        },
    { key: "done", label: "Complete"    },
  ];

  const STATUS_LABEL = {
    ok:   "On Track",
    warn: "At Risk",
    bad:  "Behind",
    done: "Delivered",
    idle: "Not Started",
  };

  let phases = [];    // Array of phase names, from server config
  let projects = [];  // Working copy being edited

  // ── Derivation ─────────────────────────────────────────────

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
      p.overall = overall;
      p.status = status;
    });
  }

  function normalisePhaseForState(ph) {
    // Enforce invariants: done → p=1, idle → p=0, otherwise clamp 0..1.
    if (ph.s === "done") ph.p = 1.0;
    else if (ph.s === "idle") { ph.p = 0.0; ph.d = 0; }
    else ph.p = Math.max(0, Math.min(1, Number(ph.p) || 0));
  }

  // ── Rendering ──────────────────────────────────────────────

  const $list = () => document.getElementById("projects-list");
  const $status = () => document.getElementById("adm-status");

  function flash(msg, kind) {
    const el = $status();
    el.textContent = msg;
    el.dataset.kind = kind || "info";
    if (msg) {
      clearTimeout(flash._t);
      flash._t = setTimeout(() => { el.textContent = ""; }, 4000);
    }
  }

  function render() {
    recomputeAll();

    if (!projects.length) {
      $list().innerHTML = `
        <div class="adm-empty">
          No projects yet. Click <b>+ New Project</b> to add one.
        </div>`;
      return;
    }

    const html = projects.map((proj, pIdx) => renderProject(proj, pIdx)).join("");
    $list().innerHTML = html;
    wireProjectEvents();
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
              ${STATE_OPTIONS.map((o) => `
                <option value="${o.key}" ${o.key === ph.s ? "selected" : ""}>${o.label}</option>
              `).join("")}
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
        </div>
      `;
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

        <div class="adm-phases">
          ${phasesHtml}
        </div>
      </article>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // ── Wiring ─────────────────────────────────────────────────

  function wireProjectEvents() {
    $list().querySelectorAll(".adm-project").forEach((card) => {
      const pIdx = +card.dataset.p;
      const proj = projects[pIdx];
      if (!proj) return;

      card.querySelector(".js-name").addEventListener("input", (e) => {
        proj.name = e.target.value;
      });
      card.querySelector(".js-code").addEventListener("input", (e) => {
        proj.code = e.target.value;
      });
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
          // Live-update just the pct label + summary without full re-render.
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
    proj.overall = overall;
    proj.status = status;
    const pct = Math.round(overall * 100);
    const sum = card.querySelector(".adm-project-summary");
    sum.className = `adm-project-summary s-${status}`;
    sum.querySelector(".adm-project-pct").textContent = `${pct}%`;
    sum.querySelector(".adm-project-bar .fill").style.width = `${pct}%`;
    sum.querySelector(".adm-project-status").textContent = STATUS_LABEL[status];
  }

  // ── Actions ────────────────────────────────────────────────

  function addProject() {
    const nextNum = projects.length + 1;
    const code = `PRJ-${String(100 + nextNum).slice(-3)}`;
    projects.push({
      name: "New Project",
      code,
      phases: phases.map(() => ({ s: "idle", p: 0.0, d: 0 })),
      overall: 0,
      status: "idle",
    });
    render();
    // Focus the name of the new project for quick editing.
    const cards = $list().querySelectorAll(".adm-project");
    const last = cards[cards.length - 1];
    if (last) last.querySelector(".js-name").focus();
  }

  async function saveAll() {
    recomputeAll();
    // Drop empty-name rows silently — server also filters them.
    const valid = projects.filter((p) => (p.name || "").trim());
    if (valid.length !== projects.length) {
      flash("Skipped projects with empty names.", "warn");
    }
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
      flash("Saved.", "ok");
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
      // Pad phase arrays so each project has exactly phases.length entries.
      projects.forEach((p) => {
        p.phases = p.phases || [];
        while (p.phases.length < phases.length) {
          p.phases.push({ s: "idle", p: 0.0, d: 0 });
        }
        p.phases.length = phases.length;
      });
      render();
    } catch (err) {
      $list().innerHTML = `<div class="adm-empty">Load failed: ${err.message}</div>`;
    }
  }

  document.getElementById("btn-add").addEventListener("click", addProject);
  document.getElementById("btn-save").addEventListener("click", saveAll);

  load();
})();

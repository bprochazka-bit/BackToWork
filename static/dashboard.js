/* Dashboard shell + rotator. Views are built dynamically from
   window.DASHBOARD_PAGES; each page is rendered by the template
   registered in window.VIEW_TEMPLATES[page.template]. */

(function () {
  const stage = document.getElementById("stage");
  const viewHost = document.getElementById("view-host");
  const footer = document.getElementById("footer");
  const dotsEl = document.getElementById("footer-dots");
  const progressFill = document.getElementById("progress-fill");
  const viewNameEl = document.getElementById("view-name");
  const viewIdxEl = document.getElementById("view-idx");

  /* ---------- Scaling: fit 3840×2160 into viewport ---------- */
  function fitStage() {
    if (typeof window.__fitStage === "function") { window.__fitStage(); return; }
    const s = Math.min(window.innerWidth / 3840, window.innerHeight / 2160);
    const tx = (window.innerWidth - 3840 * s) / 2;
    const ty = (window.innerHeight - 2160 * s) / 2;
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }
  fitStage();
  window.addEventListener("resize", fitStage);

  /* ---------- Clock ---------- */
  const clockTime = document.getElementById("clock-time");
  const clockDate = document.getElementById("clock-date");
  function updateClock() {
    const d = new Date();
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const ap = d.getHours() >= 12 ? "PM" : "AM";
    const h12 = (d.getHours() % 12) || 12;
    clockTime.textContent = `${h12}:${m}:${s} ${ap}`;
    const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()];
    const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()];
    clockDate.textContent = `${DOW} · ${MON} ${d.getDate()} · ${d.getFullYear()}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  /* ---------- Views (built from pages) ---------- */
  let VIEWS = {};        // id -> { name, template, data }
  let order = [];        // ordered list of page ids
  const containers = {}; // id -> DOM element

  function buildViews(pages) {
    VIEWS = {};
    (pages || []).forEach((p) => {
      VIEWS[p.id] = { name: p.name || p.id, template: p.template, data: p.data };
    });
    order = (pages || []).map((p) => p.id);
  }

  function ensureContainers() {
    Object.keys(VIEWS).forEach((id) => {
      if (!containers[id]) {
        const el = document.createElement("div");
        el.className = "view";
        el.id = `view-${id}`;
        el.setAttribute("data-screen-label", VIEWS[id].name);
        viewHost.appendChild(el);
        containers[id] = el;
      }
    });
    // Drop containers for pages that no longer exist
    Object.keys(containers).forEach((id) => {
      if (!VIEWS[id]) {
        containers[id].remove();
        delete containers[id];
      }
    });
  }

  function renderView(id) {
    const v = VIEWS[id];
    if (!v) return;
    const tpl = window.VIEW_TEMPLATES && window.VIEW_TEMPLATES[v.template];
    if (typeof tpl === "function") {
      tpl(containers[id], v.data);
    } else {
      containers[id].innerHTML =
        `<div style="padding:64px;font-family:var(--font-mono);color:var(--bad);">
          Unknown template: ${v.template}</div>`;
    }
  }

  /* ---------- Rotator ---------- */
  let cur = 0;
  let interval = 60 * 1000;
  let paused = false;
  let timer = null;
  let tickStart = 0;
  let rafId = 0;

  function show(idx) {
    if (!order.length) return;
    cur = (idx + order.length) % order.length;
    const id = order[cur];
    if (!VIEWS[id]) return;

    renderView(id);

    Object.keys(containers).forEach((k) => containers[k].classList.remove("is-active"));
    containers[id].classList.add("is-active");

    viewNameEl.textContent = VIEWS[id].name;
    viewIdxEl.textContent = `${String(cur + 1).padStart(2, "0")} / ${String(order.length).padStart(2, "0")}`;

    buildDots();
    resetProgress();
  }

  function next() { show(cur + 1); }
  function prev() { show(cur - 1); }

  function buildDots() {
    dotsEl.innerHTML = "";
    order.forEach((id, i) => {
      const dot = document.createElement("button");
      dot.className = "gf-dot" + (i === cur ? " is-active" : "");
      dot.textContent = VIEWS[id].name;
      dot.title = VIEWS[id].name;
      dot.onclick = () => show(i);
      dotsEl.appendChild(dot);
    });
  }

  function resetProgress() {
    tickStart = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tickProgress);
    if (timer) clearTimeout(timer);
    if (!paused) {
      timer = setTimeout(next, interval);
    } else {
      progressFill.style.width = "0%";
    }
  }

  function tickProgress() {
    if (paused) { progressFill.style.width = "0%"; return; }
    const pct = Math.min(100, ((performance.now() - tickStart) / interval) * 100);
    progressFill.style.width = pct + "%";
    if (pct < 100) rafId = requestAnimationFrame(tickProgress);
  }

  /* ---------- Public API ---------- */
  window.DashRotator = {
    show, next, prev,
    setPaused(p) {
      paused = !!p;
      if (paused) { if (timer) clearTimeout(timer); progressFill.style.width = "0%"; }
      else { resetProgress(); }
    },
    setInterval(ms) {
      interval = Math.max(3000, ms | 0);
      resetProgress();
    },
    setOrder(list) {
      if (!Array.isArray(list) || !list.length) return;
      const known = list.filter((k) => VIEWS[k]);
      if (!known.length) return;
      // Append any pages not mentioned in the supplied order
      order.forEach((id) => { if (!known.includes(id)) known.push(id); });
      const curId = order[cur];
      order = known;
      const ni = order.indexOf(curId);
      cur = ni >= 0 ? ni : 0;
      show(cur);
    },
    rebuild(pages) {
      const curId = order[cur];
      buildViews(pages);
      ensureContainers();
      // Re-apply a saved tweak order if present
      if (window.DASH_TWEAKS && Array.isArray(window.DASH_TWEAKS.viewOrder)
          && window.DASH_TWEAKS.viewOrder.length) {
        const known = window.DASH_TWEAKS.viewOrder.filter((k) => VIEWS[k]);
        order.forEach((id) => { if (!known.includes(id)) known.push(id); });
        if (known.length) order = known;
      }
      const ni = order.indexOf(curId);
      cur = ni >= 0 ? ni : 0;
      show(cur);
    },
    getState() { return { cur, order: order.slice(), paused, interval }; },
  };

  /* ---------- Keyboard ---------- */
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " ") {
      e.preventDefault();
      window.DashRotator.setPaused(!paused);
    }
  });

  /* ---------- Auto-hide footer after 3s of no mouse ---------- */
  let hideTimer = null;
  function showChrome() {
    footer.classList.remove("is-hidden");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => footer.classList.add("is-hidden"), 3000);
  }
  showChrome();
  window.addEventListener("mousemove", showChrome);
  window.addEventListener("mousedown", showChrome);

  /* ---------- Boot ---------- */
  buildViews(window.DASHBOARD_PAGES || []);
  ensureContainers();

  if (window.DASH_TWEAKS) {
    if (window.DASH_TWEAKS.rotationSeconds) interval = window.DASH_TWEAKS.rotationSeconds * 1000;
    if (Array.isArray(window.DASH_TWEAKS.viewOrder) && window.DASH_TWEAKS.viewOrder.length) {
      const known = window.DASH_TWEAKS.viewOrder.filter((k) => VIEWS[k]);
      order.forEach((id) => { if (!known.includes(id)) known.push(id); });
      if (known.length) order = known;
    }
    if (window.DASH_TWEAKS.paused) paused = true;
  }

  const savedIdx = parseInt(localStorage.getItem("tackeff_dash_idx") || "0", 10);
  cur = (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < order.length) ? savedIdx : 0;

  const origShow = window.DashRotator.show;
  window.DashRotator.show = function (idx) {
    origShow(idx);
    try { localStorage.setItem("tackeff_dash_idx", String(cur)); } catch (e) {}
  };

  show(cur);
})();

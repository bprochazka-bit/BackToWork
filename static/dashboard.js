/* Dashboard shell + rotator */

(function() {
  const stageWrap = document.getElementById("stage-wrap");
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
    const sx = window.innerWidth / 3840;
    const sy = window.innerHeight / 2160;
    const s = Math.min(sx, sy);
    const tx = (window.innerWidth  - 3840 * s) / 2;
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
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = (h % 12) || 12;
    clockTime.textContent = `${h12}:${m}:${s} ${ap}`;
    const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()];
    const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getMonth()];
    clockDate.textContent = `${DOW} · ${MON} ${d.getDate()} · ${d.getFullYear()}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  /* ---------- Views registry (extensible) ---------- */
  const VIEWS = {
    calendar:     { name: "Calendar",        render: window.renderCalendarView },
    status:       { name: "Project Status",  render: window.renderStatusView },
    capabilities: { name: "Capabilities",    render: window.renderCapabilitiesView },
  };
  // Expose so new views can register later:
  //   window.DashRotator.registerView('myId', {name: 'My View', render: (host) => {...}});

  /* ---------- Rotator ---------- */
  let order = ["calendar", "status", "capabilities"];
  let cur = 0;
  let interval = 60 * 1000;
  let paused = false;
  let timer = null;
  let tickStart = 0;
  let rafId = 0;

  // Pre-build view containers (so transitions feel crisp)
  const containers = {};
  function ensureContainers() {
    Object.keys(VIEWS).forEach(id => {
      if (!containers[id]) {
        const el = document.createElement("div");
        el.className = "view";
        el.id = `view-${id}`;
        el.setAttribute("data-screen-label", VIEWS[id].name);
        viewHost.appendChild(el);
        containers[id] = el;
      }
    });
  }
  ensureContainers();

  function renderView(id) {
    const v = VIEWS[id];
    if (!v) return;
    v.render(containers[id]);
  }

  function show(idx) {
    cur = (idx + order.length) % order.length;
    const id = order[cur];
    if (!VIEWS[id]) return;

    renderView(id);

    Object.keys(containers).forEach(k => containers[k].classList.remove("is-active"));
    containers[id].classList.add("is-active");

    viewNameEl.textContent = VIEWS[id].name;
    viewIdxEl.textContent = `${String(cur+1).padStart(2,"0")} / ${String(order.length).padStart(2,"0")}`;

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
    if (paused) {
      progressFill.style.width = "0%";
      return;
    }
    const elapsed = performance.now() - tickStart;
    const pct = Math.min(100, (elapsed / interval) * 100);
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
      interval = Math.max(3000, ms|0);
      resetProgress();
    },
    setOrder(list) {
      if (!Array.isArray(list) || !list.length) return;
      const known = list.filter(k => VIEWS[k]);
      if (!known.length) return;
      const curId = order[cur];
      order = known;
      const newIdx = order.indexOf(curId);
      cur = newIdx >= 0 ? newIdx : 0;
      show(cur);
    },
    registerView(id, spec) {
      VIEWS[id] = spec;
      if (!order.includes(id)) order.push(id);
      ensureContainers();
      buildDots();
    },
    getState() { return { cur, order: order.slice(), paused, interval }; },
  };

  /* ---------- Keyboard ---------- */
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { next(); }
    else if (e.key === "ArrowLeft") { prev(); }
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
  // Apply saved tweaks if present
  if (window.DASH_TWEAKS) {
    if (window.DASH_TWEAKS.rotationSeconds) interval = window.DASH_TWEAKS.rotationSeconds * 1000;
    if (window.DASH_TWEAKS.viewOrder) {
      const known = window.DASH_TWEAKS.viewOrder.filter(k => VIEWS[k]);
      if (known.length) order = known;
    }
    if (window.DASH_TWEAKS.paused) paused = true;
  }

  // Persist current view index
  const savedIdx = parseInt(localStorage.getItem("tackeff_dash_idx") || "0", 10);
  cur = (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < order.length) ? savedIdx : 0;

  show(cur);

  // Observe view changes → localStorage
  const origShow = window.DashRotator.show;
  window.DashRotator.show = function(idx) {
    origShow(idx);
    try { localStorage.setItem("tackeff_dash_idx", String(cur)); } catch (e) {}
  };
})();

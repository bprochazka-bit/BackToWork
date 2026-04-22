/* Tweaks panel — wired to the host edit-mode protocol */

(function() {
  const DEFAULTS = /*EDITMODE-BEGIN*/{
    "rotationSeconds": 60,
    "accentHue": 245,
    "showClock": "subtle",
    "density": "normal",
    "paused": false,
    "viewOrder": ["calendar", "status", "capabilities"]
  }/*EDITMODE-END*/;

  const state = Object.assign({}, DEFAULTS, loadLocal());

  // Apply on load
  applyAll();

  // Edit-mode protocol: listen FIRST, announce SECOND
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.type === "__activate_edit_mode") open();
    if (d.type === "__deactivate_edit_mode") close();
  });
  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch (e) {}

  // Keyboard shortcut: T toggles
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey) {
      const p = document.getElementById("tweaks-panel");
      if (p.classList.contains("is-open")) close(); else open();
    }
  });

  const ACCENTS = [
    { name: "Electric Blue", hue: 245 },
    { name: "Cyan",          hue: 205 },
    { name: "Lime",          hue: 135 },
    { name: "Amber",          hue: 75  },
    { name: "Magenta",        hue: 335 },
    { name: "Violet",         hue: 285 },
  ];

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem("tackeff_dash_tweaks")) || {}; }
    catch (e) { return {}; }
  }
  function saveLocal() {
    try { localStorage.setItem("tackeff_dash_tweaks", JSON.stringify(state)); } catch (e) {}
  }

  function set(key, val) {
    state[key] = val;
    saveLocal();
    applyAll();
    try {
      window.parent.postMessage({
        type: "__edit_mode_set_keys",
        edits: { [key]: val }
      }, "*");
    } catch (e) {}
    render();
  }

  function applyAll() {
    document.documentElement.style.setProperty("--accent-h", state.accentHue);
    const stage = document.getElementById("stage");
    if (stage) {
      stage.setAttribute("data-density", state.density);
      stage.setAttribute("data-show-clock", state.showClock);
    }
    // Clock visibility
    const clock = document.querySelector(".gh-clock");
    if (clock) {
      clock.style.display = state.showClock === "off" ? "none" : "flex";
      clock.style.opacity = state.showClock === "subtle" ? "0.75" : "1";
    }
    // Rotation controller picks up from window.DASH_TWEAKS
    window.DASH_TWEAKS = state;
    if (window.DashRotator) {
      window.DashRotator.setPaused(!!state.paused);
      window.DashRotator.setInterval(state.rotationSeconds * 1000);
      window.DashRotator.setOrder(state.viewOrder);
    }
  }

  function open() {
    document.getElementById("tweaks-panel").classList.add("is-open");
    render();
  }
  function close() {
    document.getElementById("tweaks-panel").classList.remove("is-open");
  }

  function render() {
    const el = document.getElementById("tweaks-panel");
    if (!el) return;
    el.innerHTML = `
      <div class="tweaks-h">
        <span>Tweaks</span>
        <span style="margin-left:auto; color: var(--fg-3);">Press T</span>
      </div>

      <div class="tw-row">
        <div class="tw-label"><span>Rotation Speed</span><span class="v">${state.rotationSeconds}s per view</span></div>
        <input type="range" class="tw-input" min="10" max="180" step="5" value="${state.rotationSeconds}"
               oninput="window.__tw('rotationSeconds', +this.value)"/>
      </div>

      <div class="tw-row">
        <div class="tw-label"><span>Accent Color</span><span class="v">${accentName(state.accentHue)}</span></div>
        <div class="tw-swatches">
          ${ACCENTS.map(a => `
            <div class="tw-swatch ${a.hue === state.accentHue ? "is-on" : ""}"
                 style="background: oklch(0.72 0.18 ${a.hue}); box-shadow: 0 0 12px oklch(0.72 0.18 ${a.hue});"
                 title="${a.name}"
                 onclick="window.__tw('accentHue', ${a.hue})"></div>
          `).join("")}
        </div>
      </div>

      <div class="tw-row">
        <div class="tw-label"><span>Clock</span><span class="v">${state.showClock}</span></div>
        <div class="tw-opts">
          ${["prominent","subtle","off"].map(opt => `
            <div class="tw-opt ${state.showClock === opt ? "is-on" : ""}"
                 onclick="window.__tw('showClock','${opt}')">${opt}</div>
          `).join("")}
        </div>
      </div>

      <div class="tw-row">
        <div class="tw-label"><span>Density</span><span class="v">${state.density}</span></div>
        <div class="tw-opts">
          ${["compact","normal","roomy"].map(opt => `
            <div class="tw-opt ${state.density === opt ? "is-on" : ""}"
                 onclick="window.__tw('density','${opt}')">${opt}</div>
          `).join("")}
        </div>
      </div>

      <div class="tw-row">
        <div class="tw-label"><span>Rotation</span><span class="v">${state.paused ? "paused" : "running"}</span></div>
        <div class="tw-opts">
          <div class="tw-opt ${!state.paused ? "is-on" : ""}" onclick="window.__tw('paused', false)">Play</div>
          <div class="tw-opt ${state.paused ? "is-on" : ""}" onclick="window.__tw('paused', true)">Pause</div>
          <div class="tw-opt" onclick="window.DashRotator && window.DashRotator.next()">Next ▸</div>
          <div class="tw-opt" onclick="window.DashRotator && window.DashRotator.prev()">◂ Prev</div>
        </div>
      </div>

      <div class="tw-row">
        <div class="tw-label"><span>View Order</span><span class="v">${state.viewOrder.length} views</span></div>
        <div class="tw-views">
          ${state.viewOrder.map((id, i) => {
            const name = ({calendar:"Calendar", status:"Project Status", capabilities:"Capabilities"})[id] || id;
            return `
              <div class="tw-view-row">
                <span class="handle">${String(i+1).padStart(2,"0")}</span>
                <span class="name">${name}</span>
                <span class="ord">
                  <button ${i===0 ? "disabled" : ""} onclick="window.__twMove(${i}, -1)">▲</button>
                  <button ${i===state.viewOrder.length-1 ? "disabled" : ""} onclick="window.__twMove(${i}, 1)">▼</button>
                </span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <div class="tw-row">
        <button class="gf-btn" style="margin-top:4px;" onclick="window.__twReset()">Reset to Defaults</button>
      </div>
    `;
  }

  function accentName(h) {
    const a = ACCENTS.find(x => x.hue === h);
    return a ? a.name : `hue ${h}`;
  }

  // Expose handlers used in inline onclick (simpler than delegating)
  window.__tw = set;
  window.__twMove = function(idx, dir) {
    const o = state.viewOrder.slice();
    const j = idx + dir;
    if (j < 0 || j >= o.length) return;
    [o[idx], o[j]] = [o[j], o[idx]];
    set("viewOrder", o);
  };
  window.__twReset = function() {
    Object.assign(state, DEFAULTS);
    saveLocal();
    applyAll();
    render();
  };
})();

/* Tweaks panel — toggle with 't' key */

(function () {
  "use strict";

  function init(api) {
    const panel = document.getElementById("tweaks-panel");
    if (!panel) return;

    const stage = api.getStage();

    panel.innerHTML =
      '<h3>Tweaks</h3>' +

      '<div class="tweaks-row">' +
        '<label>Rotate (sec)</label>' +
        '<input type="number" id="tw-rotate" min="2" max="600" step="1"/>' +
      '</div>' +

      '<div class="tweaks-row">' +
        '<label>Density</label>' +
        '<select id="tw-density">' +
          '<option value="compact">Compact</option>' +
          '<option value="normal" selected>Normal</option>' +
          '<option value="roomy">Roomy</option>' +
        '</select>' +
      '</div>' +

      '<div class="tweaks-row">' +
        '<label>Clock</label>' +
        '<select id="tw-clock">' +
          '<option value="off">Off</option>' +
          '<option value="subtle" selected>Subtle</option>' +
          '<option value="bold">Bold</option>' +
        '</select>' +
      '</div>' +

      '<div class="tweaks-hint">Press <b>t</b> to toggle this panel.<br/>' +
      '<b>Space</b> pause · <b>← →</b> nav · <b>r</b> reload</div>';

    const rotateInput = document.getElementById("tw-rotate");
    rotateInput.value = Math.round(api.getRotateMs() / 1000);
    rotateInput.addEventListener("change", () => {
      const sec = Math.max(2, Math.min(600, parseInt(rotateInput.value, 10) || 30));
      api.setRotateMs(sec * 1000);
      rotateInput.value = sec;
    });

    const densitySel = document.getElementById("tw-density");
    densitySel.value = stage.dataset.density || "normal";
    densitySel.addEventListener("change", () => {
      stage.dataset.density = densitySel.value;
    });

    const clockSel = document.getElementById("tw-clock");
    clockSel.value = stage.dataset.showClock || "subtle";
    clockSel.addEventListener("change", () => {
      stage.dataset.showClock = clockSel.value;
    });
  }

  window.Tweaks = { init };
})();

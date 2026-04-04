// ============================================================================
// UI — DOM binding, slider wiring, formula display
// ============================================================================

import { LogarithmicSlider, IntegerSlider, generateOneSigFigValues } from './utils/sliders.js';

// ---- Max-steps/sec slider: log values 1..1e4, plus Infinity at the end -----
class MaxSpsSlider {
  constructor() {
    this.values = [...generateOneSigFigValues(1, 1e4), Infinity];
  }
  sliderToValue(position) {
    const index = Math.round((position / 100) * (this.values.length - 1));
    return this.values[Math.max(0, Math.min(index, this.values.length - 1))];
  }
  valueToSlider(value) {
    if (!isFinite(value)) return 100;
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < this.values.length; i++) {
      const d = Math.abs(this.values[i] - value);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return (best / (this.values.length - 1)) * 100;
  }
}

// ---- Slider configs --------------------------------------------------------
export const sliderDefs = {
  width:         { helper: new IntegerSlider(1, 10),        isInt: true  },
  initScale:     { helper: new LogarithmicSlider(1e-4, 10), isInt: false },
  eta:           { helper: new LogarithmicSlider(1e-6, 1),  isInt: false },
  maxStepsPerSec:{ helper: new MaxSpsSlider(),              isInt: false },
};

// ---- Format a number for display -------------------------------------------
function formatVal(val, isInt) {
  if (isInt) return String(Math.round(val));
  if (!isFinite(val)) return 'no limit';
  const abs = Math.abs(val);
  if (abs === 0) return '0';
  if (abs >= 0.001 && abs < 10000) return String(parseFloat(val.toPrecision(2)));
  // scientific
  const exp = Math.floor(Math.log10(abs));
  const mant = val / Math.pow(10, exp);
  const mantStr = parseFloat(mant.toPrecision(2));
  return `${mantStr}×10^${exp}`;
}

function updateSliderDisplay(key, appState) {
  const el = document.getElementById(`value_${key}`);
  if (!el) return;
  const def = sliderDefs[key];
  el.textContent = formatVal(appState[key], def.isInt);
}

// ---- Formula display -------------------------------------------------------
export function updateFormula(depth) {
  const el = document.getElementById('formulaDisplay');
  if (!el) return;
  const matrices = Array.from({ length: depth }, (_, k) => `W_{${k+1}}`).join(' ');
  el.innerHTML = `$$\\mathcal{L} = \\left\\| M^* - ${matrices} \\right\\|_F^2$$`;
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([el]).catch(() => {});
  }
}

// ---- Wait for MathJax ------------------------------------------------------
export function waitForMathJax(onReady, attempts = 0) {
  if (window.MathJax && window.MathJax.typesetPromise &&
      window.MathJax.startup && window.MathJax.startup.promise) {
    window.MathJax.startup.promise.then(onReady);
  } else if (attempts < 100) {
    setTimeout(() => waitForMathJax(onReady, attempts + 1), 50);
  } else {
    console.warn('MathJax did not load in time');
    onReady();
  }
}

// ---- Bind all UI controls --------------------------------------------------
export function bindUI(appState, { onParamChange, onSimControl }) {
  // Log/int sliders
  for (const key of Object.keys(sliderDefs)) {
    const el = document.getElementById(`slider_${key}`);
    if (!el) continue;
    const def = sliderDefs[key];
    el.value = def.helper.valueToSlider(appState[key]);
    updateSliderDisplay(key, appState);
    el.addEventListener('input', () => {
      appState[key] = def.helper.sliderToValue(parseFloat(el.value));
      updateSliderDisplay(key, appState);
      appState.save();
      onParamChange();
    });
  }

  // Depth buttons (2 / 3 / 4)
  for (const btn of document.querySelectorAll('.depth-btn')) {
    const d = parseInt(btn.dataset.depth, 10);
    if (d === appState.depth) btn.classList.add('active');
    btn.addEventListener('click', () => {
      appState.depth = d;
      appState.save();
      document.querySelectorAll('.depth-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.depth, 10) === d));
      updateFormula(d);
      onParamChange();
    });
  }

  // Sim controls
  document.getElementById('startPauseBtn').addEventListener('click', () => onSimControl.startPause());
  document.getElementById('resetBtn').addEventListener('click',      () => onSimControl.reset());
}

// ---- Restore all UI from state ---------------------------------------------
export function restoreUI(appState) {
  for (const key of Object.keys(sliderDefs)) updateSliderDisplay(key, appState);
  document.querySelectorAll('.depth-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.depth, 10) === appState.depth);
  });
  updateFormula(appState.depth);
}

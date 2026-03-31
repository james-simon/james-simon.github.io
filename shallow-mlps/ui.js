// ============================================================================
// UI — DOM binding, slider wiring, network diagram, formula display
// ============================================================================

import { LogarithmicSlider } from './utils/sliders.js';
import { formatLatex } from './formatters.js';
import { targetLatex, setCustomExpr } from './targets.js';

// ---- Logarithmic slider configs --------------------------------------------
// numTerms uses a plain integer range [1,5] — handled separately in bindNumTerms
export const sliderDefs = {
  n:         { helper: new LogarithmicSlider(10, 1000),  isInt: true  },
  d:         { helper: new LogarithmicSlider(1, 200),    isInt: true  },
  batchSize: { helper: new LogarithmicSlider(1, 10000),  isInt: true  },
  eta:       { helper: new LogarithmicSlider(1e-5, 10),  isInt: false },
  alpha:     { helper: new LogarithmicSlider(1e-6, 1),   isInt: false },
};

// ---- EMA slider values (shared with charts) --------------------------------
export const EMA_VALUES = [1, 10, 20, 30, 50, 70, 100, 200, 300, 500, 700, 1000, 2000, 3000, 5000, 7000, 10000];

export function emaSliderToWindow(pos) {
  return EMA_VALUES[Math.min(Math.round(pos), EMA_VALUES.length - 1)];
}

// ---- MathJax helper --------------------------------------------------------
export function typeset(els) {
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise(Array.isArray(els) ? els : [els]).catch(() => {});
  }
}

// ---- Slider display --------------------------------------------------------
function updateSliderDisplay(key, appState) {
  const el = document.getElementById(`value_${key}`);
  if (!el) return;
  const def = sliderDefs[key];
  if (def.isInt) {
    el.textContent = String(Math.round(appState[key]));
  } else {
    el.innerHTML = `$${formatLatex(appState[key])}$`;
    typeset(el);
  }
}

// ---- Target formula --------------------------------------------------------
export function updateTargetFormula(appState) {
  const el = document.getElementById('targetFormula');
  if (!el) return;
  el.innerHTML = `$$${targetLatex(appState.targetType, appState.numTerms)}$$`;
  typeset(el);
}

// ---- Custom expr input visibility ------------------------------------------
function updateTargetUIVisibility(targetType) {
  const numTermsDiv   = document.getElementById('numTermsDiv');
  const customExprDiv = document.getElementById('customExprDiv');
  if (!numTermsDiv || !customExprDiv) return;
  const isCustom = targetType === 'custom';
  numTermsDiv.style.display   = isCustom ? 'none' : 'flex';
  customExprDiv.style.display = isCustom ? 'flex' : 'none';
}

// ---- Network diagram -------------------------------------------------------
export function renderNetworkViz(appState) {
  const svg = document.getElementById('networkViz');
  if (!svg) return;
  svg.innerHTML = '';

  const { n, d } = appState;
  const WIDTH = 380, PAD = 16, BASE_H = 18, GAP = 5, LABEL_SP = 36;
  const calcH = dim => BASE_H * (Math.log2(dim) + 1);

  const layerDims = [d, n, 1];
  const heights   = layerDims.map(calcH);
  const maxH      = Math.max(...heights);
  const totalH    = maxH + 2 * PAD + LABEL_SP;
  const centerY   = PAD + LABEL_SP / 2 + maxH / 2;

  svg.setAttribute('width', WIDTH);
  svg.setAttribute('height', totalH);

  const spacing = (WIDTH - 2 * PAD) / (layerDims.length + 1);
  const xPos    = [PAD + spacing, PAD + 2 * spacing, PAD + 3 * spacing];

  const trapColors = ['rgba(100,150,230,0.45)', 'rgba(220,100,80,0.35)'];
  const trapLabels = ['$\\mathbf{W}$', '$\\mathbf{a}$'];

  for (let i = 0; i < 2; i++) {
    const pts = [
      [xPos[i] + GAP,   centerY - heights[i]  / 2],
      [xPos[i+1] - GAP, centerY - heights[i+1]/ 2],
      [xPos[i+1] - GAP, centerY + heights[i+1]/ 2],
      [xPos[i] + GAP,   centerY + heights[i]  / 2],
    ];
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', pts.map(p => p.join(',')).join(' '));
    poly.setAttribute('fill', trapColors[i]);
    svg.appendChild(poly);
  }

  for (let i = 0; i < 3; i++) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', xPos[i]); line.setAttribute('x2', xPos[i]);
    line.setAttribute('y1', centerY - heights[i] / 2);
    line.setAttribute('y2', centerY + heights[i] / 2);
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '3');
    svg.appendChild(line);
  }

  function addLabel(x, y, w, h, text, align = 'center') {
    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', x - w/2); fo.setAttribute('y', y - h/2);
    fo.setAttribute('width', w);   fo.setAttribute('height', h);
    const div = document.createElement('div');
    div.style.cssText = `display:flex;justify-content:${align};align-items:center;height:100%;color:#444;font-size:14px;`;
    div.textContent = text;
    fo.appendChild(div);
    svg.appendChild(fo);
  }

  for (let i = 0; i < 2; i++) addLabel((xPos[i] + xPos[i+1]) / 2, centerY, 46, 24, trapLabels[i]);
  addLabel(xPos[0] - 18, centerY, 30, 24, '$\\mathbf{x}$');
  addLabel(xPos[1], centerY - heights[1] / 2 - 14, 72, 22, '$\\sigma(\\cdot)$');
  addLabel(xPos[2] + 46, centerY, 80, 24, '$\\hat{f}(\\mathbf{x})$', 'flex-start');
  const annY = centerY + maxH / 2 + 16;
  addLabel(xPos[0], annY, 36, 20, '$d$');
  addLabel(xPos[1], annY, 36, 20, '$n$');
  addLabel(xPos[2], annY, 24, 20, '1');

  typeset(svg);
}

// ---- Bind all UI controls --------------------------------------------------
// onParamChange: called when any hyperparameter slider changes (triggers reset)
// onTargetChange: called when target type or numTerms changes
// onSimControl: { startPause, reset } callbacks
// onEmaChange: called with new window value
export function bindUI(appState, {
  onParamChange,
  onTargetChange,
  onSimControl,
  onEmaChange,
}) {
  // Log sliders
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
      renderNetworkViz(appState);
      onParamChange();
    });
  }

  // numTerms slider (plain integer)
  const numTermsSlider = document.getElementById('slider_numTerms');
  const numTermsVal    = document.getElementById('value_numTerms');
  numTermsSlider.value = appState.numTerms;
  if (numTermsVal) numTermsVal.textContent = String(appState.numTerms);
  numTermsSlider.addEventListener('input', () => {
    appState.numTerms = parseInt(numTermsSlider.value, 10);
    appState.save();
    if (numTermsVal) numTermsVal.textContent = String(appState.numTerms);
    updateTargetFormula(appState);
    onTargetChange();
  });

  // Activation select
  const activationSelect = document.getElementById('activationSelect');
  activationSelect.value = appState.activation;
  activationSelect.addEventListener('change', () => {
    appState.activation = activationSelect.value;
    appState.save();
    onParamChange();
  });

  // Target type select
  const targetTypeSelect = document.getElementById('targetTypeSelect');
  targetTypeSelect.value = appState.targetType;
  updateTargetUIVisibility(appState.targetType);
  targetTypeSelect.addEventListener('change', () => {
    appState.targetType = targetTypeSelect.value;
    appState.save();
    updateTargetUIVisibility(appState.targetType);
    updateTargetFormula(appState);
    onTargetChange();
  });

  // Custom expression input
  const customExprInput = document.getElementById('customExprInput');
  if (customExprInput) {
    customExprInput.value = appState.customExpr ?? '';
    setCustomExpr(appState.customExpr ?? '');
    customExprInput.addEventListener('input', () => {
      const expr = customExprInput.value;
      appState.customExpr = expr;
      appState.save();
      setCustomExpr(expr);
      // Validate: try to compile and show/clear error state
      try {
        new Function('x', `return (${expr});`);
        customExprInput.style.borderColor = '';
      } catch (e) {
        customExprInput.style.borderColor = '#c00';
      }
      updateTargetFormula(appState);
      if (appState.targetType === 'custom') onTargetChange();
    });
  }

  // Sim controls
  const startPauseBtn = document.getElementById('startPauseBtn');
  const resetBtn      = document.getElementById('resetBtn');
  startPauseBtn.addEventListener('click', () => onSimControl.startPause());
  resetBtn.addEventListener('click',      () => onSimControl.reset());

  // Seed
  const manualSeedCheckbox = document.getElementById('manualSeedCheckbox');
  const seedInputDiv       = document.getElementById('seedInputDiv');
  const seedInput          = document.getElementById('seedInput');
  manualSeedCheckbox.checked    = appState.manualSeed;
  seedInputDiv.style.display    = appState.manualSeed ? 'inline-block' : 'none';
  if (appState.seedValue !== undefined) seedInput.value = appState.seedValue;
  manualSeedCheckbox.addEventListener('change', () => {
    appState.manualSeed = manualSeedCheckbox.checked;
    seedInputDiv.style.display = manualSeedCheckbox.checked ? 'inline-block' : 'none';
    appState.save();
    onParamChange();
  });
  seedInput.addEventListener('change', () => {
    appState.seedValue = parseInt(seedInput.value, 10) || 0;
    appState.save();
    onParamChange();
  });

  // EMA slider
  const emaSlider  = document.getElementById('emaSlider');
  const emaValueEl = document.getElementById('emaValue');
  emaSlider.max   = String(EMA_VALUES.length - 1);
  emaSlider.value = String(appState.emaPos);
  const initW = emaSliderToWindow(appState.emaPos);
  if (emaValueEl) emaValueEl.textContent = initW === 1 ? 'off' : String(initW);
  onEmaChange(initW);
  emaSlider.addEventListener('input', () => {
    const pos = parseFloat(emaSlider.value);
    const w   = emaSliderToWindow(pos);
    appState.emaPos = pos;
    appState.save();
    if (emaValueEl) emaValueEl.textContent = w === 1 ? 'off' : String(w);
    onEmaChange(w);
  });
}

// ---- Initial restore of all UI state ---------------------------------------
export function restoreUI(appState) {
  document.getElementById('activationSelect').value  = appState.activation;
  document.getElementById('targetTypeSelect').value  = appState.targetType;
  document.getElementById('slider_numTerms').value   = appState.numTerms;
  const numTermsVal = document.getElementById('value_numTerms');
  if (numTermsVal) numTermsVal.textContent = String(appState.numTerms);
  for (const key of Object.keys(sliderDefs)) updateSliderDisplay(key, appState);
  // Restore custom expression
  setCustomExpr(appState.customExpr ?? '');
  const customExprInput = document.getElementById('customExprInput');
  if (customExprInput) customExprInput.value = appState.customExpr ?? '';
  updateTargetUIVisibility(appState.targetType);
  updateTargetFormula(appState);
  renderNetworkViz(appState);
}

// ---- Wait for MathJax then call onReady ------------------------------------
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

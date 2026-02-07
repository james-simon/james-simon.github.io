// Expander Nets Application

import { AppState } from './state.js';

console.log('Expander Nets loaded');

// Initialize state and load from localStorage
const appState = new AppState();
appState.load();

// Use state values
let currentD = appState.d;
let gammaValues = [...appState.gammaValues];
let alphaValues = [...appState.alphaValues];

/**
 * Generate values with 1 significant figure for logarithmic sliders
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number[]} Array of values: 1, 2, 3, ..., 9, 10, 20, 30, ..., 90, 100, 200, etc.
 */
function generateOneSigFigValues(min, max) {
  const values = [];
  let power = Math.floor(Math.log10(min));

  while (true) {
    const base = Math.pow(10, power);
    for (let digit = 1; digit <= 9; digit++) {
      const value = digit * base;
      if (value >= min && value <= max) {
        values.push(value);
      }
      if (value > max) return values;
    }
    power++;
  }
}

/**
 * Format value in scientific notation with superscripts
 * @param {number} value - Value to format
 * @returns {string} Formatted string (e.g., "2×10⁻³")
 */
function formatScientific(value) {
  if (value === 1) return '1';

  const exponent = Math.floor(Math.log10(value));
  const mantissa = value / Math.pow(10, exponent);
  const roundedMantissa = Math.round(mantissa * 1e10) / 1e10;

  if (Math.abs(roundedMantissa - 1) < 1e-10) {
    if (exponent === 0) return '1';
    return `10<sup>${exponent}</sup>`;
  } else {
    if (exponent === 0) return roundedMantissa.toString();
    return `${roundedMantissa}×10<sup>${exponent}</sup>`;
  }
}

/**
 * Generic logarithmic slider class for mapping slider position to values
 */
class LogarithmicSlider {
  constructor(min, max) {
    this.values = generateOneSigFigValues(min, max);
  }

  sliderToValue(position) {
    const index = Math.round((position / 100) * (this.values.length - 1));
    return this.values[index];
  }

  valueToSlider(value) {
    let closestIndex = 0;
    let closestDist = Math.abs(value - this.values[0]);
    for (let i = 1; i < this.values.length; i++) {
      const dist = Math.abs(value - this.values[i]);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }
    return (closestIndex / (this.values.length - 1)) * 100;
  }
}

/**
 * Logarithmic slider that starts at a minimum value (no zero)
 * Just uses the standard logarithmic values [min, max]
 */
class LogarithmicSliderWithOff {
  constructor(min, max) {
    this.values = generateOneSigFigValues(min, max);
  }

  sliderToValue(position) {
    const index = Math.round((position / 100) * (this.values.length - 1));
    return this.values[index];
  }

  valueToSlider(value) {
    let closestIndex = 0;
    let closestDist = Math.abs(value - this.values[0]);
    for (let i = 1; i < this.values.length; i++) {
      const dist = Math.abs(value - this.values[i]);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }
    return (closestIndex / (this.values.length - 1)) * 100;
  }
}

const gammaSlider = new LogarithmicSlider(0.0001, 1);

/**
 * Generic function to render dynamic parameter sliders
 * @param {Object} config - Configuration object
 * @param {string} config.containerId - DOM element ID for container
 * @param {string} config.symbol - LaTeX symbol name (gamma, alpha, etc.)
 * @param {Array} config.values - Current parameter values
 * @param {Array} config.stateValues - State array reference
 * @param {Object} config.sliderConfig - Slider configuration (min, max, getValue, etc.)
 * @param {Function} [config.onUpdate] - Optional callback after value update
 */
function renderParameterSliders(config) {
  const { containerId, symbol, values, stateValues, sliderConfig, onUpdate } = config;
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (let i = 0; i < currentD; i++) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 14px;';

    const label = document.createElement('span');
    label.innerHTML = `$\\${symbol}_${i+1}$:`;
    label.style.cssText = 'min-width: 35px; text-align: right;';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = sliderConfig.min;
    slider.max = sliderConfig.max;
    slider.value = sliderConfig.getValue(values[i]);
    slider.style.width = '100px';
    slider.dataset.index = i;

    const valueDisplay = document.createElement('span');
    valueDisplay[sliderConfig.displayProp] = sliderConfig.formatValue(values[i]);
    valueDisplay.style.cssText = `min-width: ${sliderConfig.displayWidth}; text-align: left; font-size: 13px;`;
    valueDisplay.id = `${symbol}Value${i}`;

    slider.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      const value = sliderConfig.parseValue(parseFloat(e.target.value));
      values[idx] = value;
      stateValues[idx] = value;
      appState.save();
      document.getElementById(`${symbol}Value${idx}`)[sliderConfig.displayProp] = sliderConfig.formatValue(value);
      if (onUpdate) onUpdate();
    });

    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(valueDisplay);
    container.appendChild(row);
  }

  // Render MathJax for labels
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([container]).catch((err) => console.log(err));
  } else if (window.MathJax && window.MathJax.Hub) {
    MathJax.Hub.Queue(["Typeset", MathJax.Hub, container]);
  }
}

// Render gamma sliders
function renderGammaSliders() {
  renderParameterSliders({
    containerId: 'gammaSliders',
    symbol: 'gamma',
    values: gammaValues,
    stateValues: appState.gammaValues,
    sliderConfig: {
      min: '0',
      max: '100',
      getValue: (val) => gammaSlider.valueToSlider(val).toString(),
      parseValue: (pos) => gammaSlider.sliderToValue(pos),
      formatValue: (val) => formatScientific(val),
      displayProp: 'innerHTML',
      displayWidth: '60px'
    }
  });
}

const kSlider = new LogarithmicSlider(10, 30000);
const etaSlider = new LogarithmicSlider(0.0001, 1);
const batchSizeSlider = new LogarithmicSlider(1, 1000);

// Initialize k slider
const kSliderElement = document.getElementById('kSlider');
const kValueElement = document.getElementById('kValue');

// Set value from state
kSliderElement.value = kSlider.valueToSlider(appState.k);
kValueElement.textContent = appState.k.toString();

// Update value on slider change
kSliderElement.addEventListener('input', (e) => {
  const value = kSlider.sliderToValue(parseFloat(e.target.value));
  kValueElement.textContent = value.toString();
  appState.k = value;
  appState.save();
});

// Initialize d slider (linear, 1-5)
const dSliderElement = document.getElementById('dSlider');
const dValueElement = document.getElementById('dValue');

// Set initial value from state
dSliderElement.value = appState.d;
dValueElement.textContent = appState.d.toString();

// Update value on slider change
dSliderElement.addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  dValueElement.textContent = value.toString();
  currentD = value;
  appState.d = value;
  appState.save();
  renderGammaSliders();
  renderAlphaSliders();
  updateTargetFunctionEquation();
});

// Render alpha sliders
function renderAlphaSliders() {
  renderParameterSliders({
    containerId: 'alphaSliders',
    symbol: 'alpha',
    values: alphaValues,
    stateValues: appState.alphaValues,
    sliderConfig: {
      min: '0',
      max: '3',
      getValue: (val) => val.toString(),
      parseValue: (pos) => parseInt(pos),
      formatValue: (val) => val.toString(),
      displayProp: 'textContent',
      displayWidth: '30px'
    },
    onUpdate: updateTargetFunctionEquation
  });
}

// Update target function equation based on d
function updateTargetFunctionEquation() {
  const terms = [];

  for (let i = 0; i < currentD; i++) {
    const alpha = alphaValues[i];
    const arg = `\\gamma_{${i+1}}^{-1/2} x_{${i+1}}`;

    if (alpha === 0) {
      // h_0 = 1, omit from product
      continue;
    } else if (alpha === 1) {
      // h_1(z) = z, just use the argument
      terms.push(arg);
    } else {
      // h_2 and higher, keep h_n notation
      terms.push(`h_{${alpha}}(${arg})`);
    }
  }

  // Determine what to render
  let productString;
  if (terms.length === 0) {
    // All alphas are 0, product is 1
    productString = '1';
  } else {
    // Join terms with cdot
    productString = terms.join(' \\cdot ');
  }

  const equation = `$$\\begin{align}
f_*(\\mathbf{x}) &= h_{\\boldsymbol{\\alpha}}\\left(\\mathbf{\\Gamma}^{-1/2} \\mathbf{x}\\right) \\\\
&= ${productString}
\\end{align}$$`;

  const container = document.getElementById('targetFunctionEquation');
  container.textContent = equation;

  // Render MathJax
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([container]).catch((err) => console.log(err));
  } else if (window.MathJax && window.MathJax.Hub) {
    MathJax.Hub.Queue(["Typeset", MathJax.Hub, container]);
  }
}

// Initialize eta slider
const etaSliderElement = document.getElementById('etaSlider');
const etaValueElement = document.getElementById('etaValue');

// Set value from state
etaSliderElement.value = etaSlider.valueToSlider(appState.eta);
etaValueElement.innerHTML = formatScientific(appState.eta);

// Update value on slider change
etaSliderElement.addEventListener('input', (e) => {
  const value = etaSlider.sliderToValue(parseFloat(e.target.value));
  etaValueElement.innerHTML = formatScientific(value);
  appState.eta = value;
  appState.save();

  // Update charts if using effective time
  const teffLink = document.getElementById('teff-link');
  if (teffLink && teffLink.classList.contains('active')) {
    lossChart.setEffectiveTime(true, value);
    normChart.setEffectiveTime(true, value);
  }
});

// Initialize batch size slider
const batchSizeSliderElement = document.getElementById('batchSizeSlider');
const batchSizeValueElement = document.getElementById('batchSizeValue');

// Set value from state
batchSizeSliderElement.value = batchSizeSlider.valueToSlider(appState.batchSize);
batchSizeValueElement.innerHTML = formatScientific(appState.batchSize);

// Update value on slider change
batchSizeSliderElement.addEventListener('input', (e) => {
  const value = batchSizeSlider.sliderToValue(parseFloat(e.target.value));
  batchSizeValueElement.innerHTML = formatScientific(value);
  appState.batchSize = value;
  appState.save();
});

// Network visualization constants
const NETWORK_VIZ = {
  WIDTH: 400,
  GAP: 6,           // Gap between trapezoids and lines
  PADDING: 10,      // Padding to prevent clipping
  LABEL_SPACE: 50,  // Extra space for labels above/below
  BASE_HEIGHT: 20,  // Base multiplier for height calculation
  NUM_LAYERS: 4
};

// Network visualization
function renderNetworkViz() {
  const svg = document.getElementById('networkViz');
  svg.innerHTML = ''; // Clear previous content

  // Get current dimensions
  const d = currentD;
  const k = kSlider.sliderToValue(parseFloat(document.getElementById('kSlider').value));

  // Calculate heights based on log2 formula
  const calcHeight = (dim) => NETWORK_VIZ.BASE_HEIGHT * (Math.log2(dim) + 1);

  const heights = [
    calcHeight(d),    // input layer
    calcHeight(d),    // hidden layer 1 (after W1)
    calcHeight(k),    // hidden layer 2 (after W~)
    calcHeight(1)     // output layer
  ];

  // Calculate required height based on max height + padding for labels
  const maxHeight = Math.max(...heights);
  const height = maxHeight + 2 * NETWORK_VIZ.PADDING + NETWORK_VIZ.LABEL_SPACE;

  // Update SVG dimensions
  svg.setAttribute('height', height);

  // Horizontal positions (equally spaced)
  const spacing = (NETWORK_VIZ.WIDTH - 2 * NETWORK_VIZ.PADDING) / (NETWORK_VIZ.NUM_LAYERS + 1);
  const xPositions = [];
  for (let i = 1; i <= NETWORK_VIZ.NUM_LAYERS; i++) {
    xPositions.push(NETWORK_VIZ.PADDING + spacing * i);
  }

  // Draw trapezoids first (so lines appear on top)
  const trapezoidColors = ['#aaaaaa', '#eeeeee', '#aaaaaa']; // Middle one (W_froz) is paler

  for (let i = 0; i < NETWORK_VIZ.NUM_LAYERS - 1; i++) {
    const x1 = xPositions[i] + NETWORK_VIZ.GAP;
    const x2 = xPositions[i + 1] - NETWORK_VIZ.GAP;
    const h1 = heights[i];
    const h2 = heights[i + 1];
    const centerY = height / 2;

    // Create trapezoid path
    const points = [
      [x1, centerY - h1/2],  // top-left
      [x2, centerY - h2/2],  // top-right
      [x2, centerY + h2/2],  // bottom-right
      [x1, centerY + h1/2]   // bottom-left
    ];

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    path.setAttribute('points', points.map(p => p.join(',')).join(' '));
    path.setAttribute('fill', trapezoidColors[i]);
    path.setAttribute('opacity', '0.5');
    svg.appendChild(path);
  }

  // Draw vertical lines (layers)
  const lineColor = '#333333';
  const lineWidth = 3;

  for (let i = 0; i < NETWORK_VIZ.NUM_LAYERS; i++) {
    const x = xPositions[i];
    const h = heights[i];
    const centerY = height / 2;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', centerY - h/2);
    line.setAttribute('x2', x);
    line.setAttribute('y2', centerY + h/2);
    line.setAttribute('stroke', lineColor);
    line.setAttribute('stroke-width', lineWidth);
    svg.appendChild(line);
  }

  // Add labels to trapezoids (weight matrices) using MathJax
  const trapezoidLabels = ['$\\mathbf{W}_1$', '$\\mathbf{W}_{\\mathrm{froz}}$', '$\\mathbf{W}_2$'];
  for (let i = 0; i < NETWORK_VIZ.NUM_LAYERS - 1; i++) {
    const centerX = (xPositions[i] + xPositions[i + 1]) / 2;
    const centerY = height / 2;

    const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    fo.setAttribute('x', centerX - 30);
    fo.setAttribute('y', centerY - 15);
    fo.setAttribute('width', '60');
    fo.setAttribute('height', '30');

    const div = document.createElement('div');
    div.style.cssText = 'display: flex; justify-content: center; align-items: center; height: 100%; color: #333; font-size: 16px;';
    div.textContent = trapezoidLabels[i];

    fo.appendChild(div);
    svg.appendChild(fo);
  }

  // Add labels for vertical lines using MathJax
  // Line 0 (input): x to the left
  const fo0 = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  fo0.setAttribute('x', xPositions[0] - 35);
  fo0.setAttribute('y', height / 2 - 15);
  fo0.setAttribute('width', '40');
  fo0.setAttribute('height', '30');
  const div0 = document.createElement('div');
  div0.style.cssText = 'display: flex; justify-content: center; align-items: center; height: 100%; color: #666; font-size: 14px;';
  div0.textContent = '$\\mathbf{x}$';
  fo0.appendChild(div0);
  svg.appendChild(fo0);

  // Line 2 (after sigma): sigma above the line
  const centerY = height / 2;
  const h2 = heights[2];
  const sigmaY = centerY - h2/2 - 28;
  const fo2 = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  fo2.setAttribute('x', xPositions[2] - 40);
  fo2.setAttribute('y', sigmaY);
  fo2.setAttribute('width', '80');
  fo2.setAttribute('height', '30');
  const div2 = document.createElement('div');
  div2.style.cssText = 'display: flex; justify-content: center; align-items: center; height: 100%; color: #666; font-size: 14px;';
  div2.textContent = '$\\sigma(\\cdot)$';
  fo2.appendChild(div2);
  svg.appendChild(fo2);

  // Line 3 (output): f hat to the right
  const fo3 = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  fo3.setAttribute('x', xPositions[3] + 5);
  fo3.setAttribute('y', height / 2 - 15);
  fo3.setAttribute('width', '60');
  fo3.setAttribute('height', '30');
  const div3 = document.createElement('div');
  div3.style.cssText = 'display: flex; justify-content: center; align-items: center; height: 100%; color: #666; font-size: 14px;';
  div3.textContent = '$\\hat{f}(\\mathbf{x})$';
  fo3.appendChild(div3);
  svg.appendChild(fo3);

  // Typeset MathJax for the SVG labels
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([svg]).catch((err) => console.log(err));
  } else if (window.MathJax && window.MathJax.Hub) {
    MathJax.Hub.Queue(["Typeset", MathJax.Hub, svg]);
  }
}

// Update network viz when d or k changes
document.getElementById('dSlider').addEventListener('input', () => {
  renderNetworkViz();
});

document.getElementById('kSlider').addEventListener('input', () => {
  renderNetworkViz();
});

// Initial render of gamma and alpha sliders
function initialRender() {
  renderGammaSliders();
  renderAlphaSliders();
  updateTargetFunctionEquation();
  renderNetworkViz();
}

// Wait for MathJax to be fully ready before initial render
function waitForMathJax(attempts = 0) {
  if (window.MathJax && window.MathJax.typesetPromise && window.MathJax.startup && window.MathJax.startup.promise) {
    // Wait for MathJax startup promise to resolve
    window.MathJax.startup.promise.then(() => {
      initialRender();
    });
  } else if (attempts < 100) {
    // Check again in 50ms (max 5 seconds)
    setTimeout(() => waitForMathJax(attempts + 1), 50);
  } else {
    console.warn('MathJax did not load in time, rendering anyway');
    initialRender();
  }
}

waitForMathJax();

// ============================================================================
// SIMULATION INTEGRATION
// ============================================================================

import { Simulation } from './simulation.js';
import { LossChart, NormChart } from './visualization.js';

// Initialize simulation and visualization
const simulation = new Simulation();
const lossChart = new LossChart('lossChart');
const normChart = new NormChart('normChart');

// Default values for f* and c (not exposed in UI yet)
const fStar = 1;
const c = 1;

// Start/Pause button
const startPauseButton = document.getElementById('startPauseButton');
startPauseButton.addEventListener('click', () => {
  if (!simulation.isRunning) {
    // Capture current parameters
    const d = currentD;
    const k = kSlider.sliderToValue(parseFloat(document.getElementById('kSlider').value));
    const gammas = gammaValues.slice(0, d);
    const alphas = alphaValues.slice(0, d);
    const eta = etaSlider.sliderToValue(parseFloat(document.getElementById('etaSlider').value));
    const batchSize = batchSizeSlider.sliderToValue(parseFloat(document.getElementById('batchSizeSlider').value));

    simulation.captureParams(d, k, gammas, alphas, eta, batchSize, fStar, c);
    simulation.start();
    startPauseButton.textContent = 'pause';
  } else {
    simulation.pause();
    startPauseButton.textContent = 'start';
  }
});

// Reset button
const resetButton = document.getElementById('resetButton');
resetButton.addEventListener('click', () => {
  simulation.reset();
  lossChart.clear();
  normChart.clear();
  startPauseButton.textContent = 'start';
});

// Logscale checkbox
const logScaleCheckbox = document.getElementById('logScaleCheckbox');
logScaleCheckbox.checked = appState.logScale;
lossChart.setLogScale(appState.logScale);
normChart.setLogScale(appState.logScale);

logScaleCheckbox.addEventListener('change', () => {
  const useLog = logScaleCheckbox.checked;
  appState.logScale = useLog;
  appState.save();
  lossChart.setLogScale(useLog);
  normChart.setLogScale(useLog);
});

// EMA slider
const emaSlider = new LogarithmicSliderWithOff(1, 1000);
const emaSliderElement = document.getElementById('emaSlider');
const emaValueElement = document.getElementById('emaValue');

// Initialize EMA slider from state and apply to charts
emaSliderElement.value = emaSlider.valueToSlider(appState.emaWindow);
emaValueElement.textContent = appState.emaWindow === 1 ? 'off' : appState.emaWindow;
lossChart.setEmaWindow(appState.emaWindow);
normChart.setEmaWindow(appState.emaWindow);

emaSliderElement.addEventListener('input', () => {
  const emaWindow = emaSlider.sliderToValue(parseFloat(emaSliderElement.value));
  emaValueElement.textContent = emaWindow === 1 ? 'off' : emaWindow;
  appState.emaWindow = emaWindow;
  appState.save();

  // Apply EMA to charts
  lossChart.setEmaWindow(emaWindow);
  normChart.setEmaWindow(emaWindow);

  // Update charts immediately with current data
  updateCharts();
});

// X-axis mode toggle function
window.setXAxisMode = function(mode) {
  const useEffTime = (mode === 'teff');
  const eta = etaSlider.sliderToValue(parseFloat(document.getElementById('etaSlider').value));

  lossChart.setEffectiveTime(useEffTime, eta);
  normChart.setEffectiveTime(useEffTime, eta);

  // Update toggle button states
  document.getElementById('step-link').classList.toggle('active', !useEffTime);
  document.getElementById('teff-link').classList.toggle('active', useEffTime);

  // Update x-axis labels
  const xLabels = document.querySelectorAll('.x-axis-label');
  xLabels.forEach(label => {
    label.innerHTML = useEffTime ? '$t_{\\mathrm{eff}} = \\eta \\cdot \\mathrm{step}$' : 'step';
  });

  // Re-render MathJax for labels if needed
  if (useEffTime && window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise(xLabels).catch(err => console.log(err));
  }

  // Update charts immediately with current data
  updateCharts();

  // Save to state
  appState.xAxisMode = mode;
  appState.save();
};

/**
 * Update both loss and norm charts with current simulation data
 */
function updateCharts() {
  const state = simulation.getState();
  if (state.lossHistory.length > 0) {
    lossChart.update(state.lossHistory);
    normChart.update(state.normHistory, state.d);
  }
}

// Initialize x-axis mode from saved state
setXAxisMode(appState.xAxisMode);

// Set up chart update callback for simulation
simulation.onFrameUpdate = updateCharts;

// Reset to defaults button
const resetToDefaultsButton = document.getElementById('resetToDefaultsButton');
resetToDefaultsButton.addEventListener('click', () => {
  // Reset state
  appState.resetToDefaults();
  appState.save();

  // Update UI from reset state
  currentD = appState.d;
  gammaValues = [...appState.gammaValues];
  alphaValues = [...appState.alphaValues];

  // Reset d slider
  document.getElementById('dSlider').value = appState.d;
  document.getElementById('dValue').textContent = appState.d.toString();

  // Reset k slider
  document.getElementById('kSlider').value = kSlider.valueToSlider(appState.k);
  document.getElementById('kValue').textContent = appState.k.toString();

  // Reset gamma sliders
  renderGammaSliders();

  // Reset alpha sliders
  renderAlphaSliders();

  // Reset eta slider
  document.getElementById('etaSlider').value = etaSlider.valueToSlider(appState.eta);
  document.getElementById('etaValue').innerHTML = formatScientific(appState.eta);

  // Reset batch size slider
  document.getElementById('batchSizeSlider').value = batchSizeSlider.valueToSlider(appState.batchSize);
  document.getElementById('batchSizeValue').innerHTML = formatScientific(appState.batchSize);

  // Reset logscale
  logScaleCheckbox.checked = appState.logScale;
  lossChart.setLogScale(appState.logScale);
  normChart.setLogScale(appState.logScale);

  // Reset x-axis mode
  setXAxisMode(appState.xAxisMode);

  // Update displays
  updateTargetFunctionEquation();
  renderNetworkViz();
});

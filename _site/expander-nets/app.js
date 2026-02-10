// ============================================================================
// EXPANDER NETS - Main Application
// ============================================================================

import { AppState } from './state.js';
import { DisplayManager } from './ui/display.js';
import { ControlsManager } from './ui/controls.js';
import { ChartsManager } from './ui/charts.js';
import { Simulation } from './simulation.js';
import { NETWORK_VIZ } from './config.js';

console.log('Expander Nets loaded');

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize state
const appState = new AppState();
appState.load();

// Initialize managers
const displayManager = new DisplayManager();
const chartsManager = new ChartsManager(appState);

// Initialize controls with callback for param changes
const controlsManager = new ControlsManager(
  appState,
  displayManager,
  () => {
    // Callback when parameters change
    renderNetworkViz();

    // THEORY UPDATE LOGIC:
    // Only recompute theory if we're in "preview mode" (before simulation has any data)
    // Once simulation has run, theory is "locked in" to the captured parameters
    // and should not change when sliders are adjusted
    const simulationHasData = simulation.model !== null &&
                              simulation.lossHistory &&
                              simulation.lossHistory.length > 0;

    if (!simulationHasData && appState.showTheory) {
      // Preview mode: show live theory updates as sliders change
      chartsManager.computeAndShowTheoryOnly();
    }
    // If simulationHasData is true, do NOT recompute theory - it stays locked to captured params
  }
);

// Initialize simulation
const { lossChart, normChart } = chartsManager.getCharts();
const simulation = new Simulation();

// Connect simulation to charts via callback
simulation.onFrameUpdate = () => {
  const state = simulation.getState();
  const eta = simulation.params ? simulation.params.eta : appState.eta;
  lossChart.update(state.lossHistory, state.theoryLossHistory, eta);
  normChart.update(state.normHistory, state.theoryNormHistory, state.d, eta);
};

// ============================================================================
// NETWORK VISUALIZATION
// ============================================================================

function renderNetworkViz() {
  const svg = document.getElementById('networkViz');
  svg.innerHTML = '';

  const params = controlsManager.getCurrentParams();
  const d = params.d;
  const k = params.k;

  // Calculate heights
  const calcHeight = (dim) => NETWORK_VIZ.BASE_HEIGHT * (Math.log2(dim) + 1);
  const heights = [calcHeight(d), calcHeight(d), calcHeight(k), calcHeight(1)];
  const maxHeight = Math.max(...heights);
  const height = maxHeight + 2 * NETWORK_VIZ.PADDING + NETWORK_VIZ.LABEL_SPACE;

  svg.setAttribute('height', height);

  // Horizontal positions
  const spacing = (NETWORK_VIZ.WIDTH - 2 * NETWORK_VIZ.PADDING) / (NETWORK_VIZ.NUM_LAYERS + 1);
  const xPositions = [];
  for (let i = 1; i <= NETWORK_VIZ.NUM_LAYERS; i++) {
    xPositions.push(NETWORK_VIZ.PADDING + spacing * i);
  }

  // Draw trapezoids
  const trapezoidColors = ['#aaaaaa', '#eeeeee', '#aaaaaa'];
  for (let i = 0; i < NETWORK_VIZ.NUM_LAYERS - 1; i++) {
    const x1 = xPositions[i] + NETWORK_VIZ.GAP;
    const x2 = xPositions[i + 1] - NETWORK_VIZ.GAP;
    const h1 = heights[i];
    const h2 = heights[i + 1];
    const centerY = height / 2;

    const points = [
      [x1, centerY - h1/2],
      [x2, centerY - h2/2],
      [x2, centerY + h2/2],
      [x1, centerY + h1/2]
    ];

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    path.setAttribute('points', points.map(p => p.join(',')).join(' '));
    path.setAttribute('fill', trapezoidColors[i]);
    path.setAttribute('opacity', '0.5');
    svg.appendChild(path);
  }

  // Draw lines
  for (let i = 0; i < NETWORK_VIZ.NUM_LAYERS; i++) {
    const x = xPositions[i];
    const h = heights[i];
    const centerY = height / 2;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', centerY - h/2);
    line.setAttribute('x2', x);
    line.setAttribute('y2', centerY + h/2);
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '3');
    svg.appendChild(line);
  }

  // Add labels
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

  // Retypeset MathJax
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise([svg]).catch(err => console.log(err));
  }
}

// ============================================================================
// START/PAUSE BUTTON
// ============================================================================

const startPauseButton = document.getElementById('startPauseButton');
startPauseButton.addEventListener('click', () => {
  if (!simulation.isRunning) {
    const params = controlsManager.getCurrentParams();
    const fStar = 1;  // Target value (currently unused)
    const c = 1;      // Constant (currently unused)
    simulation.captureParams(params.d, params.k, params.gammas, params.alphas, params.eta, params.batchSize, fStar, c);

    // Update EMA initial value based on number of terms
    const initialLoss = 0.5 * params.numTerms;
    chartsManager.lossChart.setInitialLoss(initialLoss);

    simulation.start();
    startPauseButton.textContent = 'pause';
  } else {
    simulation.pause();
    startPauseButton.textContent = 'start';
  }
});

// ============================================================================
// RESET BUTTONS
// ============================================================================

// Reset simulation (not settings)
const resetButton = document.getElementById('resetButton');
resetButton.addEventListener('click', () => {
  simulation.reset();
  lossChart.clear();
  normChart.clear();
  startPauseButton.textContent = 'start';

  // If theory is enabled, show it after reset
  if (appState.showTheory) {
    chartsManager.computeAndShowTheoryOnly();
  }
});

// Reset to defaults
const resetToDefaultsButton = document.getElementById('resetToDefaultsButton');
resetToDefaultsButton.addEventListener('click', () => {
  appState.resetToDefaults();
  appState.save();
  location.reload();
});

// ============================================================================
// INITIAL RENDER
// ============================================================================

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

function initialRender() {
  controlsManager.initialize();
  chartsManager.setupControls(controlsManager, simulation);
  renderNetworkViz();
  controlsManager.updateTargetFunctionEquation();

  // Update x-axis labels based on saved state
  if (appState.xAxisMode === 'teff') {
    document.querySelectorAll('.x-axis-label').forEach(label => {
      label.innerHTML = '$t_{\\mathrm{eff}} = \\eta \\cdot \\mathrm{step}$';
    });
    // Retypeset MathJax for the labels
    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetPromise(document.querySelectorAll('.x-axis-label')).catch((err) => console.log(err));
    }
  }
}

// Start waiting for MathJax
waitForMathJax();

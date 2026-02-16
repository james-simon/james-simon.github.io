// ============================================================================
// LAZY VS. RICH TRAINING DYNAMICS — main app
// ============================================================================

import { LogarithmicSlider } from './utils/sliders.js';
import { formatLatex } from './formatters.js';
import { AppState } from './state.js';
import { Simulation } from './simulation.js';
import { WeightPlot, LossChart } from './charts.js';

// Fixed parameters
const FIXED_K = 3;
const FIXED_N = 200;

const alphaSliderHelper = new LogarithmicSlider(0.01, 100);

// ============================================================================
// STATE & DOM
// ============================================================================

const appState = new AppState();
appState.load();

const alphaSlider        = document.getElementById('alphaSlider');
const alphaValue         = document.getElementById('alphaValue');
const startPauseBtn      = document.getElementById('startPauseBtn');
const resetBtn           = document.getElementById('resetBtn');
const stepsPerSecEl      = document.getElementById('stepsPerSec');
const manualSeedCheckbox = document.getElementById('manualSeedCheckbox');
const seedInputDiv       = document.getElementById('seedInputDiv');
const seedInput          = document.getElementById('seedInput');

// Set slider position from persisted state
alphaSlider.value = alphaSliderHelper.valueToSlider(appState.alpha);

// ============================================================================
// SLIDER DISPLAY UPDATES
// ============================================================================

const regimeLabel = document.getElementById('regimeLabel');

function updateAlpha() {
  appState.alpha = alphaSliderHelper.sliderToValue(parseFloat(alphaSlider.value));
  alphaValue.innerHTML = `$${formatLatex(appState.alpha)}$`;
  MathJax.typesetPromise([alphaValue]).catch(e => console.warn(e));
  appState.save();
  // Update regime label
  const a = appState.alpha;
  if (regimeLabel) {
    regimeLabel.textContent = a > 5 ? '(lazy)' : a < 0.2 ? '(ultra-rich)' : '(rich)';
  }
}

// ============================================================================
// SIMULATION & CHARTS
// ============================================================================

const sim        = new Simulation();
const weightPlot = new WeightPlot('weightPlot');
const lossChart  = new LossChart('lossPlot');

sim.onFrameUpdate = () => {
  weightPlot.update(sim);
  lossChart.update(sim.lossHistory);
  if (stepsPerSecEl) stepsPerSecEl.textContent = Math.round(sim.stepsPerSec).toLocaleString();
};

function getCurrentSeed() {
  if (!manualSeedCheckbox.checked) return null;
  const v = parseInt(seedInput.value, 10);
  return isNaN(v) || v < 0 ? 0 : v;
}

// Pre-sample: initialize weights and show in weight plot without running
function preSample() {
  const wasRunning = sim.running;
  if (wasRunning) { sim.pause(); startPauseBtn.textContent = 'start'; }
  updateAlpha(); // always grab current slider value
  sim.initialize({ k: FIXED_K, n: FIXED_N, alpha: appState.alpha, seed: getCurrentSeed() });
  weightPlot.update(sim);
  lossChart.clear();
}

// Alpha slider — update display only; new alpha is picked up on next start/reset
alphaSlider.addEventListener('input', () => { updateAlpha(); });

// Start / Pause
startPauseBtn.addEventListener('click', () => {
  if (!sim.running) {
    if (!sim.W) preSample(); // initialize if never run
    else {
      // Update alpha in params so any mid-session slider change takes effect
      sim.params.alpha = appState.alpha;
    }
    sim.start();
    startPauseBtn.textContent = 'pause';
  } else {
    sim.pause();
    startPauseBtn.textContent = 'start';
  }
});

// Reset
resetBtn.addEventListener('click', () => {
  sim.pause();
  startPauseBtn.textContent = 'start';
  preSample();
});

// Seed checkbox
manualSeedCheckbox.addEventListener('change', () => {
  seedInputDiv.style.display = manualSeedCheckbox.checked ? 'inline-block' : 'none';
  if (!sim.running) preSample();
});
seedInput.addEventListener('change', () => { if (!sim.running) preSample(); });

// ============================================================================
// INITIAL RENDER — wait for MathJax
// ============================================================================

function initialRender() {
  updateAlpha();
  preSample();
}

function waitForMathJax(attempts = 0) {
  if (window.MathJax && window.MathJax.typesetPromise &&
      window.MathJax.startup && window.MathJax.startup.promise) {
    window.MathJax.startup.promise.then(() => initialRender());
  } else if (attempts < 100) {
    setTimeout(() => waitForMathJax(attempts + 1), 50);
  } else {
    console.warn('MathJax did not load in time');
    initialRender();
  }
}

waitForMathJax();

// ============================================================================
// SHALLOW MLPs — app orchestrator
// ============================================================================

import { AppState } from './state.js';
import { Simulation } from './simulation.js';
import { numCoeffTerms } from './targets.js';
import { LossChart, NormChart, CoeffChart, PreActChart } from './charts.js';
import { HistRow } from './hist-row.js';
import { bindUI, restoreUI, waitForMathJax, renderNetworkViz } from './ui.js';

// ============================================================================
// STATE, SIMULATION & CHARTS
// ============================================================================

const appState = new AppState();
appState.load();

const sim         = new Simulation();
const lossChart   = new LossChart('lossPlot');
const coeffChart  = new CoeffChart('coeffPlot');
const normChart   = new NormChart('normPlot');
const preActChart = new PreActChart('preActPlot');
const histRow     = new HistRow('histRow');

const allCharts = () => [lossChart, coeffChart, normChart, preActChart];

// ============================================================================
// SIMULATION LIFECYCLE
// ============================================================================

function getCurrentSeed() {
  if (!appState.manualSeed) return null;
  const v = parseInt(document.getElementById('seedInput').value, 10);
  return isNaN(v) || v < 0 ? 0 : v;
}

function buildParams() {
  const T = appState.numTerms;
  const d = Math.max(Math.round(appState.d), T);  // ensure d >= T
  return {
    n:          Math.round(appState.n),
    d,
    batchSize:  Math.round(appState.batchSize),
    eta:        appState.eta,
    alpha:      appState.alpha,
    activation: appState.activation,
    numTerms:   T,
    targetType: appState.targetType,
    seed:       getCurrentSeed(),
  };
}

function preSample() {
  const startPauseBtn = document.getElementById('startPauseBtn');
  if (sim.running) { sim.pause(); startPauseBtn.textContent = 'start'; }
  const params = buildParams();
  coeffChart.setNumTerms(numCoeffTerms(params.targetType, params.numTerms), params.targetType);
  normChart.setNumTerms(params.numTerms);
  histRow.rebuild(params.numTerms);
  sim.initialize(params);
  lossChart.clear();
  coeffChart.clear();
  normChart.clear();
  preActChart.clear();
}

sim.onFrameUpdate = () => {
  const eta = sim.params ? sim.params.eta : appState.eta;
  lossChart.update(sim.lossHistory, eta);
  coeffChart.update(sim.coeffHistory, eta);
  normChart.update(sim.normHistory, eta);
  preActChart.update(sim.normHistory, eta);
  if (sim.W && sim.a && sim.params) histRow.update(sim.W, sim.a, sim.params.n, sim.params.d);
  const el = document.getElementById('stepsPerSec');
  if (el) el.textContent = Math.round(sim.stepsPerSec).toLocaleString();
};

// ============================================================================
// UI BINDINGS
// ============================================================================

bindUI(appState, {
  onParamChange() {
    if (sim.iteration > 0 || sim.W !== null) preSample();
  },
  onTargetChange() {
    if (sim.iteration > 0 || sim.W !== null) preSample();
  },
  onSimControl: {
    startPause() {
      const btn = document.getElementById('startPauseBtn');
      if (!sim.running) {
        if (sim.iteration === 0) preSample();
        sim.start();
        btn.textContent = 'pause';
      } else {
        sim.pause();
        btn.textContent = 'start';
      }
    },
    reset() {
      sim.pause();
      document.getElementById('startPauseBtn').textContent = 'start';
      preSample();
    },
  },
  onAxisChange: {
    logX(v) { allCharts().forEach(c => c.setLogScaleX(v)); },
    logY(v) { allCharts().forEach(c => c.setLogScaleY(v)); },
  },
  onEmaChange(w) {
    lossChart.setEmaWindow(w);
    coeffChart.setEmaWindow(w);
    if (sim.lossHistory.length > 0) {
      const eta = sim.params ? sim.params.eta : appState.eta;
      lossChart.update(sim.lossHistory, eta);
      coeffChart.update(sim.coeffHistory, eta);
    }
  },
});

// x-axis step/teff toggle (called from inline onclick in HTML)
let useEffTime = false;
function setXAxisMode(mode) {
  useEffTime = (mode === 'teff');
  const eta = appState.eta;
  allCharts().forEach(c => c.setEffectiveTime(useEffTime, eta));
  document.getElementById('teff-link').classList.toggle('active', useEffTime);
  document.getElementById('step-link').classList.toggle('active', !useEffTime);
  if (sim.lossHistory.length > 0) {
    lossChart.update(sim.lossHistory, eta);
    coeffChart.update(sim.coeffHistory, eta);
    normChart.update(sim.normHistory, eta);
    preActChart.update(sim.normHistory, eta);
  }
  return false;
}
window.setXAxisMode = setXAxisMode;

// ============================================================================
// STARTUP
// ============================================================================

waitForMathJax(() => {
  restoreUI(appState);
  renderNetworkViz(appState);
  preSample();
});

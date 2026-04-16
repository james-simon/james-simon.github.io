// Hopfield Nets — app.js

// ── Slider helpers ────────────────────────────────────────────────────────────

const SLIDERS = {
  d:        { min: 10,   max: 10000, mode: 'log', decimals: 0,   default: 100  },
  alpha:    { min: 0.01, max: 0.50,  mode: 'lin', decimals: 3,   default: 0.10 },
  p:        { min: 0.00, max: 0.50,  mode: 'lin', decimals: 2,   default: 0.20 },
  T:        { min: 5,    max: 200,   mode: 'log', decimals: 0,   default: 30   },
  K:        { min: 10,   max: 500,   mode: 'log', decimals: 0,   default: 100  },
  convSteps:{ min: 2,    max: 30,    mode: 'lin', decimals: 0,   default: 10   },
};

// Alpha range slider shares the same lin mapping as alpha.
const ALPHA_CFG = SLIDERS.alpha;

function sliderToValue(key, raw) {
  const t = raw / 100;
  const { min, max, mode, decimals } = SLIDERS[key];
  if (mode === 'log') return Math.round(min * Math.pow(max / min, t));
  return parseFloat((min + (max - min) * t).toFixed(decimals));
}

function valueToSlider(key, val) {
  const { min, max, mode } = SLIDERS[key];
  if (mode === 'log') return Math.round(Math.log(val / min) / Math.log(max / min) * 100);
  return Math.round((val - min) / (max - min) * 100);
}

// Raw [0,100] → alpha value using ALPHA_CFG.
function rawToAlpha(raw) {
  const t = raw / 100;
  return parseFloat((ALPHA_CFG.min + (ALPHA_CFG.max - ALPHA_CFG.min) * t).toFixed(ALPHA_CFG.decimals));
}

const STORAGE_KEY = 'hopfield-nets-state';

const state = {};  // holds d, alpha, p, T, K, convSteps
const sweepState = { alphaMin: 0.01, alphaMax: 0.30 };

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, ...sweepState }));
  } catch (e) {}
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    // Restore slider state values (validated against slider bounds on init).
    for (const key of Object.keys(SLIDERS)) {
      if (saved[key] !== undefined) state[key] = saved[key];
    }
    if (saved.alphaMin !== undefined) sweepState.alphaMin = saved.alphaMin;
    if (saved.alphaMax !== undefined) sweepState.alphaMax = saved.alphaMax;
  } catch (e) {}
}

function initSliders() {
  for (const key of Object.keys(SLIDERS)) {
    const slider  = document.getElementById(`slider_${key}`);
    const display = document.getElementById(`value_${key}`);
    if (!slider) continue;

    // Use saved value if present, otherwise default.
    const initVal = state[key] !== undefined ? state[key] : SLIDERS[key].default;
    slider.value = valueToSlider(key, initVal);

    const sync = () => {
      state[key] = sliderToValue(key, slider.value);
      display.textContent = state[key];
      updateDerivedDisplays();
      saveState();
    };
    slider.addEventListener('input', sync);
    sync();
  }
}

function updateDerivedDisplays() {
  const N = Math.max(1, Math.round((state.alpha ?? 0.10) * state.d));
  document.getElementById('value_N').textContent = N;
}

// ── Dual-handle alpha range slider ────────────────────────────────────────────

function alphaToRaw(a) {
  return Math.round((a - ALPHA_CFG.min) / (ALPHA_CFG.max - ALPHA_CFG.min) * 100);
}

function initDualRangeSlider() {
  const minSlider  = document.getElementById('slider_alphaMin');
  const maxSlider  = document.getElementById('slider_alphaMax');
  const minDisplay = document.getElementById('value_alphaMin');
  const maxDisplay = document.getElementById('value_alphaMax');
  const fill       = document.getElementById('sweepRangeFill');

  // Restore saved range positions.
  minSlider.value = alphaToRaw(sweepState.alphaMin);
  maxSlider.value = alphaToRaw(sweepState.alphaMax);

  function syncFill() {
    const lo = parseInt(minSlider.value);
    const hi = parseInt(maxSlider.value);
    fill.style.left  = lo + '%';
    fill.style.width = (hi - lo) + '%';
  }

  function sync() {
    let lo = parseInt(minSlider.value);
    let hi = parseInt(maxSlider.value);
    if (lo >= hi) {
      if (document.activeElement === minSlider) lo = hi - 2;
      else                                       hi = lo + 2;
      lo = Math.max(0, lo);
      hi = Math.min(100, hi);
      minSlider.value = lo;
      maxSlider.value = hi;
    }
    sweepState.alphaMin = rawToAlpha(lo);
    sweepState.alphaMax = rawToAlpha(hi);
    minDisplay.textContent = sweepState.alphaMin.toFixed(2);
    maxDisplay.textContent = sweepState.alphaMax.toFixed(2);
    syncFill();
    saveState();
  }

  minSlider.addEventListener('input', sync);
  maxSlider.addEventListener('input', sync);
  sync();
}

// ── Simulation ────────────────────────────────────────────────────────────────

// Convergence threshold — read from state.convSteps at runtime.

function generatePatterns(d, N) {
  const patterns = [];
  for (let mu = 0; mu < N; mu++) {
    const xi = new Int8Array(d);
    for (let i = 0; i < d; i++) xi[i] = Math.random() < 0.5 ? 1 : -1;
    patterns.push(xi);
  }
  return patterns;
}

function maskPattern(xi, p) {
  const d = xi.length;
  const s = new Float32Array(xi);
  const numMask = Math.round(p * d);
  const idx = Array.from({ length: d }, (_, i) => i);
  for (let k = 0; k < numMask; k++) {
    const j = k + Math.floor(Math.random() * (d - k));
    [idx[k], idx[j]] = [idx[j], idx[k]];
    s[idx[k]] = 0;
  }
  return s;
}

function computeOverlaps(patterns, s) {
  const d = s.length;
  const overlaps = new Float32Array(patterns.length);
  for (let mu = 0; mu < patterns.length; mu++) {
    const xi = patterns[mu];
    let dot = 0;
    for (let i = 0; i < d; i++) dot += xi[i] * s[i];
    overlaps[mu] = dot / d;
  }
  return overlaps;
}

function computeFields(patterns, overlaps) {
  const d = patterns[0].length;
  const h = new Float32Array(d);
  for (let mu = 0; mu < patterns.length; mu++) {
    const m = overlaps[mu];
    const xi = patterns[mu];
    for (let i = 0; i < d; i++) h[i] += m * xi[i];
  }
  return h;
}

// Compute field at a single neuron i given current overlaps.
// Subtracts the self-coupling term (W_ii = 0, Hopfield 1982).
function fieldAt(i, patterns, overlaps, s_i) {
  let h = 0;
  for (let mu = 0; mu < patterns.length; mu++) {
    h += overlaps[mu] * patterns[mu][i];
  }
  // Subtract self-coupling: W_ii = (1/d) * N = alpha, times s_i
  h -= (patterns.length / patterns[0].length) * s_i;
  return h;
}

// Update overlaps in-place when neuron i flips from old_si to new_si.
function updateOverlaps(i, old_si, new_si, patterns, overlaps) {
  const delta = (new_si - old_si) / patterns[0].length;  // delta/d
  for (let mu = 0; mu < patterns.length; mu++) {
    overlaps[mu] += delta * patterns[mu][i];
  }
}

function matchesPattern(s, xi) {
  let pos = true, neg = true;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !==  xi[i]) pos = false;
    if (s[i] !== -xi[i]) neg = false;
    if (!pos && !neg) return false;
  }
  return true;
}

function magnetization(s, xi1) {
  let dot = 0;
  for (let i = 0; i < s.length; i++) dot += xi1[i] * s[i];
  return dot / s.length;
}

// Returns { outcome, trajectory }.
// Uses true sequential async updates with incremental overlap maintenance.
// Each "step" visits r*d neurons in random order, updating each one with
// the current (live) field before moving to the next.
function runTrial(patterns, p, T) {
  const d = patterns[0].length;
  const N = patterns.length;
  const xi1 = patterns[0];
  const s = maskPattern(xi1, p);

  const convergeSteps = state.convSteps ?? 10;
  const numUpdate = d;  // one step = one full sweep of all d neurons

  // Maintain overlaps incrementally throughout the trial.
  const overlaps = computeOverlaps(patterns, s);

  const trajBuf = new Float32Array(T + 1);
  trajBuf[0] = magnetization(s, xi1);

  // Reusable index array for partial Fisher-Yates each step.
  const idx = Array.from({ length: d }, (_, i) => i);

  let unchangedRuns = 0, stepsRun = 0;

  for (let t = 0; t < T; t++) {
    // Shuffle first numUpdate positions.
    for (let k = 0; k < numUpdate; k++) {
      const j = k + Math.floor(Math.random() * (d - k));
      const tmp = idx[k]; idx[k] = idx[j]; idx[j] = tmp;
    }

    let anyChanged = false;
    for (let k = 0; k < numUpdate; k++) {
      const i = idx[k];
      // Compute field at i from live overlaps, subtracting self-coupling.
      const h_i = fieldAt(i, patterns, overlaps, s[i]);
      // h=0: keep current state (no bias).
      const newVal = h_i > 0 ? 1 : h_i < 0 ? -1 : s[i];
      if (newVal !== s[i]) {
        updateOverlaps(i, s[i], newVal, patterns, overlaps);
        s[i] = newVal;
        anyChanged = true;
      }
    }

    stepsRun = t + 1;
    trajBuf[stepsRun] = magnetization(s, xi1);

    unchangedRuns = anyChanged ? 0 : unchangedRuns + 1;
    if (unchangedRuns >= convergeSteps) break;
  }

  const trajectory = trajBuf.slice(0, stepsRun + 1);
  const converged = unchangedRuns >= convergeSteps;

  if (!converged) return { outcome: 'no-convergence', trajectory };
  for (let mu = 0; mu < N; mu++) {
    if (matchesPattern(s, patterns[mu])) return { outcome: 'recovery', trajectory };
  }
  return { outcome: 'spurious', trajectory };
}

// Runs K trials at a single (d, N, p, T) and returns outcome fractions + all trajectories.
function runTrials(d, N, p, T, K) {
  let recovery = 0, spurious = 0, noConv = 0;
  const trajectories = [];

  for (let k = 0; k < K; k++) {
    const patterns = generatePatterns(d, N);
    const { outcome, trajectory } = runTrial(patterns, p, T);
    trajectories.push({ outcome, trajectory });
    if      (outcome === 'recovery')       recovery++;
    else if (outcome === 'spurious')       spurious++;
    else                                   noConv++;
  }

  return {
    fractions: { recovery: recovery / K, spurious: spurious / K, noConv: noConv / K },
    trajectories,
  };
}

// ── Sweep chart ───────────────────────────────────────────────────────────────

const N_SWEEP_PTS = 40;

let sweepChart = null;

function initSweepChart() {
  const ctx = document.getElementById('sweepPlot').getContext('2d');
  sweepChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'recovery',
          data: [],
          backgroundColor: 'rgba(40,160,40,0.75)',
          stack: 'outcomes',
        },
        {
          label: 'spurious',
          data: [],
          backgroundColor: 'rgba(200,60,40,0.75)',
          stack: 'outcomes',
        },
        {
          label: 'no convergence',
          data: [],
          backgroundColor: 'rgba(180,180,180,0.75)',
          stack: 'outcomes',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(1)}%`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: 'α = N/d' },
          ticks: { maxTicksLimit: 10, callback: (_, i, ticks) => {
            // Show only a subset of labels so they don't overlap.
            if (sweepChart.data.labels.length === 0) return '';
            const v = sweepChart.data.labels[i];
            return v !== undefined ? v.toFixed(2) : '';
          }},
        },
        y: {
          stacked: true,
          min: 0, max: 1,
          title: { display: true, text: 'fraction of trials' },
          ticks: { callback: v => (v * 100).toFixed(0) + '%' },
        },
      },
    },
  });
}

// Pre-populate the chart with N_SWEEP_PTS empty bars so the x-axis is fixed from the start.
function initSweepChartData(alphaMin, alphaMax) {
  const labels = [];
  for (let i = 0; i < N_SWEEP_PTS; i++) {
    const a = alphaMin + (alphaMax - alphaMin) * i / (N_SWEEP_PTS - 1);
    labels.push(parseFloat(a.toFixed(3)));
  }
  sweepChart.data.labels = labels;
  sweepChart.data.datasets[0].data = new Array(N_SWEEP_PTS).fill(null);
  sweepChart.data.datasets[1].data = new Array(N_SWEEP_PTS).fill(null);
  sweepChart.data.datasets[2].data = new Array(N_SWEEP_PTS).fill(null);
  sweepChart.update();
}

function setSweepBar(idx, fractions) {
  sweepChart.data.datasets[0].data[idx] = fractions.recovery;
  sweepChart.data.datasets[1].data[idx] = fractions.spurious;
  sweepChart.data.datasets[2].data[idx] = fractions.noConv;
  sweepChart.update('none');  // skip animation
}

// ── Sweep runner (incremental, yields between points) ─────────────────────────

let sweepCancelToken = null;  // set to an object; if the ref changes, the running sweep stops

function runSweep() {
  const token = {};
  sweepCancelToken = token;

  const { alphaMin, alphaMax } = sweepState;
  const { d, p, T, K } = state;

  initSweepChartData(alphaMin, alphaMax);
  setSweepStatus(`running… 0 / ${N_SWEEP_PTS}`);
  document.getElementById('sweepRunBtn').disabled = true;
  document.getElementById('sweepStopBtn').disabled = false;

  let idx = 0;

  function nextPoint() {
    if (token !== sweepCancelToken) return;  // cancelled
    if (idx >= N_SWEEP_PTS) {
      setSweepStatus(`done`);
      document.getElementById('sweepRunBtn').disabled = false;
      document.getElementById('sweepStopBtn').disabled = true;
      return;
    }

    const alpha = alphaMin + (alphaMax - alphaMin) * idx / (N_SWEEP_PTS - 1);
    const N = Math.max(1, Math.round(alpha * d));
    const { fractions } = runTrials(d, N, p, T, K);
    setSweepBar(idx, fractions);
    setSweepStatus(`running… ${idx + 1} / ${N_SWEEP_PTS}`);
    idx++;

    setTimeout(nextPoint, 0);  // yield to browser between points
  }

  setTimeout(nextPoint, 0);
}

function stopSweep() {
  sweepCancelToken = null;
  setSweepStatus('stopped');
  document.getElementById('sweepRunBtn').disabled = false;
  document.getElementById('sweepStopBtn').disabled = true;
}

function setSweepStatus(msg) {
  document.getElementById('sweepStatusText').textContent = msg;
}

// ── Single-point section ──────────────────────────────────────────────────────

const OUTCOME_COLOR = {
  'recovery':       'rgba(40, 160, 40, 0.35)',
  'spurious':       'rgba(200, 60, 40, 0.35)',
  'no-convergence': 'rgba(160, 160, 160, 0.30)',
};

let trajChart = null;

function initTrajChart() {
  const ctx = document.getElementById('trajPlot').getContext('2d');
  trajChart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'step t  (1 step = d sequential updates)' },
          ticks: { maxTicksLimit: 10 },
        },
        y: {
          min: -1, max: 1,
          title: { display: true, text: 'm¹(t)' },
          ticks: { callback: v => v.toFixed(1), maxTicksLimit: 7 },
        },
      },
    },
  });
}

function showSingleResults({ recovery, spurious, noConv }) {
  const pct = f => (f * 100).toFixed(1) + '%';
  document.getElementById('result-recovery').textContent = pct(recovery);
  document.getElementById('result-spurious').textContent = pct(spurious);
  document.getElementById('result-noconv').textContent   = pct(noConv);
  document.getElementById('resultsTable').style.display = '';
}

function renderTrajectories(trajectories) {
  const datasets = trajectories.map(({ outcome, trajectory }) => ({
    data: Array.from(trajectory, (y, x) => ({ x, y })),
    borderColor: OUTCOME_COLOR[outcome],
    borderWidth: 1.2,
    pointRadius: 0,
    tension: 0,
  }));
  trajChart.data.datasets = datasets;
  trajChart.options.scales.y.min = Math.max(-1, 1 - state.p * 1.2);
  trajChart.update();
  document.getElementById('trajPlotWrap').style.display = '';
}

function clearSingleResults() {
  document.getElementById('resultsTable').style.display = 'none';
  document.getElementById('trajPlotWrap').style.display = 'none';
}

function setSingleStatus(msg) {
  document.getElementById('statusText').textContent = msg;
}

function doSingleRun() {
  setSingleStatus('running…');
  clearSingleResults();
  setTimeout(() => {
    const { d, alpha, p, T, K } = state;
    const N = Math.max(1, Math.round(alpha * d));
    const t0 = performance.now();
    const { fractions, trajectories } = runTrials(d, N, p, T, K);
    const dt = ((performance.now() - t0) / 1000).toFixed(2);
    showSingleResults(fractions);
    renderTrajectories(trajectories);
    setSingleStatus(`done (${dt}s)`);
  }, 0);
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initSliders();
  initDualRangeSlider();
  initSweepChart();
  initTrajChart();
  clearSingleResults();

  document.getElementById('sweepRunBtn').addEventListener('click', runSweep);
  document.getElementById('sweepStopBtn').addEventListener('click', stopSweep);

  document.getElementById('runBtn').addEventListener('click', doSingleRun);
  document.getElementById('resetBtn').addEventListener('click', () => {
    clearSingleResults();
    setSingleStatus('idle');
  });

  document.getElementById('autorunCheckbox').addEventListener('change', e => {
    if (e.target.checked) doSingleRun();
  });
});

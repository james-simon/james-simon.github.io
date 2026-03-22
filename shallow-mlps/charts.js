// ============================================================================
// CHARTS — loss, coefficients, norms, pre-activations
// ============================================================================

import { SmoothingCache } from './incremental-cache.js';
import { targetCoeffLabel } from './targets.js';

const TEAL_SOLID = 'rgb(40, 130, 130)';
const TEAL_PALE  = 'rgba(40, 130, 130, 0.25)';
const W_COLOR    = 'rgb(70, 120, 210)';    // blue — W as a whole
const A_COLOR    = 'rgb(200, 80, 60)';     // red  — a as a whole
const REM_COLOR  = 'rgb(160, 160, 160)';   // grey — remainder / rest
const MAX_PTS    = 1000;
const MONO       = 'Monaco, Consolas, "Courier New", monospace';

// Per-term colors (for coeff chart and per-direction W norms)
const TERM_COLORS = [
  'rgb(220, 100,  50)',
  'rgb( 50, 160,  80)',
  'rgb( 80, 110, 210)',
  'rgb(180,  60, 180)',
  'rgb(200, 160,  30)',
];

// Lighter versions of W_COLOR for per-direction norms
const WDIR_COLORS = [
  'rgba( 70, 120, 210, 0.9)',
  'rgba( 70, 120, 210, 0.65)',
  'rgba( 70, 120, 210, 0.45)',
  'rgba( 70, 120, 210, 0.30)',
  'rgba( 70, 120, 210, 0.20)',
];

// Unicode subscript digits
const SUB = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
function sub(n) { return String(n).split('').map(c => SUB[+c]).join(''); }


// X-axis: fixed decimal places based on tick spacing to prevent label-width jitter
function makeXTickCallback() {
  return function(value, index, ticks) {
    if (ticks.length < 2) return String(Math.round(value));
    const span = ticks[ticks.length - 1].value - ticks[0].value;
    const step = span / (ticks.length - 1);
    if (step <= 0) return String(value);
    const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
    return value.toFixed(decimals);
  };
}

// Y-axis: suppress non-round ticks at top/bottom extremes
function makeYTickCallback() {
  return function(value, index, ticks) {
    if (ticks.length < 2) return formatY(value);
    const step = ticks[1].value - ticks[0].value;
    if (step <= 0) return formatY(value);
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(step))));
    const isRound = Math.abs(Math.round(value / mag) * mag - value) < mag * 1e-6;
    if (!isRound && (index === 0 || index === ticks.length - 1)) return null;
    return formatY(value);
  };
}

function formatY(value) {
  return String(parseFloat(value.toPrecision(4)));
}

function downsample(arr) {
  if (arr.length <= MAX_PTS) return arr;
  const stride = Math.ceil(arr.length / MAX_PTS);
  const out = arr.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

function baseChartOptions(yTitle) {
  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    layout: { padding: { left: 10, right: 20 } },
    scales: {
      x: {
        type: 'linear', min: 0, max: 1000,
        title: { display: true, text: 'step', font: { size: 14, family: MONO } },
        ticks: { maxRotation: 0, font: { size: 12, family: MONO }, callback: makeXTickCallback() },
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
      y: {
        type: 'linear', min: 0,
        title: { display: true, text: yTitle, font: { size: 14, family: MONO } },
        ticks: { font: { size: 12, family: MONO }, callback: makeYTickCallback() },
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
    },
  };
}

function legendOptions() {
  return {
    display: true,
    position: 'top',
    align: 'end',
    labels: { usePointStyle: false, boxWidth: 24, boxHeight: 2, font: { size: 11, family: MONO } },
  };
}

function dataset(label, color, extra = {}) {
  return { label, data: [], borderColor: color, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0, ...extra };
}

// ---- Base class ------------------------------------------------------------
class BaseChart {
  constructor() {
    this.logScaleX = false;
    this.logScaleY = false;
    this.useEffectiveTime = false;
    this.eta = 0.01;
    this.chart = null;
  }

  setLogScaleX(on) {
    this.logScaleX = on;
    this.chart.options.scales.x.type = on ? 'logarithmic' : 'linear';
    this.chart.options.scales.x.min  = on ? 1 : 0;
    this.chart.update('none');
  }

  setLogScaleY(on) {
    this.logScaleY = on;
    this.chart.options.scales.y.type = on ? 'logarithmic' : 'linear';
    this.chart.options.scales.y.min  = on ? undefined : 0;
    this.chart.options.scales.y.max  = undefined;
    this.chart.update('none');
  }

  setEffectiveTime(on, eta) {
    this.useEffectiveTime = on;
    if (eta !== undefined) this.eta = eta;
    this.chart.options.scales.x.title.text = on ? 't_eff' : 'step';
    this.chart.options.scales.x.min = (on && this.logScaleX) ? this.eta : (this.logScaleX ? 1 : 0);
    this.chart.update('none');
  }

  _toX(step) { return this.useEffectiveTime ? step * this.eta : step; }
  _setXMax(lastStep) {
    this.chart.options.scales.x.max = Math.max(this._toX(1000), this._toX(lastStep));
  }
}

// ---- Loss chart ------------------------------------------------------------
export class LossChart extends BaseChart {
  constructor(canvasId) {
    super();
    this.emaWindow = 1;
    this._cache = new SmoothingCache(1, MAX_PTS);

    const ctx = document.getElementById(canvasId).getContext('2d');
    const opts = baseChartOptions('loss');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { datasets: [
        dataset('raw', TEAL_PALE,  { borderWidth: 1.5, backgroundColor: 'transparent' }),
        dataset('ema', TEAL_SOLID, { backgroundColor: 'rgba(40,130,130,0.08)' }),
      ]},
      options: opts,
    });
  }

  setEmaWindow(w) { this.emaWindow = w; this._cache.setWindow(w); }

  update(lossHistory, eta) {
    if (!lossHistory || lossHistory.length === 0) return;
    if (eta !== undefined) this.eta = eta;

    const { downsampledRaw, downsampledSmoothed } = this._cache.compute(lossHistory);
    const useEma = this.emaWindow > 1;
    const rawPts = downsampledRaw.map(p => ({ x: this._toX(p.x), y: p.y }));
    const emaPts = downsampledSmoothed.map(p => ({ x: this._toX(p.x), y: p.y }));

    this._setXMax(lossHistory[lossHistory.length - 1].x);
    this.chart.data.datasets[0].data        = rawPts;
    this.chart.data.datasets[0].borderColor = useEma ? TEAL_PALE : TEAL_SOLID;
    this.chart.data.datasets[0].borderWidth = useEma ? 1 : 2;
    this.chart.data.datasets[1].data        = useEma ? emaPts : [];

    const yPts = useEma && emaPts.length > 0 ? emaPts : rawPts;
    if (yPts.length > 0) {
      const maxY = Math.max(...yPts.map(p => p.y));
      if (this.logScaleY) {
        const minY = Math.min(...yPts.filter(p => p.y > 0).map(p => p.y));
        this.chart.options.scales.y.max = maxY * 2;
        this.chart.options.scales.y.min = minY / 2;
      } else {
        this.chart.options.scales.y.max = maxY * 1.5;
        this.chart.options.scales.y.min = 0;
      }
    }
    this.chart.update('none');
  }

  clear() {
    this.chart.data.datasets[0].data = [];
    this.chart.data.datasets[1].data = [];
    this.chart.options.scales.x.min = this.logScaleX ? 1 : 0;
    this.chart.options.scales.x.max = this._toX(1000);
    this.chart.options.scales.y.min = this.logScaleY ? undefined : 0;
    this.chart.options.scales.y.max = undefined;
    this.chart.update('none');
  }
}

// ---- Coefficient chart -----------------------------------------------------
export class CoeffChart extends BaseChart {
  constructor(canvasId) {
    super();
    this.emaWindow = 1;
    this._numTerms = 0;
    this._caches = [];

    const ctx = document.getElementById(canvasId).getContext('2d');
    const opts = baseChartOptions('coeff');
    opts.plugins.legend = legendOptions();
    this.chart = new Chart(ctx, { type: 'line', data: { datasets: [] }, options: opts });
  }

  setNumTerms(T, targetType = 'staircase') {
    if (T === this._numTerms && targetType === this._targetType) return;
    this._numTerms = T;
    this._targetType = targetType;
    this._caches = Array.from({ length: T + 1 }, () => new SmoothingCache(this.emaWindow, MAX_PTS));
    const datasets = [];
    for (let k = 1; k <= T; k++) {
      datasets.push(dataset(targetCoeffLabel(targetType, k), TERM_COLORS[(k-1) % TERM_COLORS.length]));
    }
    datasets.push(dataset('rem', REM_COLOR, { borderDash: [4, 3] }));
    this.chart.data.datasets = datasets;
    this.chart.update('none');
  }

  setEmaWindow(w) {
    this.emaWindow = w;
    for (const cache of this._caches) cache.setWindow(w);
  }

  update(coeffHistory, eta) {
    if (!coeffHistory || coeffHistory.length === 0) return;
    if (eta !== undefined) this.eta = eta;
    const T = this._numTerms;
    if (T === 0) return;
    const useEma = this.emaWindow > 1;
    this._setXMax(coeffHistory[coeffHistory.length - 1].x);

    for (let k = 0; k < T; k++) {
      const raw = coeffHistory.map(p => ({ x: p.x, y: p.c[k] }));
      const { downsampledRaw, downsampledSmoothed } = this._caches[k].compute(raw);
      this.chart.data.datasets[k].data = (useEma ? downsampledSmoothed : downsampledRaw).map(p => ({ x: this._toX(p.x), y: p.y }));
    }
    const remRaw = coeffHistory.map(p => ({ x: p.x, y: p.rem }));
    const { downsampledRaw: rR, downsampledSmoothed: rS } = this._caches[T].compute(remRaw);
    this.chart.data.datasets[T].data = (useEma ? rS : rR).map(p => ({ x: this._toX(p.x), y: p.y }));
    this.chart.update('none');
  }

  clear() {
    for (const ds of this.chart.data.datasets) ds.data = [];
    this._caches = Array.from({ length: this._numTerms + 1 }, () => new SmoothingCache(this.emaWindow, MAX_PTS));
    this.chart.options.scales.x.min = this.logScaleX ? 1 : 0;
    this.chart.options.scales.x.max = this._toX(1000);
    this.chart.update('none');
  }
}

// ---- Combined norm chart ---------------------------------------------------
// Datasets: ‖W‖F (blue solid), ‖a‖ (red solid),
//           W₁, W₂, ... (lighter blues, dashed), Wrest (grey dashed)
export class NormChart extends BaseChart {
  constructor(canvasId) {
    super();
    this._numTerms = 0;

    const ctx = document.getElementById(canvasId).getContext('2d');
    const opts = baseChartOptions('norm');
    opts.plugins.legend = legendOptions();
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { datasets: [
        dataset('‖W‖', W_COLOR, { borderWidth: 2.5 }),
        dataset('‖a‖', A_COLOR, { borderWidth: 2.5 }),
      ]},
      options: opts,
    });
  }

  setNumTerms(T) {
    if (T === this._numTerms) return;
    this._numTerms = T;
    const datasets = [
      dataset('‖W‖',      W_COLOR, { borderWidth: 2.5 }),
      dataset('‖a‖',      A_COLOR, { borderWidth: 2.5 }),
    ];
    for (let k = 1; k <= T; k++) {
      datasets.push(dataset(`‖W${sub(k)}‖`, WDIR_COLORS[(k-1) % WDIR_COLORS.length], { borderWidth: 1.5, borderDash: [5, 3] }));
    }
    datasets.push(dataset('‖W_rest‖', REM_COLOR, { borderWidth: 1.5, borderDash: [5, 3] }));
    this.chart.data.datasets = datasets;
    this.chart.update('none');
  }

  update(normHistory, eta) {
    if (!normHistory || normHistory.length === 0) return;
    if (eta !== undefined) this.eta = eta;
    const T = this._numTerms;
    const data = downsample(normHistory);
    this._setXMax(normHistory[normHistory.length - 1].x);

    this.chart.data.datasets[0].data = data.map(p => ({ x: this._toX(p.x), y: p.w1 }));
    this.chart.data.datasets[1].data = data.map(p => ({ x: this._toX(p.x), y: p.w2 }));
    for (let k = 0; k < T + 1; k++) {
      if (this.chart.data.datasets[2 + k]) {
        this.chart.data.datasets[2 + k].data = data.map(p => ({ x: this._toX(p.x), y: p.wDir ? p.wDir[k] : 0 }));
      }
    }
    this.chart.update('none');
  }

  clear() {
    for (const ds of this.chart.data.datasets) ds.data = [];
    this.chart.options.scales.x.min = this.logScaleX ? 1 : 0;
    this.chart.options.scales.x.max = this._toX(1000);
    if (!this.logScaleY) this.chart.options.scales.y.min = 0;
    this.chart.update('none');
  }
}

// ---- RMS pre-activation chart ----------------------------------------------
export class PreActChart extends BaseChart {
  constructor(canvasId) {
    super();
    const ctx = document.getElementById(canvasId).getContext('2d');
    const opts = baseChartOptions('RMS h');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { datasets: [ dataset('RMS h', 'rgb(0,0,0)') ] },
      options: opts,
    });
  }

  update(normHistory, eta) {
    if (!normHistory || normHistory.length === 0) return;
    if (eta !== undefined) this.eta = eta;
    const data = downsample(normHistory);
    this._setXMax(normHistory[normHistory.length - 1].x);
    this.chart.data.datasets[0].data = data.map(p => ({ x: this._toX(p.x), y: p.hRms || 0 }));
    this.chart.update('none');
  }

  clear() {
    this.chart.data.datasets[0].data = [];
    this.chart.options.scales.x.min = this.logScaleX ? 1 : 0;
    this.chart.options.scales.x.max = this._toX(1000);
    if (!this.logScaleY) this.chart.options.scales.y.min = 0;
    this.chart.update('none');
  }
}

// ---- Weight histogram chart ------------------------------------------------
// Shows histogram of W[:,k] — the k-th column of W (one entry per neuron).
const N_BINS = 40;

// Pick a "nice" step size from the set {1,2,5} × 10^k targeting ~5 ticks
function niceStep(span, targetTicks = 5) {
  const raw = span / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f   = raw / mag;
  const nice = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nice * mag;
}

export class WeightHistChart {
  constructor(canvasId, dirIndex) {
    this.dirIndex = dirIndex;
    this._L = null;  // current half-range (for slow relaxation)
    const ctx = document.getElementById(canvasId).getContext('2d');
    const color = TERM_COLORS[dirIndex % TERM_COLORS.length];
    const colorFill = color.replace('rgb(', 'rgba(').replace(')', ', 0.7)');

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: { datasets: [{ data: [], backgroundColor: colorFill, borderColor: color, borderWidth: 1, borderRadius: 0 }] },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          title: {
            display: true,
            text: `W[:,${dirIndex + 1}]`,
            font: { size: 12, family: MONO },
            color: '#666',
            padding: { top: 4, bottom: 2 },
          },
        },
        layout: { padding: { left: 4, right: 4 } },
        scales: {
          x: {
            type: 'linear',
            ticks: { maxRotation: 0, font: { size: 10, family: MONO },
              callback(v) {
                if (Math.abs(v - this.min) < 1e-9 || Math.abs(v - this.max) < 1e-9) return null;
                return parseFloat(v.toPrecision(6));
              },
            },
            grid: { color: 'rgba(0,0,0,0.12)' },
          },
          y: {
            type: 'linear', min: 0,
            ticks: { maxTicksLimit: 4, font: { size: 10, family: MONO } },
            grid: { color: 'rgba(0,0,0,0.07)' },
          },
        },
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      },
    });
  }

  update(W, n, d) {
    if (!W) return;
    const k = this.dirIndex;
    if (k >= d) return;

    const vals = new Float64Array(n);
    for (let i = 0; i < n; i++) vals[i] = W[i * d + k];

    // Compute symmetric half-range with slow relaxation
    let maxAbs = 0;
    for (let i = 0; i < n; i++) { const a = Math.abs(vals[i]); if (a > maxAbs) maxAbs = a; }
    const rawL = maxAbs * 1.05;
    this._L = this._L === null ? rawL : Math.max(rawL, 0.9 * this._L);
    const L = this._L;

    const binW = (2 * L) / N_BINS;
    const counts = new Int32Array(N_BINS);
    for (let i = 0; i < n; i++) {
      const b = Math.floor((vals[i] + L) / binW);
      counts[Math.max(0, Math.min(N_BINS - 1, b))]++;
    }

    const step = niceStep(2 * L);
    const pts = Array.from({ length: N_BINS }, (_, i) => ({ x: -L + (i + 0.5) * binW, y: counts[i] }));
    this.chart.data.datasets[0].data = pts;
    const xScale = this.chart.options.scales.x;
    xScale.min = -L;
    xScale.max =  L;
    xScale.ticks.stepSize = step;
    this.chart.update('none');
  }

  destroy() { this.chart.destroy(); }
}

// ---- Weight scatter plot ---------------------------------------------------
// Scatters W[:,0] vs W[:,1] — one point per neuron.
export class WeightScatterChart {
  constructor(canvasId) {
    this._L = null;  // shared half-range for both axes
    const ctx = document.getElementById(canvasId).getContext('2d');

    const makeTicks = () => ({
      maxRotation: 0,
      font: { size: 10, family: MONO },
      callback(v) {
        if (Math.abs(v - this.min) < 1e-9 || Math.abs(v - this.max) < 1e-9) return null;
        return parseFloat(v.toPrecision(6));
      },
    });

    const scatterDataset = (color) => ({
      data: [],
      backgroundColor: color.replace('rgb(', 'rgba(').replace(')', ', 0.45)'),
      borderColor:     color.replace('rgb(', 'rgba(').replace(')', ', 0.8)'),
      borderWidth: 1,
      pointRadius: 3,
    });

    this.chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        // dataset 0: a_i > 0 (blue), dataset 1: a_i <= 0 (red)
        datasets: [
          scatterDataset('rgb(80, 110, 210)'),
          scatterDataset('rgb(210, 80, 70)'),
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: item => `a = ${parseFloat(item.raw.a.toPrecision(4))}`,
            },
          },
          title: {
            display: true,
            text: 'W[:,1] vs W[:,2]',
            font: { size: 12, family: MONO },
            color: '#666',
            padding: { top: 4, bottom: 2 },
          },
        },
        layout: { padding: { left: 4, right: 4 } },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'W₁', font: { size: 11, family: MONO } },
            ticks: makeTicks(),
            grid: { color: 'rgba(0,0,0,0.07)' },
          },
          y: {
            type: 'linear',
            title: { display: true, text: 'W₂', font: { size: 11, family: MONO } },
            ticks: makeTicks(),
            grid: { color: 'rgba(0,0,0,0.07)' },
          },
        },
      },
    });
  }

  update(W, a, n, d) {
    if (!W || !a || d < 2) {
      this.chart.data.datasets[0].data = [];
      this.chart.data.datasets[1].data = [];
      this.chart.update('none');
      return;
    }

    // Compute shared symmetric half-range with slow relaxation
    let maxAbs = 0;
    for (let i = 0; i < n; i++) {
      const a0 = Math.abs(W[i * d]);
      const a1 = Math.abs(W[i * d + 1]);
      if (a0 > maxAbs) maxAbs = a0;
      if (a1 > maxAbs) maxAbs = a1;
    }
    const rawL = maxAbs * 1.05;
    this._L = this._L === null ? rawL : Math.max(rawL, 0.9 * this._L);
    const L = this._L;
    const step = niceStep(2 * L);

    const pos = [], neg = [];
    for (let i = 0; i < n; i++) {
      const pt = { x: W[i * d], y: W[i * d + 1], a: a[i] };
      (a[i] > 0 ? pos : neg).push(pt);
    }
    this.chart.data.datasets[0].data = pos;
    this.chart.data.datasets[1].data = neg;

    for (const axis of ['x', 'y']) {
      this.chart.options.scales[axis].min = -L;
      this.chart.options.scales[axis].max =  L;
      this.chart.options.scales[axis].ticks.stepSize = step;
    }
    this.chart.update('none');
  }

  destroy() { this.chart.destroy(); }
}

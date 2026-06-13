// ============================================================================
// CHARTS
// ============================================================================

const MAX_PTS = 1000;   // max points sent to Chart.js per dataset

// Downsample a flat number array to ≤ maxPts indices (power-of-2 stride).
// Returns {indices, stride} — indices into the original array.
function downsampleIndices(len, maxPts) {
  let stride = 1;
  while (len / stride > maxPts) stride *= 2;
  const out = [];
  for (let i = 0; i < len; i += stride) out.push(i);
  if (out.length === 0 || out[out.length - 1] !== len - 1) out.push(len - 1);
  return out;
}

// Centered EMA on {x,y} array (runs after downsampling, so always O(MAX_PTS)).
function centeredEMA(pts, window) {
  if (window <= 1 || pts.length === 0) return pts;
  const alpha = 1 / window;
  const n = pts.length;
  const fwd = new Float64Array(n);
  fwd[0] = pts[0].y;
  for (let i = 1; i < n; i++) fwd[i] = alpha * pts[i].y + (1 - alpha) * fwd[i - 1];
  const bwd = new Float64Array(n);
  bwd[n - 1] = fwd[n - 1];
  for (let i = n - 2; i >= 0; i--) bwd[i] = alpha * fwd[i] + (1 - alpha) * bwd[i + 1];
  return pts.map((pt, i) => ({ x: pt.x, y: bwd[i] }));
}

const SUPERSCRIPTS = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
function toSuperscript(n) { return String(n).split('').map(c => SUPERSCRIPTS[c] ?? c).join(''); }
function logTickFmt(value) {
  if (value <= 0) return '';
  const exp = Math.round(Math.log10(value));
  if (Math.abs(value - Math.pow(10, exp)) / value < 0.01) return '10' + toSuperscript(exp);
  return '';
}

function setXBounds(chart, xMax) {
  chart.options.scales.x.min = 0;
  chart.options.scales.x.max = xMax;
}

function setYBoundsLog(chart, smoothed) {
  if (smoothed.length === 0) return;
  let lo = Infinity, hi = -Infinity;
  for (const pt of smoothed) { if (pt.y < lo) lo = pt.y; if (pt.y > hi) hi = pt.y; }
  chart.options.scales.y.min = Math.pow(10, Math.floor(Math.log10(Math.max(lo, 1e-12))));
  chart.options.scales.y.max = Math.pow(10, Math.ceil(Math.log10(Math.max(hi, 1e-12))));
}

// ---- Distance chart ---------------------------------------------------------

export class DistanceChart {
  constructor(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          data: [],
          borderColor: 'rgba(60,100,200,0.85)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: 'linear', ticks: { maxTicksLimit: 8 } },
          y: { beginAtZero: true },
        },
      },
    });
  }

  // history: flat number array, history[i] = dist at step i
  update(history, xMax) {
    const idx = downsampleIndices(history.length, MAX_PTS);
    this._chart.data.datasets[0].data = idx.map(i => ({ x: i, y: history[i] }));
    setXBounds(this._chart, xMax);
    this._chart.update('none');
  }

  clear() { this._chart.data.datasets[0].data = []; this._chart.update('none'); }
  destroy() { this._chart.destroy(); }
}

// ---- d(dist)/dt chart -------------------------------------------------------

export class DDistChart {
  constructor(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          { data: [], borderColor: 'rgba(60,160,80,0.18)', borderWidth: 1,   pointRadius: 0, tension: 0, order: 2 },
          { data: [], borderColor: 'rgba(60,160,80,0.9)',  borderWidth: 2,   pointRadius: 0, tension: 0, order: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: 'linear', ticks: { maxTicksLimit: 8 } },
          y: { type: 'logarithmic', ticks: { callback: logTickFmt } },
        },
      },
    });
  }

  // history: flat number array, history[i] = ddist at step i+1
  update(history, xMax, emaWindow) {
    const idx = downsampleIndices(history.length, MAX_PTS);
    const ds  = idx.map(i => ({ x: i + 1, y: Math.max(1e-12, -history[i]) }));
    const smoothed = centeredEMA(ds, emaWindow);
    this._chart.data.datasets[0].data = ds;
    this._chart.data.datasets[1].data = smoothed;
    setXBounds(this._chart, xMax);
    setYBoundsLog(this._chart, smoothed);
    this._chart.update('none');
  }

  clear() {
    this._chart.data.datasets[0].data = [];
    this._chart.data.datasets[1].data = [];
    this._chart.update('none');
  }
  destroy() { this._chart.destroy(); }
}

// ---- Per-step ||Δθ||·cos² chart ---------------------------------------------

export class CosSImPerStepChart {
  constructor(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          { data: [], borderColor: 'rgba(180,80,60,0.18)', borderWidth: 1, pointRadius: 0, tension: 0, order: 2 },
          { data: [], borderColor: 'rgba(180,80,60,0.9)',  borderWidth: 2, pointRadius: 0, tension: 0, order: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { type: 'linear', ticks: { maxTicksLimit: 8 } },
          y: { type: 'logarithmic', ticks: { callback: logTickFmt } },
        },
      },
    });
  }

  // projHistory: flat number array, projHistory[i] = ||Δθ||·cos² at step i+1
  update(projHistory, xMax, emaWindow) {
    const idx = downsampleIndices(projHistory.length, MAX_PTS);
    const ds  = idx.map(i => ({ x: i + 1, y: Math.max(1e-12, projHistory[i]) }));
    const smoothed = centeredEMA(ds, emaWindow);
    this._chart.data.datasets[0].data = ds;
    this._chart.data.datasets[1].data = smoothed;
    setXBounds(this._chart, xMax);
    setYBoundsLog(this._chart, smoothed);
    this._chart.update('none');
  }

  clear() {
    this._chart.data.datasets[0].data = [];
    this._chart.data.datasets[1].data = [];
    this._chart.update('none');
  }
  destroy() { this._chart.destroy(); }
}

// ---- Cosine sim histogram ---------------------------------------------------

const N_BINS = 50;

export class CosSimHistChart {
  constructor(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    this._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: 'rgba(80,120,200,0.55)',
          borderColor:     'rgba(80,120,200,0.9)',
          borderWidth: 1,
          borderRadius: 1,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => `cos ≈ ${Number(items[0].label).toFixed(3)}`,
              label: item  => `density: ${item.raw.toFixed(3)}`,
            },
          },
        },
        scales: {
          x: { type: 'linear', min: 0, max: 1, ticks: { maxTicksLimit: 6 } },
          y: { beginAtZero: true },
        },
      },
    });
  }

  update(cosims) {
    // only look at last N_HIST entries to keep this O(1) in total history length
    const N_HIST = 1000;
    const start = Math.max(0, cosims.length - N_HIST);
    const n = cosims.length - start;
    if (n === 0) return;
    let lo = Infinity, hi = -Infinity;
    for (let i = start; i < cosims.length; i++) {
      if (cosims[i] < lo) lo = cosims[i];
      if (cosims[i] > hi) hi = cosims[i];
    }
    const range = hi - lo || 0.01;
    const pad   = 0.5 * range;
    const xMin  = Math.max(0, lo - pad);
    const xMax  = Math.min(1, hi + pad);
    const w     = (xMax - xMin) / N_BINS;
    const bins    = new Float64Array(N_BINS);
    const centers = new Float64Array(N_BINS);
    for (let i = 0; i < N_BINS; i++) centers[i] = xMin + (i + 0.5) * w;
    for (let i = start; i < cosims.length; i++) {
      const b = Math.min(N_BINS - 1, Math.floor((cosims[i] - xMin) / w));
      if (b >= 0) bins[b]++;
    }
    const total = n * w;
    for (let i = 0; i < N_BINS; i++) bins[i] /= total;
    this._chart.options.scales.x.min = xMin;
    this._chart.options.scales.x.max = xMax;
    this._chart.data.labels = Array.from(centers);
    this._chart.data.datasets[0].data = Array.from(bins);
    this._chart.update('none');
  }

  clear() {
    this._chart.data.labels = [];
    this._chart.data.datasets[0].data = [];
    this._chart.update('none');
  }
  destroy() { this._chart.destroy(); }
}

// ============================================================================
// CHARTS — loss, product SVs, weight SVs, weight norms
// ============================================================================

const MAX_PTS = 1000;
const MONO    = 'Monaco, Consolas, "Courier New", monospace';

// Colors for singular values / layers (rainbow-ish)
const SV_COLORS = [
  'rgb(220,  60,  60)',
  'rgb(220, 140,  40)',
  'rgb(180, 190,  40)',
  'rgb( 60, 180,  60)',
  'rgb( 40, 160, 200)',
  'rgb( 80,  90, 220)',
  'rgb(160,  60, 200)',
  'rgb(200,  60, 140)',
  'rgb(120, 120, 120)',
  'rgb( 80,  60,  40)',
];

// Colors for weight layers
const LAYER_COLORS = [
  'rgb( 70, 120, 210)',
  'rgb(200,  80,  60)',
  'rgb( 60, 170,  80)',
  'rgb(170,  80, 200)',
];

function svColor(i) { return SV_COLORS[i % SV_COLORS.length]; }
function layerColor(i) { return LAYER_COLORS[i % LAYER_COLORS.length]; }

function downsample(arr) {
  if (arr.length <= MAX_PTS) return arr;
  const stride = Math.ceil(arr.length / MAX_PTS);
  const out = arr.filter((_, i) => i % stride === 0);
  if (out.length === 0 || out[out.length - 1] !== arr[arr.length - 1])
    out.push(arr[arr.length - 1]);
  return out;
}

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

function makeYTickCallback() {
  return function(value, index, ticks) {
    if (ticks.length < 2) return formatY(value);
    const step = ticks[1].value - ticks[0].value;
    if (step <= 0) return formatY(value);
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(step) || 1)));
    const isRound = Math.abs(Math.round(value / mag) * mag - value) < mag * 1e-6;
    if (!isRound && (index === 0 || index === ticks.length - 1)) return null;
    return formatY(value);
  };
}

function formatY(value) {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 0.01 && abs < 1e5) return String(parseFloat(value.toPrecision(3)));
  return value.toExponential(2);
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
        type: 'linear', min: 0,
        title: { display: true, text: 'step', font: { size: 13, family: MONO } },
        ticks: { maxRotation: 0, font: { size: 11, family: MONO }, callback: makeXTickCallback() },
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
      y: {
        type: 'linear', min: 0,
        title: { display: true, text: yTitle, font: { size: 13, family: MONO } },
        ticks: { font: { size: 11, family: MONO }, callback: makeYTickCallback() },
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
    },
  };
}

function ds(label, color, extra = {}) {
  return {
    label, data: [], borderColor: color, backgroundColor: 'transparent',
    borderWidth: 1.5, pointRadius: 0, tension: 0,
    ...extra,
  };
}

// ---- BaseChart -------------------------------------------------------------
class BaseChart {
  constructor() {
    this.logScaleX = false;
    this.logScaleY = false;
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

  _setXMax(lastStep) {
    const nice = Math.max(10, Math.ceil(lastStep / 10) * 10);
    this.chart.options.scales.x.max = nice;
  }

  clear() {
    for (const d of this.chart.data.datasets) d.data = [];
    this.chart.options.scales.x.max = undefined;
    this.chart.update('none');
  }

  destroy() { this.chart.destroy(); }
}

// ---- LossChart -------------------------------------------------------------
export class LossChart extends BaseChart {
  constructor(canvasId) {
    super();
    const opts = baseChartOptions('loss');
    opts.plugins.legend = { display: false };
    this.chart = new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: { datasets: [ds('loss', 'rgb(40,130,130)')] },
      options: opts,
    });
  }

  update(lossHistory) {
    if (lossHistory.length === 0) return;
    const raw = downsample(lossHistory);
    this.chart.data.datasets[0].data = raw;
    this._setXMax(lossHistory[lossHistory.length - 1].x);
    this.chart.update('none');
  }
}

// ---- SVChart — for product SVs or per-layer SVs ----------------------------
// numSVs determined dynamically from first data point
export class SVChart extends BaseChart {
  constructor(canvasId, yTitle = 'singular values') {
    super();
    const opts = baseChartOptions(yTitle);
    opts.plugins.legend = { display: false };
    // Start with empty datasets; will be created on first update
    this._n = 0;
    this.chart = new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: { datasets: [] },
      options: opts,
    });
  }

  // history: [{x, svs: [s0, s1, ...]}]
  // refSVs: optional array of static reference lines (target SVs)
  update(history, refSVs) {
    if (history.length === 0) return;
    const n = history[0].svs.length;

    // Build/rebuild datasets if n changed
    if (n !== this._n) {
      this._n = n;
      const sets = [];
      for (let i = 0; i < n; i++) sets.push(ds(`σ${i+1}`, svColor(i)));
      // Reference lines (dashed)
      if (refSVs) {
        for (let i = 0; i < refSVs.length; i++) {
          sets.push(ds(`σ*${i+1}`, svColor(i), {
            borderDash: [4, 4], borderWidth: 1, borderColor: svColor(i).replace('rgb', 'rgba').replace(')', ',0.5)'),
          }));
        }
      }
      this.chart.data.datasets = sets;
    }

    const raw = downsample(history);
    for (let i = 0; i < n; i++) {
      this.chart.data.datasets[i].data = raw.map(pt => ({ x: pt.x, y: pt.svs[i] }));
    }

    // Static reference lines
    if (refSVs && this.chart.data.datasets.length > n) {
      const last = history[history.length - 1].x;
      for (let i = 0; i < refSVs.length; i++) {
        this.chart.data.datasets[n + i].data = [
          { x: 0, y: refSVs[i] },
          { x: last, y: refSVs[i] },
        ];
      }
    }

    this._setXMax(history[history.length - 1].x);
    this.chart.update('none');
  }
}

// ---- SharpnessChart --------------------------------------------------------
// Shows top-k Hessian eigenvalues vs step, plus a horizontal 2/η reference.
export class SharpnessChart extends BaseChart {
  constructor(canvasId) {
    super();
    const opts = baseChartOptions('eigenvalue');
    opts.plugins.legend = { display: true, position: 'top', align: 'end',
      labels: { usePointStyle: false, boxWidth: 20, boxHeight: 2, font: { size: 10, family: MONO } } };
    this._k    = 0;
    this._eta  = null;
    this.chart = new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: { datasets: [] },
      options: opts,
    });
  }

  // history: [{x, values: Float64Array(k)}]
  // eta: current learning rate (for 2/η reference line)
  update(history, eta) {
    if (history.length === 0) return;
    const k = history[0].values.length;

    // Rebuild datasets if k or eta changed
    if (k !== this._k || eta !== this._eta) {
      this._k   = k;
      this._eta = eta;
      const sets = [];
      for (let j = 0; j < k; j++) {
        sets.push(ds(`λ${j+1}`, svColor(j)));
      }
      // 2/η reference line (dashed gray)
      sets.push(ds('2/η', 'rgba(0,0,0,0.35)', {
        borderDash: [6, 3], borderWidth: 1.5,
      }));
      this.chart.data.datasets = sets;
    }

    const raw = downsample(history);
    for (let j = 0; j < k; j++) {
      this.chart.data.datasets[j].data = raw.map(pt => ({ x: pt.x, y: pt.values[j] }));
    }

    // Update 2/η reference line to span current x range
    const lastX = history[history.length - 1].x;
    const ref   = eta > 0 ? 2 / eta : 0;
    this.chart.data.datasets[k].data = [{ x: 0, y: ref }, { x: lastX, y: ref }];

    this._setXMax(lastX);
    this.chart.update('none');
  }

  setEta(eta) {
    this._eta = eta;
    // force rebuild on next update
    this._k = 0;
  }
}

// ---- WeightNormChart -------------------------------------------------------
export class WeightNormChart extends BaseChart {
  constructor(canvasId) {
    super();
    const opts = baseChartOptions('||Wₖ||_F');
    opts.plugins.legend = { display: true, position: 'top', align: 'end',
      labels: { usePointStyle: false, boxWidth: 20, boxHeight: 2, font: { size: 10, family: MONO } } };
    this._depth = 0;
    this.chart = new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: { datasets: [] },
      options: opts,
    });
  }

  update(normHistory, depth) {
    if (normHistory.length === 0) return;

    if (depth !== this._depth) {
      this._depth = depth;
      const sets = [];
      for (let k = 0; k < depth; k++) {
        sets.push(ds(`W${k+1}`, layerColor(k)));
      }
      this.chart.data.datasets = sets;
    }

    const raw = downsample(normHistory);
    for (let k = 0; k < depth; k++) {
      this.chart.data.datasets[k].data = raw.map(pt => ({ x: pt.x, y: pt.norms[k] }));
    }

    this._setXMax(normHistory[normHistory.length - 1].x);
    this.chart.update('none');
  }
}

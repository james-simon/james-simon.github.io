// ============================================================================
// CHARTS — loss, sharpness, function plot, weight norms
// ============================================================================

import { computeTarget } from './simulation.js';

const MAX_PTS = 1000;
const MONO    = 'Monaco, Consolas, "Courier New", monospace';

const SV_COLORS = [
  'rgb(220,  60,  60)',
  'rgb(220, 140,  40)',
  'rgb(180, 190,  40)',
  'rgb( 60, 180,  60)',
  'rgb( 40, 160, 200)',
];

const LAYER_COLORS = [
  'rgb( 70, 120, 210)',
  'rgb(200,  80,  60)',
  'rgb( 60, 170,  80)',
  'rgb(170,  80, 200)',
];

function svColor(i)    { return SV_COLORS[i % SV_COLORS.length]; }
function layerColor(i) { return LAYER_COLORS[i % LAYER_COLORS.length]; }

function downsample(arr) {
  if (arr.length <= MAX_PTS) return arr;
  const stride = Math.ceil(arr.length / MAX_PTS);
  const out = arr.filter((_, i) => i % stride === 0);
  if (out.length === 0 || out[out.length-1] !== arr[arr.length-1]) out.push(arr[arr.length-1]);
  return out;
}

function makeXTickCallback() {
  return function(value, index, ticks) {
    if (ticks.length < 2) return String(Math.round(value));
    const span = ticks[ticks.length-1].value - ticks[0].value;
    const step = span / (ticks.length-1);
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
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(step)||1)));
    const isRound = Math.abs(Math.round(value/mag)*mag - value) < mag*1e-6;
    if (!isRound && (index === 0 || index === ticks.length-1)) return null;
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
  return { label, data: [], borderColor: color, backgroundColor: 'transparent',
           borderWidth: 1.5, pointRadius: 0, tension: 0, ...extra };
}

// ---- BaseChart -------------------------------------------------------------
class BaseChart {
  constructor() { this.logScaleX = false; this.logScaleY = false; this.chart = null; }

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
    this.chart.options.scales.x.max = Math.max(10, Math.ceil(lastStep/10)*10);
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
    this.chart = new Chart(document.getElementById(canvasId), {
      type: 'line',
      data: { datasets: [ds('loss', 'rgb(40,130,130)')] },
      options: baseChartOptions('loss'),
    });
  }

  update(lossHistory) {
    if (lossHistory.length === 0) return;
    this.chart.data.datasets[0].data = downsample(lossHistory);
    this._setXMax(lossHistory[lossHistory.length-1].x);
    this.chart.update('none');
  }
}

const BOT_COLORS = ['rgb(180,180,180)', 'rgb(110,110,110)', 'rgb(30,30,30)'];

// ---- SharpnessChart --------------------------------------------------------
export class SharpnessChart extends BaseChart {
  constructor(canvasId) {
    super();
    const opts = baseChartOptions('eigenvalue');
    opts.plugins.legend = { display: true, position: 'top', align: 'end',
      labels: { usePointStyle: false, boxWidth: 20, boxHeight: 2, font: { size: 10, family: MONO } } };
    opts.scales.y.min = undefined;  // allow negative eigenvalues
    this._k = 0; this._bk = 0; this._eta = null;
    this.chart = new Chart(document.getElementById(canvasId), {
      type: 'line', data: { datasets: [] }, options: opts,
    });
  }

  update(history, eta) {
    if (history.length === 0) return;
    const k  = history[0].values.length;
    const bk = history[0].bottomValues ? history[0].bottomValues.length : 0;
    if (k !== this._k || bk !== this._bk || eta !== this._eta) {
      this._k = k; this._bk = bk; this._eta = eta;
      const sets = [];
      for (let j = 0; j < k;  j++) sets.push(ds(`λ${j+1}`, svColor(j)));
      for (let j = 0; j < bk; j++) sets.push(ds(`λ_${j+1}`, BOT_COLORS[j % BOT_COLORS.length], { borderWidth: 1 }));
      sets.push(ds('2/η', 'rgba(0,0,0,0.35)', { borderDash: [6,3], borderWidth: 1.5 }));
      this.chart.data.datasets = sets;
    }
    const raw = downsample(history);
    for (let j = 0; j < k;  j++)
      this.chart.data.datasets[j].data = raw.map(pt => ({ x: pt.x, y: pt.values[j] }));
    for (let j = 0; j < bk; j++)
      this.chart.data.datasets[k + j].data = raw.map(pt => ({ x: pt.x, y: pt.bottomValues[j] }));
    const lastX = history[history.length-1].x;
    const ref = eta > 0 ? 2/eta : 0;
    this.chart.data.datasets[k + bk].data = [{ x:0, y:ref }, { x:lastX, y:ref }];
    this._setXMax(lastX);
    this.chart.update('none');
  }
}

// ---- WeightNormChart -------------------------------------------------------
export class WeightNormChart extends BaseChart {
  constructor(canvasId) {
    super();
    const opts = baseChartOptions('||Wₖ||');
    opts.plugins.legend = { display: true, position: 'top', align: 'end',
      labels: { usePointStyle: false, boxWidth: 20, boxHeight: 2, font: { size: 10, family: MONO } } };
    this._depth = 0;
    this.chart = new Chart(document.getElementById(canvasId), {
      type: 'line', data: { datasets: [] }, options: opts,
    });
  }

  update(normHistory, depth) {
    if (normHistory.length === 0) return;
    if (depth !== this._depth) {
      this._depth = depth;
      this.chart.data.datasets = Array.from({length: depth}, (_, k) => ds(`W${k+1}`, layerColor(k)));
    }
    const raw = downsample(normHistory);
    for (let k = 0; k < depth; k++)
      this.chart.data.datasets[k].data = raw.map(pt => ({ x: pt.x, y: pt.norms[k] }));
    this._setXMax(normHistory[normHistory.length-1].x);
    this.chart.update('none');
  }
}

// ---- FunctionPlot — canvas draw, not Chart.js ------------------------------
// Shows f*(x) (dashed gray), f_hat(x) (solid teal), and training dots.

const GRID_PTS = 200;

// Per-frame decay factor for y-range smoothing (~1s time constant at 40fps).
// Decays to ~37% in 1s: e^(-1/40) ≈ 0.9753
const Y_DECAY = 0.9753;

export class FunctionPlot {
  constructor(canvasId) {
    this.canvas  = document.getElementById(canvasId);
    this.ctx     = this.canvas.getContext('2d');
    this._gridXs = null;
    this._yMid   = null;  // smoothed midpoint
    this._yHalf  = null;  // smoothed half-range (jumps up instantly, decays slowly)
  }

  clear() {
    const canvas = this.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this._yMid  = null;
    this._yHalf = null;
  }

  update(sim) {
    if (!sim.layers || !sim.params) return;

    const canvas = this.canvas;
    const ctx    = this.ctx;

    // Sync canvas resolution to display size
    const w = canvas.clientWidth  || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

    ctx.clearRect(0, 0, w, h);

    const ml = 44, mr = 12, mt = 12, mb = 28;
    const pw = w - ml - mr;
    const ph = h - mt - mb;

    // Build grid
    if (!this._gridXs) {
      this._gridXs = new Float64Array(GRID_PTS);
      for (let i = 0; i < GRID_PTS; i++) this._gridXs[i] = -1 + 2*i/(GRID_PTS-1);
    }

    const fHat  = sim.evaluate(this._gridXs);
    const fStar = new Float64Array(GRID_PTS);
    const { targetType, targetDegree } = sim.params;
    for (let i = 0; i < GRID_PTS; i++)
      fStar[i] = computeTarget(this._gridXs[i], targetType, targetDegree);

    // Raw y range across all curves + data
    let rawMin = Infinity, rawMax = -Infinity;
    for (const y of fHat)   { rawMin = Math.min(rawMin,y); rawMax = Math.max(rawMax,y); }
    for (const y of fStar)  { rawMin = Math.min(rawMin,y); rawMax = Math.max(rawMax,y); }
    for (const y of sim.ys) { rawMin = Math.min(rawMin,y); rawMax = Math.max(rawMax,y); }
    const rawMid  = (rawMin + rawMax) / 2;
    const rawHalf = Math.max((rawMax - rawMin) / 2, 0.5);

    // Smoothed range: jump up instantly, decay slowly downward
    if (this._yHalf === null) {
      this._yMid  = rawMid;
      this._yHalf = rawHalf;
    } else {
      this._yHalf = Math.max(rawHalf, Y_DECAY * this._yHalf);
      this._yMid  = rawMid;  // midpoint tracks instantly (avoids drift)
    }

    const yPad = this._yHalf * 0.1;
    let yMin = this._yMid - this._yHalf - yPad;
    let yMax = this._yMid + this._yHalf + yPad;
    if (yMax - yMin < 1e-10) { yMin -= 1; yMax += 1; }

    const cx = x  => ml + (x + 1) / 2 * pw;
    const cy = y  => mt + (1 - (y - yMin) / (yMax - yMin)) * ph;

    // White plot area
    ctx.fillStyle = '#fff';
    ctx.fillRect(ml, mt, pw, ph);

    // Zero axis lines
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx(0), mt); ctx.lineTo(cx(0), mt+ph); ctx.stroke();
    if (yMin < 0 && yMax > 0) {
      const y0 = cy(0);
      ctx.beginPath(); ctx.moveTo(ml, y0); ctx.lineTo(ml+pw, y0); ctx.stroke();
    }

    // f*(x) — dashed gray
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let i = 0; i < GRID_PTS; i++) {
      const px = cx(this._gridXs[i]), py = cy(fStar[i]);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // f_hat(x) — solid teal
    ctx.strokeStyle = 'rgb(40,130,130)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < GRID_PTS; i++) {
      const px = cx(this._gridXs[i]), py = cy(fHat[i]);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Training data points
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    for (let i = 0; i < sim.xs.length; i++) {
      ctx.beginPath();
      ctx.arc(cx(sim.xs[i]), cy(sim.ys[i]), 3, 0, 2*Math.PI);
      ctx.fill();
    }

    // x-axis labels
    ctx.fillStyle = '#888';
    ctx.font = `11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('-1', cx(-1), mt+ph+18);
    ctx.fillText('0',  cx(0),  mt+ph+18);
    ctx.fillText('1',  cx(1),  mt+ph+18);

    // y-axis ticks (3)
    ctx.textAlign = 'right';
    const yTicks = [yMin+yPad, (yMin+yMax)/2, yMax-yPad];
    for (const yv of yTicks) {
      const py = cy(yv);
      ctx.fillStyle = '#888';
      ctx.fillText(formatY(yv), ml-4, py+4);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ml, py); ctx.lineTo(ml+pw, py); ctx.stroke();
    }

    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ml, mt, pw, ph);
  }

  destroy() {}
}

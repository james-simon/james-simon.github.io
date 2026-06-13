// ============================================================================
// DRIVING PROBLEM — app orchestrator
// ============================================================================

import { AppState }      from './state.js';
import { Simulation }   from './simulation.js';
import { DistanceChart, DDistChart, CosSImPerStepChart, CosSimHistChart } from './charts.js';
import { bindUI, setStartPauseLabel }        from './ui.js';
import { XOptimizer }   from './xOptimizer.js';

// ---- Matrix heatmap ---------------------------------------------------------

const CELL = 18;   // px per cell

function makeColor(t) {
  // diverging blue → white → red
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const s = t / 0.5;
    return `rgb(${Math.round(255*s)},${Math.round(255*s)},255)`;
  } else {
    const s = (t - 0.5) / 0.5;
    return `rgb(255,${Math.round(255*(1-s))},${Math.round(255*(1-s))})`;
  }
}

function absMax(arr) {
  let m = 1e-9;
  for (let i = 0; i < arr.length; i++) if (Math.abs(arr[i]) > m) m = Math.abs(arr[i]);
  return m;
}

function drawMatrix(canvas, data, rows, cols, maxAbs) {
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const t = data[i * cols + j] / maxAbs * 0.5 + 0.5;
      ctx.fillStyle = makeColor(t);
      ctx.fillRect(j * CELL, i * CELL, CELL, CELL);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth   = 0.5;
  for (let i = 0; i <= rows; i++) {
    ctx.beginPath(); ctx.moveTo(0, i*CELL); ctx.lineTo(cols*CELL, i*CELL); ctx.stroke();
  }
  for (let j = 0; j <= cols; j++) {
    ctx.beginPath(); ctx.moveTo(j*CELL, 0); ctx.lineTo(j*CELL, rows*CELL); ctx.stroke();
  }
}

function makeMatrixBox(parent, title, rows, cols) {
  const box    = document.createElement('div');
  box.className = 'matrix-box';
  const lbl    = document.createElement('div');
  lbl.className = 'matrix-label';
  lbl.textContent = title;
  box.appendChild(lbl);

  const canvas  = document.createElement('canvas');
  canvas.width  = cols * CELL;
  canvas.height = rows * CELL;
  canvas.style.cssText = `display:block;width:${cols*CELL}px;height:${rows*CELL}px;image-rendering:pixelated;`;
  box.appendChild(canvas);

  const rangeEl = document.createElement('div');
  rangeEl.className = 'matrix-range';
  box.appendChild(rangeEl);
  parent.appendChild(box);

  return { canvas, rangeEl };
}

// ---- Weight heatmap manager -------------------------------------------------

class HeatmapManager {
  constructor(sim) {
    this._sim    = sim;
    this._panels = {};  // key → { canvas, rangeEl, rows, cols }
  }

  build(containerEl) {
    containerEl.innerHTML = '';
    const { mlp, thetaStar } = this._sim;
    const { din, dh, dout, bias, depth } = mlp;
    this._panels = {};
    const dims = mlp._layerDims();
    const SUB  = ['₁','₂','₃'];

    // Split thetaStar and build current/target items in one pass
    let off = 0;
    const currentItems = [], targetItems = [];
    for (let k = 0; k < depth; k++) {
      const { rows, cols } = dims[k];
      const isOut = k === depth - 1;
      const label  = SUB[k];
      const wKey   = `W${k}`, bKey = `b${k}`;
      const tsWKey = `tsW${k}`, tsBKey = `tsb${k}`;

      currentItems.push({ key: wKey,  data: mlp.W[k], rows, cols, title: `W${label}` });
      if (bias) currentItems.push({ key: bKey, data: mlp.b[k], rows, cols: 1, title: `b${label}` });

      const tsW = thetaStar.slice(off, off += rows * cols);
      targetItems.push({ key: tsWKey, data: tsW, rows, cols, title: `W${label}*` });
      if (bias) {
        const tsB = thetaStar.slice(off, off += rows);
        targetItems.push({ key: tsBKey, data: tsB, rows, cols: 1, title: `b${label}*` });
      }
    }

    const sections = [
      { label: 'Current weights θ', items: currentItems },
      { label: 'Target weights θ*', items: targetItems },
    ];

    for (const sec of sections) {
      const secEl  = document.createElement('div');
      secEl.className = 'matrix-section';
      const secLbl = document.createElement('div');
      secLbl.className = 'matrix-section-label';
      secLbl.textContent = sec.label;
      secEl.appendChild(secLbl);
      const grp = document.createElement('div');
      grp.className = 'matrix-group';
      secEl.appendChild(grp);
      containerEl.appendChild(secEl);

      for (const item of sec.items) {
        const m = absMax(item.data);
        const { canvas, rangeEl } = makeMatrixBox(grp, item.title, item.rows, item.cols);
        rangeEl.textContent = `±${m.toFixed(2)}`;
        drawMatrix(canvas, item.data, item.rows, item.cols, m);
        this._panels[item.key] = { canvas, rangeEl, rows: item.rows, cols: item.cols };
      }
    }
  }

  refresh() {
    const { mlp } = this._sim;
    const { bias, depth } = mlp;
    const dims = mlp._layerDims();

    for (let k = 0; k < depth; k++) {
      const { rows, cols } = dims[k];
      for (const [key, data, r, c] of [
        [`W${k}`, mlp.W[k], rows, cols],
        ...(bias ? [[`b${k}`, mlp.b[k], rows, 1]] : []),
      ]) {
        const p = this._panels[key];
        if (!p) continue;
        const m = absMax(data);
        p.rangeEl.textContent = `±${m.toFixed(2)}`;
        drawMatrix(p.canvas, data, r, c, m);
      }
    }
  }
}

// ---- Stats bar --------------------------------------------------------------

const STATS_N = 1000;
function updateStatsBar(cosims) {
  const bar = document.getElementById('statsBar');
  if (!bar || cosims.length === 0) return;
  const start = Math.max(0, cosims.length - STATS_N);
  const slice = cosims.slice(start);   // at most STATS_N entries
  let sum = 0, max = -Infinity;
  for (const v of slice) { sum += v; if (v > max) max = v; }
  const mean   = sum / slice.length;
  const sorted = slice.slice().sort((a,b) => a-b);
  const med    = sorted[Math.floor(sorted.length / 2)];
  const p95    = sorted[Math.floor(0.95 * sorted.length)];
  let var_ = 0;
  for (const v of slice) var_ += (v - mean) ** 2;
  const std = Math.sqrt(var_ / slice.length);

  const fmt = v => v.toFixed(3);
  bar.innerHTML = `
    <span class="stat-pill">mean <strong>${fmt(mean)}</strong></span>
    <span class="stat-pill">std <strong>${fmt(std)}</strong></span>
    <span class="stat-pill">median <strong>${fmt(med)}</strong></span>
    <span class="stat-pill">p95 <strong>${fmt(p95)}</strong></span>
    <span class="stat-pill">max <strong>${fmt(max)}</strong></span>
    <span class="stat-pill" style="color:#aaa;">last ${slice.length.toLocaleString()} steps</span>
  `;
}

// ---- Main -------------------------------------------------------------------

const appState = new AppState();
appState.load();

const sim        = new Simulation();
let distChart       = null;
let ddistChart      = null;
let cosSimStepChart = null;
let histChart       = null;
let heatmaps     = null;

function reinit() {
  if (sim.running) { sim.pause(); setStartPauseLabel(false); }
  const { din, dh, dout, act, bias, depth } = appState;
  sim.initialize(din, dh, dout, act, bias, depth);

  distChart.clear();
  ddistChart.clear();
  cosSimStepChart.clear();
  histChart.clear();

  heatmaps.build(document.getElementById('weightsRow'));

  distChart.update(sim.distHistory, 0);

  document.getElementById('stepsPerSec').textContent = '0';
  document.getElementById('iterCount').textContent   = '0';
}

function onFrameUpdate() {
  const t = sim.iteration;
  distChart.update(sim.distHistory, t);
  ddistChart.update(sim.ddistHistory, t, appState.emaWindow);

  cosSimStepChart.update(sim.projHistory, sim.iteration, appState.emaWindow);
  histChart.update(sim.cosSimHistory);
  updateStatsBar(sim.cosSimHistory);

  document.getElementById('stepsPerSec').textContent =
    Math.round(sim.stepsPerSec).toLocaleString();
  document.getElementById('iterCount').textContent =
    sim.iteration.toLocaleString();
}

// ---- X optimizer ------------------------------------------------------------

const xOpt = new XOptimizer();

function setXProvider() {
  if (appState.useOptX) {
    sim.xProvider = (mlp, delta) => xOpt.bestX(mlp, delta, appState.xOptLr, appState.xOptSteps, appState.xSigma);
  } else {
    sim.xProvider = null;
  }
}

function initXOptimizer() {

  // Two small charts
  const cosCtx  = document.getElementById('xOptCosCanvas').getContext('2d');
  const normCtx = document.getElementById('xOptNormCanvas').getContext('2d');

  const makeChart = (ctx, yLabel, color) => new Chart(ctx, {
    type: 'line',
    data: { datasets: [{ data: [], borderColor: color, borderWidth: 1.5, pointRadius: 0, tension: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { type: 'linear', ticks: { maxTicksLimit: 6 } },
        y: { beginAtZero: true },
      },
    },
  });

  const cosChart  = makeChart(cosCtx,  '|cos|', 'rgba(80,120,200,0.9)');
  const normChart = makeChart(normCtx, '||x||', 'rgba(180,80,60,0.9)');

  function refreshCharts() {
    const h = xOpt.history;
    cosChart.data.datasets[0].data  = h.map(p => ({ x: p.step, y: p.cosSim }));
    normChart.data.datasets[0].data = h.map(p => ({ x: p.step, y: p.xNorm  }));
    cosChart.update('none');
    normChart.update('none');
  }

  document.getElementById('xOptRunBtn').addEventListener('click', () => {
    if (!sim.mlp) return;
    const status = document.getElementById('xOptStatus');
    status.textContent = 'running…';
    // synchronous — completes in <10ms for typical settings
    const delta = sim.deltaTheta();
    xOpt.run(sim.mlp, delta, appState.xOptLr, appState.xOptSteps, appState.xSigma);
    refreshCharts();
    const best = xOpt.history.reduce((a, b) => b.cosSim > a.cosSim ? b : a, xOpt.history[0]);
    status.textContent = `done — best |cos| = ${best?.cosSim.toFixed(4) ?? '?'}`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  distChart       = new DistanceChart('distCanvas');
  ddistChart      = new DDistChart('ddistCanvas');
  cosSimStepChart = new CosSImPerStepChart('cosSimStepCanvas');
  histChart       = new CosSimHistChart('histCanvas');
  heatmaps    = new HeatmapManager(sim);

  bindUI(appState, {
    onParamChange(key) {
      if (key === 'maxStepsPerSec' && sim.running)
        sim._maxStepsPerSec = appState.maxStepsPerSec;
      if (key === 'xSigma')
        sim._xSigma = appState.xSigma;
      if (key === 'emaWindow') {
        const t = sim.iteration;
        if (sim.ddistHistory.length > 0)
          ddistChart.update(sim.ddistHistory, t, appState.emaWindow);
        if (sim.projHistory.length > 0)
          cosSimStepChart.update(sim.projHistory, t, appState.emaWindow);
      }
      if (key === 'useOptX') setXProvider();
      appState.save();
    },
    startPause() {
      if (!sim.mlp) reinit();
      if (sim.running) {
        sim.pause();
        setStartPauseLabel(false);
      } else {
        sim.start(appState.xDist, appState.xSigma, appState.maxStepsPerSec);
        setStartPauseLabel(true);
      }
    },
    reinit() { reinit(); },
  });

  sim.onFrameUpdate   = onFrameUpdate;
  sim.onHeatmapUpdate = () => heatmaps.refresh();

  initXOptimizer();
  setXProvider();
  reinit();
});

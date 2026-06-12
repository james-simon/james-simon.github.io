// ============================================================================
// DRIVING PROBLEM — app orchestrator
// ============================================================================

import { AppState }      from './state.js';
import { Simulation }   from './simulation.js';
import { DistanceChart, DDistChart, CosSImPerStepChart, CosSimHistChart } from './charts.js';
import { bindUI, setStartPauseLabel }        from './ui.js';

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
    const { din, dh, dout }  = mlp;
    this._panels = {};

    // Split thetaStar into weight shapes
    const tsW1 = thetaStar.slice(0, dh*din);
    const tsb1 = thetaStar.slice(dh*din, dh*din+dh);
    const tsW2 = thetaStar.slice(dh*din+dh, dh*din+dh+dout*dh);
    const tsb2 = thetaStar.slice(dh*din+dh+dout*dh);

    const sections = [
      { label: 'Current weights θ', items: [
        { key:'W1', data: mlp.W1, rows: dh, cols: din,  title: 'W₁' },
        { key:'b1', data: mlp.b1, rows: dh, cols: 1,    title: 'b₁' },
        { key:'W2', data: mlp.W2, rows: dout, cols: dh, title: 'W₂' },
        { key:'b2', data: mlp.b2, rows: dout, cols: 1,  title: 'b₂' },
      ]},
      { label: 'Target weights θ*', items: [
        { key:'tsW1', data: tsW1, rows: dh, cols: din,  title: 'W₁*' },
        { key:'tsb1', data: tsb1, rows: dh, cols: 1,    title: 'b₁*' },
        { key:'tsW2', data: tsW2, rows: dout, cols: dh, title: 'W₂*' },
        { key:'tsb2', data: tsb2, rows: dout, cols: 1,  title: 'b₂*' },
      ]},
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
    const { din, dh, dout } = mlp;

    const updates = [
      { key:'W1', data: mlp.W1, rows: dh,   cols: din },
      { key:'b1', data: mlp.b1, rows: dh,   cols: 1   },
      { key:'W2', data: mlp.W2, rows: dout, cols: dh  },
      { key:'b2', data: mlp.b2, rows: dout, cols: 1   },
    ];

    for (const u of updates) {
      const p = this._panels[u.key];
      if (!p) continue;
      const m = absMax(u.data);
      p.rangeEl.textContent = `±${m.toFixed(2)}`;
      drawMatrix(p.canvas, u.data, u.rows, u.cols, m);
    }
  }
}

// ---- Stats bar --------------------------------------------------------------

function updateStatsBar(cosims) {
  const bar = document.getElementById('statsBar');
  if (!bar || cosims.length === 0) return;
  let sum = 0, max = -Infinity;
  for (const v of cosims) { sum += v; if (v > max) max = v; }
  const mean   = sum / cosims.length;
  const sorted = cosims.slice().sort((a,b) => a-b);
  const med    = sorted[Math.floor(sorted.length / 2)];
  const p95    = sorted[Math.floor(0.95 * sorted.length)];
  let var_ = 0;
  for (const v of cosims) var_ += (v - mean) ** 2;
  const std = Math.sqrt(var_ / cosims.length);

  const fmt = v => v.toFixed(3);
  bar.innerHTML = `
    <span class="stat-pill">mean <strong>${fmt(mean)}</strong></span>
    <span class="stat-pill">std <strong>${fmt(std)}</strong></span>
    <span class="stat-pill">median <strong>${fmt(med)}</strong></span>
    <span class="stat-pill">p95 <strong>${fmt(p95)}</strong></span>
    <span class="stat-pill">max <strong>${fmt(max)}</strong></span>
    <span class="stat-pill" style="color:#aaa;">last ${cosims.length.toLocaleString()} steps</span>
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
  const { din, dh, dout, act } = appState;
  sim.initialize(din, dh, dout, act);

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
      if (key === 'emaWindow') {
        const t = sim.iteration;
        if (sim.ddistHistory.length > 0)
          ddistChart.update(sim.ddistHistory, t, appState.emaWindow);
        if (sim.projHistory.length > 0)
          cosSimStepChart.update(sim.projHistory, t, appState.emaWindow);
      }
      appState.save();
    },
    startPause() {
      if (!sim.mlp) reinit();
      if (sim.running) {
        sim.pause();
        setStartPauseLabel(false);
      } else {
        sim.start(appState.xDist, appState.maxStepsPerSec);
        setStartPauseLabel(true);
      }
    },
    reinit() { reinit(); },
  });

  sim.onFrameUpdate   = onFrameUpdate;
  sim.onHeatmapUpdate = () => heatmaps.refresh();

  reinit();
});

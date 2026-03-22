// ============================================================================
// HIST ROW — manages the dynamic row of weight histograms + scatter plot
// ============================================================================

import { WeightHistChart, WeightScatterChart } from './charts.js';

export class HistRow {
  constructor(rowId) {
    this._rowEl = document.getElementById(rowId);
    this._hists = [];
    this._scatter = null;
  }

  // Rebuild for T input directions. Destroys existing charts.
  rebuild(T) {
    for (const h of this._hists) h.destroy();
    this._hists = [];
    if (this._scatter) { this._scatter.destroy(); this._scatter = null; }
    this._rowEl.innerHTML = '';

    for (let k = 0; k < T; k++) {
      const id = `histPlot_${k}`;
      this._rowEl.appendChild(this._makeCell(id));
      this._hists.push(new WeightHistChart(id, k));
    }

    if (T >= 2) {
      this._rowEl.appendChild(this._makeCell('scatterPlot'));
      this._scatter = new WeightScatterChart('scatterPlot');
    }
  }

  // Call each frame with current weight matrix and readout vector.
  update(W, a, n, d) {
    for (const h of this._hists) h.update(W, n, d);
    if (this._scatter) this._scatter.update(W, a, n, d);
  }

  _makeCell(canvasId) {
    const cell = document.createElement('div');
    cell.style.cssText = 'flex:1; min-width:0;';
    const box = document.createElement('div');
    box.className = 'plot-canvas-box';
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    box.appendChild(canvas);
    cell.appendChild(box);
    return cell;
  }
}

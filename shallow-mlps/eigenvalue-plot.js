// ============================================================================
// EIGENVALUE PLOT — sorted eigenvalue spectrum of the feature kernel K/B
//
// Computation runs in eigenvalue-worker.js (off main thread).
// This file owns the canvas and dispatches work to the worker.
// ============================================================================

import { ACTIVATIONS } from './simulation.js';

const RECOMPUTE_MS_DEFAULT = 2000;
const BATCH_DEFAULT        = 32;
const MONO = 'Monaco, Consolas, "Courier New", monospace';

// Serialize an activation function to a string the worker can reconstruct.
function sigmaToStr(activation) {
  const f = ACTIVATIONS[activation].f;
  // Extract body from "x => <expr>" or "function(x){<body>}" toString
  const src = f.toString();
  // Arrow function: "x => expr" or "x => { ... }"
  const arrowMatch = src.match(/^[^=]+=>\s*(.+)$/s);
  if (arrowMatch) {
    const body = arrowMatch[1].trim();
    return body.startsWith('{') ? body.slice(1, -1) : `return ${body};`;
  }
  // Regular function: extract body between first { and last }
  const bodyMatch = src.match(/\{([\s\S]*)\}$/);
  return bodyMatch ? bodyMatch[1] : 'return x;';
}

export class EigenvaluePlot {
  constructor(canvasId) {
    this._canvas  = document.getElementById(canvasId);
    this._ctx     = this._canvas.getContext('2d');
    this._params  = null;
    this._W       = null;
    this._eigs    = null;
    this._displayB = BATCH_DEFAULT;
    this._lastRecompute = -Infinity;
    this._pending = false;   // worker job in flight

    this._batchSize   = BATCH_DEFAULT;
    this._recomputeMs = RECOMPUTE_MS_DEFAULT;

    // Resolve worker path relative to this module's location
    const workerUrl = new URL('./eigenvalue-worker.js', import.meta.url).href;
    this._worker = new Worker(workerUrl);
    this._worker.onmessage = ({ data }) => {
      this._pending = false;
      if (data.error) { console.warn('[eigenvalue-plot] worker error:', data.error); return; }
      this._eigs     = data.eigs;
      this._displayB = data.B;
    };

    const resize = () => {
      const box = this._canvas.parentElement;
      if (!box) return;
      const w = box.clientWidth  || 300;
      const h = box.clientHeight || 260;
      if (this._canvas.width !== w || this._canvas.height !== h) {
        this._canvas.width  = w;
        this._canvas.height = h;
      }
    };
    resize();
    new ResizeObserver(resize).observe(this._canvas.parentElement);
  }

  setOptions({ batchSize, recomputeMs } = {}) {
    if (batchSize   !== undefined && batchSize   !== this._batchSize)   { this._batchSize   = batchSize;   this.reset(); }
    if (recomputeMs !== undefined && recomputeMs !== this._recomputeMs) { this._recomputeMs = recomputeMs; }
  }

  setSimState(params, W) {
    this._params = params;
    this._W      = W;
  }

  update() {
    if (!this._params || !this._W) return;
    const now = performance.now();
    if (!this._pending && now - this._lastRecompute >= this._recomputeMs) {
      this._dispatch();
      this._lastRecompute = now;
    }
    this._draw();
  }

  reset() {
    this._eigs = null;
    this._lastRecompute = -Infinity;
    this._pending = false;
  }

  destroy() {
    this._worker.terminate();
  }

  // ---- worker dispatch -------------------------------------------------------

  _dispatch() {
    const { n, d, activation } = this._params;
    const B = this._batchSize;

    // Copy W so we can transfer its buffer to the worker
    const WCopy = new Float64Array(this._W);

    this._pending = true;
    this._worker.postMessage(
      { W: WCopy, n, d, B, sigmaStr: sigmaToStr(activation) },
      [WCopy.buffer]
    );
  }

  // ---- drawing ---------------------------------------------------------------

  _draw() {
    const canvas = this._canvas;
    const ctx    = this._ctx;

    // Sync canvas pixel size to CSS box
    const box = canvas.parentElement;
    if (box) {
      const bw = box.clientWidth  || 300;
      const bh = box.clientHeight || 260;
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width  = bw;
        canvas.height = bh;
      }
    }

    const CW = canvas.width, CH = canvas.height;
    const ML = 58, MR = 12, MT = 24, MB = 36;
    const pw = CW - ML - MR;
    const ph = CH - MT - MB;

    ctx.clearRect(0, 0, CW, CH);

    // Title
    ctx.fillStyle = '#666';
    ctx.font = `11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`feature kernel eigenvalues  (B=${this._displayB})`, ML + pw / 2, 14);

    // Background + border
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(ML, MT, pw, ph);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(ML, MT, pw, ph);

    if (!this._eigs || this._eigs.length === 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = `11px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('computing…', ML + pw / 2, MT + ph / 2);
      return;
    }

    const eigs = Array.from(this._eigs).filter(v => v > 0);
    if (eigs.length === 0) return;
    const N = eigs.length;

    // Log-log axis bounds
    const xMax   = Math.log10(N);
    const rawMin = Math.log10(eigs[N - 1]);
    const rawMax = Math.log10(eigs[0]);
    const yPad   = Math.max(0.5, (rawMax - rawMin) * 0.1);
    const yMin   = Math.floor(rawMin - yPad);
    const yMax   = Math.ceil( rawMax + yPad);

    const toX = i => ML + Math.log10(i + 1) / Math.max(xMax, 1e-9) * pw;
    const toY = v => MT + ph - (Math.log10(Math.max(v, 1e-30)) - yMin) / Math.max(yMax - yMin, 1e-9) * ph;

    // Y grid + ticks
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let exp = Math.ceil(yMin); exp <= Math.floor(yMax); exp++) {
      const y = toY(Math.pow(10, exp));
      if (y < MT - 1 || y > MT + ph + 1) continue;
      ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + pw, y); ctx.stroke();
      ctx.strokeStyle = '#888';
      ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML - 4, y); ctx.stroke();
      ctx.fillStyle = '#444';
      const sup = exp < 0 ? '\u207b' + String(-exp).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('') : String(exp).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
      ctx.fillText(`10${sup}`, ML - 6, y);
    }

    // X ticks (rank, log scale)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const v of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) {
      if (v > N) break;
      const x = toX(v - 1);
      ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, MT); ctx.lineTo(x, MT + ph); ctx.stroke();
      ctx.strokeStyle = '#888';
      ctx.beginPath(); ctx.moveTo(x, MT + ph); ctx.lineTo(x, MT + ph + 4); ctx.stroke();
      ctx.fillStyle = '#444';
      ctx.fillText(String(v), x, MT + ph + 5);
    }

    // Axis labels
    ctx.fillStyle = '#555';
    ctx.font = `11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('index', ML + pw / 2, CH - 1);
    ctx.save();
    ctx.translate(4, MT + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'top';
    ctx.fillText('eigenvalue', 0, 0);
    ctx.restore();

    // Dots
    ctx.fillStyle = 'rgba(40, 110, 200, 0.75)';
    const dotR = Math.max(1.5, Math.min(4, 300 / N));
    for (let i = 0; i < N; i++) {
      const x = toX(i);
      const y = toY(eigs[i]);
      if (y < MT - dotR || y > MT + ph + dotR) continue;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

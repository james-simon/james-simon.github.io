// ============================================================================
// UTILITY PLOT — 2D heatmap of U(w1, w2): the utility of adding a new neuron
// with input weights (w1, w2) to the current network.
//
// Only meaningful when d = 2. The owning code should hide this when d != 2.
//
// U(w1,w2) = <res, h_hat> / sqrt(B)
//   where res_b  = f*(x_b) - f_hat(x_b)          (residual)
//         h_b    = sigma((w1*x1_b + w2*x2_b)/sqrt(2))
//         h_hat  = h / ||h||                       (normalized)
//
// Rendered directly to a <canvas> via ImageData (no Chart.js).
// Recomputes at most once per second; redraws every frame.
// ============================================================================

import { ACTIVATIONS } from './simulation.js';
import { computeTarget } from './targets.js';

const G = 64;        // grid resolution (fixed)

// Gaussian blur kernel (1D, separable), sigma = 1.5 grid cells
function makeGaussKernel(sigma, radius) {
  const k = [];
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-0.5 * (i / sigma) ** 2);
    k.push(v);
    sum += v;
  }
  return k.map(v => v / sum);
}
const BLUR_KERNEL = makeGaussKernel(1.5, 3);
const BLUR_RADIUS = 3;

function blur2D(grid) {
  const out = new Float32Array(G * G);
  const tmp = new Float32Array(G * G);
  const K = BLUR_KERNEL;
  const R = BLUR_RADIUS;

  // Horizontal pass
  for (let row = 0; row < G; row++) {
    for (let col = 0; col < G; col++) {
      let s = 0;
      for (let k = -R; k <= R; k++) {
        const c2 = Math.max(0, Math.min(G - 1, col + k));
        s += K[k + R] * grid[row * G + c2];
      }
      tmp[row * G + col] = s;
    }
  }
  // Vertical pass
  for (let col = 0; col < G; col++) {
    for (let row = 0; row < G; row++) {
      let s = 0;
      for (let k = -R; k <= R; k++) {
        const r2 = Math.max(0, Math.min(G - 1, row + k));
        s += K[k + R] * tmp[r2 * G + col];
      }
      out[row * G + col] = s;
    }
  }
  return out;
}

// Diverging colormap: blue (neg) -> white (0) -> red (pos)
function toColor(u, maxAbs) {
  const t = maxAbs > 0 ? Math.max(-1, Math.min(1, u / maxAbs)) : 0;
  if (t >= 0) {
    // white -> red
    const r = 255, g = Math.round(255 * (1 - t)), b = Math.round(255 * (1 - t));
    return [r, g, b];
  } else {
    // white -> blue
    const r = Math.round(255 * (1 + t)), g = Math.round(255 * (1 + t)), b = 255;
    return [r, g, b];
  }
}

export class UtilityPlot {
  constructor(canvasId) {
    this._canvas    = document.getElementById(canvasId);
    this._ctx       = this._canvas.getContext('2d');
    this._params    = null;
    this._W         = null;
    this._a         = null;
    this._L         = 1;
    this._grid      = null;   // Float32Array G*G, blurred utility values
    this._maxAbs    = 1;
    this._lastRecompute = -Infinity;

    // Configurable options (can be updated via setOptions)
    this._batchSize        = 2048;
    this._recomputeMs      = 1000;

    // Keep canvas pixel dimensions in sync with CSS layout
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

  // Update configurable options; force recompute if anything changed.
  setOptions({ batchSize, recomputeMs }) {
    if (batchSize  !== undefined && batchSize  !== this._batchSize)  { this._batchSize  = batchSize;  this.reset(); }
    if (recomputeMs !== undefined && recomputeMs !== this._recomputeMs) { this._recomputeMs = recomputeMs; }
  }

  // Called from app whenever params/weights change
  setSimState(params, W, a) {
    this._params = params;
    this._W      = W;
    this._a      = a;
  }

  // Called every frame.
  update() {
    if (!this._params || !this._W || !this._a) return;

    // Compute L from current weights, same slow-relaxation logic as scatter chart
    const { n, d } = this._params;
    const W = this._W;
    let maxAbs = 0;
    for (let i = 0; i < n; i++) {
      const a0 = Math.abs(W[i * d]);
      const a1 = Math.abs(W[i * d + 1]);
      if (a0 > maxAbs) maxAbs = a0;
      if (a1 > maxAbs) maxAbs = a1;
    }
    const rawL = maxAbs * 1.05;
    this._L = this._L === 1 && rawL === 0 ? 1 : Math.max(rawL, 0.9 * this._L);

    const now = performance.now();
    if (now - this._lastRecompute >= this._recomputeMs) {
      this._recompute();
      this._lastRecompute = now;
    }

    this._draw();
  }

  reset() {
    this._grid = null;
    this._L    = 1;
    this._lastRecompute = -Infinity;
  }

  _recompute() {
    const { n, d, activation, numTerms, targetType } = this._params;
    if (d !== 2) return;

    const B      = this._batchSize;
    const sigma  = ACTIVATIONS[activation].f;
    const sqrtD  = Math.sqrt(d);   // = sqrt(2)
    const W      = this._W;
    const a      = this._a;
    const L      = this._L;

    // --- Sample batch x ~ N(0, I_2), compute residuals ---
    const x1 = new Float32Array(B);
    const x2 = new Float32Array(B);
    const res = new Float32Array(B);

    for (let b = 0; b < B; b++) {
      // Box-Muller
      let u, v;
      do { u = Math.random(); } while (u === 0);
      do { v = Math.random(); } while (v === 0);
      const r = Math.sqrt(-2 * Math.log(u));
      x1[b] = r * Math.cos(2 * Math.PI * v);
      do { u = Math.random(); } while (u === 0);
      do { v = Math.random(); } while (v === 0);
      const r2 = Math.sqrt(-2 * Math.log(u));
      x2[b] = r2 * Math.cos(2 * Math.PI * v);

      // Target (d=2, so pass a 2-element array)
      const xArr = [x1[b], x2[b]];
      const { y: yTarget } = computeTarget(xArr, targetType, numTerms);

      // Student forward: f_hat = (1/n) sum_i a_i sigma(W[i,:].x / sqrt(d))
      let yPred = 0;
      for (let i = 0; i < n; i++) {
        const zi = (W[i * d] * x1[b] + W[i * d + 1] * x2[b]) / sqrtD;
        yPred += a[i] * sigma(zi);
      }
      yPred /= n;

      res[b] = yTarget - yPred;
    }

    // --- Compute utility over G x G grid ---
    const rawGrid = new Float32Array(G * G);
    const step    = (2 * L) / G;
    const sqrtB   = Math.sqrt(B);

    for (let row = 0; row < G; row++) {
      const w2 = L - (row + 0.5) * step;   // y-axis: top = +L
      for (let col = 0; col < G; col++) {
        const w1 = -L + (col + 0.5) * step;

        // h_b = sigma((w1*x1_b + w2*x2_b) / sqrt(2))
        let hNormSq = 0;
        let dot = 0;
        for (let b = 0; b < B; b++) {
          const hb = sigma((w1 * x1[b] + w2 * x2[b]) / sqrtD);
          hNormSq += hb * hb;
          dot     += res[b] * hb;
        }
        // U = <res, h_hat> / sqrt(B) = dot / (||h|| * sqrt(B))
        const hNorm = Math.sqrt(hNormSq);
        rawGrid[row * G + col] = hNorm > 1e-12 ? dot / (hNorm * sqrtB) : 0;
      }
    }

    const blurred = blur2D(rawGrid);

    let maxAbs = 0;
    for (let i = 0; i < G * G; i++) { const v = Math.abs(blurred[i]); if (v > maxAbs) maxAbs = v; }

    this._grid   = blurred;
    this._maxAbs = maxAbs;
  }

  _draw() {
    const canvas = this._canvas;
    const ctx    = this._ctx;
    const L      = this._L;

    // Lay out: margins for axes, then heatmap fills the rest
    const MARGIN_L = 38, MARGIN_R = 10, MARGIN_T = 28, MARGIN_B = 36;
    const W = canvas.width, H = canvas.height;
    const plotW = W - MARGIN_L - MARGIN_R;
    const plotH = H - MARGIN_T - MARGIN_B;

    ctx.clearRect(0, 0, W, H);

    // --- Heatmap ---
    if (this._grid) {
      const imgData = ctx.createImageData(plotW, plotH);
      const pix = imgData.data;

      for (let py = 0; py < plotH; py++) {
        for (let px = 0; px < plotW; px++) {
          // Map pixel to grid cell
          const col = Math.floor(px / plotW * G);
          const row = Math.floor(py / plotH * G);
          const u   = this._grid[row * G + col];
          const [r, g, b] = toColor(u, this._maxAbs);
          const idx = (py * plotW + px) * 4;
          pix[idx]     = r;
          pix[idx + 1] = g;
          pix[idx + 2] = b;
          pix[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, MARGIN_L, MARGIN_T);
    } else {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(MARGIN_L, MARGIN_T, plotW, plotH);
    }

    // --- Title ---
    ctx.fillStyle = '#666';
    ctx.font = `11px Monaco, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`utility  (B=${this._batchSize})`, MARGIN_L + plotW / 2, 14);

    // --- Axes ---
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN_L, MARGIN_T, plotW, plotH);

    // --- Ticks ---
    const niceStep = (span) => {
      const raw = span / 5;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const f   = raw / mag;
      const nice = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
      return nice * mag;
    };

    const step = niceStep(2 * L);
    const firstTick = Math.ceil((-L + 1e-9) / step) * step;
    const ticks = [];
    for (let t = firstTick; t < L - 1e-9; t += step) ticks.push(t);

    ctx.fillStyle = '#444';
    ctx.font = `10px Monaco, Consolas, monospace`;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#bbb';

    // X ticks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const t of ticks) {
      const px = MARGIN_L + (t + L) / (2 * L) * plotW;
      // grid line
      ctx.beginPath(); ctx.moveTo(px, MARGIN_T); ctx.lineTo(px, MARGIN_T + plotH); ctx.stroke();
      // tick mark
      ctx.strokeStyle = '#666';
      ctx.beginPath(); ctx.moveTo(px, MARGIN_T + plotH); ctx.lineTo(px, MARGIN_T + plotH + 4); ctx.stroke();
      ctx.strokeStyle = '#bbb';
      ctx.fillText(parseFloat(t.toPrecision(6)), px, MARGIN_T + plotH + 5);
    }

    // Y ticks
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const t of ticks) {
      const py = MARGIN_T + (L - t) / (2 * L) * plotH;
      ctx.strokeStyle = '#bbb';
      ctx.beginPath(); ctx.moveTo(MARGIN_L, py); ctx.lineTo(MARGIN_L + plotW, py); ctx.stroke();
      ctx.strokeStyle = '#666';
      ctx.beginPath(); ctx.moveTo(MARGIN_L, py); ctx.lineTo(MARGIN_L - 4, py); ctx.stroke();
      ctx.strokeStyle = '#bbb';
      ctx.fillText(parseFloat(t.toPrecision(6)), MARGIN_L - 6, py);
    }

    // Axis labels
    ctx.fillStyle = '#555';
    ctx.font = `11px Monaco, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('W\u2081', MARGIN_L + plotW / 2, H - 1);

    ctx.save();
    ctx.translate(11, MARGIN_T + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'top';
    ctx.fillText('W\u2082', 0, 0);
    ctx.restore();

    // --- Neuron scatter points ---
    if (this._W && this._a) {
      const { n, d } = this._params;
      ctx.save();
      ctx.beginPath();
      ctx.rect(MARGIN_L, MARGIN_T, plotW, plotH);
      ctx.clip();
      const r = Math.max(2, Math.min(4, 200 / n));
      for (let i = 0; i < n; i++) {
        const w1 = this._W[i * d];
        const w2 = this._W[i * d + 1];
        const px = MARGIN_L + (w1 + L) / (2 * L) * plotW;
        const py = MARGIN_T  + (L - w2)  / (2 * L) * plotH;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, 2 * Math.PI);
        ctx.fillStyle   = this._a[i] > 0 ? 'rgba(200,60,50,0.75)'  : 'rgba(60,90,200,0.75)';
        ctx.strokeStyle = this._a[i] > 0 ? 'rgba(150,30,20,0.9)'   : 'rgba(30,50,150,0.9)';
        ctx.lineWidth = 0.8;
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

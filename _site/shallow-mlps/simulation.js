// ============================================================================
// SIMULATION — shallow MLP trainer, mean-field / muP parameterization
// ============================================================================
// Network:  f(x) = (1/n) * sum_i a_i * sigma(W_i . x / sqrt(d))
//           W in R^{n x d}, a in R^n
//           Init: W_ij ~ N(0,1),  a_i = 0  (muP: second layer starts at zero)
// Data:     x ~ N(0, I_d)
// Loss:     (1/2) * E[(f_hat - f*)^2]  — factor of 1/2 for clean gradient
// Training: SGD on W, a  with muP scaling (step *= n)

import { computeTarget, numCoeffTerms } from './targets.js';

const TARGET_FRAME_TIME      = 25;   // ms — target ~40fps
const STEPS_PER_SEC_WINDOW   = 60;
const STEPS_PER_SEC_INTERVAL = 250;  // ms between sps display updates

// ---- Seeded RNG (LCG + Box-Muller) ----------------------------------------
export class SeededRandom {
  constructor(seed) { this.seed = seed >>> 0; }
  next() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  randn() {
    let u, v;
    do { u = this.next(); } while (u === 0);
    do { v = this.next(); } while (v === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

const _unseeded = {
  next()  { return Math.random(); },
  randn() {
    let u, v;
    do { u = Math.random(); } while (u === 0);
    do { v = Math.random(); } while (v === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },
};

// ---- Activations -----------------------------------------------------------
export const ACTIVATIONS = {
  relu:   { f: x => x > 0 ? x : 0,   df: x => x > 0 ? 1 : 0 },
  tanh:   { f: x => Math.tanh(x),     df: x => { const c = Math.cosh(x); return 1 / (c * c); } },
  gelu: {
    f: x => {
      const t = Math.tanh(0.7978845608 * (x + 0.044715 * x * x * x));
      return 0.5 * x * (1 + t);
    },
    df: x => {
      const t = Math.tanh(0.7978845608 * (x + 0.044715 * x * x * x));
      const dt = (1 - t * t) * 0.7978845608 * (1 + 3 * 0.044715 * x * x);
      return 0.5 * (1 + t) + 0.5 * x * dt;
    },
  },
  linear: { f: x => x, df: _ => 1 },
  cos:    { f: x => Math.SQRT2 * Math.cos(x + Math.PI / 4), df: x => -Math.SQRT2 * Math.sin(x + Math.PI / 4) },
  tanh05: { f: x => Math.tanh(x + 0.5), df: x => { const c = Math.cosh(x + 0.5); return 1 / (c * c); } },
};

// Solve A x = b for x where A is T x T (row-major Float64Array), b is T-vector.
// Uses Gaussian elimination with partial pivoting. Returns plain Array of length T.
function solveSymmetric(A, b, T) {
  // Copy into working arrays
  const M = new Float64Array(T * T);
  const r = new Float64Array(T);
  for (let i = 0; i < T * T; i++) M[i] = A[i];
  for (let i = 0; i < T; i++) r[i] = b[i];

  for (let col = 0; col < T; col++) {
    // Partial pivot
    let maxVal = Math.abs(M[col * T + col]), maxRow = col;
    for (let row = col + 1; row < T; row++) {
      const v = Math.abs(M[row * T + col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxRow !== col) {
      for (let k = 0; k < T; k++) {
        const tmp = M[col * T + k]; M[col * T + k] = M[maxRow * T + k]; M[maxRow * T + k] = tmp;
      }
      const tmp = r[col]; r[col] = r[maxRow]; r[maxRow] = tmp;
    }
    const pivot = M[col * T + col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let row = col + 1; row < T; row++) {
      const f = M[row * T + col] / pivot;
      for (let k = col; k < T; k++) M[row * T + k] -= f * M[col * T + k];
      r[row] -= f * r[col];
    }
  }
  // Back-substitution
  const x = new Float64Array(T);
  for (let i = T - 1; i >= 0; i--) {
    let s = r[i];
    for (let k = i + 1; k < T; k++) s -= M[i * T + k] * x[k];
    x[i] = Math.abs(M[i * T + i]) > 1e-12 ? s / M[i * T + i] : 0;
  }
  return x;
}

export class Simulation {
  constructor() {
    this.running = false;
    this.animationFrameId = null;
    this.onFrameUpdate = null;
    this.avgStepTime = 1;
    this._lastFrameStart = null;
    this._totalSteps = 0;
    this._stepCounts = [];
    this._lastSpsUpdate = 0;
    this.stepsPerSec = 0;
    this._lastPerfLog = null;

    this.iteration = 0;
    this.lossHistory = [];
    this.normHistory = [];
    this.coeffHistory = [];  // [{x, c: [c1..cT], rem}]
    this.params = null;

    this.W = null;           // student first layer: n x d (Float64Array, row-major)
    this.a = null;           // student second layer: n
    this.preActVals = null;  // per-neuron RMS pre-activation: ||W[i,:]|| / sqrt(d)
  }

  // ---- Initialize ----------------------------------------------------------
  initialize(params) {
    this.params = { ...params };
    const { n, d, alpha, seed } = params;
    const rng = (seed != null) ? new SeededRandom(seed) : _unseeded;
    this._rng = rng;

    // Student: W ~ N(0, alpha^2), a = 0 (muP)
    this.W = new Float64Array(n * d);
    this.a = new Float64Array(n);  // zero by default
    for (let i = 0; i < n * d; i++) this.W[i] = alpha * rng.randn();

    this.iteration = 0;
    this.lossHistory = [];
    this.normHistory = [];
    this.coeffHistory = [];
    this._recordNorms();
  }

  // ---- One SGD step --------------------------------------------------------
  step() {
    const { n, d, batchSize, eta, activation, numTerms, targetType } = this.params;
    const sigma  = ACTIVATIONS[activation].f;
    const dsigma = ACTIVATIONS[activation].df;
    const sqrtD  = Math.sqrt(d);
    const nCoeff = numCoeffTerms(targetType, numTerms);

    const dW = new Float64Array(n * d);
    const da = new Float64Array(n);
    let totalLoss = 0;
    // Accumulators for coefficient and remainder computation
    const v  = new Float64Array(nCoeff);             // v = Q^T f_hat
    const G  = new Float64Array(nCoeff * nCoeff);    // G = Q^T Q
    let fHatSqSum = 0;

    for (let b = 0; b < batchSize; b++) {
      // Sample x ~ N(0, I_d)
      const x = new Float64Array(d);
      for (let j = 0; j < d; j++) x[j] = this._rng.randn();

      // Target
      const { y: yTarget, fTerms } = computeTarget(x, targetType, numTerms);

      // Student forward
      const z = new Float64Array(n);
      const h = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let zi = 0;
        const row = i * d;
        for (let j = 0; j < d; j++) zi += this.W[row + j] * x[j];
        zi /= sqrtD;
        z[i] = zi;
        h[i] = sigma(zi);
      }
      let yPred = 0;
      for (let i = 0; i < n; i++) yPred += this.a[i] * h[i];
      yPred /= n;

      const err = yPred - yTarget;
      totalLoss += 0.5 * err * err;

      // Accumulate v = Q^T f_hat, G = Q^T Q, ||f_hat||^2
      for (let j = 0; j < nCoeff; j++) {
        v[j] += yPred * fTerms[j];
        for (let k = 0; k < nCoeff; k++) {
          G[j * nCoeff + k] += fTerms[j] * fTerms[k];
        }
      }
      fHatSqSum += yPred * yPred;

      const dOut = err / batchSize;
      for (let i = 0; i < n; i++) {
        da[i] += dOut * h[i] / n;
        const coeff = dOut * (this.a[i] / n) * dsigma(z[i]) / sqrtD;
        const row = i * d;
        for (let j = 0; j < d; j++) dW[row + j] += coeff * x[j];
      }
    }

    totalLoss /= batchSize;

    // Solve G * c_ls = v for least-squares coefficients
    const c_ls = solveSymmetric(G, v, nCoeff);

    // Reported coefficients: normalize by batchSize to get E[f_hat * f*_k]
    const c = new Float64Array(nCoeff);
    for (let k = 0; k < nCoeff; k++) c[k] = v[k] / batchSize;

    // Remainder: ||f_hat||^2 - ||Pi f_hat||^2
    let projSq = 0;
    for (let k = 0; k < nCoeff; k++) projSq += c_ls[k] * v[k];
    const remSq = Math.max(0, fHatSqSum - projSq) / batchSize;

    // muP SGD: multiply by n so step size is O(eta) independent of width
    for (let i = 0; i < n; i++)     this.a[i]  -= eta * n * da[i];
    for (let i = 0; i < n * d; i++) this.W[i]  -= eta * n * dW[i];

    this.iteration++;
    this.lossHistory.push({ x: this.iteration, y: totalLoss });
    this.coeffHistory.push({ x: this.iteration, c: Array.from(c), rem: Math.sqrt(remSq) });
    this._recordNorms();
    return totalLoss;
  }

  // ---- Frobenius norms + per-direction norms + RMS pre-activations ----------
  _recordNorms() {
    const { n, d, numTerms } = this.params;

    // Total norms
    let wSq = 0;
    for (let i = 0; i < n * d; i++) wSq += this.W[i] * this.W[i];
    let aSq = 0;
    for (let i = 0; i < n; i++) aSq += this.a[i] * this.a[i];

    // Per-direction column norms: wDir[k] = ||W[:,k]|| for k=0..numTerms-1
    // "rest" = sqrt(sum_{j>=numTerms} ||W[:,j]||^2)
    const wDirSq = new Float64Array(numTerms + 1); // last entry = rest
    for (let i = 0; i < n; i++) {
      const row = i * d;
      for (let k = 0; k < numTerms; k++) {
        wDirSq[k] += this.W[row + k] * this.W[row + k];
      }
      for (let j = numTerms; j < d; j++) {
        wDirSq[numTerms] += this.W[row + j] * this.W[row + j];
      }
    }

    // RMS pre-activation: sqrt(E_x[||Wx/sqrt(d)||^2]) = ||W||_F / sqrt(n*d)
    const hRms = Math.sqrt(wSq / (n * d));

    // Per-neuron RMS pre-activation: ||W[i,:]|| / sqrt(d)
    const sqrtD = Math.sqrt(d);
    if (!this.preActVals || this.preActVals.length !== n) this.preActVals = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let rowSq = 0;
      const row = i * d;
      for (let j = 0; j < d; j++) rowSq += this.W[row + j] * this.W[row + j];
      this.preActVals[i] = Math.sqrt(rowSq) / sqrtD;
    }

    this.normHistory.push({
      x:    this.iteration,
      w1:   Math.sqrt(wSq),
      w2:   Math.sqrt(aSq),
      wDir: Array.from(wDirSq).map(Math.sqrt),
      hRms,
    });
  }

  // ---- Loop control --------------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;
    this.avgStepTime = 1;
    this._loop();
  }

  pause() {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  _updateStepsPerSec(stepsThisFrame, now) {
    this._totalSteps += stepsThisFrame;
    this._stepCounts.push([now, this._totalSteps]);
    if (this._stepCounts.length > STEPS_PER_SEC_WINDOW) this._stepCounts.shift();
    if (now - this._lastSpsUpdate < STEPS_PER_SEC_INTERVAL) return;
    this._lastSpsUpdate = now;
    if (this._stepCounts.length < 2) return;
    const [t0, s0] = this._stepCounts[0];
    const [t1, s1] = this._stepCounts[this._stepCounts.length - 1];
    this.stepsPerSec = (s1 - s0) / ((t1 - t0) / 1000);
  }

  _loop() {
    if (!this.running) return;
    const frameStart = performance.now();
    const timeBudget = TARGET_FRAME_TIME - 1.5;
    let stepsThisFrame = 0;

    while (true) {
      const elapsed = performance.now() - frameStart;
      if (elapsed + this.avgStepTime > timeBudget && stepsThisFrame > 0) break;
      const t0 = performance.now();
      this.step();
      this.avgStepTime = 0.15 * (performance.now() - t0) + 0.85 * this.avgStepTime;
      stepsThisFrame++;
    }

    this._updateStepsPerSec(stepsThisFrame, frameStart);
    if (this.onFrameUpdate) this.onFrameUpdate();

    if (!this._lastPerfLog) this._lastPerfLog = frameStart;
    if (frameStart - this._lastPerfLog > 2000) {
      this._lastPerfLog = frameStart;
      console.log(`[sim] iter=${this.iteration} steps/frame=${stepsThisFrame} avgStepTime=${this.avgStepTime.toFixed(2)}ms sps=${Math.round(this.stepsPerSec)}`);
    }

    this.animationFrameId = requestAnimationFrame(() => this._loop());
  }
}

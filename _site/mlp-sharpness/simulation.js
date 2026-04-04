// ============================================================================
// SIMULATION — nonlinear MLP regression with sharpness tracking
// ============================================================================
// Network:  depth-L MLP, 1D input, 1D output, hidden dim n
//   depth=2: x -> W1(n×1) -> σ -> W2(1×n) -> output   (one hidden layer)
//   depth=3: two hidden layers, etc.
//
// SP (standard parameterization):
//   Init:    W^(l) ~ N(0, σ²/n_{in})  all layers  (fan-in scaling)
//   Updates: ΔW^(l) = -η * ∇_{W^(l)} L            all layers
//
// muP parameterization:
//   Init:    W^(l) ~ N(0, σ²/n_{in})  for hidden layers
//            W^(out) = 0               for output layer
//   Updates: ΔW^(l) = -η * n_{in} * ∇_{W^(l)} L   for hidden layers
//            ΔW^(out) = -η * ∇_{W^(out)} L          for output layer
//
// Centering: when enabled, f̃(x;θ) = f(x;θ) - f(x;θ_0) where θ_0 is
//   the initial weights. Since θ_0 is fixed, ∂f̃/∂θ = ∂f/∂θ — the
//   gradient computation is unchanged except the residuals use f̃.
//
// Loss: L = (1/N) sum_i (f̃(x_i) - y_i)^2   [full-batch]
//
// Hessian: top-k eigenpairs via Lanczos + centered finite-diff HVPs
// ============================================================================

const TARGET_FRAME_TIME      = 25;
const STEPS_PER_SEC_WINDOW   = 60;
const STEPS_PER_SEC_INTERVAL = 250;
const HVP_EPS                = 1e-5;
const LANCZOS_ITER           = 40;
const TOP_K                  = 5;
const BOT_K                  = 3;

// ---- Activations -----------------------------------------------------------
export const ACTIVATIONS = {
  relu:   { f: x => x > 0 ? x : 0,    df: x => x > 0 ? 1 : 0 },
  tanh:   { f: x => Math.tanh(x),      df: x => { const c = Math.cosh(x); return 1/(c*c); } },
  gelu:   {
    f: x => {
      const t = Math.tanh(0.7978845608*(x + 0.044715*x*x*x));
      return 0.5*x*(1+t);
    },
    df: x => {
      const t  = Math.tanh(0.7978845608*(x + 0.044715*x*x*x));
      const dt = (1-t*t)*0.7978845608*(1 + 3*0.044715*x*x);
      return 0.5*(1+t) + 0.5*x*dt;
    },
  },
  linear: { f: x => x, df: _ => 1 },
};

// ---- Target functions ------------------------------------------------------
export function computeTarget(x, targetType, degree) {
  switch (targetType) {
    case 'chebyshev': return chebyshev(x, degree);
    case 'sinusoid':  return Math.sin(degree * Math.PI * x);
    case 'monomial':  return Math.pow(x, degree);
    default:          return 0;
  }
}

function chebyshev(x, n) {
  if (n === 0) return 1;
  if (n === 1) return x;
  let t0 = 1, t1 = x;
  for (let k = 2; k <= n; k++) { const t2 = 2*x*t1 - t0; t0 = t1; t1 = t2; }
  return t1;
}

// ---- Vector helpers --------------------------------------------------------
function vecDot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]*b[i]; return s; }
function vecNorm(a)   { return Math.sqrt(vecDot(a, a)); }

// ---- RNG -------------------------------------------------------------------
const _rng = {
  randn() {
    let u, v;
    do { u = Math.random(); } while (u === 0);
    do { v = Math.random(); } while (v === 0);
    return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
  }
};

// ============================================================================
// MLP STRUCTURE
// ============================================================================
// params.layers: array of layer descriptors built from depth/hiddenDim/useBias
// Each layer: { W: Float64Array(nOut×nIn), b: Float64Array(nOut)|null, nIn, nOut, isOutput }

function buildLayerDims(depth, hiddenDim) {
  // Returns array of [nIn, nOut, isOutput]
  // depth=2: [1,hiddenDim], [hiddenDim,1]
  // depth=3: [1,h], [h,h], [h,1]
  const dims = [];
  for (let l = 0; l < depth; l++) {
    const nIn  = l === 0           ? 1         : hiddenDim;
    const nOut = l === depth - 1   ? 1         : hiddenDim;
    dims.push({ nIn, nOut, isOutput: l === depth - 1 });
  }
  return dims;
}

function initWeights(depth, hiddenDim, initScale, useBias, parameterization) {
  const dims = buildLayerDims(depth, hiddenDim);
  const isMuP = parameterization === 'mup';
  return dims.map(({ nIn, nOut, isOutput }) => {
    const W = new Float64Array(nOut * nIn);
    if (!(isMuP && isOutput)) {
      const std = initScale / Math.sqrt(nIn);
      for (let i = 0; i < W.length; i++) W[i] = std * _rng.randn();
    }
    const b = useBias ? Float64Array.from({length: nOut}, () => _rng.randn()) : null;
    return { W, b, nIn, nOut, isOutput };
  });
}

// ============================================================================
// FORWARD PASS
// Returns { output: number, preActs: Float64Array[], acts: Float64Array[] }
// preActs[l] = pre-activation vector at layer l (length nOut_l)
// acts[l]    = post-activation vector at layer l (input to next layer)
// acts[-1] = [x] (the input)
// ============================================================================
function forward(layers, activation, x) {
  const sigma = ACTIVATIONS[activation].f;
  let h = new Float64Array([x]);  // input

  const preActs = [];
  const acts    = [h];  // acts[0] = input

  for (let l = 0; l < layers.length; l++) {
    const { W, b, nIn, nOut, isOutput } = layers[l];
    const pre = new Float64Array(nOut);
    for (let i = 0; i < nOut; i++) {
      let s = b ? b[i] : 0;
      for (let j = 0; j < nIn; j++) s += W[i*nIn + j] * h[j];
      pre[i] = s;
    }
    preActs.push(pre);

    if (isOutput) {
      acts.push(pre);  // no activation on output
    } else {
      const post = new Float64Array(nOut);
      for (let i = 0; i < nOut; i++) post[i] = sigma(pre[i]);
      acts.push(post);
    }
    h = acts[acts.length - 1];
  }

  return { output: h[0], preActs, acts };
}

// ============================================================================
// GRADIENT COMPUTATION (pure, no side effects)
// Returns flat Float64Array of all gradients: [vec(dW_1), vec(db_1), ..., vec(dW_L), vec(db_L)]
// Also returns loss.
// ============================================================================
// initYs: optional Float64Array of f(x_i; θ_0) — when provided, residuals
// use (f(x_i;θ) - initYs[i] - ys[i]) instead of (f(x_i;θ) - ys[i]).
// Since initYs doesn't depend on current θ, no gradient correction needed.
function computeGradAndLoss(layers, activation, xs, ys, initYs = null) {
  const dsigma = ACTIVATIONS[activation].df;
  const N = xs.length;

  // Accumulate gradients
  const dWs = layers.map(l => new Float64Array(l.nOut * l.nIn));
  const dBs = layers.map(l => l.b ? new Float64Array(l.nOut) : null);

  let totalLoss = 0;

  for (let s = 0; s < N; s++) {
    const { output, preActs, acts } = forward(layers, activation, xs[s]);
    const err = output - (initYs ? initYs[s] : 0) - ys[s];
    totalLoss += err * err;

    // Backprop: delta[l] = dL/d(pre_l)
    const deltas = new Array(layers.length);

    for (let l = layers.length - 1; l >= 0; l--) {
      const { nIn, nOut, isOutput } = layers[l];
      deltas[l] = new Float64Array(nOut);

      if (isOutput) {
        deltas[l][0] = (2 / N) * err;
      } else {
        const { W: Wn, nIn: nIn1 } = layers[l+1];
        for (let i = 0; i < nOut; i++) {
          let s2 = 0;
          for (let j = 0; j < layers[l+1].nOut; j++) {
            s2 += Wn[j*nIn1 + i] * deltas[l+1][j];
          }
          deltas[l][i] = s2 * dsigma(preActs[l][i]);
        }
      }

      const hIn = acts[l];
      for (let i = 0; i < nOut; i++) {
        for (let j = 0; j < nIn; j++) {
          dWs[l][i*nIn + j] += deltas[l][i] * hIn[j];
        }
        if (dBs[l]) dBs[l][i] += deltas[l][i];
      }
    }
  }

  totalLoss /= N;

  // Pack into flat vector
  const p = flatSize(layers);
  const grad = new Float64Array(p);
  let offset = 0;
  for (let l = 0; l < layers.length; l++) {
    grad.set(dWs[l], offset); offset += dWs[l].length;
    if (dBs[l]) { grad.set(dBs[l], offset); offset += dBs[l].length; }
  }
  return { grad, loss: totalLoss };
}

function flatSize(layers) {
  let p = 0;
  for (const l of layers) { p += l.W.length; if (l.b) p += l.b.length; }
  return p;
}

// Pack all weights into a flat vector
function packWeights(layers) {
  const p = flatSize(layers);
  const v = new Float64Array(p);
  let offset = 0;
  for (const l of layers) {
    v.set(l.W, offset); offset += l.W.length;
    if (l.b) { v.set(l.b, offset); offset += l.b.length; }
  }
  return v;
}

// Unpack a flat vector into a new layers array (deep copy structure)
function unpackWeights(layers, v) {
  const out = layers.map(l => ({
    W: new Float64Array(l.W.length),
    b: l.b ? new Float64Array(l.b.length) : null,
    nIn: l.nIn, nOut: l.nOut, isOutput: l.isOutput,
  }));
  let offset = 0;
  for (let l = 0; l < out.length; l++) {
    out[l].W.set(v.subarray(offset, offset + out[l].W.length)); offset += out[l].W.length;
    if (out[l].b) { out[l].b.set(v.subarray(offset, offset + out[l].b.length)); offset += out[l].b.length; }
  }
  return out;
}

// ============================================================================
// HVP via centered finite differences
// ============================================================================
function hvp(layers, activation, xs, ys, v, initYs = null) {
  const eps = HVP_EPS;
  const theta = packWeights(layers);
  const p = theta.length;

  const thetaP = new Float64Array(p);
  const thetaM = new Float64Array(p);
  for (let i = 0; i < p; i++) { thetaP[i] = theta[i] + eps*v[i]; thetaM[i] = theta[i] - eps*v[i]; }

  const lP = unpackWeights(layers, thetaP);
  const lM = unpackWeights(layers, thetaM);

  const gp = computeGradAndLoss(lP, activation, xs, ys, initYs).grad;
  const gm = computeGradAndLoss(lM, activation, xs, ys, initYs).grad;

  const result = new Float64Array(p);
  for (let i = 0; i < p; i++) result[i] = (gp[i] - gm[i]) / (2*eps);
  return result;
}

// ============================================================================
// LANCZOS (identical to dln-sharpness)
// ============================================================================
function lanczos(hvpFn, p, k) {
  const m = Math.min(LANCZOS_ITER, p);
  const Q     = new Array(m + 1);
  const alpha = new Float64Array(m);
  const beta  = new Float64Array(m);

  let q = new Float64Array(p);
  for (let i = 0; i < p; i++) q[i] = Math.random() - 0.5;
  const qn = vecNorm(q);
  for (let i = 0; i < p; i++) q[i] /= qn;
  Q[0] = q;

  let prevBeta = 0, prevQ = null;
  let mActual = m;  // actual number of Lanczos steps completed

  for (let j = 0; j < m; j++) {
    let z = hvpFn(Q[j]);
    alpha[j] = vecDot(Q[j], z);
    for (let i = 0; i < p; i++) {
      z[i] -= alpha[j] * Q[j][i];
      if (prevQ !== null) z[i] -= prevBeta * prevQ[i];
    }
    // Full re-orthogonalization
    for (let l = 0; l <= j; l++) {
      const dot = vecDot(Q[l], z);
      for (let i = 0; i < p; i++) z[i] -= dot * Q[l][i];
    }
    const betaNext = vecNorm(z);
    beta[j] = betaNext;
    if (betaNext < 1e-12 || j === m-1) { mActual = j + 1; break; }
    Q[j+1] = new Float64Array(p);
    for (let i = 0; i < p; i++) Q[j+1][i] = z[i] / betaNext;
    prevBeta = betaNext; prevQ = Q[j];
  }

  // Jacobi on mActual×mActual tridiagonal T
  const T = new Float64Array(mActual*mActual);
  for (let j = 0; j < mActual; j++) {
    T[j*mActual+j] = alpha[j];
    if (j+1 < mActual) { T[j*mActual+(j+1)] = beta[j]; T[(j+1)*mActual+j] = beta[j]; }
  }
  const D = T.slice();
  const V = new Float64Array(mActual*mActual);
  for (let i = 0; i < mActual; i++) V[i*mActual+i] = 1;

  for (let iter = 0; iter < 100*mActual*mActual; iter++) {
    let maxVal = 0, p2 = 0, q2 = 1;
    for (let i = 0; i < mActual-1; i++)
      for (let j = i+1; j < mActual; j++) {
        const v2 = Math.abs(D[i*m+j]);
        if (v2 > maxVal) { maxVal = v2; p2 = i; q2 = j; }
      }
    if (maxVal < 1e-14) break;
    const Dpp = D[p2*mActual+p2], Dqq = D[q2*mActual+q2], Dpq = D[p2*mActual+q2];
    const tau = (Dqq-Dpp)/(2*Dpq);
    const t   = Math.sign(tau)/(Math.abs(tau)+Math.sqrt(1+tau*tau));
    const c   = 1/Math.sqrt(1+t*t), s = t*c;
    D[p2*mActual+p2] = Dpp-t*Dpq; D[q2*mActual+q2] = Dqq+t*Dpq; D[p2*mActual+q2] = D[q2*mActual+p2] = 0;
    for (let r = 0; r < mActual; r++) {
      if (r===p2||r===q2) continue;
      const Drp=D[r*mActual+p2],Drq=D[r*mActual+q2];
      D[r*mActual+p2]=D[p2*mActual+r]=c*Drp-s*Drq; D[r*mActual+q2]=D[q2*mActual+r]=s*Drp+c*Drq;
    }
    for (let r = 0; r < mActual; r++) {
      const Vrp=V[r*mActual+p2],Vrq=V[r*mActual+q2];
      V[r*mActual+p2]=c*Vrp-s*Vrq; V[r*mActual+q2]=s*Vrp+c*Vrq;
    }
  }

  const pairs = [];
  for (let j = 0; j < mActual; j++) pairs.push({ val: D[j*mActual+j], col: j });
  pairs.sort((a,b) => b.val - a.val);

  const topK = Math.min(k, pairs.length);
  const values  = new Float64Array(topK);
  const vectors = new Float64Array(topK * p);

  for (let j = 0; j < topK; j++) {
    values[j] = pairs[j].val;
    const col = pairs[j].col;
    const rv = new Float64Array(p);
    for (let l = 0; l < mActual; l++) {
      const coeff = V[l*mActual+col];
      if (Math.abs(coeff) < 1e-15) continue;
      for (let i = 0; i < p; i++) rv[i] += coeff * Q[l][i];
    }
    const rn = vecNorm(rv);
    if (rn > 1e-12) for (let i = 0; i < p; i++) rv[i] /= rn;
    vectors.set(rv, j*p);
  }

  // Bottom-k eigenvalues smallest-first; pairs is sorted descending so reverse from end
  const botK = Math.min(BOT_K, pairs.length);
  const bottomValues = new Float64Array(botK);
  for (let j = 0; j < botK; j++)
    bottomValues[j] = pairs[pairs.length - 1 - j].val;

  return { values, vectors, bottomValues };
}

// ============================================================================
// SIMULATION CLASS
// ============================================================================
export class Simulation {
  constructor() {
    this.running          = false;
    this.animationFrameId = null;
    this.onFrameUpdate    = null;
    this.avgStepTime      = 1;
    this._totalSteps      = 0;
    this._stepCounts      = [];
    this._lastSpsUpdate   = 0;
    this.stepsPerSec      = 0;
    this._lastPerfLog     = null;

    this.iteration      = 0;
    this.invertDynamics = false;  // live flag — negates η each step
    this.params         = null;
    this.layers         = null;  // array of layer objects
    this.xs          = null;  // training inputs Float64Array(N)
    this.ys          = null;  // training targets Float64Array(N)
    this.initYs      = null;  // f(x_i; θ_0) when centering enabled, else null
    this.initLayers  = null;  // frozen copy of initial weights for evaluate()

    this.lossHistory      = [];
    this.sharpnessHistory = [];
    this.weightNormHistory = [];
  }

  initialize(params) {
    this.params = { ...params };
    const { depth, hiddenDim, initScale, useBias, targetType, targetDegree, nPoints, activation } = params;

    // Build dataset: N equally spaced points on [-1, 1]
    this.xs = new Float64Array(nPoints);
    this.ys = new Float64Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      const x = nPoints > 1 ? -1 + (2*i)/(nPoints-1) : 0;
      this.xs[i] = x;
      this.ys[i] = computeTarget(x, targetType, targetDegree);
    }

    this.layers = initWeights(depth, hiddenDim, initScale, useBias, params.parameterization);

    // Centering: store frozen initial weights and f(x_i; θ_0)
    if (params.centered) {
      this.initLayers = unpackWeights(this.layers, packWeights(this.layers));
      this.initYs = new Float64Array(nPoints);
      for (let i = 0; i < nPoints; i++)
        this.initYs[i] = forward(this.layers, activation, this.xs[i]).output;
    } else {
      this.initLayers = null;
      this.initYs = null;
    }

    this.iteration        = 0;
    this.lossHistory      = [];
    this.sharpnessHistory = [];
    this.weightNormHistory = [];

    this._recordStats();
  }

  // ---- One full-batch GD step ----------------------------------------------
  step() {
    const { activation, parameterization } = this.params;
    const eta = this.params.eta * (this.invertDynamics ? -1 : 1);
    const isMuP = parameterization === 'mup';
    const { grad, loss } = computeGradAndLoss(this.layers, activation, this.xs, this.ys, this.initYs);

    let offset = 0;
    for (let l = 0; l < this.layers.length; l++) {
      const layer = this.layers[l];
      const scale = (isMuP && !layer.isOutput) ? layer.nIn : 1;

      for (let i = 0; i < layer.W.length; i++) {
        layer.W[i] -= eta * scale * grad[offset + i];
      }
      offset += layer.W.length;

      if (layer.b) {
        for (let i = 0; i < layer.b.length; i++) {
          layer.b[i] -= eta * grad[offset + i];
        }
        offset += layer.b.length;
      }
    }

    this.iteration++;
    this.lossHistory.push({ x: this.iteration, y: loss });
    this._recordStats();
    return loss;
  }

  // ---- Evaluate network on a grid of x values (for function plot) ----------
  evaluate(xs) {
    const { activation } = this.params;
    const ys = new Float64Array(xs.length);
    for (let i = 0; i < xs.length; i++) {
      const y = forward(this.layers, activation, xs[i]).output;
      const y0 = this.initLayers ? forward(this.initLayers, activation, xs[i]).output : 0;
      ys[i] = y - y0;
    }
    return ys;
  }

  // ---- Compute sharpness ---------------------------------------------------
  computeSharpness() {
    if (!this.params || !this.layers) return;
    const { activation } = this.params;
    const p = flatSize(this.layers);
    const hvpFn = (v) => hvp(this.layers, activation, this.xs, this.ys, v, this.initYs);
    const result = lanczos(hvpFn, p, TOP_K);
    this.sharpnessHistory.push({ x: this.iteration, values: result.values, vectors: result.vectors, bottomValues: result.bottomValues });
  }

  // ---- Record weight norms per layer --------------------------------------
  _recordStats() {
    const norms = this.layers.map(l => {
      let s = 0;
      for (let i = 0; i < l.W.length; i++) s += l.W[i]*l.W[i];
      if (l.b) for (let i = 0; i < l.b.length; i++) s += l.b[i]*l.b[i];
      return Math.sqrt(s);
    });
    this.weightNormHistory.push({ x: this.iteration, norms });
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
    const [t0,s0] = this._stepCounts[0];
    const [t1,s1] = this._stepCounts[this._stepCounts.length-1];
    this.stepsPerSec = (s1-s0)/((t1-t0)/1000);
  }

  _loop() {
    if (!this.running) return;
    const frameStart = performance.now();
    const timeBudget = TARGET_FRAME_TIME - 1.5;
    let stepsThisFrame = 0;

    const maxSps = this.params.maxStepsPerSec;
    const frameStepCap = isFinite(maxSps)
      ? Math.max(1, Math.round(maxSps * TARGET_FRAME_TIME / 1000))
      : Infinity;

    while (true) {
      if (stepsThisFrame >= frameStepCap) break;
      const elapsed = performance.now() - frameStart;
      if (elapsed + this.avgStepTime > timeBudget && stepsThisFrame > 0) break;
      const t0 = performance.now();
      this.step();
      this.avgStepTime = 0.15*(performance.now()-t0) + 0.85*this.avgStepTime;
      stepsThisFrame++;
    }

    // Sharpness every hessianInterval steps
    const interval = this.params.hessianInterval;
    if (interval > 0) {
      const lastComputed = this.sharpnessHistory.length > 0
        ? this.sharpnessHistory[this.sharpnessHistory.length-1].x : -Infinity;
      const nextDue = Math.ceil((lastComputed+1)/interval)*interval;
      if (this.iteration >= nextDue && this.iteration > lastComputed) this.computeSharpness();
    }

    this._updateStepsPerSec(stepsThisFrame, frameStart);
    if (this.onFrameUpdate) this.onFrameUpdate();

    if (!this._lastPerfLog) this._lastPerfLog = frameStart;
    if (frameStart - this._lastPerfLog > 2000) {
      this._lastPerfLog = frameStart;
      console.log(`[mlp] iter=${this.iteration} steps/frame=${stepsThisFrame} avgStepTime=${this.avgStepTime.toFixed(2)}ms sps=${Math.round(this.stepsPerSec)}`);
    }

    this.animationFrameId = requestAnimationFrame(() => this._loop());
  }
}

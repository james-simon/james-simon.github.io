// ============================================================================
// SIMULATION — deep linear network matrix factorization
// ============================================================================
// Task:  minimize L = ||M - M*||_F^2  where  M = W_1 W_2 ... W_L
//        All W_k are n×n.  M* is a fixed random n×n target.
//        Full-batch gradient descent (no data, no sampling).
//
// Gradient:
//   Let E = M - M*,  L_k = W_1...W_{k-1},  R_k = W_{k+1}...W_L
//   dL/dW_k = 2 * L_k^T * E * R_k^T
//
// Hessian (Hessian-vector products via centered finite differences):
//   Hv ≈ [grad(θ + ε*v) - grad(θ - ε*v)] / (2ε)
//   Top eigenpairs found via Lanczos iteration.
// ============================================================================

const TARGET_FRAME_TIME      = 25;   // ms — target ~40 fps
const STEPS_PER_SEC_WINDOW   = 60;
const STEPS_PER_SEC_INTERVAL = 250;

const HVP_EPS      = 1e-5;   // finite-difference step for HVPs
const LANCZOS_ITER = 40;     // Lanczos iterations (overkill for p≤400, cheap)
const TOP_K        = 5;      // number of top eigenpairs to report

// ---- Matrix helpers (row-major Float64Array, all n×n) ----------------------

// C = A * B  (n×n)
function matMul(A, B, n) {
  const C = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const aik = A[i * n + k];
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) C[i * n + j] += aik * B[k * n + j];
    }
  }
  return C;
}

// C = A^T * B  (n×n)
function matMulTB(A, B, n) {
  const C = new Float64Array(n * n);
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      const aki = A[k * n + i];
      if (aki === 0) continue;
      for (let j = 0; j < n; j++) C[i * n + j] += aki * B[k * n + j];
    }
  }
  return C;
}

// C = A * B^T  (n×n)
function matMulBT(A, B, n) {
  const C = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += A[i * n + k] * B[j * n + k];
      C[i * n + j] = s;
    }
  }
  return C;
}

// Frobenius norm squared
function frobSq(A) {
  let s = 0;
  for (let i = 0; i < A.length; i++) s += A[i] * A[i];
  return s;
}

// Frobenius norm
function frob(A) { return Math.sqrt(frobSq(A)); }

// A - B in-place into A
function matSub(A, B) {
  for (let i = 0; i < A.length; i++) A[i] -= B[i];
}

// Random normal matrix
function randNormal(n, scale, rng) {
  const A = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) A[i] = scale * rng.randn();
  return A;
}

// ---- Vector helpers (plain Float64Arrays of arbitrary length p) ------------

function vecDot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function vecNorm(a) { return Math.sqrt(vecDot(a, a)); }

function vecScale(a, s) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * s;
  return out;
}

function vecAdd(a, b) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

function vecSub(a, b) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] - b[i];
  return out;
}

// ---- Seeded RNG (LCG + Box-Muller) -----------------------------------------
class SeededRandom {
  constructor(seed) { this.seed = (seed >>> 0) || 1; }
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
  randn() {
    let u, v;
    do { u = Math.random(); } while (u === 0);
    do { v = Math.random(); } while (v === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },
};

// ---- SVD via Jacobi (for n×n matrices, n≤10) --------------------------------
function svd(A, n) {
  // B = A^T A  (symmetric)
  const B = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += A[k * n + i] * A[k * n + j];
      B[i * n + j] = s;
    }

  const D = B.slice();
  for (let iter = 0; iter < 100 * n * n; iter++) {
    let maxVal = 0, p = 0, q = 1;
    for (let i = 0; i < n - 1; i++)
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(D[i * n + j]);
        if (v > maxVal) { maxVal = v; p = i; q = j; }
      }
    if (maxVal < 1e-14) break;
    const Dpp = D[p * n + p], Dqq = D[q * n + q], Dpq = D[p * n + q];
    const tau = (Dqq - Dpp) / (2 * Dpq);
    const t   = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const c   = 1 / Math.sqrt(1 + t * t);
    const s   = t * c;
    D[p * n + p] = Dpp - t * Dpq;
    D[q * n + q] = Dqq + t * Dpq;
    D[p * n + q] = D[q * n + p] = 0;
    for (let r = 0; r < n; r++) {
      if (r === p || r === q) continue;
      const Drp = D[r * n + p], Drq = D[r * n + q];
      D[r * n + p] = D[p * n + r] = c * Drp - s * Drq;
      D[r * n + q] = D[q * n + r] = s * Drp + c * Drq;
    }
  }
  const svs = [];
  for (let i = 0; i < n; i++) svs.push(Math.sqrt(Math.max(0, D[i * n + i])));
  svs.sort((a, b) => b - a);
  return svs;
}

// ============================================================================
// GRADIENT COMPUTATION (pure function, no side effects)
// ============================================================================
// Returns flat Float64Array of length depth*n*n: [vec(grad_W1), ..., vec(grad_WL)]

function computeGradient(weights, target, depth, n) {
  // Product M = W_1 ... W_L
  let M = weights[0].slice();
  for (let k = 1; k < depth; k++) M = matMul(M, weights[k], n);

  // Error E = M - M*
  const E = M.slice();
  matSub(E, target);

  // Left products: leftProds[k] = W_1...W_{k-1}  (null means identity)
  const leftProds = [null];
  {
    let acc = weights[0].slice();
    for (let k = 1; k < depth; k++) {
      leftProds.push(acc.slice());
      acc = matMul(acc, weights[k], n);
    }
  }

  // Right products: rightProds[k] = W_{k+1}...W_L  (null means identity)
  const rightProds = new Array(depth);
  rightProds[depth - 1] = null;
  for (let k = depth - 2; k >= 0; k--) {
    rightProds[k] = rightProds[k + 1] === null
      ? weights[k + 1].slice()
      : matMul(weights[k + 1], rightProds[k + 1], n);
  }

  const grad = new Float64Array(depth * n * n);
  for (let k = 0; k < depth; k++) {
    let gk;
    if (leftProds[k] === null && rightProds[k] === null) {
      gk = new Float64Array(n * n);
      for (let i = 0; i < n * n; i++) gk[i] = 2 * E[i];
    } else if (leftProds[k] === null) {
      gk = matMulBT(E, rightProds[k], n);
      for (let i = 0; i < n * n; i++) gk[i] *= 2;
    } else if (rightProds[k] === null) {
      gk = matMulTB(leftProds[k], E, n);
      for (let i = 0; i < n * n; i++) gk[i] *= 2;
    } else {
      const ER = matMulBT(E, rightProds[k], n);
      gk = matMulTB(leftProds[k], ER, n);
      for (let i = 0; i < n * n; i++) gk[i] *= 2;
    }
    grad.set(gk, k * n * n);
  }
  return grad;
}

// ============================================================================
// HESSIAN-VECTOR PRODUCT (centered finite differences)
// ============================================================================
// v: Float64Array of length p = depth*n*n
// Returns H*v as Float64Array of length p

function hvp(weights, target, depth, n, v) {
  const p   = depth * n * n;
  const nn  = n * n;
  const eps = HVP_EPS;

  // θ+ = θ + ε*v,  θ- = θ - ε*v  (unpack into per-layer arrays)
  const wPlus  = [];
  const wMinus = [];
  for (let k = 0; k < depth; k++) {
    const wp = weights[k].slice();
    const wm = weights[k].slice();
    const base = k * nn;
    for (let i = 0; i < nn; i++) {
      wp[i] += eps * v[base + i];
      wm[i] -= eps * v[base + i];
    }
    wPlus.push(wp);
    wMinus.push(wm);
  }

  const gp = computeGradient(wPlus,  target, depth, n);
  const gm = computeGradient(wMinus, target, depth, n);

  // Hv ≈ (g+ - g-) / (2ε)
  const result = new Float64Array(p);
  for (let i = 0; i < p; i++) result[i] = (gp[i] - gm[i]) / (2 * eps);
  return result;
}

// ============================================================================
// LANCZOS ALGORITHM
// ============================================================================
// Returns top-k eigenpairs { values: Float64Array(k), vectors: Float64Array(k*p) }
// vectors[j*p .. (j+1)*p-1] = j-th eigenvector (unit norm)

function lanczos(hvpFn, p, k) {
  const m = Math.min(LANCZOS_ITER, p);  // number of Lanczos steps

  // Lanczos vectors Q: (m+1) x p, stored flat
  const Q      = new Array(m + 1);
  const alpha  = new Float64Array(m);    // diagonal of tridiagonal T
  const beta   = new Float64Array(m);    // subdiagonal of T (beta[j] = β_{j+1})

  // Start with a random unit vector
  let q = new Float64Array(p);
  for (let i = 0; i < p; i++) q[i] = Math.random() - 0.5;
  const qn = vecNorm(q);
  for (let i = 0; i < p; i++) q[i] /= qn;
  Q[0] = q;

  let prevBeta = 0;
  let prevQ    = null;

  for (let j = 0; j < m; j++) {
    // z = H * q_j
    let z = hvpFn(Q[j]);

    // α_j = q_j^T z
    alpha[j] = vecDot(Q[j], z);

    // z = z - α_j * q_j - β_j * q_{j-1}
    for (let i = 0; i < p; i++) {
      z[i] -= alpha[j] * Q[j][i];
      if (prevQ !== null) z[i] -= prevBeta * prevQ[i];
    }

    // Full re-orthogonalization against all previous vectors (for stability)
    for (let l = 0; l <= j; l++) {
      const dot = vecDot(Q[l], z);
      for (let i = 0; i < p; i++) z[i] -= dot * Q[l][i];
    }

    // β_{j+1} = ||z||
    const betaNext = vecNorm(z);
    beta[j] = betaNext;

    if (betaNext < 1e-12 || j === m - 1) {
      // Invariant subspace or last step — stop
      Q[j + 1] = new Float64Array(p); // dummy (won't be used)
      break;
    }

    // q_{j+1} = z / β_{j+1}
    Q[j + 1] = new Float64Array(p);
    for (let i = 0; i < p; i++) Q[j + 1][i] = z[i] / betaNext;

    prevBeta = betaNext;
    prevQ    = Q[j];
  }

  // ---- Solve the m×m symmetric tridiagonal eigenproblem via Jacobi ----------
  // Build dense m×m matrix T
  const T = new Float64Array(m * m);
  for (let j = 0; j < m; j++) {
    T[j * m + j] = alpha[j];
    if (j + 1 < m) {
      T[j * m + (j + 1)] = beta[j];
      T[(j + 1) * m + j] = beta[j];
    }
  }

  // Jacobi on T — returns eigenvalues in D_diag and eigenvectors in V
  const D = T.slice();
  const V = new Float64Array(m * m);
  for (let i = 0; i < m; i++) V[i * m + i] = 1;

  for (let iter = 0; iter < 100 * m * m; iter++) {
    let maxVal = 0, p2 = 0, q2 = 1;
    for (let i = 0; i < m - 1; i++)
      for (let j = i + 1; j < m; j++) {
        const v2 = Math.abs(D[i * m + j]);
        if (v2 > maxVal) { maxVal = v2; p2 = i; q2 = j; }
      }
    if (maxVal < 1e-14) break;
    const Dpp = D[p2 * m + p2], Dqq = D[q2 * m + q2], Dpq = D[p2 * m + q2];
    const tau = (Dqq - Dpp) / (2 * Dpq);
    const t   = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const c   = 1 / Math.sqrt(1 + t * t);
    const s   = t * c;
    D[p2 * m + p2] = Dpp - t * Dpq;
    D[q2 * m + q2] = Dqq + t * Dpq;
    D[p2 * m + q2] = D[q2 * m + p2] = 0;
    for (let r = 0; r < m; r++) {
      if (r === p2 || r === q2) continue;
      const Drp = D[r * m + p2], Drq = D[r * m + q2];
      D[r * m + p2] = D[p2 * m + r] = c * Drp - s * Drq;
      D[r * m + q2] = D[q2 * m + r] = s * Drp + c * Drq;
    }
    for (let r = 0; r < m; r++) {
      const Vrp = V[r * m + p2], Vrq = V[r * m + q2];
      V[r * m + p2] = c * Vrp - s * Vrq;
      V[r * m + q2] = s * Vrp + c * Vrq;
    }
  }

  // Collect Ritz values + project Ritz vectors back to R^p
  // eigenvalues are D[j*m+j], eigenvectors are columns of V
  const pairs = [];
  for (let j = 0; j < m; j++) {
    pairs.push({ val: D[j * m + j], col: j });
  }
  pairs.sort((a, b) => b.val - a.val);

  const topK    = Math.min(k, pairs.length);
  const values  = new Float64Array(topK);
  const vectors = new Float64Array(topK * p);

  for (let j = 0; j < topK; j++) {
    values[j] = pairs[j].val;
    const col = pairs[j].col;

    // Ritz vector = sum_l V[l, col] * Q[l]
    const rv = new Float64Array(p);
    for (let l = 0; l < m; l++) {
      const coeff = V[l * m + col];
      if (Math.abs(coeff) < 1e-15) continue;
      for (let i = 0; i < p; i++) rv[i] += coeff * Q[l][i];
    }
    // Normalize
    const rn = vecNorm(rv);
    if (rn > 1e-12) for (let i = 0; i < p; i++) rv[i] /= rn;
    vectors.set(rv, j * p);
  }

  return { values, vectors };
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

    this.iteration   = 0;
    this.lossHistory = [];
    this.params      = null;

    // Weight matrices W[0..L-1], each n×n Float64Array
    this.weights = null;
    // Target matrix M*, n×n
    this.target  = null;

    // History arrays
    this.productSVHistory  = [];   // [{x, svs:[]}]
    this.weightSVHistory   = [];   // array of L arrays: [{x, svs:[]}]
    this.weightNormHistory = [];   // [{x, norms:[]}]
    this.sharpnessHistory  = [];   // [{x, values: Float64Array(k), vectors: Float64Array(k*p)}]
  }

  // ---- Initialize -----------------------------------------------------------
  initialize(params) {
    this.params = { ...params };
    const { depth, width, initScale } = params;
    const n = width;

    // Random target M*
    this.target = randNormal(n, 1.0, _unseeded);

    // Weight matrices W_k ~ N(0, initScale^2)
    this.weights = [];
    for (let k = 0; k < depth; k++)
      this.weights.push(randNormal(n, initScale, _unseeded));

    this.iteration         = 0;
    this.lossHistory       = [];
    this.productSVHistory  = [];
    this.weightSVHistory   = Array.from({ length: depth }, () => []);
    this.weightNormHistory = [];
    this.sharpnessHistory  = [];

    this._recordStats();
  }

  // ---- One gradient descent step --------------------------------------------
  step() {
    const { depth, width, eta } = this.params;
    const n = width;

    // Compute gradient and loss together
    let M = this.weights[0].slice();
    for (let k = 1; k < depth; k++) M = matMul(M, this.weights[k], n);
    const E = M.slice();
    matSub(E, this.target);
    const loss = frobSq(E);

    // Get full gradient vector and apply update
    const grad = computeGradient(this.weights, this.target, depth, n);
    const nn = n * n;
    for (let k = 0; k < depth; k++) {
      const base = k * nn;
      for (let i = 0; i < nn; i++) this.weights[k][i] -= eta * grad[base + i];
    }

    this.iteration++;
    this.lossHistory.push({ x: this.iteration, y: loss });
    this._recordStats();
    return loss;
  }

  // ---- Compute and store top-k Hessian eigenpairs --------------------------
  computeSharpness() {
    if (!this.params || !this.weights) return;
    const { depth, width } = this.params;
    const n = width;

    const hvpFn = (v) => hvp(this.weights, this.target, depth, n, v);
    const result = lanczos(hvpFn, depth * n * n, TOP_K);
    this.sharpnessHistory.push({
      x:       this.iteration,
      values:  result.values,
      vectors: result.vectors,
    });
  }

  // ---- Record SVs and norms each step --------------------------------------
  _recordStats() {
    const { depth, width } = this.params;
    const n = width;

    let M = this.weights[0].slice();
    for (let k = 1; k < depth; k++) M = matMul(M, this.weights[k], n);
    this.productSVHistory.push({ x: this.iteration, svs: svd(M, n) });

    const norms = [];
    for (let k = 0; k < depth; k++) {
      this.weightSVHistory[k].push({ x: this.iteration, svs: svd(this.weights[k], n) });
      norms.push(frob(this.weights[k]));
    }
    this.weightNormHistory.push({ x: this.iteration, norms });
  }

  // ---- Get target SVs (static) --------------------------------------------
  getTargetSVs() {
    if (!this.target || !this.params) return [];
    return svd(this.target, this.params.width);
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

    // Max steps this frame based on throttle (Infinity = no limit)
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
      this.avgStepTime = 0.15 * (performance.now() - t0) + 0.85 * this.avgStepTime;
      stepsThisFrame++;
    }

    // Compute sharpness every hessianInterval steps
    const interval = this.params.hessianInterval;
    if (interval > 0) {
      const prevIter = this.iteration - stepsThisFrame;
      const lastComputed = this.sharpnessHistory.length > 0
        ? this.sharpnessHistory[this.sharpnessHistory.length - 1].x
        : -Infinity;
      // Fire if we crossed a multiple of interval this frame
      const nextDue = Math.ceil((lastComputed + 1) / interval) * interval;
      if (this.iteration >= nextDue && this.iteration > lastComputed) {
        this.computeSharpness();
      }
    }

    this._updateStepsPerSec(stepsThisFrame, frameStart);
    if (this.onFrameUpdate) this.onFrameUpdate();

    if (!this._lastPerfLog) this._lastPerfLog = frameStart;
    if (frameStart - this._lastPerfLog > 2000) {
      this._lastPerfLog = frameStart;
      console.log(`[dln] iter=${this.iteration} steps/frame=${stepsThisFrame} avgStepTime=${this.avgStepTime.toFixed(2)}ms sps=${Math.round(this.stepsPerSec)}`);
    }

    this.animationFrameId = requestAnimationFrame(() => this._loop());
  }
}

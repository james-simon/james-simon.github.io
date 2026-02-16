// ============================================================================
// SIMULATION — teacher/student two-layer ReLU network
// ============================================================================
// Teacher: f*(x) = (1/sqrt(k)) * a*^T relu(W* x),  W* in R^{k x 2}, a* in R^k
// Student: f(x)  = (alpha/n)   * a^T  relu(W  x),  W  in R^{n x 2}, a  in R^n
// Input:   x ~ N(0, I_2)
// Loss:    MSE over minibatch
// Training: SGD on W, a (teacher fixed)

const TARGET_FRAME_TIME    = 25;   // ms — ~40fps
const MAX_STEPS_PER_SEC    = 200;  // hard cap on simulation speed
const TRACE_RENDER_POINTS  = 250;  // how many history points to expose for rendering

// ---- Seeded RNG (LCG + Box-Muller) -----------------------------------------
class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0; // force uint32
  }
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

// Unseeded fallback (used when no seed is set)
const _unseeded = {
  next() { return Math.random(); },
  randn() {
    let u, v;
    do { u = Math.random(); } while (u === 0);
    do { v = Math.random(); } while (v === 0);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },
};

function relu(x) { return x > 0 ? x : 0; }
function reluGrad(x) { return x > 0 ? 1 : 0; }

const STEPS_PER_SEC_WINDOW   = 60;  // rolling window of frame samples
const STEPS_PER_SEC_INTERVAL = 250; // ms between display updates

export class Simulation {
  constructor() {
    this.reset();
    this.onFrameUpdate = null;
    this.avgStepTime = 1;
  }

  reset() {
    this.running = false;
    this.animationFrameId = null;
    this.iteration = 0;
    this.lossHistory = [];
    this.weightHistory = [];
    this._lastRecordedW = null;
    this.stepsPerSec = 0;
    this._stepCounts = [];       // [timestamp, cumulativeSteps] pairs
    this._totalSteps = 0;
    this._lastSpsUpdate = 0;
    this.renderIndices = [];     // evenly-spaced indices into weightHistory for rendering
    this._renderIndicesLen = 0;  // weightHistory.length when renderIndices was last built
    this._rng = _unseeded;       // RNG (replaced by SeededRandom if seed provided)

    // Model weights (null until initialized)
    this.W  = null; // student: n x 2
    this.a  = null; // student: n
    this.Ws = null; // teacher: k x 2
    this.as = null; // teacher: k

    // Snapshot of params at start (so slider changes don't mutate mid-run)
    this.params = null;
  }

  // Initialize model weights from current params
  // params.seed: integer seed (or null for unseeded)
  initialize(params) {
    this.params = { ...params };
    const { k, n } = params;
    const rng = (params.seed != null) ? new SeededRandom(params.seed) : _unseeded;
    this._rng = rng;

    // Teacher weights — sampled once, fixed forever.
    // W*: angles uniformly spaced + small jitter, random magnitudes.
    // a*: balanced ±1, randomly shuffled.
    const angleJitterStd = Math.PI / (2 * k); // 1/4 of gap between neighbors (gap = 2π/k)
    this.Ws = Array.from({ length: k }, (_, j) => {
      const baseAngle = (2 * Math.PI * j) / k;
      const angle = baseAngle + rng.randn() * angleJitterStd;
      const mag = 1 + rng.next(); // uniform on [1, 2]
      return [mag * Math.cos(angle), mag * Math.sin(angle)];
    });
    // Balanced ±1: as equal a split as possible, with the extra (if k odd) randomly +1 or -1
    const nPos = Math.floor(k / 2) + (k % 2 === 1 && rng.next() < 0.5 ? 1 : 0);
    this.as = Array.from({ length: k }, (_, i) => (i < nPos ? 1 : -1));
    for (let i = k - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [this.as[i], this.as[j]] = [this.as[j], this.as[i]];
    }

    // Student weights — paired init so f̂(x) = 0 at init.
    // Neurons 2i and 2i+1 share the same W row; a[2i+1] = -a[2i].
    this.W = [];
    this.a = [];
    for (let i = 0; i < n; i += 2) {
      const w0 = rng.randn(), w1 = rng.randn();
      const ai = rng.randn();
      this.W.push([w0, w1]);
      this.a.push(ai);
      if (i + 1 < n) {
        this.W.push([w0, w1]);
        this.a.push(-ai);
      } else {
        // Odd n: zero out the last unpaired neuron
        this.W.push([0, 0]);
        this.a.push(0);
      }
    }

    // Snapshot of initial a signs — used for stable coloring in the plot
    this.a0signs = this.a.map(ai => ai >= 0 ? 1 : -1);

    this.iteration = 0;
    this.lossHistory = [];
    this.weightHistory = []; // array of snapshots: [[x,y], ...] per neuron
    this._lastRecordedW = null; // last W snapshot recorded, for distance gating
    this.renderIndices = [];
    this._renderIndicesLen = 0;
  }

  // Sample a batch of x ~ N(0, I_2)
  sampleBatch(batchSize) {
    const rng = this._rng || _unseeded;
    return Array.from({ length: batchSize }, () => [rng.randn(), rng.randn()]);
  }

  // Forward pass for one input x (1D array of length 2)
  teacherForward(x) {
    const { k } = this.params;
    const scale = 1 / Math.sqrt(k);
    let out = 0;
    for (let i = 0; i < k; i++) {
      const z = this.Ws[i][0] * x[0] + this.Ws[i][1] * x[1];
      out += this.as[i] * relu(z);
    }
    return scale * out;
  }

  studentForward(x) {
    const { n, alpha } = this.params;
    const scale = alpha / n;
    let out = 0;
    for (let i = 0; i < n; i++) {
      const z = this.W[i][0] * x[0] + this.W[i][1] * x[1];
      out += this.a[i] * relu(z);
    }
    return scale * out;
  }

  // One SGD step — reads eta dynamically from params (allows live slider)
  step(eta, batchSize) {
    const { n, alpha } = this.params;
    const scale = alpha / n;
    const batch = this.sampleBatch(batchSize);

    // Accumulate gradients
    const dW = Array.from({ length: n }, () => [0, 0]);
    const da = Array.from({ length: n }, () => 0);
    let totalLoss = 0;

    for (const x of batch) {
      const target = this.teacherForward(x);
      const pred   = this.studentForward(x);
      const err    = pred - target; // scalar
      totalLoss += err * err;

      // d(loss)/d(pred) = 2 * err / batchSize
      const dLoss = 2 * err / batchSize;

      // Backprop through student
      for (let i = 0; i < n; i++) {
        const z = this.W[i][0] * x[0] + this.W[i][1] * x[1];
        const h = relu(z);
        const rg = reluGrad(z);

        // d(pred)/d(a_i) = scale * h
        da[i] += dLoss * scale * h;

        // d(pred)/d(W_i) = scale * a_i * relu'(z) * x
        const coeff = dLoss * scale * this.a[i] * rg;
        dW[i][0] += coeff * x[0];
        dW[i][1] += coeff * x[1];
      }
    }

    totalLoss /= batchSize;

    // Update weights
    for (let i = 0; i < n; i++) {
      this.a[i]    -= eta * da[i];
      this.W[i][0] -= eta * dW[i][0];
      this.W[i][1] -= eta * dW[i][1];
    }

    this.iteration++;
    this.lossHistory.push({ x: this.iteration, y: totalLoss });

    // Record weight snapshot only if any neuron moved >= TRACE_EPSILON
    const TRACE_EPSILON = 0.01;
    const snap = this.W.map(w => [w[0], w[1]]);
    let shouldRecord = !this._lastRecordedW;
    if (!shouldRecord) {
      for (let i = 0; i < n && !shouldRecord; i++) {
        const dx = snap[i][0] - this._lastRecordedW[i][0];
        const dy = snap[i][1] - this._lastRecordedW[i][1];
        if (dx*dx + dy*dy >= TRACE_EPSILON * TRACE_EPSILON) shouldRecord = true;
      }
    }
    if (shouldRecord) {
      this.weightHistory.push(snap);
      this._lastRecordedW = snap;
    }

    return totalLoss;
  }

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

    // Hardcode eta: 0.1 * alpha^{-2} if alpha >= 1, else 0.1 * alpha^{-1}
    const alpha = this.params.alpha;
    const globalPrefactor = 1 + 1 / (Math.abs(Math.log10(alpha)) + 0.3);
    const eta = globalPrefactor * (alpha >= 1 ? 0.1 * Math.pow(alpha, -1.7) : 0.1 * Math.pow(alpha, -1.5));
    const batchSize = 1000;

    // How many steps are we allowed this frame based on wall time since last frame?
    const frameInterval = frameStart - (this._lastFrameStart || frameStart);
    this._lastFrameStart = frameStart;
    const maxStepsThisFrame = Math.max(1, Math.round(MAX_STEPS_PER_SEC * frameInterval / 1000));

    while (true) {
      if (stepsThisFrame >= maxStepsThisFrame) break;
      const elapsed = performance.now() - frameStart;
      if (elapsed + this.avgStepTime > timeBudget && stepsThisFrame > 0) break;

      const t0 = performance.now();
      this.step(eta, batchSize);
      const stepTime = performance.now() - t0;

      this.avgStepTime = 0.15 * stepTime + 0.85 * this.avgStepTime;
      stepsThisFrame++;
    }

    // Rebuild renderIndices if history grew
    const hlen = this.weightHistory.length;
    if (hlen !== this._renderIndicesLen) {
      this._renderIndicesLen = hlen;
      if (hlen <= TRACE_RENDER_POINTS) {
        this.renderIndices = Array.from({ length: hlen }, (_, i) => i);
      } else {
        const indices = [];
        for (let j = 0; j < TRACE_RENDER_POINTS - 1; j++) {
          indices.push(Math.round(j * (hlen - 1) / (TRACE_RENDER_POINTS - 1)));
        }
        indices.push(hlen - 1); // always include last
        this.renderIndices = indices;
      }
    }

    const afterSteps = performance.now();
    this._updateStepsPerSec(stepsThisFrame, frameStart);
    if (this.onFrameUpdate) this.onFrameUpdate();
    const afterUpdate = performance.now();

    // Log timing breakdown every 2 seconds
    if (!this._lastPerfLog) this._lastPerfLog = frameStart;
    if (frameStart - this._lastPerfLog > 2000) {
      this._lastPerfLog = frameStart;
      console.log(
        `[sim] iter=${this.iteration} | steps/frame=${stepsThisFrame}` +
        ` | stepTime=${this.avgStepTime.toFixed(2)}ms` +
        ` | stepsTotal=${afterSteps - frameStart.toFixed(2)}ms` +
        ` | onFrameUpdate=${(afterUpdate - afterSteps).toFixed(2)}ms` +
        ` | weightHistory.length=${this.weightHistory.length}` +
        ` | lossHistory.length=${this.lossHistory.length}`
      );
    }

    this.animationFrameId = requestAnimationFrame(() => this._loop());
  }
}

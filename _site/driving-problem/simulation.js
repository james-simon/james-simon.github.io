// ============================================================================
// SIMULATION
// ============================================================================
// Process: at each step, sample x, compute g(x) with optimal sign,
// then move theta by the projection of (theta* - theta) onto g-hat:
//
//   alpha* = <delta_theta, g-hat>          (scalar)
//   theta  <- theta + alpha* * g-hat
//
// This is the unique step along g-hat that minimally distances to theta*.
// New distance: ||delta_theta_new|| = ||delta_theta|| * |sin(angle(g, delta_theta))|
// ============================================================================

import { MLP } from './mlp.js';

const TARGET_FRAME_MS   = 25;   // ~40 fps
const SPS_WINDOW        = 60;
const SPS_INTERVAL_MS   = 250;
const HEATMAP_INTERVAL  = 100;  // rerender weight matrices every N steps

const N_HIST = 1000;   // cosine histogram rolling window

export class Simulation {
  constructor() {
    this.mlp         = null;
    this.thetaStar   = null;   // Float64Array, flat params of target network
    this.running     = false;
    this._rafId      = null;
    this.iteration   = 0;
    this.stepsPerSec = 0;

    // histories
    this.distHistory    = [];   // {x, y} — ||delta_theta|| over time
    this.cosSimHistory  = [];   // rolling last N_HIST cosines

    // callbacks / providers set by app
    this.onFrameUpdate   = null;
    this.onHeatmapUpdate = null;
    this.xProvider       = null;   // (mlp, delta) => x, or null for random

    this._totalSteps  = 0;
    this._spsCounts   = [];
    this._lastSpsUpdate = 0;
    this._avgStepTime = 1;
    this._lastHeatmap = 0;
  }

  // ---- Init -----------------------------------------------------------------

  initialize(din, dh, dout, act, bias, depth) {
    this.mlp = new MLP(din, dh, dout, act, bias, depth);
    const target = new MLP(din, dh, dout, act, bias, depth);
    this.thetaStar = target.flatParams();

    this.iteration      = 0;
    this.distHistory    = [];
    this.ddistHistory   = [];
    this.cosSimHistory  = [];
    this.projHistory    = [];
    this._lastHeatmap   = 0;
    this._diag          = null;

    this._recordDist();
  }

  // ---- Core step ------------------------------------------------------------

  step() {
    const { mlp, thetaStar } = this;
    const theta     = mlp.flatParams();
    const delta     = vecSub(thetaStar, theta);   // theta* - theta

    // xProvider is set by app when using optimized x mode
    const x = this.xProvider ? this.xProvider(mlp, delta) : mlp.sampleX(this._xDist, this._xSigma);
    const { g, cosSim } = mlp.gradientBestSign(x, delta);

    // alpha* = <delta, g-hat>  — g is already unit-norm from gradientBestSign
    // Actually gradientBestSign returns the raw (sign-flipped) gradient, not unit.
    // Compute g-hat explicitly.
    const gNorm = vecNorm(g);
    if (gNorm < 1e-15) return cosSim;

    const dist  = vecNorm(delta);
    const gHat  = vecScale(g, 1 / gNorm);
    const alpha = vecDot(delta, gHat);   // = ||delta|| * cosSim, always >= 0

    // theta <- theta + alpha * gHat
    const newTheta = new Float64Array(theta.length);
    for (let i = 0; i < theta.length; i++) newTheta[i] = theta[i] + alpha * gHat[i];
    mlp.setFlatParams(newTheta);

    this.iteration++;

    this.cosSimHistory.push(cosSim);
    this.projHistory.push(dist * cosSim * cosSim);

    this._recordDist();
    return cosSim;
  }

  _recordDist() {
    const theta = this.mlp.flatParams();
    const delta = vecSub(this.thetaStar, theta);
    const dist  = vecNorm(delta);
    const prev  = this.distHistory.length > 0
      ? this.distHistory[this.distHistory.length - 1] : dist;
    this.distHistory.push(dist);
    if (this.iteration > 0)
      this.ddistHistory.push(dist - prev);
  }

  // ---- Current delta_theta --------------------------------------------------

  deltaTheta() {
    return vecSub(this.thetaStar, this.mlp.flatParams());
  }

  // ---- Loop control ---------------------------------------------------------

  start(xDist, xSigma, maxStepsPerSec) {
    if (this.running) return;
    this._xDist          = xDist;
    this._xSigma         = xSigma;
    this._maxStepsPerSec = maxStepsPerSec;
    this.running         = true;
    this._avgStepTime    = 1;
    this._loop();
  }

  pause() {
    this.running = false;
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  _loop() {
    if (!this.running) return;
    const frameStart = performance.now();
    const budget     = TARGET_FRAME_MS - 1.5;

    const maxSps   = this._maxStepsPerSec;
    const frameCap = isFinite(maxSps)
      ? Math.max(1, Math.round(maxSps * TARGET_FRAME_MS / 1000))
      : Infinity;

    let steps = 0;
    while (true) {
      if (steps >= frameCap) break;
      const elapsed = performance.now() - frameStart;
      if (elapsed + this._avgStepTime > budget && steps > 0) break;
      const t0 = performance.now();
      this.step();
      this._avgStepTime = 0.15 * (performance.now() - t0) + 0.85 * this._avgStepTime;
      steps++;
    }
    const afterSteps = performance.now();

    this._updateSps(steps, frameStart);

    const needHeatmap = (this.iteration - this._lastHeatmap) >= HEATMAP_INTERVAL;
    let heatmapMs = 0;
    if (needHeatmap) {
      this._lastHeatmap = this.iteration;
      const t0 = performance.now();
      if (this.onHeatmapUpdate) this.onHeatmapUpdate();
      heatmapMs = performance.now() - t0;
    }

    const beforeFrame = performance.now();
    if (this.onFrameUpdate) this.onFrameUpdate();
    const frameUpdateMs = performance.now() - beforeFrame;

    // Diagnostics: accumulate and log every 5 seconds
    if (!this._diag) this._diag = { frames: 0, stepMs: 0, frameMs: 0, heatmapMs: 0, stepsTotal: 0, lastLog: frameStart, startTime: frameStart };
    const d = this._diag;
    d.frames++;
    d.stepMs     += afterSteps - frameStart;
    d.frameMs    += frameUpdateMs;
    d.heatmapMs  += heatmapMs;
    d.stepsTotal += steps;
    const elapsed = frameStart - d.startTime;
    const logInterval = elapsed < 2000 ? 250 : 5000;
    if (frameStart - d.lastLog > logInterval) {
      const f = d.frames;
      const stepMs    = d.stepMs / f;
      const plotMs    = d.frameMs / f;
      const totalMs   = stepMs + plotMs;
      const plotPct   = totalMs > 0 ? (plotMs / totalMs * 100).toFixed(0) : '?';
      console.log(
        `[perf] iter=${this.iteration} | `+
        `sim=${stepMs.toFixed(1)}ms/frame  plot=${plotMs.toFixed(1)}ms/frame  (${plotPct}% plotting) | `+
        `steps/frame=${(d.stepsTotal/f).toFixed(0)}  sps=${Math.round(this.stepsPerSec).toLocaleString()} | `+
        `histLen=${this.distHistory.length}`
      );
      d.frames = d.stepMs = d.frameMs = d.heatmapMs = d.stepsTotal = 0;
      d.lastLog = frameStart;
    }

    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _updateSps(steps, now) {
    this._totalSteps += steps;
    this._spsCounts.push([now, this._totalSteps]);
    if (this._spsCounts.length > SPS_WINDOW) this._spsCounts.shift();
    if (now - this._lastSpsUpdate < SPS_INTERVAL_MS) return;
    this._lastSpsUpdate = now;
    if (this._spsCounts.length < 2) return;
    const [t0, s0] = this._spsCounts[0];
    const [t1, s1] = this._spsCounts[this._spsCounts.length - 1];
    this.stepsPerSec = (s1 - s0) / ((t1 - t0) / 1000);
  }
}

// ---- Vector helpers ---------------------------------------------------------

function vecDot(a, b) {
  let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s;
}
function vecNorm(a) { return Math.sqrt(vecDot(a, a)); }
function vecSub(a, b) {
  const o = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] - b[i];
  return o;
}
function vecScale(a, s) {
  const o = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] * s;
  return o;
}

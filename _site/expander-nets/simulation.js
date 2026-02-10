// ============================================================================
// SIMULATION - Main training loop controller
// ============================================================================

import { ExpanderNet } from './model.js';
import { TargetFunction } from './target.js';
import { Trainer } from './training.js';
import { solveODE } from '../low-dim-flows/api.js';
import { calculateAllTheory } from './core/theory.js';

export class Simulation {
  constructor() {
    this.isRunning = false;
    this.iteration = 0;
    this.lossHistory = [];
    this.normHistory = [];
    this.theoryLossHistory = [];  // ODE theory prediction
    this.params = null;
    this.model = null;
    this.target = null;
    this.trainer = null;
    this.animationFrameId = null;

    // Callback for chart updates
    this.onFrameUpdate = null;

    // Steps per second tracking
    this.stepCounts = [];  // Track [timestamp, cumulativeSteps] pairs
    this.totalSteps = 0;
    this.STEPS_PER_SEC_WINDOW = 60;
    this.lastStepsPerSecUpdate = 0;
    this.STEPS_PER_SEC_UPDATE_INTERVAL = 250; // Update 4x per second

    // Adaptive stepping
    this.TARGET_FRAME_TIME = 25; // Target 40 Hz (25ms per frame)
    this.avgStepTime = 0.8; // Initial estimate (ms per step) - optimistic start
    this.STEP_TIME_ALPHA = 0.15; // Exponential moving average factor - faster adaptation

    // Performance logging
    this.lastPerfLog = 0;
    this.PERF_LOG_INTERVAL = 2000; // Log every 2 seconds for debugging
  }

  // Capture current parameters from UI
  captureParams(d, k, gammas, alphas, eta, batchSize, fStar, c) {
    this.params = {
      d: d,
      k: k,
      gammas: [...gammas],
      alphas: [...alphas],
      eta: eta,
      batchSize: batchSize,
      fStar: fStar,
      c: c
    };
  }

  // Initialize model and trainer with captured params
  initialize() {
    if (!this.params) {
      throw new Error('No parameters captured. Call captureParams first.');
    }

    this.model = new ExpanderNet(this.params.d, this.params.k);
    this.target = new TargetFunction(
      this.params.alphas,
      this.params.gammas,
      this.params.fStar,
      this.params.c
    );
    this.trainer = new Trainer(
      this.model,
      this.target,
      this.params.eta,
      this.params.batchSize,
      this.params.gammas
    );

    this.iteration = 0;
    this.lossHistory = [];
    this.normHistory = [];
    this.theoryLossHistory = [];
    this.theoryNormHistory = [];

    // Record initial state at iteration 0
    const initialBatch = this.trainer.sampleBatch();
    const initialLoss = this.trainer.computeLoss(initialBatch);
    this.lossHistory.push({ iteration: 0, loss: initialLoss });

    // Track W1 diagonal elements, cross-term, and normalized W2 norm
    const w2Norm = Math.sqrt(this.frobeniusNormSq(this.model.W2));
    const dataPoint = {
      iteration: 0,
      w2NormNormalized: Math.sqrt(this.model.k) * w2Norm  // √k · ||W₂||
    };
    // Add W1 diagonal elements
    for (let i = 0; i < this.params.d; i++) {
      dataPoint[`w1_${i}`] = this.model.W1[i][i];
    }
    // Add W1 cross-term [0,1] if d >= 2
    if (this.params.d >= 2) {
      dataPoint.w1_cross = this.model.W1[0][1];
    }
    this.normHistory.push(dataPoint);

    // Run ODE theory prediction
    this.runTheoryODE();
  }

  // Run low-dim-flows ODE to get theory prediction
  runTheoryODE() {
    // Compute theory to get c and tRise
    const theory = calculateAllTheory(this.params.gammas, this.params.alphas, this.params.d);

    // Build kVec: all alphas + [1] for b
    const kVec = [...this.params.alphas, 1];

    // Build a0Vec: [1, 1, ..., 1, small_value] (d ones for a_i, small positive for b)
    // Note: b starts near 0 but must be positive for ODE solver (gradient divides by a_i)
    const a0Vec = Array(this.params.d).fill(1).concat([1e-10]);

    // Choose tMax (no cap - let user explore long-time behavior)
    const tMax = theory.tRise.isUndefined ? 100 : theory.tRise.value * 2;

    // Adaptive dt scaling: keep computational cost constant for tMax > 2000
    // by scaling dt proportionally so we always take ~200k steps
    const baseDt = 0.01;
    const dtScaleThreshold = 2000;
    const dt = tMax > dtScaleThreshold
      ? baseDt * (tMax / dtScaleThreshold)
      : baseDt;

    // Run ODE with adaptive dt
    const fStar = 1;
    const c = theory.c;
    const result = solveODE(a0Vec, kVec, tMax, fStar, c, dt);

    // Convert loss to our format: ODE time t = our t_eff, so step = t / eta
    this.theoryLossHistory = result.times.map((t, i) => ({
      iteration: t / this.params.eta,  // Convert t_eff to step
      loss: result.lossValues[i]
    }));

    // Convert parameter trajectories for norm plot
    // result.aTrajectories[i] = trajectory for parameter i (a_1, a_2, ..., a_d, b)
    this.theoryNormHistory = result.times.map((t, idx) => {
      const dataPoint = {
        iteration: t / this.params.eta
      };

      // Add W1 diagonal trajectories (a_i maps to W1_ii)
      for (let i = 0; i < this.params.d; i++) {
        dataPoint[`w1_${i}`] = result.aTrajectories[i][idx];
      }

      // Add b trajectory (just b, not scaled by sqrt(k))
      // In our model, b is scalar
      const b = result.aTrajectories[this.params.d][idx];
      dataPoint.w2NormNormalized = Math.abs(b);

      return dataPoint;
    });
  }

  // Start simulation
  start() {
    if (this.isRunning) return;

    // If no model exists, initialize
    if (!this.model) {
      this.initialize();
    }

    // Reset steps per second tracking
    this.stepCounts = [];
    this.totalSteps = 0;
    this.lastStepsPerSecUpdate = 0;
    document.getElementById('stepsPerSec').textContent = '—';

    this.isRunning = true;
    this.runLoop();
  }

  // Pause simulation
  pause() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Reset simulation
  reset() {
    this.pause();
    this.model = null;
    this.target = null;
    this.trainer = null;
    this.iteration = 0;
    this.lossHistory = [];
    this.normHistory = [];
    this.theoryLossHistory = [];
    this.theoryNormHistory = [];
    this.stepCounts = [];
    this.totalSteps = 0;
    this.lastStepsPerSecUpdate = 0;
    document.getElementById('stepsPerSec').textContent = '—';
  }

  // Compute Frobenius norm squared
  frobeniusNormSq(matrix) {
    let sum = 0;
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        sum += matrix[i][j] * matrix[i][j];
      }
    }
    return sum;
  }

  // Main training loop with adaptive stepping
  runLoop() {
    if (!this.isRunning) return;

    const frameStart = performance.now();
    let stepsThisFrame = 0;

    // Performance tracking
    let totalTrainingTime = 0;
    let totalNormTime = 0;
    let totalHistoryTime = 0;

    // Adaptively do as many steps as we can fit in our frame budget
    // Reserve minimal overhead - chart updates are fast
    const timeBudget = this.TARGET_FRAME_TIME - 1.5;

    while (true) {
      // Estimate if we have time for another step
      const elapsed = performance.now() - frameStart;
      if (elapsed + this.avgStepTime > timeBudget && stepsThisFrame > 0) {
        break; // Would exceed budget, stop here
      }

      // Perform one SGD step and measure time
      const stepStart = performance.now();
      const loss = this.trainer.step();  // Loss computed for free during gradient computation
      const stepTime = performance.now() - stepStart;
      totalTrainingTime += stepTime;

      // Update average step time estimate (exponential moving average)
      this.avgStepTime = this.STEP_TIME_ALPHA * stepTime + (1 - this.STEP_TIME_ALPHA) * this.avgStepTime;

      // Track history
      const historyStart = performance.now();
      this.iteration++;
      this.lossHistory.push({ iteration: this.iteration, loss: loss });
      const historyTime = performance.now() - historyStart;
      totalHistoryTime += historyTime;

      // Track W1 diagonals, cross-term, and W2 norm
      const normStart = performance.now();
      const w2Norm = Math.sqrt(this.frobeniusNormSq(this.model.W2));
      const dataPoint = {
        iteration: this.iteration,
        w2NormNormalized: Math.sqrt(this.model.k) * w2Norm  // √k · ||W₂||
      };
      // Add W1 diagonal elements
      for (let i = 0; i < this.params.d; i++) {
        dataPoint[`w1_${i}`] = this.model.W1[i][i];
      }
      // Add W1 cross-term [0,1] if d >= 2
      if (this.params.d >= 2) {
        dataPoint.w1_cross = this.model.W1[0][1];
      }
      this.normHistory.push(dataPoint);
      const normTime = performance.now() - normStart;
      totalNormTime += normTime;

      stepsThisFrame++;

      // Safety check: don't go too crazy
      if (stepsThisFrame >= 1000) {
        break;
      }
    }

    // Update steps per second
    const stepsPerSecStart = performance.now();
    this.updateStepsPerSec(stepsThisFrame);
    const stepsPerSecTime = performance.now() - stepsPerSecStart;

    // Update charts (if callback provided)
    const chartUpdateStart = performance.now();
    if (this.onFrameUpdate) {
      this.onFrameUpdate();
    }
    const chartUpdateTime = performance.now() - chartUpdateStart;

    const totalFrameTime = performance.now() - frameStart;

    // Log performance every 5 seconds
    if (frameStart - this.lastPerfLog > this.PERF_LOG_INTERVAL) {
      this.lastPerfLog = frameStart;

      // Get current steps/sec from UI
      const stepsPerSecText = document.getElementById('stepsPerSec').textContent;
      const currentStepsPerSec = stepsPerSecText === '—' ? 'N/A' : stepsPerSecText;

      console.log('=== Performance Report ===');
      console.log(`Iteration: ${this.iteration}, Steps/frame: ${stepsThisFrame}, Steps/sec: ${currentStepsPerSec}`);
      console.log(`Total frame time: ${totalFrameTime.toFixed(2)}ms`);
      console.log(`Training time: ${totalTrainingTime.toFixed(2)}ms (${(totalTrainingTime/totalFrameTime*100).toFixed(1)}%) = ${(totalTrainingTime/stepsThisFrame).toFixed(2)}ms/step`);
      console.log(`Norm computation: ${totalNormTime.toFixed(2)}ms (${(totalNormTime/totalFrameTime*100).toFixed(1)}%) = ${(totalNormTime/stepsThisFrame).toFixed(2)}ms/step`);
      console.log(`History push: ${totalHistoryTime.toFixed(2)}ms (${(totalHistoryTime/totalFrameTime*100).toFixed(1)}%) = ${(totalHistoryTime/stepsThisFrame).toFixed(2)}ms/step`);
      console.log(`Steps/sec update: ${stepsPerSecTime.toFixed(2)}ms (${(stepsPerSecTime/totalFrameTime*100).toFixed(1)}%)`);
      console.log(`Chart update: ${chartUpdateTime.toFixed(2)}ms (${(chartUpdateTime/totalFrameTime*100).toFixed(1)}%)`);
      console.log(`History lengths: loss=${this.lossHistory.length}, norm=${this.normHistory.length}`);
      console.log(`Avg step time estimate: ${this.avgStepTime.toFixed(2)}ms`);
      console.log(`Time per step (measured): ${(totalFrameTime/stepsThisFrame).toFixed(2)}ms`);
    }

    // Continue loop
    this.animationFrameId = requestAnimationFrame(() => this.runLoop());
  }

  // Update steps per second display
  updateStepsPerSec(stepsThisFrame) {
    const now = performance.now();
    this.totalSteps += stepsThisFrame;

    // Add current [timestamp, cumulative steps] pair
    this.stepCounts.push([now, this.totalSteps]);

    // Keep only last N data points
    if (this.stepCounts.length > this.STEPS_PER_SEC_WINDOW) {
      this.stepCounts.shift();
    }

    // Update display at most 4x per second
    if (now - this.lastStepsPerSecUpdate < this.STEPS_PER_SEC_UPDATE_INTERVAL) {
      return;
    }
    this.lastStepsPerSecUpdate = now;

    // Need at least 2 data points to compute rate
    if (this.stepCounts.length < 2) {
      return;
    }

    // Compute steps per second from oldest to newest point in window
    const [oldestTime, oldestSteps] = this.stepCounts[0];
    const [newestTime, newestSteps] = this.stepCounts[this.stepCounts.length - 1];
    const timeSpanSec = (newestTime - oldestTime) / 1000;
    const stepsDone = newestSteps - oldestSteps;
    const stepsPerSec = stepsDone / timeSpanSec;

    // Update display
    document.getElementById('stepsPerSec').textContent = Math.round(stepsPerSec).toString();
  }

  // Get current state for visualization
  getState() {
    return {
      iteration: this.iteration,
      lossHistory: this.lossHistory,
      theoryLossHistory: this.theoryLossHistory,
      normHistory: this.normHistory,
      theoryNormHistory: this.theoryNormHistory,
      isRunning: this.isRunning,
      d: this.params ? this.params.d : 3
    };
  }
}

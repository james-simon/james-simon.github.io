// ============================================================================
// SIMULATION - Main training loop controller
// ============================================================================

import { ExpanderNet } from './model.js';
import { TargetFunction } from './target.js';
import { Trainer } from './training.js';

export class Simulation {
  constructor() {
    this.isRunning = false;
    this.iteration = 0;
    this.lossHistory = [];
    this.normHistory = [];
    this.params = null;
    this.model = null;
    this.target = null;
    this.trainer = null;
    this.animationFrameId = null;

    // Callback for chart updates
    this.onFrameUpdate = null;

    // Steps per second tracking
    this.stepTimestamps = [];
    this.STEPS_PER_SEC_WINDOW = 60;
    this.lastStepsPerSecUpdate = 0;
    this.STEPS_PER_SEC_UPDATE_INTERVAL = 250; // Update 4x per second

    // Adaptive stepping
    this.TARGET_FRAME_TIME = 25; // Target 40 Hz (25ms per frame)
    this.avgStepTime = 1; // Initial estimate (ms per step)
    this.STEP_TIME_ALPHA = 0.1; // Exponential moving average factor

    // Performance logging
    this.lastPerfLog = 0;
    this.PERF_LOG_INTERVAL = 5000; // Log every 5 seconds
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

    // Record initial state at iteration 0
    const initialBatch = this.trainer.sampleBatch();
    const initialLoss = this.trainer.computeLoss(initialBatch);
    this.lossHistory.push({ iteration: 0, loss: initialLoss });

    const w1NormSq = this.frobeniusNormSq(this.model.W1);
    const w2NormSq = this.frobeniusNormSq(this.model.W2);
    this.normHistory.push({
      iteration: 0,
      w1NormSq: w1NormSq,
      w2NormSq: this.model.k * w2NormSq
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
    this.stepTimestamps = [];
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
    this.stepTimestamps = [];
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
    // Reserve a few ms for overhead (chart updates, etc.)
    const timeBudget = this.TARGET_FRAME_TIME - 3;

    while (true) {
      // Estimate if we have time for another step
      const elapsed = performance.now() - frameStart;
      if (elapsed + this.avgStepTime > timeBudget && stepsThisFrame > 0) {
        break; // Would exceed budget, stop here
      }

      // Perform one SGD step and measure time
      const stepStart = performance.now();
      const loss = this.trainer.step();
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

      // Track norms
      const normStart = performance.now();
      const w1NormSq = this.frobeniusNormSq(this.model.W1);
      const w2NormSq = this.frobeniusNormSq(this.model.W2);
      this.normHistory.push({
        iteration: this.iteration,
        w1NormSq: w1NormSq,
        w2NormSq: this.model.k * w2NormSq  // k * ||W₂||²
      });
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
      console.log(`Training time: ${totalTrainingTime.toFixed(2)}ms (${(totalTrainingTime/totalFrameTime*100).toFixed(1)}%)`);
      console.log(`Norm computation: ${totalNormTime.toFixed(2)}ms (${(totalNormTime/totalFrameTime*100).toFixed(1)}%)`);
      console.log(`History push: ${totalHistoryTime.toFixed(2)}ms (${(totalHistoryTime/totalFrameTime*100).toFixed(1)}%)`);
      console.log(`Steps/sec update: ${stepsPerSecTime.toFixed(2)}ms (${(stepsPerSecTime/totalFrameTime*100).toFixed(1)}%)`);
      console.log(`Chart update: ${chartUpdateTime.toFixed(2)}ms (${(chartUpdateTime/totalFrameTime*100).toFixed(1)}%)`);
      console.log(`History lengths: loss=${this.lossHistory.length}, norm=${this.normHistory.length}`);
      console.log(`Avg step time estimate: ${this.avgStepTime.toFixed(2)}ms`);
    }

    // Continue loop
    this.animationFrameId = requestAnimationFrame(() => this.runLoop());
  }

  // Update steps per second display
  updateStepsPerSec(stepsPerFrame) {
    const now = performance.now();

    // Add current timestamp
    this.stepTimestamps.push(now);

    // Keep only last N timestamps
    if (this.stepTimestamps.length > this.STEPS_PER_SEC_WINDOW) {
      this.stepTimestamps.shift();
    }

    // Update display at most 4x per second
    if (now - this.lastStepsPerSecUpdate < this.STEPS_PER_SEC_UPDATE_INTERVAL) {
      return;
    }
    this.lastStepsPerSecUpdate = now;

    // Need at least 2 timestamps to compute rate
    if (this.stepTimestamps.length < 2) {
      return;
    }

    // Compute steps per second (multiply by stepsPerFrame since each timestamp = stepsPerFrame steps)
    const stepsInWindow = this.stepTimestamps.length - 1;
    const timeSpanSec = (this.stepTimestamps[this.stepTimestamps.length - 1] - this.stepTimestamps[0]) / 1000;
    const stepsPerSec = (stepsInWindow / timeSpanSec) * stepsPerFrame;

    // Update display
    document.getElementById('stepsPerSec').textContent = Math.round(stepsPerSec).toString();
  }

  // Get current state for visualization
  getState() {
    return {
      iteration: this.iteration,
      lossHistory: this.lossHistory,
      normHistory: this.normHistory,
      isRunning: this.isRunning,
      d: this.params ? this.params.d : 3
    };
  }
}

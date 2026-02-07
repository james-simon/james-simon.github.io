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

  // Main training loop
  runLoop() {
    if (!this.isRunning) return;

    // Perform one SGD step
    const loss = this.trainer.step();
    this.iteration++;
    this.lossHistory.push({ iteration: this.iteration, loss: loss });

    // Track norms
    const w1NormSq = this.frobeniusNormSq(this.model.W1);
    const w2NormSq = this.frobeniusNormSq(this.model.W2);
    this.normHistory.push({
      iteration: this.iteration,
      w1NormSq: w1NormSq,
      w2NormSq: this.model.k * w2NormSq  // k * ||W₂||²
    });

    // Continue loop
    this.animationFrameId = requestAnimationFrame(() => this.runLoop());
  }

  // Get current state for visualization
  getState() {
    return {
      iteration: this.iteration,
      lossHistory: this.lossHistory,
      normHistory: this.normHistory,
      isRunning: this.isRunning
    };
  }
}

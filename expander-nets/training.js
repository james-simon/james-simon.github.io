// ============================================================================
// TRAINING - SGD updates with backpropagation
// ============================================================================

export class Trainer {
  constructor(model, target, learningRate, batchSize, gammas) {
    this.model = model;
    this.target = target;
    this.eta = learningRate;
    this.batchSize = batchSize;
    this.gammas = gammas;

    // Pre-allocate gradient arrays to avoid repeated allocation
    this.gradW1 = this.createZeros(model.d, model.d);
    this.gradW2 = this.createZeros(1, model.k);
    this.delta = new Array(model.k);
    this.WfrozTDelta = new Array(model.d);

    // Performance logging
    this.stepCount = 0;
    this.lastDetailedLog = 0;
    this.DETAILED_LOG_INTERVAL = 5000; // Log every 5 seconds
  }

  // Sample a batch of data from N(0, Γ)
  sampleBatch() {
    const batch = [];
    for (let b = 0; b < this.batchSize; b++) {
      const x = [];
      for (let i = 0; i < this.model.d; i++) {
        // Sample from N(0, γᵢ)
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        x[i] = Math.sqrt(this.gammas[i]) * z;
      }
      batch.push(x);
    }
    return batch;
  }

  // Compute loss on a batch: L = ½ E[(f* - f̂)²]
  computeLoss(batch) {
    let totalLoss = 0;
    for (const x of batch) {
      const fStar = this.target.evaluate(x);
      const fHat = this.model.forward(x).output;
      const error = fStar - fHat;
      totalLoss += 0.5 * error * error;
    }
    return totalLoss / batch.length;
  }

  // SGD step: compute gradients and update W₁ and W₂
  step() {
    const stepStartTime = performance.now();
    this.stepCount++;

    const t0 = performance.now();
    const batch = this.sampleBatch();
    const sampleTime = performance.now() - t0;

    const t1 = performance.now();
    // Zero out gradient arrays (reusing pre-allocated buffers)
    for (let i = 0; i < this.model.d; i++) {
      for (let j = 0; j < this.model.d; j++) {
        this.gradW1[i][j] = 0;
      }
    }
    for (let i = 0; i < this.model.k; i++) {
      this.gradW2[0][i] = 0;
    }
    const zeroTime = performance.now() - t1;

    const t2 = performance.now();
    let targetEvalTime = 0;
    let forwardTime = 0;
    let backpropTime = 0;

    // Accumulate gradients over batch
    for (const x of batch) {
      const te0 = performance.now();
      const fStar = this.target.evaluate(x);
      targetEvalTime += performance.now() - te0;

      const fw0 = performance.now();
      const forward = this.model.forward(x);
      const fHat = forward.output;
      forwardTime += performance.now() - fw0;

      const bp0 = performance.now();
      const error = fStar - fHat;

      // Backpropagation
      // ∂L/∂W₂ = -(f* - f̂) σ(W_froz W₁ x)ᵀ
      const activated = forward.activated;
      for (let i = 0; i < this.model.k; i++) {
        this.gradW2[0][i] += -error * activated[i];
      }

      // ∂L/∂W₁ = -(f* - f̂) W₁ᵀ W_frozᵀ diag(σ'(W_froz W₁ x)) W₂ᵀ
      // First: δ = W₂ᵀ ⊙ σ'(W_froz W₁ x)
      const WfrozW1x = forward.WfrozW1x;
      for (let i = 0; i < this.model.k; i++) {
        this.delta[i] = this.model.W2[0][i] * this.model.sigmaPrime(WfrozW1x[i]);
      }

      // Second: backprop through W_froz: W_frozᵀ δ
      for (let i = 0; i < this.model.d; i++) {
        let sum = 0;
        for (let j = 0; j < this.model.k; j++) {
          sum += this.model.Wfroz[j][i] * this.delta[j];
        }
        this.WfrozTDelta[i] = sum;
      }

      // Third: outer product with x
      for (let i = 0; i < this.model.d; i++) {
        for (let j = 0; j < this.model.d; j++) {
          this.gradW1[i][j] += -error * this.WfrozTDelta[i] * x[j];
        }
      }
      backpropTime += performance.now() - bp0;
    }
    const batchLoopTime = performance.now() - t2;

    const t3 = performance.now();
    // Average gradients over batch
    for (let i = 0; i < this.model.d; i++) {
      for (let j = 0; j < this.model.d; j++) {
        this.gradW1[i][j] /= batch.length;
      }
    }
    for (let i = 0; i < this.model.k; i++) {
      this.gradW2[0][i] /= batch.length;
    }
    const avgTime = performance.now() - t3;

    const t4 = performance.now();
    // Update weights
    // W₁ ← W₁ - η ∇W₁L
    for (let i = 0; i < this.model.d; i++) {
      for (let j = 0; j < this.model.d; j++) {
        this.model.W1[i][j] -= this.eta * this.gradW1[i][j];
      }
    }

    // W₂ ← W₂ - (η/k) ∇W₂L
    for (let i = 0; i < this.model.k; i++) {
      this.model.W2[0][i] -= (this.eta / this.model.k) * this.gradW2[0][i];
    }
    const updateTime = performance.now() - t4;

    const t5 = performance.now();
    // Compute and return loss
    const loss = this.computeLoss(batch);
    const lossTime = performance.now() - t5;

    const totalStepTime = performance.now() - stepStartTime;

    // Log detailed breakdown every 5 seconds
    const now = performance.now();
    if (now - this.lastDetailedLog > this.DETAILED_LOG_INTERVAL) {
      this.lastDetailedLog = now;
      console.log('=== Training Step Breakdown ===');
      console.log(`Step count: ${this.stepCount}`);
      console.log(`Total step time: ${totalStepTime.toFixed(3)}ms`);
      console.log(`  Sample batch: ${sampleTime.toFixed(3)}ms (${(sampleTime/totalStepTime*100).toFixed(1)}%)`);
      console.log(`  Zero grads: ${zeroTime.toFixed(3)}ms (${(zeroTime/totalStepTime*100).toFixed(1)}%)`);
      console.log(`  Batch loop: ${batchLoopTime.toFixed(3)}ms (${(batchLoopTime/totalStepTime*100).toFixed(1)}%)`);
      console.log(`    Target eval: ${targetEvalTime.toFixed(3)}ms (${(targetEvalTime/totalStepTime*100).toFixed(1)}%)`);
      console.log(`    Forward pass: ${forwardTime.toFixed(3)}ms (${(forwardTime/totalStepTime*100).toFixed(1)}%)`);
      console.log(`    Backprop: ${backpropTime.toFixed(3)}ms (${(backpropTime/totalStepTime*100).toFixed(1)}%)`);
      console.log(`  Average grads: ${avgTime.toFixed(3)}ms (${(avgTime/totalStepTime*100).toFixed(1)}%)`);
      console.log(`  Update weights: ${updateTime.toFixed(3)}ms (${(updateTime/totalStepTime*100).toFixed(1)}%)`);
      console.log(`  Compute loss: ${lossTime.toFixed(3)}ms (${(lossTime/totalStepTime*100).toFixed(1)}%)`);
    }

    return loss;
  }

  // Helper: create zero matrix
  createZeros(rows, cols) {
    const M = [];
    for (let i = 0; i < rows; i++) {
      M[i] = [];
      for (let j = 0; j < cols; j++) {
        M[i][j] = 0;
      }
    }
    return M;
  }
}

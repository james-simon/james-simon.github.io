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
    const batch = this.sampleBatch();

    // Initialize gradient accumulation
    const gradW1 = this.createZeros(this.model.d, this.model.d);
    const gradW2 = this.createZeros(1, this.model.k);

    // Accumulate gradients over batch
    for (const x of batch) {
      const fStar = this.target.evaluate(x);
      const forward = this.model.forward(x);
      const fHat = forward.output;
      const error = fStar - fHat;

      // Backpropagation
      // ∂L/∂W₂ = -(f* - f̂) σ(W_froz W₁ x)ᵀ
      const activated = forward.activated;
      for (let i = 0; i < this.model.k; i++) {
        gradW2[0][i] += -error * activated[i];
      }

      // ∂L/∂W₁ = -(f* - f̂) W₁ᵀ W_frozᵀ diag(σ'(W_froz W₁ x)) W₂ᵀ
      // First: δ = W₂ᵀ ⊙ σ'(W_froz W₁ x)
      const WfrozW1x = forward.WfrozW1x;
      const delta = [];
      for (let i = 0; i < this.model.k; i++) {
        delta[i] = this.model.W2[0][i] * this.model.sigmaPrime(WfrozW1x[i]);
      }

      // Second: backprop through W_froz: W_frozᵀ δ
      const WfrozTDelta = [];
      for (let i = 0; i < this.model.d; i++) {
        let sum = 0;
        for (let j = 0; j < this.model.k; j++) {
          sum += this.model.Wfroz[j][i] * delta[j];
        }
        WfrozTDelta[i] = sum;
      }

      // Third: outer product with x
      for (let i = 0; i < this.model.d; i++) {
        for (let j = 0; j < this.model.d; j++) {
          gradW1[i][j] += -error * WfrozTDelta[i] * x[j];
        }
      }
    }

    // Average gradients over batch
    for (let i = 0; i < this.model.d; i++) {
      for (let j = 0; j < this.model.d; j++) {
        gradW1[i][j] /= batch.length;
      }
    }
    for (let i = 0; i < this.model.k; i++) {
      gradW2[0][i] /= batch.length;
    }

    // Update weights
    // W₁ ← W₁ - η ∇W₁L
    for (let i = 0; i < this.model.d; i++) {
      for (let j = 0; j < this.model.d; j++) {
        this.model.W1[i][j] -= this.eta * gradW1[i][j];
      }
    }

    // W₂ ← W₂ - (η/k) ∇W₂L
    for (let i = 0; i < this.model.k; i++) {
      this.model.W2[0][i] -= (this.eta / this.model.k) * gradW2[0][i];
    }

    // Compute and return loss
    const loss = this.computeLoss(batch);
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

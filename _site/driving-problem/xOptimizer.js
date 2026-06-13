// ============================================================================
// X OPTIMIZER
// ============================================================================
// Maximize |cos(g(x), Δθ)| over x via gradient ascent with centered finite
// differences on the scalar objective f(x) = |cos(g(x), Δθ)|.
//
// Gradient: ∂f/∂x_i ≈ [f(x + ε e_i) - f(x - ε e_i)] / (2ε)
// Cost: 2 * din evaluations of f per step.
// ============================================================================

const FD_EPS = 0.01;

export class XOptimizer {
  constructor() {
    this.history = [];   // [{step, cosSim, xNorm}]
    this.x       = null; // best x from last run
  }

  // Run all nSteps synchronously. Returns immediately.
  run(mlp, deltaTheta, lr, nSteps, sigma = 1.0) {
    this.history = [];
    const din = mlp.din;
    const x   = mlp.sampleX('gaussian', sigma);

    for (let step = 0; step < nSteps; step++) {
      const f0 = mlp.absCosSimX(x, deltaTheta);

      // Centered finite-difference gradient
      const grad = new Float64Array(din);
      for (let i = 0; i < din; i++) {
        const xi = x[i];
        x[i] = xi + FD_EPS;
        const fp = mlp.absCosSimX(x, deltaTheta);
        x[i] = xi - FD_EPS;
        const fm = mlp.absCosSimX(x, deltaTheta);
        x[i] = xi;
        grad[i] = (fp - fm) / (2 * FD_EPS);
      }

      // Normalized gradient step
      let gNorm = 0;
      for (let i = 0; i < din; i++) gNorm += grad[i] * grad[i];
      gNorm = Math.sqrt(gNorm);
      if (gNorm > 1e-15)
        for (let i = 0; i < din; i++) x[i] += lr * grad[i] / gNorm;

      let xNorm = 0;
      for (let i = 0; i < din; i++) xNorm += x[i] * x[i];
      this.history.push({ step, cosSim: f0, xNorm: Math.sqrt(xNorm) });
    }

    this.x = x;
  }

  // Run and return the best x found (for use in training loop).
  bestX(mlp, deltaTheta, lr, nSteps, sigma = 1.0) {
    this.run(mlp, deltaTheta, lr, nSteps, sigma);
    return this.x;
  }
}

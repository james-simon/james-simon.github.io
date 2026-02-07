// ============================================================================
// MODEL - Network initialization and forward pass
// ============================================================================

export class ExpanderNet {
  constructor(d, k) {
    this.d = d;
    this.k = k;

    // Initialize weights
    this.W1 = this.createIdentity(d);
    this.Wfroz = this.randomGaussian(k, d);
    this.W2 = this.createZeros(1, k);
  }

  // Create d×d identity matrix
  createIdentity(d) {
    const I = [];
    for (let i = 0; i < d; i++) {
      I[i] = [];
      for (let j = 0; j < d; j++) {
        I[i][j] = i === j ? 1 : 0;
      }
    }
    return I;
  }

  // Create k×d random Gaussian matrix
  randomGaussian(rows, cols) {
    const M = [];
    for (let i = 0; i < rows; i++) {
      M[i] = [];
      for (let j = 0; j < cols; j++) {
        M[i][j] = this.randn();
      }
    }
    return M;
  }

  // Create rows×cols zero matrix
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

  // Standard normal random variable (Box-Muller)
  randn() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Nonlinearity: σ(z) = √2 cos(z + π/4)
  sigma(z) {
    return Math.sqrt(2) * Math.cos(z + Math.PI / 4);
  }

  // Forward pass: f̂(x) = W₂ σ(W_froz W₁ x)
  forward(x) {
    // W₁ x
    const W1x = this.matVecMul(this.W1, x);

    // W_froz W₁ x
    const WfrozW1x = this.matVecMul(this.Wfroz, W1x);

    // σ(W_froz W₁ x)
    const activated = WfrozW1x.map(z => this.sigma(z));

    // W₂ σ(W_froz W₁ x)
    const output = this.matVecMul(this.W2, activated);

    return {
      output: output[0],  // Scalar output
      W1x: W1x,
      WfrozW1x: WfrozW1x,
      activated: activated
    };
  }

  // Matrix-vector multiplication
  matVecMul(M, v) {
    const result = [];
    for (let i = 0; i < M.length; i++) {
      let sum = 0;
      for (let j = 0; j < M[i].length; j++) {
        sum += M[i][j] * v[j];
      }
      result[i] = sum;
    }
    return result;
  }

  // Outer product: v ⊗ u
  outerProduct(v, u) {
    const result = [];
    for (let i = 0; i < v.length; i++) {
      result[i] = [];
      for (let j = 0; j < u.length; j++) {
        result[i][j] = v[i] * u[j];
      }
    }
    return result;
  }

  // Derivative of σ: σ'(z) = -√2 sin(z + π/4)
  sigmaPrime(z) {
    return -Math.sqrt(2) * Math.sin(z + Math.PI / 4);
  }
}

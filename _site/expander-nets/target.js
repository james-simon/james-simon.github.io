// ============================================================================
// TARGET - Hermite polynomial target functions
// ============================================================================

export class TargetFunction {
  constructor(alphas, gammas, fStar, c) {
    this.alphas = alphas;  // [α₁, α₂, ..., αd]
    this.gammas = gammas;  // [γ₁, γ₂, ..., γd]
    this.fStar = fStar;    // Target value (currently unused, but kept for future)
    this.c = c;            // Constant (currently unused, but kept for future)
  }

  // Hermite polynomials h_α(z)
  hermite(alpha, z) {
    if (alpha === 0) {
      return 1;
    } else if (alpha === 1) {
      return z;
    } else if (alpha === 2) {
      return z * z - 1;
    } else if (alpha === 3) {
      return z * z * z - 3 * z;
    }
    throw new Error(`Hermite polynomial for α=${alpha} not implemented`);
  }

  // Target function: f*(x) = ∏ᵢ h_αᵢ(γᵢ⁻¹/² xᵢ)
  evaluate(x) {
    let product = 1;
    for (let i = 0; i < x.length; i++) {
      const normalized = x[i] / Math.sqrt(this.gammas[i]);
      const hermiteVal = this.hermite(this.alphas[i], normalized);
      product *= hermiteVal;
    }
    return product;
  }

  // Gradient of target function w.r.t. x
  // ∂f*/∂xᵢ = (1/√γᵢ) h'_αᵢ(γᵢ⁻¹/² xᵢ) ∏_{j≠i} h_αⱼ(γⱼ⁻¹/² xⱼ)
  gradient(x) {
    const grad = [];
    const d = x.length;

    for (let i = 0; i < d; i++) {
      const zi = x[i] / Math.sqrt(this.gammas[i]);
      const hPrime = this.hermitePrime(this.alphas[i], zi);

      // Product of all other Hermite terms
      let product = 1;
      for (let j = 0; j < d; j++) {
        if (j !== i) {
          const zj = x[j] / Math.sqrt(this.gammas[j]);
          product *= this.hermite(this.alphas[j], zj);
        }
      }

      grad[i] = (1 / Math.sqrt(this.gammas[i])) * hPrime * product;
    }

    return grad;
  }

  // Derivative of Hermite polynomials
  hermitePrime(alpha, z) {
    if (alpha === 0) {
      return 0;
    } else if (alpha === 1) {
      return 1;
    } else if (alpha === 2) {
      return 2 * z;
    } else if (alpha === 3) {
      return 3 * z * z - 3;
    }
    throw new Error(`Hermite derivative for α=${alpha} not implemented`);
  }
}

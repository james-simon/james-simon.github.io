// ============================================================================
// TARGET - Hermite polynomial target functions
// ============================================================================

export class TargetFunction {
  constructor(alphas, gammas, fStar, c) {
    // alphas is now 2D: [[α₁, α₂, ...], [α'₁, α'₂, ...], ...]
    // If 1D array passed (backward compat), convert to 2D
    if (!Array.isArray(alphas[0])) {
      this.alphas = [alphas];
    } else {
      this.alphas = alphas;
    }
    this.numTerms = this.alphas.length;
    this.gammas = gammas;  // [γ₁, γ₂, ..., γd]
    this.fStar = fStar;    // Target value (currently unused, but kept for future)
    this.c = c;            // Constant (currently unused, but kept for future)
  }

  // Normalized Hermite polynomials h_α(z) = He_α(z) / sqrt(α!)
  // where He_α are the probabilist's Hermite polynomials
  hermite(alpha, z) {
    if (alpha === 0) {
      return 1;  // He_0(z) / sqrt(0!) = 1 / 1 = 1
    } else if (alpha === 1) {
      return z;  // He_1(z) / sqrt(1!) = z / 1 = z
    } else if (alpha === 2) {
      return (z * z - 1) / Math.sqrt(2);  // He_2(z) / sqrt(2!) = (z² - 1) / √2
    } else if (alpha === 3) {
      return (z * z * z - 3 * z) / Math.sqrt(6);  // He_3(z) / sqrt(3!) = (z³ - 3z) / √6
    }
    throw new Error(`Hermite polynomial for α=${alpha} not implemented`);
  }

  // Target function: f*(x) = Σⱼ ∏ᵢ h_αⱼᵢ(γᵢ⁻¹/² xᵢ)
  evaluate(x) {
    let sum = 0;
    // Sum over terms
    for (let termIdx = 0; termIdx < this.numTerms; termIdx++) {
      let product = 1;
      // Product over dimensions
      for (let dimIdx = 0; dimIdx < x.length; dimIdx++) {
        const normalized = x[dimIdx] / Math.sqrt(this.gammas[dimIdx]);
        const hermiteVal = this.hermite(this.alphas[termIdx][dimIdx], normalized);
        product *= hermiteVal;
      }
      sum += product;
    }
    return sum;
  }

  // Gradient of target function w.r.t. x
  // ∂f*/∂xᵢ = Σⱼ (1/√γᵢ) h'_αⱼᵢ(γᵢ⁻¹/² xᵢ) ∏_{k≠i} h_αⱼₖ(γₖ⁻¹/² xₖ)
  gradient(x) {
    const grad = [];
    const d = x.length;

    for (let dimIdx = 0; dimIdx < d; dimIdx++) {
      let gradSum = 0;

      // Sum over terms
      for (let termIdx = 0; termIdx < this.numTerms; termIdx++) {
        const zi = x[dimIdx] / Math.sqrt(this.gammas[dimIdx]);
        const hPrime = this.hermitePrime(this.alphas[termIdx][dimIdx], zi);

        // Product of all other Hermite terms for this term
        let product = 1;
        for (let otherDimIdx = 0; otherDimIdx < d; otherDimIdx++) {
          if (otherDimIdx !== dimIdx) {
            const zj = x[otherDimIdx] / Math.sqrt(this.gammas[otherDimIdx]);
            product *= this.hermite(this.alphas[termIdx][otherDimIdx], zj);
          }
        }

        gradSum += (1 / Math.sqrt(this.gammas[dimIdx])) * hPrime * product;
      }

      grad[dimIdx] = gradSum;
    }

    return grad;
  }

  // Derivative of normalized Hermite polynomials
  // d/dz [He_α(z) / sqrt(α!)] = He'_α(z) / sqrt(α!)
  hermitePrime(alpha, z) {
    if (alpha === 0) {
      return 0;  // He_0'(z) / sqrt(0!) = 0 / 1 = 0
    } else if (alpha === 1) {
      return 1;  // He_1'(z) / sqrt(1!) = 1 / 1 = 1
    } else if (alpha === 2) {
      return 2 * z / Math.sqrt(2);  // He_2'(z) / sqrt(2!) = 2z / √2 = z√2
    } else if (alpha === 3) {
      return (3 * z * z - 3) / Math.sqrt(6);  // He_3'(z) / sqrt(3!) = (3z² - 3) / √6
    }
    throw new Error(`Hermite derivative for α=${alpha} not implemented`);
  }
}

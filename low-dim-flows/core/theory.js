// ============================================================================
// THEORY CALCULATIONS
// ============================================================================
// Pure functions for theoretical predictions

/**
 * Calculate total order: ℓ = Σ k_i
 */
export function calculateEll(kVec) {
  return kVec.reduce((sum, k) => sum + k, 0);
}

/**
 * Calculate order prefactor: κ = Π k_i^(k_i/2)
 */
export function calculateKappa(kVec) {
  let kappa = 1;
  for (let i = 0; i < kVec.length; i++) {
    kappa *= Math.pow(kVec[i], kVec[i] / 2);
  }
  return kappa;
}

/**
 * Calculate mean core parameter: β = (1/d) Σ |a_i(0)|/√k_i
 */
export function calculateBeta(a0Vec, kVec) {
  const d = a0Vec.length;
  let betaSum = 0;
  for (let i = 0; i < d; i++) {
    betaSum += Math.abs(a0Vec[i]) / Math.sqrt(kVec[i]);
  }
  return betaSum / d;
}

/**
 * Calculate rise time (piecewise function)
 * Returns { value, isUndefined }
 */
export function calculateTRise(ell, kappa, beta, fStar) {
  if (ell === 1) {
    return { value: fStar, isUndefined: false };
  }

  if (ell < 1) {
    return { value: NaN, isUndefined: true };
  }

  if (ell === 2) {
    const trise = -(1 / (kappa * fStar)) * Math.log(Math.sqrt(fStar / kappa) * beta);
    return { value: trise, isUndefined: false };
  }

  // ell > 2
  const trise = (1 / (ell - 2)) * (1 / (kappa * fStar)) * (1 / Math.pow(beta, ell - 2));
  return { value: trise, isUndefined: false };
}

/**
 * Calculate all theory values at once
 * Returns object with all quantities
 */
export function calculateAllTheory(a0Vec, kVec, fStar) {
  const ell = calculateEll(kVec);
  const kappa = calculateKappa(kVec);
  const beta = calculateBeta(a0Vec, kVec);
  const tRise = calculateTRise(ell, kappa, beta, fStar);

  return { ell, kappa, beta, tRise };
}

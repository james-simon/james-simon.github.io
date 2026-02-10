// ============================================================================
// THEORY CALCULATIONS
// ============================================================================
// Pure functions for theoretical predictions

import { computeShapeIntegral } from '../utils/integration.js';

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
export function calculateTRise(ell, kappa, beta, fStar, c, shapeIntegral) {
  if (ell === 1) {
    return { value: 1 / (c * c), isUndefined: false };
  }

  if (ell < 1) {
    return { value: NaN, isUndefined: true };
  }

  if (ell === 2) {
    const trise = -(1 / (kappa * c * fStar)) * Math.log(Math.sqrt(kappa * c / fStar) * beta);
    return { value: trise, isUndefined: false };
  }

  // ell > 2
  // Use shape integral F(r) in the numerator
  if (shapeIntegral.isUndefined) {
    return { value: NaN, isUndefined: true };
  }
  const trise = (1 / (ell - 2)) * (shapeIntegral.value / (kappa * c * fStar)) * (1 / Math.pow(beta, ell - 2));
  return { value: trise, isUndefined: false };
}

/**
 * Calculate shape parameters: r_i = a_i(0)^2 / (k_i * β^2)
 */
export function calculateShapeParameters(a0Vec, kVec, beta) {
  const rVec = [];
  for (let i = 0; i < a0Vec.length; i++) {
    const ri = (a0Vec[i] * a0Vec[i]) / (kVec[i] * beta * beta);
    rVec.push(ri);
  }
  return rVec;
}

/**
 * Calculate effective beta parameter
 * β_eff = β if ℓ ≤ 2, otherwise F(r)^(-1/(ℓ-2)) * β
 */
export function calculateBetaEffective(beta, ell, shapeIntegral) {
  if (ell <= 2) {
    return beta;
  }

  if (shapeIntegral.isUndefined) {
    return NaN;
  }

  return Math.pow(shapeIntegral.value, -1 / (ell - 2)) * beta;
}

/**
 * Calculate all theoretical quantities for the system
 *
 * @param {number[]} a0Vec - Initial parameter values [a_1(0), a_2(0), ...]
 * @param {number[]} kVec - Exponents [k_1, k_2, ...]
 * @param {number} fStar - Target value f*
 * @param {number} c - Coefficient c
 * @returns {Object} Theory object containing:
 *   - ell: Total order (Σ k_i)
 *   - kappa: Order prefactor (Π k_i^(k_i/2))
 *   - beta: Mean core parameter at init
 *   - tRise: Rise time {value, isUndefined}
 *   - shapeParams: Shape parameters [r_1, r_2, ...]
 *   - shapeIntegral: F(r) {value, isUndefined}
 *   - betaEffective: Effective balanced init scale
 *
 * @example
 * const theory = calculateAllTheory([0.01, 0.01], [2, 3], 1, 1);
 * console.log(theory.tRise.value); // Rise time
 * console.log(theory.betaEffective); // β_eff
 */
export function calculateAllTheory(a0Vec, kVec, fStar, c) {
  const ell = calculateEll(kVec);
  const kappa = calculateKappa(kVec);
  const beta = calculateBeta(a0Vec, kVec);
  const shapeParams = calculateShapeParameters(a0Vec, kVec, beta);
  const shapeIntegral = computeShapeIntegral(shapeParams, kVec, ell);
  const tRise = calculateTRise(ell, kappa, beta, fStar, c, shapeIntegral);
  const betaEffective = calculateBetaEffective(beta, ell, shapeIntegral);

  return { ell, kappa, beta, tRise, shapeParams, shapeIntegral, betaEffective };
}

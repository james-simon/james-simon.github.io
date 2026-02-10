// ============================================================================
// LOW-DIMENSIONAL FLOWS API
// ============================================================================
// Public API for computing theory and running simulations
// Import this module to use low-dim-flows from other projects

/**
 * USAGE EXAMPLE:
 *
 * import { calculateAllTheory, solveODE, solveBalancedInit } from './low-dim-flows/api.js';
 *
 * // Define your system
 * const a0Vec = [0.01, 0.01];  // Initial values
 * const kVec = [2, 3];          // Exponents
 * const fStar = 1;              // Target
 * const c = 1;                  // Coefficient
 *
 * // Compute all theory
 * const theory = calculateAllTheory(a0Vec, kVec, fStar, c);
 * console.log('Rise time:', theory.tRise.value);
 * console.log('β_eff:', theory.betaEffective);
 *
 * // Run simulation
 * const result = solveODE(a0Vec, kVec, 10, fStar, c);
 * console.log('Times:', result.times);
 * console.log('Loss:', result.lossValues);
 * console.log('Trajectories:', result.aTrajectories);
 *
 * // Run from balanced init
 * const balanced = solveBalancedInit(a0Vec, kVec, 10, fStar, c, theory.betaEffective);
 */

// Theory functions
export {
  calculateAllTheory,
  calculateTRise,
  calculateEll,
  calculateKappa,
  calculateBeta,
  calculateBetaEffective,
  calculateShapeParameters
} from './core/theory.js';

// Simulation functions
export {
  solveODE,
  solveBalancedInit,
  loss,
  gradientLoss
} from './core/simulation.js';

// Utility functions
export { computeShapeIntegral } from './utils/integration.js';

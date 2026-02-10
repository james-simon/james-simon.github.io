// ============================================================================
// SIMULATION & ODE SOLVER
// ============================================================================
// Pure functions for loss calculation, gradient, and ODE integration
// Designed to be extensible for future equation types

import { CONFIG } from '../config.js';

/**
 * Loss function: L = (1/2)(f* - c*prod(a_i^k_i))^2
 */
export function loss(aVec, kVec, fStar = 1, c = 1) {
  if (aVec.length !== kVec.length) {
    throw new Error(`Array length mismatch: aVec(${aVec.length}) !== kVec(${kVec.length})`);
  }
  if (aVec.length === 0) {
    throw new Error('Cannot compute loss for empty arrays');
  }
  if (aVec.some(a => a <= 0)) {
    throw new Error('All values in aVec must be positive');
  }

  let product = 1;
  for (let i = 0; i < aVec.length; i++) {
    product *= Math.pow(aVec[i], kVec[i]);
  }
  const term = fStar - c * product;
  return 0.5 * term * term;
}

/**
 * Gradient of loss with respect to all variables
 * dL/da_i = -(f*-c*P) * c * k_i * P / a_i, where P = prod(a_j^k_j)
 */
export function gradientLoss(aVec, kVec, fStar = 1, c = 1) {
  if (aVec.length !== kVec.length) {
    throw new Error(`Array length mismatch: aVec(${aVec.length}) !== kVec(${kVec.length})`);
  }
  if (aVec.some(a => a <= 0)) {
    throw new Error('All values in aVec must be positive');
  }

  const n = aVec.length;
  const grad = new Array(n);

  // Compute product P
  let product = 1;
  for (let i = 0; i < n; i++) {
    product *= Math.pow(aVec[i], kVec[i]);
  }

  // Compute gradient for each variable
  const factor = -(fStar - c * product) * c;
  for (let i = 0; i < n; i++) {
    grad[i] = factor * kVec[i] * product / aVec[i];
  }

  return grad;
}

/**
 * ODE system: da/dt = -dL/da (gradient flow)
 */
export function odeSystem(aVec, kVec, fStar = 1, c = 1) {
  const grad = gradientLoss(aVec, kVec, fStar, c);
  return grad.map(g => -g);
}

/**
 * RK4 integration step for the system
 */
export function rk4Step(aVec, dt, kVec, fStar = 1, c = 1) {
  const n = aVec.length;

  const k1 = odeSystem(aVec, kVec, fStar, c);

  const aVec2 = aVec.map((a, i) => a + 0.5 * dt * k1[i]);
  const k2 = odeSystem(aVec2, kVec, fStar, c);

  const aVec3 = aVec.map((a, i) => a + 0.5 * dt * k2[i]);
  const k3 = odeSystem(aVec3, kVec, fStar, c);

  const aVec4 = aVec.map((a, i) => a + dt * k3[i]);
  const k4 = odeSystem(aVec4, kVec, fStar, c);

  const aVecNew = aVec.map((a, i) =>
    a + (dt / 6) * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i])
  );

  // Validate integration result
  if (aVecNew.some(a => !isFinite(a))) {
    throw new Error('RK4 integration produced non-finite values (overflow/underflow)');
  }
  if (aVecNew.some(a => a <= 0)) {
    throw new Error('RK4 integration produced non-positive values (trajectory diverged)');
  }

  return aVecNew;
}

/**
 * Solve ODE system: da/dt = -dL/da with gradient flow dynamics
 * Loss: L = (1/2)(f* - c·∏a_i^k_i)²
 *
 * Uses adaptive stopping: continues until loss drops below threshold,
 * then runs twice as long (up to hardCapTime)
 *
 * @param {number[]} a0Vec - Initial conditions [a_1(0), a_2(0), ...]
 * @param {number[]} kVec - Exponents [k_1, k_2, ...]
 * @param {number} tMax - Maximum simulation time (advisory, may stop earlier)
 * @param {number} fStar - Target value f* (default: 1)
 * @param {number} c - Coefficient c (default: 1)
 * @param {number} dt - Time step (default: from CONFIG)
 * @returns {Object} Solution containing:
 *   - times: Array of time points
 *   - aTrajectories: Array of trajectories (one per variable)
 *   - lossValues: Loss at each time point
 *
 * @example
 * const solution = solveODE([0.01, 0.01], [2, 3], 10, 1, 1);
 * console.log(solution.times);        // [0, 0.01, 0.02, ...]
 * console.log(solution.lossValues);   // [L(t=0), L(t=0.01), ...]
 * console.log(solution.aTrajectories); // [[a1(t)], [a2(t)]]
 */
export function solveODE(a0Vec, kVec, tMax, fStar = 1, c = 1, dt = CONFIG.simulation.dt) {
  const THRESHOLD_FRACTION = CONFIG.simulation.adaptiveStoppingThreshold;

  const times = [];
  const aTrajectories = a0Vec.map(() => []);  // One array per variable
  const lossValues = [];

  let aVec = [...a0Vec];  // Copy initial values
  let t = 0;

  // Compute initial loss to set threshold
  const initialLoss = loss(aVec, kVec, fStar, c);
  const lossThreshold = THRESHOLD_FRACTION * initialLoss;

  let thresholdTime = null;  // When loss first drops below threshold
  let targetTime = tMax;  // Will be updated when threshold is crossed

  while (t <= targetTime) {
    times.push(t);
    for (let i = 0; i < aVec.length; i++) {
      aTrajectories[i].push(aVec[i]);
    }

    const currentLoss = loss(aVec, kVec, fStar, c);
    lossValues.push(currentLoss);

    // Check if we've crossed the threshold for the first time
    if (thresholdTime === null && currentLoss < lossThreshold) {
      thresholdTime = t;
      // Adaptive stopping: run twice as long after threshold, but don't exceed tMax
      targetTime = Math.min(2 * thresholdTime, tMax);
    }

    // Integrate
    aVec = rk4Step(aVec, dt, kVec, fStar, c);
    t += dt;
  }

  return { times, aTrajectories, lossValues };
}

/**
 * Solve ODE from balanced initial conditions
 * Computes β_eff from theory, then runs simulation with a_i(0) = √k_i * β_eff
 *
 * @param {number[]} a0Vec - Initial conditions (used only to compute β_eff)
 * @param {number[]} kVec - Exponents for each variable
 * @param {number} tMax - Maximum simulation time
 * @param {number} fStar - Target value
 * @param {number} c - Coefficient
 * @param {number} dt - Time step (optional)
 * @returns {{ times: number[], aTrajectories: number[][], lossValues: number[] }}
 */
export function solveBalancedInit(a0Vec, kVec, tMax, fStar = 1, c = 1, betaEffective, dt = CONFIG.simulation.dt) {
  if (isNaN(betaEffective)) {
    throw new Error('Cannot compute balanced init: β_eff is undefined');
  }

  // Create balanced initial conditions: a_i(0) = √k_i * β_eff
  const a0Balanced = kVec.map(k => Math.sqrt(k) * betaEffective);

  // Run simulation
  return solveODE(a0Balanced, kVec, tMax, fStar, c, dt);
}

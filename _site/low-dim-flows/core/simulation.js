// ============================================================================
// SIMULATION & ODE SOLVER
// ============================================================================
// Pure functions for loss calculation, gradient, and ODE integration
// Designed to be extensible for future equation types

import { CONFIG } from '../config.js';

/**
 * Loss function: L = (1/2)(f* - prod(a_i^k_i))^2
 */
export function loss(aVec, kVec, fStar = 1) {
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
  const term = fStar - product;
  return 0.5 * term * term;
}

/**
 * Gradient of loss with respect to all variables
 * dL/da_i = -(f*-P) * k_i * P / a_i, where P = prod(a_j^k_j)
 */
export function gradientLoss(aVec, kVec, fStar = 1) {
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
  const factor = -(fStar - product);
  for (let i = 0; i < n; i++) {
    grad[i] = factor * kVec[i] * product / aVec[i];
  }

  return grad;
}

/**
 * ODE system: da/dt = -dL/da (gradient flow)
 */
export function odeSystem(aVec, kVec, fStar = 1) {
  const grad = gradientLoss(aVec, kVec, fStar);
  return grad.map(g => -g);
}

/**
 * RK4 integration step for the system
 */
export function rk4Step(aVec, dt, kVec, fStar = 1) {
  const n = aVec.length;

  const k1 = odeSystem(aVec, kVec, fStar);

  const aVec2 = aVec.map((a, i) => a + 0.5 * dt * k1[i]);
  const k2 = odeSystem(aVec2, kVec, fStar);

  const aVec3 = aVec.map((a, i) => a + 0.5 * dt * k2[i]);
  const k3 = odeSystem(aVec3, kVec, fStar);

  const aVec4 = aVec.map((a, i) => a + dt * k3[i]);
  const k4 = odeSystem(aVec4, kVec, fStar);

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
 * Solve ODE system with adaptive stopping:
 * - Continue until loss < threshold * initial_loss, then go twice as far
 * - Hard stop at hardCapTime
 * Returns times, trajectories for each variable, and loss values
 */
export function solveODE(a0Vec, kVec, tMax, fStar = 1, dt = CONFIG.simulation.dt) {
  const THRESHOLD_FRACTION = CONFIG.simulation.adaptiveStoppingThreshold;
  const HARD_CAP = CONFIG.simulation.hardCapTime;

  const times = [];
  const aTrajectories = a0Vec.map(() => []);  // One array per variable
  const lossValues = [];

  let aVec = [...a0Vec];  // Copy initial values
  let t = 0;

  // Compute initial loss to set threshold
  const initialLoss = loss(aVec, kVec, fStar);
  const lossThreshold = THRESHOLD_FRACTION * initialLoss;

  let thresholdTime = null;  // When loss first drops below threshold
  let targetTime = HARD_CAP;  // Default to hard cap

  while (t <= targetTime && t <= HARD_CAP) {
    times.push(t);
    for (let i = 0; i < aVec.length; i++) {
      aTrajectories[i].push(aVec[i]);
    }

    const currentLoss = loss(aVec, kVec, fStar);
    lossValues.push(currentLoss);

    // Check if we've crossed the threshold for the first time
    if (thresholdTime === null && currentLoss < lossThreshold) {
      thresholdTime = t;
      targetTime = Math.min(2 * thresholdTime, HARD_CAP);
    }

    // Integrate
    aVec = rk4Step(aVec, dt, kVec, fStar);
    t += dt;
  }

  return { times, aTrajectories, lossValues };
}

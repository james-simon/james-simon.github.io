// ============================================================================
// NUMERICAL INTEGRATION
// ============================================================================
// Adaptive Simpson's rule for computing the shape integral

const ABS_TOL = 1e-10;
const REL_TOL = 1e-8;
const MAX_RECURSION = 25;

/**
 * Adaptive Simpson's rule for integral over [a, b]
 * @param {Function} f - Function to integrate
 * @param {number} a - Lower bound
 * @param {number} b - Upper bound
 * @param {number} fa - f(a) (precomputed)
 * @param {number} fb - f(b) (precomputed)
 * @param {number} depth - Current recursion depth
 * @returns {number} Approximate integral
 */
function adaptiveSimpson(f, a, b, fa, fb, depth = 0) {
  const c = (a + b) / 2;
  const h = b - a;
  const fc = f(c);
  const fd = f((a + c) / 2);
  const fe = f((c + b) / 2);

  // Simpson's rule on [a,b]
  const S = (h / 6) * (fa + 4 * fc + fb);

  // Simpson's rule on [a,c] and [c,b]
  const Sleft = (h / 12) * (fa + 4 * fd + fc);
  const Sright = (h / 12) * (fc + 4 * fe + fb);
  const S2 = Sleft + Sright;

  const error = Math.abs(S2 - S);
  const tolerance = Math.max(ABS_TOL, REL_TOL * Math.abs(S2));

  // Check convergence or max depth
  if (error < 15 * tolerance || depth >= MAX_RECURSION) {
    return S2 + (S2 - S) / 15; // Richardson extrapolation
  }

  // Recurse
  const left = adaptiveSimpson(f, a, c, fa, fc, depth + 1);
  const right = adaptiveSimpson(f, c, b, fc, fb, depth + 1);

  return left + right;
}

/**
 * Compute shape integral F for ℓ > 2
 * F = (ℓ/2 - 1) * ∫₀^∞ ∏ᵢ (s + rᵢ)^(-kᵢ/2) ds
 *
 * Uses split integration:
 * - Adaptive Simpson on [0, S] where S = 10*max(rᵢ) + 1
 * - Analytical tail approximation for [S, ∞)
 *
 * @param {number[]} rVec - Shape parameters
 * @param {number[]} kVec - Exponents
 * @param {number} ell - Total order
 * @returns {number} Shape integral value
 */
export function computeShapeIntegral(rVec, kVec, ell) {
  if (ell <= 2) {
    return { value: NaN, isUndefined: true };
  }

  const n = rVec.length;
  const K = ell; // K = sum of k_i = ell
  const prefactor = ell / 2 - 1;

  // Integrand: g(s) = ∏ᵢ (s + rᵢ)^(-kᵢ/2)
  // Compute in log space to avoid overflow/underflow
  const integrand = (s) => {
    let logG = 0;
    for (let i = 0; i < n; i++) {
      logG -= (kVec[i] / 2) * Math.log(s + rVec[i]);
    }
    return Math.exp(logG);
  };

  // Choose split point S (larger value for better tail approximation accuracy)
  const maxR = Math.max(...rVec);
  const S = 100 * maxR + 10;

  // Numerically integrate [0, S] using adaptive Simpson
  const numericalPart = adaptiveSimpson(integrand, 0, S, integrand(0), integrand(S));

  // Analytical tail approximation for [S, ∞)
  // For large s, expand: ∏ᵢ (s + rᵢ)^(-kᵢ/2) = s^(-K/2) * ∏ᵢ (1 + rᵢ/s)^(-kᵢ/2)
  //                                           ≈ s^(-K/2) * (1 - A/s + O(s^-2))
  // where A = (1/2) * Σᵢ kᵢ * rᵢ

  // Compute A for first-order correction
  let A = 0;
  for (let i = 0; i < n; i++) {
    A += kVec[i] * rVec[i];
  }
  A /= 2;

  // Integrate the expansion term-by-term:
  // ∫_S^∞ s^(-K/2) ds = 2/(K-2) * S^(1-K/2)
  // ∫_S^∞ A * s^(-K/2-1) ds = 2A/K * S^(-K/2)

  const term1 = (2 / (K - 2)) * Math.pow(S, 1 - K / 2);
  const term2 = (2 * A / K) * Math.pow(S, -K / 2);
  const tailPart = term1 - term2;

  // Total integral
  const integral = numericalPart + tailPart;

  // Apply prefactor
  const F = prefactor * integral;

  return { value: F, isUndefined: false };
}

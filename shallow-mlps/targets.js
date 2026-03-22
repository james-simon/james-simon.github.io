// ============================================================================
// TARGETS — target function definitions, metadata, and LaTeX display
// ============================================================================
//
// Each target type exposes:
//   computeTarget(x, T) -> { y, fTerms }   — evaluate f* and its component terms
//   numCoeffTerms(T)    -> number           — how many terms go in the coeff plot
//   latex(T)            -> string           — LaTeX for the formula display
//   coeffLabel(k)       -> string           — Unicode label for coeff plot term k (1-indexed)

// Unicode subscript digits
const SUB = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
function sub(n) { return String(n).split('').map(c => SUB[+c]).join(''); }

// ---- Staircase -------------------------------------------------------------
// f*(x) = x₁ + x₁x₂ + x₁x₂x₃ + ... + x₁…x_T
const staircase = {
  computeTarget(x, T) {
    const fTerms = new Float64Array(T);
    let prod = 1;
    for (let k = 0; k < T; k++) { prod *= x[k]; fTerms[k] = prod; }
    let y = 0;
    for (let k = 0; k < T; k++) y += fTerms[k];
    return { y, fTerms };
  },
  numCoeffTerms(T) { return T; },
  latex(T) {
    const terms = [];
    for (let k = 1; k <= T; k++) {
      terms.push(Array.from({ length: k }, (_, i) => `x_{${i+1}}`).join(''));
    }
    return 'f^*(\\mathbf{x}) = ' + terms.join(' + ');
  },
  coeffLabel(k) {
    return Array.from({ length: k }, (_, i) => `x${sub(i+1)}`).join('·');
  },
};

// ---- Hermite ---------------------------------------------------------------
// f*(x) = He_T(x₁) / √(T!)   (probabilist's, normalized)
function hermitePoly(x, n) {
  if (n === 0) return 1;
  let h0 = 1, h1 = x;
  for (let k = 2; k <= n; k++) { const h2 = x * h1 - (k-1) * h0; h0 = h1; h1 = h2; }
  return h1;
}

const hermite = {
  computeTarget(x, T) {
    let fac = 1;
    for (let k = 2; k <= T; k++) fac *= k;
    const y = hermitePoly(x[0], T) / Math.sqrt(fac);
    return { y, fTerms: new Float64Array([y]) };
  },
  numCoeffTerms(_T) { return 1; },
  latex(T) {
    let fac = 1;
    for (let k = 2; k <= T; k++) fac *= k;
    return `f^*(\\mathbf{x}) = \\tfrac{1}{\\sqrt{${fac}}}\\,\\mathrm{He}_{${T}}(x_1)`;
  },
  coeffLabel(_k) { return 'f*'; },
};

// ---- Monomial --------------------------------------------------------------
// f*(x) = x₁ · x₂ · … · x_T   (normalized under N(0,I))
const monomial = {
  computeTarget(x, T) {
    let y = 1;
    for (let k = 0; k < T; k++) y *= x[k];
    return { y, fTerms: new Float64Array([y]) };
  },
  numCoeffTerms(_T) { return 1; },
  latex(T) {
    const vars = Array.from({ length: T }, (_, i) => `x_{${i+1}}`).join('');
    return `f^*(\\mathbf{x}) = ${vars}`;
  },
  coeffLabel(_k) { return 'f*'; },
};

// ---- Registry --------------------------------------------------------------
const TARGETS = { staircase, hermite, monomial };

export function computeTarget(x, targetType, numTerms) {
  return TARGETS[targetType].computeTarget(x, numTerms);
}

export function numCoeffTerms(targetType, numTerms) {
  return TARGETS[targetType].numCoeffTerms(numTerms);
}

export function targetLatex(targetType, numTerms) {
  return TARGETS[targetType].latex(numTerms);
}

export function targetCoeffLabel(targetType, k) {
  return TARGETS[targetType].coeffLabel(k);
}

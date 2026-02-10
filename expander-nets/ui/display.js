// ============================================================================
// UI DISPLAY - DOM updates and MathJax rendering
// ============================================================================

import { formatForLatex } from '../utils/formatters.js';

/**
 * DisplayManager - handles all DOM updates and MathJax rendering
 */
export class DisplayManager {
  constructor() {
    // Cache DOM elements
    this.modelingOdeFormula = document.getElementById('modelingOdeFormula');
    this.rateConstantFormula = document.getElementById('rateConstantFormula');
    this.rateConstantValue = document.getElementById('rateConstantValue');
    this.relevantDirectionsValue = document.getElementById('relevantDirectionsValue');
    this.orderOfFStarValue = document.getElementById('orderOfFStarValue');
    this.totalOrderValue = document.getElementById('totalOrderValue');
    this.orderPrefactorValue = document.getElementById('orderPrefactorValue');
    this.betaValue = document.getElementById('betaValue');
    this.shapeParamsValue = document.getElementById('shapeParamsValue');
    this.shapeIntegralValue = document.getElementById('shapeIntegralValue');
    this.triseValue = document.getElementById('triseValue');
  }

  /**
   * Update modeling ODE formula based on alpha values
   */
  updateModelingOdeFormula(alphaValues, d) {
    const factors = [];

    for (let i = 0; i < d; i++) {
      const alpha = alphaValues[i];

      if (alpha === 0) {
        continue;
      } else if (alpha === 1) {
        factors.push(`a_{${i+1}}`);
      } else {
        factors.push(`a_{${i+1}}^{${alpha}}`);
      }
    }

    let productString;
    if (factors.length === 0) {
      productString = '';
    } else {
      productString = factors.join(' \\cdot ');
    }

    let expression;
    if (productString === '') {
      expression = 'c \\cdot b';
    } else {
      expression = `c \\cdot ${productString} \\cdot b`;
    }

    const formula = `$$\\begin{align}
\\mathcal{L} &= \\frac{1}{2}\\left(1 - c \\cdot \\prod_{i=1}^{d} a_i^{\\alpha_i} \\cdot b\\right)^2 \\\\
&= \\frac{1}{2}\\left(1 - ${expression}\\right)^2
\\end{align}$$`;

    this.modelingOdeFormula.textContent = formula;
    this.renderMathJax([this.modelingOdeFormula]);
  }

  /**
   * Update rate constant formula and display value
   */
  updateRateConstantFormula(alphaValues, gammaValues, d) {
    // Build specific formula with actual exponents
    const productFactors = [];
    for (let i = 0; i < d; i++) {
      const alpha = alphaValues[i];
      if (alpha === 0) {
        continue;
      } else if (alpha === 1) {
        productFactors.push(`\\gamma_{${i+1}}`);
      } else {
        productFactors.push(`\\gamma_{${i+1}}^{${alpha}}`);
      }
    }

    let specificProduct;
    if (productFactors.length === 0) {
      specificProduct = '1';
    } else {
      specificProduct = productFactors.join(' ');
    }

    const formula = `$$\\begin{align}
c &= \\sqrt{\\prod_{i=1}^{d} \\gamma_i^{\\alpha_i}} \\\\
&= \\sqrt{${specificProduct}}
\\end{align}$$`;

    this.rateConstantFormula.textContent = formula;
    this.renderMathJax([this.rateConstantFormula]);
  }

  /**
   * Update all theory values from theory object
   */
  updateTheoryValues(theory) {
    // Rate constant (c)
    const formattedC = formatForLatex(theory.c);
    this.rateConstantValue.innerHTML = `$${formattedC}$`;

    // Number of relevant directions (d')
    const formattedRelevantDirs = formatForLatex(theory.relevantDirections);
    this.relevantDirectionsValue.innerHTML = `$${formattedRelevantDirs}$`;

    // Order of f*
    const formattedOrderFStar = formatForLatex(theory.orderOfFStar);
    this.orderOfFStarValue.innerHTML = `$${formattedOrderFStar}$`;

    // Total order (ℓ)
    const formattedEll = formatForLatex(theory.ell);
    this.totalOrderValue.innerHTML = `$${formattedEll}$`;

    // Order prefactor (κ)
    const formattedKappa = formatForLatex(theory.kappa);
    this.orderPrefactorValue.innerHTML = `$${formattedKappa}$`;

    // Beta
    const formattedBeta = formatForLatex(theory.beta);
    this.betaValue.innerHTML = `$${formattedBeta}$`;

    // Shape parameters
    const shapeParamsRows = theory.shapeParams.map((r, i) =>
      `r_{${i+1}} &= ${formatForLatex(r)}`
    ).join(' \\\\ ');
    const allRows = shapeParamsRows + ` \\\\ r_b &= 0`;
    this.shapeParamsValue.innerHTML = `$$\\begin{aligned} ${allRows} \\end{aligned}$$`;

    // Shape integral
    if (theory.shapeIntegral.isUndefined) {
      this.shapeIntegralValue.innerHTML = '—';
    } else {
      const formattedF = formatForLatex(theory.shapeIntegral.value);
      this.shapeIntegralValue.innerHTML = `$${formattedF}$`;
    }

    // Rise time
    if (theory.tRise.isUndefined) {
      this.triseValue.innerHTML = '$\\text{undefined}$';
    } else {
      const formattedTRise = formatForLatex(theory.tRise.value);
      this.triseValue.innerHTML = `$${formattedTRise}$`;
    }

    // Render all MathJax
    this.renderMathJax([
      this.rateConstantValue,
      this.relevantDirectionsValue,
      this.orderOfFStarValue,
      this.totalOrderValue,
      this.orderPrefactorValue,
      this.betaValue,
      this.shapeParamsValue,
      this.shapeIntegralValue,
      this.triseValue
    ]);
  }

  /**
   * Render MathJax for given elements
   */
  renderMathJax(elements) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetPromise(elements).catch((err) => console.log(err));
    } else if (window.MathJax && window.MathJax.Hub) {
      MathJax.Hub.Queue(["Typeset", MathJax.Hub, ...elements]);
    }
  }
}

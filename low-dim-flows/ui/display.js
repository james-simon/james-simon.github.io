// ============================================================================
// DISPLAY MANAGEMENT
// ============================================================================
// Handles text and equation display (loss equation, theory values)

import { formatSigFigs } from '../utils/formatters.js';

/**
 * DisplayManager: Manages LaTeX equations and theory display
 */
export class DisplayManager {
  constructor() {
    this.lossDisplay = document.getElementById('lossDisplay');
    this.ellValue = document.getElementById('ellValue');
    this.kappaValue = document.getElementById('kappaValue');
    this.betaValue = document.getElementById('betaValue');
    this.triseValue = document.getElementById('triseValue');
  }

  /**
   * Clean floating point numbers for display (remove trailing precision errors)
   */
  cleanFloat(value) {
    // Round to reasonable precision to eliminate floating-point errors
    const rounded = parseFloat(value.toFixed(10));
    const str = rounded.toString();
    // If it's a simple number, return as-is; otherwise format it nicely
    if (str.includes('e')) return str; // Keep scientific notation
    // Only remove trailing zeros after a decimal point
    if (str.includes('.')) {
      return str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    }
    return str;
  }

  /**
   * Update loss equation based on number of variables
   */
  updateLossEquation(numVars, fStar, kVec) {
    let latex;

    // Clean f_* for display
    const fStarClean = this.cleanFloat(fStar);

    if (numVars === 1) {
      // Build aligned equation with symbolic and expanded forms
      const kClean = this.cleanFloat(kVec[0]);
      // Omit exponent if k = 1
      const expandedTerm = kClean === '1' ? 'a_1' : `a_1^{${kClean}}`;
      latex = `$$\\begin{align}
\\mathcal{L} &= \\frac{1}{2}(f_*-a_1^{k_1})^2, \\\\
&= \\frac{1}{2}(${fStarClean}-${expandedTerm})^2,
\\end{align}$$`;
    } else {
      // Build product term: a_1^{k_1} a_2^{k_2} ... a_n^{k_n}
      const productTerms = [];
      for (let i = 1; i <= numVars; i++) {
        productTerms.push(`a_${i}^{k_${i}}`);
      }
      const product = productTerms.join(' ');

      // Build expanded product with actual k values
      const expandedProductTerms = [];
      for (let i = 0; i < numVars; i++) {
        const kClean = this.cleanFloat(kVec[i]);
        // Omit exponent if k = 1
        if (kClean === '1') {
          expandedProductTerms.push(`a_${i+1}`);
        } else {
          expandedProductTerms.push(`a_${i+1}^{${kClean}}`);
        }
      }
      const expandedProduct = expandedProductTerms.join(' ');

      latex = `$$\\begin{align}
\\mathcal{L} &= \\frac{1}{2}(f_*-${product})^2, \\\\
&= \\frac{1}{2}(${fStarClean}-${expandedProduct})^2,
\\end{align}$$`;
    }

    this.lossDisplay.innerHTML = latex;

    // Retypeset MathJax if available
    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetPromise([this.lossDisplay]).catch((err) =>
        console.warn('MathJax typeset error:', err)
      );
    }
  }

  /**
   * Update theory values display
   */
  updateTheoryValues(theory) {
    this.ellValue.innerHTML = formatSigFigs(theory.ell);
    this.kappaValue.innerHTML = formatSigFigs(theory.kappa);
    this.betaValue.innerHTML = formatSigFigs(theory.beta);

    if (theory.tRise.isUndefined) {
      this.triseValue.innerHTML = 'undefined';
    } else {
      // Format t_rise with 3 decimal places, strip trailing zeros
      const formatted = theory.tRise.value.toFixed(3);
      // Remove trailing zeros and decimal point if integer
      this.triseValue.innerHTML = formatted.replace(/\.?0+$/, '');
    }
  }

  /**
   * Update tMax display
   */
  updateTMaxDisplay(tMax, formattedValue) {
    const display = document.getElementById('tMaxValue');
    if (display) {
      display.innerHTML = formattedValue;
    }
  }
}

// ============================================================================
// THEORY CALCULATIONS
// ============================================================================

(function() {
  'use strict';

  // Format number to 4 significant figures in scientific notation
  // Clean integers should display without decimal point
  function formatSigFigs(value) {
    if (value === 0) return '0';

    const absValue = Math.abs(value);
    const exp = Math.floor(Math.log10(absValue));
    const mantissa = value / Math.pow(10, exp);

    // Round to 4 sig figs
    const rounded = parseFloat(mantissa.toFixed(4));

    // Check if it's a clean integer (accounting for small numerical error)
    const reconstructed = rounded * Math.pow(10, exp);
    const isCleanInt = Math.abs(reconstructed - Math.round(reconstructed)) < 1e-10;

    if (isCleanInt) {
      return Math.round(reconstructed).toString();
    }

    // Otherwise display in scientific notation
    if (exp === 0) {
      return rounded.toString();
    }

    if (Math.abs(rounded - 1) < 1e-10) {
      return `10<sup>${exp}</sup>`;
    }

    return `${rounded}×10<sup>${exp}</sup>`;
  }

  // Calculate theory values
  function calculateTheory() {
    if (!window.VariableManager) {
      return;
    }

    const settings = window.VariableManager.getVariableSettings();
    const d = settings.length;

    if (d === 0) {
      document.getElementById('ellValue').innerHTML = '—';
      document.getElementById('kappaValue').innerHTML = '—';
      document.getElementById('betaValue').innerHTML = '—';
      document.getElementById('triseValue').innerHTML = '—';
      return;
    }

    // Extract a0 and k values
    const a0s = settings.map(s => s.a0);
    const ks = settings.map(s => s.k);

    // Calculate ell = sum of k_i
    const ell = ks.reduce((sum, k) => sum + k, 0);

    // Calculate kappa = prod(k_i^(k_i/2))
    let kappa = 1;
    for (let i = 0; i < d; i++) {
      kappa *= Math.pow(ks[i], ks[i] / 2);
    }

    // Calculate beta = (1/d) * sum(a_i(0)^2 / k_i)
    let betaSum = 0;
    for (let i = 0; i < d; i++) {
      betaSum += (a0s[i] * a0s[i]) / ks[i];
    }
    const beta = betaSum / d;

    // Calculate t_rise
    let triseDisplay;
    if (ell < 2) {
      triseDisplay = 'undefined';
    } else if (ell === 2) {
      const trise = -(1 / (2 * kappa)) * Math.log(beta / Math.sqrt(kappa));
      triseDisplay = formatSigFigs(trise);
    } else {
      const trise = (1 / kappa) * (1 / (ell - 2)) * (1 / Math.pow(beta, (ell - 2) / 2));
      triseDisplay = formatSigFigs(trise);
    }

    // Display values
    document.getElementById('ellValue').innerHTML = formatSigFigs(ell);
    document.getElementById('kappaValue').innerHTML = formatSigFigs(kappa);
    document.getElementById('betaValue').innerHTML = formatSigFigs(beta);
    document.getElementById('triseValue').innerHTML = triseDisplay;
  }

  // Export to global scope
  window.calculateTheory = calculateTheory;

  // Initialize
  function init() {
    console.log('Theory calculations initialized');
    calculateTheory();
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

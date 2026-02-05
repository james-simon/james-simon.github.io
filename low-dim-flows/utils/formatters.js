// ============================================================================
// NUMBER FORMATTING UTILITIES
// ============================================================================
// Single source of truth for all number formatting in the app

/**
 * Format number with scientific notation using HTML superscripts
 * Used for slider displays and small numbers
 */
export function formatScientific(value) {
  if (value >= 1) {
    return value.toString();
  }

  const exponent = Math.floor(Math.log10(value));
  const mantissa = value / Math.pow(10, exponent);
  const roundedMantissa = Math.round(mantissa * 1e10) / 1e10;

  if (Math.abs(roundedMantissa - 1) < 1e-10) {
    return `10<sup>${exponent}</sup>`;
  }

  return `${roundedMantissa}×10<sup>${exponent}</sup>`;
}

/**
 * Format number to specified significant figures
 * Detects clean integers and displays them without decimals
 * Otherwise uses scientific notation with HTML superscripts
 */
export function formatSigFigs(value, sigFigs = 4) {
  if (value === 0) return '0';
  if (!isFinite(value)) return 'undefined';

  const absValue = Math.abs(value);
  const exp = Math.floor(Math.log10(absValue));
  const mantissa = value / Math.pow(10, exp);

  // Round to specified sig figs
  const rounded = parseFloat(mantissa.toFixed(sigFigs));

  // Check if it's a clean integer (accounting for numerical error)
  const reconstructed = rounded * Math.pow(10, exp);
  const isCleanInt = Math.abs(reconstructed - Math.round(reconstructed)) < 1e-10;

  if (isCleanInt) {
    return Math.round(reconstructed).toString();
  }

  // Display in scientific notation
  if (exp === 0) {
    return rounded.toString();
  }

  if (Math.abs(rounded - 1) < 1e-10) {
    return `10<sup>${exp}</sup>`;
  }

  return `${rounded}×10<sup>${exp}</sup>`;
}

/**
 * Format tick labels for Chart.js - trim trailing zeros
 */
export function formatTickLabel(value, precision = 12) {
  return parseFloat(value.toPrecision(precision)).toString();
}

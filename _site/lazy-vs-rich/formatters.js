// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Format a number to 1 sig fig.
 * - Values >= 10: plain integer (e.g. 20, 300)
 * - Values < 10 but >= 1: plain (e.g. 3)
 * - Values < 1: scientific notation as LaTeX string (e.g. "3\\times10^{-2}")
 * Returns an HTML/LaTeX string suitable for MathJax inside $...$
 */
export function formatLatex(value) {
  if (value === 0) return '0';
  const absVal = Math.abs(value);
  const exp = Math.floor(Math.log10(absVal));
  const mantissa = Math.round(value / Math.pow(10, exp));

  if (exp >= 1) {
    // e.g. 20, 300 — just write as integer
    return String(Math.round(mantissa * Math.pow(10, exp)));
  } else if (exp === 0) {
    // e.g. 3, 7
    return String(mantissa);
  } else {
    // e.g. 3e-2 → "3\\times10^{-2}"
    if (mantissa === 1) return `10^{${exp}}`;
    return `${mantissa}\\times10^{${exp}}`;
  }
}

/**
 * Same but for plain HTML (no MathJax) — uses <sup> tags.
 */
export function formatHtml(value) {
  if (value === 0) return '0';
  const absVal = Math.abs(value);
  const exp = Math.floor(Math.log10(absVal));
  const mantissa = Math.round(value / Math.pow(10, exp));

  if (exp >= 1) {
    return String(Math.round(mantissa * Math.pow(10, exp)));
  } else if (exp === 0) {
    return String(mantissa);
  } else {
    if (mantissa === 1) return `10<sup>${exp}</sup>`;
    return `${mantissa}×10<sup>${exp}</sup>`;
  }
}

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatLatex(value) {
  if (value === 0) return '0';
  const absVal = Math.abs(value);
  const exp = Math.floor(Math.log10(absVal));
  const mantissa = Math.round(value / Math.pow(10, exp));

  if (exp >= 1) {
    return String(Math.round(mantissa * Math.pow(10, exp)));
  } else if (exp === 0) {
    return String(mantissa);
  } else {
    if (mantissa === 1) return `10^{${exp}}`;
    return `${mantissa}\\times10^{${exp}}`;
  }
}

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

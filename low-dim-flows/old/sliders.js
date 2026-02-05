// ============================================================================
// VALUE SLIDER UTILITIES
// ============================================================================

// Generic class for managing logarithmic value sliders
class ValueSlider {
  constructor(values, formatFn = null) {
    this.values = values;
    this.formatFn = formatFn || (v => v.toString());
  }

  // Convert slider position [0, 100] to actual value
  sliderToValue(sliderPosition) {
    const index = Math.round((sliderPosition / 100) * (this.values.length - 1));
    return this.values[index];
  }

  // Convert value to slider position [0, 100]
  valueToSlider(value) {
    let closestIndex = 0;
    let closestDist = Math.abs(Math.log10(value) - Math.log10(this.values[0]));
    for (let i = 1; i < this.values.length; i++) {
      const dist = Math.abs(Math.log10(value) - Math.log10(this.values[i]));
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }
    return (closestIndex / (this.values.length - 1)) * 100;
  }

  // Format value for display
  format(value) {
    return this.formatFn(value);
  }
}

// Generate discrete values: [1-9] × 10^k for given exponent range
function generateLogValues(minExp, maxExp) {
  const values = [];
  for (let k = minExp; k <= maxExp; k++) {
    const power = Math.pow(10, k);
    for (let mantissa = 1; mantissa <= 9; mantissa++) {
      values.push(mantissa * power);
    }
  }
  return values;
}

// Format scientific notation with HTML superscripts
function formatScientific(value) {
  if (value >= 1) {
    return value.toString();
  } else {
    const exponent = Math.floor(Math.log10(value));
    const mantissa = value / Math.pow(10, exponent);
    const roundedMantissa = Math.round(mantissa * 1e10) / 1e10;
    if (Math.abs(roundedMantissa - 1) < 1e-10) {
      return `10<sup>${exponent}</sup>`;
    } else {
      return `${roundedMantissa}×10<sup>${exponent}</sup>`;
    }
  }
}

// t_max slider: [1-9] × 10^k for k from -1 to 2 (0.1 to 100)
const T_MAX_VALUES = generateLogValues(-1, 2);
const tMaxSlider = new ValueSlider(T_MAX_VALUES, formatScientific);

// a0 slider: [1-9] × 10^k for k from -5 to 0, but stop at 1 (1e-5 to 1)
const A0_VALUES = generateLogValues(-5, 0).filter(v => v <= 1);
const a0Slider = new ValueSlider(A0_VALUES, formatScientific);

// k slider: integer values from 1 to 5
const K_VALUES = [1, 2, 3, 4, 5];
const kSlider = new ValueSlider(K_VALUES, v => v.toString());

// Export to window for use by other modules
window.a0Slider = a0Slider;
window.kSlider = kSlider;
window.tMaxSlider = tMaxSlider;

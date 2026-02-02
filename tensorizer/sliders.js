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

// Format value to 4 significant figures with scientific notation
function formatToSigFigs(value, sigFigs = 4) {
  if (value === 0) return '0';

  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / Math.pow(10, exponent);

  // Round mantissa to sigFigs significant figures
  const multiplier = Math.pow(10, sigFigs - 1);
  const roundedMantissa = Math.round(mantissa * multiplier) / multiplier;

  // If rounded to whole number and exponent is 0, just return the number
  if (exponent === 0 && Math.abs(roundedMantissa - Math.round(roundedMantissa)) < 1e-10) {
    return Math.round(roundedMantissa).toString();
  }

  // If mantissa rounds to 1, simplify
  if (Math.abs(roundedMantissa - 1) < 1e-10) {
    if (exponent === 0) {
      return '1';
    }
    return `10<sup>${exponent}</sup>`;
  }

  // If exponent is 0, just show the mantissa
  if (exponent === 0) {
    return roundedMantissa.toString();
  }

  return `${roundedMantissa}×10<sup>${exponent}</sup>`;
}

// Init scale slider: [1-9] × 10^k for k from -5 to 0, then 10
const INIT_SCALE_VALUES = [...generateLogValues(-5, 0), 10];
const initScaleSlider = new ValueSlider(INIT_SCALE_VALUES, formatScientific);

// Learning rate slider: [1-9] × 10^k for k from -4 to -1, then 1
const LEARNING_RATE_VALUES = [...generateLogValues(-4, -1), 1];
const learningRateSlider = new ValueSlider(LEARNING_RATE_VALUES, formatScientific);

// Dimension slider: logarithmic scale from 1 to 100
class DimensionSlider {
  sliderToValue(sliderPosition) {
    return Math.round(Math.pow(100, sliderPosition / 100));
  }

  valueToSlider(dimension) {
    return (Math.log(dimension) / Math.log(100)) * 100;
  }

  format(value) {
    return value.toString();
  }
}

const dimensionSlider = new DimensionSlider();

// Legacy function wrappers for backward compatibility
function sliderToInitScale(sliderValue) {
  return initScaleSlider.sliderToValue(sliderValue);
}

function initScaleToSlider(scale) {
  return initScaleSlider.valueToSlider(scale);
}

function formatInitScale(value) {
  return initScaleSlider.format(value);
}

function sliderToLearningRate(sliderValue) {
  return learningRateSlider.sliderToValue(sliderValue);
}

function learningRateToSlider(rate) {
  return learningRateSlider.valueToSlider(rate);
}

function formatLearningRate(value) {
  return learningRateSlider.format(value);
}

function sliderToDimension(sliderValue) {
  return dimensionSlider.sliderToValue(sliderValue);
}

function dimensionToSlider(dimension) {
  return dimensionSlider.valueToSlider(dimension);
}

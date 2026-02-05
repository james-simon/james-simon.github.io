// ============================================================================
// SLIDER UTILITIES
// ============================================================================
// Logarithmic slider mapping and value generation

import { CONFIG } from '../config.js';
import { formatScientific } from './formatters.js';

/**
 * ValueSlider: Maps slider position [0, 100] to/from actual values
 * Supports logarithmic spacing and custom formatting
 */
export class ValueSlider {
  constructor(values, formatFn = null) {
    this.values = values;
    this.formatFn = formatFn || (v => v.toString());
  }

  /**
   * Convert slider position [0, 100] to actual value
   */
  sliderToValue(sliderPosition) {
    const index = Math.round((sliderPosition / 100) * (this.values.length - 1));
    return this.values[index];
  }

  /**
   * Convert value to slider position [0, 100]
   * Finds closest value in log space
   */
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

  /**
   * Format value for display
   */
  format(value) {
    return this.formatFn(value);
  }
}

/**
 * Generate discrete logarithmic values: [1-9] × 10^k for given exponent range
 */
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

/**
 * Pre-configured slider instances for the app
 */
export const sliders = {
  tMax: new ValueSlider(
    generateLogValues(CONFIG.sliders.tMax.minExp, CONFIG.sliders.tMax.maxExp),
    formatScientific
  ),

  a0: new ValueSlider(
    generateLogValues(CONFIG.sliders.a0.minExp, CONFIG.sliders.a0.maxExp)
      .filter(v => v <= CONFIG.sliders.a0.maxValue),
    formatScientific
  ),

  k: new ValueSlider(
    CONFIG.sliders.k.values,
    v => v.toString()
  ),

  fStar: new ValueSlider(
    generateLogValues(CONFIG.sliders.fStar.minExp, CONFIG.sliders.fStar.maxExp)
      .filter(v => v <= 100),
    formatScientific
  )
};

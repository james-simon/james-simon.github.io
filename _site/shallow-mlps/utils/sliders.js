// ============================================================================
// SLIDER UTILITIES — logarithmic slider mapping
// ============================================================================

export function generateOneSigFigValues(min, max) {
  const values = [];
  let power = Math.floor(Math.log10(min));
  while (true) {
    const base = Math.pow(10, power);
    for (let digit = 1; digit <= 9; digit++) {
      const value = digit * base;
      if (value >= min && value <= max) values.push(value);
      if (value > max) return values;
    }
    power++;
  }
}

export class LogarithmicSlider {
  constructor(min, max) {
    this.values = generateOneSigFigValues(min, max);
  }

  sliderToValue(position) {
    const index = Math.round((position / 100) * (this.values.length - 1));
    return this.values[Math.max(0, Math.min(index, this.values.length - 1))];
  }

  valueToSlider(value) {
    let closestIndex = 0;
    let closestDist = Math.abs(value - this.values[0]);
    for (let i = 1; i < this.values.length; i++) {
      const dist = Math.abs(value - this.values[i]);
      if (dist < closestDist) { closestDist = dist; closestIndex = i; }
    }
    return (closestIndex / (this.values.length - 1)) * 100;
  }
}

// Integer slider: snaps to integer values in [min, max]
export class IntegerSlider {
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }

  sliderToValue(position) {
    return Math.round(this.min + (position / 100) * (this.max - this.min));
  }

  valueToSlider(value) {
    return ((value - this.min) / (this.max - this.min)) * 100;
  }
}

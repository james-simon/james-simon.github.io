// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Deep clone helper
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Convert slider position to dimension value (logarithmic scale: 1-100)
function sliderToDimension(sliderValue) {
  // Map [0, 100] to [1, 100] logarithmically
  return Math.round(Math.pow(100, sliderValue / 100));
}

// Convert dimension value to slider position (logarithmic scale: 1-100)
function dimensionToSlider(dimension) {
  // Map [1, 100] to [0, 100] logarithmically
  return (Math.log(dimension) / Math.log(100)) * 100;
}

// Generate all valid init scale values: [1-9] × 10^k for k from -5 to 0, then 10
function generateInitScaleValues() {
  const values = [];
  for (let k = -5; k <= 0; k++) {
    const power = Math.pow(10, k);
    for (let mantissa = 1; mantissa <= 9; mantissa++) {
      values.push(mantissa * power);
    }
  }
  values.push(10); // Add the final value 1×10^1
  return values;
}

const INIT_SCALE_VALUES = generateInitScaleValues();
console.log('INIT_SCALE_VALUES:', INIT_SCALE_VALUES.length, 'values from', INIT_SCALE_VALUES[0], 'to', INIT_SCALE_VALUES[INIT_SCALE_VALUES.length - 1]);

// Convert slider position to init scale value (discrete values from 10^-5 to 10^1)
function sliderToInitScale(sliderValue) {
  // Map [0, 100] to indices in INIT_SCALE_VALUES
  const index = Math.round((sliderValue / 100) * (INIT_SCALE_VALUES.length - 1));
  return INIT_SCALE_VALUES[index];
}

// Convert init scale value to slider position
function initScaleToSlider(scale) {
  // Find closest value in INIT_SCALE_VALUES
  let closestIndex = 0;
  let closestDist = Math.abs(Math.log10(scale) - Math.log10(INIT_SCALE_VALUES[0]));
  for (let i = 1; i < INIT_SCALE_VALUES.length; i++) {
    const dist = Math.abs(Math.log10(scale) - Math.log10(INIT_SCALE_VALUES[i]));
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = i;
    }
  }
  return (closestIndex / (INIT_SCALE_VALUES.length - 1)) * 100;
}

// Generate all valid learning rate values: [1-9] × 10^k for k from -5 to 0
function generateLearningRateValues() {
  const values = [];
  for (let k = -5; k <= 0; k++) {
    const power = Math.pow(10, k);
    for (let mantissa = 1; mantissa <= 9; mantissa++) {
      values.push(mantissa * power);
    }
  }
  return values;
}

const LEARNING_RATE_VALUES = generateLearningRateValues();
console.log('LEARNING_RATE_VALUES:', LEARNING_RATE_VALUES.length, 'values from', LEARNING_RATE_VALUES[0], 'to', LEARNING_RATE_VALUES[LEARNING_RATE_VALUES.length - 1]);

// Convert slider position to learning rate value (discrete values from 10^-5 to 1)
function sliderToLearningRate(sliderValue) {
  // Map [0, 100] to indices in LEARNING_RATE_VALUES
  const index = Math.round((sliderValue / 100) * (LEARNING_RATE_VALUES.length - 1));
  return LEARNING_RATE_VALUES[index];
}

// Convert learning rate value to slider position
function learningRateToSlider(rate) {
  // Find closest value in LEARNING_RATE_VALUES
  let closestIndex = 0;
  let closestDist = Math.abs(Math.log10(rate) - Math.log10(LEARNING_RATE_VALUES[0]));
  for (let i = 1; i < LEARNING_RATE_VALUES.length; i++) {
    const dist = Math.abs(Math.log10(rate) - Math.log10(LEARNING_RATE_VALUES[i]));
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = i;
    }
  }
  return (closestIndex / (LEARNING_RATE_VALUES.length - 1)) * 100;
}

// Format learning rate for display using HTML superscripts
function formatLearningRate(value) {
  if (value >= 1) {
    // Show as regular number for values >= 1
    return value.toString();
  } else {
    // Show in scientific notation with HTML superscripts for values < 1
    const exponent = Math.floor(Math.log10(value));
    const mantissa = value / Math.pow(10, exponent);
    // Round to avoid floating point precision issues
    const roundedMantissa = Math.round(mantissa * 1e10) / 1e10;
    if (Math.abs(roundedMantissa - 1) < 1e-10) {
      return `10<sup>${exponent}</sup>`;
    } else {
      return `${roundedMantissa}×10<sup>${exponent}</sup>`;
    }
  }
}

// Map dimension to line width (1px at dimension=1, 15px at dimension=100)
function dimensionToLineWidth(dimension) {
  return 1 + 14 * Math.log(dimension) / Math.log(100);
}

// Format init scale for display using HTML superscripts
function formatInitScale(value) {
  if (value >= 1) {
    // Show as regular number for values >= 1
    return value.toString();
  } else {
    // Show in scientific notation with HTML superscripts for values < 1
    const exponent = Math.floor(Math.log10(value));
    const mantissa = value / Math.pow(10, exponent);
    // Round to avoid floating point precision issues
    const roundedMantissa = Math.round(mantissa * 1e10) / 1e10;
    if (Math.abs(roundedMantissa - 1) < 1e-10) {
      return `10<sup>${exponent}</sup>`;
    } else {
      return `${roundedMantissa}×10<sup>${exponent}</sup>`;
    }
  }
}

// Generate leg name (i, j, k, ..., z, ia, ib, ...)
function getLegName(id) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let num = id + LEG_LETTER_START;
  let name = '';

  // Try single letters first
  if (num < 26) {
    return letters[num];
  }

  // Double letters (ia, ib, ...)
  num -= 26;
  const first = Math.floor(num / 26) + LEG_LETTER_START;
  const second = num % 26;
  return letters[first] + letters[second];
}

// Generate next tensor name (A, B, C, ..., Z, AA, AB, ...)
function getNextTensorName() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const usedNames = new Set(tensors.map(t => t.name));

  // Try single letters first
  for (let i = 0; i < 26; i++) {
    const name = letters[i];
    if (!usedNames.has(name)) {
      return name;
    }
  }

  // Try double letters (AA, AB, ...)
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const name = letters[i] + letters[j];
      if (!usedNames.has(name)) {
        return name;
      }
    }
  }

  // Fallback to triple letters if needed
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      for (let k = 0; k < 26; k++) {
        const name = letters[i] + letters[j] + letters[k];
        if (!usedNames.has(name)) {
          return name;
        }
      }
    }
  }

  // Final fallback
  return 'X' + Date.now();
}

// Remove any self-loops (legs connecting a tensor to itself)
function removeSelfLoops() {
  const initialLength = legs.length;
  legs = legs.filter(leg => {
    // Keep the leg if it's not a self-loop
    return !(leg.startTensor && leg.endTensor && leg.startTensor === leg.endTensor);
  });

  if (legs.length < initialLength) {
    console.log('Removed', initialLength - legs.length, 'self-loop(s)');
  }
}

// Remove any legs with no tensor connections (both ends free)
function removeUnconnectedLegs() {
  const initialLength = legs.length;
  legs = legs.filter(leg => {
    // Keep the leg only if at least one end is connected to a tensor
    return leg.startTensor || leg.endTensor;
  });

  if (legs.length < initialLength) {
    console.log('Removed', initialLength - legs.length, 'unconnected leg(s)');
  }
}

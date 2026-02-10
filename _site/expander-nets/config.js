// ============================================================================
// CONFIGURATION
// ============================================================================
// Application constants and configuration

/**
 * Network visualization constants
 */
export const NETWORK_VIZ = {
  WIDTH: 400,
  GAP: 6,           // Gap between trapezoids and lines
  PADDING: 10,      // Padding to prevent clipping
  LABEL_SPACE: 50,  // Extra space for labels above/below
  BASE_HEIGHT: 20,  // Base multiplier for height calculation
  NUM_LAYERS: 4
};

/**
 * Slider configuration
 */
export const SLIDERS = {
  k: {
    min: 10,
    max: 30000
  },
  eta: {
    min: 0.0001,
    max: 1
  },
  batchSize: {
    min: 1,
    max: 1000
  },
  gamma: {
    min: 0.0001,
    max: 1
  },
  alpha: {
    min: 0,
    max: 100
  },
  d: {
    min: 1,
    max: 5
  }
};

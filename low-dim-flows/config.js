// ============================================================================
// CONFIGURATION
// ============================================================================
// Central location for all constants and configuration values

export const CONFIG = {
  // Simulation parameters
  simulation: {
    dt: 0.01,           // Time step for RK4 integration
    defaultTMax: 10,    // Default max time
    defaultFStar: 1,    // Default target value f*
    defaultC: 1,        // Default coefficient c
    adaptiveStoppingThreshold: 0.01,  // Stop when loss drops to 1% of initial
    hardCapTime: 3000   // Maximum simulation time (hard stop)
  },

  // Variable constraints
  variables: {
    min: 1,
    max: 5,
    defaultA0: 0.01,
    defaultK: 1
  },

  // Slider ranges
  sliders: {
    a0: {
      minExp: -5,       // 1e-5
      maxExp: 0,        // 1
      maxValue: 1       // Cap at 1, not 10
    },
    k: {
      values: [1, 2, 3, 4, 5]
    },
    tMax: {
      minExp: -1,       // 0.1
      maxExp: 3,        // 1000
      maxValue: 3000    // Cap at 3000
    },
    fStar: {
      minExp: -2,       // 0.01
      maxExp: 2         // 100
    },
    c: {
      minExp: -4,       // 0.0001
      maxExp: 1         // 10
    }
  },

  // Chart styling
  charts: {
    lineWidth: 3,
    fontSize: 14,
    labelFontSize: 17.5,
    legendFontSize: 13,
    logScalePadding: 3,
    linearScalePadding: 1.2,
    precision: 12,      // For tick label formatting
    maxDisplayPoints: 2000  // Downsample to this many points for plotting
  },

  // Color scheme (NO YELLOW!)
  colors: {
    parameters: [
      'rgb(220, 100, 120)',  // darker pink/rose
      'rgb(230, 140, 80)',   // darker orange
      'rgb(120, 180, 100)',  // darker green
      'rgb(100, 150, 220)',  // darker blue
      'rgb(160, 100, 180)'   // darker purple
    ],
    loss: 'rgb(40, 130, 130)'  // darker teal
  },

  // LocalStorage key for persistence
  storage: {
    key: 'low-dim-flows-state'
  }
};

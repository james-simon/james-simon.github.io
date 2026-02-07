// ============================================================================
// APPLICATION STATE
// ============================================================================
// Single source of truth for all UI state with localStorage persistence

const STORAGE_KEY = 'expander-nets-state';

// Default values
const DEFAULTS = {
  d: 3,
  k: 1000,
  gamma: 0.1,
  alpha: 0,
  eta: 0.01,
  batchSize: 100,
  logScale: false,
  xAxisMode: 'step',
  emaWindow: 1
};

export class AppState {
  constructor() {
    // UI parameters
    this.d = DEFAULTS.d;
    this.k = DEFAULTS.k;
    this.gammaValues = Array(5).fill(DEFAULTS.gamma);
    this.alphaValues = Array(5).fill(DEFAULTS.alpha);
    this.eta = DEFAULTS.eta;
    this.batchSize = DEFAULTS.batchSize;
    this.logScale = DEFAULTS.logScale;
    this.xAxisMode = DEFAULTS.xAxisMode;
    this.emaWindow = DEFAULTS.emaWindow;
  }

  /**
   * Serialize state to plain object for localStorage
   */
  toJSON() {
    return {
      d: this.d,
      k: this.k,
      gammaValues: this.gammaValues,
      alphaValues: this.alphaValues,
      eta: this.eta,
      batchSize: this.batchSize,
      logScale: this.logScale,
      xAxisMode: this.xAxisMode,
      emaWindow: this.emaWindow
    };
  }

  /**
   * Restore state from plain object
   */
  fromJSON(json) {
    if (!json) return;

    if (json.d !== undefined) {
      this.d = Math.max(1, Math.min(5, json.d));
    }

    if (json.k !== undefined) {
      this.k = json.k;
    }

    if (Array.isArray(json.gammaValues)) {
      for (let i = 0; i < Math.min(json.gammaValues.length, 5); i++) {
        this.gammaValues[i] = json.gammaValues[i] ?? DEFAULTS.gamma;
      }
    }

    if (Array.isArray(json.alphaValues)) {
      for (let i = 0; i < Math.min(json.alphaValues.length, 5); i++) {
        this.alphaValues[i] = json.alphaValues[i] ?? DEFAULTS.alpha;
      }
    }

    if (json.eta !== undefined) {
      this.eta = json.eta;
    }

    if (json.batchSize !== undefined) {
      this.batchSize = json.batchSize;
    }

    if (json.logScale !== undefined) {
      this.logScale = json.logScale;
    }

    if (json.xAxisMode !== undefined) {
      this.xAxisMode = json.xAxisMode;
    }

    if (json.emaWindow !== undefined) {
      this.emaWindow = json.emaWindow;
    }
  }

  /**
   * Save state to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  /**
   * Load state from localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.fromJSON(JSON.parse(saved));
        return true;
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
    }
    return false;
  }

  /**
   * Reset all parameters to defaults
   */
  resetToDefaults() {
    this.d = DEFAULTS.d;
    this.k = DEFAULTS.k;
    this.gammaValues = Array(5).fill(DEFAULTS.gamma);
    this.alphaValues = Array(5).fill(DEFAULTS.alpha);
    this.eta = DEFAULTS.eta;
    this.batchSize = DEFAULTS.batchSize;
    this.logScale = DEFAULTS.logScale;
    this.xAxisMode = DEFAULTS.xAxisMode;
    this.emaWindow = DEFAULTS.emaWindow;
  }
}

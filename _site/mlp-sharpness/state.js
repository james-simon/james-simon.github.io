// ============================================================================
// STATE — slider values with localStorage persistence
// ============================================================================

const STORAGE_KEY = 'mlp-sharpness-state';

const DEFAULTS = {
  depth:           2,          // number of weight matrices (2 = one hidden layer)
  hiddenDim:       20,         // hidden layer width
  activation:      'tanh',     // relu | tanh | gelu | linear
  parameterization:'sp',       // sp | mup
  centered:        false,      // subtract f(0) from network output
  useBias:         false,      // add bias terms to each layer
  targetType:      'chebyshev',// chebyshev | sinusoid | monomial
  targetDegree:    6,          // integer slider
  nPoints:         20,         // number of training points
  initScale:       1.0,        // σ: multiplies all init stds
  eta:             0.01,       // learning rate
  hessianInterval: 10,
  maxStepsPerSec:  Infinity,
  visiblePlots:    ['loss', 'sharpness', 'function'],
  plotOptions:     {},
};

export class AppState {
  constructor() { Object.assign(this, DEFAULTS); }

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const key of Object.keys(DEFAULTS)) {
          if (parsed[key] !== undefined) this[key] = parsed[key];
        }
        if (parsed.maxStepsPerSec === null) this.maxStepsPerSec = Infinity;
      }
    } catch (e) { console.warn('Could not load state:', e); }
  }

  save() {
    try {
      const obj = {};
      for (const key of Object.keys(DEFAULTS)) obj[key] = this[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) { console.warn('Could not save state:', e); }
  }
}

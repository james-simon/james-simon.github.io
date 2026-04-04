// ============================================================================
// STATE — slider values with localStorage persistence
// ============================================================================

const STORAGE_KEY = 'dln-sharpness-state';

const DEFAULTS = {
  depth:           2,          // 2, 3, or 4
  width:           4,          // integer 2–10
  initScale:       0.1,        // log slider
  eta:             0.001,      // log slider
  hessianInterval: 10,         // compute sharpness every N steps (0 = off)
  maxStepsPerSec:  Infinity,   // throttle; Infinity = no limit
  visiblePlots:    ['loss', 'productSVs'],
  plotOptions:     {},         // { [key]: { logX, logY } }
};

export class AppState {
  constructor() {
    Object.assign(this, DEFAULTS);
  }

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const key of Object.keys(DEFAULTS)) {
          if (parsed[key] !== undefined) this[key] = parsed[key];
        }
        // Infinity serializes as null in JSON
        if (parsed.maxStepsPerSec === null) this.maxStepsPerSec = Infinity;
      }
    } catch (e) {
      console.warn('Could not load state:', e);
    }
  }

  save() {
    try {
      const obj = {};
      for (const key of Object.keys(DEFAULTS)) obj[key] = this[key];
      // Infinity → null survives round-trip (we restore it in load)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }
}

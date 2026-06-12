// ============================================================================
// STATE — persisted app settings
// ============================================================================

const STORAGE_KEY = 'driving-problem-state';

const DEFAULTS = {
  din:         5,
  dh:          10,
  dout:        1,
  act:         'relu',
  xDist:       'gaussian',
  nSamples:    1000,
  maxStepsPerSec: Infinity,
  emaWindow:      20,
};

export class AppState {
  constructor() { Object.assign(this, DEFAULTS); }

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const p = JSON.parse(saved);
      for (const k of Object.keys(DEFAULTS)) {
        if (p[k] !== undefined) this[k] = p[k];
      }
      if (p.maxStepsPerSec === null) this.maxStepsPerSec = Infinity;
    } catch(e) { console.warn('state load failed', e); }
  }

  save() {
    try {
      const obj = {};
      for (const k of Object.keys(DEFAULTS)) obj[k] = this[k];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch(e) { console.warn('state save failed', e); }
  }
}

// ============================================================================
// STATE — slider values with localStorage persistence
// ============================================================================

const STORAGE_KEY = 'shallow-mlps-state';

const DEFAULTS = {
  n:           100,
  d:           10,
  numTerms:    2,
  targetType:  'staircase',
  batchSize:   200,
  eta:         0.01,
  alpha:       1,
  activation:  'relu',
  manualSeed:  false,
  seedValue:   0,
  emaPos:      0,
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
      }
    } catch (e) {
      console.warn('Could not load state:', e);
    }
  }

  save() {
    try {
      const obj = {};
      for (const key of Object.keys(DEFAULTS)) obj[key] = this[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }

  resetToDefaults() {
    Object.assign(this, DEFAULTS);
    this.save();
  }
}

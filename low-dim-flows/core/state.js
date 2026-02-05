// ============================================================================
// APPLICATION STATE
// ============================================================================
// Single source of truth for all application state with pub/sub pattern
// Supports serialization for localStorage persistence

import { CONFIG } from '../config.js';

/**
 * AppState: Observable state management
 * Notifies listeners on any state change for reactive updates
 */
export class AppState {
  constructor() {
    // Variable state (always keep 5, only first numVariables are active)
    this.numVariables = 1;
    this.variables = Array(CONFIG.variables.max).fill(null).map(() => ({
      a0: CONFIG.variables.defaultA0,
      k: CONFIG.variables.defaultK
    }));

    // Global parameters
    this.tMax = CONFIG.simulation.defaultTMax;
    this.fStar = CONFIG.simulation.defaultFStar;
    this.logScale = false;
    this.showBalanced = true;

    // Observer pattern
    this.listeners = [];
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener) {
    this.listeners.push(listener);
  }

  /**
   * Notify all listeners of state change
   */
  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  /**
   * Update a single variable's parameters
   */
  setVariable(index, { a0, k }) {
    if (index < 0 || index >= CONFIG.variables.max) return;

    if (a0 !== undefined) this.variables[index].a0 = a0;
    if (k !== undefined) this.variables[index].k = k;

    this.notify();
  }

  /**
   * Set number of active variables
   */
  setNumVariables(n) {
    if (n < CONFIG.variables.min || n > CONFIG.variables.max) return;
    this.numVariables = n;
    this.notify();
  }

  /**
   * Add one variable
   */
  addVariable() {
    if (this.numVariables < CONFIG.variables.max) {
      this.numVariables++;
      this.notify();
    }
  }

  /**
   * Remove one variable
   */
  removeVariable() {
    if (this.numVariables > CONFIG.variables.min) {
      this.numVariables--;
      this.notify();
    }
  }

  /**
   * Set maximum time for simulation
   */
  setTMax(t) {
    this.tMax = t;
    this.notify();
  }

  /**
   * Set target value f*
   */
  setFStar(f) {
    this.fStar = f;
    this.notify();
  }

  /**
   * Toggle logscale mode
   */
  toggleLogScale() {
    this.logScale = !this.logScale;
    this.notify();
  }

  /**
   * Toggle balanced simulation visibility
   */
  toggleShowBalanced() {
    this.showBalanced = !this.showBalanced;
    this.notify();
  }

  /**
   * Reset all parameters to defaults
   */
  resetToDefaults() {
    // Reset number of variables
    this.numVariables = 1;

    // Reset all variable parameters to defaults
    for (let i = 0; i < CONFIG.variables.max; i++) {
      this.variables[i] = {
        a0: CONFIG.variables.defaultA0,
        k: CONFIG.variables.defaultK
      };
    }

    // Reset global parameters
    this.tMax = CONFIG.simulation.defaultTMax;
    this.fStar = CONFIG.simulation.defaultFStar;
    this.logScale = false;
    this.showBalanced = true;

    this.notify();
  }

  /**
   * Get only the active variables
   */
  getActiveVariables() {
    return this.variables.slice(0, this.numVariables);
  }

  /**
   * Serialize state to plain object for localStorage
   */
  toJSON() {
    return {
      numVariables: this.numVariables,
      variables: this.variables,
      tMax: this.tMax,
      fStar: this.fStar,
      logScale: this.logScale,
      showBalanced: this.showBalanced
    };
  }

  /**
   * Restore state from plain object
   */
  fromJSON(json) {
    if (!json) return;

    if (json.numVariables !== undefined) {
      this.numVariables = Math.max(
        CONFIG.variables.min,
        Math.min(CONFIG.variables.max, json.numVariables)
      );
    }

    if (Array.isArray(json.variables)) {
      // Validate and restore variable data
      for (let i = 0; i < Math.min(json.variables.length, CONFIG.variables.max); i++) {
        if (json.variables[i]) {
          this.variables[i] = {
            a0: json.variables[i].a0 ?? CONFIG.variables.defaultA0,
            k: json.variables[i].k ?? CONFIG.variables.defaultK
          };
        }
      }
    }

    if (json.tMax !== undefined) {
      this.tMax = json.tMax;
    }

    if (json.fStar !== undefined) {
      this.fStar = json.fStar;
    }

    if (json.logScale !== undefined) {
      this.logScale = json.logScale;
    }

    if (json.showBalanced !== undefined) {
      this.showBalanced = json.showBalanced;
    }

    // Don't notify on restore - caller should trigger update
  }

  /**
   * Save state to localStorage
   */
  save() {
    try {
      localStorage.setItem(CONFIG.storage.key, JSON.stringify(this.toJSON()));
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
    }
  }

  /**
   * Load state from localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem(CONFIG.storage.key);
      if (saved) {
        this.fromJSON(JSON.parse(saved));
        return true;
      }
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
    }
    return false;
  }
}

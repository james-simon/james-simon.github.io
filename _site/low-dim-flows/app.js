// ============================================================================
// LOW-DIMENSIONAL FLOWS - MAIN APPLICATION
// ============================================================================
// Orchestrates all modules and manages application lifecycle

import { AppState } from './core/state.js';
import { solveODE, solveBalancedInit } from './core/simulation.js';
import { calculateAllTheory } from './core/theory.js';
import { ChartManager } from './ui/charts.js';
import { ControlsManager } from './ui/controls.js';
import { DisplayManager } from './ui/display.js';

/**
 * LowDimFlowsApp: Main application controller
 * Single entry point, coordinates all subsystems
 */
class LowDimFlowsApp {
  constructor() {
    // Initialize state (single source of truth)
    this.state = new AppState();

    // Initialize UI managers
    this.charts = new ChartManager();
    this.controls = new ControlsManager(this.state);
    this.display = new DisplayManager();

    // Subscribe to state changes for reactive updates
    this.state.subscribe(() => this.onStateChange());
  }

  /**
   * Initialize application
   */
  init() {
    console.log('Low-Dimensional Flows initializing...');

    // Try to restore saved state
    const restored = this.state.load();
    if (restored) {
      console.log('Restored state from localStorage');
    }

    // Initialize all UI components
    this.charts.init();
    this.controls.init();
    this.attachGlobalControls();

    // Initial render (includes restored state if any)
    this.onStateChange();

    console.log('Low-Dimensional Flows initialized successfully');
  }


  /**
   * Handle state changes (reactive updates)
   */
  onStateChange() {
    // Get active variables
    const vars = this.state.getActiveVariables();
    const a0Vec = vars.map(v => v.a0);
    const kVec = vars.map(v => v.k);

    // Run main simulation
    const solution = solveODE(a0Vec, kVec, this.state.tMax, this.state.fStar, this.state.c);

    // Calculate and display theory
    const theory = calculateAllTheory(a0Vec, kVec, this.state.fStar, this.state.c);
    this.display.updateTheoryValues(theory);

    // Run effective balanced initial condition simulation
    let balancedSolution = null;
    if (!isNaN(theory.betaEffective)) {
      // Use same time extent as main simulation
      const dt = solution.times.length > 1 ? solution.times[1] - solution.times[0] : 0.01;
      const tMaxBalanced = solution.times[solution.times.length - 1];
      balancedSolution = solveBalancedInit(a0Vec, kVec, tMaxBalanced, this.state.fStar, this.state.c, theory.betaEffective, dt);
    }

    // Update charts (pass t_rise for vertical line and balanced solution)
    this.charts.update(solution, this.state.numVariables, this.state.logScale, theory.tRise, balancedSolution, this.state.showBalanced);

    // Update loss equation
    this.display.updateLossEquation(this.state.numVariables, this.state.fStar, this.state.c, kVec);
  }

  /**
   * Attach event listeners for global controls (logscale, reset)
   */
  attachGlobalControls() {
    // Reset button
    const resetButton = document.getElementById('resetButton');
    resetButton.addEventListener('click', () => {
      this.state.resetToDefaults();
      this.state.save();
      // Re-render controls to reset all variable sliders
      this.controls.render();
      this.controls.updateButtonStates();
    });

    // Logscale checkbox
    const logScaleCheckbox = document.getElementById('logScaleCheckbox');
    logScaleCheckbox.checked = this.state.logScale;

    logScaleCheckbox.addEventListener('change', () => {
      this.state.toggleLogScale();
      this.state.save();
    });

    // Show balanced checkbox
    const showBalancedCheckbox = document.getElementById('showBalancedCheckbox');
    showBalancedCheckbox.checked = this.state.showBalanced;

    showBalancedCheckbox.addEventListener('change', () => {
      this.state.toggleShowBalanced();
      this.state.save();
    });
  }
}

// ============================================================================
// APPLICATION ENTRY POINT
// ============================================================================

// Wait for DOM and MathJax to be ready
function initializeWhenReady() {
  // Create and initialize app
  const app = new LowDimFlowsApp();
  app.init();

  // Expose to window for debugging (only expose app, not individual modules)
  window.app = app;
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWhenReady);
} else {
  initializeWhenReady();
}

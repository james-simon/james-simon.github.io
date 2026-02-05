// ============================================================================
// LOW-DIMENSIONAL FLOWS - MAIN APPLICATION
// ============================================================================
// Orchestrates all modules and manages application lifecycle

import { AppState } from './core/state.js';
import { solveODE } from './core/simulation.js';
import { calculateAllTheory } from './core/theory.js';
import { ChartManager } from './ui/charts.js';
import { ControlsManager } from './ui/controls.js';
import { DisplayManager } from './ui/display.js';
import { sliders } from './utils/sliders.js';

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

    // If state was restored, update UI to match
    if (restored) {
      this.updateGlobalSliderDisplays();
    }

    // Initial render
    this.onStateChange();

    console.log('Low-Dimensional Flows initialized successfully');
  }

  /**
   * Update global slider displays (for reset)
   */
  updateGlobalSliderDisplays() {
    const tMaxSlider = document.getElementById('tMaxSlider');
    const tMaxValue = document.getElementById('tMaxValue');
    const logScaleCheckbox = document.getElementById('logScaleCheckbox');

    tMaxSlider.value = sliders.tMax.valueToSlider(this.state.tMax);
    tMaxValue.innerHTML = sliders.tMax.format(this.state.tMax);

    logScaleCheckbox.checked = this.state.logScale;
  }

  /**
   * Handle state changes (reactive updates)
   */
  onStateChange() {
    // Get active variables
    const vars = this.state.getActiveVariables();
    const a0Vec = vars.map(v => v.a0);
    const kVec = vars.map(v => v.k);

    // Run simulation
    const solution = solveODE(a0Vec, kVec, this.state.tMax, this.state.fStar);

    // Calculate and display theory
    const theory = calculateAllTheory(a0Vec, kVec, this.state.fStar);
    this.display.updateTheoryValues(theory);

    // Update charts (pass t_rise for vertical line)
    this.charts.update(solution, this.state.numVariables, this.state.logScale, theory.tRise);

    // Update loss equation
    this.display.updateLossEquation(this.state.numVariables, this.state.fStar, kVec);
  }

  /**
   * Attach event listeners for global controls (tMax, logscale, reset)
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
      // Update global slider displays to match reset state
      this.updateGlobalSliderDisplays();
    });

    // tMax slider
    const tMaxSlider = document.getElementById('tMaxSlider');
    const tMaxValue = document.getElementById('tMaxValue');

    // Initialize display
    const initialTMax = sliders.tMax.sliderToValue(tMaxSlider.value);
    this.state.tMax = initialTMax;
    tMaxValue.innerHTML = sliders.tMax.format(initialTMax);

    // Update on slider change
    tMaxSlider.addEventListener('input', () => {
      const tMax = sliders.tMax.sliderToValue(tMaxSlider.value);
      tMaxValue.innerHTML = sliders.tMax.format(tMax);
      this.state.setTMax(tMax);
      this.state.save();
    });

    // Logscale checkbox
    const logScaleCheckbox = document.getElementById('logScaleCheckbox');
    logScaleCheckbox.checked = this.state.logScale;

    logScaleCheckbox.addEventListener('change', () => {
      this.state.toggleLogScale();
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

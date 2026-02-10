# Expander Nets Refactoring Summary

## Overview
Refactored the codebase from a monolithic 1103-line `app.js` into a modular structure with clear separation of concerns.

## New Structure

### Core Files

**app.js** (190 lines) - Main entry point
- Imports and initializes all managers
- Network visualization rendering
- Start/pause button handler
- Reset button handler
- Minimal orchestration only

**config.js** (46 lines) - Configuration constants
- `NETWORK_VIZ` - SVG visualization parameters
- `SLIDERS` - Slider min/max ranges

### Core Module (Theory Calculations)

**core/theory.js** (166 lines) - Pure calculation functions
- `calculateOrderOfFStar()` - |α| = Σ αᵢ
- `calculateEll()` - ℓ = |α| + 1
- `calculateRateConstant()` - c = √(Πᵢ γᵢ^αᵢ / |α|!)
- `calculateKappa()` - κ = Πᵢ αᵢ^(αᵢ/2)
- `calculateBeta()` - β mean core parameter
- `calculateShapeParams()` - rᵢ shape parameters
- `calculateShapeIntegral()` - F(r) using numerical integration
- `calculateRiseTime()` - t_rise (piecewise function)
- `calculateAllTheory()` - Main function that computes all theory values

All functions are pure (no side effects, no DOM manipulation) and testable.

### UI Module

**ui/display.js** (172 lines) - DOM updates and MathJax rendering
- `DisplayManager` class
- `updateModelingOdeFormula()` - Dynamic LaTeX formula generation
- `updateRateConstantFormula()` - Rate constant formula with values
- `updateTheoryValues()` - Update all theory metric displays
- `renderMathJax()` - MathJax typesetting helper

**ui/controls.js** (274 lines) - Slider initialization and event handlers
- `ControlsManager` class
- `initializeKSlider()`, `initializeDSlider()`, etc.
- `renderGammaSliders()`, `renderAlphaSliders()` - Dynamic slider rendering
- `renderParameterSliders()` - Generic slider rendering function
- `updateTargetFunctionEquation()` - Update f* equation
- `updateTheoryCalculations()` - Trigger theory recalculation
- Event handlers for all parameter changes

**ui/charts.js** (157 lines) - Chart initialization and controls
- `ChartsManager` class
- Wraps LossChart and NormChart from visualization.js
- `setupLogScaleControl()` - Logscale checkbox
- `setupXAxisModeControl()` - Step vs t_eff toggle
- `setupEmaControl()` - EMA window slider
- Applies saved state on initialization

### Utils Module

**utils/sliders.js** (103 lines) - Slider utilities
- `generateOneSigFigValues()` - Generate logarithmic slider values
- `formatScientific()` - Format with HTML superscripts
- `LogarithmicSlider` class - Map slider position ↔ value
- `LogarithmicSliderWithOff` class - Variant for optional parameters

**utils/formatters.js** (48 lines) - Number formatting
- `formatForLatex()` - Format numbers for LaTeX display with scientific notation

**utils/integration.js** (119 lines) - Numerical integration
- `computeShapeIntegral()` - Adaptive Simpson's rule for shape integral

### Existing Files (Unchanged)
- `state.js` (140 lines) - State management
- `simulation.js` (284 lines) - Simulation loop
- `model.js` (115 lines) - Neural network model
- `target.js` (76 lines) - Target function (Hermite polynomials)
- `training.js` (193 lines) - Training logic
- `visualization.js` (444 lines) - Chart.js wrappers
- `ema.js` (93 lines) - EMA calculation
- `incremental-cache.js` (224 lines) - Performance optimization

## File Size Comparison

### Before
- app.js: **1103 lines** (monolithic, everything mixed together)

### After
- app.js: **190 lines** (orchestration only)
- core/theory.js: **166 lines** (pure calculations)
- ui/display.js: **172 lines** (DOM updates)
- ui/controls.js: **274 lines** (sliders & events)
- ui/charts.js: **157 lines** (chart initialization)
- utils/sliders.js: **103 lines** (slider utilities)
- config.js: **46 lines** (constants)

**Total: ~1108 lines across 7 focused files (same functionality, much better organized)**

## Benefits

1. **Clear Separation of Concerns**
   - Theory calculations are pure functions
   - UI updates are separated from logic
   - Event handling is centralized in controls manager

2. **Testability**
   - Pure calculation functions can be unit tested
   - No DOM dependencies in core logic

3. **Maintainability**
   - Each file has a single, clear purpose
   - File sizes are manageable (< 300 lines each)
   - Easy to find and modify specific functionality

4. **Follows Low-Dim-Flows Pattern**
   - Similar structure to the mature low-dim-flows codebase
   - Easy for developers familiar with that project

5. **Reusability**
   - Theory calculations can be used in other contexts
   - Slider utilities can be shared across projects

## Migration Notes

- Original `app.js` backed up as `app.js.backup`
- All functionality preserved
- No breaking changes to public API
- Build tested and successful

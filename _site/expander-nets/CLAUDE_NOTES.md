# Expander Nets - Project Structure and Implementation Notes

## Overview
This is an interactive visualization for training "expander nets" - neural networks with a specific architecture designed to learn Hermite polynomial target functions. The project includes both experimental simulation (gradient descent) and theoretical predictions (ODE solver).

## Architecture

### Network Structure
- **Input dimension**: d (user configurable, 1-5)
- **Hidden dimension**: k (large, typically 1000)
- **Layers**:
  - W₁: d×d diagonal matrix (trainable)
  - W_froz: d×k fixed random Gaussian matrix (frozen)
  - W₂: k×1 trainable weights
- **Forward pass**: `f(x) = W₂ᵀ · σ(W_froz · W₁ · x)`
  where σ is ReLU activation

### Target Function
- Product of normalized Hermite polynomials: `f*(x) = ∏ᵢ h_αᵢ(xᵢ/√γᵢ)`
- Uses **normalized probabilist's Hermite polynomials**: `h_α(z) = He_α(z) / √(α!)`
  - h₀(z) = 1
  - h₁(z) = z
  - h₂(z) = (z² - 1) / √2
  - h₃(z) = (z³ - 3z) / √6
- Parameters:
  - `αᵢ` (alpha): polynomial degree for dimension i
  - `γᵢ` (gamma): normalization scale for dimension i

## File Structure

### Core Logic
- **`app.js`**: Main application entry point
  - Initializes AppState, managers, and simulation
  - Sets up network visualization
  - Handles start/pause/reset buttons
  - **CRITICAL THEORY LOGIC**: Only recomputes theory in "preview mode" (before simulation has data)
  - Once simulation starts, theory is "locked" to captured parameters

- **`model.js`**: ExpanderNet neural network implementation
  - W₁ initialization: diagonal with small values (0.01)
  - W_froz: fixed Gaussian random matrix
  - W₂: initialized small (0.01)
  - Forward pass with ReLU activation

- **`target.js`**: Hermite polynomial target functions
  - Normalized Hermite polynomials h_α(z) = He_α(z) / √(α!)
  - Derivatives for gradient computation
  - Target function evaluation: product over dimensions

- **`training.js`**: SGD trainer
  - Batch sampling from Gaussian distribution
  - Gradient computation via backprop
  - Parameter updates (only W₁ diagonals and W₂)

- **`simulation.js`**: Training loop controller
  - Adaptive stepping: fits as many SGD steps as possible per frame (~40 Hz target)
  - Tracks loss and parameter norms (W₁ diagonals, W₁ cross-term [0,1], √k·||W₂||)
  - Runs ODE theory prediction via `runTheoryODE()`
  - **Adaptive dt scaling**: For tMax > 2000, scales dt proportionally to keep ~200k ODE steps

- **`state.js`**: Application state with localStorage persistence
  - Stores all UI parameters (d, k, γ, α, η, batch size, etc.)
  - Stores UI settings (logScale, showTheory, xAxisMode, emaWindow)

### UI Components (`ui/` directory)
- **`charts.js`**: Chart initialization and controls
  - Creates LossChart and NormChart instances
  - Sets up logscale, x-axis mode (step vs t_eff), EMA slider, theory checkbox
  - `computeAndShowTheoryOnly()`: Shows theory preview before simulation runs

- **`controls.js`**: Parameter sliders and displays
  - d slider, k slider
  - 5 gamma sliders (one per possible dimension)
  - 5 alpha sliders (one per possible dimension)
  - η (learning rate) and batch size sliders
  - Updates theoretical predictions display

- **`display.js`**: Theory predictions display panel
  - Shows c, β_eff, t_rise, etc. computed from theory

### Visualization
- **`visualization.js`**: Chart.js wrapper classes
  - **LossChart**: 3 datasets (raw, EMA-smoothed exp, theory)
  - **NormChart**: Multiple datasets for W₁ diagonals, W₁ cross-term, W₂ norm
    - Dataset structure (for d dimensions):
      - Indices 0 to d-1: W₁ diagonals (exp, thick lines)
      - Index d: W₁ cross-term [0,1] (exp, thick, dark gray) - only if d ≥ 2
      - Index d + crossOffset: W₂ norm (exp, thick, slate gray)
      - Next d datasets: W₁ diagonals (theory, thin, dashed)
      - Final dataset: W₂ norm (theory, thin, dashed)
    - Theory datasets excluded from legend via `generateLabels` filter
  - Incremental caching with downsampling (MAX_PLOT_POINTS = 2000)
  - EMA smoothing for loss plot

### Theory Computation (`core/` directory)
- **`theory.js`**: Analytical theory calculations
  - Computes c, β_eff, t_rise from parameters
  - Used for predictions display and ODE initialization

### Configuration
- **`config.js`**: Constants and network visualization settings

## Key Design Patterns

### Theory Curve State Management
**Two modes:**
1. **Preview mode** (before simulation starts):
   - Theory updates live as sliders change
   - Uses current slider values to compute theory
   - Implemented in `app.js` parameter callback and `charts.js` checkbox handler

2. **Locked mode** (after simulation has data):
   - Theory stays frozen to captured parameters from simulation start
   - Slider changes don't affect theory curves
   - Only show/hide existing theory data

**Implementation check** in `app.js`:
```javascript
const simulationHasData = simulation.model !== null &&
                          simulation.lossHistory.length > 0;
if (!simulationHasData && appState.showTheory) {
  chartsManager.computeAndShowTheoryOnly();
}
```

### Parameter Capture Pattern
When simulation starts (`app.js`):
1. User clicks "start"
2. `simulation.captureParams(...)` saves current slider values
3. `simulation.start()` initializes model and runs ODE with captured params
4. Theory is computed once and stored in `theoryLossHistory`, `theoryNormHistory`
5. Future slider changes don't affect theory (until reset)

### Adaptive Performance
**SGD stepping** (`simulation.js`):
- Target 25ms per frame (40 Hz)
- Estimates time per step with exponential moving average
- Dynamically adjusts steps per frame to meet budget
- Typical: 100-500 steps/frame depending on d, k

**ODE integration** (`simulation.js`, `charts.js`):
- Base dt = 0.01 for tMax ≤ 2000
- For tMax > 2000: dt = 0.01 × (tMax / 2000)
- Keeps computation constant (~200k steps regardless of tMax)

### Incremental Plotting Cache
**`IncrementalCache`** in `visualization.js`:
- Tracks last processed index to avoid reprocessing entire history
- Computes EMA incrementally (O(new points) not O(n))
- Downsamples to MAX_PLOT_POINTS for chart rendering
- Stores running max values for y-axis scaling

## Integration with Low-Dim-Flows

The project uses the `low-dim-flows` ODE solver (sibling directory) to compute theory predictions:

**Import**: `import { solveODE } from '../low-dim-flows/api.js'`

**Usage** in `simulation.js` and `charts.js`:
```javascript
const result = solveODE(a0Vec, kVec, tMax, fStar, c, dt);
// Returns: { times, aTrajectories, lossValues }
```

**Mapping**:
- `a0Vec = [1, 1, ..., 1, 1e-10]` - initial values for W₁ diagonals + W₂ bias
- `kVec = [...alphas, 1]` - exponents for each parameter
- `tMax = 2 × t_rise` - simulation time
- Theory trajectories map to experiment:
  - `aTrajectories[i]` (i < d) → W₁ diagonal element i
  - `aTrajectories[d]` → W₂ norm (bias term b, shown as |b|)

**Recent change**: Removed HARD_CAP override in low-dim-flows so caller's tMax is respected

## X-Axis Modes

**Step mode**: x-axis shows iteration count (discrete steps)
**t_eff mode**: x-axis shows effective time = η × step (continuous time)

Both experiment and theory use the same x-axis transformation for consistency.

## Important Gotchas

1. **Dataset indexing in NormChart**: Must account for crossTermOffset when d < 2
2. **Theory curve visibility**: Controlled by both `showTheory` flag AND `simulationHasData` state
3. **Legend filtering**: Theory datasets have "theory" in label → excluded via `generateLabels`
4. **Y-axis max**: Must include theory range when `showTheory` is true
5. **EMA initialization**: Must match initial parameter values (W₁ = 1, W₂ = 0)
6. **Unicode subscripts**: Use `String.fromCharCode(0x2080 + digit)` for legend labels
7. **W₁ cross-term**: Only tracked/displayed when d ≥ 2, stored as `w1_cross`
8. **W₂ norm display**: Shows √k·||W₂|| (scaled), but theory shows just |b| (unscaled)

## Performance Characteristics

**Typical performance** (d=3, k=1000, batch=100):
- ~300 steps/sec
- ~1.5ms per SGD step
- ~0.3ms per norm computation
- ~0.5ms per chart update
- Total: ~25ms per frame (40 FPS)

**Bottlenecks**:
1. Forward/backward pass scales with k
2. Norm computation (Frobenius norm of W₂)
3. History array appends (becomes slow after ~100k points)

**Optimizations**:
- Incremental cache reduces chart update from O(n) to O(new points)
- Downsampling keeps chart at 2000 points max
- No intermediate allocations in hot loops
- Adaptive stepping maximizes training per frame

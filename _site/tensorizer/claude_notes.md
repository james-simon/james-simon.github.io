# Tensorizer Project Notes

## Session Completed - 2026-01-16

### Changes Implemented

1. **Global Sliders Added to Toolbar**
   - Added Init Scale slider (range: 0.1 to 3.0, default: 1.0, logarithmic)
   - Added Leg Dimension slider (range: 1 to 100 integers, default: 5, logarithmic)
   - Both sliders are in the toolbar with live value display
   - Both use logarithmic scaling for finer control at lower values

2. **Removed Per-Object Property Controls**
   - Removed per-tensor `initSize` property and input
   - Removed per-leg `dimension` property and slider/input
   - Kept only name inputs in the properties panel

3. **Updated Line Width Rendering**
   - Previous: `baseThickness * (1 + 8 * Math.log(dimension) / Math.log(100))` (2-18px range)
   - Current: Uses global `globalDimension` variable mapped to line width
   - Mapping formula: `lineWidth = 1 + 14 * log(dimension) / log(100)` (1-15px range)
   - Line width is consistent across all legs

4. **Leg Label Positioning**
   - Shifted leg index rendering by `15 + lineWidth / 2` pixels
   - Prevents overlap between label and wide legs

5. **Name Restrictions**
   - Tensor names: restricted to single uppercase letter (A-Z)
   - Leg names: restricted to single lowercase letter (a-z)
   - Input fields have `maxlength="1"` attribute
   - Validation in event handlers enforces character restrictions

6. **Wider Leg Clickbox**
   - Increased click threshold from 8px to 20px in screen space
   - Added label area detection (20px radius around label position)
   - Makes it easier to select legs, especially thin ones

7. **Removed Popping Sound**
   - Removed `playRandomPop()` call when placing tensors
   - Sound effects remain available for other interactions if needed

8. **Fixed Undo Bug**
   - Changed from "save before change" to "save after change" pattern
   - Tensor creation: save state AFTER creating tensor
   - Leg creation: save state AFTER creating leg
   - Deletion: save state AFTER erasing
   - Property editing: save state AFTER editing (on blur, if changed)
   - Prevents duplicate states in history that caused skipping

9. **Properties Panel Cleanup**
   - Removed "No selection" placeholder text
   - Panel is now empty when nothing is selected
   - Shows "Tensor Properties" or "Leg Properties" header when something is selected

10. **Name Input Validation**
   - Allow deleting to empty field (shows red border as warning)
   - On blur (clicking away), auto-restores previous valid name if empty
   - Prevents invalid state without forcing user to stay focused

11. **Tensor Index Annotation**
   - Tensors now display with leg indices as subscripts (e.g., A_ijq)
   - Collects all connected leg names, sorts alphabetically
   - Renders using italic font with smaller subscript for indices
   - Leg labels also rendered in italic to match notation style

12. **Selection on Drag**
   - Objects are now selected immediately on mousedown when starting to drag
   - Provides instant visual feedback (turns blue) rather than waiting for click event

13. **MathJax Integration**
   - Added MathJax 3 library for LaTeX rendering
   - Tensor labels now rendered as proper LaTeX (e.g., $A_{ijq}$)
   - Leg labels also rendered with MathJax
   - Implements caching system to avoid re-rendering same labels
   - Async rendering with fallback to plain text while loading
   - SVG conversion to canvas-compatible images

14. **Init Scale Slider Overhaul**
   - Range changed from 0.1-3.0 to 10^-5 to 10^1 (0.00001 to 10)
   - Values constrained to [1-9] × 10^k format
   - 64 discrete values total across 7 orders of magnitude
   - Display format shows scientific notation for very small/large values
   - Better coverage of typical tensor network scales

## Slider Details

### Init Scale Slider
- UI range: 0-100 (slider position)
- Actual range: 10^-5 to 10^1 (64 discrete values)
- Values: [1-9] × 10^k for k ∈ {-5, -4, -3, -2, -1, 0, 1}
- Conversion: Maps slider to index in discrete value array
- Display: Shows decimal for 0.01-100, scientific notation otherwise
- Default: slider=50 → scale≈0.0001 (1×10^-4)

### Leg Dimension Slider
- UI range: 0-100 (slider position)
- Actual range: 1-100 (logarithmic, integers only)
- Conversion: `dimension = round(100^(sliderValue/100))`
- Default: slider=35 → dimension=5

## Previous Line Width Mapping
- Old: `baseThickness = 2; thicknessFactor = baseThickness * (1 + 8 * Math.log(leg.dimension) / Math.log(100))`
- Range was 2px (dimension=1) to 18px (dimension=100)

## Project Context
- Tensor network visualization tool
- Features: drag-and-drop tensors, connecting legs, undo functionality, zoom/pan
- Canvas-based rendering with 2D context

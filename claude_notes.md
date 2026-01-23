# Claude Notes - Tensorizer Project

## Project Overview
Interactive tensor network diagram editor at `/tensorizer/`. Users create and manipulate tensor diagrams with tensors (boxes) and legs (edges), which automatically generate Einstein notation formulas.

## File Structure (load order matters!)
```
/tensorizer/
├── index.html          - HTML structure, Jekyll template with {{site.baseurl}}
├── styles.css          - All CSS styling
├── utils.js            - Utility functions, conversions, formatters, name generation
├── state.js            - State vars, data structures, undo/redo with ID-based serialization
├── drawing.js          - Canvas rendering, coordinate transforms, manual subscript rendering
├── formula.js          - Einstein notation formula generation
├── input.js            - Event handlers, hit detection, tool switching, keyboard shortcuts
├── ui.js               - Property panel updates, slider handlers
└── tensorizer.js       - Main init, gets DOM element references
```

## Core Concepts

### Tensors
- Square boxes, single uppercase letter (A-Z)
- Show subscripts with connected leg names: A_ijk (sorted alphabetically)
- Subscripts rendered manually on canvas (28px main, 18px subscript, +8px down)

### Legs (edges)
- Connect tensors or have free ends
- Single lowercase letter (a-z), default starts at 'i'
- Labels always drawn ABOVE the line
- Line width: maps from dimension slider (1-100) to 1-15px logarithmically
- Free ends: circles, radius=6px, clickbox=18px

### Formula Display
Einstein notation at top of right panel: `T_ikmn  =  A_ijk B_jl C_lmn`
- External indices: legs with exactly one tensor connection
- Contracted indices: legs with two tensor connections
- RHS: tensors sorted alphabetically, each with sorted legs
- LHS: T with sorted external indices only

### Global Settings (toolbar sliders, lowercase labels)
- **init scale**: 10^-5 to 10^1, discrete values [1-9]×10^k, HTML superscripts
- **leg dimension**: 1-100 integers, logarithmic slider

### Tools & Interaction
- Mouse (select/drag), Pan (clears selection), Tensor, Connection, Eraser, Undo
- Box-select: drag empty space
- Delete: Backspace/Delete (not when input focused)
- Properties panel: only shows when selection exists, small inline inputs

### Auto-cleanup
- Self-loops removed (leg from tensor to itself)
- Unconnected legs removed (both ends free)

## Critical Implementation Details

### Undo System (state.js)
**MUST** store tensor IDs not references, because JSON.stringify breaks object refs:
```javascript
// Save: convert to IDs
legs: legs.map(leg => ({
  startTensorId: leg.startTensor?.id ?? null,
  endTensorId: leg.endTensor?.id ?? null,
  // ...
}))

// Restore: reconnect by ID lookup
leg.startTensor = tensors.find(t => t.id === legData.startTensorId);
```

### Leg Label Positioning (drawing.js:73-77)
Always show labels ABOVE line (flip perpendicular if pointing down):
```javascript
if (perpY > 0) {  // perpY > 0 means downward (canvas y-down)
  perpX = -perpX;
  perpY = -perpY;
}
```

### Key Event Patterns
- Tool switch (not to mouse) → clear selection
- Modify objects → `removeSelfLoops()` + `removeUnconnectedLegs()` → `saveState()` → `draw()`
- `draw()` → renders canvas → `updateFormulaDisplay()`
- Backspace/Delete → check `document.activeElement` is not INPUT/TEXTAREA first

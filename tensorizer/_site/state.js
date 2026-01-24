// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// State arrays
let tensors = [];
let legs = [];
let nextTensorId = 0;
let nextLegId = 0;

// Selection state
let selectedTensor = null;
let selectedLeg = null;
let selectedTensors = new Set(); // For multi-select
let selectedLegs = new Set(); // For multi-select

// Interaction state
let activeTool = 'mouse'; // 'mouse', 'pan', 'tensor', 'connection', 'eraser'
let draggingTensor = null;
let draggingLegEnd = null; // { leg, end: 'start' or 'end' }
let draggingMultiple = false; // For multi-object drag
let panningCanvas = false;
let dragOffset = { x: 0, y: 0 };
let dragOffsets = new Map(); // For multi-object drag offsets
let lastMousePos = { x: 0, y: 0 };
let connectionStart = null; // For drawing legs
let mouseDown = false;
let selectionBox = null; // { startX, startY, endX, endY } for box selection

// Undo history
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Zoom and pan
let zoom = 1;
let panX = 0;
let panY = 0;

// Global settings
let globalInitScale = 1.0;
let globalDimension = 5;
let showLegRanks = false;
let showSingularValues = false;

// Simulation state (for display purposes)
let currentLegSVCounts = {}; // legId -> count of SVs > 0.1
let currentLegSVs = {}; // legId -> array of current SV values
let initialMaxSVs = {}; // legId -> max SV at initialization
let iterationCount = 0;
let floatingPlotBounds = []; // Array of {legId, x, y, width, height} for click detection

// Constants
const TENSOR_SIZE = 70;
const FREE_END_RADIUS = 6;
const LEG_LETTER_START = 8; // Start at 'i' (0-indexed: a=0, b=1, ..., i=8)

// ============================================================================
// STATE MANIPULATION FUNCTIONS
// ============================================================================

// Create a new tensor
function createTensor(x, y) {
  const tensor = {
    id: nextTensorId,
    name: getNextTensorName(),
    x: x,
    y: y
  };
  nextTensorId++;
  tensors.push(tensor);
  return tensor;
}

// Create a new leg
function createLeg(startTensor, endTensor, startPos, endPos) {
  const leg = {
    id: nextLegId,
    name: getLegName(nextLegId),
    startTensor: startTensor, // tensor object or null
    endTensor: endTensor,     // tensor object or null
    startPos: startPos,       // { x, y } if startTensor is null
    endPos: endPos            // { x, y } if endTensor is null
  };
  nextLegId++;
  legs.push(leg);
  return leg;
}

// Get leg endpoint position
function getLegEndpoint(leg, end) {
  if (end === 'start') {
    return leg.startTensor ? { x: leg.startTensor.x, y: leg.startTensor.y } : leg.startPos;
  } else {
    return leg.endTensor ? { x: leg.endTensor.x, y: leg.endTensor.y } : leg.endPos;
  }
}

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

// Save current state to history
function saveState() {
  // Remove any states after current index (for redo functionality)
  history = history.slice(0, historyIndex + 1);

  // Save current state with tensor IDs instead of references
  const state = {
    tensors: deepClone(tensors),
    legs: legs.map(leg => ({
      id: leg.id,
      name: leg.name,
      startTensorId: leg.startTensor ? leg.startTensor.id : null,
      endTensorId: leg.endTensor ? leg.endTensor.id : null,
      startPos: leg.startPos ? deepClone(leg.startPos) : null,
      endPos: leg.endPos ? deepClone(leg.endPos) : null
    })),
    nextTensorId: nextTensorId,
    nextLegId: nextLegId
  };
  history.push(state);

  // Limit history size
  if (history.length > MAX_HISTORY) {
    history.shift();
  } else {
    historyIndex++;
  }

  updateUndoButton();
  updateRedoButton();
}

// Restore state from history (undo)
function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    restoreStateAtIndex(historyIndex);
    updateUndoButton();
    updateRedoButton();
  }
}

// Restore state from history (redo)
function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    restoreStateAtIndex(historyIndex);
    updateUndoButton();
    updateRedoButton();
  }
}

// Helper function to restore state at a given history index
function restoreStateAtIndex(index) {
  const state = history[index];

  tensors = deepClone(state.tensors);
  nextTensorId = state.nextTensorId;
  nextLegId = state.nextLegId;

  // Restore legs and reconnect object references
  legs = state.legs.map(legData => {
    const leg = {
      id: legData.id,
      name: legData.name,
      startTensor: null,
      endTensor: null,
      startPos: legData.startPos ? deepClone(legData.startPos) : null,
      endPos: legData.endPos ? deepClone(legData.endPos) : null
    };

    // Reconnect tensor references by ID
    if (legData.startTensorId !== null) {
      leg.startTensor = tensors.find(t => t.id === legData.startTensorId);
    }
    if (legData.endTensorId !== null) {
      leg.endTensor = tensors.find(t => t.id === legData.endTensorId);
    }

    return leg;
  });

  // Clear selection
  selectedTensor = null;
  selectedLeg = null;
  updatePropertyPanel();
  draw();
}

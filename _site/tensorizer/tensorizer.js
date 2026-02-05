// ============================================================================
// TENSORIZER MAIN
// ============================================================================

// Get DOM elements
const canvas = document.getElementById('tensorCanvas');
const ctx = canvas.getContext('2d');
const mouseTool = document.getElementById('mouseTool');
const panTool = document.getElementById('panTool');
const tensorTool = document.getElementById('tensorTool');
const connectionTool = document.getElementById('connectionTool');
const eraserTool = document.getElementById('eraserTool');
const undoButton = document.getElementById('undoButton');
const redoButton = document.getElementById('redoButton');
const propertiesPanel = document.getElementById('propertiesPanel');
const tensorEditor = document.getElementById('tensorEditor');
const legEditor = document.getElementById('legEditor');
const tensorNameInput = document.getElementById('tensorName');
const legNameInput = document.getElementById('legName');
const globalInitScaleSlider = document.getElementById('globalInitScale');
const globalInitScaleValue = document.getElementById('globalInitScaleValue');
const globalDimensionSlider = document.getElementById('globalDimension');
const globalDimensionValue = document.getElementById('globalDimensionValue');
const helpButton = document.getElementById('helpButton');

// Initialize the application
function init() {
  console.log('Tensorizer initializing...');

  // Set up event handlers
  setupInputHandlers();
  setupUIHandlers();
  setupSimulationHandlers();
  setupHelpHandlers();

  // Initialize state
  saveState();
  updateUndoButton();
  updateRedoButton();

  // Set initial slider display values
  globalInitScale = sliderToInitScale(parseFloat(globalInitScaleSlider.value));
  console.log('Initial init scale:', globalInitScale, 'from slider value:', globalInitScaleSlider.value);
  updateInitScaleDisplay(globalInitScale);
  globalDimension = sliderToDimension(parseFloat(globalDimensionSlider.value));
  globalDimensionValue.textContent = globalDimension;

  // Initial draw
  draw();

  console.log('Tensorizer initialized!');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================================================
// HELP OVERLAY SYSTEM
// ============================================================================

const HELP_ITEMS = [
  // Canvas and toolbar
  { selector: '#tensorCanvas', text: 'Draw tensors and legs here', position: 'center' },
  { selector: '#mouseTool', text: 'Select and move', position: 'bottom' },
  { selector: '#panTool', text: 'Pan canvas', position: 'bottom' },
  { selector: '#tensorTool', text: 'Create tensors', position: 'bottom' },
  { selector: '#connectionTool', text: 'Connect tensors', position: 'bottom' },
  { selector: '#eraserTool', text: 'Delete items', position: 'bottom' },
  { selector: '#undoButton', text: 'Undo', position: 'bottom' },
  { selector: '#redoButton', text: 'Redo', position: 'bottom' },

  // Canvas overlays
  { selector: '.floating-toggles', text: 'Toggle rank/SV displays', position: 'left' },
  { selector: '#formulaDisplay', text: 'Einstein notation', position: 'top' },

  // Side panels
  { selector: '#sidePanelLossPlot', text: 'Training loss over time', position: 'left' },
  { selector: '#sidePanelSVPlot', text: 'Singular values (select a leg)', position: 'left' },

  // Bottom controls
  { selector: '#startPauseButton', text: 'Run simulation', position: 'top' },
  { selector: '#resetButton', text: 'Reset & reinitialize', position: 'top' },
  { selector: '#learningRate', text: 'Learning rate', position: 'top' },
  { selector: '#globalInitScale', text: 'Initial weight scale', position: 'top' },
  { selector: '#globalDimension', text: 'Leg dimensions', position: 'top' },
  { selector: '#currentLoss', text: 'Current loss value', position: 'top' },
  { selector: '#stepsPerSec', text: 'Simulation speed', position: 'top' },
];

let helpOverlayActive = false;

function createHelpOverlay() {
  if (helpOverlayActive) return;
  helpOverlayActive = true;

  // Create overlay background
  const overlay = document.createElement('div');
  overlay.id = 'helpOverlay';
  overlay.className = 'help-overlay';
  document.body.appendChild(overlay);

  // Create labels for each help item
  HELP_ITEMS.forEach((item, index) => {
    const element = document.querySelector(item.selector);
    if (!element) {
      console.warn('Help item not found:', item.selector);
      return;
    }

    const rect = element.getBoundingClientRect();
    const label = document.createElement('div');
    label.className = 'help-label';
    label.textContent = item.text;

    // Add arrow
    const arrow = document.createElement('div');
    arrow.className = 'help-arrow help-arrow-' + item.position;
    label.appendChild(arrow);

    // Position label based on element and position preference
    document.body.appendChild(label);
    const labelRect = label.getBoundingClientRect();

    let x, y;
    switch (item.position) {
      case 'top':
        x = rect.left + rect.width / 2 - labelRect.width / 2;
        y = rect.top - labelRect.height - 15;
        break;
      case 'bottom':
        x = rect.left + rect.width / 2 - labelRect.width / 2;
        y = rect.bottom + 15;
        break;
      case 'left':
        x = rect.left - labelRect.width - 15;
        y = rect.top + rect.height / 2 - labelRect.height / 2;
        break;
      case 'right':
        x = rect.right + 15;
        y = rect.top + rect.height / 2 - labelRect.height / 2;
        break;
      case 'center':
        x = rect.left + rect.width / 2 - labelRect.width / 2;
        y = rect.top + rect.height / 2 - labelRect.height / 2;
        break;
    }

    // Keep labels on screen
    x = Math.max(10, Math.min(x, window.innerWidth - labelRect.width - 10));
    y = Math.max(10, Math.min(y, window.innerHeight - labelRect.height - 10));

    label.style.left = x + 'px';
    label.style.top = y + 'px';

    // Add highlight to important elements
    if (['#tensorCanvas', '#startPauseButton', '#mouseTool', '#tensorTool', '#connectionTool'].includes(item.selector)) {
      element.classList.add('help-highlight');
    }
  });
}

function removeHelpOverlay() {
  if (!helpOverlayActive) return;
  helpOverlayActive = false;

  // Remove overlay
  const overlay = document.getElementById('helpOverlay');
  if (overlay) {
    overlay.remove();
  }

  // Remove all labels
  document.querySelectorAll('.help-label').forEach(el => el.remove());

  // Remove highlights
  document.querySelectorAll('.help-highlight').forEach(el => {
    el.classList.remove('help-highlight');
  });
}

// Set up help button handlers
function setupHelpHandlers() {
  const helpButton = document.getElementById('helpButton');
  if (helpButton) {
    helpButton.addEventListener('mouseenter', createHelpOverlay);
    helpButton.addEventListener('mouseleave', removeHelpOverlay);

    // Prevent click from doing anything
    helpButton.addEventListener('click', (e) => {
      e.preventDefault();
    });
  }
}

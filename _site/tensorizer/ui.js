// ============================================================================
// UI CONTROLS
// ============================================================================

// Update property panel
function updatePropertyPanel() {
  if (selectedTensor) {
    propertiesPanel.style.display = 'block';
    tensorEditor.style.display = 'block';
    legEditor.style.display = 'none';
    tensorNameInput.value = selectedTensor.name;
  } else if (selectedLeg) {
    propertiesPanel.style.display = 'block';
    tensorEditor.style.display = 'none';
    legEditor.style.display = 'block';
    legNameInput.value = selectedLeg.name;
  } else {
    propertiesPanel.style.display = 'none';
    tensorEditor.style.display = 'none';
    legEditor.style.display = 'none';
  }
}

// Update undo button state
function updateUndoButton() {
  if (historyIndex > 0) {
    undoButton.style.opacity = '1';
    undoButton.style.cursor = 'pointer';
  } else {
    undoButton.style.opacity = '0.3';
    undoButton.style.cursor = 'not-allowed';
  }
}

// Update the init scale display element
function updateInitScaleDisplay(value) {
  const formatted = formatInitScale(value);
  globalInitScaleValue.innerHTML = formatted;
}

// ============================================================================
// PROPERTY PANEL EVENT HANDLERS
// ============================================================================

function setupUIHandlers() {
  // Track name before editing for validation
  let nameBeforeEdit = null;

  // Tensor name input
  tensorNameInput.addEventListener('focus', () => {
    if (selectedTensor) {
      nameBeforeEdit = selectedTensor.name;
    }
  });

  tensorNameInput.addEventListener('blur', () => {
    // Auto-restore if empty
    if (selectedTensor && tensorNameInput.value === '') {
      tensorNameInput.value = nameBeforeEdit || selectedTensor.name;
      selectedTensor.name = tensorNameInput.value;
      tensorNameInput.style.borderColor = '';
      draw();
    }
    // Save state after editing if name changed
    if (selectedTensor && nameBeforeEdit !== null && selectedTensor.name !== nameBeforeEdit) {
      saveState();
    }
    nameBeforeEdit = null;
  });

  tensorNameInput.addEventListener('input', () => {
    if (selectedTensor) {
      // Restrict to one letter (uppercase or lowercase)
      let value = tensorNameInput.value;
      if (value.length > 0) {
        value = value.charAt(0);
        // Only allow A-Z or a-z
        if ((value >= 'A' && value <= 'Z') || (value >= 'a' && value <= 'z')) {
          selectedTensor.name = value;
          tensorNameInput.value = value;
          tensorNameInput.style.borderColor = '';
        } else {
          // Invalid character, restore
          tensorNameInput.value = selectedTensor.name;
          tensorNameInput.style.borderColor = '';
        }
      } else {
        // Empty - show red border
        tensorNameInput.style.borderColor = '#ff0000';
      }
      draw();
    }
  });

  // Leg name input
  legNameInput.addEventListener('focus', () => {
    if (selectedLeg) {
      nameBeforeEdit = selectedLeg.name;
    }
  });

  legNameInput.addEventListener('blur', () => {
    // Auto-restore if empty
    if (selectedLeg && legNameInput.value === '') {
      legNameInput.value = nameBeforeEdit || selectedLeg.name;
      selectedLeg.name = legNameInput.value;
      legNameInput.style.borderColor = '';
      draw();
    }
    // Save state after editing if name changed
    if (selectedLeg && nameBeforeEdit !== null && selectedLeg.name !== nameBeforeEdit) {
      saveState();
    }
    nameBeforeEdit = null;
  });

  legNameInput.addEventListener('input', () => {
    if (selectedLeg) {
      // Restrict to one lowercase letter
      let value = legNameInput.value.toLowerCase();
      if (value.length > 0) {
        value = value.charAt(0);
        // Only allow a-z
        if (value >= 'a' && value <= 'z') {
          selectedLeg.name = value;
          legNameInput.value = value;
          legNameInput.style.borderColor = '';
        } else {
          // Invalid character, restore
          legNameInput.value = selectedLeg.name;
          legNameInput.style.borderColor = '';
        }
      } else {
        // Empty - show red border
        legNameInput.style.borderColor = '#ff0000';
      }
      draw();
    }
  });

  // Global slider event listeners
  globalInitScaleSlider.addEventListener('input', () => {
    const sliderVal = parseFloat(globalInitScaleSlider.value);
    globalInitScale = sliderToInitScale(sliderVal);
    console.log('Init scale slider:', sliderVal, '->', globalInitScale);
    updateInitScaleDisplay(globalInitScale);
    draw();
  });

  globalDimensionSlider.addEventListener('input', () => {
    globalDimension = sliderToDimension(parseFloat(globalDimensionSlider.value));
    globalDimensionValue.textContent = globalDimension;
    draw();
  });
}

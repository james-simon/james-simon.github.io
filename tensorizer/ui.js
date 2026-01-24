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
  } else if (selectedLeg && selectedLeg !== 'loss') {
    propertiesPanel.style.display = 'block';
    tensorEditor.style.display = 'none';
    legEditor.style.display = 'block';
    legNameInput.value = selectedLeg.name;
  } else {
    propertiesPanel.style.display = 'none';
    tensorEditor.style.display = 'none';
    legEditor.style.display = 'none';
  }

  // Update side panel SV chart
  updateSidePanelSVChart();
}

// Update the side panel loss chart (always visible during simulation)
function updateSidePanelLossChart() {
  if (!sidePanelLossChart || !lossHistory || lossHistory.length === 0) {
    return;
  }

  // Create loss dataset with {x, y} format for proper x-axis spacing
  const datasets = [{
    label: 'Loss',
    data: lossHistory.map(entry => ({ x: entry.iteration, y: entry.loss })),
    borderColor: 'rgb(75, 192, 192)',
    backgroundColor: 'rgba(75, 192, 192, 0.1)',
    borderWidth: 2,
    pointRadius: 0
  }];

  // Calculate smart tick spacing
  const maxIteration = lossHistory[lossHistory.length - 1].iteration;
  const tickStep = calculateTickStep(maxIteration);

  sidePanelLossChart.data.datasets = datasets;
  sidePanelLossChart.options.scales.x.min = 0;
  sidePanelLossChart.options.scales.x.max = maxIteration;
  sidePanelLossChart.options.scales.x.ticks.callback = function(value, index, values) {
    // Only show labels at tickStep intervals or at the max
    if (value % tickStep === 0 || value === maxIteration) {
      return value;
    }
    return '';
  };
  sidePanelLossChart.update('none');
}

// Update the side panel SV chart based on selected leg
function updateSidePanelSVChart() {
  const sidePanelPlot = document.getElementById('sidePanelSVPlot');
  const sidePanelTitle = document.getElementById('sidePanelSVPlotTitle');

  if (selectedLeg && selectedLeg !== 'loss' && iterationCount > 0 && legSVHistory[selectedLeg.id] && sidePanelSVChart) {
    sidePanelPlot.style.display = 'block';
    sidePanelTitle.innerHTML = `singular values of leg <i>${selectedLeg.name}</i>`;

    const history = legSVHistory[selectedLeg.id];
    if (history.length === 0) {
      sidePanelSVChart.data.datasets = [];
      sidePanelSVChart.update('none');
      return;
    }

    // Get all iterations
    const numSVs = history[0].svs.length;

    // Create datasets for each SV using rainbow colors (HSL) with {x, y} format
    const datasets = [];
    for (let i = 0; i < numSVs; i++) {
      const color = getSVColor(i, numSVs);
      const data = history.map(h => ({ x: h.iteration, y: h.svs[i] }));
      datasets.push({
        label: `SV ${i + 1}`,
        data: data,
        borderColor: color,
        backgroundColor: color.replace('hsl', 'hsla').replace(')', ', 0.1)'),
        borderWidth: 2,
        pointRadius: 0
      });
    }

    // Calculate smart tick spacing
    const maxIteration = history[history.length - 1].iteration;
    const tickStep = calculateTickStep(maxIteration);

    sidePanelSVChart.data.datasets = datasets;
    sidePanelSVChart.options.scales.x.min = 0;
    sidePanelSVChart.options.scales.x.max = maxIteration;
    sidePanelSVChart.options.scales.x.ticks.callback = function(value, index, values) {
      // Only show labels at tickStep intervals or at the max
      if (value % tickStep === 0 || value === maxIteration) {
        return value;
      }
      return '';
    };
    sidePanelSVChart.update('none');
  } else {
    sidePanelPlot.style.display = 'none';
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

// Update redo button state
function updateRedoButton() {
  if (historyIndex < history.length - 1) {
    redoButton.style.opacity = '1';
    redoButton.style.cursor = 'pointer';
  } else {
    redoButton.style.opacity = '0.3';
    redoButton.style.cursor = 'not-allowed';
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

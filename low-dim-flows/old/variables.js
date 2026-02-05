// ============================================================================
// VARIABLE MANAGEMENT
// ============================================================================
// Manages the number of variables and updates the loss function display

(function() {
  'use strict';

  // Configuration
  const MIN_VARIABLES = 1;
  const MAX_VARIABLES = 5;

  // State
  let numVariables = 1;  // Start with 1 variable

  // Persistent settings for all 5 variables (even when not active)
  // Each stores: {a0SliderPos, kSliderPos}
  const variableSettings = {};
  for (let i = 1; i <= MAX_VARIABLES; i++) {
    // Default slider position for a0 that gives 1e-2
    const defaultA0Pos = window.a0Slider ? window.a0Slider.valueToSlider(0.01) : 20;
    variableSettings[i] = {
      a0SliderPos: defaultA0Pos,
      kSliderPos: 0  // k=1
    };
  }

  // Get DOM elements
  const lossDisplay = document.getElementById('lossDisplay');
  const addButton = document.getElementById('addVariableButton');
  const removeButton = document.getElementById('removeVariableButton');
  const variableControlsContainer = document.getElementById('variableControls');

  // Generate LaTeX for the loss function based on current number of variables
  function generateLossLatex(n) {
    if (n === 1) {
      return '$\\mathcal{L} = \\frac{1}{2}(1-a_1^{k_1})^2$';
    }

    // Build product term: a_1^{k_1} a_2^{k_2} ... a_n^{k_n}
    const productTerms = [];
    for (let i = 1; i <= n; i++) {
      productTerms.push(`a_${i}^{k_${i}}`);
    }
    const product = productTerms.join(' ');

    return `$\\mathcal{L} = \\frac{1}{2}(1-${product})^2$`;
  }

  // Update the loss display
  function updateLossDisplay() {
    const latex = generateLossLatex(numVariables);
    lossDisplay.innerHTML = latex;

    // Retypeset MathJax if available
    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetPromise([lossDisplay]).catch((err) => console.log('MathJax typeset error:', err));
    }
  }

  // Generate HTML for variable controls (sliders for each variable)
  function updateVariableControls() {
    const controlsHTML = [];

    // Always render all 5 boxes, make inactive ones invisible
    for (let i = 1; i <= MAX_VARIABLES; i++) {
      const isActive = i <= numVariables;
      const visibility = isActive ? 'visible' : 'hidden';

      const variableBox = `
        <div style="border: 1px solid #ddd; border-radius: 4px; padding: 12px; background: #f9f9f9; visibility: ${visibility};">
          <div style="font-weight: bold; margin-bottom: 8px; text-align: center;">$a_${i}$</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <label style="min-width: 60px; font-size: 14px;">init:</label>
              <input type="range" id="a0Slider_${i}" min="0" max="100" step="1" value="${variableSettings[i].a0SliderPos}" style="width: 120px;">
              <span id="a0Value_${i}" style="min-width: 50px; font-size: 14px;">0.01</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <label style="min-width: 60px; font-size: 14px;">$k_${i}$:</label>
              <input type="range" id="kSlider_${i}" min="0" max="100" step="1" value="${variableSettings[i].kSliderPos}" style="width: 120px;">
              <span id="kValue_${i}" style="min-width: 50px; font-size: 14px;">1</span>
            </div>
          </div>
        </div>
      `;
      controlsHTML.push(variableBox);
    }

    variableControlsContainer.innerHTML = `
      <div style="display: flex; gap: 15px; flex-wrap: wrap; justify-content: center;">
        ${controlsHTML.join('')}
      </div>
    `;

    // Initialize slider values for all boxes
    for (let i = 1; i <= MAX_VARIABLES; i++) {
      const a0SliderEl = document.getElementById(`a0Slider_${i}`);
      const a0ValueEl = document.getElementById(`a0Value_${i}`);
      const kSliderEl = document.getElementById(`kSlider_${i}`);
      const kValueEl = document.getElementById(`kValue_${i}`);

      // Set initial values using the global slider converters
      if (window.a0Slider) {
        const initialA0 = window.a0Slider.sliderToValue(a0SliderEl.value);
        a0ValueEl.innerHTML = window.a0Slider.format(initialA0);

        // Add event listener
        a0SliderEl.addEventListener('input', function() {
          const val = window.a0Slider.sliderToValue(this.value);
          a0ValueEl.innerHTML = window.a0Slider.format(val);
          // Save setting
          variableSettings[i].a0SliderPos = parseFloat(this.value);
          // Trigger simulation update
          if (window.updateSimulation) {
            window.updateSimulation();
          }
        });
      }

      if (window.kSlider) {
        const initialK = window.kSlider.sliderToValue(kSliderEl.value);
        kValueEl.innerHTML = window.kSlider.format(initialK);

        // Add event listener
        kSliderEl.addEventListener('input', function() {
          const val = window.kSlider.sliderToValue(this.value);
          kValueEl.innerHTML = window.kSlider.format(val);
          // Save setting
          variableSettings[i].kSliderPos = parseFloat(this.value);
          // Trigger simulation update
          if (window.updateSimulation) {
            window.updateSimulation();
          }
        });
      }
    }

    // Retypeset MathJax for k labels
    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetPromise([variableControlsContainer]).catch((err) => console.log('MathJax typeset error:', err));
    }
  }

  // Update button states (enable/disable based on limits)
  function updateButtonStates() {
    // Disable remove button if at minimum
    if (numVariables <= MIN_VARIABLES) {
      removeButton.disabled = true;
      removeButton.style.opacity = '0.5';
      removeButton.style.cursor = 'not-allowed';
    } else {
      removeButton.disabled = false;
      removeButton.style.opacity = '1';
      removeButton.style.cursor = 'pointer';
    }

    // Disable add button if at maximum
    if (numVariables >= MAX_VARIABLES) {
      addButton.disabled = true;
      addButton.style.opacity = '0.5';
      addButton.style.cursor = 'not-allowed';
    } else {
      addButton.disabled = false;
      addButton.style.opacity = '1';
      addButton.style.cursor = 'pointer';
    }
  }

  // Add a variable
  function addVariable() {
    if (numVariables < MAX_VARIABLES) {
      numVariables++;
      updateLossDisplay();
      updateVariableControls();
      updateButtonStates();
      console.log(`Added variable. Now have ${numVariables} variables.`);
      // Trigger simulation update
      if (window.updateSimulation) {
        window.updateSimulation();
      }
    }
  }

  // Remove a variable
  function removeVariable() {
    if (numVariables > MIN_VARIABLES) {
      numVariables--;
      updateLossDisplay();
      updateVariableControls();
      updateButtonStates();
      console.log(`Removed variable. Now have ${numVariables} variables.`);
      // Trigger simulation update
      if (window.updateSimulation) {
        window.updateSimulation();
      }
    }
  }

  // Get current number of variables (for use by simulation code)
  function getNumVariables() {
    return numVariables;
  }

  // Get current variable settings (for use by simulation code)
  function getVariableSettings() {
    const settings = [];
    for (let i = 1; i <= numVariables; i++) {
      const a0 = window.a0Slider ? window.a0Slider.sliderToValue(variableSettings[i].a0SliderPos) : 0.01;
      const k = window.kSlider ? window.kSlider.sliderToValue(variableSettings[i].kSliderPos) : 1;
      settings.push({ a0, k });
    }
    return settings;
  }

  // Initialize
  function init() {
    console.log('Variable management initialized');

    // Set initial display and controls
    updateVariableControls();
    updateButtonStates();

    // Attach event listeners
    addButton.addEventListener('click', addVariable);
    removeButton.addEventListener('click', removeVariable);
  }

  // Export functions to global scope for use by other modules
  window.VariableManager = {
    init: init,
    getNumVariables: getNumVariables,
    getVariableSettings: getVariableSettings,
    addVariable: addVariable,
    removeVariable: removeVariable
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// ============================================================================
// CONTROLS UI
// ============================================================================
// Manages variable control boxes and event handling

import { CONFIG } from '../config.js';
import { sliders } from '../utils/sliders.js';

/**
 * ControlsManager: Handles UI for variable controls
 */
export class ControlsManager {
  constructor(state) {
    this.state = state;
    this.container = document.getElementById('variableControls');
  }

  /**
   * Initialize controls
   */
  init() {
    this.render();
    this.attachGlobalButtons();
  }

  /**
   * Render all variable control boxes
   */
  render() {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'variable-controls-wrapper';

    // Create f* box first
    const fStarBox = this.createFStarBox();
    wrapper.appendChild(fStarBox);

    // Create all 5 variable boxes (inactive ones will be hidden)
    for (let i = 0; i < CONFIG.variables.max; i++) {
      const box = this.createVariableBox(i);
      wrapper.appendChild(box);
    }

    this.container.appendChild(wrapper);

    // Typeset MathJax after rendering
    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetPromise([this.container]).catch((err) =>
        console.warn('MathJax typeset error:', err)
      );
    }
  }

  /**
   * Create f* control box
   */
  createFStarBox() {
    const box = document.createElement('div');
    box.className = 'variable-box fstar-box';

    // Label
    const label = document.createElement('div');
    label.className = 'variable-label';
    label.innerHTML = '$f_*$';
    box.appendChild(label);

    // Slider container
    const slidersDiv = document.createElement('div');
    slidersDiv.className = 'variable-sliders';

    // f* slider
    const fStarRow = this.createSliderRow(
      'value:',
      'fStarSlider',
      'fStarValue',
      sliders.fStar,
      this.state.fStar,
      (value) => {
        this.state.setFStar(value);
        this.state.save();
      }
    );
    slidersDiv.appendChild(fStarRow);

    box.appendChild(slidersDiv);
    return box;
  }

  /**
   * Create a single variable control box
   */
  createVariableBox(index) {
    const isActive = index < this.state.numVariables;
    const varData = this.state.variables[index];

    // Main box
    const box = document.createElement('div');
    box.className = 'variable-box';
    if (!isActive) {
      box.classList.add('hidden');
    }

    // Variable label
    const label = document.createElement('div');
    label.className = 'variable-label';
    label.innerHTML = `$a_{${index + 1}}$`;
    box.appendChild(label);

    // Sliders container
    const slidersDiv = document.createElement('div');
    slidersDiv.className = 'variable-sliders';

    // k slider (on top)
    const kRow = this.createSliderRow(
      `$k_{${index + 1}}$:`,
      `kSlider_${index}`,
      `kValue_${index}`,
      sliders.k,
      varData.k,
      (value) => {
        this.state.setVariable(index, { k: value });
        this.state.save(); // Persist on change
      }
    );
    slidersDiv.appendChild(kRow);

    // a0 slider (on bottom)
    const a0Row = this.createSliderRow(
      'init:',
      `a0Slider_${index}`,
      `a0Value_${index}`,
      sliders.a0,
      varData.a0,
      (value) => {
        this.state.setVariable(index, { a0: value });
        this.state.save(); // Persist on change
      }
    );
    slidersDiv.appendChild(a0Row);

    box.appendChild(slidersDiv);
    return box;
  }

  /**
   * Create a slider row with label, input, and value display
   */
  createSliderRow(labelText, sliderId, valueId, slider, initialValue, onChange) {
    const row = document.createElement('div');
    row.className = 'slider-row';

    // Label
    const label = document.createElement('label');
    label.className = 'slider-label';
    label.innerHTML = labelText;
    row.appendChild(label);

    // Slider input
    const input = document.createElement('input');
    input.type = 'range';
    input.id = sliderId;
    input.className = 'slider-input';
    input.min = 0;
    input.max = 100;
    input.step = 1;
    input.value = slider.valueToSlider(initialValue);
    row.appendChild(input);

    // Value display
    const valueSpan = document.createElement('span');
    valueSpan.id = valueId;
    valueSpan.className = 'slider-value';
    valueSpan.innerHTML = slider.format(initialValue);
    row.appendChild(valueSpan);

    // Event listener
    input.addEventListener('input', function() {
      const value = slider.sliderToValue(this.value);
      valueSpan.innerHTML = slider.format(value);
      onChange(value);
    });

    return row;
  }

  /**
   * Attach add/remove button handlers
   */
  attachGlobalButtons() {
    const addButton = document.getElementById('addVariableButton');
    const removeButton = document.getElementById('removeVariableButton');

    addButton.addEventListener('click', () => {
      this.state.addVariable();
      this.state.save();
      // Re-render to show new box
      this.render();
      this.updateButtonStates();
    });

    removeButton.addEventListener('click', () => {
      this.state.removeVariable();
      this.state.save();
      // Re-render to hide box
      this.render();
      this.updateButtonStates();
    });

    // Initial button state
    this.updateButtonStates();
  }

  /**
   * Update add/remove button states
   */
  updateButtonStates() {
    const addButton = document.getElementById('addVariableButton');
    const removeButton = document.getElementById('removeVariableButton');

    // Disable remove button at minimum
    if (this.state.numVariables <= CONFIG.variables.min) {
      removeButton.disabled = true;
      removeButton.classList.add('disabled');
    } else {
      removeButton.disabled = false;
      removeButton.classList.remove('disabled');
    }

    // Disable add button at maximum
    if (this.state.numVariables >= CONFIG.variables.max) {
      addButton.disabled = true;
      addButton.classList.add('disabled');
    } else {
      addButton.disabled = false;
      addButton.classList.remove('disabled');
    }
  }
}

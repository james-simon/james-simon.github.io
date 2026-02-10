// ============================================================================
// UI CONTROLS - Slider initialization and event handlers
// ============================================================================

import { LogarithmicSlider, LogarithmicSliderWithOff, formatScientific } from '../utils/sliders.js';
import { calculateAllTheory } from '../core/theory.js';

/**
 * ControlsManager - handles all slider initialization and events
 */
export class ControlsManager {
  constructor(appState, displayManager, onParamsChange) {
    this.appState = appState;
    this.display = displayManager;
    this.onParamsChange = onParamsChange; // Callback when params change

    // Current values
    this.currentD = appState.d;
    this.gammaValues = [...appState.gammaValues];
    this.alphaValues = [...appState.alphaValues];

    // Create sliders
    this.kSlider = new LogarithmicSlider(10, 30000);
    this.etaSlider = new LogarithmicSlider(0.0001, 1);
    this.batchSizeSlider = new LogarithmicSlider(1, 1000);
    this.gammaSlider = new LogarithmicSlider(0.0001, 1);
  }

  /**
   * Initialize all controls
   */
  initialize() {
    this.initializeKSlider();
    this.initializeDSlider();
    this.initializeEtaSlider();
    this.initializeBatchSizeSlider();
    this.renderGammaSliders();
    this.renderAlphaSliders();
  }

  /**
   * Initialize k slider
   */
  initializeKSlider() {
    const sliderElement = document.getElementById('kSlider');
    const valueElement = document.getElementById('kValue');

    sliderElement.value = this.kSlider.valueToSlider(this.appState.k);
    valueElement.textContent = this.appState.k.toString();

    sliderElement.addEventListener('input', (e) => {
      const value = this.kSlider.sliderToValue(parseFloat(e.target.value));
      valueElement.textContent = value.toString();
      this.appState.k = value;
      this.appState.save();
      this.onParamsChange();
    });
  }

  /**
   * Initialize d slider (linear, 1-5)
   */
  initializeDSlider() {
    const sliderElement = document.getElementById('dSlider');
    const valueElement = document.getElementById('dValue');

    sliderElement.value = this.appState.d;
    valueElement.textContent = this.appState.d.toString();

    sliderElement.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      valueElement.textContent = value.toString();
      this.currentD = value;
      this.appState.d = value;
      this.appState.save();

      // Re-render sliders for new dimension
      this.renderGammaSliders();
      this.renderAlphaSliders();
      this.updateTargetFunctionEquation();
      this.onParamsChange();
    });
  }

  /**
   * Initialize eta slider
   */
  initializeEtaSlider() {
    const sliderElement = document.getElementById('etaSlider');
    const valueElement = document.getElementById('etaValue');

    sliderElement.value = this.etaSlider.valueToSlider(this.appState.eta);
    valueElement.innerHTML = formatScientific(this.appState.eta);

    sliderElement.addEventListener('input', (e) => {
      const value = this.etaSlider.sliderToValue(parseFloat(e.target.value));
      valueElement.innerHTML = formatScientific(value);
      this.appState.eta = value;
      this.appState.save();
      this.onParamsChange();
    });
  }

  /**
   * Initialize batch size slider
   */
  initializeBatchSizeSlider() {
    const sliderElement = document.getElementById('batchSizeSlider');
    const valueElement = document.getElementById('batchSizeValue');

    sliderElement.value = this.batchSizeSlider.valueToSlider(this.appState.batchSize);
    valueElement.innerHTML = formatScientific(this.appState.batchSize);

    sliderElement.addEventListener('input', (e) => {
      const value = this.batchSizeSlider.sliderToValue(parseFloat(e.target.value));
      valueElement.innerHTML = formatScientific(value);
      this.appState.batchSize = value;
      this.appState.save();
    });
  }

  /**
   * Render gamma sliders
   */
  renderGammaSliders() {
    this.renderParameterSliders({
      containerId: 'gammaSliders',
      count: this.currentD,
      values: this.gammaValues,
      stateKey: 'gammaValues',
      label: (i) => `γ<sub>${i+1}</sub>`,
      parseValue: (pos) => this.gammaSlider.sliderToValue(pos),
      formatValue: (val) => formatScientific(val),
      displayProp: 'innerHTML',
      displayWidth: '60px'
    });
  }

  /**
   * Render alpha sliders
   */
  renderAlphaSliders() {
    this.renderParameterSliders({
      containerId: 'alphaSliders',
      count: this.currentD,
      values: this.alphaValues,
      stateKey: 'alphaValues',
      label: (i) => `α<sub>${i+1}</sub>`,
      parseValue: (pos) => parseInt(pos),
      formatValue: (val) => val.toString(),
      displayProp: 'textContent',
      displayWidth: '30px',
      max: 3
    });
  }

  /**
   * Generic function to render dynamic parameter sliders
   */
  renderParameterSliders(config) {
    const container = document.getElementById(config.containerId);
    container.innerHTML = '';

    for (let i = 0; i < config.count; i++) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 6px;';

      const label = document.createElement('span');
      label.style.cssText = 'font-size: 18px; min-width: 30px;';
      label.innerHTML = `${config.label(i)}:`;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = config.max !== undefined ? config.max.toString() : '100';
      slider.style.width = '120px';

      const valueSpan = document.createElement('span');
      valueSpan.style.cssText = `font-size: 16px; min-width: ${config.displayWidth}; text-align: left;`;

      // Set initial value
      const currentValue = config.values[i];
      if (config.stateKey === 'alphaValues') {
        slider.value = currentValue;
      } else {
        slider.value = this.gammaSlider.valueToSlider(currentValue);
      }
      valueSpan[config.displayProp] = config.formatValue(currentValue);

      // Add event listener
      slider.addEventListener('input', (e) => {
        const value = config.parseValue(parseFloat(e.target.value));
        config.values[i] = value;
        valueSpan[config.displayProp] = config.formatValue(value);
        this.appState[config.stateKey] = [...config.values];
        this.appState.save();

        // Update theory calculations when alpha or gamma changes
        if (config.stateKey === 'alphaValues') {
          this.updateTargetFunctionEquation();
        } else if (config.stateKey === 'gammaValues') {
          this.updateTheoryCalculations();
        }
      });

      wrapper.appendChild(label);
      wrapper.appendChild(slider);
      wrapper.appendChild(valueSpan);
      container.appendChild(wrapper);
    }
  }

  /**
   * Update target function equation based on d
   */
  updateTargetFunctionEquation() {
    const factors = [];
    for (let i = 0; i < this.currentD; i++) {
      const alpha = this.alphaValues[i];
      const arg = `\\gamma_{${i+1}}^{-1/2} x_{${i+1}}`;

      if (alpha === 0) {
        // h_0 = 1, skip (don't add to factors)
        continue;
      } else if (alpha === 1) {
        // h_1(z) = z, just use the argument
        factors.push(arg);
      } else {
        // h_2 and higher
        factors.push(`h_{${alpha}}(${arg})`);
      }
    }

    // Determine what to render
    let productString;
    if (factors.length === 0) {
      // All alphas are 0, product is 1
      productString = '1';
    } else {
      // Join terms with cdot
      productString = factors.join(' \\cdot ');
    }

    const equation = `$$\\begin{align}
f_*(\\mathbf{x}) &= h_{\\boldsymbol{\\alpha}}\\left(\\mathbf{\\Gamma}^{-1/2} \\mathbf{x}\\right) \\\\
&= ${productString}
\\end{align}$$`;

    const container = document.getElementById('targetFunctionEquation');
    container.textContent = equation;

    // Render MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetPromise([container]).catch((err) => console.log(err));
    } else if (window.MathJax && window.MathJax.Hub) {
      MathJax.Hub.Queue(["Typeset", MathJax.Hub, container]);
    }

    // Update theory calculations
    this.updateTheoryCalculations();
  }

  /**
   * Update all theory calculations
   */
  updateTheoryCalculations() {
    const theory = calculateAllTheory(this.gammaValues, this.alphaValues, this.currentD);

    // Update modeling ODE formula
    this.display.updateModelingOdeFormula(this.alphaValues, this.currentD);

    // Update rate constant formula
    this.display.updateRateConstantFormula(this.alphaValues, this.gammaValues, this.currentD);

    // Update all theory values
    this.display.updateTheoryValues(theory);
  }

  /**
   * Get current parameter values
   */
  getCurrentParams() {
    return {
      d: this.currentD,
      k: this.appState.k,
      gammas: this.gammaValues.slice(0, this.currentD),
      alphas: this.alphaValues.slice(0, this.currentD),
      eta: this.appState.eta,
      batchSize: this.appState.batchSize
    };
  }
}

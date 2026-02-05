// ============================================================================
// GRADIENT DESCENT SIMULATION
// ============================================================================

// Simulation state
let simulationRunning = false;
let tensorVariables = new Map(); // tensorName -> tf.Variable
let targetTensor = null;
let lossHistory = [];
let tensorSVHistory = {}; // tensorName -> legIndex -> [{iteration, svs}, ...]
let legSVHistory = {}; // legId -> [{iteration, svs}, ...]
// Note: currentLegSVCounts and iterationCount are defined in state.js as globals
let learningRate = 0.01;
let lossChart = null;
let selectedSVChart = null; // Chart for the main selected SV plot
let additionalSVCharts = []; // Charts for additional selected legs
let sidePanelLossChart = null; // Chart for the side panel loss plot (always visible)
let sidePanelSVChart = null; // Chart for the side panel SV plot (shown when leg selected)
let animationFrameId = null;
let simulationStartTime = null;
let pauseStartTime = null;
let stepTimestamps = []; // Rolling window of recent step timestamps for steps/sec calculation
const STEPS_PER_SEC_WINDOW = 60; // Average over last 60 steps
let lastStepsPerSecUpdate = 0; // Timestamp of last steps/sec display update
const STEPS_PER_SEC_UPDATE_INTERVAL = 250; // Update display every 250ms (4 times per second)
let lastChartUpdate = 0; // Timestamp of last chart update
const CHART_UPDATE_INTERVAL = 25; // Update charts every 25ms (~40 FPS)

// Random seed state
let manualSeeds = false;
let initSeed = 0;
let targetSeed = 0;

// Seeded random number generator (simple LCG)
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  // Generate next random number in [0, 1)
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  // Box-Muller transform to get normal distribution
  nextGaussian(mean = 0, stddev = 1) {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stddev;
  }
}

// Helper function to get the latest SVs for a tensor's connection to a specific leg
function getLatestTensorLegSVs(tensor, leg) {
  const tensorName = tensor.name;
  if (!tensorSVHistory[tensorName]) {
    return null;
  }

  // Find which leg index of this tensor corresponds to this leg
  const connectedLegs = legs.filter(l => l.startTensor === tensor || l.endTensor === tensor);
  const legIndex = connectedLegs.findIndex(l => l.id === leg.id);

  if (legIndex === -1 || !tensorSVHistory[tensorName][legIndex]) {
    return null;
  }

  const history = tensorSVHistory[tensorName][legIndex];
  if (history.length === 0) {
    return null;
  }

  return history[history.length - 1].svs;
}

// Unfold tensor along a specific leg
function unfoldTensor(tensorArray, shape, legIndex) {
  const rank = shape.length;

  // Special case for 1D tensors
  if (rank === 1) {
    return [tensorArray];
  }

  // Compute dimensions
  const legDim = shape[legIndex];
  const otherDims = shape.filter((_, i) => i !== legIndex);
  const otherDimProduct = otherDims.reduce((a, b) => a * b, 1);

  // Create output matrix
  const matrix = Array(legDim).fill(0).map(() => Array(otherDimProduct).fill(0));

  // Create index arrays for iteration
  const indices = Array(rank).fill(0);

  // Flatten the tensor into matrix
  function getValue(arr, idx) {
    let current = arr;
    for (let i = 0; i < idx.length - 1; i++) {
      current = current[idx[i]];
    }
    return current[idx[idx.length - 1]];
  }

  // Iterate over all tensor elements
  function iterate(dim) {
    if (dim === rank) {
      // Compute matrix position
      const row = indices[legIndex];

      // Compute column by flattening other indices
      let col = 0;
      let stride = 1;
      for (let i = rank - 1; i >= 0; i--) {
        if (i !== legIndex) {
          col += indices[i] * stride;
          stride *= shape[i];
        }
      }

      matrix[row][col] = getValue(tensorArray, indices);
      return;
    }

    for (let i = 0; i < shape[dim]; i++) {
      indices[dim] = i;
      iterate(dim + 1);
    }
  }

  iterate(0);
  return matrix;
}
function updateLearningRateDisplay(rate) {
  const display = document.getElementById('learningRateValue');
  if (display) {
    display.innerHTML = formatLearningRate(rate);
  }
}

// Convert diagram to einsum notation
function diagramToEinsum() {
  if (tensors.length === 0) {
    return null;
  }

  // Sort tensors alphabetically by name
  const sortedTensors = [...tensors].sort((a, b) => a.name.localeCompare(b.name));

  // Build einsum string and collect shapes
  const inputSpecs = [];
  const tensorShapes = new Map();
  const indexDims = new Map(); // index letter -> dimension

  // First pass: determine dimension for each index
  legs.forEach(leg => {
    if (!indexDims.has(leg.name)) {
      indexDims.set(leg.name, globalDimension);
    }
  });

  // Second pass: build einsum inputs and determine tensor shapes
  sortedTensors.forEach(tensor => {
    const connectedLegs = legs.filter(leg =>
      leg.startTensor === tensor || leg.endTensor === tensor
    );
    const legNames = connectedLegs.map(leg => leg.name).sort();

    inputSpecs.push(legNames.join(''));

    // Determine shape of this tensor
    const shape = legNames.map(name => indexDims.get(name));
    tensorShapes.set(tensor.name, shape);
  });

  // Determine output indices (external legs)
  const externalLegs = new Set();
  legs.forEach(leg => {
    const connectedTensorCount = (leg.startTensor ? 1 : 0) + (leg.endTensor ? 1 : 0);
    if (connectedTensorCount === 1) {
      externalLegs.add(leg.name);
    }
  });

  const outputSpec = Array.from(externalLegs).sort().join('');

  // Build einsum equation
  const equation = inputSpecs.join(',') + '->' + outputSpec;

  return {
    equation,
    tensorShapes,
    tensorNames: sortedTensors.map(t => t.name),
    outputShape: outputSpec.split('').map(name => indexDims.get(name))
  };
}

// Initialize simulation
function initializeSimulation() {
  console.log('Initializing simulation...');

  // Clear previous state
  if (tensorVariables.size > 0) {
    tensorVariables.forEach(v => v.dispose());
    tensorVariables.clear();
  }
  if (targetTensor) {
    targetTensor.dispose();
    targetTensor = null;
  }

  // Get einsum info
  const einsumInfo = diagramToEinsum();
  if (!einsumInfo) {
    console.log('No tensors in diagram');
    return false;
  }

  console.log('Einsum equation:', einsumInfo.equation);
  console.log('Tensor shapes:', einsumInfo.tensorShapes);

  // Initialize tensor variables
  const variance = globalInitScale * globalInitScale;
  const stddev = Math.sqrt(variance);

  if (manualSeeds) {
    // Use seeded RNG for reproducibility
    const rng = new SeededRandom(initSeed);
    einsumInfo.tensorNames.forEach(name => {
      const shape = einsumInfo.tensorShapes.get(name);
      const size = shape.reduce((a, b) => a * b, 1);
      const values = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        values[i] = rng.nextGaussian(0, stddev);
      }
      const tensor = tf.tensor(values, shape);
      tensorVariables.set(name, tf.variable(tensor));
      tensor.dispose(); // Dispose intermediate tensor
    });
  } else {
    // Use TensorFlow's random for true randomness
    einsumInfo.tensorNames.forEach(name => {
      const shape = einsumInfo.tensorShapes.get(name);
      const values = tf.randomNormal(shape, 0, stddev);
      tensorVariables.set(name, tf.variable(values));
      values.dispose(); // Dispose intermediate tensor
    });
  }

  // Create target tensor
  if (manualSeeds) {
    // Use seeded RNG for reproducibility
    const rng = new SeededRandom(targetSeed);
    const shape = einsumInfo.outputShape.length === 0 ? [1] : einsumInfo.outputShape;
    const size = shape.reduce((a, b) => a * b, 1);
    const values = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      values[i] = rng.nextGaussian(0, 1);
    }
    targetTensor = tf.tensor(values, shape);
  } else {
    // Use TensorFlow's random for true randomness
    if (einsumInfo.outputShape.length === 0) {
      targetTensor = tf.randomNormal([1], 0, 1);
    } else {
      targetTensor = tf.randomNormal(einsumInfo.outputShape, 0, 1);
    }
  }

  console.log('Initialized', tensorVariables.size, 'tensor variables');
  console.log('Target tensor shape:', targetTensor.shape);

  // Debug: Check if manual seeds are enabled
  console.log('DEBUG: manualSeeds =', manualSeeds, ', initSeed =', initSeed, ', targetSeed =', targetSeed);

  // Debug: Log sums to verify random seeds
  let paramSum = 0;
  tensorVariables.forEach((tensorVar, name) => {
    const sum = tf.tidy(() => tf.sum(tensorVar).dataSync()[0]);
    paramSum += sum;
  });
  const targetSum = tf.tidy(() => tf.sum(targetTensor).dataSync()[0]);
  console.log('DEBUG: Sum of all parameter elements:', paramSum);
  console.log('DEBUG: Sum of all target tensor elements:', targetSum);

  // Reset history
  lossHistory = [];
  tensorSVHistory = {};
  legSVHistory = {};
  currentLegSVCounts = {};
  currentLegSVs = {};
  initialMaxSVs = {};
  iterationCount = 0;

  // Clear downsampled SV cache
  if (window.downsampledSVCache) {
    window.downsampledSVCache = {};
  }
  simulationStartTime = null;
  pauseStartTime = null;
  stepTimestamps = [];
  updateLossDisplay(null);

  // Clear charts
  if (sidePanelLossChart) {
    sidePanelLossChart.data.datasets = [];
    sidePanelLossChart.update('none');
  }
  updateSidePanelSVChart(); // Update side panel chart

  document.getElementById('stepsPerSec').textContent = '—';

  // Redraw canvas to clear floating SV plots
  draw();

  return true;
}

// Contract two tensors with given index specifications
function contractPair(tensor1, spec1, tensor2, spec2) {
  return tf.tidy(() => {
    // Find shared indices (to be contracted)
    const indices1 = spec1.split('').filter(x => x); // Remove empty strings
    const indices2 = spec2.split('').filter(x => x);
    const sharedIndices = indices1.filter(idx => indices2.includes(idx));
    const freeIndices1 = indices1.filter(idx => !sharedIndices.includes(idx));
    const freeIndices2 = indices2.filter(idx => !sharedIndices.includes(idx));

    // Validate dimensions match specs
    if (tensor1.shape.length !== indices1.length) {
      console.error('Tensor1 rank mismatch:', tensor1.shape.length, 'vs spec length', indices1.length);
      throw new Error(`Tensor rank ${tensor1.shape.length} doesn't match spec length ${indices1.length}`);
    }
    if (tensor2.shape.length !== indices2.length) {
      console.error('Tensor2 rank mismatch:', tensor2.shape.length, 'vs spec length', indices2.length);
      throw new Error(`Tensor rank ${tensor2.shape.length} doesn't match spec length ${indices2.length}`);
    }

    if (sharedIndices.length === 0) {
      // Outer product - use broadcasting
      const shape1 = tensor1.shape;
      const shape2 = tensor2.shape;
      const reshapedT1 = tf.reshape(tensor1, [...shape1, ...Array(shape2.length).fill(1)]);
      const reshapedT2 = tf.reshape(tensor2, [...Array(shape1.length).fill(1), ...shape2]);
      return tf.mul(reshapedT1, reshapedT2);
    }

    // For simplicity, implement matrix multiplication for 2D case
    // Reshape tensors to matrices and use matMul
    const dim1 = tensor1.shape;
    const dim2 = tensor2.shape;

    // Flatten free indices and contracted indices
    const freeSize1 = freeIndices1.length > 0
      ? freeIndices1.reduce((prod, idx) => prod * dim1[indices1.indexOf(idx)], 1)
      : 1;
    const freeSize2 = freeIndices2.length > 0
      ? freeIndices2.reduce((prod, idx) => prod * dim2[indices2.indexOf(idx)], 1)
      : 1;
    const contractSize = sharedIndices.reduce((prod, idx) => prod * dim1[indices1.indexOf(idx)], 1);

    // Transpose tensor1 to put free indices first, then contracted indices
    const perm1 = [...freeIndices1.map(idx => indices1.indexOf(idx)),
                    ...sharedIndices.map(idx => indices1.indexOf(idx))];
    const transposed1 = perm1.length > 0 && perm1.some((p, i) => p !== i)
      ? tf.transpose(tensor1, perm1)
      : tensor1;
    const matrix1 = tf.reshape(transposed1, [freeSize1, contractSize]);

    // Transpose tensor2 to put contracted indices first, then free indices
    const perm2 = [...sharedIndices.map(idx => indices2.indexOf(idx)),
                    ...freeIndices2.map(idx => indices2.indexOf(idx))];
    const transposed2 = perm2.length > 0 && perm2.some((p, i) => p !== i)
      ? tf.transpose(tensor2, perm2)
      : tensor2;
    const matrix2 = tf.reshape(transposed2, [contractSize, freeSize2]);

    // Matrix multiply
    const resultMatrix = tf.matMul(matrix1, matrix2);

    // Reshape back to tensor
    const outputIndices = [...freeIndices1, ...freeIndices2];
    const outputShape = outputIndices.map(idx => {
      if (freeIndices1.includes(idx)) {
        return dim1[indices1.indexOf(idx)];
      } else {
        return dim2[indices2.indexOf(idx)];
      }
    });

    const result = outputShape.length > 0
      ? tf.reshape(resultMatrix, outputShape)
      : tf.squeeze(resultMatrix);
    return result;
  });
}

// Compute tensor contraction
function computeContraction() {
  const einsumInfo = diagramToEinsum();
  if (!einsumInfo) {
    return null;
  }

  // Get tensor values in correct order
  const tensorValues = einsumInfo.tensorNames.map(name => tensorVariables.get(name));
  const inputSpecs = einsumInfo.equation.split('->')[0].split(',');
  const outputSpec = einsumInfo.equation.split('->')[1];

  if (tensorValues.length === 0) {
    return tf.scalar(1);
  } else if (tensorValues.length === 1) {
    return tensorValues[0];
  } else {
    // Contract pairwise
    let result = tensorValues[0];
    let resultSpec = inputSpecs[0];

    for (let i = 1; i < tensorValues.length; i++) {
      result = contractPair(result, resultSpec, tensorValues[i], inputSpecs[i]);

      // Update result spec
      const indices1 = resultSpec.split('');
      const indices2 = inputSpecs[i].split('');
      const sharedIndices = indices1.filter(idx => indices2.includes(idx));
      const freeIndices1 = indices1.filter(idx => !sharedIndices.includes(idx));
      const freeIndices2 = indices2.filter(idx => !sharedIndices.includes(idx));
      resultSpec = [...freeIndices1, ...freeIndices2].join('');
    }

    return result;
  }
}

// Compute loss
function computeLoss() {
  const T = computeContraction();
  if (!T) {
    return null;
  }

  // Compute Frobenius norm squared of difference
  const diff = tf.sub(T, targetTensor);
  const loss = tf.sum(tf.square(diff));

  return loss;
}

// Single gradient descent step
function gradientStep() {
  tf.tidy(() => {
    const grads = tf.variableGrads(() => computeLoss());

    // Update each variable
    tensorVariables.forEach((variable, name) => {
      const grad = grads.grads[variable.name];
      if (grad) {
        const update = tf.mul(grad, learningRate);
        variable.assign(tf.sub(variable, update));
      }
    });

    // Note: grads will be automatically disposed by tf.tidy
  });
}

// Simulation loop
function simulationLoop() {
  if (!simulationRunning) {
    return;
  }

  const loopStart = performance.now();

  // Perform multiple gradient steps per frame
  const gradStart = performance.now();
  const stepsPerFrame = 3;
  for (let i = 0; i < stepsPerFrame; i++) {
    gradientStep();
  }
  const gradTime = performance.now() - gradStart;

  // Compute and record loss (before incrementing, so first iteration is 0)
  const lossStart = performance.now();
  const lossValue = tf.tidy(() => {
    const loss = computeLoss();
    return loss.dataSync()[0];
  });

  lossHistory.push({ iteration: iterationCount, loss: lossValue });
  updateLossDisplay(lossValue);
  const lossTime = performance.now() - lossStart;

  // Update charts at ~40 FPS for performance
  const chartStart = performance.now();
  const now = performance.now();
  if (now - lastChartUpdate >= CHART_UPDATE_INTERVAL) {
    updateSidePanelLossChart(); // Update side panel loss chart (always visible)
    updateSidePanelSVChart(); // Update side panel SV chart (if leg selected)
    lastChartUpdate = now;
  }
  const chartTime = performance.now() - chartStart;

  // Update steps/sec display using rolling average (throttled to a few times per second)
  stepTimestamps.push(now);
  if (stepTimestamps.length > STEPS_PER_SEC_WINDOW) {
    stepTimestamps.shift();
  }

  if (stepTimestamps.length >= 2 && now - lastStepsPerSecUpdate >= STEPS_PER_SEC_UPDATE_INTERVAL) {
    const timeSpanMs = stepTimestamps[stepTimestamps.length - 1] - stepTimestamps[0];
    const timeSpanSec = timeSpanMs / 1000;
    const stepsInWindow = stepTimestamps.length - 1; // Number of intervals between timestamps
    const stepsPerSec = (stepsInWindow / timeSpanSec) * stepsPerFrame; // Multiply by steps per frame
    document.getElementById('stepsPerSec').textContent = Math.round(stepsPerSec).toString();
    lastStepsPerSecUpdate = now;
  }

  // Track SVs for each tensor from POV of each leg
  const svStart = performance.now();
  tensorVariables.forEach((tensorVar, tensorName) => {
    const shape = tensorVar.shape;
    const rank = shape.length;

    // Initialize storage for this tensor if needed
    if (!tensorSVHistory[tensorName]) {
      tensorSVHistory[tensorName] = {};
      for (let leg = 0; leg < rank; leg++) {
        tensorSVHistory[tensorName][leg] = [];
      }
    }

    // For each leg, unfold and compute SVD
    for (let legIndex = 0; legIndex < rank; legIndex++) {
      const svs = tf.tidy(() => {
        // Get tensor as array
        const tensorArray = tensorVar.arraySync();

        // Unfold tensor along this leg
        let matrix = unfoldTensor(tensorArray, shape, legIndex);

        // numeric.svd requires rows >= columns, so transpose if needed
        const rows = matrix.length;
        const cols = matrix[0].length;
        if (cols > rows) {
          matrix = numeric.transpose(matrix);
        }

        // Compute SVD
        const svd = numeric.svd(matrix);

        return svd.S;
      });

      tensorSVHistory[tensorName][legIndex].push({ iteration: iterationCount, svs });
    }
  });

  // Track SVs for each leg in the diagram
  legs.forEach(leg => {
    // Initialize storage for this leg if needed
    if (!legSVHistory[leg.id]) {
      legSVHistory[leg.id] = [];
    }

    let legSVs = null;

    // Get SV lists from both connected tensors (if they exist)
    const sv1 = leg.startTensor ? getLatestTensorLegSVs(leg.startTensor, leg) : null;
    const sv2 = leg.endTensor ? getLatestTensorLegSVs(leg.endTensor, leg) : null;

    if (sv1 && sv2) {
      // Both ends connected - take elementwise max
      const maxLen = Math.max(sv1.length, sv2.length);
      legSVs = [];
      for (let i = 0; i < maxLen; i++) {
        const val1 = i < sv1.length ? sv1[i] : 0;
        const val2 = i < sv2.length ? sv2[i] : 0;
        legSVs.push(Math.max(val1, val2));
      }
    } else if (sv1) {
      // Only start tensor connected
      legSVs = sv1;
    } else if (sv2) {
      // Only end tensor connected
      legSVs = sv2;
    }

    if (legSVs) {
      legSVHistory[leg.id].push({ iteration: iterationCount, svs: legSVs });

      // Store current SVs for visualization
      currentLegSVs[leg.id] = legSVs;

      // Track initial max SV for this leg (at iteration 0)
      if (iterationCount === 0) {
        initialMaxSVs[leg.id] = Math.max(...legSVs);
      }

      // Count SVs > 0.1 for annotation
      const count = legSVs.filter(sv => sv > 0.1).length;
      currentLegSVCounts[leg.id] = count;
    }
  });
  const svTime = performance.now() - svStart;

  // Redraw canvas to show updated annotations
  const drawStart = performance.now();
  draw();
  const drawTime = performance.now() - drawStart;

  const totalTime = performance.now() - loopStart;

  // Log timing breakdown periodically
  if (iterationCount % 1000 === 0) {
    const memInfo = tf.memory();
    console.log(`Iteration ${iterationCount}: ${memInfo.numTensors} tensors, ${(memInfo.numBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Timing breakdown (ms): grad=${gradTime.toFixed(2)}, loss=${lossTime.toFixed(2)}, sv=${svTime.toFixed(2)}, chart=${chartTime.toFixed(2)}, draw=${drawTime.toFixed(2)}, total=${totalTime.toFixed(2)}`);
  }

  // Increment iteration counter by number of steps performed
  iterationCount += stepsPerFrame;

  // Continue loop
  animationFrameId = requestAnimationFrame(simulationLoop);
}

// Start simulation
function startSimulation() {
  if (simulationRunning) {
    return;
  }

  // Initialize if needed (only if not already initialized)
  if (tensorVariables.size === 0) {
    const success = initializeSimulation();
    if (!success) {
      alert('Cannot start simulation: no tensors in diagram');
      return;
    }
  }

  simulationRunning = true;
  document.getElementById('startPauseButton').textContent = 'pause';
  document.getElementById('startPauseButton').classList.add('running');

  // Record start time if starting from iteration 0, or adjust for pause time
  if (iterationCount === 0) {
    simulationStartTime = performance.now();
  } else if (pauseStartTime !== null) {
    // Adjust start time to exclude pause duration
    const pauseDuration = performance.now() - pauseStartTime;
    simulationStartTime += pauseDuration;
    pauseStartTime = null;
  }

  simulationLoop();
}

// Pause simulation
function pauseSimulation() {
  simulationRunning = false;
  document.getElementById('startPauseButton').textContent = 'start';
  document.getElementById('startPauseButton').classList.remove('running');

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Record pause time
  pauseStartTime = performance.now();
}

// Reset simulation (clear state but don't generate new random values yet)
function resetSimulation() {
  pauseSimulation();

  // Clear previous state
  if (tensorVariables.size > 0) {
    tensorVariables.forEach(v => v.dispose());
    tensorVariables.clear();
  }
  if (targetTensor) {
    targetTensor.dispose();
    targetTensor = null;
  }

  // Reset history
  lossHistory = [];
  tensorSVHistory = {};
  legSVHistory = {};
  currentLegSVCounts = {};
  currentLegSVs = {};
  initialMaxSVs = {};
  iterationCount = 0;

  // Clear downsampled SV cache
  if (window.downsampledSVCache) {
    window.downsampledSVCache = {};
  }
  simulationStartTime = null;
  pauseStartTime = null;
  stepTimestamps = [];
  updateLossDisplay(null);

  // Clear charts
  if (sidePanelLossChart) {
    sidePanelLossChart.data.datasets = [];
    sidePanelLossChart.update('none');
  }
  updateSidePanelSVChart(); // Update side panel chart

  document.getElementById('stepsPerSec').textContent = '—';

  // Redraw canvas to clear floating SV plots
  draw();
}

// Update loss display
function updateLossDisplay(loss) {
  const display = document.getElementById('currentLoss');
  if (display) {
    if (loss === null) {
      display.innerHTML = '—';
    } else {
      display.innerHTML = formatToSigFigs(loss, 4);
    }
  }
}

// Helper to update a single SV chart with leg data
function updateSingleSVChart(chart, leg) {
  if (!legSVHistory[leg.id]) {
    return;
  }

  const history = legSVHistory[leg.id];
  if (history.length === 0) {
    return;
  }

  const latestEntry = history[history.length - 1];
  const numSVs = latestEntry.svs.length;
  const maxIteration = history[history.length - 1].iteration;

  // Calculate tick step
  const tickStep = calculateTickStep(maxIteration);

  // Filter data to only include points at tick intervals
  const filteredIndices = [];
  const filteredLabels = [];

  history.forEach((entry, idx) => {
    if (entry.iteration % tickStep === 0 || idx === history.length - 1) {
      filteredIndices.push(idx);
      filteredLabels.push(entry.iteration);
    }
  });

  // Update each SV's dataset
  for (let i = 0; i < numSVs; i++) {
    if (!chart.data.datasets[i]) {
      const color = getSVColor(i, numSVs);
      chart.data.datasets[i] = {
        label: `SV ${i + 1}`,
        data: [],
        borderColor: color,
        backgroundColor: color.replace('hsl', 'hsla').replace(')', ', 0.1)'),
        borderWidth: 2,
        pointRadius: 0,
        tension: 0
      };
    }

    // Use all data points for smooth lines
    chart.data.datasets[i].data = history.map(entry =>
      entry.svs[i] !== undefined ? entry.svs[i] : 0
    );
  }

  // Use all iterations as labels, but only show ticks at intervals
  chart.data.labels = history.map(d => d.iteration);

  // Update x-axis to only show labels at intervals
  chart.options.scales.x.ticks.callback = function(value, index) {
    const iteration = this.getLabelForValue(value);
    if (iteration % tickStep === 0 || index === history.length - 1) {
      return iteration;
    }
    return '';
  };

  chart.update('none');
}

// Helper to create an SV chart
function createSVChart(ctx, leg) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Iteration'
          },
          ticks: {
            callback: function(value, index, values) {
              // Only show the label value itself
              return this.getLabelForValue(value);
            },
            autoSkip: false,
            maxRotation: 0,
            maxTicksLimit: 10
          }
        },
        y: {
          title: {
            display: true,
            text: 'Singular Value'
          },
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: `Singular Values - Leg ${leg.name}`
        }
      }
    }
  });
}

// Initialize loss chart
function initializeLossChart() {
  const ctx = document.getElementById('lossPlot').getContext('2d');
  lossChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Loss',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Iteration'
          },
          ticks: {
            callback: function(value, index, values) {
              return this.getLabelForValue(value);
            },
            autoSkip: false,
            maxRotation: 0,
            maxTicksLimit: 10
          }
        },
        y: {
          title: {
            display: true,
            text: 'Loss'
          },
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function initializeSelectedSVChart() {
  const ctx = document.getElementById('selectedSVPlot').getContext('2d');
  selectedSVChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          title: {
            display: true,
            text: 'Iteration'
          },
          ticks: {
            callback: function(value, index, values) {
              return this.getLabelForValue(value);
            },
            autoSkip: false,
            maxRotation: 0,
            maxTicksLimit: 10
          }
        },
        y: {
          title: {
            display: true,
            text: 'Singular Value'
          },
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Select a leg to view SVs'
        }
      }
    }
  });
}

// Side panel charts are now initialized via charts.js
// (functions are called directly from charts.js module)

// Setup simulation UI handlers
function setupSimulationHandlers() {
  const startPauseButton = document.getElementById('startPauseButton');
  const resetButton = document.getElementById('resetButton');
  const learningRateSlider = document.getElementById('learningRate');

  startPauseButton.addEventListener('click', () => {
    if (simulationRunning) {
      pauseSimulation();
    } else {
      startSimulation();
    }
  });

  resetButton.addEventListener('click', () => {
    resetSimulation();
  });

  learningRateSlider.addEventListener('input', (e) => {
    learningRate = sliderToLearningRate(parseFloat(e.target.value));
    updateLearningRateDisplay(learningRate);
  });

  // Manual seeds controls
  const manualSeedsCheckbox = document.getElementById('manualSeedsCheckbox');
  const seedInputs = document.getElementById('seedInputs');
  const initSeedInput = document.getElementById('initSeed');
  const targetSeedInput = document.getElementById('targetSeed');

  manualSeedsCheckbox.addEventListener('change', (e) => {
    manualSeeds = e.target.checked;
    seedInputs.style.display = manualSeeds ? 'flex' : 'none';
    // Trigger MathJax to render the T* label
    if (manualSeeds && window.MathJax) {
      MathJax.typesetPromise([seedInputs]).catch((err) => console.log('MathJax error:', err));
    }
  });

  initSeedInput.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      initSeed = value;
    }
  });

  targetSeedInput.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      targetSeed = value;
    }
  });

  // Initialize displays
  learningRate = sliderToLearningRate(parseFloat(learningRateSlider.value));
  updateLearningRateDisplay(learningRate);

  // Initialize charts
  sidePanelLossChart = initializeSidePanelLossChart();
  sidePanelSVChart = initializeSidePanelSVChart();
}

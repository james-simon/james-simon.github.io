// ============================================================================
// EIGENHYBRIDIZATION - MAIN APPLICATION
// ============================================================================

import { LogarithmicSlider } from './utils/sliders.js';
import { BackendManager } from './backend/backend-manager.js';

console.log('Eigenhybridization app loaded');

// Load saved state or use defaults
function loadState() {
  const saved = localStorage.getItem('eigenhybridization-state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        V: parsed.V || 100,
        d: parsed.d || 10,
        k: parsed.k || 10,
        M: null,
        eigendecomp: null
      };
    } catch (e) {
      console.error('Failed to load saved state:', e);
    }
  }
  return {
    V: 100,
    d: 10,
    k: 10,
    M: null,
    eigendecomp: null
  };
}

// Save state to localStorage
function saveState() {
  const toSave = {
    V: state.V,
    d: state.d,
    k: state.k
  };
  localStorage.setItem('eigenhybridization-state', JSON.stringify(toSave));
}

// Application state
const state = loadState();

// Backend manager
const backendManager = new BackendManager();

// Slider instances
let VSlider, dSlider, kSlider;

// Canvas contexts
let ctxM, ctxK, ctxColorbar, ctxS, ctxStilde, ctxEigenHistM;

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM ready');

  // Get canvas contexts
  const canvasM = document.getElementById('matrixMCanvas');
  const canvasK = document.getElementById('matrixKCanvas');
  const canvasColorbar = document.getElementById('colorbarCanvas');
  const canvasS = document.getElementById('submatrixSCanvas');
  const canvasStilde = document.getElementById('submatrixStildeCanvas');
  const canvasEigenHistM = document.getElementById('eigenHistM');
  ctxM = canvasM.getContext('2d');
  ctxK = canvasK.getContext('2d');
  ctxColorbar = canvasColorbar.getContext('2d');
  ctxS = canvasS.getContext('2d');
  ctxStilde = canvasStilde.getContext('2d');
  ctxEigenHistM = canvasEigenHistM.getContext('2d');

  // Initialize backend
  showLoading(true);
  try {
    const backendType = await backendManager.initialize(updateLoadingProgress);
    console.log(`Backend initialized: ${backendType}`);
    updateBackendStatus(backendType);
  } catch (error) {
    console.error('Backend initialization failed:', error);
    updateBackendStatus('none');
  }
  showLoading(false);

  // Initialize sliders based on backend
  initializeSliders();

  // Generate initial matrices
  console.log('Generating initial matrices with V=' + state.V);
  await generateMatrices();
  render();
});

// Loading indicator functions
function showLoading(show) {
  const indicator = document.getElementById('loadingIndicator');
  if (indicator) {
    indicator.style.display = show ? 'block' : 'none';
  }
}

function updateLoadingProgress(message) {
  const loadingText = document.getElementById('loadingText');
  const loadingBar = document.getElementById('loadingBar');

  if (loadingText) loadingText.textContent = message;

  if (loadingBar) {
    if (message.includes('Pyodide')) {
      loadingBar.style.width = '30%';
    } else if (message.includes('NumPy')) {
      loadingBar.style.width = '70%';
    } else {
      loadingBar.style.width = '100%';
    }
  }
}

// Update backend status indicator
function updateBackendStatus(backendType) {
  const icon = document.getElementById('backendIcon');
  const text = document.getElementById('backendText');

  if (backendType === 'pyodide') {
    icon.textContent = '✓';
    icon.style.color = '#27ae60';
    text.textContent = 'pyodide backend (WebAssembly)';
    text.style.color = '#27ae60';
  } else if (backendType === 'javascript') {
    icon.textContent = '○';
    icon.style.color = '#f39c12';
    text.textContent = 'javascript backend';
    text.style.color = '#f39c12';
  } else {
    icon.textContent = '✕';
    icon.style.color = '#e74c3c';
    text.textContent = 'no backend available';
    text.style.color = '#e74c3c';
  }
}

function initializeSliders() {
  // Pyodide can handle larger matrices than pure JS
  const vMax = backendManager.getBackendType() === 'pyodide' ? 1000 : 500;

  VSlider = new LogarithmicSlider(10, vMax);
  dSlider = new LogarithmicSlider(1, vMax);
  kSlider = new LogarithmicSlider(1, vMax);

  // Get slider elements
  const VSliderEl = document.getElementById('VSlider');
  const dSliderEl = document.getElementById('dSlider');
  const kSliderEl = document.getElementById('kSlider');
  const VValueEl = document.getElementById('VValue');
  const dValueEl = document.getElementById('dValue');
  const kValueEl = document.getElementById('kValue');

  // Initialize V slider
  VSliderEl.value = VSlider.valueToSlider(state.V);
  VValueEl.textContent = state.V;

  VSliderEl.addEventListener('input', (e) => {
    const newV = VSlider.sliderToValue(parseFloat(e.target.value));
    state.V = newV;
    VValueEl.textContent = newV;

    // Clamp d and k to not exceed V
    if (state.d > newV) {
      state.d = newV;
      dSliderEl.value = dSlider.valueToSlider(state.d);
      dValueEl.textContent = state.d;
    }
    if (state.k > newV) {
      state.k = newV;
      kSliderEl.value = kSlider.valueToSlider(state.k);
      kValueEl.textContent = state.k;
    }

    // Update d and k slider max constraint
    updateConstrainedSlider(dSliderEl, state.d, newV);
    updateConstrainedSlider(kSliderEl, state.k, newV);

    // Save state
    saveState();

    // Regenerate matrices (async)
    generateMatrices().then(() => render());

    console.log('State:', state);
  });

  // Initialize d slider
  dSliderEl.value = dSlider.valueToSlider(state.d);
  dValueEl.textContent = state.d;

  dSliderEl.addEventListener('input', (e) => {
    const requestedValue = dSlider.sliderToValue(parseFloat(e.target.value));
    const newD = Math.min(requestedValue, state.V);
    state.d = newD;
    dValueEl.textContent = newD;

    // Update slider position if clamped
    if (newD < requestedValue) {
      e.target.value = dSlider.valueToSlider(newD);
    }

    // Save state
    saveState();

    // Re-render (updates block lines and submatrices, but doesn't regenerate M)
    render();

    console.log('State:', state);
  });

  // Initialize k slider
  kSliderEl.value = kSlider.valueToSlider(state.k);
  kValueEl.textContent = state.k;

  kSliderEl.addEventListener('input', (e) => {
    const requestedValue = kSlider.sliderToValue(parseFloat(e.target.value));
    const newK = Math.min(requestedValue, state.V);
    state.k = newK;
    kValueEl.textContent = newK;

    // Update slider position if clamped
    if (newK < requestedValue) {
      e.target.value = kSlider.valueToSlider(newK);
    }

    // Save state
    saveState();

    // Only re-render (don't regenerate matrices)
    render();

    console.log('State:', state);
  });

  console.log('Sliders initialized. State:', state);

  // Typeset MathJax for titles
  typesetMathJax();
}

// Helper to visually disable slider positions beyond max constraint
function updateConstrainedSlider(sliderEl, currentValue, maxValue) {
  // This is a visual helper - the actual constraint is enforced in the input handler
  // For now, we just ensure the value doesn't exceed max
  // Future: could add visual styling to show disabled range
}

// Typeset MathJax
function typesetMathJax() {
  if (window.MathJax && window.MathJax.typesetPromise) {
    MathJax.typesetPromise().catch((err) => console.log('MathJax typeset error:', err));
  }
}

// Generate random Gaussian sample (Box-Muller transform)
function randn() {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Generate matrices A and M
async function generateMatrices() {
  const V = state.V;

  console.log(`Generating ${V}×${V} matrices...`);

  const startGen = performance.now();

  // Generate A: V×V matrix with iid Gaussian N(0,1) entries
  const A = Array(V).fill(0).map(() => Array(V).fill(0).map(() => randn()));

  // Generate M = (A + A^T) / sqrt(2)
  const M = Array(V).fill(0).map(() => Array(V).fill(0));
  const sqrt2 = Math.sqrt(2);
  for (let i = 0; i < V; i++) {
    for (let j = 0; j < V; j++) {
      M[i][j] = (A[i][j] + A[j][i]) / sqrt2;
    }
  }

  const endGen = performance.now();
  console.log(`Matrix generation took ${(endGen - startGen).toFixed(2)}ms`);

  state.M = M;

  // Compute eigendecomposition of M
  await computeEigendecomposition(M);

  console.log(`Total generation time: ${(performance.now() - startGen).toFixed(2)}ms`);
}

// Compute eigendecomposition using backend manager
async function computeEigendecomposition(M) {
  const V = M.length;

  console.log(`Computing eigendecomposition for ${V}×${V} matrix...`);
  const startTime = performance.now();

  try {
    const result = await backendManager.eigendecompose(M);

    const endTime = performance.now();
    const eigenTime = (endTime - startTime).toFixed(2);
    const backendType = backendManager.getBackendType();
    console.log(`Eigendecomposition computed in ${eigenTime}ms (${backendType} backend)`);

    // Update display
    const eigenTimeDisplay = document.getElementById('eigendecompTime');
    if (eigenTimeDisplay) {
      eigenTimeDisplay.textContent = `eigendecomposition computed in ${eigenTime} ms`;
    }

    // Store in format compatible with rest of code
    // Note: If using Pyodide backend, eigenvectors are kept in Python memory
    state.eigendecomp = {
      realEigenvalues: result.eigenvalues,
      imaginaryEigenvalues: Array(V).fill(0),  // Symmetric matrix has real eigenvalues
      eigenvectorMatrix: result.eigenvectors || null  // May be null if using Pyodide
    };

  } catch (error) {
    console.error('Eigendecomposition failed:', error);
    state.eigendecomp = null;
  }
}

// Main rendering function
async function render() {
  if (!state.M || !state.eigendecomp) {
    console.log('Skipping render: matrices not ready yet');
    return;
  }

  const startRender = performance.now();

  // Compute rank-k approximation (try fast Pyodide method first)
  const t0 = performance.now();
  let Mtilde = await backendManager.computeRankKApproximation(state.k);
  if (!Mtilde) {
    // Fallback to JavaScript computation
    Mtilde = computeRankKApproximation(state.M, state.eigendecomp, state.k);
  }
  const t1 = performance.now();
  console.log(`  Rank-k approximation: ${(t1-t0).toFixed(2)}ms`);

  // Render full matrices with block structure
  const t2 = performance.now();
  renderMatrixWithBlocks(ctxM, state.M, state.d, 'M');
  renderMatrixWithBlocks(ctxK, Mtilde, state.d, 'Mtilde');
  const t3 = performance.now();
  console.log(`  Render matrices: ${(t3-t2).toFixed(2)}ms`);

  // Render colorbar
  renderColorbar(ctxColorbar);

  // Render submatrices and compute similarity
  const t4 = performance.now();
  const S = extractSubmatrix(state.M, 0, 0, state.d, state.d);
  const Stilde = extractSubmatrix(Mtilde, 0, 0, state.d, state.d);
  renderSubmatrix(ctxS, S);
  renderSubmatrix(ctxStilde, Stilde);
  const t5 = performance.now();
  console.log(`  Render submatrices: ${(t5-t4).toFixed(2)}ms`);

  // Compute and display cosine similarity
  const similarity = cosineSimilarity(S, Stilde);
  const simDisplay = document.getElementById('cosineSimilarity');
  if (simDisplay) {
    simDisplay.textContent = similarity.toFixed(4);
  }

  // Render eigenvalue histograms
  const t6 = performance.now();
  renderEigenHistograms();
  const t7 = performance.now();
  console.log(`  Render histograms: ${(t7-t6).toFixed(2)}ms`);

  const endRender = performance.now();
  console.log(`Rendering took ${(endRender - startRender).toFixed(2)}ms`);
}

// Render matrix with block divisions
function renderMatrixWithBlocks(ctx, M, d, matrixName) {
  const V = M.length;
  const canvasSize = ctx.canvas.width;

  // Clear canvas
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  // Use ImageData for faster rendering
  const imageData = ctx.createImageData(canvasSize, canvasSize);
  const data = imageData.data;

  // Map each matrix element to pixels
  for (let i = 0; i < V; i++) {
    for (let j = 0; j < V; j++) {
      const value = M[i][j];
      const rgb = valueToColorRGB(value);

      // Calculate pixel bounds for this matrix element
      const x0 = Math.floor(j * canvasSize / V);
      const x1 = Math.floor((j + 1) * canvasSize / V);
      const y0 = Math.floor(i * canvasSize / V);
      const y1 = Math.floor((i + 1) * canvasSize / V);

      // Fill all pixels for this matrix element
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * canvasSize + x) * 4;
          data[idx] = rgb[0];     // R
          data[idx + 1] = rgb[1]; // G
          data[idx + 2] = rgb[2]; // B
          data[idx + 3] = 255;    // A
        }
      }
    }
  }

  // Put the image data on canvas
  ctx.putImageData(imageData, 0, 0);

  // Draw block division lines at d
  if (d < V) {
    const linePos = d * canvasSize / V;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, linePos);
    ctx.lineTo(canvasSize, linePos);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(linePos, 0);
    ctx.lineTo(linePos, canvasSize);
    ctx.stroke();
  }

  // Add block labels using HTML overlays
  const container = ctx.canvas.parentElement;

  // Remove old labels
  const oldLabels = container.querySelectorAll('.block-label');
  oldLabels.forEach(label => label.remove());

  if (d < V && d > 0) {
    const linePos = d * canvasSize / V;
    const isTilde = matrixName === 'Mtilde';

    // Top label (S or S̃)
    const topLabel = document.createElement('div');
    topLabel.className = 'block-label';
    topLabel.style.cssText = `position: absolute; left: ${linePos/2}px; top: ${linePos/2}px; transform: translate(-50%, -50%); font-size: 20px; font-weight: bold; color: rgba(0,0,0,0.6); pointer-events: none;`;
    topLabel.textContent = isTilde ? '$\\tilde{S}$' : '$S$';
    container.appendChild(topLabel);

    // Bottom right label (C or C̃)
    const brLabel = document.createElement('div');
    brLabel.className = 'block-label';
    brLabel.style.cssText = `position: absolute; left: ${linePos + (canvasSize - linePos)/2}px; top: ${linePos + (canvasSize - linePos)/2}px; transform: translate(-50%, -50%); font-size: 20px; font-weight: bold; color: rgba(0,0,0,0.6); pointer-events: none;`;
    brLabel.textContent = isTilde ? '$\\tilde{C}$' : '$C$';
    container.appendChild(brLabel);

    // Bottom left label (Cᵀ or C̃ᵀ)
    const blLabel = document.createElement('div');
    blLabel.className = 'block-label';
    blLabel.style.cssText = `position: absolute; left: ${linePos/2}px; top: ${linePos + (canvasSize - linePos)/2}px; transform: translate(-50%, -50%); font-size: 20px; font-weight: bold; color: rgba(0,0,0,0.6); pointer-events: none;`;
    blLabel.textContent = isTilde ? '$\\tilde{C}^T$' : '$C^T$';
    container.appendChild(blLabel);

    // Top right label (B or B̃)
    const trLabel = document.createElement('div');
    trLabel.className = 'block-label';
    trLabel.style.cssText = `position: absolute; left: ${linePos + (canvasSize - linePos)/2}px; top: ${linePos/2}px; transform: translate(-50%, -50%); font-size: 20px; font-weight: bold; color: rgba(0,0,0,0.6); pointer-events: none;`;
    trLabel.textContent = isTilde ? '$\\tilde{B}$' : '$B$';
    container.appendChild(trLabel);

    // Typeset the new labels
    typesetMathJax();
  }
}

// Extract submatrix
function extractSubmatrix(M, startRow, startCol, numRows, numCols) {
  const sub = [];
  for (let i = 0; i < numRows; i++) {
    const row = [];
    for (let j = 0; j < numCols; j++) {
      row.push(M[startRow + i][startCol + j]);
    }
    sub.push(row);
  }
  return sub;
}

// Render a submatrix
function renderSubmatrix(ctx, S) {
  const d = S.length;
  const canvasSize = ctx.canvas.width;

  // Clear canvas
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  // Use ImageData for faster rendering
  const imageData = ctx.createImageData(canvasSize, canvasSize);
  const data = imageData.data;

  // Map each matrix element to pixels
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      const value = S[i][j];
      const rgb = valueToColorRGB(value);

      // Calculate pixel bounds for this matrix element
      const x0 = Math.floor(j * canvasSize / d);
      const x1 = Math.floor((j + 1) * canvasSize / d);
      const y0 = Math.floor(i * canvasSize / d);
      const y1 = Math.floor((i + 1) * canvasSize / d);

      // Fill all pixels for this matrix element
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * canvasSize + x) * 4;
          data[idx] = rgb[0];     // R
          data[idx + 1] = rgb[1]; // G
          data[idx + 2] = rgb[2]; // B
          data[idx + 3] = 255;    // A
        }
      }
    }
  }

  // Put the image data on canvas
  ctx.putImageData(imageData, 0, 0);
}

// Compute cosine similarity between two matrices
function cosineSimilarity(A, B) {
  const d = A.length;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      dotProduct += A[i][j] * B[i][j];
      normA += A[i][j] * A[i][j];
      normB += B[i][j] * B[i][j];
    }
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

// Render colorbar
function renderColorbar(ctx) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Create gradient from bottom (blue) to top (red)
  const gradient = ctx.createLinearGradient(0, height, 0, 0);

  // Sample colors at regular intervals
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const value = -3 + t * 6; // Map [0, 1] to [-3, 3]
    const color = valueToColor(value);
    gradient.addColorStop(t, color);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Update colorbar labels
  document.getElementById('colorbarMax').textContent = '3.0';
  document.getElementById('colorbarMid').textContent = '0.0';
  document.getElementById('colorbarMin').textContent = '-3.0';
}

// Convert matrix value to RGB array (blue-white-red diverging colormap)
function valueToColorRGB(value) {
  // Clamp to [-3, 3] range
  const clampedValue = Math.max(-3, Math.min(3, value));

  // Normalize to [0, 1]
  const normalized = (clampedValue + 3) / 6;

  let r, g, b;

  if (normalized < 0.5) {
    // Blue to white
    const t = normalized * 2;
    r = Math.round(0 + t * 255);
    g = Math.round(0 + t * 255);
    b = 255;
  } else {
    // White to red
    const t = (normalized - 0.5) * 2;
    r = 255;
    g = Math.round(255 - t * 255);
    b = Math.round(255 - t * 255);
  }

  return [r, g, b];
}

// Convert matrix value to color string (for colorbar)
function valueToColor(value) {
  const rgb = valueToColorRGB(value);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// Compute rank-k approximation of M
function computeRankKApproximation(M, eigendecomp, k) {
  const V = M.length;
  const { realEigenvalues, eigenvectorMatrix } = eigendecomp;

  // Sort eigenvalues by absolute value (descending) and get indices
  const eigenIndices = Array.from({ length: V }, (_, i) => i);
  eigenIndices.sort((a, b) => Math.abs(realEigenvalues[b]) - Math.abs(realEigenvalues[a]));

  // Initialize approximation matrix
  const Mtilde = Array(V).fill(0).map(() => Array(V).fill(0));

  // Sum up outer products of top k eigenvectors
  for (let idx = 0; idx < k; idx++) {
    const eigenIdx = eigenIndices[idx];
    const lambda = realEigenvalues[eigenIdx];

    // Get eigenvector (column eigenIdx of eigenvectorMatrix)
    const v = eigenvectorMatrix.map(row => row[eigenIdx]);

    // Add lambda * v * v^T to approximation
    for (let i = 0; i < V; i++) {
      for (let j = 0; j < V; j++) {
        Mtilde[i][j] += lambda * v[i] * v[j];
      }
    }
  }

  return Mtilde;
}

// Render eigenvalue histograms
function renderEigenHistograms() {
  if (!state.eigendecomp) return;

  const { realEigenvalues } = state.eigendecomp;

  // Render histogram for M
  renderEigenHistogram(ctxEigenHistM, realEigenvalues, 'Eigenvalues of $M$');
}

// Render a single eigenvalue histogram
function renderEigenHistogram(ctx, eigenvalues, title) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Set up margins
  const margin = { top: 40, right: 20, bottom: 40, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Create histogram bins
  const numBins = 50;
  const minEig = Math.min(...eigenvalues);
  const maxEig = Math.max(...eigenvalues);
  const binWidth = (maxEig - minEig) / numBins;

  const bins = Array(numBins).fill(0);
  eigenvalues.forEach(eig => {
    const binIdx = Math.min(numBins - 1, Math.floor((eig - minEig) / binWidth));
    bins[binIdx]++;
  });

  const maxCount = Math.max(...bins);

  // Draw axes
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;

  // X-axis
  ctx.beginPath();
  ctx.moveTo(margin.left, height - margin.bottom);
  ctx.lineTo(width - margin.right, height - margin.bottom);
  ctx.stroke();

  // Y-axis
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, height - margin.bottom);
  ctx.stroke();

  // Draw bars
  ctx.fillStyle = '#3498db';
  const barWidth = plotWidth / numBins;

  bins.forEach((count, i) => {
    const barHeight = (count / maxCount) * plotHeight;
    const x = margin.left + i * barWidth;
    const y = height - margin.bottom - barHeight;
    ctx.fillRect(x, y, barWidth * 0.9, barHeight);
  });

  // Draw title
  ctx.fillStyle = '#000';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 20);

  // Draw axis labels
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';

  // X-axis labels
  const numXTicks = 5;
  for (let i = 0; i <= numXTicks; i++) {
    const value = minEig + (maxEig - minEig) * (i / numXTicks);
    const x = margin.left + (i / numXTicks) * plotWidth;
    ctx.fillText(value.toFixed(1), x, height - margin.bottom + 20);
  }

  // Y-axis label
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Count', 0, 0);
  ctx.restore();
}

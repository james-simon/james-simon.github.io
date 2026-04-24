// ============================================================================
// PYODIDE BACKEND - WebAssembly Python in the browser
// ============================================================================

export class PyodideBackend {
  constructor() {
    this.pyodide = null;
    this.isLoading = false;
    this.isReady = false;
  }

  async initialize(onProgress) {
    if (this.isReady) return true;
    if (this.isLoading) return false;

    this.isLoading = true;

    try {
      onProgress?.('Loading Pyodide...');

      // Load Pyodide from CDN
      this.pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'
      });

      onProgress?.('Loading NumPy...');

      // Load NumPy package
      await this.pyodide.loadPackage('numpy');

      this.isReady = true;
      this.isLoading = false;

      console.log('Pyodide backend initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize Pyodide:', error);
      this.isLoading = false;
      this.isReady = false;
      return false;
    }
  }

  async eigendecompose(matrix) {
    if (!this.isReady) {
      throw new Error('Pyodide backend not initialized');
    }

    try {
      const t0 = performance.now();

      // Pass matrix to Python namespace
      this.pyodide.globals.set('M_js', matrix);
      const t1 = performance.now();
      console.log(`  [Pyodide] Set matrix in globals: ${(t1-t0).toFixed(2)}ms`);

      // Run eigendecomposition in Python
      const result = this.pyodide.runPython(`
import numpy as np
import time

t0 = time.time()

# Convert JS array to NumPy array
M = np.array(M_js.to_py())
t1 = time.time()
print(f"  [Python] JS->NumPy conversion: {(t1-t0)*1000:.2f}ms")

# Store in global namespace for later use
globals()['M_stored'] = M

# Compute eigendecomposition (symmetric matrix)
t2 = time.time()
eigenvalues, eigenvectors = np.linalg.eigh(M)
t3 = time.time()
print(f"  [Python] np.linalg.eigh: {(t3-t2)*1000:.2f}ms")

# Store for rank-k approximation
globals()['eigenvalues_stored'] = eigenvalues
globals()['eigenvectors_stored'] = eigenvectors

# Only return eigenvalues (for histogram) - keep eigenvectors in Python
t4 = time.time()
result = {
  'eigenvalues': eigenvalues.tolist()
}
t5 = time.time()
print(f"  [Python] eigenvalues.tolist(): {(t5-t4)*1000:.2f}ms")

result
      `);

      const t2 = performance.now();
      console.log(`  [Pyodide] Python execution: ${(t2-t1).toFixed(2)}ms`);

      // Convert Python dict to JS object
      const jsResult = result.toJs({ dict_converter: Object.fromEntries });
      const t3 = performance.now();
      console.log(`  [Pyodide] Python->JS conversion: ${(t3-t2).toFixed(2)}ms`);

      return jsResult;

    } catch (error) {
      console.error('Pyodide eigendecomposition failed:', error);
      throw error;
    }
  }

  async computeRankKApproximation(k) {
    if (!this.isReady) {
      throw new Error('Pyodide backend not initialized');
    }

    try {
      const t0 = performance.now();

      // Compute rank-k approximation in Python
      this.pyodide.globals.set('k_js', k);

      const result = this.pyodide.runPython(`
import numpy as np
import time

t0 = time.time()

# Get stored eigendecomposition
eigenvalues = globals()['eigenvalues_stored']
eigenvectors = globals()['eigenvectors_stored']

# Sort by absolute value (descending)
idx = np.argsort(np.abs(eigenvalues))[::-1]

# Compute rank-k approximation
k = int(k_js)
Mtilde = np.zeros_like(globals()['M_stored'])
for i in range(k):
    lambda_i = eigenvalues[idx[i]]
    v_i = eigenvectors[:, idx[i]]
    Mtilde += lambda_i * np.outer(v_i, v_i)

t1 = time.time()
print(f"  [Python] Rank-{k} computation: {(t1-t0)*1000:.2f}ms")

# Store for later use
globals()['Mtilde_stored'] = Mtilde

t2 = time.time()
result = Mtilde.tolist()
t3 = time.time()
print(f"  [Python] Mtilde.tolist(): {(t3-t2)*1000:.2f}ms")

result
      `);

      const t1 = performance.now();
      console.log(`  [Pyodide] Python rank-k execution: ${(t1-t0).toFixed(2)}ms`);

      const jsResult = result.toJs();
      const t2 = performance.now();
      console.log(`  [Pyodide] Mtilde Python->JS: ${(t2-t1).toFixed(2)}ms`);

      return jsResult;

    } catch (error) {
      console.error('Pyodide rank-k approximation failed:', error);
      throw error;
    }
  }
}

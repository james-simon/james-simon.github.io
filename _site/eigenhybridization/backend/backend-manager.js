// ============================================================================
// BACKEND MANAGER - Coordinates between Pyodide and JavaScript backends
// ============================================================================

import { PyodideBackend } from './pyodide-backend.js';
import { JavaScriptBackend } from './js-backend.js';

export class BackendManager {
  constructor() {
    this.pyodideBackend = new PyodideBackend();
    this.jsBackend = new JavaScriptBackend();
    this.activeBackend = null;
    this.initializationPromise = null;
  }

  async initialize(onProgress) {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      // Try Pyodide first
      onProgress?.('pyodide', 'loading');
      const pyodideSuccess = await this.pyodideBackend.initialize(onProgress);

      if (pyodideSuccess) {
        this.activeBackend = this.pyodideBackend;
        onProgress?.('pyodide', 'ready');
        console.log('Using Pyodide backend');
        return 'pyodide';
      }

      // Fall back to JavaScript
      onProgress?.('javascript', 'loading');
      const jsSuccess = await this.jsBackend.initialize();

      if (jsSuccess) {
        this.activeBackend = this.jsBackend;
        onProgress?.('javascript', 'ready');
        console.log('Using JavaScript backend');
        return 'javascript';
      }

      onProgress?.('none', 'error');
      throw new Error('No backend available');
    })();

    return this.initializationPromise;
  }

  async eigendecompose(matrix) {
    if (!this.activeBackend) {
      throw new Error('No backend initialized');
    }

    return this.activeBackend.eigendecompose(matrix);
  }

  async computeRankKApproximation(k) {
    if (!this.activeBackend) {
      throw new Error('No backend initialized');
    }

    // Only Pyodide backend supports this optimization
    if (this.activeBackend === this.pyodideBackend && this.activeBackend.computeRankKApproximation) {
      return this.activeBackend.computeRankKApproximation(k);
    }

    // Fallback: return null to indicate JS should compute it
    return null;
  }

  isReady() {
    return this.activeBackend !== null;
  }

  getBackendType() {
    if (this.activeBackend === this.pyodideBackend) return 'pyodide';
    if (this.activeBackend === this.jsBackend) return 'javascript';
    return 'none';
  }
}

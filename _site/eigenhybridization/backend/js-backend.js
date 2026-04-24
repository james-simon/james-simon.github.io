// ============================================================================
// JAVASCRIPT BACKEND - Fallback using ml-matrix
// ============================================================================

export class JavaScriptBackend {
  constructor() {
    this.isReady = typeof ML !== 'undefined';
  }

  async initialize() {
    this.isReady = typeof ML !== 'undefined';
    return this.isReady;
  }

  async eigendecompose(matrix) {
    if (!this.isReady) {
      throw new Error('ML library not loaded');
    }

    try {
      const Matrix = ML.Matrix;
      const EVD = ML.EVD;

      const matrixM = new Matrix(matrix);
      const evd = new EVD(matrixM);

      return {
        eigenvalues: evd.realEigenvalues,
        eigenvectors: evd.eigenvectorMatrix.to2DArray()
      };

    } catch (error) {
      console.error('JavaScript eigendecomposition failed:', error);
      throw error;
    }
  }
}

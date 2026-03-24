// ============================================================================
// EIGENVALUE WORKER — runs Phi, Gram, and eig off the main thread
//
// Receives: { W, n, d, B, sigmaStr }
//   W         — Float64Array (n*d), transferred
//   sigmaStr  — source of the activation function body, e.g. "return x > 0 ? x : 0"
//
// Posts back: { eigs, B }
//   eigs — Float64Array of eigenvalues sorted descending
// ============================================================================

importScripts('https://cdn.jsdelivr.net/npm/numeric@1.2.6/numeric-1.2.6.min.js');

self.onmessage = function({ data }) {
  const { W, n, d, B, sigmaStr } = data;
  const sigma = new Function('x', sigmaStr);
  const sqrtD = Math.sqrt(d);

  // Build Phi: B x n
  const Phi = new Float32Array(B * n);
  for (let b = 0; b < B; b++) {
    const x = new Float32Array(d);
    for (let j = 0; j < d; j += 2) {
      let u, v;
      do { u = Math.random(); } while (u === 0);
      do { v = Math.random(); } while (v === 0);
      const r = Math.sqrt(-2 * Math.log(u));
      x[j]     = r * Math.cos(2 * Math.PI * v);
      if (j + 1 < d) x[j + 1] = r * Math.sin(2 * Math.PI * v);
    }
    const rowB = b * n;
    for (let i = 0; i < n; i++) {
      let zi = 0;
      const rowW = i * d;
      for (let j = 0; j < d; j++) zi += W[rowW + j] * x[j];
      Phi[rowB + i] = sigma(zi / sqrtD);
    }
  }

  // Gram matrix: use smaller of n x n or B x B
  const useNxN = n <= B;
  const m      = useNxN ? n : B;
  const scale  = 1 / (n * B);

  const G = [];
  for (let i = 0; i < m; i++) G.push(new Array(m).fill(0));

  if (useNxN) {
    for (let b = 0; b < B; b++) {
      const rowB = b * n;
      for (let i = 0; i < n; i++) {
        const pi = Phi[rowB + i];
        for (let j = i; j < n; j++) {
          const v = pi * Phi[rowB + j] * scale;
          G[i][j] += v;
          if (i !== j) G[j][i] += v;
        }
      }
    }
  } else {
    for (let a = 0; a < B; a++) {
      const rowA = a * n;
      for (let b = a; b < B; b++) {
        const rowB = b * n;
        let s = 0;
        for (let i = 0; i < n; i++) s += Phi[rowA + i] * Phi[rowB + i];
        s *= scale;
        G[a][b] += s;
        if (a !== b) G[b][a] += s;
      }
    }
  }

  let rawEigs;
  try {
    const result = numeric.eig(G);
    rawEigs = result.lambda.x;
  } catch (e) {
    self.postMessage({ error: String(e) });
    return;
  }

  const eigs = new Float64Array(rawEigs.slice().sort((a, b) => b - a));
  self.postMessage({ eigs, B }, [eigs.buffer]);
};

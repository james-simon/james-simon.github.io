// ============================================================================
// MLP — n-layer network (depth 2 or 3)
// ============================================================================
// Layers: x → φ(W1 x + b1) → φ(W2 h1 + b2) → [φ(W3 h2 + b3) →] W_out h + b_out
//
// depth=2: x → h1 → yhat      (W1, W2=Wout)
// depth=3: x → h1 → h2 → yhat (W1, W2, W3=Wout)
//
// Hidden dims are all dh. Output is dout.
// Flat param order: [W1,(b1), W2,(b2), ..., Wout,(bout)]
// ============================================================================

export function randn() {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randnVec(n) {
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = randn();
  return v;
}

function normalizeVec(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = Math.sqrt(s);
  if (s < 1e-15) return v;
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / s;
  return out;
}

// ---- Activations ------------------------------------------------------------

function applyAct(z, act) {
  const out = new Float64Array(z.length);
  if (act === 'relu')        { for (let i = 0; i < z.length; i++) out[i] = z[i] > 0 ? z[i] : 0; }
  else if (act === 'tanh')   { for (let i = 0; i < z.length; i++) out[i] = Math.tanh(z[i]); }
  else if (act === 'tanh+')  { for (let i = 0; i < z.length; i++) out[i] = Math.tanh(z[i] + 0.2); }
  else if (act === 'sin')    { for (let i = 0; i < z.length; i++) out[i] = Math.sin(z[i]); }
  else                       { for (let i = 0; i < z.length; i++) out[i] = z[i]; }
  return out;
}

function actPrime(z, act) {
  const out = new Float64Array(z.length);
  if (act === 'relu')        { for (let i = 0; i < z.length; i++) out[i] = z[i] > 0 ? 1 : 0; }
  else if (act === 'tanh')   { for (let i = 0; i < z.length; i++) { const t = Math.tanh(z[i]); out[i] = 1 - t*t; } }
  else if (act === 'tanh+')  { for (let i = 0; i < z.length; i++) { const t = Math.tanh(z[i]+0.2); out[i] = 1 - t*t; } }
  else if (act === 'sin')    { for (let i = 0; i < z.length; i++) out[i] = Math.cos(z[i]); }
  else                       { for (let i = 0; i < out.length; i++) out[i] = 1; }
  return out;
}

// ---- Matrix-vector helpers --------------------------------------------------

// y = W x + b  (rows × cols matrix, b may be zero array)
function matvec(W, b, x, rows, cols) {
  const y = new Float64Array(rows);
  for (let i = 0; i < rows; i++) {
    let s = b[i];
    for (let j = 0; j < cols; j++) s += W[i * cols + j] * x[j];
    y[i] = s;
  }
  return y;
}

// ---- MLP class --------------------------------------------------------------

export class MLP {
  constructor(din, dh, dout, act = 'relu', bias = true, depth = 2) {
    this.din   = din;
    this.dh    = dh;
    this.dout  = dout;
    this.act   = act;
    this.bias  = bias;
    this.depth = depth;   // 2 or 3
    this.randomize();
  }

  // Layer dimensions: input sizes for each weight matrix
  // depth=2: W1(dh×din), W2(dout×dh)
  // depth=3: W1(dh×din), W2(dh×dh), W3(dout×dh)
  _layerDims() {
    const { din, dh, dout, depth } = this;
    if (depth === 2) return [{ rows: dh, cols: din }, { rows: dout, cols: dh }];
    return [{ rows: dh, cols: din }, { rows: dh, cols: dh }, { rows: dout, cols: dh }];
  }

  get paramDim() {
    const { bias } = this;
    return this._layerDims().reduce((s, { rows, cols }) => s + rows * cols + (bias ? rows : 0), 0);
  }

  randomize() {
    const { bias } = this;
    this.W = [];
    this.b = [];
    for (const { rows, cols } of this._layerDims()) {
      const scale = 1 / Math.sqrt(cols);
      const W = new Float64Array(rows * cols);
      const b = new Float64Array(rows);   // zeros when bias=false
      for (let i = 0; i < W.length; i++) W[i] = randn() * scale;
      if (bias) for (let i = 0; i < b.length; i++) b[i] = randn() * scale;
      this.W.push(W);
      this.b.push(b);
    }
  }

  // Forward pass. Returns { zs: [z1,...], hs: [h1,...], yhat }
  // zs[k] = pre-activation of hidden layer k (not computed for output layer)
  // hs[k] = post-activation of hidden layer k
  forward(x) {
    const { act, depth } = this;
    const dims = this._layerDims();
    const nHidden = depth - 1;  // number of hidden layers with activation

    const zs = [], hs = [];
    let cur = x;
    for (let k = 0; k < nHidden; k++) {
      const { rows, cols } = dims[k];
      const z = matvec(this.W[k], this.b[k], cur, rows, cols);
      const h = applyAct(z, act);
      zs.push(z); hs.push(h);
      cur = h;
    }
    // Output layer (no activation)
    const { rows, cols } = dims[nHidden];
    const yhat = matvec(this.W[nHidden], this.b[nHidden], cur, rows, cols);
    return { zs, hs, yhat };
  }

  // Gradient w.r.t. all params for a single (x, r).
  // Returns flat Float64Array in order [W1,(b1), W2,(b2), ..., Wout,(bout)].
  gradient(x, r) {
    const { act, bias, depth } = this;
    const dims   = this._layerDims();
    const nHidden = depth - 1;
    const { zs, hs } = this.forward(x);

    // Backprop: compute delta for each layer (delta = error signal into that layer's pre-act)
    // Output layer delta = r (no activation)
    const deltas = new Array(depth);
    deltas[nHidden] = r;  // dout-length

    for (let k = nHidden - 1; k >= 0; k--) {
      // delta[k] = W[k+1]^T delta[k+1] ⊙ φ'(z[k])
      const { rows: rowsNext, cols: colsNext } = dims[k + 1];
      const dNext = deltas[k + 1];
      const z     = zs[k];
      const pp    = actPrime(z, act);
      const d     = new Float64Array(colsNext);   // colsNext = rows of W[k] = dh
      for (let i = 0; i < colsNext; i++) {
        let s = 0;
        for (let j = 0; j < rowsNext; j++) s += this.W[k + 1][j * colsNext + i] * dNext[j];
        d[i] = s * pp[i];
      }
      deltas[k] = d;
    }

    // Assemble gradient
    const g = new Float64Array(this.paramDim);
    let off = 0;
    const inputs = [x, ...hs.slice(0, nHidden)];

    for (let k = 0; k < depth; k++) {
      const { rows, cols } = dims[k];
      const inp   = inputs[k];
      const delta = deltas[k];
      // ∂L/∂W[k] = delta ⊗ inp^T
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
          g[off++] = delta[i] * inp[j];
      // ∂L/∂b[k] = delta
      if (bias) for (let i = 0; i < rows; i++) g[off++] = delta[i];
    }
    return g;
  }

  // |cos(g(x), dir)| — objective for x-optimization
  absCosSimX(x, dir) {
    const r1 = new Float64Array(this.dout).fill(1);
    const g  = this.gradient(x, r1);
    let dot = 0, normG = 0, normD = 0;
    for (let i = 0; i < g.length; i++)  { dot += g[i] * dir[i]; normG += g[i] * g[i]; }
    for (let i = 0; i < dir.length; i++)  normD += dir[i] * dir[i];
    normG = Math.sqrt(normG); normD = Math.sqrt(normD);
    return (normG > 1e-15 && normD > 1e-15) ? Math.abs(dot) / (normG * normD) : 0;
  }

  // Best-sign gradient aligned with dir. Returns { g, cosSim }
  gradientBestSign(x, dir) {
    const r1 = new Float64Array(this.dout).fill(1);
    const g1 = this.gradient(x, r1);
    let dot = 0;
    for (let i = 0; i < g1.length; i++) dot += g1[i] * dir[i];
    const s = dot >= 0 ? 1 : -1;
    const g = new Float64Array(g1.length);
    for (let i = 0; i < g1.length; i++) g[i] = s * g1[i];
    let normG = 0, normD = 0;
    for (let i = 0; i < g.length; i++)   normG += g[i] * g[i];
    for (let i = 0; i < dir.length; i++) normD += dir[i] * dir[i];
    normG = Math.sqrt(normG); normD = Math.sqrt(normD);
    const cosSim = (normG > 1e-15 && normD > 1e-15) ? (s * Math.abs(dot)) / (normG * normD) : 0;
    return { g, cosSim };
  }

  // Flat param vector [W1,(b1), W2,(b2), ...]
  flatParams() {
    const { bias } = this;
    const p = new Float64Array(this.paramDim);
    let off = 0;
    for (let k = 0; k < this.depth; k++) {
      p.set(this.W[k], off); off += this.W[k].length;
      if (bias) { p.set(this.b[k], off); off += this.b[k].length; }
    }
    return p;
  }

  setFlatParams(p) {
    const { bias, depth } = this;
    const dims = this._layerDims();
    let off = 0;
    for (let k = 0; k < depth; k++) {
      const { rows, cols } = dims[k];
      this.W[k] = p.slice(off, off += rows * cols);
      if (bias) { this.b[k] = p.slice(off, off += rows); }
      else       { this.b[k] = new Float64Array(rows); }
    }
  }

  randomTargetDir() { return normalizeVec(randnVec(this.paramDim)); }

  sampleX(dist, sigma = 1.0) {
    const x = randnVec(this.din);
    if (dist === 'sphere') {
      let n = 0;
      for (let i = 0; i < x.length; i++) n += x[i] * x[i];
      n = Math.sqrt(n);
      for (let i = 0; i < x.length; i++) x[i] = sigma * x[i] / n;
    } else {
      for (let i = 0; i < x.length; i++) x[i] *= sigma;
    }
    return x;
  }
}

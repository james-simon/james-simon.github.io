// ============================================================================
// MLP — two-layer network math
// ============================================================================
// Network: h = φ(W1 x + b1),  ŷ = W2 h + b2
// W1: dh × din,  b1: dh,  W2: dout × dh,  b2: dout
//
// Gradient w.r.t. parameters for a single (x, residual r = ŷ - y):
//   ∂L/∂W2 = r ⊗ h^T           (dout × dh, or flat)
//   ∂L/∂b2 = r                  (dout)
//   ∂L/∂W1 = (W2^T r ⊙ φ'(z)) ⊗ x^T   (dh × din, or flat), z = W1x+b1
//   ∂L/∂b1 = W2^T r ⊙ φ'(z)   (dh)
//
// Sign degeneracy: flipping r → -r flips g → -g,
// so we always pick sign(r) = sign(dot(g_unnorm, Δθ*)).
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
  if (act === 'relu') {
    for (let i = 0; i < z.length; i++) out[i] = z[i] > 0 ? z[i] : 0;
  } else if (act === 'tanh') {
    for (let i = 0; i < z.length; i++) out[i] = Math.tanh(z[i]);
  } else {
    for (let i = 0; i < z.length; i++) out[i] = z[i];
  }
  return out;
}

function actPrime(z, act) {
  const out = new Float64Array(z.length);
  if (act === 'relu') {
    for (let i = 0; i < z.length; i++) out[i] = z[i] > 0 ? 1 : 0;
  } else if (act === 'tanh') {
    for (let i = 0; i < z.length; i++) { const t = Math.tanh(z[i]); out[i] = 1 - t * t; }
  } else {
    for (let i = 0; i < out.length; i++) out[i] = 1;
  }
  return out;
}

// ---- MLP class --------------------------------------------------------------

export class MLP {
  // weights stored flat, row-major:
  //   W1: dh*din, b1: dh, W2: dout*dh, b2: dout
  constructor(din, dh, dout, act = 'relu') {
    this.din  = din;
    this.dh   = dh;
    this.dout = dout;
    this.act  = act;
    this.randomize();
  }

  get paramDim() {
    return this.dh * this.din + this.dh + this.dout * this.dh + this.dout;
  }

  randomize() {
    const { din, dh, dout } = this;
    const scale1 = 1 / Math.sqrt(din);
    const scale2 = 1 / Math.sqrt(dh);
    this.W1 = new Float64Array(dh * din);
    this.b1 = new Float64Array(dh);
    this.W2 = new Float64Array(dout * dh);
    this.b2 = new Float64Array(dout);
    for (let i = 0; i < dh * din; i++) this.W1[i] = randn() * scale1;
    for (let i = 0; i < dh;       i++) this.b1[i] = randn() * scale1;
    for (let i = 0; i < dout * dh; i++) this.W2[i] = randn() * scale2;
    for (let i = 0; i < dout;      i++) this.b2[i] = randn() * scale2;
  }

  // Forward pass; returns { z, h, yhat }
  forward(x) {
    const { din, dh, dout, W1, b1, W2, b2, act } = this;
    // z = W1 x + b1
    const z = new Float64Array(dh);
    for (let i = 0; i < dh; i++) {
      let s = b1[i];
      for (let j = 0; j < din; j++) s += W1[i * din + j] * x[j];
      z[i] = s;
    }
    const h = applyAct(z, act);
    // yhat = W2 h + b2
    const yhat = new Float64Array(dout);
    for (let i = 0; i < dout; i++) {
      let s = b2[i];
      for (let j = 0; j < dh; j++) s += W2[i * dh + j] * h[j];
      yhat[i] = s;
    }
    return { z, h, yhat };
  }

  // Gradient for a single x given residual vector r (length dout).
  // Returns flat Float64Array of length paramDim in order [W1, b1, W2, b2].
  gradient(x, r) {
    const { din, dh, dout, W1, b1, W2, act } = this;
    const { z, h } = this.forward(x);
    const phi_prime = actPrime(z, act);

    // δ = W2^T r ⊙ φ'(z)    (length dh)
    const delta = new Float64Array(dh);
    for (let i = 0; i < dh; i++) {
      let s = 0;
      for (let k = 0; k < dout; k++) s += W2[k * dh + i] * r[k];
      delta[i] = s * phi_prime[i];
    }

    const p = this.paramDim;
    const g = new Float64Array(p);
    let off = 0;

    // ∂L/∂W1 = delta ⊗ x^T   (dh × din)
    for (let i = 0; i < dh; i++)
      for (let j = 0; j < din; j++)
        g[off++] = delta[i] * x[j];

    // ∂L/∂b1 = delta
    for (let i = 0; i < dh; i++) g[off++] = delta[i];

    // ∂L/∂W2 = r ⊗ h^T   (dout × dh)
    for (let i = 0; i < dout; i++)
      for (let j = 0; j < dh; j++)
        g[off++] = r[i] * h[j];

    // ∂L/∂b2 = r
    for (let i = 0; i < dout; i++) g[off++] = r[i];

    return g;
  }

  // Best-sign gradient: pick r = ±1·ones (scalar dout=1) to align with dir.
  // Returns { g, cosSim, sign }
  gradientBestSign(x, dir) {
    const r1 = new Float64Array(this.dout).fill(1);
    const g1 = this.gradient(x, r1);
    // dot with dir
    let dot = 0;
    for (let i = 0; i < g1.length; i++) dot += g1[i] * dir[i];
    // pick sign
    const s = dot >= 0 ? 1 : -1;
    const g = new Float64Array(g1.length);
    for (let i = 0; i < g1.length; i++) g[i] = s * g1[i];
    // compute cosine sim
    let normG = 0;
    for (let i = 0; i < g.length; i++) normG += g[i] * g[i];
    normG = Math.sqrt(normG);
    let normD = 0;
    for (let i = 0; i < dir.length; i++) normD += dir[i] * dir[i];
    normD = Math.sqrt(normD);
    const cosSim = (normG > 1e-15 && normD > 1e-15) ? (s * Math.abs(dot)) / (normG * normD) : 0;
    return { g, cosSim, sign: s };
  }

  // Flat parameter vector [W1, b1, W2, b2]
  flatParams() {
    const p = new Float64Array(this.paramDim);
    let off = 0;
    for (const arr of [this.W1, this.b1, this.W2, this.b2]) {
      p.set(arr, off); off += arr.length;
    }
    return p;
  }

  setFlatParams(p) {
    const { din, dh, dout } = this;
    let off = 0;
    this.W1 = p.slice(off, off += dh * din);
    this.b1 = p.slice(off, off += dh);
    this.W2 = p.slice(off, off += dout * dh);
    this.b2 = p.slice(off, off += dout);
  }

  // Random unit target direction in parameter space
  randomTargetDir() {
    return normalizeVec(randnVec(this.paramDim));
  }

  // Sample x from Gaussian or sphere
  sampleX(dist) {
    const x = randnVec(this.din);
    if (dist === 'sphere') {
      let n = 0;
      for (let i = 0; i < x.length; i++) n += x[i] * x[i];
      n = Math.sqrt(n);
      for (let i = 0; i < x.length; i++) x[i] /= n;
    }
    return x;
  }
}

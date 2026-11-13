// Interactive projection pursuit by gradient ascent on CIFAR-10 patches (page 01'''). Needs gparse.js (contrast expressions) and
// data.js (the images as a data-URI PNG). WebGPU when available, a CPU backend otherwise.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = 16, L = K * K;                                  // patch side, pixels
  const NB = 160, XLO = -8, XHI = 8, BW = (XHI - XLO) / NB;  // histogram bins

  // ---------------------------------------------------------------- state
  const st = { images: null, running: false, stop: false, run: null, selected: null, backendName: 'CPU', gpu: null };

  // ---------------------------------------------------------------- the objective list (localStorage); every entry is maximised
  const DEFAULT_LIST = ['-log(cosh(u))', 'exp(-u**2/2)', 'u**4/4', 'abs(u)**3/3', '[abs(u) > 3]'];
  function loadList() { try { const p = JSON.parse(localStorage.getItem('isc_list')); if (Array.isArray(p) && p.length && typeof p[0] === 'string') return p; } catch (e) { } return DEFAULT_LIST.slice(); }
  function saveList(p) { try { localStorage.setItem('isc_list', JSON.stringify(p)); } catch (e) { } }
  let glist = loadList();
  // the menu lists the saved objectives plus "custom"; editing the text field switches the menu to custom at once
  function fillMenu(sel) {
    const m = $('isc-gsel'); m.innerHTML = '';
    glist.forEach((e, i) => { const o = document.createElement('option'); o.value = i; o.textContent = e; m.appendChild(o); });
    const oc = document.createElement('option'); oc.value = 'custom'; oc.textContent = 'custom'; m.appendChild(oc);
    m.value = (sel !== undefined && glist[sel] !== undefined) ? sel : 'custom';
    $('isc-glist').value = glist.join('\n');
  }
  function syncMenu() { const i = glist.indexOf($('isc-gexpr').value.trim()); $('isc-gsel').value = i >= 0 ? i : 'custom'; }
  function pickFromMenu() { const v = $('isc-gsel').value; if (v === 'custom') { $('isc-gexpr').focus(); return; } const e = glist[+v]; if (e === undefined) return; $('isc-gexpr').value = e; checkExpr(); try { localStorage.setItem('isc_expr', e); } catch (x) { } }
  function checkExpr() {
    const out = $('isc-gcheck'), box = $('isc-gexpr');
    try { const c = GParse.compile(box.value); out.textContent = ''; box.style.borderColor = ''; box.style.background = ''; return c; }
    catch (e) { out.style.color = '#c33'; out.textContent = 'does not parse: ' + e.message; box.style.borderColor = '#c33'; box.style.background = '#fff4f4'; return null; }
  }
  fillMenu(0);
  try { const e = localStorage.getItem('isc_expr'); if (e) { $('isc-gexpr').value = e; } } catch (x) { }
  syncMenu(); checkExpr();
  $('isc-gsel').addEventListener('change', pickFromMenu);
  $('isc-gexpr').addEventListener('input', () => { syncMenu(); checkExpr(); try { localStorage.setItem('isc_expr', $('isc-gexpr').value); } catch (x) { } });
  $('isc-gsave').addEventListener('click', () => {
    const lines = $('isc-glist').value.split('\n').map(x => x.trim()).filter(Boolean), bad = [];
    lines.forEach(l => { try { GParse.compile(l); } catch (e) { bad.push(l + ' (' + e.message + ')'); } });
    if (bad.length) { $('isc-gliststat').style.color = '#c33'; $('isc-gliststat').textContent = 'not saved; these do not parse: ' + bad.join('; '); return; }
    if (!lines.length) { $('isc-gliststat').textContent = 'the list is empty'; return; }
    glist = lines; saveList(glist); fillMenu(glist.indexOf($('isc-gexpr').value.trim())); $('isc-gliststat').style.color = '#2a7'; $('isc-gliststat').textContent = 'saved ' + lines.length + ' objectives';
  });
  $('isc-gdefaults').addEventListener('click', () => { glist = DEFAULT_LIST.slice(); saveList(glist); fillMenu(0); pickFromMenu(); $('isc-gliststat').textContent = 'default list restored'; });

  // parameters persist; a checkbox gives a fresh random seed each run
  const PARAM_IDS = ['isc-N', 'isc-M', 'isc-units', 'isc-lr', 'isc-steps', 'isc-tol', 'isc-eps', 'isc-seed', 'isc-xmax'];
  const CHECK_IDS = ['isc-randseed', 'isc-raw', 'isc-logy', 'isc-gauss', 'isc-show4'];
  const DEFAULTS = { 'isc-N': 50000, 'isc-M': 64, 'isc-units': 64, 'isc-lr': 0.3, 'isc-steps': 3000, 'isc-tol': 0.001, 'isc-eps': 0.0001, 'isc-seed': 0, 'isc-xmax': 6, 'isc-randseed': true, 'isc-raw': false, 'isc-logy': false, 'isc-gauss': true, 'isc-show4': false };
  try { const sv = JSON.parse(localStorage.getItem('isc_params') || '{}'); PARAM_IDS.forEach(id => { if (sv[id] !== undefined) $(id).value = sv[id]; }); CHECK_IDS.forEach(id => { if (sv[id] !== undefined) $(id).checked = sv[id]; }); } catch (e) { }
  function saveParams() { const o = {}; PARAM_IDS.forEach(id => o[id] = $(id).value); CHECK_IDS.forEach(id => o[id] = $(id).checked); try { localStorage.setItem('isc_params', JSON.stringify(o)); } catch (e) { } }
  PARAM_IDS.concat(CHECK_IDS).forEach(id => $(id).addEventListener('change', saveParams));
  $('isc-defaults').addEventListener('click', () => { PARAM_IDS.forEach(id => $(id).value = DEFAULTS[id]); CHECK_IDS.forEach(id => $(id).checked = DEFAULTS[id]); $('isc-xmaxv').textContent = $('isc-xmax').value; saveParams(); layoutPlots(); drawPlots(); });

  // ---------------------------------------------------------------- images
  function loadImages() {
    return new Promise((resolve, reject) => {
      const D = window.CIFAR_DATA; const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, img.width, img.height).data;
        const side = D.side, n = D.n, cols = D.cols, out = new Float32Array(n * side * side);
        let sum = 0, sum2 = 0;
        for (let i = 0; i < n; i++) { const r0 = Math.floor(i / cols) * side, c0 = (i % cols) * side;
          for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) { const v = px[4 * ((r0 + y) * img.width + c0 + x)]; out[i * side * side + y * side + x] = v; sum += v; sum2 += v * v; } }
        const mean = sum / out.length, std = Math.sqrt(sum2 / out.length - mean * mean);
        for (let i = 0; i < out.length; i++) out[i] = (out[i] - mean) / std;
        resolve({ data: out, n, side });
      };
      img.onerror = () => reject(new Error('image data failed to load')); img.src = D.url;
    });
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function samplePatches(N, seed) {
    const rnd = mulberry32(seed + 1), { data, n, side } = st.images, X = new Float32Array(N * L), span = side - K + 1;
    for (let p = 0; p < N; p++) { const i = Math.floor(rnd() * n), r = Math.floor(rnd() * span), c = Math.floor(rnd() * span), base = i * side * side;
      for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) X[p * L + y * K + x] = data[base + (r + y) * side + c + x]; }
    return X;
  }
  function randn(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // ---------------------------------------------------------------- linear algebra on the CPU
  function jacobiEigen(C, n) {
    // symmetric eigendecomposition, cyclic Jacobi; returns {vals (desc), vecs (n x n, column j = eigenvector j)}
    const A = Float64Array.from(C), V = new Float64Array(n * n); for (let i = 0; i < n; i++) V[i * n + i] = 1;
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p * n + q] * A[p * n + q];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q]; if (Math.abs(apq) < 1e-300) continue;
        const theta = (A[q * n + q] - A[p * n + p]) / (2 * apq), t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k * n + p], akq = A[k * n + q]; A[k * n + p] = c * akp - s * akq; A[k * n + q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p * n + k], aqk = A[q * n + k]; A[p * n + k] = c * apk - s * aqk; A[q * n + k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k * n + p], vkq = V[k * n + q]; V[k * n + p] = c * vkp - s * vkq; V[k * n + q] = s * vkp + c * vkq; }
      }
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[b * n + b] - A[a * n + a]);
    const vals = idx.map(i => A[i * n + i]), vecs = new Float64Array(n * n);
    idx.forEach((src, j) => { for (let k = 0; k < n; k++) vecs[k * n + j] = V[k * n + src]; });
    return { vals, vecs };
  }

  // ---------------------------------------------------------------- backends
  // interface: await init(Zt, M, N, gcode) ; setW(w) ; setFound(Wf, k) ; await steps(n, lr, sign) -> {ratio, gnorm} ; await getW() ; await getU()
  function cpuBackend() {
    let Zt, M, N, w, u, Wf, k, gfun;
    return {
      name: 'CPU (JavaScript)',
      async init(Zt_, M_, N_, c) { Zt = Zt_; M = M_; N = N_; gfun = c.g; u = new Float32Array(N); w = new Float32Array(M); Wf = new Float32Array(M * M); k = 0; },
      setW(w_) { w.set(w_); }, setFound(Wf_, k_) { Wf.set(Wf_); k = k_; },
      async steps(n, lr, sign) {
        let ratio = 0, gnorm = 0;
        for (let s = 0; s < n; s++) {
          const grad = new Float32Array(M), gb = new Float32Array(N);
          for (let i = 0; i < N; i++) { let a = 0; for (let j = 0; j < M; j++) a += Zt[j * N + i] * w[j]; u[i] = a; gb[i] = gfun(a); }
          for (let j = 0; j < M; j++) { let a = 0; const o = j * N; for (let i = 0; i < N; i++) a += Zt[o + i] * gb[i]; grad[j] = sign * a / N; }
          let gw = 0, gn2 = 0; for (let j = 0; j < M; j++) { gw += grad[j] * w[j]; gn2 += grad[j] * grad[j]; }
          const tan = new Float32Array(M); for (let j = 0; j < M; j++) tan[j] = grad[j] - gw * w[j];
          for (let f = 0; f < k; f++) { let c = 0; for (let j = 0; j < M; j++) c += Wf[f * M + j] * tan[j]; for (let j = 0; j < M; j++) tan[j] -= c * Wf[f * M + j]; }
          let tn2 = 0; for (let j = 0; j < M; j++) tn2 += tan[j] * tan[j];
          const wn = new Float32Array(M); for (let j = 0; j < M; j++) wn[j] = w[j] + lr * tan[j];
          for (let f = 0; f < k; f++) { let c = 0; for (let j = 0; j < M; j++) c += Wf[f * M + j] * wn[j]; for (let j = 0; j < M; j++) wn[j] -= c * Wf[f * M + j]; }
          let nn = 0; for (let j = 0; j < M; j++) nn += wn[j] * wn[j]; nn = Math.sqrt(nn) || 1; for (let j = 0; j < M; j++) w[j] = wn[j] / nn;
          ratio = Math.sqrt(tn2) / (Math.sqrt(gn2) || 1e-20); gnorm = Math.sqrt(gn2);
        }
        return { ratio, gnorm };
      },
      async getW() { return Float32Array.from(w); },
      async getU() { for (let i = 0; i < N; i++) { let a = 0; for (let j = 0; j < M; j++) a += Zt[j * N + i] * w[j]; u[i] = a; } return Float32Array.from(u); },
      async cov(X, N_) { const C = new Float32Array(L * L); for (let i = 0; i < N_; i++) { const o = i * L; for (let a = 0; a < L; a++) { const xa = X[o + a]; if (xa === 0) continue; for (let b = a; b < L; b++) C[a * L + b] += xa * X[o + b]; } }
        for (let a = 0; a < L; a++) for (let b = a; b < L; b++) { C[a * L + b] /= N_; C[b * L + a] = C[a * L + b]; } return C; },
      async whiten(X, N_, V, M_) { const Zt_ = new Float32Array(M_ * N_); for (let i = 0; i < N_; i++) for (let j = 0; j < M_; j++) { let s = 0; const o = i * L, vo = j * L; for (let a = 0; a < L; a++) s += V[vo + a] * X[o + a]; Zt_[j * N_ + i] = s; } return Zt_; },
    };
  }

  function gpuBackend(device) {
    let M, N, bufs = {}, pipes = {}, bg, k = 0;
    const WG = 256;
    const mkbuf = (size, usage) => device.createBuffer({ size: Math.max(16, Math.ceil(size / 16) * 16), usage });
    const upload = (buf, arr) => device.queue.writeBuffer(buf, 0, arr.buffer, arr.byteOffset, arr.byteLength);
    async function read(buf, bytes) { const stg = mkbuf(bytes, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ); const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(buf, 0, stg, 0, Math.ceil(bytes / 16) * 16); device.queue.submit([enc.finish()]);
      await stg.mapAsync(GPUMapMode.READ); const out = new Float32Array(stg.getMappedRange().slice(0, bytes)); stg.unmap(); stg.destroy(); return out; }
    const REDUCE = `workgroupBarrier(); for (var o = 128u; o > 0u; o = o >> 1u) { if (t < o) { red[t] = red[t] + red[t + o]; } workgroupBarrier(); }`;
    function shader(gcode) {
      return `
struct Params { N: u32, M: u32, k: u32, pad: u32, lr: f32, sign: f32, tol: f32, pad2: f32 };
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> Zt: array<f32>;
@group(0) @binding(2) var<storage, read_write> w: array<f32>;
@group(0) @binding(3) var<storage, read_write> u: array<f32>;
@group(0) @binding(4) var<storage, read_write> gb: array<f32>;
@group(0) @binding(5) var<storage, read_write> grad: array<f32>;
@group(0) @binding(6) var<storage, read> Wf: array<f32>;
@group(0) @binding(7) var<storage, read_write> stat: array<f32>;
fn gfun(u: f32) -> f32 { return ${gcode}; }
@compute @workgroup_size(${WG}) fn proj(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x; if (i >= P.N) { return; }
  var s = 0.0; for (var j = 0u; j < P.M; j = j + 1u) { s = s + Zt[j * P.N + i] * w[j]; }
  u[i] = s; gb[i] = gfun(s);
}
var<workgroup> red: array<f32, ${WG}>;
var<workgroup> tanv: array<f32, ${WG}>;
var<workgroup> cf: array<f32, ${WG}>;
var<workgroup> wn: array<f32, ${WG}>;
@compute @workgroup_size(${WG}) fn gradk(@builtin(workgroup_id) wid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let j = wid.x; let t = lid.x; var s = 0.0;
  for (var i = t; i < P.N; i = i + ${WG}u) { s = s + Zt[j * P.N + i] * gb[i]; }
  red[t] = s; ${REDUCE}
  if (t == 0u) { grad[j] = P.sign * red[0] / f32(P.N); }
}
@compute @workgroup_size(${WG}) fn update(@builtin(local_invocation_id) lid: vec3<u32>) {
  let t = lid.x; let M = P.M; let kk = P.k; let inM = t < M;
  let gt = select(0.0, grad[min(t, M - 1u)], inM); let wt = select(0.0, w[min(t, M - 1u)], inM);
  red[t] = gt * wt; ${REDUCE} let gw = red[0]; workgroupBarrier();
  red[t] = gt * gt; ${REDUCE} let gn2 = red[0]; workgroupBarrier();
  tanv[t] = gt - gw * wt; workgroupBarrier();
  if (t < kk) { var c = 0.0; for (var j = 0u; j < M; j = j + 1u) { c = c + Wf[t * M + j] * tanv[j]; } cf[t] = c; } workgroupBarrier();
  var tt = tanv[t]; for (var f = 0u; f < kk; f = f + 1u) { tt = tt - cf[f] * Wf[f * M + min(t, M - 1u)]; } if (!inM) { tt = 0.0; }
  red[t] = tt * tt; ${REDUCE} let tn2 = red[0]; workgroupBarrier();
  var wnt = wt + P.lr * tt; wn[t] = wnt; workgroupBarrier();
  if (t < kk) { var c = 0.0; for (var j = 0u; j < M; j = j + 1u) { c = c + Wf[t * M + j] * wn[j]; } cf[t] = c; } workgroupBarrier();
  for (var f = 0u; f < kk; f = f + 1u) { wnt = wnt - cf[f] * Wf[f * M + min(t, M - 1u)]; } if (!inM) { wnt = 0.0; }
  red[t] = wnt * wnt; ${REDUCE} let nn = sqrt(red[0]); workgroupBarrier();
  if (inM) { w[t] = wnt / max(nn, 1e-30); }
  if (t == 0u) { stat[0] = sqrt(tn2) / max(sqrt(gn2), 1e-30); stat[1] = sqrt(gn2); }
}`;
    }
    const PRE = `
@group(0) @binding(0) var<uniform> Q: vec4<u32>;
@group(0) @binding(1) var<storage, read> X: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;
@group(0) @binding(3) var<storage, read> V: array<f32>;
@group(0) @binding(4) var<storage, read_write> Zt: array<f32>;
@compute @workgroup_size(16, 16) fn cov(@builtin(global_invocation_id) id: vec3<u32>) {
  let a = id.x; let b = id.y; if (a >= ${L}u || b >= ${L}u || b < a) { return; }
  var s = 0.0; for (var i = 0u; i < Q.x; i = i + 1u) { s = s + X[i * ${L}u + a] * X[i * ${L}u + b]; }
  C[a * ${L}u + b] = s / f32(Q.x); C[b * ${L}u + a] = s / f32(Q.x);
}
@compute @workgroup_size(${WG}) fn whiten(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x; if (i >= Q.x) { return; }
  for (var j = 0u; j < Q.y; j = j + 1u) { var s = 0.0; for (var a = 0u; a < ${L}u; a = a + 1u) { s = s + V[j * ${L}u + a] * X[i * ${L}u + a]; } Zt[j * Q.x + i] = s; }
}`;
    let preMod = null, preLayout = null;
    function prePipes() {
      if (preMod) return;
      preMod = device.createShaderModule({ code: PRE });
      preLayout = device.createBindGroupLayout({ entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }] });
      const pl = device.createPipelineLayout({ bindGroupLayouts: [preLayout] });
      pipes.cov = device.createComputePipeline({ layout: pl, compute: { module: preMod, entryPoint: 'cov' } });
      pipes.whiten = device.createComputePipeline({ layout: pl, compute: { module: preMod, entryPoint: 'whiten' } });
    }
    return {
      name: 'WebGPU',
      async cov(X, N_) {
        prePipes();
        const bX = mkbuf(X.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST), bC = mkbuf(L * L * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC), bQ = mkbuf(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        // one dummy per unused binding: the same buffer bound read-only and read-write in one pass is a validation error
        const dummyA = mkbuf(16, GPUBufferUsage.STORAGE), dummyB = mkbuf(16, GPUBufferUsage.STORAGE); upload(bX, X); upload(bQ, new Uint32Array([N_, 0, 0, 0]));
        const g = device.createBindGroup({ layout: preLayout, entries: [{ binding: 0, resource: { buffer: bQ } }, { binding: 1, resource: { buffer: bX } }, { binding: 2, resource: { buffer: bC } }, { binding: 3, resource: { buffer: dummyA } }, { binding: 4, resource: { buffer: dummyB } }] });
        const enc = device.createCommandEncoder(); const pass = enc.beginComputePass(); pass.setPipeline(pipes.cov); pass.setBindGroup(0, g); pass.dispatchWorkgroups(L / 16, L / 16); pass.end(); device.queue.submit([enc.finish()]);
        const C = await read(bC, L * L * 4); this._bX = bX; this._bQ = bQ; bC.destroy(); dummyA.destroy(); dummyB.destroy(); return C;
      },
      async whiten(X, N_, V, M_) {
        prePipes();
        const bX = this._bX, bQ = this._bQ, bV = mkbuf(V.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST), bZ = mkbuf(M_ * N_ * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
        const dummy = mkbuf(16, GPUBufferUsage.STORAGE); upload(bV, V); upload(bQ, new Uint32Array([N_, M_, 0, 0]));
        const g = device.createBindGroup({ layout: preLayout, entries: [{ binding: 0, resource: { buffer: bQ } }, { binding: 1, resource: { buffer: bX } }, { binding: 2, resource: { buffer: dummy } }, { binding: 3, resource: { buffer: bV } }, { binding: 4, resource: { buffer: bZ } }] });
        const enc = device.createCommandEncoder(); const pass = enc.beginComputePass(); pass.setPipeline(pipes.whiten); pass.setBindGroup(0, g); pass.dispatchWorkgroups(Math.ceil(N_ / WG)); pass.end(); device.queue.submit([enc.finish()]);
        await device.queue.onSubmittedWorkDone(); bV.destroy(); dummy.destroy(); bX.destroy(); this._bZ = bZ; return null;   // Zt stays on the GPU
      },
      async init(Zt_, M_, N_, c) {
        const gcode = c.wgslg; M = M_; N = N_; k = 0;
        for (const b of Object.values(bufs)) if (b && b.destroy && b !== this._bZ) b.destroy();
        bufs = { Zt: this._bZ || (() => { const b = mkbuf(Zt_.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST); upload(b, Zt_); return b; })(),
                 w: mkbuf(M * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC), u: mkbuf(N * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC),
                 gb: mkbuf(N * 4, GPUBufferUsage.STORAGE), grad: mkbuf(M * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC), Wf: mkbuf(M * M * 4, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST),
                 stat: mkbuf(16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC), P: mkbuf(32, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST) };
        this._bZ = null;
        const mod = device.createShaderModule({ code: shader(gcode) });
        const info = await mod.getCompilationInfo(); const errs = info.messages.filter(m => m.type === 'error'); if (errs.length) throw new Error('shader: ' + errs.map(m => m.message).join('; '));
        const layout = device.createBindGroupLayout({ entries: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ binding: i, visibility: GPUShaderStage.COMPUTE, buffer: { type: i === 0 ? 'uniform' : (i === 1 || i === 6) ? 'read-only-storage' : 'storage' } })) });
        const pl = device.createPipelineLayout({ bindGroupLayouts: [layout] });
        for (const e of ['proj', 'gradk', 'update']) pipes[e] = device.createComputePipeline({ layout: pl, compute: { module: mod, entryPoint: e } });
        bg = device.createBindGroup({ layout, entries: [bufs.P, bufs.Zt, bufs.w, bufs.u, bufs.gb, bufs.grad, bufs.Wf, bufs.stat].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
      },
      setW(w_) { upload(bufs.w, w_); }, setFound(Wf_, k_) { upload(bufs.Wf, Wf_); k = k_; },
      async steps(n, lr, sign) {
        const P = new ArrayBuffer(32); new Uint32Array(P, 0, 4).set([N, M, k, 0]); new Float32Array(P, 16, 4).set([lr, sign, 0, 0]); device.queue.writeBuffer(bufs.P, 0, P);
        const enc = device.createCommandEncoder();
        for (let s = 0; s < n; s++) { const pass = enc.beginComputePass(); pass.setBindGroup(0, bg);
          pass.setPipeline(pipes.proj); pass.dispatchWorkgroups(Math.ceil(N / WG)); pass.setPipeline(pipes.gradk); pass.dispatchWorkgroups(M); pass.setPipeline(pipes.update); pass.dispatchWorkgroups(1); pass.end(); }
        device.queue.submit([enc.finish()]);
        const s = await read(bufs.stat, 8); return { ratio: s[0], gnorm: s[1] };
      },
      async getW() { return read(bufs.w, M * 4); },
      async getU() { const enc = device.createCommandEncoder(); const pass = enc.beginComputePass(); pass.setBindGroup(0, bg); pass.setPipeline(pipes.proj); pass.dispatchWorkgroups(Math.ceil(N / WG)); pass.end(); device.queue.submit([enc.finish()]); return read(bufs.u, N * 4); },
    };
  }

  async function pickBackend() {
    if (navigator.gpu) {
      try { const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); if (ad) { const dev = await ad.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: Math.min(ad.limits.maxStorageBufferBindingSize, 1 << 30), maxBufferSize: Math.min(ad.limits.maxBufferSize, 1 << 30) } });
        dev.lost.then(e => { $('isc-backend').textContent = 'GPU device lost: ' + e.message; }); st.gpu = dev; st.backendName = 'WebGPU'; const info = ad.info || {}; $('isc-backend').textContent = 'WebGPU: ' + [info.vendor, info.architecture, info.description].filter(Boolean).join(' ') + ' (max buffer ' + Math.round(dev.limits.maxStorageBufferBindingSize / 1048576) + ' MB)'; return; } } catch (e) { console.warn('WebGPU unavailable', e); }
    }
    $('isc-backend').textContent = 'no WebGPU here: CPU fallback, 20-50x slower (keep N ≤ 20,000, M ≤ 64)'; st.backendName = 'CPU';
  }

  // ---------------------------------------------------------------- the run
  function params() {
    const g = v => +$(v).value;
    const M = Math.max(4, Math.min(256, Math.round(g('isc-M')))), N = Math.max(1000, Math.min(100000, Math.round(g('isc-N'))));
    if ($('isc-randseed').checked) { $('isc-seed').value = Math.floor(Math.random() * 100000); }
    return { N, M, units: Math.max(1, Math.min(M, Math.round(g('isc-units')))), lr: g('isc-lr'), maxSteps: Math.max(10, Math.round(g('isc-steps'))), tol: g('isc-tol'), eps: g('isc-eps'), seed: Math.round(g('isc-seed')), raw: $('isc-raw').checked, expr: $('isc-gexpr').value, dir: 1 };
  }
  function status(msg) { $('isc-status').textContent = msg; }

  async function start() {
    if (st.running) return;
    const c = checkExpr(); if (!c) { status('the objective does not parse'); return; }
    const p = params(); saveParams();
    if (!st.images) { status('decoding the images…'); await new Promise(r => setTimeout(r, 20)); try { st.images = await loadImages(); } catch (e) { status(e.message); return; } }
    st.running = true; st.stop = false; st.selected = null;
    const be = st.gpu ? gpuBackend(st.gpu) : cpuBackend();
    const run = st.run = { p, G: c, units: [], inProgress: null, E: null, dsq: null, mu: null, t0: performance.now(), backend: be.name };
    try {
      // 1. patches
      status(`sampling ${p.N.toLocaleString()} patches…`); await tick();
      const X = samplePatches(p.N, p.seed);
      const mu = new Float32Array(L); for (let i = 0; i < p.N; i++) for (let a = 0; a < L; a++) mu[a] += X[i * L + a]; for (let a = 0; a < L; a++) mu[a] /= p.N;
      for (let i = 0; i < p.N; i++) for (let a = 0; a < L; a++) X[i * L + a] -= mu[a];
      run.mu = mu;
      // 2. covariance, eigen, whitening
      status('covariance…'); await tick(); const C = await be.cov(X, p.N);
      status('eigendecomposition…'); await tick(); const { vals, vecs } = jacobiEigen(C, L);
      const d = vals.slice(0, p.M).map(v => Math.max(v, p.eps * vals[0]));
      // whitened: z_j = (e_j . x) / sqrt(d_j), identity covariance. raw: z_j = (e_j . x) / s with one common scale s^2 = mean of the kept d_j,
      // so the variances are kept (ratios untouched, a random direction has unit variance on average) and lr and G keep their meaning.
      const sc = p.raw ? Math.sqrt(d.reduce((a, v) => a + v, 0) / p.M) : null;
      const V = new Float32Array(p.M * L); for (let j = 0; j < p.M; j++) for (let a = 0; a < L; a++) V[j * L + a] = vecs[a * L + j] / (p.raw ? sc : Math.sqrt(d[j]));
      run.E = vecs; run.dsq = p.raw ? d.map(() => sc) : d.map(Math.sqrt); run.evals = vals;
      status(p.raw ? 'projecting (raw, variances kept)…' : 'whitening…'); await tick(); const Zt = await be.whiten(X, p.N, V, p.M);
      await be.init(Zt, p.M, p.N, c);   // the CPU backend uses c.g (JavaScript), the GPU backend c.wgslg
      // 3. units, one at a time
      const Wf = new Float32Array(p.M * p.M), rnd = mulberry32(p.seed + 7);
      const batch = st.gpu ? 10 : 1;
      for (let kk = 0; kk < p.units && !st.stop; kk++) {
        const w = new Float32Array(p.M); for (let j = 0; j < p.M; j++) w[j] = randn(rnd);
        for (let f = 0; f < kk; f++) { let cc = 0; for (let j = 0; j < p.M; j++) cc += Wf[f * p.M + j] * w[j]; for (let j = 0; j < p.M; j++) w[j] -= cc * Wf[f * p.M + j]; }
        let nn = 0; for (let j = 0; j < p.M; j++) nn += w[j] * w[j]; nn = Math.sqrt(nn); for (let j = 0; j < p.M; j++) w[j] /= nn;
        be.setW(w); be.setFound(Wf, kk);
        run.inProgress = { idx: kk, w, steps: 0, ratio: 1 };
        let steps = 0, r = { ratio: 1, gnorm: 0 }, converged = false, lastDraw = 0;
        const tUnit = performance.now();
        while (steps < p.maxSteps && !st.stop) {
          const n = Math.min(batch, p.maxSteps - steps); r = await be.steps(n, p.lr, p.dir); steps += n; run.inProgress.steps = steps; run.inProgress.ratio = r.ratio;
          if (r.ratio < p.tol) { converged = true; break; }
          if (performance.now() - lastDraw > 120) { run.inProgress.w = await be.getW(); drawGrid(); status(`unit ${kk + 1} of ${p.units}: step ${steps.toLocaleString()}, gradient ratio ${r.ratio.toExponential(1)}, ${((performance.now() - run.t0) / 1000).toFixed(1)} s`); lastDraw = performance.now(); await tick(); }
        }
        if (st.stop && !converged && steps < p.maxSteps) break;
        const wf = await be.getW(); Wf.set(wf, kk * p.M);
        const u = await be.getU();
        const unit = summarise(u, c, p); unit.idx = kk; unit.w = wf; unit.steps = steps; unit.converged = converged; unit.ratio = r.ratio; unit.ms = performance.now() - tUnit;
        unit.pix = dewhiten(run, wf); run.units.push(unit); run.inProgress = null; drawGrid();
      }
      const dt = (performance.now() - run.t0) / 1000;
      status(`${st.stop ? 'stopped' : 'done'}: ${run.units.length} unit${run.units.length === 1 ? '' : 's'} in ${dt.toFixed(1)} s (${be.name}, seed ${p.seed}); ${run.units.filter(x => x.converged).length} converged, mean ${Math.round(run.units.reduce((a, x) => a + x.steps, 0) / Math.max(1, run.units.length))} steps per unit.`);
    } catch (e) { console.error(e); status('error: ' + e.message); }
    st.running = false; run.inProgress = null; drawGrid();
  }
  const tick = () => new Promise(r => setTimeout(r, 0));

  function dewhiten(run, w) {
    const b = new Float32Array(L), M = run.p.M; for (let a = 0; a < L; a++) { let s = 0; for (let j = 0; j < M; j++) s += run.E[a * L + j] * run.dsq[j] * w[j]; b[a] = s; } return b;
  }
  function summarise(u, c, p) {
    // the histogram and the tail are of u / sd (standardised), so the unit Gaussian is the variance-matched null in raw mode too; EG is of u itself
    const hist = new Float64Array(NB); let s2 = 0, s4 = 0, tail = 0, EG = 0;
    const n = u.length; for (let i = 0; i < n; i++) { const v = u[i]; s2 += v * v; s4 += v * v * v * v; EG += c.G(v); }
    s2 /= n; s4 /= n; const sd = Math.sqrt(s2) || 1;
    for (let i = 0; i < n; i++) { const v = u[i] / sd; const b = Math.floor((v - XLO) / BW); if (b >= 0 && b < NB) hist[b]++; if (Math.abs(v) > 3) tail++; }
    return { hist: Array.from(hist), n, kurt: s4 / (s2 * s2) - 3, tail: tail / n, EG: EG / n, var: s2, sd };
  }

  // ---------------------------------------------------------------- the grid
  const grid = $('isc-grid');
  function gridGeom() { const run = st.run; const n = run ? run.p.units : 64; const cols = Math.ceil(Math.sqrt(n)); const cell = Math.floor((grid.width - 4) / cols); return { cols, cell, rows: Math.ceil(n / cols) }; }
  function drawTile(ctx, pix, x, y, size) {
    let m = 0; for (let a = 0; a < L; a++) m = Math.max(m, Math.abs(pix[a])); m = m || 1;
    const im = ctx.createImageData(K, K); for (let a = 0; a < L; a++) { const v = Math.round(127.5 + 127.5 * pix[a] / m); im.data[4 * a] = im.data[4 * a + 1] = im.data[4 * a + 2] = v; im.data[4 * a + 3] = 255; }
    const tmp = document.createElement('canvas'); tmp.width = K; tmp.height = K; tmp.getContext('2d').putImageData(im, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, x, y, size, size);
  }
  function drawGrid() {
    const ctx = grid.getContext('2d'); ctx.clearRect(0, 0, grid.width, grid.height); const run = st.run; if (!run) return;
    const { cols, cell } = gridGeom(), pad = 3, size = cell - pad;
    run.units.forEach((un, i) => { const x = 2 + (i % cols) * cell, y = 2 + Math.floor(i / cols) * cell; drawTile(ctx, un.pix, x, y, size);
      if (st.selected === i) { ctx.strokeStyle = '#2b6cb0'; ctx.lineWidth = 3; ctx.strokeRect(x - 1.5, y - 1.5, size + 3, size + 3); } });
    if (run.inProgress) { const i = run.inProgress.idx, x = 2 + (i % cols) * cell, y = 2 + Math.floor(i / cols) * cell; drawTile(ctx, dewhiten(run, run.inProgress.w), x, y, size); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.strokeRect(x - 1.5, y - 1.5, size + 3, size + 3); }
  }
  grid.addEventListener('click', e => {
    const run = st.run; if (!run) return; const r = grid.getBoundingClientRect(), f = grid.width / r.width, x = (e.clientX - r.left) * f, y = (e.clientY - r.top) * f, { cols, cell } = gridGeom();
    const c = Math.floor((x - 2) / cell), rw = Math.floor((y - 2) / cell), i = rw * cols + c; if (c < 0 || c >= cols || i < 0 || i >= run.units.length) return;
    st.selected = i; drawGrid(); drawPlots();
  });

  // ---------------------------------------------------------------- the plots
  const P = ['isc-p1', 'isc-p2', 'isc-p3', 'isc-p4'].map(id => $(id));
  let hoverU = null;
  function layoutPlots() { const four = $('isc-show4').checked; P[3].hidden = !four; const hs = four ? [150, 110, 130, 130] : [190, 150, 180, 0]; P.forEach((cv, i) => { if (hs[i]) cv.height = hs[i]; }); }
  $('isc-xmax').addEventListener('input', () => { $('isc-xmaxv').textContent = $('isc-xmax').value; drawPlots(); saveParams(); });
  $('isc-logy').addEventListener('change', drawPlots); $('isc-gauss').addEventListener('change', drawPlots); $('isc-show4').addEventListener('change', () => { layoutPlots(); drawPlots(); });
  $('isc-xmaxv').textContent = $('isc-xmax').value; layoutPlots();
  P.forEach(cv => { cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); const xm = +$('isc-xmax').value; const Lm = 52, Rm = 14; const fx = (e.clientX - r.left) / r.width * cv.width; hoverU = -xm + (fx - Lm) / (cv.width - Lm - Rm) * 2 * xm; drawPlots(); }); cv.addEventListener('mouseleave', () => { hoverU = null; drawPlots(); }); });
  const phi = u => Math.exp(-u * u / 2) / Math.sqrt(2 * Math.PI);
  function gaussEG(Gf, sd) { let s = 0; const h = 0.01; for (let x = -8; x <= 8; x += h) s += phi(x) * Gf(sd * x) * h; return s; }
  function drawPlots() {
    const run = st.run, un = run && st.selected !== null ? run.units[st.selected] : null;
    const head = $('isc-phead'), stat = $('isc-pstat');
    if (!un) { P.forEach(cv => cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)); head.textContent = ''; stat.textContent = ''; $('isc-hover').innerHTML = '&nbsp;'; return; }
    const G = run.G, xm = +$('isc-xmax').value, logy = $('isc-logy').checked, showG = $('isc-gauss').checked;
    const sd = un.sd || 1, raw = !!run.p.raw;
    const EGg = raw ? gaussEG(G.G, sd) : G.EG_gauss;
    head.innerHTML = `<b>unit ${un.idx + 1}</b>, ${un.converged ? 'converged' : 'stopped'} after ${un.steps.toLocaleString()} steps; G(u) = <code>${run.p.expr}</code>${raw ? '; raw data, axis in units of &sigma;' : ''}`;
    stat.innerHTML = `E[G] <b>${un.EG.toFixed(4)}</b> (Gaussian of the same variance ${EGg.toFixed(4)}) &middot; excess kurtosis <b>${un.kurt.toFixed(2)}</b> &middot; P(|u| &gt; 3&sigma;) ${(100 * un.tail).toFixed(2)}% (Gaussian 0.27%)${raw ? ` &middot; &sigma;(u) = <b>${sd.toFixed(3)}</b> (a random direction: 1)` : ''}`;
    // series over the visible range, on a fine grid (density from the histogram by nearest bin)
    const n = 400, xs = Array.from({ length: n + 1 }, (_, i) => -xm + 2 * xm * i / n);
    const dens = u => { const b = Math.floor((u - XLO) / BW); return (b >= 0 && b < NB) ? un.hist[b] / (un.n * BW) : 0; };
    const rows = [
      { title: 'density p(u) of the projection', f: dens, g: showG ? phi : null, log: logy, kind: 'hist' },
      { title: 'objective G(u)', f: s => G.G(sd * s), g: null, log: logy, kind: 'line' },
      { title: 'p(u) G(u): the integrand of E[G]', f: s => dens(s) * G.G(sd * s), g: showG ? s => phi(s) * G.G(sd * s) : null, log: logy, kind: 'area' },
      { title: 'p(u) g(u), g = dG/du: where the gradient pressure lands', f: s => dens(s) * G.g(sd * s), g: showG ? s => phi(s) * G.g(sd * s) : null, log: logy, kind: 'area' },
    ];
    const nrows = $('isc-show4').checked ? 4 : 3;
    const hov = [];
    rows.slice(0, nrows).forEach((row, ri) => {
      const last = ri === nrows - 1;
      const cv = P[ri], ctx = cv.getContext('2d'), W = cv.width, H = cv.height, Lm = 64, Rm = 14, T = 16, B = last ? 30 : 8, pw = W - Lm - Rm, ph = H - T - B;
      ctx.clearRect(0, 0, W, H);
      const ys = xs.map(row.f), gs = row.g ? xs.map(row.g) : null;
      const all = gs ? ys.concat(gs) : ys; let lo = Math.min(...all), hi = Math.max(...all); if (!(hi > lo)) { hi = lo + 1; } if (row.kind !== 'line') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
      let Y;
      if (row.log && row.kind === 'hist') { const ymin = Math.max(1e-7, 0.5 / (un.n * BW)); const lmin = Math.log10(ymin), lmax = Math.log10(Math.max(hi, ymin * 10)); Y = v => T + ph - (Math.log10(Math.max(v, ymin)) - lmin) / (lmax - lmin) * ph; }
      else if (row.log) { const a = Math.max(Math.abs(lo), Math.abs(hi)) || 1, y0 = a / 1e4, sl = v => Math.sign(v) * Math.log10(1 + Math.abs(v) / y0), smax = sl(a); Y = v => T + ph / 2 - sl(v) / smax * ph / 2; }
      else Y = v => T + ph - (v - lo) / (hi - lo) * ph;
      const X = u => Lm + (u + xm) / (2 * xm) * pw;
      // zero line
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; if (row.kind !== 'hist' || row.log) { const y0 = Y(0); if (y0 >= T && y0 <= T + ph) { ctx.beginPath(); ctx.moveTo(Lm, y0); ctx.lineTo(Lm + pw, y0); ctx.stroke(); } }
      // area / line
      if (row.kind === 'hist' || row.kind === 'area') { ctx.fillStyle = row.kind === 'hist' ? '#9ec1e6' : (ri === 2 ? '#f0b27a' : '#a9dfbf'); ctx.beginPath(); const yz = Y(0); ctx.moveTo(X(xs[0]), yz); xs.forEach((u, i) => ctx.lineTo(X(u), Y(ys[i]))); ctx.lineTo(X(xs[n]), yz); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = row.kind === 'hist' ? '#2b6cb0' : ri === 1 ? '#c0392b' : ri === 2 ? '#b9770e' : '#1e8449'; ctx.lineWidth = 1.6; ctx.beginPath(); xs.forEach((u, i) => { const yy = Y(ys[i]); i ? ctx.lineTo(X(u), yy) : ctx.moveTo(X(u), yy); }); ctx.stroke();
      if (gs) { ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]); ctx.beginPath(); xs.forEach((u, i) => { const yy = Y(gs[i]); i ? ctx.lineTo(X(u), yy) : ctx.moveTo(X(u), yy); }); ctx.stroke(); ctx.setLineDash([]); }
      // frame, ticks, title
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.strokeRect(Lm, T, pw, ph);
      ctx.fillStyle = '#444'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
      const fmt = v => v === 0 ? '0' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : Math.abs(v) >= 0.01 ? v.toFixed(3) : v.toExponential(1);
      // y ticks with numbers: linear = nice steps; log density = decades; signed log = 0 and the decades of |y|
      const ticks = [];
      if (row.log && row.kind === 'hist') { const ymin = Math.max(1e-7, 0.5 / (un.n * BW)); for (let e = Math.ceil(Math.log10(ymin)); e <= 0; e++) if (Math.pow(10, e) <= hi) ticks.push([Math.pow(10, e), '10^' + e]); }
      else if (row.log) { const a = Math.max(Math.abs(lo), Math.abs(hi)) || 1; ticks.push([0, '0']); for (let e = Math.floor(Math.log10(a)); e >= Math.floor(Math.log10(a)) - 3; e--) { ticks.push([Math.pow(10, e), '10^' + e]); ticks.push([-Math.pow(10, e), '-10^' + e]); } }
      else { const span = hi - lo, raw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map(m => m * mag).find(sv => span / sv <= 5); for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push([v, fmt(Math.abs(v) < step / 1e6 ? 0 : v)]); }
      ticks.forEach(([v, lab]) => { const yy = Y(v); if (yy < T - 1 || yy > T + ph + 1) return; ctx.fillText(lab, Lm - 6, yy + 4); ctx.beginPath(); ctx.moveTo(Lm - 3, yy); ctx.lineTo(Lm, yy); ctx.stroke(); });
      const ylab = ['probability density (per σ)', 'G(u)', 'p(u) G(u)  (per σ)', 'p(u) g(u)  (per σ)'][ri];
      ctx.save(); ctx.translate(11, T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = '#444'; ctx.fillText(ylab, 0, 0); ctx.restore();
      ctx.textAlign = 'left'; ctx.fillStyle = '#333'; ctx.fillText(row.title + (row.log && row.kind !== 'hist' ? '  (signed log)' : ''), Lm + 6, T - 4);
      if (last) { ctx.textAlign = 'center'; ctx.fillStyle = '#444'; for (let v = -Math.floor(xm); v <= xm; v += xm > 6 ? 2 : 1) { ctx.fillText(v, X(v), T + ph + 13); } ctx.fillText(run.p.raw ? 'u / σ  (standard deviations of the projection)' : 'u = w · z  (standard deviations; σ = 1 on whitened data)', Lm + pw / 2, H - 3); }
      // hover crosshair
      if (hoverU !== null && hoverU >= -xm && hoverU <= xm) { ctx.strokeStyle = '#999'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(hoverU), T); ctx.lineTo(X(hoverU), T + ph); ctx.stroke(); ctx.setLineDash([]); hov.push(row.f(hoverU)); }
    });
    $('isc-hover').innerHTML = hoverU !== null && hov.length ? `u = ${hoverU.toFixed(2)}: p = ${hov[0].toExponential(2)} (Gaussian ${phi(hoverU).toExponential(2)}), G = ${hov[1].toFixed(4)}, p·G = ${hov[2].toExponential(2)}` + (hov.length > 3 ? `, p·g = ${hov[3].toExponential(2)}` : '') : '&nbsp;';
  }

  // ---------------------------------------------------------------- buttons
  $('isc-start').addEventListener('click', start);
  $('isc-stop').addEventListener('click', () => { st.stop = true; });
  $('isc-reset').addEventListener('click', () => { st.stop = true; st.run = null; st.selected = null; drawGrid(); drawPlots(); status(''); });
  window.addEventListener('resize', drawPlots);
  pickBackend().then(drawGrid);
  window.ISC = st;   // for tests
})();

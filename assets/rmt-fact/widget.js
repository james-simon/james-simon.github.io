// The widget in "The most useful random matrix theory fact I know": pick a spectrum, d and n,
// and compare the diagonal of E[Π] (estimated in a worker) with λ_i / (λ_i + κ).
(function () {
  var root = document.getElementById('rmt');
  if (!root) return;

  var MAX = 300, MAX_TRIALS = 100, MAX_MS = 10000;
  var VEIL_DELAY = 120; // runs shorter than this never grey out the plot, so dragging doesn't flicker
  var NS = 'http://www.w3.org/2000/svg';
  var W = 360, H = 250, M = { l: 46, r: 12, t: 10, b: 34 };

  // Slider positions are the distinct integers in a log-spaced sweep of 1..MAX, so every arrow
  // key press changes the value.
  var steps = [];
  for (var k = 0; k <= 240; k++) {
    var v = Math.round(Math.pow(MAX, k / 240));
    if (steps[steps.length - 1] !== v) steps.push(v);
  }
  function stepOf(v) {
    var best = 0;
    for (var i = 0; i < steps.length; i++) if (Math.abs(steps[i] - v) < Math.abs(steps[best] - v)) best = i;
    return best;
  }

  var state = { kind: 'power', d: 200, n: 50 };

  function spectrum(kind, d) {
    var l = new Float64Array(d);
    var top = Math.ceil(d / 10);
    for (var i = 1; i <= d; i++) {
      l[i - 1] =
        kind === 'power' ? Math.pow(i, -1.5) :
        kind === 'exp' ? Math.exp(-(i - 1) / 30) :
        (i <= top ? 1 : 0.05);
    }
    return l;
  }

  // Solves sum_i λ_i / (λ_i + κ) = n for κ by bisection on log κ; κ = 0 once n reaches d.
  function kappa(l, n) {
    if (n >= l.length) return 0;
    var total = 0, min = Infinity;
    for (var i = 0; i < l.length; i++) { total += l[i]; min = Math.min(min, l[i]); }
    var lo = Math.log(min * 1e-12), hi = Math.log(total / n);
    for (var it = 0; it < 200; it++) {
      var mid = (lo + hi) / 2, k = Math.exp(mid), s = 0;
      for (var i = 0; i < l.length; i++) s += l[i] / (l[i] + k);
      if (s > n) lo = mid; else hi = mid;
    }
    return Math.exp((lo + hi) / 2);
  }

  // ---- drawing ----

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function logScale(lo, hi, a, b) {
    var L = Math.log10(lo), R = Math.log10(hi);
    var f = function (v) { return a + (Math.log10(v) - L) / (R - L) * (b - a); };
    f.lo = lo; f.hi = hi;
    return f;
  }

  function linScale(lo, hi, a, b) {
    var f = function (v) { return a + (v - lo) / (hi - lo) * (b - a); };
    f.lo = lo; f.hi = hi;
    return f;
  }

  // Ticks for a log axis: powers of ten, or 1-2-5 within a decade when the range is short.
  function logTicks(lo, hi) {
    var a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi));
    var mult = b - a <= 1 ? [1, 2, 5] : [1];
    var out = [];
    for (var p = a; p <= b; p++) {
      for (var m = 0; m < mult.length; m++) {
        var v = mult[m] * Math.pow(10, p);
        if (v >= lo * 0.999 && v <= hi * 1.001) out.push({ v: v, p: p, m: mult[m] });
      }
    }
    return out;
  }

  function plainLabel(t) { return String(t.v >= 1 ? Math.round(t.v) : t.v); }

  function powerLabel(text, t) {
    if (t.m !== 1) { text.textContent = t.m + '·10'; }
    else text.textContent = '10';
    var sup = el('tspan', { dy: '-6', 'font-size': '8' }, text);
    sup.textContent = String(t.p).replace('-', '−');
  }

  function frame(svg, x, y, xTicks, yTicks, yLabel) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var g = el('g', { class: 'rmt-axes' }, svg);
    yTicks.forEach(function (t) {
      var py = y(t.v);
      el('line', { x1: M.l, x2: W - M.r, y1: py, y2: py, class: 'rmt-grid' }, g);
      var lab = el('text', { x: M.l - 7, y: py + 3.5, 'text-anchor': 'end' }, g);
      yLabel(lab, t);
    });
    xTicks.forEach(function (t) {
      var px = x(t.v);
      el('line', { x1: px, x2: px, y1: H - M.b, y2: H - M.b + 4, class: 'rmt-tick' }, g);
      el('text', { x: px, y: H - M.b + 15, 'text-anchor': 'middle' }, g).textContent = plainLabel(t);
    });
    el('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, class: 'rmt-axis' }, g);
    el('line', { x1: M.l, x2: M.l, y1: M.t, y2: H - M.b, class: 'rmt-axis' }, g);
    el('text', { x: (M.l + W - M.r) / 2, y: H - 3, 'text-anchor': 'middle', class: 'rmt-xlabel' }, g).textContent = 'i';
  }

  function indexScale(d) {
    return logScale(Math.min(0.8, 1 / Math.pow(d, 0.04)), d * Math.pow(d, 0.04) + 0.25, M.l + 6, W - M.r - 6);
  }

  var specSvg = document.getElementById('rmt-spec');
  var projSvg = document.getElementById('rmt-proj');
  var projPanel = document.getElementById('rmt-proj-panel');
  var dots = null; // group holding the experiment's dots

  function drawSpectrum(l) {
    var d = l.length, lo = Infinity, hi = 0;
    for (var i = 0; i < d; i++) { lo = Math.min(lo, l[i]); hi = Math.max(hi, l[i]); }
    var pad = Math.max(0.3, Math.log10(hi / lo) * 0.06);
    var y0 = lo / Math.pow(10, pad), y1 = hi * Math.pow(10, pad);
    var x = indexScale(d), y = logScale(y0, y1, H - M.b - 6, M.t + 4);
    var yt = logTicks(y0, y1);
    if (yt.length > 6) yt = yt.filter(function (t) { return t.p % 2 === 0; });
    frame(specSvg, x, y, logTicks(1, d), yt, powerLabel);
    var g = el('g', { class: 'rmt-spec-dots' }, specSvg);
    for (var i = 0; i < d; i++) el('circle', { cx: x(i + 1), cy: y(l[i]), r: 2.1 }, g);
  }

  var projX = null, projY = null;

  function drawProjector(l, k) {
    var d = l.length;
    projX = indexScale(d);
    projY = linScale(0, 1, H - M.b - 6, M.t + 4);
    var ticks = [0, 0.25, 0.5, 0.75, 1].map(function (v) { return { v: v }; });
    frame(projSvg, projX, projY, logTicks(1, d), ticks, function (text, t) {
      text.textContent = t.v === 0 || t.v === 1 ? String(t.v) : String(t.v).replace(/^0/, '');
    });
    dots = el('g', { class: 'rmt-exp-dots' }, projSvg);
    var pts = [];
    for (var i = 0; i < d; i++) {
      var th = k === 0 ? 1 : l[i] / (l[i] + k);
      pts.push(projX(i + 1).toFixed(2) + ',' + projY(th).toFixed(2));
    }
    el(d > 1 ? 'polyline' : 'circle', d > 1
      ? { points: pts.join(' '), class: 'rmt-theory' }
      : { cx: projX(1), cy: projY(1), r: 3, class: 'rmt-theory-pt' }, projSvg);
  }

  function drawDots(mean) {
    if (!dots) return;
    while (dots.firstChild) dots.removeChild(dots.firstChild);
    for (var i = 0; i < mean.length; i++) el('circle', { cx: projX(i + 1), cy: projY(mean[i]), r: 2.3 }, dots);
  }

  // ---- running the experiment ----

  var worker = null, veilTimer = null, lastMean = null;

  function setRunning(on) {
    projPanel.classList.toggle('running', on);
  }

  function run() {
    var l = spectrum(state.kind, state.d);
    drawSpectrum(l);
    drawProjector(l, kappa(l, state.n));
    // Until the new run reports, keep the last dots if they're for the same spectrum and d, so
    // dragging n doesn't make them blink.
    if (lastMean && lastMean.length === state.d) drawDots(lastMean);

    if (worker) worker.terminate();
    clearTimeout(veilTimer);
    veilTimer = setTimeout(function () {
      setRunning(true);
      drawDots(new Float64Array(0));
    }, VEIL_DELAY);

    worker = new Worker(root.getAttribute('data-worker'));
    var mine = worker;
    worker.onmessage = function (e) {
      if (mine !== worker) return;
      drawDots(e.data.mean);
      lastMean = e.data.mean;
      if (e.data.done) {
        clearTimeout(veilTimer);
        setRunning(false);
        worker.terminate();
        worker = null;
      }
    };
    worker.postMessage({ lambdas: l, n: state.n, maxTrials: MAX_TRIALS, maxMs: MAX_MS });
  }

  var pending = 0;
  function schedule() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(run);
  }

  // ---- controls ----

  var dIn = document.getElementById('rmt-d'), nIn = document.getElementById('rmt-n');
  var dOut = document.getElementById('rmt-d-out'), nOut = document.getElementById('rmt-n-out');
  [dIn, nIn].forEach(function (input) {
    input.min = 0; input.max = steps.length - 1; input.step = 1;
  });

  function syncSliders() {
    dIn.value = stepOf(state.d);
    nIn.value = stepOf(state.n);
    dOut.textContent = state.d;
    nOut.textContent = state.n;
    // Shade the part of n's track that lies beyond d.
    nIn.style.setProperty('--limit', (stepOf(state.d) / (steps.length - 1) * 100) + '%');
  }

  dIn.addEventListener('input', function () {
    state.d = steps[+dIn.value];
    if (state.n > state.d) state.n = state.d;
    syncSliders();
    schedule();
  });

  nIn.addEventListener('input', function () {
    state.n = Math.min(steps[+nIn.value], state.d);
    syncSliders();
    schedule();
  });

  var buttons = root.querySelectorAll('.rmt-kinds button');
  function choose(button) {
    state.kind = button.getAttribute('data-kind');
    lastMean = null;
    Array.prototype.forEach.call(buttons, function (b) {
      var on = b === button;
      b.setAttribute('aria-checked', on);
      b.tabIndex = on ? 0 : -1;
    });
    schedule();
  }
  Array.prototype.forEach.call(buttons, function (b, i) {
    b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
    b.addEventListener('click', function () { choose(b); });
    b.addEventListener('keydown', function (e) {
      var step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      var next = buttons[(i + step + buttons.length) % buttons.length];
      choose(next);
      next.focus();
    });
  });

  syncSliders();
  run();
})();

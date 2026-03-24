// ============================================================================
// Activation Function Visualizer
// ============================================================================

const COLORS = [
  '#e05c30', '#2e86c1', '#27ae60', '#8e44ad',
  '#c0963c', '#16a085', '#c0392b', '#2c3e50',
];

const N_POINTS    = 500;
const MONO        = 'Monaco, Consolas, "Courier New", monospace';
const MAX_ORDER   = 10;
const ZERO_THRESH = 1e-12;  // values smaller than this are treated as exactly 0



// Non-smooth at z=0 — derivatives are not well-defined there.
// (selu/elu are C¹ at 0 and smooth, so they're NOT listed here.)
const NON_SMOOTH_NAMES = new Set(['relu', 'leakyrelu', 'abs', 'sign']);

// ============================================================================
// Expression parsing — converts user input to a compiled JS function
// ============================================================================

const NAMED_ACTIVATIONS = {
  sigmoid:   arg => `(1/(1+exp(-(${arg}))))`,
  relu:      arg => `max(0,(${arg}))`,
  gelu:      arg => `((${arg})*0.5*(1+tanh(sqrt(2/pi)*((${arg})+0.044715*(${arg})^3))))`,
  swish:     arg => `((${arg})/(1+exp(-(${arg}))))`,
  selu:      arg => `((${arg})>=0?1.0507*(${arg}):1.0507*1.6733*(exp((${arg}))-1))`,
  elu:       arg => `((${arg})>=0?(${arg}):(exp((${arg}))-1))`,
  softplus:  arg => `log(1+exp((${arg})))`,
  leakyrelu: arg => `((${arg})>=0?(${arg}):0.01*(${arg}))`,
};

// Expand named activation calls with explicit args in a string `s`.
// For each name in NAMED_ACTIVATIONS, replaces `name(expr)` → expander(name, expr)
// using balanced-paren extraction. Also replaces bare `name` → expander(name, 'z').
function expandActivations(s, expander) {
  // Explicit-arg calls: name(expr) with balanced parens
  for (const name of Object.keys(NAMED_ACTIVATIONS)) {
    const re = new RegExp(`\\b${name}\\s*\\(`, 'gi');
    let match;
    while ((match = re.exec(s)) !== null) {
      let depth = 1, i = match.index + match[0].length;
      while (i < s.length && depth > 0) {
        if (s[i] === '(') depth++; else if (s[i] === ')') depth--;
        i++;
      }
      const arg      = s.slice(match.index + match[0].length, i - 1);
      const expanded = expander(name.toLowerCase(), arg);
      s = s.slice(0, match.index) + expanded + s.slice(i);
      re.lastIndex = match.index + expanded.length;
    }
  }
  // Bare names → implicit z
  for (const name of Object.keys(NAMED_ACTIVATIONS)) {
    const re = new RegExp(`\\b${name}\\b(?!\\s*\\()`, 'gi');
    s = s.replace(re, expander(name.toLowerCase(), 'z'));
  }
  return s;
}

// Convert user input → math.js expression string (for symbolic differentiation).
// Expands named activations to primitive operations math.js can differentiate.
function toMathJsExpr(raw) {
  let s = raw.trim();
  s = expandActivations(s, (name, arg) => NAMED_ACTIVATIONS[name](arg));
  // Bare math function names with no arg → apply z
  const BARE = ['tanh','sin','cos','tan','sinh','cosh','exp','sqrt','log','abs','sign','cbrt','asin','acos','atan'];
  for (const fn of BARE) {
    const re = new RegExp(`\\b${fn}\\b(?!\\s*\\()`, 'gi');
    s = s.replace(re, `${fn}(z)`);
  }
  s = s.replace(/(\d)\s*(z)\b/g, '$1*$2');
  return s;
}

// Convert user input → compiled JS function (for plotting and numerical differentiation).
function toJsFn(raw) {
  let s = raw.trim();

  s = expandActivations(s, (name, arg) => NAMED_ACTIVATIONS[name](arg));

  const MATHJS_TO_JS = {
    tanh:'Math.tanh', sin:'Math.sin',  cos:'Math.cos',   tan:'Math.tan',
    sinh:'Math.sinh', cosh:'Math.cosh', exp:'Math.exp',  log:'Math.log',
    sqrt:'Math.sqrt', abs:'Math.abs',  sign:'Math.sign', cbrt:'Math.cbrt',
    asin:'Math.asin', acos:'Math.acos', atan:'Math.atan', max:'Math.max',
    min:'Math.min',   floor:'Math.floor', ceil:'Math.ceil', round:'Math.round',
  };
  for (const [fn, jsfn] of Object.entries(MATHJS_TO_JS)) {
    const re = new RegExp(`(?<!Math\\.)\\b${fn}\\s*\\(`, 'g');
    s = s.replace(re, `${jsfn}(`);
  }
  s = s.replace(/\bpi\b/gi, 'Math.PI');
  s = s.replace(/\be\b/g,   'Math.E');
  s = s.replace(/\^/g,      '**');

  return new Function('z', `"use strict"; return (${s});`);
}

const TEST_ZS = [-2, -1, -0.5, 0, 0.5, 1, 2];

function compileExpr(raw) {
  if (!raw.trim()) throw new Error('empty expression');

  // Compile JS function for plotting
  let fn;
  try {
    fn = toJsFn(raw);
  } catch (e) {
    throw new Error('syntax error');
  }

  // Sanity check
  let allNaN = true;
  for (const z of TEST_ZS) {
    let v;
    try { v = fn(z); } catch (_) { throw new Error('runtime error'); }
    if (typeof v !== 'number') throw new Error('did not return a number');
    if (isFinite(v)) allNaN = false;
  }
  if (allNaN) throw new Error('returned NaN/Inf at all test points');

  return fn;
}

// ============================================================================
// Numerical differentiation
// ============================================================================

// Optimal step size for k-th order central difference at z=0:
// balances O(h^2) truncation error vs O(eps * 2^k / h^k) roundoff.
// h_k = (k * 2^(k-1) * eps)^(1/(k+2)),  eps = machine epsilon.
const EPS = 2.22e-16;
function optimalH(k) {
  return Math.pow(k * Math.pow(2, k - 1) * EPS, 1 / (k + 2));
}

// Binomial coefficient C(n, k).
function binom(n, k) {
  if (k === 0 || k === n) return 1;
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return Math.round(r);
}

// k-th derivative of fn at z=0 via central difference stencil.
// f^(k)(0) ≈ (1/h^k) * Σ_{j=0}^{k} (-1)^(k-j) * C(k,j) * f((j - k/2) * h)
function kthDerivAtZero(fn, k) {
  if (k === 0) return fn(0);
  const h = optimalH(k);
  let sum = 0;
  for (let j = 0; j <= k; j++) {
    const sign = (k - j) % 2 === 0 ? 1 : -1;
    sum += sign * binom(k, j) * fn((j - k / 2) * h);
  }
  return sum / Math.pow(h, k);
}

function isNonSmooth(label) {
  const lower = label.toLowerCase().replace(/\s+/g, '');
  for (const name of NON_SMOOTH_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) return true;
  }
  return false;
}

// Unicode superscript digits for log-scale tick labels
const SUP = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
function toSuperscript(n) { return String(n).split('').map(c => SUP[c] ?? c).join(''); }

// Returns true if expr is the constant 0 (so all higher derivatives are trivially 0).
function isSymbolicZero(expr) {
  try {
    return expr.isConstantNode ? Number(expr.value) === 0 : expr.toString().trim() === '0';
  } catch (_) { return false; }
}

// If the symbolic expression string exceeds this length, bail to numerical.
// Sigmoid's expression tree doubles in size each derivative; this caps it.
const SYMB_MAX_LEN = 200;

// Compute c_ell = [sigma^(ell)(0)]^2 for ell = 0..MAX_ORDER.
// Returns array of { ell, value, method } or null if non-smooth at 0.
// Strategy: symbolic via math.js, falling back to numerical when the
// expression grows too large or math.derivative throws.
function computeCoeffs(fn, label) {
  if (isNonSmooth(label)) return null;

  const exprStr = toMathJsExpr(label);
  let symbExpr;
  try { symbExpr = math.parse(exprStr); } catch (_) { symbExpr = null; }

  const result = [];
  let useNumerical = symbExpr === null;

  for (let ell = 0; ell <= MAX_ORDER; ell++) {
    let deriv;
    const method = useNumerical ? 'numerical' : 'symbolic';

    if (!useNumerical) {
      // Try symbolic evaluation at z=0
      let val;
      try { val = symbExpr.evaluate({ z: 0 }); } catch (_) { val = NaN; }
      if (typeof val !== 'number' || !isFinite(val)) val = NaN;
      deriv = val;

      // Symbolically differentiate for next order.
      // Short-circuit if expression is identically zero.
      // Bail to numerical if expression has grown too large.
      if (ell < MAX_ORDER) {
        if (isSymbolicZero(symbExpr)) {
          for (let k = ell + 1; k <= MAX_ORDER; k++) result.push({ ell: k, value: 0, method: 'symbolic' });
          break;
        }
        if (symbExpr.toString().length > SYMB_MAX_LEN) {
          useNumerical = true;
        } else {
          try { symbExpr = math.derivative(symbExpr, 'z'); } catch (_) { useNumerical = true; }
        }
      }
    } else {
      deriv = kthDerivAtZero(fn, ell);
    }

    const value = Math.abs(deriv) < ZERO_THRESH ? 0 : deriv ** 2;
    result.push({ ell, value, method });
  }

  return result;
}

// ============================================================================
// State
// ============================================================================

let functions   = [];
let nextId      = 0;
let sigmaChart  = null;
let coeffsChart = null;
let selectedId  = null;

let xLimit     = 3;
let yLimitSig  = 3;
let showGrid   = true;
let yMinExp    = null;   // null = auto; otherwise 10^yMinExp is the y-axis min

const STORAGE_KEY = 'level-coeffs-functions';
const DEFAULTS    = ['z', 'tanh(z)', 'sigmoid(z)'];

// ============================================================================
// Persistence
// ============================================================================

function saveToStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(functions.map(f => f.label))); } catch (_) {}
}
function loadFromStorage() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
}

// ============================================================================
// Chart setup
// ============================================================================

function makeSigmaOptions() {
  return {
    animation: false, responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    layout: { padding: { right: 8, top: 4 } },
    scales: {
      x: {
        type: 'linear', min: -xLimit, max: xLimit,
        title: { display: true, text: 'z', font: { size: 16, family: MONO }, color: '#555' },
        ticks: { font: { size: 11, family: MONO }, maxRotation: 0, callback: v => +v.toPrecision(3) },
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
      y: {
        type: 'linear', min: -yLimitSig, max: yLimitSig,
        title: { display: true, text: 'σ(z)', font: { size: 16, family: MONO }, color: '#555' },
        ticks: { font: { size: 11, family: MONO }, callback: v => +v.toPrecision(3) },
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
    },
  };
}

function coeffsYMin() {
  if (yMinExp !== null) return Math.pow(10, yMinExp);
  return undefined;  // Chart.js auto
}

function makeCoeffsOptions() {
  return {
    animation: false, responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          title: items => `ℓ = ${items[0].parsed.x}`,
          label: item => {
            const v = item.parsed.y;
            if (v === null || v === undefined || !isFinite(v)) return '';
            if (v === 0) return 'c_ℓ = 0';
            return `c_ℓ = ${v.toExponential(4)}`;
          },
        },
        titleFont: { family: MONO, size: 12 },
        bodyFont:  { family: MONO, size: 12 },
      },
    },
    layout: { padding: { right: 12, top: 4 } },
    scales: {
      x: {
        type: 'linear', min: -0.5, max: MAX_ORDER + 0.5,
        title: { display: true, text: 'ℓ', font: { size: 16, family: MONO }, color: '#555' },
        ticks: {
          font: { size: 11, family: MONO },
          callback: v => Number.isInteger(v) ? v : null,
        },
        afterBuildTicks: axis => { axis.ticks = Array.from({length: MAX_ORDER + 1}, (_, i) => ({ value: i })); },
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
      y: {
        type: 'logarithmic',
        min: coeffsYMin(),
        title: { display: true, text: 'cₗ', font: { size: 16, family: MONO }, color: '#555' },
        ticks: {
          font: { size: 11, family: MONO },
          callback: v => {
            const log = Math.log10(v);
            if (Math.abs(log - Math.round(log)) < 0.01) return `10${toSuperscript(Math.round(log))}`;
            return null;
          },
        },
        grid: { color: 'rgba(0,0,0,0.07)' },
      },
    },
  };
}

function initCharts() {
  sigmaChart = new Chart(
    document.getElementById('sigmaChart').getContext('2d'),
    { type: 'line', data: { datasets: [] }, options: makeSigmaOptions() }
  );
  coeffsChart = new Chart(
    document.getElementById('coeffsChart').getContext('2d'),
    { type: 'scatter', data: { datasets: [] }, options: makeCoeffsOptions() }
  );
}

// ============================================================================
// Rebuild charts
// ============================================================================

function buildSigmaDataset(entry) {
  const pts = [];
  for (let i = 0; i <= N_POINTS; i++) {
    const z = -xLimit + (2 * xLimit * i) / N_POINTS;
    const y = entry.fn(z);
    pts.push({ x: z, y: isFinite(y) ? y : NaN });
  }
  return {
    data: pts,
    borderColor: entry.color,
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    pointRadius: 0,
    tension: 0,
    spanGaps: false,
  };
}

function buildCoeffsDataset(entry) {
  if (!entry.coeffs) return { data: [], borderColor: entry.color, backgroundColor: entry.color, pointRadius: 4 };
  // Only positive values on log scale
  const visible = entry.coeffs.filter(({ value }) => isFinite(value) && value > 0);
  const pts    = visible.map(({ ell, value })  => ({ x: ell, y: value }));
  const styles = visible.map(({ method })      => method === 'numerical' ? 'rect' : 'circle');
  const radii  = visible.map(() => 4);
  return {
    data: pts,
    borderColor: entry.color,
    backgroundColor: entry.color + 'cc',
    pointRadius: radii,
    pointHoverRadius: 7,
    pointStyle: styles,
    showLine: false,
  };
}

function rebuildSigmaChart() {
  sigmaChart.data.datasets = functions.map(buildSigmaDataset);
  sigmaChart.options.scales.x.min = -xLimit;
  sigmaChart.options.scales.x.max =  xLimit;
  sigmaChart.options.scales.y.min = -yLimitSig;
  sigmaChart.options.scales.y.max =  yLimitSig;
  const gc = showGrid ? 'rgba(0,0,0,0.07)' : 'transparent';
  sigmaChart.options.scales.x.grid.color = gc;
  sigmaChart.options.scales.y.grid.color = gc;
  sigmaChart.update('none');
}

function rebuildCoeffsChart() {
  coeffsChart.data.datasets = functions.map(buildCoeffsDataset);
  coeffsChart.options.scales.y.min = coeffsYMin();
  coeffsChart.update('none');
}

function rebuildAll() {
  rebuildSigmaChart();
  rebuildCoeffsChart();
}

// ============================================================================
// Add / remove / edit
// ============================================================================

function colorFor(i) { return COLORS[i % COLORS.length]; }

function buildEntry(raw) {
  const fn     = compileExpr(raw);        // throws on error
  const coeffs = computeCoeffs(fn, raw);  // null if non-smooth
  return { fn, coeffs, nonSmooth: coeffs === null };
}

function addFunction(raw) {
  const { fn, coeffs, nonSmooth } = buildEntry(raw);
  const id = nextId++;
  functions.push({ id, label: raw.trim(), fn, coeffs, nonSmooth, color: colorFor(functions.length) });
  renderPills();
  rebuildAll();
  saveToStorage();
}

function removeFunction(id) {
  if (selectedId === id) setSelected(null);
  functions = functions.filter(f => f.id !== id);
  functions.forEach((f, i) => { f.color = colorFor(i); });
  renderPills();
  rebuildAll();
  saveToStorage();
}

function editFunction(id, newRaw) {
  const { fn, coeffs, nonSmooth } = buildEntry(newRaw);
  const entry = functions.find(f => f.id === id);
  entry.label     = newRaw.trim();
  entry.fn        = fn;
  entry.coeffs    = coeffs;
  entry.nonSmooth = nonSmooth;
  if (selectedId === id) renderDetail(entry);
  renderPills();
  rebuildAll();
  saveToStorage();
}

function loadFunctionList(labels) {
  selectedId = null;
  functions  = [];
  for (const label of labels) {
    try {
      const { fn, coeffs, nonSmooth } = buildEntry(label);
      functions.push({ id: nextId++, label: label.trim(), fn, coeffs, nonSmooth, color: colorFor(functions.length) });
    } catch (_) {}
  }
  renderPills();
  rebuildAll();
  renderDetail(null);
  saveToStorage();
}

// ============================================================================
// Coefficient detail panel
// ============================================================================

function setSelected(id) {
  selectedId = id;
  renderPills();
  const entry = id !== null ? functions.find(f => f.id === id) : null;
  renderDetail(entry);
}

function renderDetail(entry) {
  const panel = document.getElementById('coeffDetail');
  const lbl   = document.getElementById('coeffDetailLabel');
  const pre   = document.getElementById('coeffDetailPre');

  if (!entry) { panel.style.display = 'none'; return; }

  panel.style.display = '';
  lbl.textContent = `σ(z) = ${entry.label}`;
  lbl.style.color = entry.color;

  if (entry.nonSmooth) {
    pre.textContent = '(non-smooth at z = 0 — derivatives are not well-defined)';
    return;
  }

  const lines = entry.coeffs.map(({ ell, value, method }) => {
    const tag = method === 'numerical' ? ' [num]' : '';
    if (!isFinite(value)) return `c_${ell} = (undefined)${tag}`;
    if (value === 0)      return `c_${ell} = 0${tag}`;
    return `c_${ell} = ${value.toExponential(6)}${tag}`;
  });
  pre.textContent = lines.join('\n');
}

// ============================================================================
// Pill list UI
// ============================================================================

function renderPills() {
  const container = document.getElementById('fnList');
  const empty     = document.getElementById('fnListEmpty');
  container.innerHTML = '';
  empty.style.display = functions.length === 0 ? '' : 'none';

  functions.forEach(entry => {
    const pill = document.createElement('div');
    pill.className = 'fn-pill' + (entry.id === selectedId ? ' fn-pill-selected' : '');
    pill.style.cursor = 'pointer';

    const swatch = document.createElement('span');
    swatch.className = 'fn-pill-swatch';
    swatch.style.backgroundColor = entry.color;

    const lbl = document.createElement('span');
    lbl.className = 'fn-pill-label';
    lbl.textContent = entry.label;
    lbl.title = entry.label;

    const editBtn = document.createElement('button');
    editBtn.className = 'fn-pill-btn';
    editBtn.textContent = '✎';
    editBtn.title = 'edit';
    editBtn.addEventListener('click', e => { e.stopPropagation(); startPillEdit(entry.id, pill); });

    const delBtn = document.createElement('button');
    delBtn.className = 'fn-pill-btn delete-btn';
    delBtn.textContent = '✕';
    delBtn.title = 'remove';
    delBtn.addEventListener('click', e => { e.stopPropagation(); removeFunction(entry.id); });

    pill.append(swatch, lbl, editBtn, delBtn);
    pill.addEventListener('click', () => setSelected(entry.id === selectedId ? null : entry.id));
    container.appendChild(pill);
  });
}

function startPillEdit(id, pill) {
  const entry = functions.find(f => f.id === id);
  if (!entry) return;
  pill.innerHTML = '';

  const swatch = document.createElement('span');
  swatch.className = 'fn-pill-swatch';
  swatch.style.backgroundColor = entry.color;

  const input = document.createElement('input');
  input.type = 'text'; input.className = 'fn-pill-edit'; input.value = entry.label;

  const okBtn = document.createElement('button');
  okBtn.className = 'fn-pill-btn'; okBtn.textContent = '✓';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'fn-pill-btn'; cancelBtn.textContent = '✕';

  const commit = () => {
    const val = input.value.trim();
    if (!val) { renderPills(); return; }
    try { editFunction(id, val); input.classList.remove('error'); }
    catch (_) { input.classList.add('error'); input.focus(); }
  };

  okBtn.addEventListener('click', commit);
  cancelBtn.addEventListener('click', () => renderPills());
  input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') renderPills(); });
  pill.append(swatch, input, okBtn, cancelBtn);
  input.focus(); input.select();
}

// ============================================================================
// Gear menu
// ============================================================================

let _activeMenu = null;
function closeActiveMenu() { if (_activeMenu) { _activeMenu.remove(); _activeMenu = null; } }
document.addEventListener('click', closeActiveMenu);

const AXIS_OPTS = [0.5, 1, 2, 3, 5, 8, 10, 15, 20];
const YMIN_OPTS = [
  { label: 'auto', value: null },
  { label: '10⁻²',  value: -2  },
  { label: '10⁻⁴',  value: -4  },
  { label: '10⁻⁶',  value: -6  },
  { label: '10⁻⁸',  value: -8  },
  { label: '10⁻¹⁰', value: -10 },
  { label: '10⁻¹²', value: -12 },
  { label: '10⁻¹⁶', value: -16 },
];

function makeSelectRow(labelText, opts, getCurrent, onChange) {
  const row = document.createElement('div');
  row.className = 'gear-menu-select-row';
  const sp = document.createElement('span');
  sp.textContent = labelText;
  const sel = document.createElement('select');
  sel.style.cssText = `font-size:0.9em;padding:1px 4px;font-family:${MONO}`;
  opts.forEach(opt => {
    const o = document.createElement('option');
    const val = typeof opt === 'object' ? opt.value : opt;
    const txt = typeof opt === 'object' ? opt.label : `±${opt}`;
    o.value = JSON.stringify(val);
    o.textContent = txt;
    if (JSON.stringify(getCurrent()) === JSON.stringify(val)) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', e => onChange(JSON.parse(e.target.value)));
  row.append(sp, sel);
  return row;
}

function makeCheckRow(labelText, checked, onChange) {
  const row = document.createElement('div');
  row.className = 'gear-menu-row';
  const lbl = document.createElement('label');
  const chk = document.createElement('input');
  chk.type = 'checkbox'; chk.checked = checked;
  chk.addEventListener('change', () => onChange(chk.checked));
  lbl.append(chk, document.createTextNode(' ' + labelText));
  row.appendChild(lbl);
  return row;
}

function openGearMenu(gearEl, forSigma) {
  closeActiveMenu();
  const menu = document.createElement('div');
  menu.className = 'gear-menu';
  menu.addEventListener('click', e => e.stopPropagation());

  if (forSigma) {
    menu.appendChild(makeSelectRow('x range:', AXIS_OPTS, () => xLimit, v => { xLimit = v; rebuildSigmaChart(); }));
    menu.appendChild(makeSelectRow('y range:', AXIS_OPTS, () => yLimitSig, v => { yLimitSig = v; rebuildSigmaChart(); }));
    const sep = document.createElement('hr'); sep.className = 'gear-menu-sep'; menu.appendChild(sep);
    menu.appendChild(makeCheckRow('grid lines', showGrid, v => { showGrid = v; rebuildSigmaChart(); }));
  } else {
    menu.appendChild(makeSelectRow('y min:', YMIN_OPTS, () => yMinExp, v => { yMinExp = v; rebuildCoeffsChart(); }));
  }

  const gRect = gearEl.getBoundingClientRect();
  const pRect = gearEl.closest('.plot-cell').getBoundingClientRect();
  menu.style.top   = (gRect.bottom - pRect.top + 4) + 'px';
  menu.style.right = (pRect.right - gRect.right) + 'px';
  gearEl.closest('.plot-cell').appendChild(menu);
  _activeMenu = menu;
}

// ============================================================================
// Init
// ============================================================================

function init() {
  initCharts();

  const input      = document.getElementById('funcInput');
  const addBtn     = document.getElementById('addBtn');
  const errEl      = document.getElementById('parseError');
  const restoreBtn = document.getElementById('restoreDefaultsBtn');

  function tryAdd() {
    const raw = input.value.trim();
    if (!raw) return;
    try {
      addFunction(raw);
      input.value = '';
      input.classList.remove('error');
      errEl.textContent = '';
    } catch (e) {
      input.classList.add('error');
      errEl.textContent = 'Invalid expression: ' + e.message;
    }
  }

  addBtn.addEventListener('click', tryAdd);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') tryAdd(); });
  input.addEventListener('input', () => { input.classList.remove('error'); errEl.textContent = ''; });
  restoreBtn.addEventListener('click', () => loadFunctionList(DEFAULTS));

  document.getElementById('plotGearSigma').addEventListener('click', e => {
    e.stopPropagation();
    if (_activeMenu) { closeActiveMenu(); return; }
    openGearMenu(e.currentTarget, true);
  });
  document.getElementById('plotGearCoeffs').addEventListener('click', e => {
    e.stopPropagation();
    if (_activeMenu) { closeActiveMenu(); return; }
    openGearMenu(e.currentTarget, false);
  });
  document.getElementById('coeffDetailClose').addEventListener('click', () => setSelected(null));

  const saved = loadFromStorage();
  loadFunctionList(saved && saved.length > 0 ? saved : DEFAULTS);
}

init();

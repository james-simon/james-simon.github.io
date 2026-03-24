// ============================================================================
// SHALLOW MLPs — app orchestrator
// ============================================================================

import { AppState } from './state.js';
import { Simulation } from './simulation.js';
import { numCoeffTerms } from './targets.js';
import { LossChart, NormChart, CoeffChart, PreActChart, PreActHistChart,
         WeightHistChart, WeightScatterChart } from './charts.js';
import { UtilityPlot } from './utility-plot.js';
import { EigenvaluePlot } from './eigenvalue-plot.js';
import { bindUI, restoreUI, waitForMathJax, renderNetworkViz } from './ui.js';

// ============================================================================
// PLOT DEFINITIONS
// ============================================================================

// History plots extend BaseChart (have setLogScaleX/Y, setEffectiveTime)
const HISTORY_PLOTS = new Set(['loss', 'coefficients', 'norms', 'preActLine']);

const PLOT_LABELS = {
  loss:         'loss',
  coefficients: 'coefficients',
  norms:        'norms of $\\mathbf{W}$, $\\mathbf{a}$',
  preActLine:   'RMS of $\\mathbf{h} = \\mathbf{Wx}$',
  preActHist:   'histogram of $\\mathbf{h} = \\mathbf{Wx}$',
  weightHists:  'histograms of $W_{:,i}$',
  scatter:      'scatterplot of $(W_{:,1},\\,W_{:,2})$',
  utility:      '2D utility plot',
  eigenvalues:  'kernel eigenvalues',
};

// ============================================================================
// GEAR MENU
// One singleton floating panel, shared across all plots.
// ============================================================================

let _activeMenu = null;  // { el, cleanup }

function closeActiveMenu() {
  if (!_activeMenu) return;
  _activeMenu.el.remove();
  document.removeEventListener('pointerdown', _activeMenu.outside);
  document.removeEventListener('keydown',     _activeMenu.escape);
  _activeMenu = null;
}

// Build and show the gear menu near `gearEl`.
// `fields` is an array of field descriptors:
//   { type: 'checkbox', label, value, onChange }
//   { type: 'select',   label, value, choices: [{label, value}], onChange }
// If fields is empty, shows "no options".
function openGearMenu(gearEl, fields) {
  closeActiveMenu();

  const menu = document.createElement('div');
  menu.className = 'gear-menu';

  if (fields.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'gear-menu-empty';
    msg.textContent = 'no options';
    menu.appendChild(msg);
  } else {
    for (const field of fields) {
      if (field.type === 'checkbox') {
        const row = document.createElement('label');
        row.className = 'gear-menu-row';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = field.value ?? false;
        chk.addEventListener('change', () => field.onChange(chk.checked));
        row.appendChild(chk);
        row.appendChild(document.createTextNode(' ' + field.label));
        menu.appendChild(row);
      } else if (field.type === 'select') {
        const row = document.createElement('div');
        row.className = 'gear-menu-row';
        const lbl = document.createElement('span');
        lbl.textContent = field.label + ' ';
        const sel = document.createElement('select');
        sel.style.cssText = 'font-size:0.88em;padding:1px 3px;';
        for (const ch of field.choices) {
          const opt = document.createElement('option');
          opt.value  = String(ch.value);
          opt.textContent = ch.label;
          if (ch.value === field.value) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.addEventListener('change', () => field.onChange(Number(sel.value)));
        row.appendChild(lbl);
        row.appendChild(sel);
        menu.appendChild(row);
      }
    }
  }

  document.body.appendChild(menu);

  // Position: below-left of gear icon
  const r = gearEl.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const left = Math.min(r.right - mw, window.innerWidth - mw - 8);
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top  = (r.bottom + window.scrollY + 4) + 'px';

  const outside = (e) => { if (!menu.contains(e.target) && e.target !== gearEl) closeActiveMenu(); };
  const escape  = (e) => { if (e.key === 'Escape') closeActiveMenu(); };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown',     escape);

  _activeMenu = { el: menu, outside, escape };
}

// ============================================================================
// PLOT MANAGER
// ============================================================================

class PlotManager {
  constructor(gridEl, appState) {
    this._grid   = gridEl;
    this._state  = appState;
    this._charts = {};   // key -> chart instance (or array for weightHists)
    this._cells  = {};   // key -> container div

    this._params     = null;
    this.useEffTime  = false;
    this.emaWindow   = 1;
    this._eta        = 0.01;
  }

  // Returns { logX, logY } for a given plot key, from persisted state.
  _opts(key) {
    const po = this._state.plotOptions;
    if (!po[key]) po[key] = {};
    return po[key];
  }

  _saveOpts() { this._state.save(); }

  // Called once on startup and whenever visiblePlots changes.
  sync() {
    const visible = new Set(this._state.visiblePlots);

    for (const key of Object.keys(this._charts)) {
      if (!visible.has(key)) this._destroy(key);
    }
    for (const key of visible) {
      if (!this._charts[key]) this._create(key);
    }

    // Re-order cells to match PLOT_LABELS order
    for (const key of Object.keys(PLOT_LABELS)) {
      if (this._cells[key]) this._grid.appendChild(this._cells[key]);
    }
  }

  rebuild(params) {
    this._params = params;
    const visible = new Set(this._state.visiblePlots);

    if (this._charts.coefficients) {
      this._charts.coefficients.setNumTerms(
        numCoeffTerms(params.targetType, params.numTerms), params.targetType);
      this._charts.coefficients.clear();
    }
    if (this._charts.norms) {
      this._charts.norms.setNumTerms(params.numTerms);
      this._charts.norms.clear();
    }
    if (visible.has('weightHists')) {
      this._destroy('weightHists');
      this._create('weightHists');
      for (const key of Object.keys(PLOT_LABELS)) {
        if (this._cells[key]) this._grid.appendChild(this._cells[key]);
      }
    }
    if (this._charts.utility)     this._charts.utility.reset();
    if (this._charts.eigenvalues) this._charts.eigenvalues.reset();
    if (this._charts.loss)        this._charts.loss.clear();
    if (this._charts.preActLine)  this._charts.preActLine.clear();
  }

  update(sim) {
    const visible = new Set(this._state.visiblePlots);
    const eta = sim.params ? sim.params.eta : this._eta;
    this._eta = eta;

    if (visible.has('loss') && this._charts.loss)
      this._charts.loss.update(sim.lossHistory, eta);
    if (visible.has('coefficients') && this._charts.coefficients)
      this._charts.coefficients.update(sim.coeffHistory, eta);
    if (visible.has('norms') && this._charts.norms)
      this._charts.norms.update(sim.normHistory, eta);
    if (visible.has('preActLine') && this._charts.preActLine)
      this._charts.preActLine.update(sim.normHistory, eta);

    if (sim.W && sim.a && sim.params) {
      const { n, d } = sim.params;
      if (visible.has('preActHist') && this._charts.preActHist && sim.preActVals)
        this._charts.preActHist.update(sim.preActVals);
      if (visible.has('weightHists') && this._charts.weightHists)
        for (const h of this._charts.weightHists) h.update(sim.W, n, d);
      if (visible.has('scatter') && this._charts.scatter)
        this._charts.scatter.update(sim.W, sim.a, n, d);
      if (visible.has('utility') && this._charts.utility && d === 2) {
        this._charts.utility.setSimState(sim.params, sim.W, sim.a);
        this._charts.utility.update();
      }

      if (visible.has('eigenvalues') && this._charts.eigenvalues) {
        this._charts.eigenvalues.setSimState(sim.params, sim.W);
        this._charts.eigenvalues.update();
      }
    }
  }

  setEffectiveTime(on, eta) {
    this.useEffTime = on;
    this._eta = eta;
    for (const key of HISTORY_PLOTS) {
      if (this._charts[key]) this._charts[key].setEffectiveTime(on, eta);
    }
  }

  setEmaWindow(w) {
    this.emaWindow = w;
    if (this._charts.loss)         this._charts.loss.setEmaWindow(w);
    if (this._charts.coefficients) this._charts.coefficients.setEmaWindow(w);
  }

  replayHistory(sim) {
    const eta = this._eta;
    if (this._charts.loss)         this._charts.loss.update(sim.lossHistory, eta);
    if (this._charts.coefficients) this._charts.coefficients.update(sim.coeffHistory, eta);
    if (this._charts.norms)        this._charts.norms.update(sim.normHistory, eta);
    if (this._charts.preActLine)   this._charts.preActLine.update(sim.normHistory, eta);
  }

  // ---- private ---------------------------------------------------------------

  _create(key) {
    const params = this._params;

    if (key === 'weightHists') {
      const T = params ? params.numTerms : 1;
      const hists = [];
      const wrapper = this._makeWrapper(key);
      this._grid.appendChild(wrapper);
      for (let k = 0; k < T; k++) {
        const id = `histPlot_${k}`;
        wrapper.appendChild(this._makeCanvas(id));
        hists.push(new WeightHistChart(id, k));
      }
      this._charts.weightHists = hists;
      this._attachGear(key, wrapper);
      return;
    }

    if (key === 'scatter') {
      const cell = this._makeCell(key);
      cell.appendChild(this._makeCanvasBox('scatterPlot'));
      this._grid.appendChild(cell);
      this._charts.scatter = new WeightScatterChart('scatterPlot');
      this._attachGear(key, cell);
      return;
    }

    if (key === 'utility') {
      const cell = this._makeCell(key, 'plot-cell-square');
      const box = document.createElement('div');
      box.style.cssText = 'width:100%;height:100%;position:relative;';
      const canvas = document.createElement('canvas');
      canvas.id = 'utilityPlot';
      canvas.style.cssText = 'width:100%;height:100%;';
      box.appendChild(canvas);
      cell.appendChild(box);
      this._grid.appendChild(cell);
      const uplot = new UtilityPlot('utilityPlot');
      const uopts = this._opts('utility');
      uplot.setOptions({ batchSize: uopts.batchSize, recomputeMs: uopts.recomputeMs });
      this._charts.utility = uplot;
      this._attachGear(key, cell);
      return;
    }

    if (key === 'preActHist') {
      const cell = this._makeCell(key);
      cell.appendChild(this._makeCanvasBox('preActHistPlot'));
      this._grid.appendChild(cell);
      this._charts.preActHist = new PreActHistChart('preActHistPlot');
      this._attachGear(key, cell);
      return;
    }

    if (key === 'eigenvalues') {
      const cell = this._makeCell(key);
      cell.appendChild(this._makeCanvasBox('eigenvaluePlot'));
      this._grid.appendChild(cell);
      const eplot = new EigenvaluePlot('eigenvaluePlot');
      const eopts = this._opts('eigenvalues');
      eplot.setOptions({ batchSize: eopts.batchSize, recomputeMs: eopts.recomputeMs });
      this._charts.eigenvalues = eplot;
      this._attachGear(key, cell);
      return;
    }

    // History charts
    const configs = {
      loss:         { id: 'lossPlot',   Cls: LossChart   },
      coefficients: { id: 'coeffPlot',  Cls: CoeffChart  },
      norms:        { id: 'normPlot',   Cls: NormChart   },
      preActLine:   { id: 'preActPlot', Cls: PreActChart },
    };
    const cfg = configs[key];
    if (!cfg) return;

    const cell = this._makeCell(key);
    cell.appendChild(this._makeCanvasBox(cfg.id));
    this._grid.appendChild(cell);
    const chart = new cfg.Cls(cfg.id);

    // Restore per-chart axis state
    const opts = this._opts(key);
    if (opts.logX) chart.setLogScaleX(true);
    if (opts.logY) chart.setLogScaleY(true);
    chart.setEffectiveTime(this.useEffTime, this._eta);

    if (key === 'coefficients' && params)
      chart.setNumTerms(numCoeffTerms(params.targetType, params.numTerms), params.targetType);
    if (key === 'norms' && params)
      chart.setNumTerms(params.numTerms);
    if (key === 'loss' || key === 'coefficients')
      chart.setEmaWindow(this.emaWindow);

    this._charts[key] = chart;
    this._attachGear(key, cell);
  }

  _attachGear(key, cell) {
    const gear = document.createElement('button');
    gear.className = 'plot-gear';
    gear.textContent = '⚙';
    cell.appendChild(gear);

    gear.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_activeMenu) { closeActiveMenu(); return; }
      const fields = this._buildFields(key);
      if (fields.length === 0) gear.classList.add('plot-gear-dim');
      else                     gear.classList.remove('plot-gear-dim');
      openGearMenu(gear, fields);
    });

    // Set initial dim state
    const fields = this._buildFields(key);
    if (fields.length === 0) gear.classList.add('plot-gear-dim');
  }

  // Returns the fields array for the gear menu of a given plot key.
  _buildFields(key) {
    const opts = this._opts(key);
    const save = () => this._saveOpts();
    const fields = [];

    if (HISTORY_PLOTS.has(key)) {
      fields.push({
        type: 'checkbox', label: 'log x', value: opts.logX ?? false,
        onChange: (v) => { opts.logX = v; save(); if (this._charts[key]) this._charts[key].setLogScaleX(v); },
      });
      fields.push({
        type: 'checkbox', label: 'log y', value: opts.logY ?? false,
        onChange: (v) => { opts.logY = v; save(); if (this._charts[key]) this._charts[key].setLogScaleY(v); },
      });
    }

    if (key === 'utility') {
      const BATCH_CHOICES    = [256, 512, 1024, 2048, 4096, 8192].map(v => ({ label: String(v), value: v }));
      const INTERVAL_CHOICES = [250, 500, 1000, 2000, 5000].map(v => ({ label: v + ' ms', value: v }));
      fields.push({
        type: 'select', label: 'batch B', value: opts.batchSize ?? 2048, choices: BATCH_CHOICES,
        onChange: (v) => { opts.batchSize = v; save(); if (this._charts.utility) this._charts.utility.setOptions({ batchSize: v }); },
      });
      fields.push({
        type: 'select', label: 'refresh', value: opts.recomputeMs ?? 1000, choices: INTERVAL_CHOICES,
        onChange: (v) => { opts.recomputeMs = v; save(); if (this._charts.utility) this._charts.utility.setOptions({ recomputeMs: v }); },
      });
    }

    if (key === 'eigenvalues') {
      const BATCH_CHOICES    = [32, 64, 128, 256, 512, 1024].map(v => ({ label: String(v), value: v }));
      const INTERVAL_CHOICES = [500, 1000, 2000, 5000].map(v => ({ label: v + ' ms', value: v }));
      fields.push({
        type: 'select', label: 'batch B', value: opts.batchSize ?? 32, choices: BATCH_CHOICES,
        onChange: (v) => { opts.batchSize = v; save(); if (this._charts.eigenvalues) this._charts.eigenvalues.setOptions({ batchSize: v }); },
      });
      fields.push({
        type: 'select', label: 'refresh', value: opts.recomputeMs ?? 2000, choices: INTERVAL_CHOICES,
        onChange: (v) => { opts.recomputeMs = v; save(); if (this._charts.eigenvalues) this._charts.eigenvalues.setOptions({ recomputeMs: v }); },
      });
    }

    return fields;
  }

  _destroy(key) {
    closeActiveMenu();
    const chart = this._charts[key];
    if (!chart) return;

    if (key === 'weightHists') {
      for (const h of chart) h.destroy();
    } else if (chart.destroy) {
      chart.destroy();
    } else if (chart.chart && chart.chart.destroy) {
      chart.chart.destroy();
    }
    delete this._charts[key];

    if (this._cells[key]) {
      this._cells[key].remove();
      delete this._cells[key];
    }
  }

  _makeCell(key, extraClass = '') {
    const cell = document.createElement('div');
    cell.className = 'plot-cell' + (extraClass ? ' ' + extraClass : '');
    cell.dataset.plotKey = key;
    this._cells[key] = cell;
    return cell;
  }

  _makeWrapper(key) {
    const cell = document.createElement('div');
    cell.className = 'plot-cell-wide';
    cell.dataset.plotKey = key;
    cell.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;';
    this._cells[key] = cell;
    return cell;
  }

  _makeCanvasBox(id) {
    const box = document.createElement('div');
    box.className = 'plot-canvas-box';
    const canvas = document.createElement('canvas');
    canvas.id = id;
    box.appendChild(canvas);
    return box;
  }

  _makeCanvas(id) {
    const box = document.createElement('div');
    box.className = 'plot-canvas-box';
    box.style.cssText = 'flex:1;min-width:180px;';
    const canvas = document.createElement('canvas');
    canvas.id = id;
    box.appendChild(canvas);
    return box;
  }
}

// ============================================================================
// STATE & INSTANCES
// ============================================================================

const appState = new AppState();
appState.load();

const sim = new Simulation();

// ============================================================================
// STARTUP
// ============================================================================

waitForMathJax(() => {
  restoreUI(appState);
  renderNetworkViz(appState);

  const gridEl = document.getElementById('plotsGrid');
  const plotManager = new PlotManager(gridEl, appState);

  // ---- Checkbox wiring -------------------------------------------------------
  for (const key of Object.keys(PLOT_LABELS)) {
    const cb = document.getElementById(`plot-cb-${key}`);
    if (!cb) continue;
    cb.checked = appState.visiblePlots.includes(key);
    cb.addEventListener('change', () => {
      const vis = new Set(appState.visiblePlots);
      cb.checked ? vis.add(key) : vis.delete(key);
      appState.visiblePlots = [...vis];
      appState.save();
      plotManager.sync();
      if (cb.checked && sim.lossHistory.length > 0) plotManager.replayHistory(sim);
    });
  }

  // ---- Simulation lifecycle --------------------------------------------------

  function getCurrentSeed() {
    if (!appState.manualSeed) return null;
    const v = parseInt(document.getElementById('seedInput').value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }

  function buildParams() {
    const T = appState.numTerms;
    const tt = appState.targetType;
    const minD = tt === 'sin2x' ? 2 : tt === 'custom' ? 1 : T;
    const d = Math.max(Math.round(appState.d), minD);
    return {
      n:          Math.round(appState.n),
      d,
      batchSize:  Math.round(appState.batchSize),
      eta:        appState.eta,
      alpha:      appState.alpha,
      activation: appState.activation,
      numTerms:   T,
      targetType: tt,
      seed:       getCurrentSeed(),
    };
  }

  function preSample() {
    const startPauseBtn = document.getElementById('startPauseBtn');
    if (sim.running) { sim.pause(); startPauseBtn.textContent = 'start'; }
    const params = buildParams();
    plotManager.rebuild(params);
    sim.initialize(params);
  }

  sim.onFrameUpdate = () => {
    plotManager.update(sim);
    const el = document.getElementById('stepsPerSec');
    if (el) el.textContent = Math.round(sim.stepsPerSec).toLocaleString();
  };

  // ---- UI bindings -----------------------------------------------------------

  bindUI(appState, {
    onParamChange() {
      if (sim.iteration > 0 || sim.W !== null) preSample();
    },
    onTargetChange() {
      if (sim.iteration > 0 || sim.W !== null) preSample();
    },
    onSimControl: {
      startPause() {
        const btn = document.getElementById('startPauseBtn');
        if (!sim.running) {
          if (sim.iteration === 0) preSample();
          sim.start();
          btn.textContent = 'pause';
        } else {
          sim.pause();
          btn.textContent = 'start';
        }
      },
      reset() {
        sim.pause();
        document.getElementById('startPauseBtn').textContent = 'start';
        preSample();
      },
    },
    onEmaChange(w) {
      plotManager.setEmaWindow(w);
      if (sim.lossHistory.length > 0) plotManager.replayHistory(sim);
    },
  });

  // x-axis step/teff toggle (called from inline onclick in HTML)
  let useEffTime = false;
  function setXAxisMode(mode) {
    useEffTime = (mode === 'teff');
    plotManager.setEffectiveTime(useEffTime, appState.eta);
    document.getElementById('teff-link').classList.toggle('active', useEffTime);
    document.getElementById('step-link').classList.toggle('active', !useEffTime);
    if (sim.lossHistory.length > 0) plotManager.replayHistory(sim);
    return false;
  }
  window.setXAxisMode = setXAxisMode;

  // Initial chart creation and first preSample
  plotManager.sync();
  preSample();
});

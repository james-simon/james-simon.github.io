// ============================================================================
// DLN SHARPNESS — app orchestrator
// ============================================================================

import { AppState } from './state.js';
import { Simulation } from './simulation.js';
import { LossChart, SVChart, WeightNormChart, SharpnessChart } from './charts.js';
import { bindUI, restoreUI, waitForMathJax } from './ui.js';

// ============================================================================
// PLOT DEFINITIONS
// ============================================================================

const PLOT_LABELS = {
  loss:       'loss',
  productSVs: 'singular values of $M = W_1 \\cdots W_L$',
  weightSVs:  'singular values of each $W_k$',
  weightNorms:'Frobenius norms $\\|W_k\\|_F$',
  sharpness:  'sharpness (top Hessian eigenvalues)',
};

// ============================================================================
// GEAR MENU — singleton floating panel
// ============================================================================

let _activeMenu = null;

function closeActiveMenu() {
  if (!_activeMenu) return;
  _activeMenu.el.remove();
  document.removeEventListener('pointerdown', _activeMenu.outside);
  document.removeEventListener('keydown',     _activeMenu.escape);
  _activeMenu = null;
}

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
          opt.value = String(ch.value);
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

  const r  = gearEl.getBoundingClientRect();
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
    this._grid      = gridEl;
    this._state     = appState;
    this._charts    = {};
    this._cells     = {};
    this._simParams = null;  // live reference to sim.params for interval updates
  }

  _opts(key) {
    const po = this._state.plotOptions;
    if (!po[key]) po[key] = {};
    return po[key];
  }
  _saveOpts() { this._state.save(); }

  sync() {
    const visible = new Set(this._state.visiblePlots);
    for (const key of Object.keys(this._charts)) {
      if (!visible.has(key)) this._destroy(key);
    }
    for (const key of visible) {
      if (!this._charts[key]) this._create(key);
    }
    // Re-order to match PLOT_LABELS order
    for (const key of Object.keys(PLOT_LABELS)) {
      if (this._cells[key]) this._grid.appendChild(this._cells[key]);
    }
  }

  rebuild() {
    for (const key of Object.keys(this._charts)) {
      if (key === 'weightSVs') continue;  // rebuilt separately below
      const chart = this._charts[key];
      if (chart && chart.clear) chart.clear();
    }
    // weightSVs uses multiple charts — rebuild entirely
    const visible = new Set(this._state.visiblePlots);
    if (visible.has('weightSVs')) {
      this._destroy('weightSVs');
      this._create('weightSVs');
      for (const key of Object.keys(PLOT_LABELS)) {
        if (this._cells[key]) this._grid.appendChild(this._cells[key]);
      }
    }
  }

  update(sim) {
    if (!sim.params) return;
    const visible = new Set(this._state.visiblePlots);
    const depth = sim.params.depth;

    if (visible.has('loss') && this._charts.loss && sim.lossHistory.length > 0)
      this._charts.loss.update(sim.lossHistory);

    if (visible.has('productSVs') && this._charts.productSVs && sim.productSVHistory.length > 0) {
      const refSVs = sim.getTargetSVs();
      this._charts.productSVs.update(sim.productSVHistory, refSVs);
    }

    if (visible.has('weightSVs') && this._charts.weightSVs) {
      for (let k = 0; k < depth; k++) {
        const ch = this._charts.weightSVs[k];
        if (ch && sim.weightSVHistory[k] && sim.weightSVHistory[k].length > 0)
          ch.update(sim.weightSVHistory[k]);
      }
    }

    if (visible.has('weightNorms') && this._charts.weightNorms && sim.weightNormHistory.length > 0)
      this._charts.weightNorms.update(sim.weightNormHistory, depth);

    if (visible.has('sharpness') && this._charts.sharpness && sim.sharpnessHistory.length > 0)
      this._charts.sharpness.update(sim.sharpnessHistory, sim.params.eta);
  }

  // ---- private ---------------------------------------------------------------

  _create(key) {
    if (key === 'weightSVs') {
      // One chart per layer
      const depth = this._state.depth;
      const wrapper = document.createElement('div');
      wrapper.className = 'plot-cell-wide';
      wrapper.dataset.plotKey = key;
      wrapper.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;';
      this._cells[key] = wrapper;
      this._grid.appendChild(wrapper);

      const charts = [];
      for (let k = 0; k < depth; k++) {
        const id = `weightSVPlot_${k}`;
        const box = document.createElement('div');
        box.className = 'plot-canvas-box';
        box.style.cssText = 'flex:1;min-width:260px;';
        const title = document.createElement('div');
        title.className = 'plot-cell-title';
        title.textContent = `W${k+1} singular values`;
        box.appendChild(title);
        const canvas = document.createElement('canvas');
        canvas.id = id;
        box.appendChild(canvas);
        wrapper.appendChild(box);
        charts.push(new SVChart(id, `σ(W${k+1})`));
        // Restore log scales
        const opts = this._opts(`weightSVs_${k}`);
        if (opts.logX) charts[k].setLogScaleX(true);
        if (opts.logY) charts[k].setLogScaleY(true);
      }
      this._charts.weightSVs = charts;
      this._attachGear(key, wrapper);
      return;
    }

    const cell = document.createElement('div');
    cell.className = 'plot-cell';
    cell.dataset.plotKey = key;
    this._cells[key] = cell;

    const title = document.createElement('div');
    title.className = 'plot-cell-title';

    const box = document.createElement('div');
    box.className = 'plot-canvas-box';
    const canvas = document.createElement('canvas');

    if (key === 'loss') {
      canvas.id = 'lossPlot';
      title.textContent = 'loss';
      box.appendChild(canvas);
      cell.appendChild(title);
      cell.appendChild(box);
      this._grid.appendChild(cell);
      const chart = new LossChart('lossPlot');
      const opts = this._opts(key);
      if (opts.logX) chart.setLogScaleX(true);
      if (opts.logY) chart.setLogScaleY(true);
      this._charts.loss = chart;

    } else if (key === 'productSVs') {
      canvas.id = 'productSVPlot';
      title.textContent = 'product singular values';
      box.appendChild(canvas);
      cell.appendChild(title);
      cell.appendChild(box);
      this._grid.appendChild(cell);
      const chart = new SVChart('productSVPlot', 'σ(W₁⋯Wₐ)');
      const opts = this._opts(key);
      if (opts.logX) chart.setLogScaleX(true);
      if (opts.logY) chart.setLogScaleY(true);
      this._charts.productSVs = chart;

    } else if (key === 'weightNorms') {
      canvas.id = 'weightNormPlot';
      title.textContent = 'weight norms';
      box.appendChild(canvas);
      cell.appendChild(title);
      cell.appendChild(box);
      this._grid.appendChild(cell);
      const chart = new WeightNormChart('weightNormPlot');
      const opts = this._opts(key);
      if (opts.logX) chart.setLogScaleX(true);
      if (opts.logY) chart.setLogScaleY(true);
      this._charts.weightNorms = chart;

    } else if (key === 'sharpness') {
      canvas.id = 'sharpnessPlot';
      title.textContent = 'sharpness';
      box.appendChild(canvas);
      cell.appendChild(title);
      cell.appendChild(box);
      this._grid.appendChild(cell);
      const chart = new SharpnessChart('sharpnessPlot');
      const opts = this._opts(key);
      if (opts.logX) chart.setLogScaleX(true);
      if (opts.logY) chart.setLogScaleY(true);
      this._charts.sharpness = chart;
    }

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
      openGearMenu(gear, fields);
    });
  }

  _buildFields(key) {
    const save = () => this._saveOpts();
    const fields = [];

    if (key === 'weightSVs') return fields;

    const chartKey = { loss: 'loss', productSVs: 'productSVs', weightNorms: 'weightNorms', sharpness: 'sharpness' }[key];
    if (!chartKey) return fields;

    const opts = this._opts(key);
    fields.push({
      type: 'checkbox', label: 'log x', value: opts.logX ?? false,
      onChange: (v) => {
        opts.logX = v; save();
        const ch = this._charts[chartKey];
        if (ch && ch.setLogScaleX) ch.setLogScaleX(v);
      },
    });
    fields.push({
      type: 'checkbox', label: 'log y', value: opts.logY ?? false,
      onChange: (v) => {
        opts.logY = v; save();
        const ch = this._charts[chartKey];
        if (ch && ch.setLogScaleY) ch.setLogScaleY(v);
      },
    });

    if (key === 'sharpness') {
      const INTERVAL_CHOICES = [1, 2, 5, 10, 20, 50, 100, 200, 500].map(v => ({ label: `every ${v}`, value: v }));
      fields.push({
        type: 'select', label: 'compute', value: this._state.hessianInterval,
        choices: INTERVAL_CHOICES,
        onChange: (v) => {
          this._state.hessianInterval = v;
          this._state.save();
          // propagate to live sim params
          if (this._simParams) this._simParams.hessianInterval = v;
        },
      });
    }

    return fields;
  }

  _destroy(key) {
    closeActiveMenu();
    const chart = this._charts[key];
    if (!chart) return;

    if (key === 'weightSVs') {
      for (const ch of chart) ch.destroy();
    } else if (chart.destroy) {
      chart.destroy();
    }
    delete this._charts[key];

    if (this._cells[key]) {
      this._cells[key].remove();
      delete this._cells[key];
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

const appState = new AppState();
appState.load();

const sim = new Simulation();

waitForMathJax(() => {
  restoreUI(appState);

  const gridEl     = document.getElementById('plotsGrid');
  const plotManager = new PlotManager(gridEl, appState);

  // ---- Plot checkbox wiring ------------------------------------------------
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
      // Replay data into newly shown plot
      if (cb.checked && sim.iteration > 0) plotManager.update(sim);
    });
  }

  // ---- Simulation lifecycle ------------------------------------------------

  function buildParams() {
    return {
      depth:           appState.depth,
      width:           appState.width,
      initScale:       appState.initScale,
      eta:             appState.eta,
      hessianInterval: appState.hessianInterval,
      maxStepsPerSec:  appState.maxStepsPerSec,
    };
  }

  function preSample() {
    const btn = document.getElementById('startPauseBtn');
    if (sim.running) { sim.pause(); btn.textContent = 'start'; }
    const params = buildParams();
    appState.depth = params.depth;
    plotManager.rebuild();
    sim.initialize(params);
    plotManager._simParams = sim.params;  // live reference for gear menu updates
  }

  sim.onFrameUpdate = () => {
    plotManager.update(sim);
    const el = document.getElementById('stepsPerSec');
    if (el) el.textContent = Math.round(sim.stepsPerSec).toLocaleString();
  };

  // ---- UI binding ----------------------------------------------------------
  bindUI(appState, {
    onParamChange() {
      // Most sliders take effect on next reset; maxStepsPerSec updates live
      if (sim.params) sim.params.maxStepsPerSec = appState.maxStepsPerSec;
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
        const btn = document.getElementById('startPauseBtn');
        sim.pause();
        btn.textContent = 'start';
        preSample();
      },
    },
  });

  // Initial setup
  plotManager.sync();
  preSample();
});

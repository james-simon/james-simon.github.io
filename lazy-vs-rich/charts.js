// ============================================================================
// CHARTS — weight scatter plot + loss curve
// ============================================================================

const TEAL_RAW   = 'rgba(40, 130, 130, 0.3)';
const TEAL_SOLID = 'rgb(40, 130, 130)';
const RED_DOT    = 'rgba(255, 0, 0, 0.85)';
const BLUE_DOT   = 'rgba(0, 0, 255, 0.85)';
const RED_TEACHER  = 'rgba(255, 0, 0, 0.45)';
const BLUE_TEACHER = 'rgba(0, 0, 255, 0.45)';
const RED_TRACE    = 'rgba(255, 0, 0, 0.2)';
const BLUE_TRACE   = 'rgba(0, 0, 255, 0.2)';
const ZOOM_BUFFER  = 1.2;
const MAX_LOSS_PTS = 1000;

const MONO = 'Monaco, Consolas, "Courier New", monospace';

function formatTick(value) {
  return String(parseFloat(value.toPrecision(12)));
}

// Generate nice tick values for [min, max] with ~targetCount ticks.
// Spacing is always from {1, 2, 5} × 10^k; 0 is always included if in range.
function niceTicks(min, max, targetCount = 6) {
  const range = max - min;
  if (range === 0) return [min];
  const roughStep = range / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / mag;
  const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  const step = nice * mag;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 1e-9; v += step) {
    const rounded = parseFloat(v.toPrecision(10));
    ticks.push(rounded);
  }
  // Ensure 0 is present if in range
  if (min <= 0 && max >= 0 && !ticks.includes(0)) ticks.push(0);
  ticks.sort((a, b) => a - b);
  return ticks;
}

// Chart.js axis plugin: override ticks with niceTicks.
// Must set both value and label — Chart.js 4 passes tick.label (not value) to callback.
const niceTick2DPlugin = {
  id: 'niceTick2D',
  afterBuildTicks(chart) {
    ['x', 'y'].forEach(axisId => {
      const scale = chart.scales[axisId];
      if (!scale) return;
      const vals = niceTicks(scale.min, scale.max, 6);
      scale.ticks = vals.map(v => ({ value: v, label: formatTick(v) }));
    });
  },
  // Prevent Chart.js from regenerating labels and overwriting ours
  afterTickToLabelConversion(chart) {
    ['x', 'y'].forEach(axisId => {
      const scale = chart.scales[axisId];
      if (!scale) return;
      scale.ticks.forEach(tick => {
        if (tick.label === undefined || tick.label === null) {
          tick.label = formatTick(tick.value);
        }
      });
    });
  },
};

// ---- Weight scatter plot (left) -------------------------------------------
export class WeightPlot {
  constructor(canvasId) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'scatter',
      data: { datasets: [] },
      plugins: [niceTick2DPlugin],
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: false,
              generateLabels(chart) {
                // Make a small offscreen canvas with a filled circle for student weights
                const dotCanvas = document.createElement('canvas');
                dotCanvas.width = 10; dotCanvas.height = 10;
                const dc = dotCanvas.getContext('2d');
                dc.fillStyle = 'black';
                dc.beginPath();
                dc.arc(5, 5, 4, 0, Math.PI * 2);
                dc.fill();

                return [
                  {
                    text: 'student weights',
                    pointStyle: dotCanvas,
                    hidden: false,
                    lineWidth: 0,
                    fillStyle: 'rgba(0,0,0,0)',
                    strokeStyle: 'rgba(0,0,0,0)',
                  },
                  {
                    text: 'teacher features',
                    fillStyle: 'rgba(0,0,0,0)',
                    strokeStyle: 'black',
                    pointStyle: 'line',
                    rotation: 0,
                    hidden: false,
                    lineWidth: 2,
                    lineDash: [6, 4],
                  },
                ];
              },
              usePointStyle: true,
              pointStyleWidth: 10,
              font: { size: 12, family: MONO },
            },
          },
          tooltip: { enabled: false },
        },
        scales: {
          x: {
            type: 'linear', min: -3, max: 3,
            title: { display: true, text: 'Wᵢ₁', font: { size: 17, family: MONO } },
            grid: { color: 'rgba(0,0,0,0.08)' },
            ticks: { font: { size: 16, family: MONO } },
          },
          y: {
            type: 'linear', min: -3, max: 3,
            title: { display: true, text: 'Wᵢ₂', font: { size: 17, family: MONO } },
            grid: { color: 'rgba(0,0,0,0.08)' },
            ticks: { font: { size: 16, family: MONO } },
          },
        },
      },
    });
  }

  update(sim) {
    if (!sim.W || !sim.a) return;
    const { W, a, Ws, as, params, weightHistory } = sim;
    const { n, k } = params;

    // Compute auto-zoom range: 1.2x the max absolute coordinate
    let maxCoord = 1;
    for (let i = 0; i < n; i++) {
      maxCoord = Math.max(maxCoord, Math.abs(W[i][0]), Math.abs(W[i][1]));
    }
    for (let j = 0; j < k; j++) {
      maxCoord = Math.max(maxCoord, Math.abs(Ws[j][0]), Math.abs(Ws[j][1]));
    }
    const range = maxCoord * ZOOM_BUFFER;

    // Build per-neuron trace datasets using pre-computed renderIndices from sim
    const hist = weightHistory || [];
    const renderIndices = sim.renderIndices || [];
    const traceDatasets = [];
    if (renderIndices.length > 1 && hist.length > 0) {
      for (let i = 0; i < n; i++) {
        const color = a[i] >= 0 ? RED_TRACE : BLUE_TRACE;
        const pts = renderIndices
          .filter(idx => idx < hist.length)
          .map(idx => ({ x: hist[idx][i][0], y: hist[idx][i][1] }));
        traceDatasets.push({
          type: 'line',
          data: pts,
          borderColor: color,
          borderWidth: 1,
          pointRadius: 0,
          showLine: true,
          tension: 0,
        });
      }
    }

    const redDots = [], blueDots = [];
    for (let i = 0; i < n; i++) {
      (a[i] >= 0 ? redDots : blueDots).push({ x: W[i][0], y: W[i][1] });
    }

    // Teacher rays: dashed lines from origin, extended past plot edge
    const teacherDatasets = [];
    for (let j = 0; j < k; j++) {
      const wx = Ws[j][0], wy = Ws[j][1];
      const len = Math.sqrt(wx*wx + wy*wy) || 1;
      const s = (range * 1.6) / len;
      const color = as[j] >= 0 ? RED_TEACHER : BLUE_TEACHER;
      teacherDatasets.push({
        type: 'line',
        data: [{ x: 0, y: 0 }, { x: wx * s, y: wy * s }],
        borderColor: color,
        borderWidth: 3,
        borderDash: [6, 4],
        pointRadius: 0,
        showLine: true,
      });
    }

    this.chart.options.scales.x.min = -range;
    this.chart.options.scales.x.max =  range;
    this.chart.options.scales.y.min = -range;
    this.chart.options.scales.y.max =  range;

    this.chart.data.datasets = [
      ...teacherDatasets,
      ...traceDatasets,
      { data: redDots,  backgroundColor: RED_DOT,  pointRadius: 5, pointHoverRadius: 5 },
      { data: blueDots, backgroundColor: BLUE_DOT, pointRadius: 5, pointHoverRadius: 5 },
    ];
    this.chart.update('none');
  }

  clear() {
    this.chart.data.datasets = [];
    this.chart.update('none');
  }
}

// ---- Loss chart (right) ----------------------------------------------------
export class LossChart {
  constructor(canvasId) {
    this.logScaleX = false;
    this.logScaleY = false;

    const ctx = document.getElementById(canvasId).getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'loss',
            data: [],
            borderColor: TEAL_SOLID,
            backgroundColor: 'rgba(40,130,130,0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        layout: { padding: { left: 10, right: 20 } },
        scales: {
          x: {
            type: 'linear', min: 0, max: 1000,
            title: { display: true, text: 'step', font: { size: 17, family: MONO } },
            ticks: { maxRotation: 0, font: { size: 16, family: MONO }, callback: formatTick },
            grid: { color: 'rgba(0,0,0,0.08)' },
          },
          y: {
            type: 'linear', min: 0,
            title: { display: true, text: 'loss', font: { size: 17, family: MONO } },
            ticks: { font: { size: 16, family: MONO }, callback: formatTick },
            grid: { color: 'rgba(0,0,0,0.08)' },
          },
        },
      },
    });
  }

  setLogScaleY(on) {
    this.logScaleY = on;
    this.chart.options.scales.y.type = on ? 'logarithmic' : 'linear';
    this.chart.options.scales.y.min  = on ? 1e-6 : 0;
    this.chart.update('none');
  }

  setLogScaleX(on) {
    this.logScaleX = on;
    this.chart.options.scales.x.type = on ? 'logarithmic' : 'linear';
    this.chart.options.scales.x.min  = on ? 1 : 0;
    this.chart.update('none');
  }

  update(lossHistory) {
    if (!lossHistory || lossHistory.length === 0) return;
    let data = lossHistory;
    if (data.length > MAX_LOSS_PTS) {
      const step = Math.ceil(data.length / MAX_LOSS_PTS);
      data = data.filter((_, i) => i % step === 0);
    }
    // x-axis always extends to at least 1000 steps
    const maxStep = data.length > 0 ? data[data.length - 1].x : 0;
    this.chart.options.scales.x.max = Math.max(1000, maxStep);
    this.chart.data.datasets[0].data = data;
    this.chart.update('none');
  }

  clear() {
    this.chart.data.datasets[0].data = [];
    this.chart.options.scales.x.max = 1000;
    this.chart.update('none');
  }
}

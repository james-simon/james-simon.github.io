// ============================================================================
// CHART MANAGEMENT
// ============================================================================
// Handles Chart.js creation and updates - no more duplication!

import { CONFIG } from '../config.js';
import { formatTickLabel } from '../utils/formatters.js';

/**
 * Downsample data for plotting (keep every Nth point)
 * Only downsamples if data exceeds maxDisplayPoints
 */
function downsampleData(data, maxPoints = CONFIG.charts.maxDisplayPoints) {
  if (data.length <= maxPoints) {
    return data;
  }

  const step = Math.ceil(data.length / maxPoints);
  const downsampled = [];

  for (let i = 0; i < data.length; i += step) {
    downsampled.push(data[i]);
  }

  // Always include the last point
  if (downsampled[downsampled.length - 1] !== data[data.length - 1]) {
    downsampled.push(data[data.length - 1]);
  }

  return downsampled;
}

/**
 * Create base chart configuration (shared between loss and parameter charts)
 */
function createBaseChartConfig() {
  return {
    type: 'line',
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        title: { display: false }
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: false },
          ticks: {
            maxRotation: 0,
            font: {
              size: CONFIG.charts.fontSize,
              family: 'Georgia, serif'
            }
          }
        },
        y: {
          title: {
            display: true,
            text: '                    ',  // Invisible placeholder (LaTeX rendered separately)
            font: {
              size: CONFIG.charts.labelFontSize,
              family: 'Georgia, serif'
            }
          },
          beginAtZero: true,
          ticks: {
            font: {
              size: CONFIG.charts.fontSize,
              family: 'Georgia, serif'
            },
            callback: function(value) {
              return formatTickLabel(value, CONFIG.charts.precision);
            }
          }
        }
      }
    }
  };
}

/**
 * Create loss chart
 */
function createLossChart(canvasId) {
  const config = createBaseChartConfig();
  config.data = {
    labels: [],
    datasets: [{
      label: 'loss',
      data: [],
      borderColor: CONFIG.colors.loss,
      borderWidth: CONFIG.charts.lineWidth,
      pointRadius: 0,
      tension: 0
    }]
  };
  // Enable legend for loss chart
  config.options.plugins.legend.display = true;
  config.options.plugins.legend.position = 'top';
  config.options.plugins.legend.labels = {
    font: {
      size: CONFIG.charts.legendFontSize,
      family: 'Georgia, serif',
      style: 'italic'
    },
    usePointStyle: false,
    boxWidth: 20,
    boxHeight: 2,
    padding: 10,
    generateLabels: function(chart) {
      const datasets = chart.data.datasets;
      return datasets.map((dataset, i) => ({
        text: dataset.label,
        fillStyle: dataset.borderColor,
        strokeStyle: dataset.borderColor,
        lineWidth: dataset.borderWidth || CONFIG.charts.lineWidth,
        hidden: false,
        index: i
      }));
    }
  };
  return new Chart(document.getElementById(canvasId).getContext('2d'), config);
}

/**
 * Create parameter chart with legend
 */
function createParameterChart(canvasId) {
  const config = createBaseChartConfig();
  config.data = {
    labels: [],
    datasets: []
  };
  // Enable legend for parameter chart
  config.options.plugins.legend = {
    display: true,
    position: 'top',
    labels: {
      font: {
        size: CONFIG.charts.legendFontSize,
        family: 'Georgia, serif',
        style: 'italic'
      },
      usePointStyle: false,
      boxWidth: 20,
      boxHeight: 2,
      padding: 10,
      generateLabels: function(chart) {
        const datasets = chart.data.datasets;
        const subscripts = ['₁', '₂', '₃', '₄', '₅'];
        let varIndex = 0;
        return datasets.map((dataset, i) => {
          // Check if this is the rise time dataset
          if (dataset.label === 'rise time') {
            return {
              text: 'rise time',
              fillStyle: dataset.borderColor,
              strokeStyle: dataset.borderColor,
              lineWidth: 2,
              hidden: false,
              index: i
            };
          }
          // Otherwise it's a parameter dataset
          const label = {
            text: `a${subscripts[varIndex]}`,  // Unicode subscripts
            fillStyle: dataset.borderColor,
            strokeStyle: dataset.borderColor,
            lineWidth: CONFIG.charts.lineWidth,
            hidden: false,
            index: i
          };
          varIndex++;
          return label;
        });
      }
    }
  };
  return new Chart(document.getElementById(canvasId).getContext('2d'), config);
}

/**
 * Update chart with new data and scale settings
 * Returns computed yMin and yMax for vertical line placement
 */
function updateChart(chart, times, dataArrays, logScale) {
  // Flatten all data to find min/max (avoid spread operator for large arrays)
  const allValues = dataArrays.flat().filter(v => v > 0 || !logScale);
  const maxVal = allValues.reduce((max, v) => Math.max(max, v), -Infinity);
  const minVal = logScale
    ? allValues.filter(v => v > 0).reduce((min, v) => Math.min(min, v), Infinity)
    : 0;

  // Set axis limits based on scale mode
  let yMax, yMin;
  if (logScale) {
    yMax = maxVal * CONFIG.charts.logScalePadding;
    yMin = minVal / CONFIG.charts.logScalePadding;
  } else {
    yMax = maxVal * CONFIG.charts.linearScalePadding;
    yMin = 0;
  }

  // Update chart
  chart.data.labels = times;
  chart.options.scales.y.type = logScale ? 'logarithmic' : 'linear';
  chart.options.scales.y.beginAtZero = !logScale;
  chart.options.scales.y.max = yMax;
  chart.options.scales.y.min = yMin;

  // Update tick callback to hide min/max labels
  chart.options.scales.y.ticks.callback = function(value, index, ticks) {
    // Hide tick if it's at the exact min or max boundary
    if (Math.abs(value - yMax) < 1e-10 || Math.abs(value - yMin) < 1e-10) {
      return '';
    }
    return formatTickLabel(value, CONFIG.charts.precision);
  };

  chart.update('none');

  return { yMin, yMax };
}

/**
 * ChartManager: Manages both charts and coordinates updates
 */
export class ChartManager {
  constructor() {
    this.lossChart = null;
    this.paramChart = null;
  }

  /**
   * Initialize both charts
   */
  init() {
    this.lossChart = createLossChart('lossPlot');
    this.paramChart = createParameterChart('aPlot');
  }

  /**
   * Update charts with simulation results
   */
  update(solution, numVars, logScale, tRise) {
    // Downsample data for plotting
    const times = downsampleData(solution.times);
    const lossValues = downsampleData(solution.lossValues);
    const aTrajectories = solution.aTrajectories.map(traj => downsampleData(traj));

    // Update loss chart (main line)
    this.lossChart.data.datasets[0].data = lossValues;

    // Add vertical line for rise time on loss chart BEFORE updating
    if (tRise && !tRise.isUndefined && isFinite(tRise.value)) {
      // We'll set the y values after we know the range
      this.lossChart.data.datasets[1] = {
        label: 'rise time',
        data: [{x: tRise.value, y: 0}, {x: tRise.value, y: 1}],
        borderColor: 'rgb(128, 128, 128)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        showLine: true
      };
    } else {
      // Remove rise time line if undefined
      if (this.lossChart.data.datasets.length > 1) {
        this.lossChart.data.datasets.splice(1, 1);
      }
    }

    const lossRange = updateChart(this.lossChart, times, [lossValues], logScale);

    // Update t_rise line y values with actual range
    if (tRise && !tRise.isUndefined && isFinite(tRise.value) && this.lossChart.data.datasets[1]) {
      this.lossChart.data.datasets[1].data = [
        {x: tRise.value, y: lossRange.yMin},
        {x: tRise.value, y: lossRange.yMax}
      ];
      this.lossChart.update('none');
    }

    // Update parameter chart (multiple lines)
    this.paramChart.data.datasets = [];
    for (let i = 0; i < numVars; i++) {
      this.paramChart.data.datasets.push({
        label: `a${i+1}`,
        data: aTrajectories[i],
        borderColor: CONFIG.colors.parameters[i],
        borderWidth: CONFIG.charts.lineWidth,
        pointRadius: 0,
        tension: 0
      });
    }

    // Add vertical line for rise time on parameter chart BEFORE updating
    if (tRise && !tRise.isUndefined && isFinite(tRise.value)) {
      this.paramChart.data.datasets.push({
        label: 'rise time',
        data: [{x: tRise.value, y: 0}, {x: tRise.value, y: 1}],
        borderColor: 'rgb(128, 128, 128)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        showLine: true
      });
    }

    const paramRange = updateChart(this.paramChart, times, aTrajectories, logScale);

    // Update rise time line y values with actual range
    if (tRise && !tRise.isUndefined && isFinite(tRise.value)) {
      const triseDataset = this.paramChart.data.datasets[this.paramChart.data.datasets.length - 1];
      if (triseDataset && triseDataset.label === 'rise time') {
        triseDataset.data = [
          {x: tRise.value, y: paramRange.yMin},
          {x: tRise.value, y: paramRange.yMax}
        ];
        this.paramChart.update('none');
      }
    }
  }
}

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
      const labels = datasets.map((dataset, i) => ({
        text: dataset.label,
        fillStyle: dataset.borderColor,
        strokeStyle: dataset.borderColor,
        lineWidth: dataset.borderWidth || CONFIG.charts.lineWidth,
        hidden: false,
        index: i
      }));

      // Move 'eff. bal. init.' to the end (far right)
      const balancedIdx = labels.findIndex(l => l.text === 'eff. bal. init.');
      if (balancedIdx !== -1 && balancedIdx !== labels.length - 1) {
        const balancedLabel = labels.splice(balancedIdx, 1)[0];
        labels.push(balancedLabel);
      }

      return labels;
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
        const labels = [];
        let balancedLabel = null;

        datasets.forEach((dataset, i) => {
          // Check if this is the rise time dataset
          if (dataset.label === 'rise time from theory') {
            labels.push({
              text: 'rise time from theory',
              fillStyle: dataset.borderColor,
              strokeStyle: dataset.borderColor,
              lineWidth: 2,
              hidden: false,
              index: i
            });
            return;
          }
          // Check if it's a balanced init trajectory
          if (dataset.label && dataset.label.includes('eff. bal. init.')) {
            // Only create one label for all balanced trajectories
            if (!balancedLabel) {
              balancedLabel = {
                text: 'eff. bal. init.',
                fillStyle: 'rgb(255, 100, 255)', // Magenta
                strokeStyle: 'rgb(255, 100, 255)',
                lineWidth: CONFIG.charts.lineWidth,
                hidden: false,
                index: i
              };
            }
            return;
          }
          // Otherwise it's a parameter dataset
          labels.push({
            text: `a${subscripts[varIndex]}`,  // Unicode subscripts
            fillStyle: dataset.borderColor,
            strokeStyle: dataset.borderColor,
            lineWidth: CONFIG.charts.lineWidth,
            hidden: false,
            index: i
          });
          varIndex++;
        });

        // Add balanced label at the end (far right)
        if (balancedLabel) {
          labels.push(balancedLabel);
        }

        return labels;
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

  // Set x-axis limits based on actual simulation time range
  const xMin = times[0];
  const xMax = times[times.length - 1];

  // Update chart
  chart.data.labels = times;

  // Set x-axis limits (fixed, not influenced by rise time line)
  chart.options.scales.x.min = xMin;
  chart.options.scales.x.max = xMax;

  // Set y-axis limits
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
  update(solution, numVars, logScale, tRise, balancedSolution = null, showBalanced = true) {
    // Downsample data for plotting
    const times = downsampleData(solution.times);
    const lossValues = downsampleData(solution.lossValues);
    const aTrajectories = solution.aTrajectories.map(traj => downsampleData(traj));

    // Downsample balanced solution if present
    let balancedTimes = null;
    let balancedLossValues = null;
    let balancedATrajectories = null;
    if (balancedSolution) {
      balancedTimes = downsampleData(balancedSolution.times);
      balancedLossValues = downsampleData(balancedSolution.lossValues);
      balancedATrajectories = balancedSolution.aTrajectories.map(traj => downsampleData(traj));
    }

    // Update loss chart (main line)
    this.lossChart.data.datasets[0].data = lossValues;

    // Clear all datasets beyond the main loss line, then rebuild
    this.lossChart.data.datasets.splice(1);

    // Add balanced solution loss curve if available and enabled
    if (balancedSolution && showBalanced) {
      this.lossChart.data.datasets.push({
        label: 'eff. bal. init.',
        data: balancedLossValues.map((val, i) => ({x: balancedTimes[i], y: val})),
        borderColor: 'rgb(255, 100, 255)', // Magenta
        borderWidth: CONFIG.charts.lineWidth,
        borderDash: [5, 5], // Dashed line
        pointRadius: 0,
        tension: 0
      });
    }

    // Add vertical line for rise time on loss chart
    if (tRise && !tRise.isUndefined && isFinite(tRise.value)) {
      // We'll set the y values after we know the range
      this.lossChart.data.datasets.push({
        label: 'rise time from theory',
        data: [{x: tRise.value, y: 0}, {x: tRise.value, y: 1}],
        borderColor: 'rgb(128, 128, 128)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        showLine: true
      });
    }

    // Include balanced loss values in range calculation if present and enabled
    const lossDataArrays = (balancedSolution && showBalanced) ? [lossValues, balancedLossValues] : [lossValues];
    const lossRange = updateChart(this.lossChart, times, lossDataArrays, logScale);

    // Update t_rise line y values with actual range
    if (tRise && !tRise.isUndefined && isFinite(tRise.value)) {
      // Find the rise time dataset (should be the last one)
      const riseTimeDataset = this.lossChart.data.datasets.find(d => d.label === 'rise time from theory');
      if (riseTimeDataset) {
        riseTimeDataset.data = [
          {x: tRise.value, y: lossRange.yMin},
          {x: tRise.value, y: lossRange.yMax}
        ];
        this.lossChart.update('none');
      }
    }

    // Update parameter chart (multiple lines)
    this.paramChart.data.datasets = [];
    for (let i = 0; i < numVars; i++) {
      // Main trajectory (solid)
      this.paramChart.data.datasets.push({
        label: `a${i+1}`,
        data: aTrajectories[i],
        borderColor: CONFIG.colors.parameters[i],
        borderWidth: CONFIG.charts.lineWidth,
        pointRadius: 0,
        tension: 0
      });

      // Balanced trajectory (dashed, magenta)
      if (balancedSolution && showBalanced) {
        this.paramChart.data.datasets.push({
          label: `a${i+1} (eff. bal. init.)`,
          data: balancedATrajectories[i].map((val, j) => ({x: balancedTimes[j], y: val})),
          borderColor: 'rgb(255, 100, 255)', // Magenta
          borderWidth: CONFIG.charts.lineWidth,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0
        });
      }
    }

    // Add vertical line for rise time on parameter chart BEFORE updating
    if (tRise && !tRise.isUndefined && isFinite(tRise.value)) {
      this.paramChart.data.datasets.push({
        label: 'rise time from theory',
        data: [{x: tRise.value, y: 0}, {x: tRise.value, y: 1}],
        borderColor: 'rgb(128, 128, 128)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0,
        showLine: true
      });
    }

    // Include balanced trajectories in range calculation if present and enabled
    const paramDataArrays = (balancedSolution && showBalanced)
      ? aTrajectories.concat(balancedATrajectories)
      : aTrajectories;
    const paramRange = updateChart(this.paramChart, times, paramDataArrays, logScale);

    // Update rise time line y values with actual range
    if (tRise && !tRise.isUndefined && isFinite(tRise.value)) {
      const triseDataset = this.paramChart.data.datasets[this.paramChart.data.datasets.length - 1];
      if (triseDataset && triseDataset.label === 'rise time from theory') {
        triseDataset.data = [
          {x: tRise.value, y: paramRange.yMin},
          {x: tRise.value, y: paramRange.yMax}
        ];
        this.paramChart.update('none');
      }
    }
  }
}

// ============================================================================
// VISUALIZATION - Chart.js loss and norm plotting
// ============================================================================

import { IncrementalCache } from './incremental-cache.js';

// Format tick labels - no commas, just raw numbers
function formatTickLabel(value, precision = 12) {
  // Use toPrecision for small numbers, but ensure no comma formatting
  const formatted = parseFloat(value.toPrecision(precision));
  // Convert to string without locale formatting (no commas)
  return String(formatted);
}

const MAX_PLOT_POINTS = 1000;

export class LossChart {
  constructor(canvasId) {
    this.logScale = false;
    this.logScaleX = false;
    this.useEffectiveTime = false;
    this.eta = 0.01;
    this.emaWindow = 1; // Default: off (no EMA)
    this.showTheory = false; // Default: theory curves hidden

    // Use incremental cache for efficient updates
    this.cache = new IncrementalCache(
      this.emaWindow,
      MAX_PLOT_POINTS,
      'loss',
      { loss: 0.5 } // Initial EMA value
    );

    const ctx = document.getElementById(canvasId).getContext('2d');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Loss (raw)',
            data: [],
            borderColor: 'rgba(40, 130, 130, 0.3)',  // Pale teal for raw data
            backgroundColor: 'rgba(40, 130, 130, 0.05)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            order: 3  // Background
          },
          {
            label: 'exp',
            data: [],
            borderColor: 'rgb(40, 130, 130)',  // Dark teal for EMA
            backgroundColor: 'rgba(40, 130, 130, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            order: 2  // Middle
          },
          {
            label: 'th',
            data: [],
            borderColor: 'rgb(255, 0, 0)',  // Pure red for theory
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            borderWidth: 2,
            borderDash: [8, 4],  // Dashed line
            pointRadius: 0,
            tension: 0,
            order: 1  // Top
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            type: 'linear',
            min: 0,
            ticks: {
              maxRotation: 0,
              font: {
                size: 14,
                family: 'Monaco, Consolas, "Courier New", monospace'
              },
              callback: function(value) {
                return formatTickLabel(value);
              }
            }
          },
          y: {
            type: 'linear',
            beginAtZero: true,
            ticks: {
              font: {
                size: 14,
                family: 'Monaco, Consolas, "Courier New", monospace'
              },
              callback: function(value) {
                return formatTickLabel(value);
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: false,
              boxWidth: 40,
              boxHeight: 2,
              font: {
                size: 12,
                family: 'Monaco, Consolas, "Courier New", monospace'
              },
              generateLabels: function(chart) {
                const datasets = chart.data.datasets;
                const labels = [];

                // Add exp first (index 1)
                if (datasets[1]) {
                  const meta1 = chart.getDatasetMeta(1);
                  labels.push({
                    text: datasets[1].label,
                    fillStyle: datasets[1].borderColor,
                    strokeStyle: datasets[1].borderColor,
                    lineWidth: datasets[1].borderWidth || 2,
                    lineDash: datasets[1].borderDash || [],
                    hidden: !meta1 || meta1.hidden,
                    datasetIndex: 1
                  });
                }

                // Add theory second (index 2), only if enabled
                if (datasets[2] && chart._showTheory) {
                  const meta2 = chart.getDatasetMeta(2);
                  labels.push({
                    text: datasets[2].label,
                    fillStyle: datasets[2].borderColor,
                    strokeStyle: datasets[2].borderColor,
                    lineWidth: datasets[2].borderWidth || 2,
                    lineDash: datasets[2].borderDash || [],
                    hidden: !meta2 || meta2.hidden,
                    datasetIndex: 2
                  });
                }

                return labels;
              }
            }
          }
        }
      }
    });
  }

  // Toggle log scale y-axis
  setLogScale(useLog) {
    this.logScale = useLog;
    this.chart.options.scales.y.type = useLog ? 'logarithmic' : 'linear';
    this.chart.update('none');
  }

  // Toggle log scale x-axis
  setLogScaleX(useLogX) {
    this.logScaleX = useLogX;
    this.chart.options.scales.x.type = useLogX ? 'logarithmic' : 'linear';

    // Set appropriate min based on mode
    if (useLogX) {
      this.chart.options.scales.x.min = this.useEffectiveTime ? 5 : 1;
    } else {
      this.chart.options.scales.x.min = 0;
    }

    this.chart.update('none');
  }

  // Toggle effective time
  setEffectiveTime(useEffTime, eta) {
    this.useEffectiveTime = useEffTime;
    this.eta = eta;

    // Update x-axis min if logscale is enabled
    if (this.logScaleX) {
      this.chart.options.scales.x.min = useEffTime ? 5 : 1;
    }

    // Update x-axis tick formatting based on mode
    const chart = this.chart;
    if (useEffTime) {
      // For effective time: show 2 decimal places on the rightmost tick only
      this.chart.options.scales.x.ticks.callback = function(value, index, ticks) {
        // Check if this is the last (rightmost) tick
        if (index === ticks.length - 1) {
          return value.toFixed(2);
        }
        return formatTickLabel(value);
      };
    } else {
      // For step count: use standard formatting
      this.chart.options.scales.x.ticks.callback = function(value) {
        return formatTickLabel(value);
      };
    }
  }

  // Set EMA window
  setEmaWindow(window) {
    this.emaWindow = window;
    this.cache.setEmaWindow(window);
  }

  // Update initial EMA value (call when numTerms changes)
  setInitialLoss(initialLoss) {
    this.cache.initEmaValues = { loss: initialLoss };
    this.cache.lastEmaValues = { loss: initialLoss };
  }

  // Toggle theory curve visibility
  setShowTheory(show) {
    this.showTheory = show;
    this.chart._showTheory = show;
  }

  // Update chart with new loss history
  update(lossHistory, theoryLossHistory = [], eta = this.eta) {
    if (lossHistory.length === 0) return;

    // Use the provided eta (from simulation params) if given
    this.eta = eta;

    // Update cache incrementally (O(new points) instead of O(n))
    const { downsampledRaw, downsampledSmoothed, max } = this.cache.update(lossHistory);

    // Convert to chart format
    const rawData = downsampledRaw.map(point => ({
      x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
      y: point.loss
    }));
    this.chart.data.datasets[0].data = rawData;

    // Plot EMA if enabled, otherwise style raw data as the main line
    if (this.emaWindow > 1) {
      const smoothedData = downsampledSmoothed.map(point => ({
        x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
        y: point.loss
      }));
      this.chart.data.datasets[1].data = smoothedData;
      this.chart.data.datasets[1].hidden = false;
      // Make raw data pale when EMA is shown
      this.chart.data.datasets[0].borderColor = 'rgba(40, 130, 130, 0.3)';
      this.chart.data.datasets[0].backgroundColor = 'rgba(40, 130, 130, 0.05)';
    } else {
      // Hide EMA dataset when disabled
      this.chart.data.datasets[1].data = [];
      this.chart.data.datasets[1].hidden = true;
      // Make raw data dark when EMA is off
      this.chart.data.datasets[0].borderColor = 'rgb(40, 130, 130)';
      this.chart.data.datasets[0].backgroundColor = 'rgba(40, 130, 130, 0.1)';
    }

    // Plot theory curve if available and enabled
    let theoryMaxX = 0;
    let theoryMaxLoss = 0;
    if (theoryLossHistory && theoryLossHistory.length > 0 && this.showTheory) {
      const theoryData = theoryLossHistory.map(point => ({
        x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
        y: point.loss
      }));
      this.chart.data.datasets[2].data = theoryData;
      this.chart.data.datasets[2].hidden = false;

      // Get max x and max loss from theory data
      const lastTheoryPoint = theoryLossHistory[theoryLossHistory.length - 1];
      theoryMaxX = this.useEffectiveTime ? lastTheoryPoint.iteration * this.eta : lastTheoryPoint.iteration;
      theoryMaxLoss = Math.max(...theoryLossHistory.map(p => p.loss));
    } else {
      this.chart.data.datasets[2].data = [];
      this.chart.data.datasets[2].hidden = true;
    }

    // Set x-axis max to maximum of experiment and theory times
    const currentIteration = lossHistory[lossHistory.length - 1].iteration;
    const currentMax = this.useEffectiveTime ? currentIteration * this.eta : currentIteration;
    this.chart.options.scales.x.max = Math.max(currentMax, theoryMaxX);

    // Set y-axis max using cached max (O(1) instead of O(n))
    // Include theory max if theory is shown
    if (!this.logScale) {
      const maxLoss = Math.max(max.loss, theoryMaxLoss);
      const yMax = maxLoss * 1.4;
      this.chart.options.scales.y.max = yMax;

      // Update tick callback to hide max label
      this.chart.options.scales.y.ticks.callback = function(value, index, ticks) {
        // Hide tick if it's at the exact max boundary
        if (Math.abs(value - yMax) < 1e-10) {
          return '';
        }
        return formatTickLabel(value);
      };
    } else {
      // For log scale, let Chart.js auto-scale
      this.chart.options.scales.y.max = undefined;
      // Reset callback for log scale
      this.chart.options.scales.y.ticks.callback = function(value) {
        return formatTickLabel(value);
      };
    }

    this.chart.update('none');
  }

  // Clear chart
  clear() {
    this.chart.data.datasets[0].data = [];
    this.chart.data.datasets[1].data = [];
    this.chart.data.datasets[2].data = [];
    this.chart.options.scales.x.max = undefined;
    this.cache.clear();
    this.chart.update('none');
  }

  // Store theory data for replotting when toggling visibility
  storeTheoryData(theoryLossHistory) {
    this.theoryLossHistory = theoryLossHistory || [];
  }
}

export class NormChart {
  constructor(canvasId) {
    this.logScale = false;
    this.logScaleX = false;
    this.useEffectiveTime = false;
    this.eta = 0.01;
    this.emaWindow = 1; // Default: off (no EMA)
    this.showTheory = false; // Default: theory curves hidden
    this.d = 3; // Will be updated when simulation starts
    this.cache = null; // Will be initialized when d is known

    const ctx = document.getElementById(canvasId).getContext('2d');

    // Start with empty datasets - will be populated dynamically
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            type: 'linear',
            min: 0,
            ticks: {
              maxRotation: 0,
              font: {
                size: 14,
                family: 'Monaco, Consolas, "Courier New", monospace'
              },
              callback: function(value) {
                return formatTickLabel(value);
              }
            }
          },
          y: {
            type: 'linear',
            beginAtZero: true,
            ticks: {
              font: {
                size: 14,
                family: 'Monaco, Consolas, "Courier New", monospace'
              },
              callback: function(value) {
                return formatTickLabel(value);
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: false,
              boxWidth: 40,
              boxHeight: 2,
              font: {
                size: 12,
                family: 'Monaco, Consolas, "Courier New", monospace'
              },
              generateLabels: function(chart) {
                if (!chart.data || !chart.data.datasets) {
                  return [];
                }

                const labels = [];
                chart.data.datasets.forEach((dataset, i) => {
                  // Skip theory datasets (those with "theory" in label)
                  if (dataset.label && dataset.label.toLowerCase().includes('theory')) {
                    return;
                  }

                  labels.push({
                    text: dataset.label,
                    fillStyle: dataset.borderColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: dataset.borderWidth || 2,
                    hidden: false,
                    datasetIndex: i
                  });
                });

                return labels;
              }
            }
          }
        }
      }
    });
  }

  // Toggle log scale y-axis
  setLogScale(useLog) {
    this.logScale = useLog;
    this.chart.options.scales.y.type = useLog ? 'logarithmic' : 'linear';
    this.chart.update('none');
  }

  // Toggle log scale x-axis
  setLogScaleX(useLogX) {
    this.logScaleX = useLogX;
    this.chart.options.scales.x.type = useLogX ? 'logarithmic' : 'linear';

    // Set appropriate min based on mode
    if (useLogX) {
      this.chart.options.scales.x.min = this.useEffectiveTime ? 5 : 1;
    } else {
      this.chart.options.scales.x.min = 0;
    }

    this.chart.update('none');
  }

  // Toggle effective time
  setEffectiveTime(useEffTime, eta) {
    this.useEffectiveTime = useEffTime;
    this.eta = eta;

    // Update x-axis min if logscale is enabled
    if (this.logScaleX) {
      this.chart.options.scales.x.min = useEffTime ? 5 : 1;
    }

    // Update x-axis tick formatting based on mode
    const chart = this.chart;
    if (useEffTime) {
      // For effective time: show 2 decimal places on the rightmost tick only
      this.chart.options.scales.x.ticks.callback = function(value, index, ticks) {
        // Check if this is the last (rightmost) tick
        if (index === ticks.length - 1) {
          return value.toFixed(2);
        }
        return formatTickLabel(value);
      };
    } else {
      // For step count: use standard formatting
      this.chart.options.scales.x.ticks.callback = function(value) {
        return formatTickLabel(value);
      };
    }
  }

  // Set EMA window (not used for NormChart - included for compatibility)
  setEmaWindow(window) {
    // NormChart doesn't use EMA - curves are already smooth
  }

  // Toggle theory curve visibility
  setShowTheory(show) {
    this.showTheory = show;
  }

  // Initialize datasets for given d
  initializeDatasets(d) {
    const datasets = [];

    // Rainbow color palette for W1 diagonal elements (visible on white background)
    const w1Colors = [
      'rgb(220, 50, 50)',    // Red
      'rgb(230, 120, 30)',   // Orange
      'rgb(200, 160, 20)',   // Gold
      'rgb(80, 180, 80)',    // Green
      'rgb(50, 140, 220)',   // Blue
      'rgb(150, 80, 200)',   // Purple
      'rgb(200, 80, 140)'    // Pink/Magenta
    ];

    // Create experimental datasets (thicker lines)
    for (let i = 0; i < d; i++) {
      const color = w1Colors[i % w1Colors.length];
      const rgbaMatch = color.match(/rgb\((\d+), (\d+), (\d+)\)/);
      const [r, g, b] = rgbaMatch.slice(1).map(Number);

      // Convert to subscript Unicode
      const idx = (i+1).toString().split('').map(digit => String.fromCharCode(0x2080 + parseInt(digit))).join('');

      datasets.push({
        label: `W₁,${idx}${idx}`,
        data: [],
        borderColor: color,
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.1)`,
        borderWidth: 3,  // Thicker for exp
        pointRadius: 0,
        tension: 0
      });
    }

    // Add W1 cross-term dataset if d >= 2 - dark gray (exp, thicker)
    if (d >= 2) {
      datasets.push({
        label: 'W₁,₁₂',
        data: [],
        borderColor: 'rgb(80, 80, 80)',
        backgroundColor: 'rgba(80, 80, 80, 0.1)',
        borderWidth: 3,  // Thicker for exp
        pointRadius: 0,
        tension: 0
      });
    }

    // Add W2 norm dataset - slate grey (exp, thicker)
    datasets.push({
      label: '√k·||W₂||',
      data: [],
      borderColor: 'rgb(112, 128, 144)',
      backgroundColor: 'rgba(112, 128, 144, 0.1)',
      borderWidth: 3,  // Thicker for exp
      pointRadius: 0,
      tension: 0
    });

    // Create theory datasets (thinner, dashed, same colors, not in legend)
    for (let i = 0; i < d; i++) {
      const color = w1Colors[i % w1Colors.length];

      datasets.push({
        label: `W₁,${(i+1)} theory`,  // Label not shown in legend
        data: [],
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 1.5,  // Thinner for theory
        borderDash: [4, 4],  // Dashed
        pointRadius: 0,
        tension: 0
      });
    }

    // Add W2 theory dataset
    datasets.push({
      label: 'W₂ theory',  // Label not shown in legend
      data: [],
      borderColor: 'rgb(112, 128, 144)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,  // Thinner for theory
      borderDash: [4, 4],  // Dashed
      pointRadius: 0,
      tension: 0
    });

    this.chart.data.datasets = datasets;
  }

  // Update chart with new norm history
  update(normHistory, theoryNormHistory = [], d = this.d, eta = this.eta) {
    if (normHistory.length === 0) return;

    // Use the provided eta (from simulation params) if given
    this.eta = eta;

    // Initialize or reinitialize if d changed
    if (this.d !== d || !this.cache) {
      this.d = d;

      // Build list of series names and initial EMA values
      const seriesNames = [];
      const initEmaValues = {};
      for (let i = 0; i < d; i++) {
        seriesNames.push(`w1_${i}`);
        initEmaValues[`w1_${i}`] = 1; // W1 diagonal elements init to 1
      }
      // Add cross-term if d >= 2
      if (d >= 2) {
        seriesNames.push('w1_cross');
        initEmaValues['w1_cross'] = 0; // Cross-term init to 0
      }
      seriesNames.push('w2NormNormalized');
      initEmaValues['w2NormNormalized'] = 0;

      // Don't use EMA for this chart
      this.cache = new IncrementalCache(
        1, // No EMA
        MAX_PLOT_POINTS,
        seriesNames,
        initEmaValues
      );

      this.initializeDatasets(d);
    }

    // Update cache incrementally (no EMA smoothing)
    const { downsampledRaw, max } = this.cache.update(normHistory);

    // Update all W1 diagonal datasets
    for (let i = 0; i < d; i++) {
      const seriesKey = `w1_${i}`;
      const data = downsampledRaw.map(point => ({
        x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
        y: point[seriesKey]
      }));
      this.chart.data.datasets[i].data = data;
    }

    // Update W1 cross-term dataset (if d >= 2)
    let crossTermOffset = 0;
    if (d >= 2) {
      const crossData = downsampledRaw.map(point => ({
        x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
        y: point.w1_cross || 0
      }));
      this.chart.data.datasets[d].data = crossData;
      crossTermOffset = 1;
    }

    // Update W2 norm dataset (offset by 1 if cross-term exists)
    const w2Data = downsampledRaw.map(point => ({
      x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
      y: point.w2NormNormalized
    }));
    this.chart.data.datasets[d + crossTermOffset].data = w2Data;

    // Update theory datasets if available and enabled
    // Theory datasets start after: d diagonals + (cross-term if d>=2) + W2 norm
    const theoryStartIdx = d + crossTermOffset + 1;

    if (theoryNormHistory && theoryNormHistory.length > 0 && this.showTheory) {
      // Theory W1 diagonals
      for (let i = 0; i < d; i++) {
        const seriesKey = `w1_${i}`;
        const theoryData = theoryNormHistory.map(point => ({
          x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
          y: point[seriesKey]
        }));
        this.chart.data.datasets[theoryStartIdx + i].data = theoryData;
      }

      // Theory W2 norm (after theory W1 diagonals)
      const theoryW2Data = theoryNormHistory.map(point => ({
        x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
        y: point.w2NormNormalized
      }));
      this.chart.data.datasets[theoryStartIdx + d].data = theoryW2Data;
    } else {
      // Clear theory datasets (d W1 diagonals + 1 W2 norm)
      for (let i = 0; i < d + 1; i++) {
        this.chart.data.datasets[theoryStartIdx + i].data = [];
      }
    }

    // Set x-axis max (include theory if shown)
    const currentIteration = normHistory[normHistory.length - 1].iteration;
    let currentMax = this.useEffectiveTime ? currentIteration * this.eta : currentIteration;

    if (theoryNormHistory && theoryNormHistory.length > 0 && this.showTheory) {
      const theoryMaxIteration = theoryNormHistory[theoryNormHistory.length - 1].iteration;
      const theoryMax = this.useEffectiveTime ? theoryMaxIteration * this.eta : theoryMaxIteration;
      currentMax = Math.max(currentMax, theoryMax);
    }

    this.chart.options.scales.x.max = currentMax;

    // Set y-axis max (include theory curve range if shown)
    if (!this.logScale) {
      let maxVal = 0;

      // Check if this is preview mode (only 1 experimental data point)
      const isPreviewMode = normHistory.length === 1;

      if (!isPreviewMode) {
        // Normal mode: use experimental data max
        for (let i = 0; i < d; i++) {
          const val = max[`w1_${i}`];
          if (isFinite(val)) {
            maxVal = Math.max(maxVal, val);
          }
        }
        // Include cross-term if d >= 2
        if (d >= 2 && max.w1_cross !== undefined && isFinite(max.w1_cross)) {
          maxVal = Math.max(maxVal, Math.abs(max.w1_cross));
        }
        if (isFinite(max.w2NormNormalized)) {
          maxVal = Math.max(maxVal, max.w2NormNormalized);
        }
      }

      // Also check theory data if shown - we want to see the full theory curves
      if (theoryNormHistory && theoryNormHistory.length > 0 && this.showTheory) {
        for (let i = 0; i < theoryNormHistory.length; i++) {
          const point = theoryNormHistory[i];
          for (let j = 0; j < d; j++) {
            maxVal = Math.max(maxVal, point[`w1_${j}`] || 0);
          }
          maxVal = Math.max(maxVal, point.w2NormNormalized || 0);
        }
      }

      const yMax = maxVal * 1.4;
      this.chart.options.scales.y.max = yMax;

      this.chart.options.scales.y.ticks.callback = function(value, index, ticks) {
        if (Math.abs(value - yMax) < 1e-10) {
          return '';
        }
        return formatTickLabel(value);
      };
    } else {
      this.chart.options.scales.y.max = undefined;
      this.chart.options.scales.y.ticks.callback = function(value) {
        return formatTickLabel(value);
      };
    }

    this.chart.update('none');
  }

  // Clear chart
  clear() {
    for (let i = 0; i < this.chart.data.datasets.length; i++) {
      this.chart.data.datasets[i].data = [];
    }
    this.chart.options.scales.x.max = undefined;
    if (this.cache) {
      this.cache.clear();
    }
    this.chart.update('none');
  }
}

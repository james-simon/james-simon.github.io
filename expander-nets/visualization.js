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
    this.useEffectiveTime = false;
    this.eta = 0.01;
    this.emaWindow = 1; // Default: off (no EMA)

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
            order: 2  // Draw in background
          },
          {
            label: 'Loss (EMA)',
            data: [],
            borderColor: 'rgb(40, 130, 130)',  // Dark teal for EMA
            backgroundColor: 'rgba(40, 130, 130, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            order: 1  // Draw on top
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
            display: false
          }
        }
      }
    });
  }

  // Toggle log scale
  setLogScale(useLog) {
    this.logScale = useLog;
    this.chart.options.scales.y.type = useLog ? 'logarithmic' : 'linear';
    this.chart.update('none');
  }

  // Toggle effective time
  setEffectiveTime(useEffTime, eta) {
    this.useEffectiveTime = useEffTime;
    this.eta = eta;

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

  // Update chart with new loss history
  update(lossHistory) {
    if (lossHistory.length === 0) return;

    // Update cache incrementally (O(new points) instead of O(n))
    const { downsampledRaw, downsampledSmoothed, max } = this.cache.update(lossHistory);

    // Convert to chart format
    const rawData = downsampledRaw.map(point => ({
      x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
      y: point.loss
    }));
    this.chart.data.datasets[0].data = rawData;

    // Plot EMA if enabled
    if (this.emaWindow > 1) {
      const smoothedData = downsampledSmoothed.map(point => ({
        x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
        y: point.loss
      }));
      this.chart.data.datasets[1].data = smoothedData;
      this.chart.data.datasets[1].hidden = false;
    } else {
      // Hide EMA dataset when disabled
      this.chart.data.datasets[1].data = [];
      this.chart.data.datasets[1].hidden = true;
    }

    // Set x-axis max to current iteration count (or effective time)
    const currentIteration = lossHistory[lossHistory.length - 1].iteration;
    const currentMax = this.useEffectiveTime ? currentIteration * this.eta : currentIteration;
    this.chart.options.scales.x.max = currentMax;

    // Set y-axis max using cached max (O(1) instead of O(n))
    if (!this.logScale) {
      const maxLoss = max.loss;
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
    this.chart.options.scales.x.max = undefined;
    this.cache.clear();
    this.chart.update('none');
  }
}

export class NormChart {
  constructor(canvasId) {
    this.logScale = false;
    this.useEffectiveTime = false;
    this.eta = 0.01;
    this.emaWindow = 1; // Default: off (no EMA)
    this.d = 3; // Will be updated when simulation starts

    // Use incremental cache for efficient updates
    this.cache = new IncrementalCache(
      this.emaWindow,
      MAX_PLOT_POINTS,
      ['w1NormSq', 'w2NormSq'],
      { w1NormSq: this.d, w2NormSq: 0 } // Initial EMA values
    );

    const ctx = document.getElementById(canvasId).getContext('2d');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: '||W₁||² (raw)',
            data: [],
            borderColor: 'rgba(204, 85, 85, 0.3)',  // Pale red for raw
            backgroundColor: 'rgba(204, 85, 85, 0.05)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            order: 4  // Background
          },
          {
            label: '||W₁||² (EMA)',
            data: [],
            borderColor: 'rgb(204, 85, 85)',  // Full red for EMA
            backgroundColor: 'rgba(204, 85, 85, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            order: 2  // Foreground
          },
          {
            label: 'k·||W₂||² (raw)',
            data: [],
            borderColor: 'rgba(153, 85, 204, 0.3)',  // Pale purple for raw
            backgroundColor: 'rgba(153, 85, 204, 0.05)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            order: 3  // Background
          },
          {
            label: 'k·||W₂||² (EMA)',
            data: [],
            borderColor: 'rgb(153, 85, 204)',  // Full purple for EMA
            backgroundColor: 'rgba(153, 85, 204, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            order: 1  // Foreground
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
            display: false
          }
        }
      }
    });
  }

  // Toggle log scale
  setLogScale(useLog) {
    this.logScale = useLog;
    this.chart.options.scales.y.type = useLog ? 'logarithmic' : 'linear';
    this.chart.update('none');
  }

  // Toggle effective time
  setEffectiveTime(useEffTime, eta) {
    this.useEffectiveTime = useEffTime;
    this.eta = eta;

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

  // Update chart with new norm history
  update(normHistory, d = this.d) {
    if (normHistory.length === 0) return;

    // Update d and cache initial values if changed
    if (this.d !== d) {
      this.d = d;
      this.cache.initEmaValues = { w1NormSq: d, w2NormSq: 0 };
      this.cache.clear(); // Force rebuild with new init values
    }

    // Update cache incrementally (O(new points) instead of O(n))
    const { downsampledRaw, downsampledSmoothed, max } = this.cache.update(normHistory);

    // Convert to chart format - raw data
    const w1RawData = downsampledRaw.map(point => ({
      x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
      y: point.w1NormSq
    }));

    const w2RawData = downsampledRaw.map(point => ({
      x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
      y: point.w2NormSq
    }));

    this.chart.data.datasets[0].data = w1RawData;
    this.chart.data.datasets[2].data = w2RawData;

    // Plot EMA if enabled
    if (this.emaWindow > 1) {
      const w1SmoothData = downsampledSmoothed.map(point => ({
        x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
        y: point.w1NormSq
      }));

      const w2SmoothData = downsampledSmoothed.map(point => ({
        x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
        y: point.w2NormSq
      }));

      this.chart.data.datasets[1].data = w1SmoothData;
      this.chart.data.datasets[3].data = w2SmoothData;
      this.chart.data.datasets[1].hidden = false;
      this.chart.data.datasets[3].hidden = false;
    } else {
      // Hide EMA datasets when disabled
      this.chart.data.datasets[1].data = [];
      this.chart.data.datasets[3].data = [];
      this.chart.data.datasets[1].hidden = true;
      this.chart.data.datasets[3].hidden = true;
    }

    // Set x-axis max to current iteration count (or effective time)
    const currentIteration = normHistory[normHistory.length - 1].iteration;
    const currentMax = this.useEffectiveTime ? currentIteration * this.eta : currentIteration;
    this.chart.options.scales.x.max = currentMax;

    // Set y-axis max using cached max (O(1) instead of O(n))
    if (!this.logScale) {
      const maxNorm = Math.max(max.w1NormSq, max.w2NormSq);
      const yMax = maxNorm * 1.4;
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
    this.chart.data.datasets[3].data = [];
    this.chart.options.scales.x.max = undefined;
    this.cache.clear();
    this.chart.update('none');
  }
}

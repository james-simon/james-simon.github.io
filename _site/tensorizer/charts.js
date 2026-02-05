// ============================================================================
// CHART UTILITIES
// ============================================================================

// Downsample data array to maxPoints using stable interval-based sampling
// Interval doubles when data doubles (uses powers of 2), preventing flicker
// Only samples at regular intervals - does NOT include the last point unless it falls on the grid
function downsampleData(data, maxPoints) {
  if (data.length <= maxPoints) {
    return data;
  }

  // Calculate stable sampling interval as the largest power of 2 that keeps points <= maxPoints
  // interval = 2^floor(log2(data.length / maxPoints))
  // This ensures interval only changes when data crosses power-of-2 boundaries
  const ratio = data.length / maxPoints;
  const interval = Math.max(1, Math.pow(2, Math.floor(Math.log2(ratio))));

  const result = [];

  // Sample at regular intervals starting from index 0
  // This ensures the same historical points are always sampled as data grows
  for (let i = 0; i < data.length; i += interval) {
    result.push(data[i]);
  }

  return result;
}

// Calculate smart tick step for x-axis based on max iteration
// Choose largest value from [1, 2, 5, 10, 20, 50, 100, ...] that gives at least 4 ticks
function calculateTickStep(maxIteration) {
  if (maxIteration === 0) return 1;

  // Target at least 4 labeled ticks
  const maxTickStep = maxIteration / 4;

  // Generate candidates: [1, 2, 5] * 10^k for all relevant powers
  const candidates = [];
  for (let power = 0; power <= Math.ceil(Math.log10(maxIteration)); power++) {
    const base = Math.pow(10, power);
    candidates.push(1 * base, 2 * base, 5 * base);
  }

  // Find largest candidate that's <= maxTickStep
  let tickStep = 1;
  for (const candidate of candidates) {
    if (candidate <= maxTickStep) {
      tickStep = candidate;
    } else {
      break;
    }
  }

  return tickStep;
}

// Create a line chart with common configuration
function createLineChart(canvasId, options = {}) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  const defaultOptions = {
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
          title: {
            display: true,
            text: options.xAxisLabel || 'step',
            font: {
              size: 15,
              family: 'Georgia, serif'
            }
          },
          ticks: {
            maxRotation: 0,
            font: {
              size: 14,
              family: 'Georgia, serif'
            }
          }
        },
        y: {
          title: {
            display: true,
            text: options.yAxisLabel || '                    ',
            font: {
              size: 15,
              family: 'Georgia, serif'
            }
          },
          beginAtZero: true,
          ticks: {
            font: {
              size: 14,
              family: 'Georgia, serif'
            }
          }
        }
      },
      plugins: {
        legend: {
          display: options.showLegend || false
        },
        title: {
          display: false
        }
      }
    }
  };

  return new Chart(ctx, defaultOptions);
}

// Initialize side panel loss chart
function initializeSidePanelLossChart() {
  return createLineChart('sidePanelLossCanvas', {
    xAxisLabel: 'step',
    yAxisLabel: '                    ',  // Invisible placeholder (LaTeX rendered separately)
    showLegend: false
  });
}

// Initialize side panel SV chart
function initializeSidePanelSVChart() {
  return createLineChart('sidePanelSVCanvas', {
    xAxisLabel: 'step',
    yAxisLabel: 'value',
    showLegend: false
  });
}

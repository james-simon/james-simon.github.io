// ============================================================================
// CHART UTILITIES
// ============================================================================

// Calculate smart tick step for x-axis based on max iteration
function calculateTickStep(maxIteration) {
  if (maxIteration <= 10) return 1;
  if (maxIteration <= 50) return 10;
  if (maxIteration <= 100) return 20;
  if (maxIteration <= 500) return 100;
  if (maxIteration <= 1000) return 200;
  if (maxIteration <= 5000) return 1000;
  return 2000;
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
              size: 15
            }
          },
          ticks: {
            callback: function(value, index, values) {
              return value;
            },
            autoSkip: false,
            maxRotation: 0,
            font: {
              size: 14
            }
          }
        },
        y: {
          title: {
            display: true,
            text: options.yAxisLabel || '                    ',
            font: {
              size: 15
            }
          },
          beginAtZero: true,
          ticks: {
            font: {
              size: 14
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

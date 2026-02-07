// ============================================================================
// VISUALIZATION - Chart.js loss and norm plotting
// ============================================================================

// Format tick labels (copied from low-dim-flows)
function formatTickLabel(value, precision = 12) {
  return parseFloat(value.toPrecision(precision)).toString();
}

export class LossChart {
  constructor(canvasId) {
    this.logScale = false;
    this.useEffectiveTime = false;
    this.eta = 0.01;
    const ctx = document.getElementById(canvasId).getContext('2d');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Loss',
          data: [],
          borderColor: '#5578cc',
          backgroundColor: 'rgba(85, 120, 204, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0
        }]
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
                family: 'Georgia, serif'
              }
            }
          },
          y: {
            type: 'linear',
            beginAtZero: true,
            ticks: {
              font: {
                size: 14,
                family: 'Georgia, serif'
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
  }

  // Update chart with new loss history
  update(lossHistory) {
    const data = lossHistory.map(point => ({
      x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
      y: point.loss
    }));

    this.chart.data.datasets[0].data = data;

    // Set x-axis max to current iteration count (or effective time)
    if (lossHistory.length > 0) {
      const currentIteration = lossHistory[lossHistory.length - 1].iteration;
      const currentMax = this.useEffectiveTime ? currentIteration * this.eta : currentIteration;
      this.chart.options.scales.x.max = currentMax;
    }

    this.chart.update('none');
  }

  // Clear chart
  clear() {
    this.chart.data.datasets[0].data = [];
    this.chart.options.scales.x.max = undefined;
    this.chart.update('none');
  }
}

export class NormChart {
  constructor(canvasId) {
    this.logScale = false;
    this.useEffectiveTime = false;
    this.eta = 0.01;
    const ctx = document.getElementById(canvasId).getContext('2d');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: '||W₁||²',
            data: [],
            borderColor: '#cc5555',
            backgroundColor: 'rgba(204, 85, 85, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0
          },
          {
            label: 'k·||W₂||²',
            data: [],
            borderColor: '#9955cc',
            backgroundColor: 'rgba(153, 85, 204, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0
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
                family: 'Georgia, serif'
              }
            }
          },
          y: {
            type: 'linear',
            beginAtZero: true,
            ticks: {
              font: {
                size: 14,
                family: 'Georgia, serif'
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
            labels: {
              usePointStyle: true,
              pointStyle: 'line',
              padding: 10,
              font: {
                size: 14,
                family: 'Georgia, serif'
              }
            }
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
  }

  // Update chart with new norm history
  update(normHistory) {
    const w1Data = normHistory.map(point => ({
      x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
      y: point.w1NormSq
    }));

    const w2Data = normHistory.map(point => ({
      x: this.useEffectiveTime ? point.iteration * this.eta : point.iteration,
      y: point.w2NormSq
    }));

    this.chart.data.datasets[0].data = w1Data;
    this.chart.data.datasets[1].data = w2Data;

    // Set x-axis max to current iteration count (or effective time)
    if (normHistory.length > 0) {
      const currentIteration = normHistory[normHistory.length - 1].iteration;
      const currentMax = this.useEffectiveTime ? currentIteration * this.eta : currentIteration;
      this.chart.options.scales.x.max = currentMax;
    }

    this.chart.update('none');
  }

  // Clear chart
  clear() {
    this.chart.data.datasets[0].data = [];
    this.chart.data.datasets[1].data = [];
    this.chart.options.scales.x.max = undefined;
    this.chart.update('none');
  }
}

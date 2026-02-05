// Low-Dimensional Flows
// Multi-variable gradient flow simulation

(function() {
  'use strict';

  // ODE parameters
  const dt = 0.01;  // Time step

  // Chart objects
  let lossChart = null;
  let aChart = null;

  // Darker rainbow colors for parameter traces (no yellow!)
  const PARAM_COLORS = [
    'rgb(220, 100, 120)',  // darker pink/rose
    'rgb(230, 140, 80)',   // darker orange
    'rgb(120, 180, 100)',  // darker green
    'rgb(100, 150, 220)',  // darker blue
    'rgb(160, 100, 180)'   // darker purple
  ];

  const LOSS_COLOR = 'rgb(40, 130, 130)';  // darker teal

  // Loss function for multi-variable case
  // L = (1/2)(1 - prod(a_i^k_i))^2
  function loss(aVec, kVec) {
    let product = 1;
    for (let i = 0; i < aVec.length; i++) {
      product *= Math.pow(aVec[i], kVec[i]);
    }
    const term = 1 - product;
    return 0.5 * term * term;
  }

  // Gradient of loss with respect to all variables
  // dL/da_i = -(1-P) * k_i * P / a_i, where P = prod(a_j^k_j)
  function gradientLoss(aVec, kVec) {
    const n = aVec.length;
    const grad = new Array(n);

    // Compute product P
    let product = 1;
    for (let i = 0; i < n; i++) {
      product *= Math.pow(aVec[i], kVec[i]);
    }

    // Compute gradient for each variable
    const factor = -(1 - product);
    for (let i = 0; i < n; i++) {
      grad[i] = factor * kVec[i] * product / aVec[i];
    }

    return grad;
  }

  // ODE: da/dt = -dL/da
  function odeSystem(aVec, kVec) {
    const grad = gradientLoss(aVec, kVec);
    return grad.map(g => -g);
  }

  // RK4 integration step for the system
  function rk4Step(aVec, dt, kVec) {
    const n = aVec.length;

    const k1 = odeSystem(aVec, kVec);

    const aVec2 = aVec.map((a, i) => a + 0.5 * dt * k1[i]);
    const k2 = odeSystem(aVec2, kVec);

    const aVec3 = aVec.map((a, i) => a + 0.5 * dt * k2[i]);
    const k3 = odeSystem(aVec3, kVec);

    const aVec4 = aVec.map((a, i) => a + dt * k3[i]);
    const k4 = odeSystem(aVec4, kVec);

    const aVecNew = aVec.map((a, i) =>
      a + (dt / 6) * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i])
    );

    return aVecNew;
  }

  // Solve ODE system
  function solveODE(a0Vec, kVec, tMax) {
    const times = [];
    const aTrajectories = a0Vec.map(() => []);  // One array per variable
    const lossValues = [];

    let aVec = [...a0Vec];  // Copy initial values
    let t = 0;

    while (t <= tMax) {
      times.push(t);
      for (let i = 0; i < aVec.length; i++) {
        aTrajectories[i].push(aVec[i]);
      }
      lossValues.push(loss(aVec, kVec));

      // Integrate
      aVec = rk4Step(aVec, dt, kVec);
      t += dt;
    }

    return { times, aTrajectories, lossValues };
  }

  // Update or create plots
  function updatePlots(a0Vec, kVec, tMax) {
    const solution = solveODE(a0Vec, kVec, tMax);
    const numVars = a0Vec.length;

    // Check if logscale is enabled
    const useLogScale = document.getElementById('logScaleCheckbox').checked;

    // Calculate y-axis limits
    const maxLoss = Math.max(...solution.lossValues);
    const minLoss = Math.min(...solution.lossValues.filter(v => v > 0));
    const maxA = Math.max(...solution.aTrajectories.flat());
    const minA = Math.min(...solution.aTrajectories.flat().filter(v => v > 0));

    let lossYMax, lossYMin, aYMax, aYMin;
    if (useLogScale) {
      lossYMax = maxLoss * 3;
      lossYMin = minLoss / 3;
      aYMax = maxA * 3;
      aYMin = minA / 3;
    } else {
      lossYMax = maxLoss * 1.2;
      lossYMin = undefined;
      aYMax = maxA * 1.2;
      aYMin = undefined;
    }

    // Update or create loss chart
    if (lossChart) {
      lossChart.data.labels = solution.times;
      lossChart.data.datasets[0].data = solution.lossValues;
      lossChart.options.scales.y.type = useLogScale ? 'logarithmic' : 'linear';
      lossChart.options.scales.y.suggestedMax = lossYMax;
      lossChart.options.scales.y.suggestedMin = lossYMin;
      lossChart.update('none');
    } else {
      const lossCtx = document.getElementById('lossPlot').getContext('2d');
      lossChart = new Chart(lossCtx, {
      type: 'line',
      data: {
        labels: solution.times,
        datasets: [{
          data: solution.lossValues,
          borderColor: LOSS_COLOR,
          borderWidth: 3,
          pointRadius: 0,
          tension: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false
          }
        },
        scales: {
          x: {
            type: 'linear',
            title: {
              display: false
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
              text: '                    ',  // Invisible placeholder (LaTeX rendered separately)
              font: {
                size: 15,
                family: 'Georgia, serif'
              }
            },
            beginAtZero: !useLogScale,
            suggestedMax: lossYMax,
            suggestedMin: lossYMin,
            ticks: {
              font: {
                size: 14,
                family: 'Georgia, serif'
              },
              callback: function(value) {
                // Trim trailing zeros
                return parseFloat(value.toPrecision(12)).toString();
              }
            }
          }
        }
      }
    });
    }

    // Update or create a chart (multiple lines, one per variable)
    if (aChart) {
      aChart.data.labels = solution.times;
      // Update datasets
      aChart.data.datasets = [];
      for (let i = 0; i < numVars; i++) {
        aChart.data.datasets.push({
          label: `a${i+1}`,
          data: solution.aTrajectories[i],
          borderColor: PARAM_COLORS[i],
          borderWidth: 3,
          pointRadius: 0,
          tension: 0
        });
      }
      aChart.options.scales.y.type = useLogScale ? 'logarithmic' : 'linear';
      aChart.options.scales.y.suggestedMax = aYMax;
      aChart.options.scales.y.suggestedMin = aYMin;
      aChart.update('none');
    } else {
      const aCtx = document.getElementById('aPlot').getContext('2d');
      const datasets = [];
      for (let i = 0; i < numVars; i++) {
        datasets.push({
          label: `a${i+1}`,
          data: solution.aTrajectories[i],
          borderColor: PARAM_COLORS[i],
          borderWidth: 3,
          pointRadius: 0,
          tension: 0
        });
      }

      aChart = new Chart(aCtx, {
        type: 'line',
        data: {
          labels: solution.times,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                font: {
                  size: 13,
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
                  return datasets.map((dataset, i) => ({
                    text: `a${subscripts[i]}`,  // Unicode subscript characters
                    fillStyle: dataset.borderColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: 3,
                    hidden: false,
                    index: i
                  }));
                }
              }
            },
            title: {
              display: false
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: false
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
                text: '                    ',  // Invisible placeholder (LaTeX rendered separately)
                font: {
                  size: 15,
                  family: 'Georgia, serif'
                }
              },
              beginAtZero: !useLogScale,
              suggestedMax: aYMax,
              suggestedMin: aYMin,
              ticks: {
                font: {
                  size: 14,
                  family: 'Georgia, serif'
                },
                callback: function(value) {
                  // Trim trailing zeros
                  return parseFloat(value.toPrecision(12)).toString();
                }
              }
            }
          }
        }
      });
    }
  }

  // Run simulation and update plots
  function updateSimulation() {
    if (!window.VariableManager) {
      console.log('VariableManager not ready yet');
      return;
    }

    // Get current settings from variable manager
    const settings = window.VariableManager.getVariableSettings();
    const a0Vec = settings.map(s => s.a0);
    const kVec = settings.map(s => s.k);

    // Get t_max
    const tMaxSliderEl = document.getElementById('tMaxSlider');
    const tMax = window.tMaxSlider.sliderToValue(tMaxSliderEl.value);

    // Update plots
    updatePlots(a0Vec, kVec, tMax);

    // Update theory calculations
    if (window.calculateTheory) {
      window.calculateTheory();
    }
  }

  // Initialize
  function init() {
    console.log('Low-Dimensional Flows initialized');

    // Set up t_max slider
    const tMaxSliderEl = document.getElementById('tMaxSlider');
    const tMaxValueEl = document.getElementById('tMaxValue');

    // Initialize slider
    const initialTMax = window.tMaxSlider.sliderToValue(tMaxSliderEl.value);
    tMaxValueEl.innerHTML = window.tMaxSlider.format(initialTMax);

    // Update on slider change
    tMaxSliderEl.addEventListener('input', function() {
      const tMax = window.tMaxSlider.sliderToValue(this.value);
      tMaxValueEl.innerHTML = window.tMaxSlider.format(tMax);
      updateSimulation();
    });

    // Set up logscale checkbox
    const logScaleCheckbox = document.getElementById('logScaleCheckbox');
    logScaleCheckbox.addEventListener('change', function() {
      updateSimulation();
    });

    // Run initial simulation
    updateSimulation();
  }

  // Export updateSimulation to global scope for variable manager to call
  window.updateSimulation = updateSimulation;

  // Start when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

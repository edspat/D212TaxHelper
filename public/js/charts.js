// Charts module - manages all Chart.js visualizations
const Charts = (() => {
  const chartInstances = {};

  // Read colors from CSS variables for theme consistency
  function getColor(varName, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName)?.trim() || fallback;
  }
  function colors() {
    return {
      blue: getColor('--accent', '#58a6ff'),
      green: getColor('--success', '#3fb950'),
      yellow: getColor('--warning', '#d29922'),
      red: getColor('--danger', '#f85149'),
      purple: '#bc8cff',
      orange: '#f0883e',
      cyan: '#39d2c0',
      pink: '#f778ba',
      text: getColor('--text-secondary', '#8b949e'),
      grid: getColor('--border', '#30363d'),
      cardBg: getColor('--bg-card', '#1c2128')
    };
  }

  function destroy(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function createIncomeBreakdown(canvasId, data) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = [
      I18n.t('income.dividends'),
      I18n.t('income.capitalGains'),
      I18n.t('income.interestIncome')
    ];
    const values = [
      data.dividends || 0,
      data.capitalGains || 0,
      data.interestIncome || 0
    ];
    const bgColors = [c.blue, c.green, c.yellow];

    // Add optional income categories
    if (data.rentalIncome > 0) {
      labels.push(I18n.t('income.rentalIncome'));
      values.push(data.rentalIncome);
      bgColors.push(c.purple || '#b39ddb');
    }
    if (data.royaltyIncome > 0) {
      labels.push(I18n.t('income.royaltyIncome'));
      values.push(data.royaltyIncome);
      bgColors.push(c.orange || '#ffb74d');
    }
    if (data.otherIncome > 0) {
      labels.push(I18n.t('income.otherIncome'));
      values.push(data.otherIncome);
      bgColors.push(c.red || '#ef5350');
    }

    if (chartInstances[canvasId]) {
      const chart = chartInstances[canvasId];
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].backgroundColor = bgColors;
      chart.update();
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderColor: c.cardBg,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: c.text,
              font: { size: 13 },
              padding: 12,
              generateLabels: (chart) => {
                const ds = chart.data.datasets[0];
                const total = ds.data.reduce((s, v) => s + v, 0);
                return chart.data.labels.map((label, i) => {
                  const val = ds.data[i];
                  const pct = total > 0 ? (val / total * 100).toFixed(1) : '0.0';
                  return {
                    text: `${label} (${pct}%)`,
                    fontColor: c.text,
                    fillStyle: ds.backgroundColor[i],
                    strokeStyle: ds.borderColor,
                    lineWidth: ds.borderWidth,
                    hidden: false,
                    index: i
                  };
                });
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
                const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : '0.0';
                return `${ctx.label}: ${Math.round(ctx.raw).toLocaleString('ro-RO')} RON (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function createTaxBreakdown(canvasId, data) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = [
      I18n.t('taxes.dividendTax'),
      I18n.t('taxes.capitalGainsTax'),
      I18n.t('taxes.interestTax'),
      I18n.t('taxes.cassTax')
    ];
    const values = [
      data.dividendTax || 0,
      data.capitalGainsTax || 0,
      data.interestTax || 0,
      data.cassTax || 0
    ];
    const bgColors = [c.blue, c.green, c.yellow, c.red];

    // Add optional tax types
    if (data.rentalTax > 0) {
      labels.splice(-1, 0, I18n.t('income.rentalIncome'));
      values.splice(-1, 0, data.rentalTax);
      bgColors.splice(-1, 0, c.purple || '#b39ddb');
    }
    if (data.royaltyTax > 0) {
      labels.splice(-1, 0, I18n.t('income.royaltyIncome'));
      values.splice(-1, 0, data.royaltyTax);
      bgColors.splice(-1, 0, c.orange || '#f0883e');
    }
    if (data.otherTax > 0) {
      labels.splice(-1, 0, I18n.t('income.otherIncome'));
      values.splice(-1, 0, data.otherTax);
      bgColors.splice(-1, 0, c.cyan || '#39d2c0');
    }

    if (chartInstances[canvasId]) {
      const chart = chartInstances[canvasId];
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].backgroundColor = bgColors;
      chart.update();
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => Math.round(ctx.raw).toLocaleString('ro-RO') + ' RON'
            }
          }
        },
        scales: {
          x: {
            ticks: { color: c.text, font: { size: 12 } },
            grid: { color: c.grid }
          },
          y: {
            ticks: {
              color: c.text,
              callback: v => Number.isInteger(v) ? v.toLocaleString() + ' RON' : '',
              precision: 0
            },
            grid: { color: c.grid }
          }
        }
      }
    });
  }

  function createYearComparison(canvasId, yearsData) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const years = Object.keys(yearsData).sort();
    const totalIncomes = years.map(y => yearsData[y].totalIncome || 0);
    const totalTaxes = years.map(y => yearsData[y].totalTax || 0);

    if (chartInstances[canvasId]) {
      const chart = chartInstances[canvasId];
      chart.data.labels = years;
      chart.data.datasets[0].data = totalIncomes;
      chart.data.datasets[1].data = totalTaxes;
      chart.update();
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          {
            label: I18n.t('dashboard.totalIncome'),
            data: totalIncomes,
            backgroundColor: c.blue,
            borderRadius: 4
          },
          {
            label: I18n.t('dashboard.totalTax'),
            data: totalTaxes,
            backgroundColor: c.red,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: c.text, font: { size: 13 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': ' + Math.round(ctx.raw).toLocaleString() + ' RON'
            }
          }
        },
        scales: {
          x: {
            ticks: { color: c.text },
            grid: { color: c.grid }
          },
          y: {
            ticks: { color: c.text, precision: 0, callback: v => Math.round(v).toLocaleString() + ' RON' },
            grid: { color: c.grid }
          }
        }
      }
    });
  }

  function createExchangeRates(canvasId, ratesData) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const years = Object.keys(ratesData).sort();
    const rates = years.map(y => ratesData[y]);

    if (chartInstances[canvasId]) {
      const chart = chartInstances[canvasId];
      chart.data.labels = years;
      chart.data.datasets[0].data = rates;
      chart.update();
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [{
          label: 'USD/RON',
          data: rates,
          borderColor: c.cyan,
          backgroundColor: 'rgba(57, 210, 192, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: c.cyan,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: c.text }
          }
        },
        scales: {
          x: {
            ticks: { color: c.text },
            grid: { color: c.grid }
          },
          y: {
            ticks: { color: c.text },
            grid: { color: c.grid },
            suggestedMin: 4.3,
            suggestedMax: 5.0
          }
        }
      }
    });
  }

  function createMinSalaryChart(canvasId, salaryData) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const years = Object.keys(salaryData).sort();
    const values = years.map(y => salaryData[y]);

    if (chartInstances[canvasId]) {
      const chart = chartInstances[canvasId];
      chart.data.labels = years;
      chart.data.datasets[0].data = values;
      chart.update();
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [{
          label: 'RON/month',
          data: values,
          borderColor: c.orange || '#f0883e',
          backgroundColor: 'rgba(240, 136, 62, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: c.orange || '#f0883e',
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: c.text, font: { size: 13 } }
          }
        },
        scales: {
          x: {
            ticks: { color: c.text, font: { size: 12 } },
            grid: { color: c.grid }
          },
          y: {
            ticks: { color: c.text, callback: v => v.toLocaleString() + ' RON' },
            grid: { color: c.grid }
          }
        }
      }
    });
  }

  return {
    createIncomeBreakdown,
    createTaxBreakdown,
    createYearComparison,
    createExchangeRates,
    createMinSalaryChart
  };
})();

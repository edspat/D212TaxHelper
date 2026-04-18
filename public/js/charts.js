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

  // Generic chart navigation (windowed view with prev/next arrows)
  const _navState = {}; // keyed by navId

  function setupChartNav(navId, allLabels, windowSize, updateFn) {
    const total = allLabels.length;
    if (!_navState[navId]) {
      _navState[navId] = { offset: 0 };
    }
    _navState[navId].offset = 0; // reset to most recent on data change
    _navState[navId].allLabels = allLabels;
    _navState[navId].windowSize = windowSize;
    _navState[navId].updateFn = updateFn;

    const nav = document.getElementById(navId + '-nav');
    const prevBtn = document.getElementById(navId + '-prev');
    const nextBtn = document.getElementById(navId + '-next');
    if (nav && prevBtn && nextBtn) {
      if (total > windowSize) {
        nav.style.display = 'flex';
        prevBtn.onclick = () => {
          _navState[navId].offset = Math.min(_navState[navId].offset + 1, total - windowSize);
          updateChartNavWindow(navId);
        };
        nextBtn.onclick = () => {
          _navState[navId].offset = Math.max(0, _navState[navId].offset - 1);
          updateChartNavWindow(navId);
        };
      } else {
        nav.style.display = 'none';
      }
    }
    updateChartNavWindow(navId);
  }

  function updateChartNavWindow(navId) {
    const s = _navState[navId];
    if (!s) return;
    const total = s.allLabels.length;
    const endIdx = total - s.offset;
    const startIdx = Math.max(0, endIdx - s.windowSize);
    const windowLabels = s.allLabels.slice(startIdx, endIdx);

    // Update button states
    const prevBtn = document.getElementById(navId + '-prev');
    const nextBtn = document.getElementById(navId + '-next');
    if (prevBtn) prevBtn.disabled = startIdx === 0;
    if (nextBtn) nextBtn.disabled = s.offset === 0;

    s.updateFn(windowLabels);
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

  function createYearComparison(canvasId, yearsData, windowSize) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const ws = windowSize || 5;
    const allYears = Object.keys(yearsData).sort();
    const windowYears = allYears.slice(-ws);
    const totalIncomes = windowYears.map(y => yearsData[y].totalIncome || 0);
    const totalTaxes = windowYears.map(y => yearsData[y].totalTax || 0);

    if (chartInstances[canvasId]) {
      setupChartNav('year-comp', allYears, ws, (winYears) => {
        const chart = chartInstances[canvasId];
        chart.data.labels = winYears;
        chart.data.datasets[0].data = winYears.map(y => yearsData[y].totalIncome || 0);
        chart.data.datasets[1].data = winYears.map(y => yearsData[y].totalTax || 0);
        chart.update();
      });
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: windowYears,
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

    setupChartNav('year-comp', allYears, ws, (winYears) => {
      const chart = chartInstances[canvasId];
      chart.data.labels = winYears;
      chart.data.datasets[0].data = winYears.map(y => yearsData[y].totalIncome || 0);
      chart.data.datasets[1].data = winYears.map(y => yearsData[y].totalTax || 0);
      chart.update();
    });
  }

  function createExchangeRates(canvasId, ratesData, windowSize, focusYear) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const ws = windowSize || 5;
    const allYears = Object.keys(ratesData).sort();
    let windowYears;
    if (focusYear) {
      const idx = allYears.indexOf(String(focusYear));
      if (idx >= 0) {
        const start = Math.max(0, Math.min(idx - Math.floor(ws / 2), allYears.length - ws));
        windowYears = allYears.slice(start, start + ws);
      } else {
        windowYears = allYears.slice(-ws);
      }
    } else {
      windowYears = allYears.slice(-ws);
    }
    const rates = windowYears.map(y => ratesData[y]);

    if (chartInstances[canvasId]) {
      const chart = chartInstances[canvasId];
      chart.data.labels = windowYears;
      chart.data.datasets[0].data = rates;
      chart.update();
      setupChartNav('exch-rate', allYears, ws, (winYears) => {
        chart.data.labels = winYears;
        chart.data.datasets[0].data = winYears.map(y => ratesData[y]);
        chart.update();
      });
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: windowYears,
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
            grid: { color: c.grid }
          }
        }
      }
    });

    setupChartNav('exch-rate', allYears, ws, (winYears) => {
      const chart = chartInstances[canvasId];
      chart.data.labels = winYears;
      chart.data.datasets[0].data = winYears.map(y => ratesData[y]);
      chart.update();
    });
  }

  function createMinSalaryChart(canvasId, salaryData, windowSize, focusYear) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const ws = windowSize || 5;
    const allYears = Object.keys(salaryData).sort();
    let windowYears;
    if (focusYear) {
      const idx = allYears.indexOf(String(focusYear));
      if (idx >= 0) {
        const start = Math.max(0, Math.min(idx - Math.floor(ws / 2), allYears.length - ws));
        windowYears = allYears.slice(start, start + ws);
      } else {
        windowYears = allYears.slice(-ws);
      }
    } else {
      windowYears = allYears.slice(-ws);
    }
    const values = windowYears.map(y => salaryData[y]);

    if (chartInstances[canvasId]) {
      const chart = chartInstances[canvasId];
      chart.data.labels = windowYears;
      chart.data.datasets[0].data = values;
      chart.update();
      setupChartNav('min-salary', allYears, ws, (winYears) => {
        chart.data.labels = winYears;
        chart.data.datasets[0].data = winYears.map(y => salaryData[y]);
        chart.update();
      });
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: windowYears,
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

    setupChartNav('min-salary', allYears, ws, (winYears) => {
      const chart = chartInstances[canvasId];
      chart.data.labels = winYears;
      chart.data.datasets[0].data = winYears.map(y => salaryData[y]);
      chart.update();
    });
  }

  function createD212PaymentChart(canvasId, paymentData, windowSize, focusYear) {
    const c = colors();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const ws = windowSize || 5;
    const allYears = Object.keys(paymentData).sort();
    let windowYears;
    if (focusYear) {
      const idx = allYears.indexOf(String(focusYear));
      if (idx >= 0) {
        const start = Math.max(0, Math.min(idx - Math.floor(ws / 2), allYears.length - ws));
        windowYears = allYears.slice(start, Math.min(start + ws, allYears.length));
      } else {
        windowYears = allYears.slice(-ws);
      }
    } else {
      windowYears = allYears.slice(-ws);
    }
    const paid = windowYears.map(y => paymentData[y]?.paid || 0);
    const taxes = windowYears.map(y => paymentData[y]?.tax || 0);
    const cass = windowYears.map(y => paymentData[y]?.cass || 0);

    const updateFn = (winYears) => {
      const chart = chartInstances[canvasId];
      chart.data.labels = winYears;
      chart.data.datasets[0].data = winYears.map(y => paymentData[y]?.paid || 0);
      chart.data.datasets[1].data = winYears.map(y => paymentData[y]?.tax || 0);
      chart.data.datasets[2].data = winYears.map(y => paymentData[y]?.cass || 0);
      chart.update();
    };

    if (chartInstances[canvasId]) {
      const chart = chartInstances[canvasId];
      chart.data.labels = windowYears;
      chart.data.datasets[0].data = paid;
      chart.data.datasets[1].data = taxes;
      chart.data.datasets[2].data = cass;
      chart.update();
      setupChartNav('d212-pay', allYears, ws, updateFn);
      return;
    }

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: windowYears,
        datasets: [
          {
            label: I18n.t('dashboard.alreadyPaid') || 'Already Paid',
            data: paid,
            backgroundColor: c.green,
            borderRadius: 4
          },
          {
            label: I18n.t('dashboard.totalTax') || 'Income Tax',
            data: taxes,
            backgroundColor: c.red,
            borderRadius: 4
          },
          {
            label: I18n.t('dashboard.cass') || 'CASS',
            data: cass,
            backgroundColor: c.purple || '#a371f7',
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
              label: (ctx) => ctx.dataset.label + ': ' + Math.round(ctx.raw).toLocaleString() + ' RON',
              afterBody: (items) => {
                const chart = chartInstances[canvasId];
                const idx = items[0].dataIndex;
                const p = chart.data.datasets[0].data[idx] || 0;
                const t = chart.data.datasets[1].data[idx] || 0;
                const cs = chart.data.datasets[2].data[idx] || 0;
                return 'Total: ' + Math.round(p + t + cs).toLocaleString() + ' RON';
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: c.text },
            grid: { color: c.grid }
          },
          y: {
            stacked: true,
            ticks: { color: c.text, precision: 0, callback: v => Math.round(v).toLocaleString() + ' RON' },
            grid: { color: c.grid }
          }
        }
      }
    });

    setupChartNav('d212-pay', allYears, ws, buildUpdateFn());
  }

  // Destroy all charts so they get re-rendered with new theme colors
  function refreshAll() {
    for (const id of Object.keys(chartInstances)) {
      destroy(id);
    }
  }

  return {
    createIncomeBreakdown,
    createTaxBreakdown,
    createYearComparison,
    createExchangeRates,
    createMinSalaryChart,
    createD212PaymentChart,
    refreshAll
  };
})();

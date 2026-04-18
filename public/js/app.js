// Main Application Module
const App = (() => {
  let appData = { years: {} };
  let taxRates = {};
  let exchangeRates = {};
  let withholdingData = { total: 0, totalBik: 0, rows: [] };
  window._cachedStockAwards = []; // cached stock awards for per-year withholding calc
  let ledgerAllocations = {}; // { year: { esppCostUSD, bikAllocatedRON, ... } }
  let rawFilesList = []; // cached list of raw files
  let selectedYear = new Date().getFullYear() - 1;

  // Check if stock_award raw file exists for a given year
  function hasStockAwardFile(year) {
    return rawFilesList.some(f => f.name === `stock_award_${year}_raw.txt`);
  }

  // Normalize dates to YYYY.MM.DD format
  function normalizeDate(d) {
    const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    let m = String(d).match(/(\d{1,2})-(\w{3})-(\d{2,4})/);
    if (m) { let yr = parseInt(m[3]); if (yr < 100) yr += 2000; return yr + '.' + months[m[2].toLowerCase()] + '.' + m[1].padStart(2,'0'); }
    m = String(d).match(/^(\d{1,2})\.(\d{2})\.(\d{4})$/);
    if (m) return m[3] + '.' + m[2] + '.' + m[1].padStart(2,'0');
    const tMonths = {JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12'};
    m = String(d).match(/(\w{3})\/(\d{2})\/(\d{4})/);
    if (m) return m[3] + '.' + (tMonths[m[1].toUpperCase()] || '01') + '.' + m[2];
    return d;
  }

  // Romanian CASS thresholds (tiered system based on minimum gross salary)
  // CAS does NOT apply for investment income (only PFA, independent activities)
  // 2023-2024: 3-tier system (6SM / 12SM / 24SM cap)
  // 2025+: 5-tier system (6SM / 12SM / 24SM / 60SM cap)
  const cassThresholds = {
    2019: { minSalary: 2080, tiers: 3 },
    2020: { minSalary: 2230, tiers: 3 },
    2021: { minSalary: 2300, tiers: 3 },
    2022: { minSalary: 2550, tiers: 3 },
    2023: { minSalary: 3000, tiers: 3 },
    2024: { minSalary: 3300, tiers: 3 },
    2025: { minSalary: 4050, tiers: 5 },
    2026: { minSalary: 4050, tiers: 5 }
  };

  // Calculate CASS due using tiered brackets
  // incomeType: 'investment' (D212 pct. 52.1 — max 24SM cap) or 'independent' (pct. 49.1 — 60SM cap)
  function calculateCASS(totalIncome, year, overrideMinSalary, incomeType) {
    const info = cassThresholds[year] || cassThresholds[2025];
    const sm = overrideMinSalary || info.minSalary;
    const tierSystem = info.tiers || 5;
    const t6 = 6 * sm;
    const t12 = 12 * sm;
    const t24 = 24 * sm;
    const t60 = 60 * sm;

    // Investment income (D212 pct. 52.1.1–52.1.3): always capped at 24SM (3 tiers)
    // 60SM tier only applies to independent activities (D212 pct. 49.1.2.1)
    const useInvestmentCap = incomeType !== 'independent';

    if (tierSystem === 3 || useInvestmentCap) {
      // 3-tier system: 6SM / 12SM / 24SM cap (investment income for all years)
      if (totalIncome < t6) return { applies: false, base: 0, amount: 0, tier: '<6SM', sm, t6, t12, t24, t60, tierSystem };
      if (totalIncome < t12) return { applies: true, base: t6, amount: t6 * 0.10, tier: '6-12SM', sm, t6, t12, t24, t60, tierSystem };
      if (totalIncome < t24) return { applies: true, base: t12, amount: t12 * 0.10, tier: '12-24SM', sm, t6, t12, t24, t60, tierSystem };
      return { applies: true, base: t24, amount: t24 * 0.10, tier: '>24SM', sm, t6, t12, t24, t60, tierSystem };
    }

    // 2025+: 5-tier system (6SM / 12SM / 24SM / 60SM) — independent activities only
    if (totalIncome < t6) return { applies: false, base: 0, amount: 0, tier: '<6SM', sm, t6, t12, t24, t60, tierSystem };
    if (totalIncome < t12) return { applies: true, base: t6, amount: t6 * 0.10, tier: '6-12SM', sm, t6, t12, t24, t60, tierSystem };
    if (totalIncome < t24) return { applies: true, base: t12, amount: t12 * 0.10, tier: '12-24SM', sm, t6, t12, t24, t60, tierSystem };
    if (totalIncome < t60) return { applies: true, base: t24, amount: t24 * 0.10, tier: '24-60SM', sm, t6, t12, t24, t60, tierSystem };
    return { applies: true, base: t60, amount: t60 * 0.10, tier: '>60SM', sm, t6, t12, t24, t60, tierSystem };
  }

  // Default D212 deadline: 25 May of year+1 (adjustable per year)
  const d212Deadlines = { 2023: '2024-05-27', 2024: '2025-05-26', 2025: '2026-05-25', 2026: '2027-05-25' };
  function d212DefaultDeadline(year) {
    return d212Deadlines[year] || `${year + 1}-05-25`;
  }
  function formatDeadline(isoDate) {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate + 'T00:00:00');
      const months = I18n.t('misc.months');
      if (Array.isArray(months) && months.length === 12) {
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      }
      return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return isoDate; }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      btn.textContent = prefersDark ? '🌙' : '☀️';
      btn.title = 'Theme: System';
    } else if (theme === 'dark') {
      btn.textContent = '🌙';
      btn.title = 'Theme: Dark';
    } else {
      btn.textContent = '☀️';
      btn.title = 'Theme: Light';
    }
    // Update charts if they exist (theme colors change)
    if (typeof Charts !== 'undefined' && Charts.refreshAll) Charts.refreshAll();
  }

  async function init() {
    // ---- Theme ----
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'auto';
    applyTheme(savedTheme);

    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      let next;
      if (current === 'auto') {
        // Auto → opposite of system preference
        next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
      } else if (current === 'dark') {
        next = 'light';
      } else {
        next = 'dark';
      }
      applyTheme(next);
      localStorage.setItem('theme', next);
      render(); // re-draw charts with new theme colors
    });

    // Re-detect when system preference changes (only matters in auto mode)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if ((localStorage.getItem('theme') || 'auto') === 'auto') {
        applyTheme('auto');
        render();
      }
    });

    // Load language
    const langSelect = document.getElementById('lang-select');
    const savedLang = localStorage.getItem('lang') || 'ro';
    langSelect.value = savedLang;
    await I18n.loadLanguage(savedLang);

    // Language switcher
    langSelect.addEventListener('change', async (e) => {
      await I18n.loadLanguage(e.target.value);
      render();
      checkNavOverflow();
      fetchOcrStatus();
    });

    // Tab navigation
    const navMenu = document.getElementById('main-nav');
    const navToggle = document.getElementById('nav-toggle');
    const headerContent = document.querySelector('.header-content');
    navToggle.addEventListener('click', () => navMenu.classList.toggle('open'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navMenu.classList.remove('open');
        switchTab(btn.dataset.tab);
      });
    });

    // Dynamic compact nav: switch to hamburger when nav items overflow
    function checkNavOverflow() {
      // Temporarily switch to horizontal mode to measure
      headerContent.classList.remove('compact-nav');
      navMenu.classList.remove('open');
      // Force layout recalc
      void navMenu.offsetWidth;
      if (navMenu.scrollWidth > navMenu.clientWidth + 1) {
        headerContent.classList.add('compact-nav');
      }
    }
    checkNavOverflow();
    let resizeTimer;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(checkNavOverflow, 150); });

    // Year selector
    const yearSelect = document.getElementById('year-select');
    yearSelect.addEventListener('change', (e) => {
      selectedYear = parseInt(e.target.value, 10);
      render();
    });

    // Forms
    document.getElementById('data-form').addEventListener('submit', handleDataSubmit);
    document.getElementById('upload-form').addEventListener('submit', handleUpload);
    document.getElementById('rates-form').addEventListener('submit', handleRatesSubmit);
    document.getElementById('tax-rates-form').addEventListener('submit', handleTaxRatesSubmit);

    // Fetch OCR engine status
    fetchOcrStatus();

    // Image preview on file select
    document.getElementById('upload-file').addEventListener('change', (e) => {
      const files = e.target.files;
      const fileLabel = document.getElementById('file-label');
      if (files.length === 0) {
        fileLabel.textContent = I18n.t('import.noFileChosen');
      } else if (files.length === 1) {
        fileLabel.textContent = files[0].name;
      } else {
        fileLabel.textContent = files.length + ' ' + I18n.t('import.filesSelected');
      }
      const file = files[0];
      const preview = document.getElementById('image-preview');
      const img = document.getElementById('preview-img');
      if (file && file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        img.src = url;
        preview.classList.remove('hidden');
      } else {
        preview.classList.add('hidden');
        img.src = '';
      }
    });

    // Year picker
    initYearPicker();

    // Load data + app version in parallel
    const [, vData] = await Promise.all([
      loadAllData(),
      fetch('/api/version').then(r => r.json()).catch(() => null)
    ]);

    // App version
    if (vData) {
      const vEl = document.getElementById('app-version');
      if (vEl) vEl.textContent = vData.version || '?';
    }

    // Check for updates (non-blocking)
    checkForUpdates();

    // Changelog modal
    const vLink = document.getElementById('app-version-link');
    const clModal = document.getElementById('changelog-modal');
    const clClose = document.getElementById('changelog-close');
    const clBody = document.getElementById('changelog-body');
    const clTitle = document.getElementById('changelog-title');
    // Markdown to HTML converter (line-by-line parser)
    function md2html(md) {
      md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = md.split('\n');
      let html = '';
      let inCode = false, codeLines = [];
      let inTable = false, tableRows = [];

      function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
      function slugify(text) {
        return text.toLowerCase()
          .replace(/&amp;/g, '&').replace(/&lt;/g, '').replace(/&gt;/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/[\u2014\u2013]/g, '-')
          .replace(/[^\w\s\u00C0-\u024F-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/^-|-$/g, '');
      }
      function inl(s) {
        return esc(s)
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code style="background:var(--bg-secondary);padding:0.1rem 0.35rem;border-radius:3px;font-size:0.9em;">$1</code>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
            if (href.startsWith('#')) {
              return `<a href="${href}" class="doc-anchor-link" style="color:var(--accent)">${text}</a>`;
            }
            return `<a href="${href}" target="_blank" rel="noopener" style="color:var(--accent)">${text}</a>`;
          });
      }
      function flushTable() {
        if (!tableRows.length) return '';
        let t = '<div style="overflow-x:auto;margin:0.5rem 0;"><table style="width:100%;border-collapse:collapse;font-size:0.9rem;">';
        tableRows.forEach((cells, i) => {
          if (i === 0) {
            t += '<thead><tr>' + cells.map(c => '<th style="padding:0.4rem 0.6rem;border:1px solid var(--border);background:var(--bg-secondary);text-align:left;font-weight:600;">' + c + '</th>').join('') + '</tr></thead><tbody>';
          } else {
            t += '<tr>' + cells.map(c => '<td style="padding:0.4rem 0.6rem;border:1px solid var(--border);">' + c + '</td>').join('') + '</tr>';
          }
        });
        t += '</tbody></table></div>';
        tableRows = [];
        return t;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimEnd();

        // Code block toggle
        if (trimmed.startsWith('```')) {
          if (inCode) {
            html += '<pre style="background:var(--bg-secondary);padding:0.75rem;border-radius:var(--radius);overflow-x:auto;font-size:0.85rem;line-height:1.6;white-space:pre;"><code>' + codeLines.join('\n') + '</code></pre>';
            codeLines = []; inCode = false;
          } else {
            if (inTable) { html += flushTable(); inTable = false; }
            inCode = true;
          }
          continue;
        }
        if (inCode) { codeLines.push(esc(line)); continue; }

        // Table separator row — skip
        if (/^\|[-\s:|]+\|$/.test(trimmed)) { continue; }

        // Table data row
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          if (!inTable) { inTable = true; tableRows = []; }
          const cells = trimmed.slice(1, -1).split('|').map(c => inl(c.trim()));
          tableRows.push(cells);
          continue;
        }

        // Flush table if we left it
        if (inTable) { html += flushTable(); inTable = false; }

        // Empty line
        if (trimmed === '') { html += '<br>'; continue; }

        // Headings
        if (trimmed.startsWith('#### ')) { const t = inl(trimmed.slice(5)); html += `<h5 id="${slugify(trimmed.slice(5))}" style="margin:0.8rem 0 0.3rem;">${t}</h5>`; continue; }
        if (trimmed.startsWith('### ')) { const t = inl(trimmed.slice(4)); html += `<h4 id="${slugify(trimmed.slice(4))}" style="margin:1rem 0 0.4rem;">${t}</h4>`; continue; }
        if (trimmed.startsWith('## ')) { const t = inl(trimmed.slice(3)); html += `<h3 id="${slugify(trimmed.slice(3))}" style="margin:1.2rem 0 0.5rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem;">${t}</h3>`; continue; }
        if (trimmed.startsWith('# ')) { const t = inl(trimmed.slice(2)); html += `<h2 id="${slugify(trimmed.slice(2))}" style="margin:1.2rem 0 0.5rem;">${t}</h2>`; continue; }

        // Horizontal rule
        if (/^-{3,}$/.test(trimmed)) { html += '<hr style="border:none;border-top:1px solid var(--border);margin:1rem 0;">'; continue; }

        // List items
        if (trimmed.startsWith('- ')) { html += '<li style="margin-bottom:0.15rem;">' + inl(trimmed.slice(2)) + '</li>'; continue; }
        if (/^\d+\.\s/.test(trimmed)) { html += '<li style="margin-bottom:0.15rem;">' + inl(trimmed.replace(/^\d+\.\s+/, '')) + '</li>'; continue; }

        // Regular text
        html += '<p style="margin:0.3rem 0;">' + inl(trimmed) + '</p>';
      }

      // Flush remaining
      if (inCode) html += '<pre style="background:var(--bg-secondary);padding:0.75rem;border-radius:var(--radius);overflow-x:auto;font-size:0.85rem;line-height:1.6;white-space:pre;"><code>' + codeLines.join('\n') + '</code></pre>';
      if (inTable) html += flushTable();

      // Wrap consecutive <li> in <ul>
      html = html.replace(/((?:<li[^>]*>.*?<\/li>)+)/g, '<ul style="margin:0.3rem 0 0.3rem 1.2rem;padding:0;">$1</ul>');
      return html;
    }

    // Handle anchor links inside modals — scroll within the modal body
    function bindAnchorLinks(container) {
      container.querySelectorAll('a.doc-anchor-link').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const id = a.getAttribute('href').slice(1);
          const target = container.querySelector('#' + CSS.escape(id));
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      // Intercept changelog file links — open in changelog modal
      container.querySelectorAll('a[href$="CHANGELOG.en.md"], a[href$="CHANGELOG.ro.md"]').forEach(a => {
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          const lang = a.getAttribute('href').includes('.ro.') ? 'ro' : 'en';
          clTitle.textContent = lang === 'ro' ? 'Istoric versiuni' : 'Changelog';
          clBody.innerHTML = lang === 'ro' ? '<p>Se încarcă...</p>' : '<p>Loading...</p>';
          clModal.classList.remove('hidden');
          try {
            const resp = await fetch(`/api/changelog/${lang}`);
            const text = await resp.text();
            clBody.innerHTML = md2html(text);
            bindAnchorLinks(clBody);
          } catch { clBody.innerHTML = '<p>Error loading changelog</p>'; }
        });
      });
    }

    if (vLink && clModal) {
      vLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const lang = I18n.getLang?.() || 'en';
        clTitle.textContent = lang === 'ro' ? 'Istoric versiuni' : 'Changelog';
        clBody.innerHTML = lang === 'ro' ? '<p>Se \u00eencarc\u0103...</p>' : '<p>Loading...</p>';
        clModal.classList.remove('hidden');
        try {
          const resp = await fetch(`/api/changelog/${lang}`);
          const text = await resp.text();
          clBody.innerHTML = md2html(text);
          bindAnchorLinks(clBody);
        } catch { clBody.innerHTML = '<p>Error loading changelog</p>'; }
      });
      clClose.addEventListener('click', () => clModal.classList.add('hidden'));
      clModal.addEventListener('click', (e) => { if (e.target === clModal) clModal.classList.add('hidden'); });

      // Changelog scroll-to-top button
      const clScrollBtn = document.getElementById('changelog-scroll-top');
      if (clScrollBtn) {
        clScrollBtn.addEventListener('click', () => clBody.scrollTo({ top: 0, behavior: 'smooth' }));
        clBody.addEventListener('scroll', () => {
          clScrollBtn.classList.toggle('hidden', clBody.scrollTop < 300);
        });
      }
    }

    // Doc modal (README / Guide)
    const docModal = document.getElementById('doc-modal');
    const docClose = document.getElementById('doc-modal-close');
    const docBody = document.getElementById('doc-modal-body');
    const docTitle = document.getElementById('doc-modal-title');
    if (docModal) {
      function openDoc(name, titleEn, titleRo) {
        return async (e) => {
          e.preventDefault();
          const lang = I18n.getLang?.() || 'en';
          docTitle.textContent = lang === 'ro' ? titleRo : titleEn;
          docBody.innerHTML = lang === 'ro' ? '<p>Se încarcă...</p>' : '<p>Loading...</p>';
          docModal.classList.remove('hidden');
          try {
            const resp = await fetch(`/api/doc/${name}/${lang}`);
            const text = await resp.text();
            docBody.innerHTML = md2html(text);
            bindAnchorLinks(docBody);
          } catch { docBody.innerHTML = '<p>Error loading document</p>'; }
        };
      }
      const readmeLink = document.getElementById('doc-readme-link');
      const guideLink = document.getElementById('doc-guide-link');
      if (readmeLink) readmeLink.addEventListener('click', openDoc('readme', 'README', 'README'));
      if (guideLink) guideLink.addEventListener('click', openDoc('guide', 'User Guide', 'Ghid de Utilizare'));
      docClose.addEventListener('click', () => docModal.classList.add('hidden'));
      docModal.addEventListener('click', (e) => { if (e.target === docModal) docModal.classList.add('hidden'); });

      // Doc modal scroll-to-top button
      const docScrollBtn = document.getElementById('doc-scroll-top');
      if (docScrollBtn) {
        docScrollBtn.addEventListener('click', () => docBody.scrollTo({ top: 0, behavior: 'smooth' }));
        docBody.addEventListener('scroll', () => {
          docScrollBtn.classList.toggle('hidden', docBody.scrollTop < 300);
        });
      }
    }

    // Populate year selector
    populateYears();

    // Render (await to ensure _cachedStockAwards is populated before computeYearData)
    await render();
  }

  async function loadAllData() {
    try {
      const [dataResp, ratesResp, withResp] = await Promise.all([
        fetch('/api/data'),
        fetch('/api/tax-rates'),
        fetch('/api/stock-withholding')
      ]);
      appData = await dataResp.json();
      const ratesData = await ratesResp.json();
      taxRates = ratesData.rates || {};
      exchangeRates = ratesData.exchangeRates || {};
      withholdingData = await withResp.json();
      invalidateComputeCache();
    } catch (err) {
      console.error('Failed to load data:', err);
      showToast(I18n.t('misc.loadError') || 'Failed to load data', 'error');
    }
  }

  function populateYears() {
    const yearSelect = document.getElementById('year-select');
    yearSelect.innerHTML = '';

    // Default year = previous year (fiscal year being declared)
    const defaultYear = new Date().getFullYear() - 1;
    const years = new Set([defaultYear]);
    // Add all years from exchange rates
    Object.keys(exchangeRates).forEach(y => years.add(parseInt(y, 10)));
    if (appData.years) {
      Object.keys(appData.years).forEach(y => {
        const yr = parseInt(y, 10);
        // Only add if the year has meaningful data (not just empty/default)
        const yd = appData.years[y];
        const hasData = yd && Object.keys(yd).some(k => k !== 'year');
        if (hasData) years.add(yr);
      });
    }

    const sortedYears = [...years].sort((a, b) => b - a);
    for (const y of sortedYears) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    }

    // Default to the latest year only on first load
    if (!sortedYears.includes(selectedYear)) {
      selectedYear = sortedYears[0];
    }
    yearSelect.value = selectedYear;
  }

  function switchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector(`.nav-btn[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`tab-${tabName}`)?.classList.add('active');

    if (tabName === 'raw') loadRawFiles();
    if (tabName === 'input') populateForm();
  }

  async function render() {
    // Fetch ledger allocations and raw file list (withholding already loaded by loadAllData)
    try {
      const [ledgerResp, rawResp] = await Promise.all([
        fetch('/api/ledger/allocations'),
        fetch('/api/raw')
      ]);
      ledgerAllocations = await ledgerResp.json();
      const rawData = await rawResp.json();
      rawFilesList = Array.isArray(rawData) ? rawData : [];
    } catch { /* use cached */ }
    invalidateComputeCache();
    await renderWithholdingTable(); // must be first to update _cachedStockAwards before computeYearData
    try { renderDashboard(); } catch(e) { console.error('renderDashboard error:', e); }
    try { renderIncomeTable(); } catch(e) { console.error('renderIncomeTable error:', e); }
    try { renderTaxTable(); } catch(e) { console.error('renderTaxTable error:', e); }
    renderRoTradesTable();
    renderTradesTable();
    I18n.applyTranslations();
    // Sort document type dropdown alphabetically after i18n
    sortDocTypeDropdown();
    // Update Add Data form (always, so save buttons show year)
    populateForm();
    // Sync Import Document year picker with global year
    if (window._syncYearPicker) {
      window._syncYearPicker(selectedYear);
    }
  }

  let _docTypeHintBound = false;
  function sortDocTypeDropdown() {
    const sel = document.getElementById('upload-type');
    if (!sel) return;
    const opts = Array.from(sel.options);
    const placeholder = opts.find(o => o.value === '');
    const sortable = opts.filter(o => o.value !== '');
    sortable.sort((a, b) => a.textContent.localeCompare(b.textContent));
    sel.innerHTML = '';
    if (placeholder) sel.appendChild(placeholder);
    sortable.forEach(o => sel.appendChild(o));

    // Show OCR hint when a type that typically needs OCR is selected (bind only once)
    if (_docTypeHintBound) return;
    _docTypeHintBound = true;
    const OCR_TYPES = new Set(['declaratie', 'tradeville_portfolio', 'fidelity_statement', 'ms_statement']);
    const TEXT_PDF_TYPES = new Set(['investment', 'trade_confirmation', 'form_1042s', 'adeverinta', 'stock_award', 'xtb_dividends', 'xtb_portfolio']);
    const hintEl = document.getElementById('ocr-type-hint');
    if (hintEl) {
      const updateHint = () => {
        const val = sel.value;
        if (OCR_TYPES.has(val)) {
          hintEl.textContent = I18n.t('import.ocrTypeHint');
          hintEl.className = 'ocr-type-hint ocr-type-hint-warn';
        } else if (TEXT_PDF_TYPES.has(val)) {
          hintEl.textContent = I18n.t('import.textTypeHint');
          hintEl.className = 'ocr-type-hint ocr-type-hint-ok';
        } else {
          hintEl.className = 'ocr-type-hint hidden';
        }
      };
      sel.addEventListener('change', updateHint);
      // Show hint immediately if a type is already selected
      if (sel.value) updateHint();
    }
  }

  // ============ COMPUTE TAX DATA ============
  let _computeCache = {};
  let _computeDataVersion = 0;
  function invalidateComputeCache() { _computeDataVersion++; _computeCache = {}; }
  function computeYearData(year) {
    const cacheKey = `${year}_${_computeDataVersion}`;
    if (_computeCache[cacheKey]) return _computeCache[cacheKey];
    const result = _computeYearDataImpl(year);
    _computeCache[cacheKey] = result;
    return result;
  }
  function _computeYearDataImpl(year) {
    const yd = appData.years?.[year] || {};
    const decl = yd.declaratie || {};
    const inv = yd.investment || {};
    const adv = yd.adeverinta || {};
    const trades = yd.fidelityTrades || {};
    const fd = yd.fidelityData || {};
    const xtbDiv = yd.xtbDividendsReport || {};
    const xtbPort = yd.xtbPortfolio || {};
    // Form 1042-S: aggregate dividend forms (income code 06)
    const form1042s = (yd.form1042s || []).filter(f => f.incomeCode === '06');
    const f1042sDivUSD = form1042s.reduce((s, f) => s + (f.grossIncomeUSD || 0), 0);
    const f1042sTaxUSD = form1042s.reduce((s, f) => s + (f.federalTaxWithheldUSD || 0), 0);
    const savedRate = yd.exchangeRate ? parseFloat(yd.exchangeRate) : null;
    const defaultRate = exchangeRates[year]?.usdRon || 4.57;
    const rate = savedRate || decl.exchangeRate || defaultRate;

    // Dividend tax rate: 16% from 2026, 10% for 2025, 8% for 2023-2024, 5% for 2019-2022
    const divTaxRate = year >= 2026 ? 0.16 : year >= 2025 ? 0.10 : year >= 2023 ? 0.08 : 0.05;
    const divTaxRateLabel = year >= 2026 ? '16%' : year >= 2025 ? '10%' : year >= 2023 ? '8%' : '5%';
    // Capital gains tax rate: 16% from 2026, 10% for 2025 and earlier
    const capGainsTaxRate = year >= 2026 ? 0.16 : 0.10;

    // From US broker data > declaratie > fidelity statement YTD > 1042-S > investment report
    let dividendsUSD = fd.dividends?.grossUSD || decl.dividends?.grossUSD || yd.fidelityDividendsYTD || f1042sDivUSD || inv.totalDividends || 0;
    let usDivTaxPaidUSD = fd.dividends?.foreignTaxUSD || yd.fidelityTaxWithheldYTD || f1042sTaxUSD || inv.taxWithheld || 0;
    let dividendsRON = fd.dividends?.grossRON || decl.dividends?.grossRON || 0;
    // Auto-compute dividendsRON from USD if no RON value available (e.g. 1042-S only)
    if (!dividendsRON && dividendsUSD > 0) dividendsRON = dividendsUSD * rate;
    let capitalGainsTaxableRON = fd.capitalGains?.taxableRON || decl.capitalGains?.taxableRON || 0;
    let capitalGainsSaleUSD = fd.capitalGains?.saleUSD || decl.capitalGains?.saleUSD || 0;
    let capitalGainsCostUSD = fd.capitalGains?.costUSD || decl.capitalGains?.costUSD || 0;
    let salaryDeduction = fd.capitalGains?.salaryDeductionRON || decl.capitalGains?.salaryDeductionRON || 0;
    let interestIncomeRON = adv.interestIncome || 0;
    let interestTaxRON = adv.interestTax || 0;
    let usCassTax = fd.cass?.cassRON || 0;
    let usTotalPaid = fd.totalPaid || 0;

    // From trade confirmations (US sold activity)
    let tradeProceedsUSD = trades.totalNet || 0;

    // Determine US broker sources from trades
    const tradeSources = new Set();
    if (Array.isArray(trades.trades)) {
      for (const t of trades.trades) {
        if (t.source === 'ms_statement') tradeSources.add('Morgan Stanley');
        else if (t.source === 'fidelity_statement') tradeSources.add('Fidelity');
        else tradeSources.add('Fidelity');
      }
    }
    // Also check msStatement and fidelity statement data
    if (yd.msStatement) tradeSources.add('Morgan Stanley');
    if (yd.fidelityTransfers || yd.fidelityDividendsYTD) tradeSources.add('Fidelity');
    if (fd.dividends) tradeSources.add('Fidelity');
    if (inv.totalDividends > 0) tradeSources.add('Fidelity');
    // Manual broker selection from Add Data form (free text)
    if (yd.usBroker) tradeSources.add(yd.usBroker);
    // Dividend sources
    const divSources = new Set();
    if (yd.msStatement && yd.msStatement.dividends > 0) divSources.add('Morgan Stanley');
    if (yd.msDividends > 0) divSources.add('Morgan Stanley');
    if (fd.dividends?.grossUSD > 0 || f1042sDivUSD > 0 || inv.totalDividends > 0 || yd.fidelityDividendsYTD > 0) divSources.add('Fidelity');
    // Manual broker for dividends too
    if (yd.usBroker) divSources.add(yd.usBroker);
    const usBrokerLabel = tradeSources.size > 0 ? ' (' + [...tradeSources].join(' & ') + ')' : '';
    const usDivBrokerLabel = divSources.size > 0 ? ' (' + [...divSources].join(' & ') + ')' : '';
    // Romania broker label
    const roSources = new Set();
    if (yd.xtbDividendsReport || yd.xtbPortfolio) roSources.add('XTB');
    if (yd.tradevillePortfolio) roSources.add('Tradeville');
    if (yd.roBroker) roSources.add(yd.roBroker);
    const roBrokerLabel = roSources.size > 0 ? ' (' + [...roSources].join(' & ') + ')' : '';
    // Use ledger allocations for ESPP cost basis (FIFO-computed server-side)
    const yearAlloc = ledgerAllocations[year] || {};
    // ANAF: only ESPP contributions (actual money paid) are deductible as cost basis
    // Fidelity cost basis (vest FMV) is NOT deductible — RSU shares are taxed on full sale proceeds
    if (!capitalGainsCostUSD && yearAlloc.esppCostUSD > 0) {
      capitalGainsCostUSD = yearAlloc.esppCostUSD;
    }
    if (!capitalGainsSaleUSD && tradeProceedsUSD > 0) {
      capitalGainsSaleUSD = trades.totalProceeds || 0;
    }
    if (!capitalGainsTaxableRON && tradeProceedsUSD > 0) {
      const costUSD = capitalGainsCostUSD || 0;
      capitalGainsTaxableRON = (tradeProceedsUSD - costUSD) * rate;
    }

    // Romania broker data from imported reports (XTB + Tradeville)
    const tvPort = yd.tradevillePortfolio || {};
    let dividendsRON_ro = xtbDiv.dividends?.grossRON || 0;
    let roLongTermGainRON = (xtbPort.longTerm?.gainRON || 0) + (tvPort.longTerm?.gainRON || 0);
    let roShortTermGainRON = (xtbPort.shortTerm?.gainRON || 0) + (tvPort.shortTerm?.gainRON || 0);
    let capitalGainsRON_ro = roLongTermGainRON + roShortTermGainRON;
    let roDivTaxWithheld = xtbDiv.dividends?.taxWithheldRON || 0;
    let roInterestRON = xtbDiv.interest?.grossRON || 0;
    let roPortTaxWithheld = (xtbPort.totalTaxWithheldRON || 0) + (tvPort.totalTaxWithheldRON || 0);
    // Stock withholding: sum only from entries assigned to this year
    const allAwardsForCalc = (window._cachedStockAwards || []);
    const yearAwards = allAwardsForCalc.filter(r => r._assignedYear === year);
    let withholding = yearAwards.reduce((s, r) => s + (parseFloat(r.stock_withholding) || 0), 0);

    // BIK (stock_award_bik + espp_gain_bik) = income already taxed as salary in Romania
    // This is the COST BASIS deducted from capital gains (D212 Rd.2 "Cheltuieli deductibile")
    // stock_withholding = TAX paid on BIK through payroll (shown as "already paid", NOT deducted from base)
    let salaryTaxedRON = yearAwards.reduce((s, r) => s + (parseFloat(r.stock_award_bik) || 0) + (parseFloat(r.espp_gain_bik) || 0), 0);

    // Manual overrides
    if (yd.salaryTaxedIncome !== undefined && yd.salaryTaxedIncome !== '') {
      salaryTaxedRON = parseFloat(yd.salaryTaxedIncome) || 0;
    }
    if (yd.fidelityCost !== undefined && yd.fidelityCost !== '') {
      capitalGainsCostUSD = parseFloat(yd.fidelityCost) || 0;
    }
    if (yd.fidelityDividends !== undefined && yd.fidelityDividends !== '') {
      dividendsUSD = parseFloat(yd.fidelityDividends) || 0;
      dividendsRON = dividendsUSD * rate;
    }
    if (yd.xtbDividends !== undefined && yd.xtbDividends !== '') dividendsRON_ro = parseFloat(yd.xtbDividends) || 0;
    if (yd.roDivTaxPaid !== undefined && yd.roDivTaxPaid !== '') roDivTaxWithheld = parseFloat(yd.roDivTaxPaid) || 0;
    if (yd.fidelityGains !== undefined && yd.fidelityGains !== '') {
      const gainsUSD = parseFloat(yd.fidelityGains) || 0;
      capitalGainsSaleUSD = gainsUSD;
      capitalGainsTaxableRON = (gainsUSD - capitalGainsCostUSD) * rate;
    }
    // Manual override: RO gains from country rows
    if (yd.roGainsCountries && yd.roGainsCountries.length > 0) {
      let manualLong = 0, manualShort = 0, manualTax = 0;
      for (const c of yd.roGainsCountries) {
        manualLong += c.longGain || 0;
        manualShort += c.shortGain || 0;
        manualTax += c.taxWithheld || 0;
      }
      roLongTermGainRON = manualLong;
      roShortTermGainRON = manualShort;
      capitalGainsRON_ro = manualLong + manualShort;
      roPortTaxWithheld = manualTax;
    }
    // Legacy single-field overrides (backward compat)
    if (yd.roGainsLong !== undefined && yd.roGainsLong !== '') roLongTermGainRON = parseFloat(yd.roGainsLong) || 0;
    if (yd.roGainsShort !== undefined && yd.roGainsShort !== '') roShortTermGainRON = parseFloat(yd.roGainsShort) || 0;
    if (yd.roGainsLong !== undefined || yd.roGainsShort !== undefined) capitalGainsRON_ro = roLongTermGainRON + roShortTermGainRON;
    if (yd.roGainsTaxWithheld !== undefined && yd.roGainsTaxWithheld !== '') roPortTaxWithheld = parseFloat(yd.roGainsTaxWithheld) || 0;
    if (yd.interestIncome !== undefined && yd.interestIncome !== '') interestIncomeRON = parseFloat(yd.interestIncome) || 0;
    if (yd.exchangeRate !== undefined && yd.exchangeRate !== '') {
      // recalc with new rate if manually entered
    }
    if (yd.stockWithholdingPaid !== undefined && yd.stockWithholdingPaid !== '') withholding = parseFloat(yd.stockWithholdingPaid) || 0;

    // Add Romania broker interest to total interest
    interestIncomeRON += roInterestRON;

    // Tax from declaration or US broker data (source of truth)
    // US dividends: US withholds 10% at source per RO-US treaty.
    // Romania taxes at divTaxRate. Credit fiscal = min(RO tax, US tax paid).
    // Difference to pay = max(0, RO tax - US credit).
    const usForeignTaxUSD = (yd.usDivTaxPaid !== undefined && yd.usDivTaxPaid !== '' ? parseFloat(yd.usDivTaxPaid) : null) ?? fd.dividends?.foreignTaxUSD ?? usDivTaxPaidUSD ?? 0;
    const usForeignTaxRON = fd.dividends?.foreignTaxRON || decl.dividends?.foreignTaxRON || Math.ceil(usForeignTaxUSD * rate);
    // US dividends: RO tax due minus credit for US tax already paid
    // If D-212 has been imported (ANAF-validated), use its values directly
    const usDivTaxDueRON = dividendsRON * divTaxRate;
    const hasAnafDecl = decl.anafXml || decl.anafFlatText;
    // If US effective withholding rate >= RO rate (within 0.5% tolerance for rounding),
    // the credit fiscal fully covers the Romanian tax — nothing to pay.
    const effectiveUSRate = dividendsUSD > 0 ? (usForeignTaxUSD / dividendsUSD) : 0;
    const rateFullyCovered = effectiveUSRate >= (divTaxRate - 0.005);
    const usDivCreditRON = hasAnafDecl ? (decl.dividends?.creditFiscalRON || 0)
      : rateFullyCovered ? usDivTaxDueRON
      : Math.min(usDivTaxDueRON, usForeignTaxRON);
    const usDivTax = hasAnafDecl
      ? (decl.dividends?.difImpozitRON || 0)
      : (fd.dividends?.toPayRON ?? Math.max(0, usDivTaxDueRON - usDivCreditRON));
    // Romania dividends: rate due but Romania broker withholds tax at source (credit fiscal covers it)
    const roDivTaxDue = dividendsRON_ro * divTaxRate;
    const roDivTaxNet = Math.max(0, roDivTaxDue - (roDivTaxWithheld || 0));
    const dividendTaxRON = usDivTax + roDivTaxNet;
    // US capital gains at capGainsTaxRate, Romania domestic rates:
    // 2019-2022: flat 10% (no long/short distinction)
    // 2023-2025: 1% long (>=1yr), 3% short (<1yr)
    // 2026+: 3% long, 6% short
    const tr = yd.taxRates || {};
    const defaultRoLong = year >= 2026 ? 3 : year >= 2023 ? 1 : 10;
    const defaultRoShort = year >= 2026 ? 6 : year >= 2023 ? 3 : 10;
    const roLongRate = (tr.roCapGainsLongRate != null ? tr.roCapGainsLongRate : defaultRoLong) / 100;
    const roShortRate = (tr.roCapGainsShortRate != null ? tr.roCapGainsShortRate : defaultRoShort) / 100;
    const roCapitalGainsTax = (roLongTermGainRON * roLongRate) + (roShortTermGainRON * roShortRate);
    // Romania capital gains: tax already withheld by XTB
    const roGainsTaxNet = Math.max(0, roCapitalGainsTax - (roPortTaxWithheld || 0));

    // US income: deduct salary-taxed BIK from US capital gains as cost basis
    // BIK (stock_award_bik) = income already taxed as salary in Romania, deducted from capital gains
    // Stock withholding = tax/CASS paid on the BIK through payroll (shown as "already paid", not deducted from base)
    const usNetGainsBeforeLosses = Math.max(0, capitalGainsTaxableRON - salaryTaxedRON);

    // Prior year losses (D212 Rd.5-6): carryforward up to 7 years, offset max 70% of current year gains
    const priorLosses = parseFloat(yd.priorLosses) || 0;
    const lossOffset = usNetGainsBeforeLosses > 0 ? Math.min(priorLosses, Math.floor(usNetGainsBeforeLosses * 0.7)) : 0;
    const usNetGainsRON = Math.max(0, usNetGainsBeforeLosses - lossOffset);
    const usGrossIncomeRON = capitalGainsTaxableRON + dividendsRON;
    const usNetIncomeRON = usNetGainsRON + dividendsRON;

    let capitalGainsTaxRON;
    if (fd.capitalGains?.taxPaidRON) {
      capitalGainsTaxRON = fd.capitalGains.taxPaidRON;
    } else if (hasAnafDecl && decl.capitalGains?.difImpozitRON != null) {
      capitalGainsTaxRON = decl.capitalGains.difImpozitRON;
    } else if (decl.capitalGains?.taxDueRON) {
      capitalGainsTaxRON = decl.capitalGains.taxDueRON;
    } else {
      capitalGainsTaxRON = usNetGainsRON * capGainsTaxRate + roGainsTaxNet;
    }
    const interestTaxRate = (tr.roInterestRate != null ? tr.roInterestRate / 100 : (year >= 2026 ? 0.16 : 0.10));
    const interestTaxGross = interestIncomeRON * interestTaxRate;
    const interestTaxPaid = (yd.interestTaxPaid !== undefined && yd.interestTaxPaid !== '' ? parseFloat(yd.interestTaxPaid) : null) ?? adv.interestTax ?? 0;
    const interestTax = Math.max(0, interestTaxGross - interestTaxPaid);

    // ---- Additional income types ----
    // Rental income: 10% on net income (40% flat rate deduction per Cod Fiscal art. 84)
    const rentalGross = parseFloat(yd.rentalIncome) || 0;
    const rentalTaxPaid = parseFloat(yd.rentalTaxPaid) || 0;
    const rentalNet = rentalGross * 0.6; // 40% deduction
    const rentalTaxRate = interestTaxRate; // same as other income: 10% (2025) / 16% (2026+)
    const rentalTaxDue = rentalNet * rentalTaxRate;
    const rentalTaxToPay = Math.max(0, rentalTaxDue - rentalTaxPaid);

    // Intellectual property / royalties: 10% on net income (40% flat rate deduction per Cod Fiscal art. 72-73)
    const royaltyGross = parseFloat(yd.royaltyIncome) || 0;
    const royaltyTaxPaid = parseFloat(yd.royaltyTaxPaid) || 0;
    const royaltyNet = royaltyGross * 0.6; // 40% deduction
    const royaltyTaxRate = interestTaxRate;
    const royaltyTaxDue = royaltyNet * royaltyTaxRate;
    const royaltyTaxToPay = Math.max(0, royaltyTaxDue - royaltyTaxPaid);

    // Gambling income: already taxed at source (final tax), only counts for CASS
    const gamblingIncomeManual = parseFloat(yd.gamblingIncome) || 0;
    const gamblingTaxPaidManual = parseFloat(yd.gamblingTaxPaid) || 0;
    const gamblingIncomeTotal = gamblingIncomeManual || (adv.gamblingIncome || 0);
    const gamblingTaxTotal = gamblingTaxPaidManual || (adv.gamblingTax || 0);

    // Other income sources: 10% (2025) / 16% (2026+) on gross
    const otherGross = parseFloat(yd.otherIncome) || 0;
    const otherTaxPaid = parseFloat(yd.otherTaxPaid) || 0;
    const otherTaxRate = interestTaxRate;
    const otherTaxDue = otherGross * otherTaxRate;
    const otherTaxToPay = Math.max(0, otherTaxDue - otherTaxPaid);

    // CASS base: income for CASS threshold per D212 pct. 51
    // Dividends: gross minus withheld tax (pct. 51: "dividendele plătite, diminuate cu impozitul reținut")
    // Interest: gross minus withheld tax (pct. 51: "sumele plătite, diminuate cu impozitul reținut")
    // Capital gains: net gain (gains - losses), NOT minus tax withheld (pct. 51: "câștigul net din investiții")
    // Rental/Royalty: net income after 40% deduction (pct. 51: "veniturile nete")
    // Other income: gross (pct. 51: "venitul brut din alte surse")
    const usDivNetRON = dividendsRON - usForeignTaxRON;
    const roDivNetRON = dividendsRON_ro - (roDivTaxWithheld || 0);
    const totalDividendsRON_cass = Math.max(0, usDivNetRON) + Math.max(0, roDivNetRON);
    const totalDividendsRON = dividendsRON + dividendsRON_ro;
    const totalCapitalGainsRON = capitalGainsTaxableRON + capitalGainsRON_ro;
    const interestNetRON = Math.max(0, interestIncomeRON - interestTaxPaid);
    const totalAlreadyPaid = usForeignTaxRON + withholding + (roPortTaxWithheld || 0) + (roDivTaxWithheld || 0) + interestTaxPaid + rentalTaxPaid + royaltyTaxPaid + gamblingTaxTotal + otherTaxPaid;
    // Capital gains for CASS: use net gain (gross - cost basis), do NOT subtract broker tax withheld
    const usNetCapGainsRON_cass = Math.max(0, capitalGainsTaxableRON - salaryTaxedRON);
    const roNetCapGainsRON_cass = Math.max(0, capitalGainsRON_ro);
    // Include income types for CASS per D212 pct. 50.1 and pct. 51:
    // - investiții: dividends (net of tax), capital gains (net gain), interest (net of tax) ✓
    // - cedarea folosinței bunurilor (rental): net income (after 40% deduction) ✓
    // - drepturi de proprietate intelectuală (royalties): net income (after 40% deduction) ✓
    // - alte surse (other income): gross ✓ (pct. 50.1 lit. f + pct. 51)
    // NOT included: gambling (Art. 110 - impozit final reținut la sursă)
    const rentalNetCass = rentalNet;
    const royaltyNetCass = royaltyNet;
    const totalInvestmentIncome_cass = Math.max(0, totalDividendsRON_cass + usNetCapGainsRON_cass + roNetCapGainsRON_cass + interestNetRON + rentalNetCass + royaltyNetCass + otherGross);
    const totalInvestmentIncome = totalDividendsRON + totalCapitalGainsRON + interestIncomeRON + gamblingIncomeTotal + rentalGross + royaltyGross + otherGross;
    const savedMinSalary = (yd.minSalary !== undefined && yd.minSalary !== '') ? parseFloat(yd.minSalary) : null;
    const cassResult = calculateCASS(totalInvestmentIncome_cass, year, savedMinSalary, 'investment');
    let cassTax = usCassTax || decl.cassContribution || cassResult.amount;
    let cassApplies = cassResult.applies;
    const cassInfo = cassResult;

    const incomeTaxGross = decl.totalTax || (dividendTaxRON + capitalGainsTaxRON + interestTax + rentalTaxToPay + royaltyTaxToPay + otherTaxToPay);
    const incomeTaxOnly = incomeTaxGross;
    const totalTax = incomeTaxOnly + cassTax;

    return {
      dividendsUSD,
      dividendsRON,
      dividendsRON_ro,
      capitalGainsSaleUSD,
      capitalGainsCostUSD,
      capitalGainsTaxableRON,
      capitalGainsRON_ro,
      roLongTermGainRON,
      roShortTermGainRON,
      salaryDeduction,
      interestIncomeRON,
      exchangeRate: rate,
      divTaxRate,
      divTaxRateLabel,
      capGainsTaxRate,
      interestTaxRate,
      roLongRate,
      roShortRate,
      dividendTaxRON,
      usDivTax,
      roDivTaxNet,
      capitalGainsTaxRON,
      interestTax,
      interestTaxPaid,
      salaryTaxedRON,
      cassTax,
      cassApplies,
      cassInfo,
      totalIncome: totalInvestmentIncome,
      totalIncome_cass: totalInvestmentIncome_cass,
      incomeTaxOnly,
      totalTax,
      stockWithholding: withholding,
      // From trade confirmations
      tradeProceedsUSD,
      tradeCount: trades.count || 0,
      tradeShares: trades.totalShares || 0,
      esppPurchaseCount: trades.purchases || 0,
      esppGainUSD: trades.totalEsppGain || 0,
      esppContributionsUSD: trades.totalEsppContributions || 0,
      esppSharesCount: trades.totalEsppShares || 0,
      // Ledger FIFO allocations for this year
      esppSharesConsumed: yearAlloc.esppSharesConsumed || 0,
      esppCostAllocatedUSD: yearAlloc.esppCostUSD || 0,
      // Romania broker data
      roDivTaxWithheld,
      roPortTaxWithheld,
      roInterestRON,
      // From investment report
      accountValue: inv.accountValue || 0,
      unrealizedGainLoss: inv.netGains || 0,
      paymentDeadline: yd.d212Deadline || fd.paymentDeadline || decl.paymentDeadline || '',
      // Historical paid data
      usTotalPaid: usTotalPaid,
      usDivToPayRON: fd.dividends?.toPayRON ?? null,
      usDivCreditRON: fd.dividends?.creditRON ?? usDivCreditRON,
      usDivForeignTaxRON: fd.dividends?.foreignTaxRON ?? decl.dividends?.foreignTaxRON ?? usForeignTaxRON,
      usDivForeignTaxUSD: fd.dividends?.foreignTaxUSD ?? usForeignTaxUSD,
      // Gambling income
      gamblingIncome: gamblingIncomeTotal,
      gamblingTax: gamblingTaxTotal,
      // Rental income
      rentalGross,
      rentalNet,
      rentalTaxPaid,
      rentalTaxToPay,
      // Royalty income
      royaltyGross,
      royaltyNet,
      royaltyTaxPaid,
      royaltyTaxToPay,
      // Other income
      otherGross,
      otherTaxPaid,
      otherTaxToPay,
      // Broker labels
      usBrokerLabel,
      usDivBrokerLabel,
      roBrokerLabel,
      // US net income after withholding
      usGrossIncomeRON,
      usNetIncomeRON,
      usNetGainsRON,
      // Prior year losses (D212 Rd.5-6)
      priorLosses,
      lossOffset,
      incomeTaxGross,
      totalAlreadyPaid
    };
  }

  // ============ DASHBOARD ============
  function renderDashboard() {
    const data = computeYearData(selectedYear);

    document.getElementById('total-income-value').textContent = fmt(data.totalIncome);
    document.getElementById('already-paid-value').textContent = fmt(data.totalAlreadyPaid);
    document.getElementById('cass-value').textContent = fmt(data.cassTax);
    document.getElementById('total-tax-value').textContent = fmt(data.incomeTaxOnly);

    // Show losses tile only when prior losses exist
    const lossCard = document.getElementById('card-losses');
    if (lossCard) {
      if (data.lossOffset > 0) {
        lossCard.style.display = '';
        document.getElementById('loss-offset-value').textContent = '-' + fmt(data.lossOffset);
      } else {
        lossCard.style.display = 'none';
      }
    }

    // Charts - only show if there's actual financial data
    const allYears = Object.keys(appData.years || {}).map(Number).sort((a, b) => a - b);
    const manualKeys = new Set(['year','exchangeRate','minSalary','d212Deadline','usBroker','roBroker','taxRates',
      'fidelityDividends','usDivTaxPaid','xtbDividends','roDivTaxPaid','fidelityGains','fidelityCost',
      'interestIncome','interestTaxPaid','rentalIncome','rentalTaxPaid','royaltyIncome','royaltyTaxPaid',
      'gamblingIncome','gamblingTaxPaid','otherIncome','otherTaxPaid','stockWithholdingPaid','salaryTaxedIncome',
      'roGainsCountries','roGainsLong','roGainsShort','roGainsTaxWithheld']);
    const hasFinancialData = allYears.some(y => {
      const yd = appData.years?.[y];
      if (!yd) return false;
      // Check for imported document data (non-manual keys with actual values)
      return Object.entries(yd).some(([k, v]) => !manualKeys.has(k) && v !== '' && v !== null && v !== undefined);
    });

    const incomeChartContainer = document.getElementById('chart-income-breakdown')?.closest('.chart-card');
    const taxChartContainer = document.getElementById('chart-tax-breakdown')?.closest('.chart-card');
    const yearChartContainer = document.getElementById('chart-year-comparison')?.closest('.chart-card');
    const rateChartContainer = document.getElementById('chart-exchange-rates')?.closest('.chart-card');
    const salaryChartContainer = document.getElementById('chart-min-salary')?.closest('.chart-card');
    const d212ChartContainer = document.getElementById('chart-d212-payment')?.closest('.chart-card');

    if (hasFinancialData) {
      if (incomeChartContainer) incomeChartContainer.style.display = '';
      if (taxChartContainer) taxChartContainer.style.display = '';
      if (yearChartContainer) yearChartContainer.style.display = '';
      if (rateChartContainer) rateChartContainer.style.display = '';
      if (salaryChartContainer) salaryChartContainer.style.display = '';
      if (d212ChartContainer) d212ChartContainer.style.display = '';

      Charts.createIncomeBreakdown('chart-income-breakdown', {
        dividends: (data.dividendsRON || data.dividendsUSD * data.exchangeRate) + data.dividendsRON_ro,
        capitalGains: data.capitalGainsTaxableRON + data.capitalGainsRON_ro,
        interestIncome: data.interestIncomeRON,
        rentalIncome: data.rentalGross || 0,
        royaltyIncome: data.royaltyGross || 0,
        otherIncome: (data.gamblingIncome || 0) + (data.otherGross || 0)
      });

      Charts.createTaxBreakdown('chart-tax-breakdown', {
        dividendTax: data.dividendTaxRON,
        capitalGainsTax: data.capitalGainsTaxRON,
        interestTax: data.interestTax,
        rentalTax: data.rentalTaxToPay || 0,
        royaltyTax: data.royaltyTaxToPay || 0,
        otherTax: data.otherTaxToPay || 0,
        cassTax: data.cassTax
      });

      // Year comparison — only years with actual data
      const allCompData = {};
      const yearsUpToSelected = allYears.filter(y => y <= selectedYear).sort((a, b) => a - b);
      for (const y of yearsUpToSelected) {
        const yData = appData.years?.[y];
        const hasImports = yData && Object.entries(yData).some(([k, v]) => !manualKeys.has(k) && v !== '' && v !== null && v !== undefined);
        if (!hasImports) continue;
        const yd = computeYearData(y);
        allCompData[y] = { totalIncome: yd.totalIncome, totalTax: yd.totalTax };
      }
      Charts.createYearComparison('chart-year-comparison', allCompData, 5);

      // Exchange rates - show up to selected year
      const rateData = {};
      for (const [y, r] of Object.entries(exchangeRates)) {
        if (parseInt(y) <= selectedYear) rateData[y] = r.usdRon;
      }
      Charts.createExchangeRates('chart-exchange-rates', rateData, 5, selectedYear);

      // Min salary chart - show up to selected year
      const salaryData = {};
      for (const [y, info] of Object.entries(cassThresholds)) {
        if (parseInt(y) <= selectedYear) salaryData[y] = info.minSalary;
      }
      Charts.createMinSalaryChart('chart-min-salary', salaryData, 5, selectedYear);

      // D212 Total Taxes chart (grouped: already paid, income tax, CASS)
      // Only show years up to selected year that have actual imported financial data
      const d212PaymentData = {};
      for (const y of allYears) {
        if (y > selectedYear) continue;
        const yData = appData.years?.[y];
        const hasImports = yData && Object.entries(yData).some(([k, v]) => !manualKeys.has(k) && v !== '' && v !== null && v !== undefined);
        if (!hasImports) continue;
        const yd = computeYearData(y);
        d212PaymentData[y] = { paid: yd.totalAlreadyPaid, tax: yd.incomeTaxOnly, cass: yd.cassTax };
      }
      Charts.createD212PaymentChart('chart-d212-payment', d212PaymentData, 5, selectedYear);
    } else {
      if (incomeChartContainer) incomeChartContainer.style.display = 'none';
      if (taxChartContainer) taxChartContainer.style.display = 'none';
      if (yearChartContainer) yearChartContainer.style.display = 'none';
      if (rateChartContainer) rateChartContainer.style.display = 'none';
      const salaryContainer = document.getElementById('chart-min-salary')?.closest('.chart-card');
      if (salaryContainer) salaryContainer.style.display = 'none';
      const d212Container = document.getElementById('chart-d212-payment')?.closest('.chart-card');
      if (d212Container) d212Container.style.display = 'none';
    }
  }

  // ============ INCOME TABLE ============
  function renderIncomeTable() {
    const data = computeYearData(selectedYear);
    const tbody = document.getElementById('income-tbody');
    const tfoot = document.getElementById('income-tfoot');

    const rows = [
      {
        cat: I18n.t('income.usDividends') + data.usDivBrokerLabel,
        usd: data.dividendsUSD,
        rate: data.exchangeRate,
        ron: data.dividendsRON || data.dividendsUSD * data.exchangeRate,
        usTaxRate: data.dividendsUSD > 0 ? '10%' : '-',
        usTaxPaid: data.usDivForeignTaxUSD || 0,
        taxRate: '-',
        paid: data.usDivForeignTaxRON || 0,
        tax: data.usDivTax
      },
      {
        cat: I18n.t('income.roDividends') + data.roBrokerLabel + (data.roDivTaxWithheld ? ' ' + I18n.t('misc.creditFiscal') : ''),
        usd: '-',
        rate: '-',
        ron: data.dividendsRON_ro,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: data.divTaxRateLabel,
        paid: data.roDivTaxWithheld || 0,
        tax: Math.max(0, data.dividendsRON_ro * data.divTaxRate - (data.roDivTaxWithheld || 0)),
        tooltip: data.roDivTaxWithheld ? I18n.t('misc.creditFiscalTooltip') : undefined
      },
      {
        cat: I18n.t('income.usGains') + data.usBrokerLabel + (data.tradeCount ? ` (${data.tradeCount} ${I18n.t('misc.sales') || 'sales'})` : ''),
        usd: data.capitalGainsSaleUSD || data.tradeProceedsUSD || 0,
        rate: data.exchangeRate,
        ron: Math.round(data.usNetGainsRON),
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.capGainsTaxRate * 100) + '%',
        paid: 0,
        tax: Math.round(data.usNetGainsRON * data.capGainsTaxRate),
        tooltip: (data.capitalGainsCostUSD > 0 || data.salaryTaxedRON > 0 || data.lossOffset > 0) ? (() => {
          const saleUSD = data.capitalGainsSaleUSD || data.tradeProceedsUSD || 0;
          const costUSD = data.capitalGainsCostUSD || 0;
          const fmtN = (v) => v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
          const fmtR = (v) => Math.round(v).toLocaleString('ro-RO');
          let tip = '';
          if (costUSD > 0) tip += '(' + fmtN(saleUSD) + ' - ' + fmtN(costUSD) + ') × ' + data.exchangeRate.toFixed(4) + ' = ' + fmtR((saleUSD - costUSD) * data.exchangeRate) + ' RON';
          if (data.salaryTaxedRON > 0) tip += (tip ? ' → ' : '') + '- BIK ' + fmtR(data.salaryTaxedRON);
          if (data.lossOffset > 0) tip += (tip ? ' → ' : '') + '- ' + (I18n.t('taxes.earnPriorLossOffset') || 'Prior losses') + ' ' + fmtR(data.lossOffset);
          tip += (tip ? ' = ' : '') + fmtR(data.usNetGainsRON) + ' RON';
          return tip;
        })() : undefined
      },
      ...(data.capitalGainsCostUSD > 0 ? [{
        cat: '↳ ' + (I18n.t('misc.costBasisTooltip') || 'ESPP contributions deducted'),
        usd: -data.capitalGainsCostUSD,
        rate: '-',
        ron: '-',
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: '-',
        paid: 0,
        tax: 0,
        isDeduction: true
      }] : []),
      ...(data.salaryTaxedRON > 0 ? [{
        cat: '↳ ' + (I18n.t('income.salaryTaxedDeduction') || 'Income already taxed as salary (BIK)'),
        usd: '-',
        rate: '-',
        ron: -data.salaryTaxedRON,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: '-',
        paid: 0,
        tax: 0,
        isDeduction: true,
        tooltip: (I18n.t('misc.bikBreakdownTooltip') || 'Stock award BIK from imported documents, allocated via FIFO to sales in this year') + '. ' + (I18n.t('misc.taxableAfterBik') || 'Taxable after BIK') + ': ' + Math.round(Math.max(0, (data.capitalGainsTaxableRON || 0) - data.salaryTaxedRON)).toLocaleString('ro-RO') + ' RON'
      }] : []),
      ...(data.lossOffset > 0 ? [{
        cat: '↳ ' + (I18n.t('income.priorLossDeduction') || 'Prior year losses offset (D212 Rd.5-6)'),
        usd: '-',
        rate: '-',
        ron: -data.lossOffset,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: '-',
        paid: 0,
        tax: 0,
        isDeduction: true,
        tooltip: (I18n.t('misc.priorLossTooltip') || 'Capital losses from previous years') + ': ' + Math.round(data.priorLosses).toLocaleString('ro-RO') + ' RON. ' + (I18n.t('misc.lossOffsetApplied') || 'Offset applied (max 70%)') + ': ' + Math.round(data.lossOffset).toLocaleString('ro-RO') + ' RON'
      }] : []),
      ...(data.esppPurchaseCount > 0 ? [{
        cat: (I18n.t('income.esppPurchases') || 'US ESPP Stock Purchases') + data.usBrokerLabel + ` (${data.esppPurchaseCount} ${I18n.t('misc.purchases') || 'purchases'})`,
        usd: data.esppContributionsUSD,
        rate: data.exchangeRate,
        ron: data.esppContributionsUSD * data.exchangeRate,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: '-',
        paid: 0,
        tax: 0,
        isInfo: true,
        tooltip: (I18n.t('misc.esppGainTooltip') || 'ESPP gain') + ': $' + data.esppGainUSD.toFixed(2) + ' (' + data.esppSharesCount + ' shares)'
      }] : []),
      {
        cat: I18n.t('income.roGainsLong') + data.roBrokerLabel + ' ' + I18n.t('misc.roWithheld'),
        usd: '-',
        rate: '-',
        ron: data.roLongTermGainRON,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.roLongRate * 100) + '%',
        paid: data.roPortTaxWithheld > 0 ? Math.min(data.roPortTaxWithheld, data.roLongTermGainRON * data.roLongRate) : data.roLongTermGainRON * data.roLongRate,
        tax: 0,
        tooltip: I18n.t('misc.roWithheldTooltip')
      },
      {
        cat: I18n.t('income.roGainsShort') + data.roBrokerLabel + ' ' + I18n.t('misc.roWithheld'),
        usd: '-',
        rate: '-',
        ron: data.roShortTermGainRON,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.roShortRate * 100) + '%',
        paid: data.roShortTermGainRON * data.roShortRate,
        tax: 0,
        tooltip: I18n.t('misc.roWithheldTooltip')
      },
      {
        cat: I18n.t('income.interestIncome') + (data.interestTax === 0 && (data.interestTaxPaid || 0) > 0 ? ' ' + I18n.t('misc.roWithheld') : ''),
        usd: '-',
        rate: '-',
        ron: data.interestIncomeRON,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.interestTaxRate * 100) + '%',
        paid: data.interestTaxPaid || 0,
        tax: data.interestTax,
        tooltip: (data.interestTax === 0 && (data.interestTaxPaid || 0) > 0) ? I18n.t('misc.roWithheldTooltip') : undefined
      }
    ];

    // Add gambling income if present
    if (data.gamblingIncome > 0) {
      rows.push({
        cat: I18n.t('income.gamblingIncome') + ((data.gamblingTax || 0) > 0 ? ' ' + I18n.t('misc.roWithheld') : ''),
        usd: '-',
        rate: '-',
        ron: data.gamblingIncome,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: '10%',
        paid: data.gamblingTax || 0,
        tax: 0,  // Already withheld at source
        tooltip: (data.gamblingTax || 0) > 0 ? I18n.t('misc.roWithheldTooltip') : undefined
      });
    }

    // Add rental income if present
    if (data.rentalGross > 0) {
      rows.push({
        cat: I18n.t('income.rentalIncome') + (data.rentalTaxToPay === 0 && (data.rentalTaxPaid || 0) > 0 ? ' ' + I18n.t('misc.roWithheld') : ''),
        usd: '-',
        rate: '-',
        ron: data.rentalGross,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.interestTaxRate * 100) + '% *',
        paid: data.rentalTaxPaid || 0,
        tax: data.rentalTaxToPay,
        tooltip: I18n.t('income.deductionNote') + (data.rentalTaxToPay === 0 && (data.rentalTaxPaid || 0) > 0 ? ' ' + I18n.t('misc.roWithheldTooltip') : '')
      });
    }

    // Add royalty income if present
    if (data.royaltyGross > 0) {
      rows.push({
        cat: I18n.t('income.royaltyIncome') + (data.royaltyTaxToPay === 0 && (data.royaltyTaxPaid || 0) > 0 ? ' ' + I18n.t('misc.roWithheld') : ''),
        usd: '-',
        rate: '-',
        ron: data.royaltyGross,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.interestTaxRate * 100) + '% *',
        paid: data.royaltyTaxPaid || 0,
        tax: data.royaltyTaxToPay,
        tooltip: I18n.t('income.deductionNote') + (data.royaltyTaxToPay === 0 && (data.royaltyTaxPaid || 0) > 0 ? ' ' + I18n.t('misc.roWithheldTooltip') : '')
      });
    }

    // Add other income if present
    if (data.otherGross > 0) {
      rows.push({
        cat: I18n.t('income.otherIncome') + (data.otherTaxToPay === 0 && (data.otherTaxPaid || 0) > 0 ? ' ' + I18n.t('misc.roWithheld') : ''),
        usd: '-',
        rate: '-',
        ron: data.otherGross,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.interestTaxRate * 100) + '%',
        paid: data.otherTaxPaid || 0,
        tax: data.otherTaxToPay,
        tooltip: (data.otherTaxToPay === 0 && (data.otherTaxPaid || 0) > 0) ? I18n.t('misc.roWithheldTooltip') : undefined
      });
    }

    const totalPaid = rows.reduce((s, r) => s + (r.paid || 0), 0);
    const totalUsTaxPaid = rows.reduce((s, r) => s + (r.usTaxPaid || 0), 0);

    const deductionTooltip = I18n.t('income.deductionNote');
    tbody.innerHTML = rows.map(r => {
      let attrs = '';
      if (r.isDeduction) {
        attrs = ` style="color:var(--success);font-size:0.9em;${r.tooltip ? 'cursor:help;' : ''}"${r.tooltip ? ` title="${esc(r.tooltip)}"` : ''}`;
      } else if (r.tooltip) {
        attrs = ` title="${esc(r.tooltip)}" style="cursor:help;"`;
      }
      return `<tr${attrs}>
        <td>${esc(r.cat)}</td>
        <td>${r.usd === '-' ? '-' : fmtUSD(r.usd)}</td>
        <td>${r.rate === '-' ? '-' : (typeof r.rate === 'number' ? r.rate.toFixed(4) : r.rate)}</td>
        <td>${fmt(r.ron)}</td>
        <td>${r.usTaxRate}</td>
        <td>${fmtUSD(r.usTaxPaid)}</td>
        <td>${r.taxRate}</td>
        <td>${r.paid !== undefined ? fmt(r.paid) : '-'}</td>
        <td>${fmt(r.tax)}</td>
      </tr>`;
    }).join('');

    const hasDeduction = (data.rentalGross > 0) || (data.royaltyGross > 0);
    const totalRON = rows.reduce((s, r) => s + (typeof r.ron === 'number' && !r.isDeduction ? r.ron : 0), 0);
    const totalTax = rows.reduce((s, r) => s + (r.tax || 0), 0);
    tfoot.innerHTML = `
      <tr>
        <td colspan="3"><strong>${I18n.t('income.total')}</strong></td>
        <td><strong>${fmt(totalRON)}</strong></td>
        <td></td>
        <td><strong>${fmt(totalUsTaxPaid)}</strong></td>
        <td></td>
        <td><strong>${fmt(totalPaid)}</strong></td>
        <td><strong>${fmt(totalTax)}</strong></td>
      </tr>
      ${hasDeduction ? `<tr><td colspan="9" style="font-size:0.75rem;color:var(--text-muted);border:none;padding-top:0.5rem;">* ${I18n.t('income.deductionNote')}</td></tr>` : ''}
    `;
  }

  // ============ WITHHOLDING TABLE ============
  async function renderWithholdingTable() {
    const tbody = document.getElementById('withholding-tbody');
    const tfoot = document.getElementById('withholding-tfoot');
    const toolbar = document.getElementById('bik-toolbar');
    const selectAllCb = document.getElementById('bik-select-all');
    const headerCb = document.getElementById('bik-header-cb');
    const yearSelect = document.getElementById('bik-year-select');
    const assignBtn = document.getElementById('bik-assign-btn');
    const unassignBtn = document.getElementById('bik-unassign-btn');
    if (!tbody) return;

    try {
      const resp = await fetch('/api/stock-awards');
      const data = await resp.json();
      const allAwards = data.awards || [];
      window._cachedStockAwards = allAwards; // cache for computeYearData

      // Parse year from datastat date string
      function parseAwardYear(dateStr) {
        if (!dateStr) return null;
        let m = dateStr.match(/(\d{4})$/);  // DD.MM.YYYY or ends with YYYY
        if (m) return parseInt(m[1], 10);
        m = dateStr.match(/(\d{2})$/);       // DD-Mon-YY
        if (m) { let y = parseInt(m[1], 10); return y < 100 ? y + 2000 : y; }
        return null;
      }

      // Show: entries assigned to selected year + unassigned entries up to selected year
      const currentYr = selectedYear || new Date().getFullYear();
      const awards = allAwards.filter(r => {
        if (r._assignedYear != null) return r._assignedYear === currentYr; // only show if assigned to this year
        const yrFromDate = parseAwardYear(r.datastat);
        return !yrFromDate || yrFromDate <= currentYr; // show unassigned only if date <= selected year
      });

      if (!awards.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">' + I18n.t('misc.noWithholdingData') + '</td></tr>';
        tfoot.innerHTML = '';
        if (toolbar) toolbar.classList.add('hidden');
        return;
      }

      if (toolbar) toolbar.classList.remove('hidden');

      // Populate year dropdown
      const years = [];
      for (let y = currentYr - 5; y <= currentYr + 1; y++) years.push(y);
      yearSelect.innerHTML = years.map(y =>
        `<option value="${y}" ${y === currentYr ? 'selected' : ''}>${y}</option>`
      ).join('');

      // Render rows
      let assignedWH = 0, assignedBIK = 0, unassignedWH = 0, unassignedBIK = 0;
      tbody.innerHTML = awards.map((r, i) => {
        const rawDate = r.datastat || '-';
        const date = normalizeDate(rawDate);
        const bik = (parseFloat(r.stock_award_bik) || 0) + (parseFloat(r.espp_gain_bik) || 0);
        const wh = parseFloat(r.stock_withholding) || 0;
        if (r._assignedYear != null) { assignedBIK += bik; assignedWH += wh; }
        else { unassignedBIK += bik; unassignedWH += wh; }
        const assignedLabel = r._assignedYear
          ? `<span class="espp-assigned-badge">${r._assignedYear}</span>`
          : `<span class="espp-unassigned">${I18n.t('espp.notAssigned')}</span>`;
        const rowClass = r._assignedYear ? 'espp-row-assigned' : 'espp-row-unassigned';
        return `<tr class="${rowClass}" data-db-id="${r._dbId}">
          <td><input type="checkbox" class="bik-row-cb" data-db-id="${r._dbId}"></td>
          <td>${i + 1}</td>
          <td>${esc(String(date))}</td>
          <td>${fmt(bik)}</td>
          <td>${fmt(wh)}</td>
          <td class="espp-assigned-cell">${assignedLabel}</td>
        </tr>`;
      }).join('');

      const assigned = awards.filter(r => r._assignedYear != null);
      const unassignedCount = awards.length - assigned.length;
      tfoot.innerHTML = `<tr class="espp-row-assigned">
        <td></td>
        <td colspan="2"><strong>${I18n.t('espp.assigned')} (${assigned.length})</strong></td>
        <td><strong>${fmt(assignedBIK)}</strong></td>
        <td><strong>${fmt(assignedWH)}</strong></td>
        <td></td>
      </tr>` + (unassignedCount > 0 ? `<tr class="espp-row-unassigned">
        <td></td>
        <td colspan="2"><strong>${I18n.t('espp.notAssigned')} (${unassignedCount})</strong></td>
        <td><strong>${fmt(unassignedBIK)}</strong></td>
        <td><strong>${fmt(unassignedWH)}</strong></td>
        <td></td>
      </tr>` : '');

      // Selection logic
      function getSelectedIds() {
        return [...tbody.querySelectorAll('.bik-row-cb:checked')].map(cb => Number(cb.dataset.dbId));
      }
      function updateToolbar() {
        const sel = getSelectedIds();
        assignBtn.disabled = sel.length === 0;
        unassignBtn.disabled = sel.length === 0;
      }
      tbody.querySelectorAll('.bik-row-cb').forEach(cb => cb.addEventListener('change', updateToolbar));
      const allCbs = () => tbody.querySelectorAll('.bik-row-cb');
      const syncHeaderCb = () => {
        const cbs = allCbs();
        const allChecked = cbs.length > 0 && [...cbs].every(c => c.checked);
        if (headerCb) headerCb.checked = allChecked;
        if (selectAllCb) selectAllCb.checked = allChecked;
      };
      tbody.addEventListener('change', syncHeaderCb);
      const toggleAll = (checked) => { allCbs().forEach(cb => { cb.checked = checked; }); updateToolbar(); };
      if (headerCb) headerCb.onchange = () => { toggleAll(headerCb.checked); if (selectAllCb) selectAllCb.checked = headerCb.checked; };
      if (selectAllCb) selectAllCb.onchange = () => { toggleAll(selectAllCb.checked); if (headerCb) headerCb.checked = selectAllCb.checked; };

      assignBtn.onclick = async () => {
        const ids = getSelectedIds();
        if (!ids.length) return;
        const yr = parseInt(yearSelect.value, 10);
        assignBtn.disabled = true;
        try {
          const r = await fetch('/api/stock-awards/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, assignedYear: yr })
          });
          const result = await r.json();
          if (result.success) {
            showToast(I18n.t('bik.assignSuccess', { count: result.updated, year: yr }), 'success');
            invalidateComputeCache();
            render();
          } else { showToast(result.error, 'error'); }
        } catch (err) { showToast(err.message, 'error'); }
        assignBtn.disabled = false;
      };

      unassignBtn.onclick = async () => {
        const ids = getSelectedIds();
        if (!ids.length) return;
        unassignBtn.disabled = true;
        try {
          const r = await fetch('/api/stock-awards/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, assignedYear: null })
          });
          const result = await r.json();
          if (result.success) {
            showToast(I18n.t('bik.unassignSuccess', { count: result.updated }), 'success');
            invalidateComputeCache();
            render();
          } else { showToast(result.error, 'error'); }
        } catch (err) { showToast(err.message, 'error'); }
        unassignBtn.disabled = false;
      };

    } catch {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">' + I18n.t('misc.noWithholdingData') + '</td></tr>';
      tfoot.innerHTML = '';
    }
  }

  // ============ XTB TRADES TABLE ============
  function renderRoTradesTable() {
    const tbody = document.getElementById('ro-trades-tbody');
    const tfoot = document.getElementById('ro-trades-tfoot');
    if (!tbody) return;

    const data = computeYearData(selectedYear);
    const yd = appData.years?.[selectedYear] || {};
    const xtbPort = yd.xtbPortfolio || {};
    const xtbDiv = yd.xtbDividendsReport || {};
    const tvPort = yd.tradevillePortfolio || {};

    if (!xtbPort.longTerm && !xtbPort.shortTerm && !xtbDiv.dividends && !tvPort.longTerm && !tvPort.shortTerm) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">' + I18n.t('misc.noRoData') + '</td></tr>';
      tfoot.innerHTML = '';
      return;
    }

    const rows = [];
    // XTB data
    if (xtbPort.longTerm?.gainRON) {
      rows.push({
        cat: I18n.t('income.roGainsLong') + ' (XTB)',
        country: xtbPort.country || 'USA',
        gross: xtbPort.longTerm.gainRON,
        rate: (data.roLongRate * 100) + '%',
        withheld: xtbPort.longTerm.taxWithheldRON || 0,
        net: Math.max(0, xtbPort.longTerm.gainRON * data.roLongRate - (xtbPort.longTerm.taxWithheldRON || 0))
      });
    }
    if (xtbPort.shortTerm?.gainRON) {
      rows.push({
        cat: I18n.t('income.roGainsShort') + ' (XTB)',
        country: xtbPort.country || 'USA',
        gross: xtbPort.shortTerm.gainRON,
        rate: (data.roShortRate * 100) + '%',
        withheld: xtbPort.shortTerm.taxWithheldRON || 0,
        net: Math.max(0, xtbPort.shortTerm.gainRON * data.roShortRate - (xtbPort.shortTerm.taxWithheldRON || 0))
      });
    }
    // Tradeville data (per country)
    if (tvPort.countries && tvPort.countries.length > 0) {
      for (const c of tvPort.countries) {
        if (c.longGain > 0 || c.longLoss > 0) {
          rows.push({
            cat: I18n.t('income.roGainsLong') + ' (Tradeville)',
            country: c.country,
            gross: c.longGain - c.longLoss,
            rate: (data.roLongRate * 100) + '%',
            withheld: c.longTax,
            net: Math.max(0, (c.longGain - c.longLoss) * data.roLongRate - c.longTax)
          });
        }
        if (c.shortGain > 0 || c.shortLoss > 0) {
          rows.push({
            cat: I18n.t('income.roGainsShort') + ' (Tradeville)',
            country: c.country,
            gross: c.shortGain - c.shortLoss,
            rate: (data.roShortRate * 100) + '%',
            withheld: c.shortTax,
            net: Math.max(0, (c.shortGain - c.shortLoss) * data.roShortRate - c.shortTax)
          });
        }
      }
    }
    // Manual country rows from Add Data
    const manualCountries = yd.roGainsCountries || [];
    if (manualCountries.length > 0 && !tvPort.countries?.length && !xtbPort.longTerm?.gainRON) {
      for (const c of manualCountries) {
        const broker = yd.roBroker || 'RO Broker';
        if (c.longGain > 0) {
          rows.push({
            cat: I18n.t('income.roGainsLong') + ' (' + broker + ')',
            country: c.country,
            gross: c.longGain,
            rate: (data.roLongRate * 100) + '%',
            withheld: 0,
            net: 0
          });
        }
        if (c.shortGain > 0) {
          rows.push({
            cat: I18n.t('income.roGainsShort') + ' (' + broker + ')',
            country: c.country,
            gross: c.shortGain,
            rate: (data.roShortRate * 100) + '%',
            withheld: 0,
            net: 0
          });
        }
      }
    }
    if (xtbDiv.dividends?.grossRON) {
      rows.push({
        cat: I18n.t('income.roDividends'),
        country: 'USA',
        gross: xtbDiv.dividends.grossRON,
        rate: data.divTaxRateLabel,
        withheld: xtbDiv.dividends.taxWithheldRON || 0,
        net: Math.max(0, xtbDiv.dividends.grossRON * data.divTaxRate - (xtbDiv.dividends.taxWithheldRON || 0))
      });
    }
    if (xtbDiv.interest?.grossRON) {
      rows.push({
        cat: I18n.t('income.interestIncome') + ' (Romania)',
        country: 'RO',
        gross: xtbDiv.interest.grossRON,
        rate: (data.interestTaxRate * 100) + '%',
        withheld: xtbDiv.interest.taxWithheldRON || 0,
        net: xtbDiv.interest.grossRON * data.interestTaxRate - (xtbDiv.interest.taxWithheldRON || 0)
      });
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${esc(r.cat)}</td>
        <td>${esc(r.country)}</td>
        <td>${fmt(r.gross)}</td>
        <td>${r.rate}</td>
        <td>${fmt(r.withheld)}</td>
        <td>${fmt(r.net)}</td>
      </tr>
    `).join('');

    const totalGross = rows.reduce((s, r) => s + r.gross, 0);
    const totalWithheld = rows.reduce((s, r) => s + r.withheld, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);
    tfoot.innerHTML = `
      <tr>
        <td colspan="2"><strong>${I18n.t('income.total')}</strong></td>
        <td><strong>${fmt(totalGross)}</strong></td>
        <td></td>
        <td><strong>${fmt(totalWithheld)}</strong></td>
        <td><strong>${fmt(totalNet)}</strong></td>
      </tr>
    `;
  }

  // ============ TRADES TABLE ============
  async function renderTradesTable() {
    const tbody = document.getElementById('trades-tbody');
    const tfoot = document.getElementById('trades-tfoot');
    const esppTbody = document.getElementById('espp-tbody');
    const esppTfoot = document.getElementById('espp-tfoot');
    const esppCard = document.getElementById('espp-purchases-card');
    if (!tbody) return;
    try {
      const resp = await fetch(`/api/trades?year=${selectedYear}`);
      const data = await resp.json();
      if (!data.trades || data.trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-muted);">' + I18n.t('misc.noTradeConfirmations') + '</td></tr>';
        tfoot.innerHTML = '';
        if (esppCard) esppCard.style.display = 'none';
        if (esppTbody) esppTbody.innerHTML = '';
        if (esppTfoot) esppTfoot.innerHTML = '';
        return;
      }
      const sales = data.trades.filter(t => t.transactionType !== 'purchase');
      const purchases = data.trades.filter(t => t.transactionType === 'purchase');

      // ESPP Purchases table
      if (purchases.length > 0 && esppCard && esppTbody) {
        esppCard.style.display = '';
        esppTbody.innerHTML = purchases.map((t, i) => `<tr>
          <td>${i + 1}</td>
          <td>${esc(normalizeDate(t.saleDate || '-'))}</td>
          <td>${esc(t.symbol || '-')}</td>
          <td>${t.shares || '-'}</td>
          <td>${t.pricePerShare ? t.pricePerShare.toFixed(4) : '-'}</td>
          <td>${fmtUSD(t.marketValue || 0)}</td>
          <td>${fmtUSD(t.esppGain || 0)}</td>
          <td>${fmtUSD(t.accumulatedContributions || 0)}</td>
        </tr>`).join('');
        const totalMktVal = purchases.reduce((s, t) => s + (t.marketValue || 0), 0);
        const totalGain = purchases.reduce((s, t) => s + (t.esppGain || 0), 0);
        const totalContrib = purchases.reduce((s, t) => s + (t.accumulatedContributions || 0), 0);
        const totalPurchShares = purchases.reduce((s, t) => s + (t.shares || 0), 0);
        esppTfoot.innerHTML = `<tr>
          <td colspan="3"><strong>${I18n.t('income.total')} (${purchases.length} ${I18n.t('misc.purchases') || 'purchases'})</strong></td>
          <td><strong>${parseFloat(totalPurchShares.toFixed(6))}</strong></td>
          <td></td>
          <td><strong>${fmtUSD(totalMktVal)}</strong></td>
          <td><strong>${fmtUSD(totalGain)}</strong></td>
          <td><strong>${fmtUSD(totalContrib)}</strong></td>
        </tr>`;
      } else if (esppCard) {
        esppCard.style.display = 'none';
        if (esppTbody) esppTbody.innerHTML = '';
        if (esppTfoot) esppTfoot.innerHTML = '';
      }

      // Sales table
      if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-muted);">' + I18n.t('misc.noTradeConfirmations') + '</td></tr>';
        tfoot.innerHTML = '';
      } else {
        tbody.innerHTML = sales.map((t, i) => `<tr>
          <td>${i + 1}</td>
          <td>${esc(normalizeDate(t.saleDate || '-'))}</td>
          <td>${esc(t.symbol || '-')}</td>
          <td>${t.shares || '-'}</td>
          <td>${t.pricePerShare ? t.pricePerShare.toFixed(4) : '-'}</td>
          <td>${fmtUSD(t.saleProceeds)}</td>
          <td>${fmtUSD(t.fees)}</td>
          <td>${fmtUSD(t.netProceeds)}</td>
        </tr>`).join('');
        const totalProceeds = sales.reduce((s, t) => s + (t.saleProceeds || 0), 0);
        const totalNet = sales.reduce((s, t) => s + (t.netProceeds || 0), 0);
        const totalShares = sales.reduce((s, t) => s + (t.shares || 0), 0);
        tfoot.innerHTML = `<tr>
          <td colspan="3"><strong>${I18n.t('income.total')} (${sales.length} ${I18n.t('misc.sales') || 'sales'})</strong></td>
          <td><strong>${parseFloat(totalShares.toFixed(6))}</strong></td>
          <td></td>
          <td><strong>${fmtUSD(totalProceeds)}</strong></td>
          <td></td>
          <td><strong>${fmtUSD(totalNet)}</strong></td>
        </tr>`;
      }
    } catch {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-muted);">' + I18n.t('misc.errorLoadingTrades') + '</td></tr>';
    }
  }

  // ============ TAX TABLE ============
  function renderTaxTable() {
    const data = computeYearData(selectedYear);
    const tbody = document.getElementById('tax-tbody');
    const fmtR = (v) => { const r = Math.round(v || 0); return (Object.is(r, -0) ? 0 : r).toLocaleString('ro-RO'); };

    // Tax rates list - use i18n labels
    const ratesList = document.getElementById('tax-rates-list');
    const rateLabels = I18n.t('misc.rateLabels');
    if (Array.isArray(rateLabels)) {
      ratesList.innerHTML = rateLabels.map(l => `<li>${esc(l.replace('{rate}', data.divTaxRateLabel))}</li>`).join('');
    } else {
      ratesList.innerHTML = Object.values(taxRates).map(r => `<li>${esc(r.label)}</li>`).join('');
    }

    // Computed values
    const usDivRON = data.dividendsRON || (data.dividendsUSD * data.exchangeRate);
    const usGainsRON = data.capitalGainsTaxableRON;
    const roLong = data.roLongTermGainRON;
    const roShort = data.roShortTermGainRON;
    const roDivGross = data.dividendsRON_ro;
    const roInterest = data.roInterestRON;
    const interestAdv = data.interestIncomeRON - roInterest; // adeverinta interest only
    const gamblingIncome = data.gamblingIncome || 0;
    const stockWithholding = data.stockWithholding || 0;

    // Tax computations
    // US capital gains: taxable = gains after ESPP cost, BIK deduction, and prior loss offset
    const usNetGainsAfterBIK = Math.max(0, usGainsRON - (data.salaryTaxedRON || 0) - (data.lossOffset || 0));
    const usGainsTax = usNetGainsAfterBIK * (data.capGainsTaxRate || 0.10);
    const usDivTax = data.usDivTax || 0;
    const roLongTax = roLong * (data.roLongRate || 0.01);
    const roShortTax = roShort * (data.roShortRate || 0.03);
    const roDivTaxDue = roDivGross * data.divTaxRate;
    const interestTaxAll = data.interestIncomeRON * (data.interestTaxRate || 0.10);
    const gamblingTax = data.gamblingTax || 0;

    // Already paid
    const usForeignTaxRON = data.usDivForeignTaxRON || 0;
    const roCapTaxWithheld = data.roPortTaxWithheld || 0;
    const roDivTaxWithheld = data.roDivTaxWithheld || 0;
    const interestTaxPaid = data.interestTaxPaid || 0;

    // Section helper
    const sectionRow = (label) => `<tr style="background:var(--bg-secondary);"><td colspan="2"><strong>${label}</strong></td></tr>`;
    const dataRow = (label, val, opts = {}) => {
      const cls = opts.bold ? 'font-weight:600;' : '';
      const color = opts.highlight ? 'color:var(--warning);font-size:1.1rem;' : opts.green ? 'color:var(--success);' : opts.muted ? 'color:var(--text-muted);font-size:0.85rem;' : '';
      const prefix = opts.indent ? '&nbsp;&nbsp;&nbsp;&nbsp;' : '';
      return `<tr style="${cls}${opts.topBorder ? 'border-top:2px solid var(--border);' : ''}"><td style="${cls}">${prefix}${label}</td><td style="${cls}${color}">${val}</td></tr>`;
    };
    const emptyRow = () => '<tr><td colspan="2" style="border:none;height:0.5rem;"></td></tr>';

    let html = '';

    // === SECTION A: CE AM CÂȘTIGAT ===
    html += sectionRow('\ud83d\udcb0 ' + I18n.t('taxes.sectionEarned'));

    // -- US income --
    html += dataRow('<strong>' + I18n.t('taxes.subsectionUS') + '</strong>', '', { indent: false });
    const usGainsGross = data.capitalGainsTaxableRON || (data.tradeProceedsUSD || 0) * data.exchangeRate;
    const hasUsDeductions = (data.salaryTaxedRON > 0 || data.capitalGainsCostUSD > 0 || data.lossOffset > 0);
    if (hasUsDeductions) {
      // Show gross first, then deductions, then net
      html += dataRow(I18n.t('taxes.earnUsGains') + data.usBrokerLabel, fmtR(usGainsGross) + ' RON', { indent: true });
      const deductions = [];
      if (data.capitalGainsCostUSD > 0) deductions.push('ESPP: -' + fmtR(data.capitalGainsCostUSD * data.exchangeRate) + ' RON');
      if (data.salaryTaxedRON > 0) deductions.push('BIK: -' + fmtR(data.salaryTaxedRON) + ' RON');
      if (data.lossOffset > 0) deductions.push((I18n.t('taxes.earnPriorLossOffset') || 'Prior losses') + ': -' + fmtR(data.lossOffset) + ' RON');
      html += dataRow((I18n.t('taxes.earnDeductionsApplied') || 'Deductions applied'), deductions.join(', '), { indent: true, muted: true });
      html += dataRow((I18n.t('taxes.earnUsNet') || 'Net US capital gains'), fmtR(usNetGainsAfterBIK) + ' RON', { indent: true, green: true });
    } else {
      html += dataRow(I18n.t('taxes.earnUsGains') + data.usBrokerLabel, fmtR(usNetGainsAfterBIK) + ' RON', { indent: true });
    }
    html += dataRow(I18n.t('taxes.earnUsDiv') + data.usDivBrokerLabel, fmtR(usDivRON) + ' RON', { indent: true });
    const usSubtotalIncome = usNetGainsAfterBIK + usDivRON;
    html += dataRow(I18n.t('taxes.subtotalUS'), fmtR(usSubtotalIncome) + ' RON', { indent: true, bold: true, topBorder: true });

    // -- Romania income --
    html += dataRow('<strong>' + I18n.t('taxes.subsectionRO') + '</strong>', '', { indent: false });
    html += dataRow(I18n.t('taxes.earnRoGainsLong') + data.roBrokerLabel, fmtR(roLong) + ' RON', { indent: true });
    html += dataRow(I18n.t('taxes.earnRoGainsShort') + data.roBrokerLabel, fmtR(roShort) + ' RON', { indent: true });
    html += dataRow(I18n.t('taxes.earnRoDiv') + data.roBrokerLabel, fmtR(roDivGross) + ' RON', { indent: true });
    html += dataRow(I18n.t('taxes.earnInterest'), fmtR(data.interestIncomeRON) + ' RON', { indent: true });
    if (gamblingIncome > 0) {
      html += dataRow(I18n.t('taxes.earnGambling'), fmtR(gamblingIncome) + ' RON', { indent: true });
    }
    if (data.rentalGross > 0) {
      html += dataRow(I18n.t('taxes.earnRental'), fmtR(data.rentalGross) + ' RON', { indent: true });
      html += dataRow(I18n.t('taxes.earnRentalNet'), fmtR(data.rentalNet) + ' RON', { indent: true, muted: true });
    }
    if (data.royaltyGross > 0) {
      html += dataRow(I18n.t('taxes.earnRoyalty'), fmtR(data.royaltyGross) + ' RON', { indent: true });
      html += dataRow(I18n.t('taxes.earnRoyaltyNet'), fmtR(data.royaltyNet) + ' RON', { indent: true, muted: true });
    }
    if (data.otherGross > 0) {
      html += dataRow(I18n.t('taxes.earnOther'), fmtR(data.otherGross) + ' RON', { indent: true });
    }
    const roSubtotalIncome = roLong + roShort + roDivGross + data.interestIncomeRON + gamblingIncome + data.rentalGross + data.royaltyGross + data.otherGross;
    html += dataRow(I18n.t('taxes.subtotalRO'), fmtR(roSubtotalIncome) + ' RON', { indent: true, bold: true, topBorder: true });

    html += dataRow(I18n.t('taxes.earnTotal'), fmtR(usSubtotalIncome + roSubtotalIncome) + ' RON', { bold: true, topBorder: true });

    html += emptyRow();

    // === SECTION B: CE AM PLĂTIT DEJA ===
    html += sectionRow('\u2705 ' + I18n.t('taxes.sectionPaid'));

    // -- US taxes paid --
    const usPaidSubtotal = usForeignTaxRON + stockWithholding;
    html += dataRow('<strong>' + I18n.t('taxes.subsectionUS') + '</strong>', '', { indent: false });
    if (usForeignTaxRON > 0) {
      html += dataRow(I18n.t('taxes.paidUsDivUS'), fmtR(usForeignTaxRON) + ' RON', { indent: true, green: true });
    }
    if (stockWithholding > 0) {
      html += dataRow(I18n.t('taxes.paidStockWithholding'), fmtR(stockWithholding) + ' RON', { indent: true, green: true });
    }
    html += dataRow(I18n.t('taxes.subtotalUS'), fmtR(usPaidSubtotal) + ' RON', { indent: true, bold: true, topBorder: true, green: true });

    // -- Romania taxes paid --
    const roPaidSubtotal = roCapTaxWithheld + roDivTaxWithheld + interestTaxPaid + gamblingTax + (data.rentalTaxPaid || 0) + (data.royaltyTaxPaid || 0) + (data.otherTaxPaid || 0);
    html += dataRow('<strong>' + I18n.t('taxes.subsectionRO') + '</strong>', '', { indent: false });
    if (roCapTaxWithheld > 0) {
      html += dataRow(I18n.t('taxes.paidRoCapGains'), fmtR(roCapTaxWithheld) + ' RON', { indent: true, green: true });
    }
    if (roDivTaxWithheld > 0) {
      html += dataRow(I18n.t('taxes.paidRoDiv'), fmtR(roDivTaxWithheld) + ' RON', { indent: true, green: true });
    }
    if (interestTaxPaid > 0) {
      html += dataRow(I18n.t('taxes.paidInterest'), fmtR(interestTaxPaid) + ' RON', { indent: true, green: true });
    }
    if (gamblingTax > 0) {
      html += dataRow(I18n.t('taxes.paidGambling'), fmtR(gamblingTax) + ' RON', { indent: true, green: true });
    }
    if (data.rentalTaxPaid > 0) {
      html += dataRow(I18n.t('taxes.paidRental'), fmtR(data.rentalTaxPaid) + ' RON', { indent: true, green: true });
    }
    if (data.royaltyTaxPaid > 0) {
      html += dataRow(I18n.t('taxes.paidRoyalty'), fmtR(data.royaltyTaxPaid) + ' RON', { indent: true, green: true });
    }
    if (data.otherTaxPaid > 0) {
      html += dataRow(I18n.t('taxes.paidOther'), fmtR(data.otherTaxPaid) + ' RON', { indent: true, green: true });
    }
    html += dataRow(I18n.t('taxes.subtotalRO'), fmtR(roPaidSubtotal) + ' RON', { indent: true, bold: true, topBorder: true, green: true });

    const totalPaid = usForeignTaxRON + roCapTaxWithheld + roDivTaxWithheld + interestTaxPaid + gamblingTax + stockWithholding + (data.rentalTaxPaid || 0) + (data.royaltyTaxPaid || 0) + (data.otherTaxPaid || 0);
    html += dataRow(I18n.t('taxes.paidTotal'), fmtR(totalPaid) + ' RON', { bold: true, topBorder: true, green: true });

    html += emptyRow();

    // === SECTION C: CE MAI AM DE PLĂTIT ===
    html += sectionRow('\ud83d\udcdd ' + I18n.t('taxes.sectionOwed'));
    // US capital gains
    if (usGainsRON > 0) {
      html += dataRow(I18n.t('taxes.oweUsGains'), fmtR(Math.max(0, usGainsTax)) + ' RON', { indent: true });
    }
    // US dividends
    html += dataRow(I18n.t('taxes.oweUsDiv'), fmtR(usDivTax) + ' RON', { indent: true, muted: usDivTax === 0 });
    // Romania capital gains: check if broker withheld enough
    const roCapGainsTaxDue = (roLong * (data.roLongRate || 0.01)) + (roShort * (data.roShortRate || 0.03));
    const roCapGainsNetOwed = Math.max(0, roCapGainsTaxDue - roCapTaxWithheld);
    if (roCapGainsNetOwed > 0) {
      html += dataRow(I18n.t('taxes.oweRoCapGains'), fmtR(roCapGainsNetOwed) + ' RON', { indent: true });
    } else {
      html += dataRow(I18n.t('taxes.oweRoCapGains'), I18n.t('taxes.finalTaxDone'), { indent: true, muted: true });
    }
    // Romania dividends: check if broker withheld enough
    const roDivNetOwed = Math.max(0, roDivGross * data.divTaxRate - roDivTaxWithheld);
    if (roDivNetOwed > 0) {
      html += dataRow(I18n.t('taxes.oweRoDiv'), fmtR(roDivNetOwed) + ' RON', { indent: true });
    } else {
      html += dataRow(I18n.t('taxes.oweRoDiv'), I18n.t('taxes.finalTaxDone'), { indent: true, muted: true });
    }
    // Interest tax remaining
    const interestTaxRemaining = Math.max(0, interestTaxAll - interestTaxPaid);
    html += dataRow(I18n.t('taxes.oweInterest'), fmtR(interestTaxRemaining) + ' RON', { indent: true });
    // Gambling: already withheld
    if (gamblingIncome > 0) {
      html += dataRow(I18n.t('taxes.oweGambling'), I18n.t('taxes.finalTaxDone'), { indent: true, muted: true });
    }
    // Rental income tax
    if (data.rentalGross > 0) {
      html += dataRow(I18n.t('taxes.oweRental'), fmtR(data.rentalTaxToPay) + ' RON', { indent: true });
    }
    // Royalty income tax
    if (data.royaltyGross > 0) {
      html += dataRow(I18n.t('taxes.oweRoyalty'), fmtR(data.royaltyTaxToPay) + ' RON', { indent: true });
    }
    // Other income tax
    if (data.otherGross > 0) {
      html += dataRow(I18n.t('taxes.oweOther'), fmtR(data.otherTaxToPay) + ' RON', { indent: true });
    }
    // Subtotal income tax
    const incomeTaxToPay = Math.max(0, usGainsTax) + usDivTax + roCapGainsNetOwed + roDivNetOwed + interestTaxRemaining + (data.rentalTaxToPay || 0) + (data.royaltyTaxToPay || 0) + (data.otherTaxToPay || 0);
    html += dataRow(I18n.t('taxes.oweIncomeTaxSubtotal'), '<strong>' + fmtR(incomeTaxToPay) + ' RON</strong>', { topBorder: true });
    // CASS
    html += dataRow(I18n.t('taxes.oweCASS'), fmtR(data.cassTax) + ' RON', { indent: true });
    html += emptyRow();
    const finalToPay = incomeTaxToPay + data.cassTax;
    html += dataRow(I18n.t('taxes.oweTotalToPay'), '<strong style="color:var(--warning);font-size:1.15rem;">' + fmtR(finalToPay) + ' RON</strong>', { bold: true, topBorder: true, highlight: true });

    // Payment deadline
    const deadlineISO = data.paymentDeadline || d212DefaultDeadline(selectedYear);
    const deadlineFormatted = formatDeadline(deadlineISO);
    if (deadlineFormatted) {
      html += emptyRow();
      html += `<tr style="background:var(--bg-secondary);"><td colspan="2" style="text-align:center;"><strong>\u23f0 ${I18n.t('taxes.d212DeadlineLabel')}: <span style="color:var(--warning);font-size:1.05rem;">${esc(deadlineFormatted)}</span></strong></td></tr>`;
    }

    tbody.innerHTML = html;

    // CASS details - tiered display
    const cassDiv = document.getElementById('cass-details');
    const ci = data.cassInfo;
    const fmtC = (v) => { const r = Math.round(v); return (Object.is(r, -0) ? 0 : r).toLocaleString('ro-RO'); };
    if (ci) {
      // Build tier rows based on year (3-tier for 2023-2024, 5-tier for 2025+)
      const tierRows = [
        { range: `< 6 SM (< ${fmtC(ci.t6)} lei)`, base: '-', amount: '0 lei', active: ci.tier === '<6SM' },
        { range: `6-12 SM (${fmtC(ci.t6)} - ${fmtC(ci.t12)} lei)`, base: `${fmtC(ci.t6)} lei`, amount: `${fmtC(ci.t6 * 0.10)} lei`, active: ci.tier === '6-12SM' },
        { range: `12-24 SM (${fmtC(ci.t12)} - ${fmtC(ci.t24)} lei)`, base: `${fmtC(ci.t12)} lei`, amount: `${fmtC(ci.t12 * 0.10)} lei`, active: ci.tier === '12-24SM' },
      ];
      if (ci.tierSystem === 3) {
        // 2023-2024: cap at 24SM
        tierRows.push({ range: `> 24 SM (> ${fmtC(ci.t24)} lei)`, base: `${fmtC(ci.t24)} lei (max)`, amount: `${fmtC(ci.t24 * 0.10)} lei (max)`, active: ci.tier === '>24SM' });
      } else {
        // 2025+: 24-60SM and >60SM tiers
        tierRows.push({ range: `24-60 SM (${fmtC(ci.t24)} - ${fmtC(ci.t60)} lei)`, base: `${fmtC(ci.t24)} lei`, amount: `${fmtC(ci.t24 * 0.10)} lei`, active: ci.tier === '24-60SM' });
        tierRows.push({ range: `> 60 SM (> ${fmtC(ci.t60)} lei)`, base: `${fmtC(ci.t60)} lei (max)`, amount: `${fmtC(ci.t60 * 0.10)} lei (max)`, active: ci.tier === '>60SM' });
      }
      cassDiv.innerHTML = `
        <p><strong>${I18n.t('misc.minSalaryLabel')} ${selectedYear}:</strong> ${fmtC(ci.sm)} ${I18n.t('misc.perMonth')} (${fmtC(ci.sm * 12)} ${I18n.t('misc.perYear')})</p>
        <p><strong>${I18n.t('misc.totalExtraSalaryIncome')}</strong> ${fmtC(data.totalIncome_cass)} lei</p>
        <p><strong>${I18n.t('misc.casLabel')}</strong> ${I18n.t('misc.casNotApplicable')}</p>
        <table style="width:100%;margin-top:0.5rem;">
          <thead><tr><th>${I18n.t('misc.cassAnnualIncome')}</th><th>${I18n.t('misc.cassCalcBase')}</th><th>${I18n.t('misc.cassDue')}</th></tr></thead>
          <tbody>
            ${tierRows.map(r => `<tr style="${r.active ? 'background:rgba(88,166,255,0.15);font-weight:600;' : ''}">
              <td>${r.range}</td><td>${r.base}</td><td>${r.active ? '\u2705 ' : ''}${r.amount}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <p style="margin-top:0.75rem;"><strong>${I18n.t('misc.cassDueLabel')}</strong> <span style="color:var(--warning);font-size:1.1rem;">${fmtC(data.cassTax)} lei</span></p>
        <p style="font-size:0.8rem;color:var(--text-muted);">${I18n.t('misc.roCassNote')}</p>
        <div style="margin-top:0.75rem;padding:0.75rem;background:var(--bg-secondary);border-radius:var(--radius);font-size:0.85rem;">
          <p><strong>${I18n.t('misc.cassIncomeTypesTitle')}</strong></p>
          <ul style="margin:0.25rem 0 0.5rem 1.2rem;">
            <li>${I18n.t('misc.cassTypeIP')}</li>
            <li>${I18n.t('misc.cassTypeAssoc')}</li>
            <li>${I18n.t('misc.cassTypeRent')}</li>
            <li>${I18n.t('misc.cassTypeAgri')}</li>
            <li><strong>${I18n.t('misc.cassTypeInvest')}</strong></li>
            <li>${I18n.t('misc.cassTypeOther')}</li>
          </ul>
          <p style="font-size:0.8rem;color:var(--text-muted);">${I18n.t('misc.cassIncomeNote')}</p>
        </div>
        <div style="margin-top:0.75rem;padding:0.5rem;background:var(--bg-secondary);border-radius:var(--radius);">
          <p style="font-weight:600;color:var(--warning);">\u23f0 ${I18n.t('misc.cassDeadlineLabel')} ${selectedYear}: <strong>${formatDeadline(data.paymentDeadline || d212DefaultDeadline(selectedYear))}</strong></p>
          <p style="margin-top:0.5rem;color:var(--success);font-weight:600;">\u274c ${I18n.t('misc.casNotApplicableInvestments')}</p>
        </div>
        <div style="margin-top:0.75rem;padding:0.5rem;background:var(--bg-secondary);border-radius:var(--radius);font-size:0.8rem;color:var(--text-muted);">
          <p><strong>${I18n.t('misc.legalBasisLabel')}</strong> ${I18n.t('misc.legalBasisText')}</p>
          <p>${I18n.t('misc.anafUsesMinSalary')} <strong>${fmtC(ci.sm)} ${I18n.t('misc.perMonth')}</strong> (${fmtC(ci.sm * 12)} ${I18n.t('misc.perYear')})</p>
          <p>${I18n.t('misc.sectoralNote')}</p>
          <p>${I18n.t('misc.casNotApplicableInvestments')}</p>
        </div>
      `;
    }

    // Render D212 helper
    renderDeclaratieHelper(data);
  }

  // ============ D212 DECLARATIE HELPER ============
  function renderDeclaratieHelper(data) {
    const fmtR = (v) => { if (typeof v !== 'number') return '-'; const r = Math.round(v); return r === 0 || Object.is(r, -0) ? '0' : r.toLocaleString('ro-RO'); };
    const fmtD = (v) => { if (typeof v !== 'number') return '-'; if (Object.is(v, -0) || Math.abs(v) < 0.005) return '0'; return v.toFixed(2); };

    // Section 1.2.1: Foreign income (US - Fidelity / Morgan Stanley)
    const foreignTbody = document.getElementById('dcl-foreign-tbody');
    if (foreignTbody) {
      const usDivRON = (data.dividendsRON || data.dividendsUSD * data.exchangeRate);
      const usGainsRON = data.capitalGainsTaxableRON || (data.tradeProceedsUSD || 0) * data.exchangeRate;
      const usGainsGrossUSD = data.tradeProceedsUSD || data.capitalGainsSaleUSD || 0;
      const esppCost = data.capitalGainsCostUSD || 0;
      const usGainsGrossRON = usGainsGrossUSD * data.exchangeRate;
      const esppCostRON = esppCost * data.exchangeRate;
      const salaryTaxed = data.salaryTaxedRON || 0;
      // ANAF formula: Taxable = Sale_RON - Cost_RON - BIK_RON - LossOffset
      const usNetBeforeLosses = Math.max(0, usGainsGrossRON - esppCostRON - salaryTaxed);
      const priorLossesVal = data.priorLosses || 0;
      const lossOffsetVal = usNetBeforeLosses > 0 ? Math.min(priorLossesVal, Math.floor(usNetBeforeLosses * 0.7)) : 0;
      const usNetGainsRON = Math.max(0, usNetBeforeLosses - lossOffsetVal);
      const usCapGainsTax = usNetGainsRON * (data.capGainsTaxRate || 0.10);
      const usDivTaxDue = usDivRON * data.divTaxRate;
      const usTaxPaidRON = data.usDivForeignTaxRON || 0;
      // If US effective withholding rate >= RO rate (within 0.5% tolerance), credit covers full RO tax
      const effectiveUSRate = data.dividendsUSD > 0 ? ((data.usDivForeignTaxUSD || 0) / data.dividendsUSD) : 0;
      const dclRateFullyCovered = effectiveUSRate >= (data.divTaxRate - 0.005);
      const usDivCredit = dclRateFullyCovered ? usDivTaxDue : Math.min(usDivTaxDue, usTaxPaidRON);
      const usDivDiff = Math.max(0, usDivTaxDue - usDivCredit);

      foreignTbody.innerHTML = [
        [I18n.t('dcl.sourceCountry'), 'S.U.A.'],
        [I18n.t('dcl.exchangeRateLabel'), data.exchangeRate?.toFixed(4)],
        ['--- ' + I18n.t('dcl.sepCapitalGains') + ' ---', ''],
        [I18n.t('dcl.saleValueUSD'), fmtD(usGainsGrossUSD) + ' USD'],
        [I18n.t('dcl.saleValueRON'), fmtR(usGainsGrossRON) + ' RON'],
        [I18n.t('dcl.esppCostUSD'), fmtD(esppCost) + ' USD' + (data.esppSharesConsumed > 0 ? ' <small>(' + data.esppSharesConsumed + ' ' + (I18n.t('income.shares') || 'shares') + ' ESPP FIFO)</small>' : '')],
        [I18n.t('dcl.esppCostRON'), fmtR(esppCostRON) + ' RON'],
        [I18n.t('dcl.alreadyTaxedSalary'), fmtR(salaryTaxed) + ' RON'],
        ...(priorLossesVal > 0 ? [
          ['Rd.5 ' + (I18n.t('dcl.priorLosses') || 'Pierderi reportate din anii precedenți'), fmtR(priorLossesVal) + ' RON'],
          ['Rd.6 ' + (I18n.t('dcl.lossOffset') || 'Pierdere compensată (max 70% × câștig net)'), fmtR(lossOffsetVal) + ' RON'],
        ] : []),
        [I18n.t('dcl.taxableCapitalGains'), '<strong>' + fmtR(usNetGainsRON) + ' RON</strong>'],
        [I18n.t('dcl.incomeTaxDue10').replace('10%', (data.capGainsTaxRate * 100) + '%'), '<strong>' + fmtR(usCapGainsTax) + ' RON</strong>'],
        ['--- ' + I18n.t('dcl.sepDividends') + ' ---', ''],
        [I18n.t('dcl.grossDividendsUSD'), fmtD(data.dividendsUSD) + ' USD'],
        [I18n.t('dcl.grossDividendsRON'), fmtR(usDivRON) + ' RON'],
        [I18n.t('dcl.divTaxDueRO10').replace('10%', data.divTaxRateLabel), fmtR(usDivTaxDue) + ' RON'],
        [I18n.t('dcl.usTaxWithheldUSD'), fmtD(data.usDivForeignTaxUSD || 0) + ' USD'],
        [I18n.t('dcl.usTaxWithheldRON'), fmtR(usTaxPaidRON) + ' RON'],
        [I18n.t('dcl.divCreditRecognized'), fmtR(usDivCredit) + ' RON'],
        [I18n.t('dcl.divDiffToPay'), '<strong>' + fmtR(usDivDiff) + ' RON</strong>'],
      ].map(([f, v]) => {
        const isSep = f.startsWith('---');
        return `<tr${isSep ? ' style="background:var(--bg-secondary)"' : ''}><td>${isSep ? '<strong>' + f.replace(/---/g, '').trim() + '</strong>' : f}</td><td>${v}</td></tr>`;
      }).join('');
    }

    // Capital gains calculation method reference
    const cgMethodDiv = document.getElementById('dcl-capgains-method');
    if (cgMethodDiv) {
      const rate = data.exchangeRate?.toFixed(4) || '4.4705';
      cgMethodDiv.innerHTML = `
        <details>
          <summary style="cursor:pointer;font-weight:600;color:var(--accent);">${I18n.t('dcl.cgMethodTitle')}</summary>
          <table style="width:100%;margin-top:0.5rem;font-size:0.8rem;">
            <thead><tr><th>${I18n.t('dcl.cgScenario')}</th><th>${I18n.t('dcl.cgFormula')}</th></tr></thead>
            <tbody>
              <tr>
                <td><strong>${I18n.t('dcl.cgEsppShort')}</strong></td>
                <td>${I18n.t('dcl.cgFormulaEsppShort').replace('{rate}', rate)}</td>
              </tr>
              <tr>
                <td><strong>${I18n.t('dcl.cgEsppLong')}</strong></td>
                <td>${I18n.t('dcl.cgFormulaEsppLong').replace('{rate}', rate)}</td>
              </tr>
              <tr>
                <td><strong>${I18n.t('dcl.cgGrantShort')}</strong></td>
                <td>${I18n.t('dcl.cgFormulaGrantShort').replace('{rate}', rate)}</td>
              </tr>
              <tr>
                <td><strong>${I18n.t('dcl.cgGrantLong')}</strong></td>
                <td>${I18n.t('dcl.cgFormulaGrantLong').replace('{rate}', rate)}</td>
              </tr>
            </tbody>
          </table>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">${I18n.t('dcl.cgNote1').replace('{rate}', rate).replace('{year}', selectedYear)}</p>
          <p style="font-size:0.75rem;color:var(--text-muted);">${I18n.t('dcl.cgNote2')}</p>
        </details>
      `;
    }

    // Romania section
    const xtbTbody = document.getElementById('dcl-ro-tbody');
    if (xtbTbody) {
      const roLongGain = data.roLongTermGainRON || 0;
      const roShortGain = data.roShortTermGainRON || 0;
      const roDivGrossVal = data.dividendsRON_ro || 0;
      const roDivTaxWH = data.roDivTaxWithheld || 0;
      const roCapTaxWH = data.roPortTaxWithheld || 0;
      const roInterestVal = data.roInterestRON || 0;
      const roInterestTax = roInterestVal * 0.10;
      const adeverintaInterest = data.interestIncomeRON - roInterestVal;
      const adeverintaInterestTax = data.interestTaxPaid || 0;

      xtbTbody.innerHTML = [
        [I18n.t('dcl.roFinalTaxNote'), ''],
        ['--- ' + I18n.t('dcl.sepRoCapGains') + ' ---', ''],
        [I18n.t('dcl.roCapGainsLong'), fmtR(roLongGain) + ' RON'],
        [I18n.t('dcl.roCapGainsTaxLong'), fmtR(roLongGain * (data.roLongRate || 0.01)) + ' RON (' + I18n.t('dcl.withheldByBroker') + ')'],
        [I18n.t('dcl.roCapGainsShort'), fmtR(roShortGain) + ' RON'],
        [I18n.t('dcl.roCapGainsTaxShort'), fmtR(roShortGain * (data.roShortRate || 0.03)) + ' RON (' + I18n.t('dcl.withheldByBroker') + ')'],
        [I18n.t('dcl.roCapGainsTaxTotal'), fmtR(roCapTaxWH) + ' RON'],
        ['--- ' + I18n.t('dcl.sepRoDividends') + ' ---', ''],
        [I18n.t('dcl.roDivGross'), fmtR(roDivGrossVal) + ' RON'],
        [I18n.t('dcl.roDivTaxWithheld'), fmtR(roDivTaxWH) + ' RON (' + I18n.t('dcl.withheldByBroker') + ')'],
        ['--- ' + I18n.t('dcl.sepInterestRO') + ' ---', ''],
        [I18n.t('dcl.grossInterestRON'), fmtR(data.interestIncomeRON) + ' RON'],
        [I18n.t('dcl.interestTax10'), fmtR(adeverintaInterestTax) + ' RON (' + I18n.t('dcl.withheldAtSource') + ')'],
      ].map(([f, v]) => {
        const isSep = f.startsWith('---');
        const isNote = f === I18n.t('dcl.roFinalTaxNote');
        return `<tr${isSep ? ' style="background:var(--bg-secondary)"' : ''}${isNote ? ' style="color:var(--success);font-weight:600;font-size:0.85rem"' : ''}><td>${isSep ? '<strong>' + f.replace(/---/g, '').trim() + '</strong>' : f}</td><td>${v}</td></tr>`;
      }).join('');
    }

    // Withholding income section (for CASS calculation)
    const whTbody = document.getElementById('dcl-withholding-tbody');
    if (whTbody) {
      const roLongGainWH = data.roLongTermGainRON || 0;
      const roShortGainWH = data.roShortTermGainRON || 0;
      const roDivWH = data.dividendsRON_ro || 0;
      const interestWH = data.interestIncomeRON || 0;
      const rentalWH = data.rentalNet || 0;
      const royaltyWH = data.royaltyNet || 0;
      const gamblingWH = data.gamblingIncome || 0;
      // CASS total: per Art. 174, excludes gambling and other income
      const totalWH = roLongGainWH + roShortGainWH + roDivWH + interestWH + rentalWH + royaltyWH;

      const rows = [
        [I18n.t('dcl.whCapGainsLong'), fmtR(roLongGainWH)],
        [I18n.t('dcl.whCapGainsShort'), fmtR(roShortGainWH)],
        [I18n.t('dcl.whDividends'), fmtR(roDivWH)],
        [I18n.t('dcl.whInterest'), fmtR(interestWH)],
      ];
      if (rentalWH > 0) {
        rows.push([I18n.t('dcl.whRental') || 'Rental income (net)', fmtR(rentalWH)]);
      }
      if (royaltyWH > 0) {
        rows.push([I18n.t('dcl.whRoyalty') || 'Royalty income (net)', fmtR(royaltyWH)]);
      }
      if (gamblingWH > 0) {
        rows.push([I18n.t('dcl.whGambling'), fmtR(gamblingWH) + ' *']);
      }
      rows.push([I18n.t('dcl.whNote'), '']);
      rows.push(['<strong>' + I18n.t('dcl.whTotal') + '</strong>', '<strong>' + fmtR(totalWH) + '</strong>']);

      whTbody.innerHTML = rows.map(([f, v]) => {
        const isNote = f === I18n.t('dcl.whNote');
        return `<tr${isNote ? ' style="color:var(--text-muted);font-size:0.8rem"' : ''}><td>${f}</td><td>${v}</td></tr>`;
      }).join('');
    }

    // CASS section
    const cassTbody = document.getElementById('dcl-cass-tbody');
    if (cassTbody) {
      const ci = data.cassInfo || {};
      cassTbody.innerHTML = [
        [I18n.t('dcl.minSalaryMonthly'), fmtR(ci.sm || 4050)],
        [I18n.t('dcl.minSalaryAnnual'), fmtR((ci.sm || 4050) * 12)],
        [I18n.t('dcl.totalNonSalaryIncome'), fmtR(data.totalIncome)],
        [I18n.t('dcl.cassTier'), ci.tier || '-'],
        [I18n.t('dcl.cassCalcBase'), fmtR(ci.base || 0)],
        [I18n.t('dcl.casNotApplicableInv'), '-'],
        [I18n.t('dcl.cassDue10'), fmtR(data.cassTax)],
      ].map(([f, v]) => `<tr><td>${f}</td><td>${v}</td></tr>`).join('');
    }

    // Summary section
    const summaryTbody = document.getElementById('dcl-summary-tbody');
    if (summaryTbody) {
      const usGainsGrossUSD2 = data.tradeProceedsUSD || data.capitalGainsSaleUSD || 0;
      const esppCostUSD2 = data.capitalGainsCostUSD || 0;
      // ANAF formula: Taxable = Sale_RON - Cost_RON - BIK_RON
      const usGainsGrossRON = data.capitalGainsTaxableRON || usGainsGrossUSD2 * data.exchangeRate;
      const usDivRON = (data.dividendsRON || data.dividendsUSD * data.exchangeRate);
      const esppCostRON = esppCostUSD2 * data.exchangeRate;
      const usNetGains = Math.max(0, usGainsGrossRON - esppCostRON - (data.salaryTaxedRON || 0));
      const usGainsTax = usNetGains * (data.capGainsTaxRate || 0.10);
      // US dividends: RO tax - US credit = difference
      // If US effective withholding rate >= RO rate (within 0.5% tolerance), credit covers full RO tax
      const usDivTaxDue = usDivRON * data.divTaxRate;
      const usTaxPaidRON = data.usDivForeignTaxRON || 0;
      const summEffectiveUSRate = data.dividendsUSD > 0 ? ((data.usDivForeignTaxUSD || 0) / data.dividendsUSD) : 0;
      const summRateFullyCovered = summEffectiveUSRate >= (data.divTaxRate - 0.005);
      const summDivCredit = summRateFullyCovered ? usDivTaxDue : Math.min(usDivTaxDue, usTaxPaidRON);
      const usDivTax = Math.max(0, usDivTaxDue - summDivCredit);
      // Interest: use dynamic rate, don't double-count
      const interestTax = data.interestTax; // already computed correctly in computeYearData

      const incomeTaxTotal = Math.max(0, usGainsTax) + usDivTax + Math.max(0, interestTax);
      const totalToPay = incomeTaxTotal + data.cassTax;

      const totalToPayLabel = I18n.t('dcl.totalToPay');
      const totalIncomeTaxLabel = I18n.t('dcl.totalIncomeTax');

      summaryTbody.innerHTML = [
        [I18n.t('dcl.usCapGainsTax'), fmtR(Math.max(0, usGainsTax))],
        [I18n.t('dcl.usDivTaxToPay'), fmtR(usDivTax)],
        [I18n.t('dcl.roCapGainsTaxGross'), I18n.t('dcl.roFinalTaxShort')],
        [I18n.t('dcl.roDivTaxGross').replace('{rate}', data.divTaxRateLabel), I18n.t('dcl.roFinalTaxShort')],
        [I18n.t('dcl.interestTax'), fmtR(Math.max(0, interestTax))],
        [totalIncomeTaxLabel, '<strong>' + fmtR(incomeTaxTotal) + '</strong>'],
        [I18n.t('dcl.cassDue'), fmtR(data.cassTax)],
        ['', ''],
        [totalToPayLabel, '<strong style="color:var(--warning);font-size:1.1rem;">' + fmtR(totalToPay) + ' RON</strong>'],
      ].map(([f, v]) => {
        const isTotal = f === totalToPayLabel || f === totalIncomeTaxLabel;
        return `<tr${isTotal ? ' style="border-top:2px solid var(--border)"' : ''}><td>${isTotal ? '<strong>' + f + '</strong>' : f}</td><td>${v}</td></tr>`;
      }).join('');
    }

    // Chapter I header - inject year
    const ch1Header = document.getElementById('dcl-ch1-header');
    if (ch1Header) {
      ch1Header.textContent = I18n.t('taxes.dclChapter1').replace('{year}', selectedYear);
    }

    // Chapter II header - inject same year
    const ch2Header = document.getElementById('dcl-ch2-header');
    if (ch2Header) {
      ch2Header.textContent = I18n.t('taxes.dclChapter2').replace('{year}', selectedYear);
    }

    // Chapter II: CASS payment option for current year
    const ch2Tbody = document.getElementById('dcl-ch2-tbody');
    if (ch2Tbody) {
      const cassYear = selectedYear;
      const cassConfig = cassThresholds[cassYear] || cassThresholds[2025];
      const sm = cassConfig.minSalary;
      const cassBase = sm * 6;
      const cassDue = cassBase * 0.10;
      const cassApplies = data.cassInfo?.applies;
      if (selectedYear >= 2025) {
        // Starting D212/2025, Chapter II estimation is no longer required
        const rows = [
          [I18n.t('dcl.ch2NotRequired'), ''],
        ];
        if (!cassApplies) {
          // Income below 6×SM — CASS not due, no need to opt in
          rows.push(['', '']);
          rows.push([I18n.t('dcl.ch2NoCass'), I18n.t('dcl.ch2NoCassDetail').replace('{threshold}', fmtR(cassBase))]);
        } else {
          rows.push(['', '']);
          rows.push([I18n.t('dcl.ch2IfOptional'), '']);
          rows.push([I18n.t('dcl.ch2OptionD'), '\u2611 D']);
          rows.push([I18n.t('dcl.ch2CassBase'), I18n.t('dcl.ch2CassBaseFormula').replace('{sm}', fmtR(sm)).replace('{base}', fmtR(cassBase))]);
          rows.push([I18n.t('dcl.ch2CassDue'), fmtR(cassDue) + ' RON']);
        }
        ch2Tbody.innerHTML = rows.map(([f, v]) => {
          const isNotRequired = f === I18n.t('dcl.ch2NotRequired');
          const isIfOptional = f === I18n.t('dcl.ch2IfOptional');
          const isNoCass = f === I18n.t('dcl.ch2NoCass');
          return `<tr${isNotRequired ? ' style="background:var(--bg-secondary);color:var(--success);font-weight:600;"' : ''}${isIfOptional ? ' style="font-size:0.85rem;color:var(--text-muted);font-style:italic;border-top:1px dashed var(--border);"' : ''}${isNoCass ? ' style="color:var(--success);font-weight:600;"' : ''}><td>${f}</td><td>${v}</td></tr>`;
        }).join('');
      } else {
        ch2Tbody.innerHTML = [
          [I18n.t('dcl.ch2OptionD'), '\u2611 D'],
          [I18n.t('dcl.ch2CheckD'), '\u2705'],
          [I18n.t('dcl.ch2CassBase'), I18n.t('dcl.ch2CassBaseFormula').replace('{sm}', fmtR(sm)).replace('{base}', fmtR(cassBase))],
          [I18n.t('dcl.ch2CassDue'), fmtR(cassDue) + ' RON'],
          ['', ''],
          [I18n.t('dcl.ch2Note'), ''],
        ].map(([f, v]) => {
          const isNote = f === I18n.t('dcl.ch2Note');
          return `<tr${isNote ? ' style="font-size:0.8rem;color:var(--text-muted);font-style:italic"' : ''}><td>${f}</td><td>${v}</td></tr>`;
        }).join('');
      }
    }
  }

  // ============ DATA FORM ============
  function populateForm() {
    const yd = appData.years?.[selectedYear] || {};
    const rate = exchangeRates[selectedYear]?.usdRon || 4.57;
    const defaultMinSalary = (cassThresholds[selectedYear] || cassThresholds[2025]).minSalary;

    // Show year banner
    const banner = document.getElementById('input-year-banner');
    if (banner) {
      banner.innerHTML = `<span class="year-badge">${selectedYear}</span><span>${I18n.t('misc.editingBanner')} <strong>${selectedYear}</strong>. ${I18n.t('misc.rateAndSalaryApply')}</span>`;
    }

    document.getElementById('input-us-broker').value = yd.usBroker || '';
    document.getElementById('input-ro-broker').value = yd.roBroker || '';
    document.getElementById('input-us-dividends').value = yd.fidelityDividends || '';
    document.getElementById('input-us-div-tax').value = yd.usDivTaxPaid || '';
    document.getElementById('input-ro-dividends').value = yd.xtbDividends || '';
    document.getElementById('input-ro-div-tax').value = yd.roDivTaxPaid || '';
    document.getElementById('input-us-gains').value = yd.fidelityGains || '';
    document.getElementById('input-us-cost').value = yd.fidelityCost || '';
    document.getElementById('input-interest').value = yd.interestIncome || '';
    document.getElementById('input-interest-tax-paid').value = yd.interestTaxPaid || '';
    document.getElementById('input-rental-income').value = yd.rentalIncome || '';
    document.getElementById('input-rental-tax-paid').value = yd.rentalTaxPaid || '';
    document.getElementById('input-royalty-income').value = yd.royaltyIncome || '';
    document.getElementById('input-royalty-tax-paid').value = yd.royaltyTaxPaid || '';
    document.getElementById('input-gambling-income').value = yd.gamblingIncome || '';
    document.getElementById('input-gambling-tax-paid').value = yd.gamblingTaxPaid || '';
    document.getElementById('input-other-income').value = yd.otherIncome || '';
    document.getElementById('input-other-tax-paid').value = yd.otherTaxPaid || '';
    document.getElementById('input-exchange-rate').value = yd.exchangeRate || rate;
    document.getElementById('input-min-salary').value = yd.minSalary || defaultMinSalary;
    document.getElementById('input-d212-deadline').value = yd.d212Deadline || d212DefaultDeadline(selectedYear);
    document.getElementById('input-stock-withholding').value = yd.stockWithholdingPaid || '';
    document.getElementById('input-salary-taxed').value = yd.salaryTaxedIncome || '';
    document.getElementById('input-prior-losses').value = yd.priorLosses || '';

    // Populate RO gains country rows
    renderRoGainsRows(yd.roGainsCountries || []);

    // Update fieldset legend with year
    const legend = document.getElementById('legend-rates');
    if (legend) {
      legend.textContent = `${I18n.t('misc.exchangeRateAndSalary')} (${selectedYear})`;
    }

    // Populate tax rates
    populateTaxRates();

    // Update save buttons with year
    const btnData = document.getElementById('btn-save-data');
    const btnRates = document.getElementById('btn-save-rates');
    const btnTaxRates = document.getElementById('btn-save-tax-rates');
    if (btnData) btnData.textContent = `${I18n.t('input.save')} (${selectedYear})`;
    if (btnRates) btnRates.textContent = `${I18n.t('input.saveRates')} (${selectedYear})`;
    if (btnTaxRates) btnTaxRates.textContent = `${I18n.t('input.saveTaxRates')} (${selectedYear})`;
  }

  // ============ RO GAINS COUNTRY ROWS ============
  const RO_COUNTRIES = [
    'AT', 'AU', 'BE', 'BG', 'BR', 'CA', 'CH', 'CN', 'CY', 'CZ',
    'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR', 'HU',
    'IE', 'IL', 'IN', 'IT', 'JP', 'KR', 'LT', 'LU', 'LV', 'MT',
    'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SG', 'SI', 'SK', 'US'
  ];

  function renderRoGainsRows(rows) {
    const container = document.getElementById('ro-gains-rows');
    container.innerHTML = '';
    if (rows && rows.length > 0) {
      rows.forEach(r => addRoGainsRow(container, r));
    }
  }

  function addRoGainsRow(container, data) {
    const row = document.createElement('div');
    row.className = 'ro-gains-row';
    row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:0.75rem;align-items:end;margin-bottom:0.75rem;';
    const countryOpts = `<option value="" disabled ${!data?.country ? 'selected' : ''}>${I18n.t('input.selectCountry')}</option>` + RO_COUNTRIES.map(c => `<option value="${c}"${data?.country === c ? ' selected' : ''}>${c}</option>`).join('');
    row.innerHTML = `
      <div class="form-row" style="margin-bottom:0;">
        <label>${I18n.t('input.country')}</label>
        <select class="ro-country">${countryOpts}</select>
        <small style="color:var(--text-muted);font-size:0.7rem;">${I18n.t('input.countryHint')}</small>
      </div>
      <div class="form-row" style="margin-bottom:0;">
        <label>${I18n.t('input.roGainsLong')}</label>
        <input type="number" step="0.01" class="ro-long" value="${data?.longGain || ''}">
        <small style="color:var(--text-muted);font-size:0.7rem;">${I18n.t('input.roGainsLongHint')}</small>
      </div>
      <div class="form-row" style="margin-bottom:0;">
        <label>${I18n.t('input.roGainsShort')}</label>
        <input type="number" step="0.01" class="ro-short" value="${data?.shortGain || ''}">
        <small style="color:var(--text-muted);font-size:0.7rem;">${I18n.t('input.roGainsShortHint')}</small>
      </div>
      <div class="form-row" style="margin-bottom:0;">
        <label>${I18n.t('input.roGainsTaxWithheld')}</label>
        <input type="number" step="0.01" class="ro-tax" value="${data?.taxWithheld || ''}">
        <small style="color:var(--text-muted);font-size:0.7rem;">${I18n.t('input.roGainsTaxHintShort')}</small>
      </div>
      <div style="padding-bottom:1.5rem;">
        <button type="button" class="btn-primary ro-remove-btn" style="background:var(--danger);font-size:0.85rem;padding:0.45rem 0.7rem;">✕</button>
      </div>
    `;
    row.querySelector('.ro-remove-btn').addEventListener('click', () => {
      row.remove();
    });
    container.appendChild(row);
  }

  function collectRoGainsRows() {
    const rows = document.querySelectorAll('#ro-gains-rows .ro-gains-row');
    const result = [];
    rows.forEach(row => {
      const country = row.querySelector('.ro-country').value;
      const longGain = row.querySelector('.ro-long').value;
      const shortGain = row.querySelector('.ro-short').value;
      const taxWithheld = row.querySelector('.ro-tax').value;
      if (longGain || shortGain || taxWithheld) {
        result.push({
          country,
          longGain: parseFloat(longGain) || 0,
          shortGain: parseFloat(shortGain) || 0,
          taxWithheld: parseFloat(taxWithheld) || 0
        });
      }
    });
    return result;
  }

  // Add country button
  document.getElementById('btn-add-ro-row')?.addEventListener('click', () => {
    addRoGainsRow(document.getElementById('ro-gains-rows'));
  });

  async function handleDataSubmit(e) {
    e.preventDefault();
    const payload = {
      usBroker: document.getElementById('input-us-broker').value,
      roBroker: document.getElementById('input-ro-broker').value,
      fidelityDividends: document.getElementById('input-us-dividends').value,
      usDivTaxPaid: document.getElementById('input-us-div-tax').value,
      xtbDividends: document.getElementById('input-ro-dividends').value,
      roDivTaxPaid: document.getElementById('input-ro-div-tax').value,
      fidelityGains: document.getElementById('input-us-gains').value,
      fidelityCost: document.getElementById('input-us-cost').value,
      roGainsCountries: collectRoGainsRows(),
      interestIncome: document.getElementById('input-interest').value,
      interestTaxPaid: document.getElementById('input-interest-tax-paid').value,
      rentalIncome: document.getElementById('input-rental-income').value,
      rentalTaxPaid: document.getElementById('input-rental-tax-paid').value,
      royaltyIncome: document.getElementById('input-royalty-income').value,
      royaltyTaxPaid: document.getElementById('input-royalty-tax-paid').value,
      gamblingIncome: document.getElementById('input-gambling-income').value,
      gamblingTaxPaid: document.getElementById('input-gambling-tax-paid').value,
      otherIncome: document.getElementById('input-other-income').value,
      otherTaxPaid: document.getElementById('input-other-tax-paid').value,
      stockWithholdingPaid: document.getElementById('input-stock-withholding').value,
      salaryTaxedIncome: document.getElementById('input-salary-taxed').value,
      priorLosses: document.getElementById('input-prior-losses').value
    };

    try {
      const resp = await fetch(`/api/data/${selectedYear}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await resp.json();
      if (result.success) {
        await loadAllData();
        render();
        showToast(I18n.t('input.saved'), 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleRatesSubmit(e) {
    e.preventDefault();
    const payload = {
      exchangeRate: document.getElementById('input-exchange-rate').value,
      minSalary: document.getElementById('input-min-salary').value,
      d212Deadline: document.getElementById('input-d212-deadline').value
    };
    try {
      const resp = await fetch(`/api/data/${selectedYear}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await resp.json();
      if (result.success) {
        await loadAllData();
        render();
        showToast(I18n.t('input.saved'), 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleTaxRatesSubmit(e) {
    e.preventDefault();
    const payload = {
      taxRates: {
        usDividendRate: parseFloat(document.getElementById('input-us-div-rate').value) || null,
        usCapGainsRate: parseFloat(document.getElementById('input-us-capgains-rate').value) || null,
        roDividendRate: parseFloat(document.getElementById('input-ro-div-rate').value) || null,
        roCapGainsRate: parseFloat(document.getElementById('input-ro-capgains-rate').value) || null,
        roCapGainsLongRate: parseFloat(document.getElementById('input-ro-capgains-long-rate').value) || null,
        roCapGainsShortRate: parseFloat(document.getElementById('input-ro-capgains-short-rate').value) || null,
        roInterestRate: parseFloat(document.getElementById('input-ro-interest-rate').value) || null
      }
    };
    try {
      const resp = await fetch(`/api/data/${selectedYear}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await resp.json();
      if (result.success) {
        await loadAllData();
        render();
        showToast(I18n.t('input.taxRatesSaved'), 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function populateTaxRates() {
    const yd = appData.years?.[selectedYear] || {};
    const tr = yd.taxRates || {};
    document.getElementById('input-us-div-rate').value = tr.usDividendRate ?? 10;
    document.getElementById('input-us-capgains-rate').value = tr.usCapGainsRate ?? 0;
    document.getElementById('input-ro-div-rate').value = tr.roDividendRate ?? (selectedYear >= 2026 ? 16 : selectedYear >= 2025 ? 10 : selectedYear >= 2023 ? 8 : 5);
    document.getElementById('input-ro-capgains-rate').value = tr.roCapGainsRate ?? (selectedYear >= 2026 ? 16 : 10);
    document.getElementById('input-ro-capgains-long-rate').value = tr.roCapGainsLongRate ?? (selectedYear >= 2026 ? 3 : selectedYear >= 2023 ? 1 : 10);
    document.getElementById('input-ro-capgains-short-rate').value = tr.roCapGainsShortRate ?? (selectedYear >= 2026 ? 6 : selectedYear >= 2023 ? 3 : 10);
    document.getElementById('input-ro-interest-rate').value = tr.roInterestRate ?? (selectedYear >= 2026 ? 16 : 10);
  }

  // ============ YEAR PICKER ============
  function initYearPicker() {
    const container = document.getElementById('year-picker');
    const hiddenInput = document.getElementById('upload-year');
    const maxYear = new Date().getFullYear() - 1;
    let pageStart = maxYear - 7;

    function renderPicker() {
      container.innerHTML = '';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'year-picker-nav';
      prevBtn.textContent = '\u25C0';
      prevBtn.title = 'Previous years';
      prevBtn.addEventListener('click', () => { pageStart -= 8; renderPicker(); });

      const grid = document.createElement('div');
      grid.className = 'year-picker-grid';

      for (let y = pageStart; y < pageStart + 8; y++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'year-picker-btn';
        btn.textContent = y;
        if (y === maxYear) btn.classList.add('current-year');
        if (hiddenInput.value === String(y)) btn.classList.add('selected');
        btn.addEventListener('click', () => {
          hiddenInput.value = y;
          container.querySelectorAll('.year-picker-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
        grid.appendChild(btn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'year-picker-nav';
      nextBtn.textContent = '\u25B6';
      nextBtn.title = 'Next years';
      nextBtn.addEventListener('click', () => { pageStart += 8; renderPicker(); });

      container.appendChild(prevBtn);
      container.appendChild(grid);
      container.appendChild(nextBtn);
    }

    hiddenInput.value = maxYear;
    renderPicker();

    // Expose sync function for when global year changes
    window._syncYearPicker = function(year) {
      hiddenInput.value = year;
      // Ensure the page shows the selected year
      if (year < pageStart || year >= pageStart + 8) {
        pageStart = year - 3;
      }
      renderPicker();
    };
  }

  // ============ OCR ENGINE STATUS ============
  async function fetchOcrStatus() {
    try {
      const resp = await fetch('/api/ocr-status');
      const status = await resp.json();
      // If server is still detecting PaddleOCR, retry after a short delay
      if (status.detecting) {
        setTimeout(fetchOcrStatus, 2000);
        return;
      }
      const badge = document.getElementById('ocr-engine-badge');
      const label = document.getElementById('ocr-engine-label');
      const actionBtn = document.getElementById('ocr-action-btn');
      const hint = document.getElementById('ocr-hint');
      const hintText = document.getElementById('ocr-hint-text');
      if (badge && label) {
        badge.style.display = 'inline-flex';
        actionBtn.classList.remove('hidden');
        hint.classList.remove('hidden');
        if (status.paddleocr) {
          badge.className = 'ocr-badge paddle';
          label.textContent = I18n.t('import.ocrEnginePaddle');
          // Button: Downgrade to Lite
          actionBtn.textContent = I18n.t('import.ocrDowngradeBtn');
          actionBtn.className = 'btn-primary ocr-action-btn ocr-action-downgrade';
          const sizeMB = status.pythonSizeMB;
          const sizeLabel = sizeMB >= 1024
            ? (sizeMB / 1024).toFixed(1) + ' GB'
            : sizeMB + ' MB';
          actionBtn.onclick = async () => {
            const msg = I18n.t('import.ocrDowngradeConfirm').replace('{size}', sizeLabel);
            if (!confirm(msg)) return;
            // Lock button width
            actionBtn.style.minWidth = actionBtn.offsetWidth + 'px';
            actionBtn.disabled = true;
            const removingLabel = I18n.t('import.ocrDowngradeRemoving');
            actionBtn.textContent = removingLabel + ' 100%';
            actionBtn.style.background = `linear-gradient(90deg, var(--danger) 100%, var(--text-muted) 100%)`;
            let revPct = 100;
            const revInterval = setInterval(() => {
              revPct = Math.max(0, revPct - 5);
              actionBtn.textContent = removingLabel + ' ' + revPct + '%';
              actionBtn.style.background = `linear-gradient(90deg, var(--danger) ${revPct}%, var(--text-muted) ${revPct}%)`;
            }, 40);
            try {
              const r = await fetch('/api/ocr-downgrade', { method: 'POST' });
              const result = await r.json();
              clearInterval(revInterval);
              if (result.success) {
                actionBtn.textContent = removingLabel + ' 0%';
                actionBtn.style.background = 'var(--text-muted)';
                showToast(I18n.t('import.ocrDowngraded'), 'success');
                actionBtn.style.minWidth = '';
                await fetchOcrStatus();
              } else {
                showToast(result.error, 'error');
              }
            } catch (err) {
              clearInterval(revInterval);
              showToast(err.message, 'error');
            } finally {
              actionBtn.disabled = false;
              actionBtn.style.background = '';
              actionBtn.style.minWidth = '';
            }
          };
          // Hint: info about downgrading (opens guide)
          hintText.textContent = I18n.t('import.ocrDowngradeHint').replace('{size}', sizeLabel);
          hint.onclick = () => {
            const guideLink = document.getElementById('doc-guide-link');
            if (guideLink) guideLink.click();
          };
        } else {
          badge.className = 'ocr-badge tesseract';
          label.textContent = I18n.t('import.ocrEngineTesseract');
          // Button: Upgrade to Full
          actionBtn.textContent = I18n.t('import.ocrUpgradeBtn');
          actionBtn.className = 'btn-primary ocr-action-btn ocr-action-upgrade';
          actionBtn.onclick = async () => {
            const msg = I18n.t('import.ocrUpgradeConfirm');
            if (!confirm(msg)) return;
            // Lock button width
            actionBtn.style.minWidth = actionBtn.offsetWidth + 'px';
            actionBtn.disabled = true;
            const installingLabel = I18n.t('import.ocrUpgradeInstalling');
            actionBtn.textContent = installingLabel + ' 0%';
            const TARGET_MB = 1028;
            // Poll progress via pythonSizeMB
            const progressInterval = setInterval(async () => {
              try {
                const ps = await fetch('/api/ocr-status');
                const psData = await ps.json();
                const mb = psData.pythonSizeMB || 0;
                const pct = Math.min(99, Math.round(mb / TARGET_MB * 100));
                actionBtn.textContent = installingLabel + ' ' + pct + '%';
                actionBtn.style.background = `linear-gradient(90deg, var(--success) ${pct}%, var(--accent) ${pct}%)`;
              } catch {}
            }, 3000);
            try {
              const r = await fetch('/api/ocr-upgrade', { method: 'POST' });
              const result = await r.json();
              clearInterval(progressInterval);
              if (result.success) {
                actionBtn.textContent = installingLabel + ' 100%';
                actionBtn.style.background = 'var(--success)';
                showToast(I18n.t('import.ocrUpgraded'), 'success');
                actionBtn.style.minWidth = '';
                await fetchOcrStatus();
              } else {
                showToast(result.error, 'error');
                actionBtn.textContent = I18n.t('import.ocrUpgradeBtn');
                actionBtn.style.background = '';
                actionBtn.style.minWidth = '';
              }
            } catch (err) {
              clearInterval(progressInterval);
              showToast(err.message, 'error');
              actionBtn.textContent = I18n.t('import.ocrUpgradeBtn');
              actionBtn.style.background = '';
              actionBtn.style.minWidth = '';
            } finally {
              actionBtn.disabled = false;
            }
          };
          // Hint: info about upgrading (opens guide)
          hintText.textContent = I18n.t('import.ocrUpgradeHint');
          hint.onclick = () => {
            const guideLink = document.getElementById('doc-guide-link');
            if (guideLink) guideLink.click();
          };
        }
      }
    } catch { /* non-critical */ }
  }

  // ============ PDF UPLOAD ============
  async function handleUpload(e) {
    e.preventDefault();
    const yearVal = document.getElementById('upload-year').value;
    const typeVal = document.getElementById('upload-type').value;
    const files = document.getElementById('upload-file').files;

    const resultDiv = document.getElementById('upload-result');
    const submitBtn = document.getElementById('upload-submit-btn');
    const uploadForm = document.getElementById('upload-form');
    // Disable all form controls during processing
    const formControls = uploadForm.querySelectorAll('input, select, button');
    formControls.forEach(c => c.disabled = true);
    submitBtn.style.minWidth = submitBtn.offsetWidth + 'px';
    submitBtn.textContent = I18n.t('import.processing');
    resultDiv.className = 'card';

    const fileCount = files.length;

    // Build per-file status list for multi-file uploads
    if (fileCount > 1) {
      let statusHtml = '<div id="upload-file-status">';
      for (let i = 0; i < fileCount; i++) {
        statusHtml += `<div id="upload-status-${i}" class="upload-file-row upload-file-pending">
          <span class="upload-file-icon">🕒</span>
          <span class="upload-file-name">${esc(files[i].name)}</span>
          <span class="upload-file-result" id="upload-result-${i}"></span>
        </div>`;
      }
      statusHtml += '</div>';
      resultDiv.innerHTML = statusHtml;
    } else {
      resultDiv.innerHTML = `<p style="color: var(--text-secondary)">${I18n.t('import.processing')}</p>`;
    }

    let allResultsHtml = '';
    let anySuccess = false;

    // Progress bar on button
    function updateBtnProgress(pct) {
      submitBtn.style.setProperty('background', `linear-gradient(90deg, var(--success) ${pct}%, var(--accent) ${pct}%)`, 'important');
    }
    if (fileCount <= 1) {
      // Indeterminate: animate 0→90% slowly
      let indPct = 0;
      var indInterval = setInterval(() => {
        indPct = Math.min(90, indPct + 2);
        updateBtnProgress(indPct);
      }, 200);
    } else {
      updateBtnProgress(0);
    }

    for (let fi = 0; fi < fileCount; fi++) {
      const form = new FormData();
      form.append('year', yearVal);
      form.append('type', typeVal);
      form.append('file', files[fi]);

      if (fileCount > 1) {
        const pct = Math.round((fi / fileCount) * 100);
        updateBtnProgress(pct);
        // Mark current file as processing
        const statusRow = document.getElementById(`upload-status-${fi}`);
        if (statusRow) {
          statusRow.className = 'upload-file-row upload-file-processing';
          statusRow.querySelector('.upload-file-icon').textContent = '⏳';
        }
        submitBtn.textContent = `${I18n.t('import.processing')} (${fi + 1}/${fileCount})`;
      }

      // Live elapsed timer
      const _uploadStart = performance.now();
      const _timerEl = fileCount > 1 ? document.getElementById(`upload-result-${fi}`) : null;
      const _timerInterval = setInterval(() => {
        const ms = performance.now() - _uploadStart;
        const t = `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
        if (_timerEl) _timerEl.textContent = `⏱ ${I18n.t('import.elapsed')}: ${t}`;
        if (fileCount <= 1) {
          resultDiv.innerHTML = `<p style="color: var(--text-secondary)">${I18n.t('import.processing')} <span style="font-variant-numeric:tabular-nums;">⏱ ${I18n.t('import.elapsed')}: ${t}</span></p>`;
        }
      }, 1000);

    try {
      const resp = await fetch('/api/upload', { method: 'POST', body: form });
      clearInterval(_timerInterval);
      const _uploadMs = performance.now() - _uploadStart;
      const _elapsed = `${Math.floor(_uploadMs / 60000)}:${String(Math.floor((_uploadMs % 60000) / 1000)).padStart(2, '0')}`;
      const result = await resp.json();
      if (result.success) {
        anySuccess = true;
        const filePrefix = fileCount > 1 ? `<strong>${esc(files[fi].name)}</strong> — ` : '';
        const timeInfo = _elapsed !== '0:00' ? ` <span style="color:var(--text-muted);font-size:0.8rem;">(${_elapsed})</span>` : '';
        let resultHtml = `<p style="color: var(--success)">${filePrefix}${I18n.t('import.success')}${timeInfo}</p>`;
        if (result.type === 'trade_confirmation') {
          const t = result.parsed;
          if (t.transactionType === 'purchase') {
            resultHtml += `<div style="margin-top:0.5rem;">
              <p><strong>${esc(t.symbol)}</strong> - ${I18n.t('misc.esppPurchase') || 'ESPP Purchase'}</p>
              <p>${t.shares} shares @ $${t.pricePerShare?.toFixed(4) || '?'} | Date: ${normalizeDate(t.saleDate || '-')}</p>
              <p>Market Value: $${t.marketValue?.toFixed(2) || '?'} | Contributions: $${t.accumulatedContributions?.toFixed(2) || '?'} | Gain: $${t.esppGain?.toFixed(2) || '?'}</p>
              ${t.offeringPeriod ? `<p>Offering: ${esc(t.offeringPeriod)}</p>` : ''}
              ${result.isDuplicate ? '<p style="color:var(--warning)">⚠ Duplicate detected (already imported)</p>' : ''}
            </div>`;
          } else {
            resultHtml += `<div style="margin-top:0.5rem;">
              <p><strong>${esc(t.symbol)}</strong> - ${t.shares} shares @ $${t.pricePerShare?.toFixed(4) || '?'}</p>
              <p>Sale Date: ${normalizeDate(t.saleDate || '-')} | Net Proceeds: $${t.netProceeds?.toFixed(2) || '?'}</p>
              ${result.isDuplicate ? '<p style="color:var(--warning)">⚠ Duplicate detected (already imported)</p>' : ''}
            </div>`;
          }
          if (result.yearSummary) {
            resultHtml += `<div style="margin-top:0.5rem; padding:0.5rem; background:var(--bg-secondary); border-radius:var(--radius);">
              <strong>Year ${result.year} Summary:</strong> ${result.yearSummary.count} trades, 
              ${result.yearSummary.totalShares} shares, 
              $${result.yearSummary.totalNet?.toFixed(2)} net proceeds
            </div>`;
          }
        } else if (result.type === 'form_1042s') {
          const p = result.parsed;
          resultHtml += `<div style="margin-top:0.5rem;">
            <p><strong>Form 1042-S</strong> - ${esc(p.incomeType)} (code ${esc(p.incomeCode)})</p>
            <p>Gross Income: <strong>$${p.grossIncomeUSD?.toFixed(2)}</strong> | Tax Rate: ${p.taxRate}% | Tax Withheld: <strong>$${p.federalTaxWithheldUSD?.toFixed(2)}</strong></p>
            <p>Agent: ${esc(p.withholdingAgent)} | Recipient: ${esc(p.recipientName)} (${esc(p.recipientCountry)})</p>
            ${result.isDuplicate ? '<p style="color:var(--warning)">\u26a0 Duplicate detected (same form identifier already imported)</p>' : ''}
          </div>`;
        } else if (result.type === 'fidelity_statement') {
          const p = result.parsed || {};
          const parts = [];
          if (p.period) parts.push(esc(p.period));
          if ((p.sales || []).length > 0) parts.push(`${p.sales.length} sale(s)`);
          if ((p.vests || []).length > 0) parts.push(`${p.vests.length} vest(s)`);
          if ((p.esppPurchases || []).length > 0) parts.push(`${p.esppPurchases.length} ESPP purchase(s)`);
          if ((p.dividends || []).length > 0) parts.push(`${p.dividends.length} dividend(s)`);
          if (p.dividendsYTD) parts.push(`Div YTD: $${p.dividendsYTD.toFixed(2)}`);
          if (p.taxWithheldYTD) parts.push(`Tax YTD: $${p.taxWithheldYTD.toFixed(2)}`);
          if (p.endingValue) parts.push(`Account: $${p.endingValue.toLocaleString()}`);
          resultHtml += parts.length > 0 ? `<p style="margin-top:0.3rem;color:var(--text-secondary);font-size:0.85rem;">${parts.join(' | ')}</p>` : '';
        } else if (result.type === 'ms_statement') {
          const p = result.parsed || {};
          const parts = [];
          if ((p.sales || []).length > 0) parts.push(`${p.sales.length} sale(s)`);
          if ((p.releases || []).length > 0) parts.push(`${p.releases.length} release(s)`);
          if (p.msDividends) parts.push(`Dividends: $${p.msDividends.toFixed(2)}`);
          if (p.msTaxWithheld) parts.push(`Tax: $${p.msTaxWithheld.toFixed(2)}`);
          resultHtml += parts.length > 0 ? `<p style="margin-top:0.3rem;color:var(--text-secondary);font-size:0.85rem;">${parts.join(' | ')}</p>` : '';
        } else {
          // Generic: show a compact summary instead of raw JSON
          const keys = Object.keys(result.parsed || {}).filter(k => k !== 'year');
          if (keys.length <= 6) {
            resultHtml += `<p style="margin-top:0.3rem;color:var(--text-secondary);font-size:0.85rem;">${keys.map(k => `${k}: ${typeof result.parsed[k] === 'number' ? result.parsed[k].toLocaleString() : esc(String(result.parsed[k]).slice(0, 50))}`).join(' | ')}</p>`;
          }
        }
        // Show OCR engine used + elapsed time
        if (result.ocrEngine && result.ocrEngine !== 'pdf-parse') {
          const engineLabel = result.ocrEngine === 'paddleocr' ? 'PaddleOCR' : 'Tesseract';
          resultHtml += `<p style="margin-top:0.5rem;color:var(--text-secondary);font-size:0.85rem;">OCR: ${engineLabel} (${_elapsed})</p>`;
        }
        allResultsHtml += resultHtml;
        // Update per-file status
        if (fileCount > 1) {
          const statusRow = document.getElementById(`upload-status-${fi}`);
          const resultSpan = document.getElementById(`upload-result-${fi}`);
          if (statusRow) { statusRow.className = 'upload-file-row upload-file-success'; statusRow.querySelector('.upload-file-icon').textContent = '✅'; }
          if (resultSpan) resultSpan.textContent = _elapsed !== '0:00' ? `${I18n.t('import.success')} (${_elapsed})` : I18n.t('import.success');
        }
      } else if (result.ocrLowQuality) {
        const catList = (result.categories || []).map(c => `<li>${esc(c)}</li>`).join('');
        if (result.messageKey) {
          allResultsHtml += `<div style="color: var(--warning)">
            ${fileCount > 1 ? `<p><strong>${esc(files[fi].name)}</strong></p>` : ''}
            <p><strong>⚠ ${I18n.t(result.messageKey)}</strong></p>
          </div>`;
        } else {
          allResultsHtml += `<div style="color: var(--warning)">
            ${fileCount > 1 ? `<p><strong>${esc(files[fi].name)}</strong></p>` : ''}
            <p><strong>⚠ ${I18n.t('import.ocrLowQuality')}</strong></p>
            ${catList ? `<p>${I18n.t('import.ocrCategoriesFound')}:</p><ul>${catList}</ul>` : ''}
            <p>${I18n.t('import.ocrManualHint')}</p>
          </div>`;
        }
        if (fileCount > 1) {
          const statusRow = document.getElementById(`upload-status-${fi}`);
          const resultSpan = document.getElementById(`upload-result-${fi}`);
          if (statusRow) { statusRow.className = 'upload-file-row upload-file-warning'; statusRow.querySelector('.upload-file-icon').textContent = '⚠️'; }
          if (resultSpan) resultSpan.textContent = I18n.t(result.messageKey || 'import.ocrLowQuality');
        }
      } else {
        allResultsHtml += `<p style="color: var(--danger)">${esc(files[fi].name)}: ${esc(result.error)}</p>`;
        if (fileCount > 1) {
          const statusRow = document.getElementById(`upload-status-${fi}`);
          const resultSpan = document.getElementById(`upload-result-${fi}`);
          if (statusRow) { statusRow.className = 'upload-file-row upload-file-error'; statusRow.querySelector('.upload-file-icon').textContent = '❌'; }
          if (resultSpan) resultSpan.textContent = result.error;
        }
      }
    } catch (err) {
      clearInterval(_timerInterval);
      allResultsHtml += `<p style="color: var(--danger)">${esc(files[fi].name)}: ${I18n.t('import.error')}: ${esc(err.message)}</p>`;
      if (fileCount > 1) {
        const statusRow = document.getElementById(`upload-status-${fi}`);
        const resultSpan = document.getElementById(`upload-result-${fi}`);
        if (statusRow) { statusRow.className = 'upload-file-row upload-file-error'; statusRow.querySelector('.upload-file-icon').textContent = '❌'; }
        if (resultSpan) resultSpan.textContent = err.message;
      }
    }
    } // end for loop

    resultDiv.className = 'card';
    if (fileCount > 1) {
      // Keep the live status list, append detailed results below
      const statusDiv = document.getElementById('upload-file-status');
      const detailsHtml = allResultsHtml ? `<div style="margin-top:0.75rem;border-top:1px solid var(--border);padding-top:0.75rem;">${allResultsHtml}</div>` : '';
      resultDiv.innerHTML = (statusDiv ? statusDiv.outerHTML : '') + detailsHtml;
    } else {
      resultDiv.innerHTML = allResultsHtml || `<p style="color: var(--danger)">${I18n.t('import.error')}</p>`;
    }

    if (anySuccess) {
      try {
        await loadAllData();
        populateYears();
        const uploadedYear = parseInt(yearVal, 10);
        if (uploadedYear) {
          selectedYear = uploadedYear;
          document.getElementById('year-select').value = selectedYear;
        }
        render();
      } catch (renderErr) {
        console.error('Post-upload render error:', renderErr);
      }
    }
    formControls.forEach(c => c.disabled = false);
    submitBtn.textContent = I18n.t('import.upload');
    submitBtn.style.removeProperty('background');
    submitBtn.style.minWidth = '';
    if (typeof indInterval !== 'undefined') clearInterval(indInterval);
  }

  // ============ RAW DATA ============
  let _rawSelectedFile = null;

  async function loadRawFiles() {
    const listDiv = document.getElementById('raw-file-list');
    const viewerCard = document.getElementById('raw-viewer-card');
    const viewerTitle = document.getElementById('raw-viewer-title');
    const content = document.getElementById('raw-content');
    const editor = document.getElementById('raw-editor');
    const editBtn = document.getElementById('raw-edit-btn');
    const saveBtn = document.getElementById('raw-save-btn');
    const cancelBtn = document.getElementById('raw-cancel-btn');

    // Reset viewer
    viewerCard.classList.add('hidden');
    content.textContent = '';
    editor.classList.add('hidden');
    content.classList.remove('hidden');
    editBtn.classList.remove('hidden');
    saveBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');

    // Fetch file list
    let files = [];
    try {
      const resp = await fetch('/api/raw');
      files = await resp.json();
    } catch {}

    if (!files.length) {
      listDiv.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:1rem;">${I18n.t('raw.noData')}</p>`;
      return;
    }

    // Render file list as table
    const locale = I18n.getLang?.() === 'ro' ? 'ro-RO' : 'en-US';
    listDiv.innerHTML = `
      <div id="raw-bulk-toolbar" class="raw-bulk-toolbar hidden">
        <span id="raw-selected-count"></span>
        <button type="button" id="raw-delete-selected-btn" class="btn-primary" style="font-size:0.8rem;padding:0.4rem 0.8rem;background:var(--danger);">
          ${I18n.t('raw.deleteSelected')}
        </button>
      </div>
      <table style="width:100%;font-size:0.85rem;">
        <thead>
          <tr>
            <th style="padding:0.5rem;width:2rem;"><input type="checkbox" id="raw-select-all" title="${I18n.t('raw.selectAll')}"></th>
            <th style="text-align:left;padding:0.5rem;">${I18n.t('raw.fileName')}</th>
            <th style="text-align:left;padding:0.5rem;">${I18n.t('raw.uploadDate')}</th>
            <th style="text-align:right;padding:0.5rem;">${I18n.t('raw.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${files.map(f => {
            const label = f.name.replace('_raw.txt', '');
            const date = new Date(f.date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `<tr>
              <td style="padding:0.5rem;"><input type="checkbox" class="raw-file-cb" data-file="${esc(f.name)}"></td>
              <td style="padding:0.5rem;"><strong>${esc(label)}</strong></td>
              <td style="padding:0.5rem;color:var(--text-muted);">${date}</td>
              <td style="padding:0.5rem;text-align:right;">
                <button class="btn-primary raw-view-btn" data-file="${esc(f.name)}" style="font-size:0.75rem;padding:0.3rem 0.6rem;margin-right:0.3rem;" data-i18n="raw.view">${I18n.t('raw.view')}</button>
                <button class="btn-primary raw-purge-btn" data-file="${esc(f.name)}" style="font-size:0.75rem;padding:0.3rem 0.6rem;background:var(--danger);" data-i18n="raw.purge">${I18n.t('raw.purge')}</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;

    // Checkbox selection logic
    const selectAllCb = document.getElementById('raw-select-all');
    const bulkToolbar = document.getElementById('raw-bulk-toolbar');
    const fileCbs = listDiv.querySelectorAll('.raw-file-cb');

    function updateBulkToolbar() {
      const checked = listDiv.querySelectorAll('.raw-file-cb:checked');
      const count = checked.length;
      if (count > 0) {
        bulkToolbar.classList.remove('hidden');
        document.getElementById('raw-selected-count').textContent =
          I18n.t('raw.selectedCount').replace('{count}', count);
      } else {
        bulkToolbar.classList.add('hidden');
      }
      selectAllCb.checked = count === fileCbs.length && count > 0;
      selectAllCb.indeterminate = count > 0 && count < fileCbs.length;
    }

    selectAllCb.addEventListener('change', () => {
      fileCbs.forEach(cb => cb.checked = selectAllCb.checked);
      updateBulkToolbar();
    });
    fileCbs.forEach(cb => cb.addEventListener('change', updateBulkToolbar));

    // Delete Selected button
    document.getElementById('raw-delete-selected-btn').addEventListener('click', async () => {
      const checked = [...listDiv.querySelectorAll('.raw-file-cb:checked')];
      if (!checked.length) return;
      const count = checked.length;
      const total = fileCbs.length;
      const msg = count === total
        ? I18n.t('raw.confirmDeleteAll').replace('{count}', count)
        : I18n.t('raw.confirmDeleteSelected').replace('{count}', count);
      if (!confirm(msg)) return;
      let deleted = 0;
      for (const cb of checked) {
        try {
          const resp = await fetch(`/api/raw/${cb.dataset.file}`, { method: 'DELETE' });
          const result = await resp.json();
          if (result.success) deleted++;
        } catch {}
      }
      if (deleted > 0) {
        showToast(I18n.t('raw.deletedCount').replace('{count}', deleted), 'success');
        await loadAllData();
        render();
        loadRawFiles();
      }
    });

    // View buttons
    listDiv.querySelectorAll('.raw-view-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const file = btn.dataset.file;
        _rawSelectedFile = file;
        const label = file.replace('_raw.txt', '');
        viewerTitle.textContent = label;
        viewerCard.classList.remove('hidden');
        editBtn.classList.remove('hidden');
        saveBtn.classList.add('hidden');
        cancelBtn.classList.add('hidden');
        content.classList.remove('hidden');
        editor.classList.add('hidden');

        try {
          const resp = await fetch(`/api/raw/${file}`);
          if (resp.ok) {
            const text = await resp.text();
            const lines = text.split('\n').filter(l => l.trim());
            const hasTab = lines.some(l => l.includes('\t'));
            if (hasTab) {
              const dataLines = lines.filter(l => l.includes('\t'));
              let html = '<table style="width:100%;font-size:0.8rem;">';
              dataLines.forEach((line, i) => {
                const cells = line.split('\t');
                const tag = i === 0 ? 'th' : 'td';
                html += '<tr>' + cells.map(c => `<${tag} style="padding:0.3rem 0.5rem;border-bottom:1px solid var(--border);text-align:left;">${esc(c)}</${tag}>`).join('') + '</tr>';
              });
              html += '</table>';
              const titleLines = lines.filter(l => !l.includes('\t'));
              content.innerHTML = (titleLines.length ? '<p style="margin-bottom:0.5rem;color:var(--text-muted);">' + titleLines.map(esc).join('<br>') + '</p>' : '') + html;
            } else {
              content.textContent = text;
            }
            content._rawText = text;
          } else {
            content.textContent = I18n.t('raw.noData');
          }
        } catch {
          content.textContent = I18n.t('raw.noData');
        }

        viewerCard.scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Purge buttons
    listDiv.querySelectorAll('.raw-purge-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const file = btn.dataset.file;
        const label = file.replace('_raw.txt', '');
        const msg = I18n.t('raw.confirmPurge').replace('{file}', label);
        if (!confirm(msg)) return;
        try {
          const resp = await fetch(`/api/raw/${file}`, { method: 'DELETE' });
          const result = await resp.json();
          if (result.success) {
            showToast(I18n.t('raw.purged').replace('{file}', label), 'success');
            await loadAllData();
            render();
            loadRawFiles();
          } else {
            showToast(result.error, 'error');
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // Edit button
    editBtn.onclick = () => {
      editor.value = content._rawText || content.textContent;
      content.classList.add('hidden');
      editor.classList.remove('hidden');
      editBtn.classList.add('hidden');
      saveBtn.classList.remove('hidden');
      cancelBtn.classList.remove('hidden');
    };

    // Cancel button
    cancelBtn.onclick = () => {
      editor.classList.add('hidden');
      content.classList.remove('hidden');
      editBtn.classList.remove('hidden');
      saveBtn.classList.add('hidden');
      cancelBtn.classList.add('hidden');
    };

    // Save button
    saveBtn.onclick = async () => {
      if (!_rawSelectedFile) return;
      try {
        const resp = await fetch(`/api/raw/${_rawSelectedFile}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editor.value })
        });
        const result = await resp.json();
        if (result.success) {
          content.textContent = editor.value;
          content._rawText = editor.value;
          cancelBtn.click();
          showToast(I18n.t('raw.fileSaved'), 'success');
        } else {
          showToast(result.error, 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // ============ HELPERS ============
  function fmt(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    const rounded = Math.round(num);
    if (rounded === 0 || Object.is(rounded, -0)) return '0';
    const locale = (typeof I18n !== 'undefined' && I18n.getLang?.()) === 'ro' ? 'ro-RO' : 'en-US';
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rounded);
  }

  function fmtUSD(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (num === 0 || Object.is(num, -0)) return '0';
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => { toast.className = 'toast hidden'; }, 3000);
  }

  // ============ Update Checker ============
  let _updateData = null; // cached update info

  async function checkForUpdates() {
    try {
      const res = await fetch('/api/check-update');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.updateAvailable) return;
      _updateData = data;

      const banner = document.getElementById('update-banner');
      const textEl = document.getElementById('update-banner-text');
      const updateBtn = document.getElementById('update-banner-btn');
      const dismissBtn = document.getElementById('update-banner-dismiss');

      textEl.textContent = I18n.t('update.available', {
        current: data.currentVersion,
        latest: data.latestVersion
      });
      updateBtn.textContent = I18n.t('update.updateNow');
      banner.classList.remove('hidden');

      updateBtn.addEventListener('click', () => {
        banner.classList.add('hidden');
        startUpdateFlow(data);
      }, { once: true });

      dismissBtn.addEventListener('click', () => {
        banner.classList.add('hidden');
      }, { once: true });
    } catch { /* silently ignore network errors */ }
  }

  async function startUpdateFlow(data) {
    const modal = document.getElementById('update-modal');
    const closeBtn = document.getElementById('update-modal-close');
    const stepDownload = document.getElementById('update-step-download');
    const stepConfirm = document.getElementById('update-step-confirm');
    const stepInstalling = document.getElementById('update-step-installing');
    const stepResult = document.getElementById('update-step-result');
    const progressFill = document.getElementById('update-progress-fill');
    const downloadText = document.getElementById('update-download-text');
    const resultIcon = document.getElementById('update-result-icon');
    const resultText = document.getElementById('update-result-text');
    const installBtn = document.getElementById('update-install-btn');
    const cancelBtn = document.getElementById('update-cancel-btn');

    // Reset all steps
    [stepDownload, stepConfirm, stepInstalling, stepResult].forEach(s => s.classList.add('hidden'));
    stepDownload.classList.remove('hidden');
    progressFill.style.width = '0%';
    closeBtn.style.display = '';
    modal.classList.remove('hidden');

    downloadText.textContent = I18n.t('update.downloading', { version: data.latestVersion });

    // Timers/intervals tracked for cleanup on error
    let timerInterval = null;
    let installProgressInterval = null;
    let restartProgressInterval = null;

    // Animate progress bar (indeterminate-ish since we don't have streaming progress)
    let progressInterval = setInterval(() => {
      const cur = parseFloat(progressFill.style.width) || 0;
      if (cur < 90) progressFill.style.width = (cur + 2) + '%';
    }, 500);

    try {
      // Download
      const dlRes = await fetch('/api/update/download', { method: 'POST' });
      clearInterval(progressInterval);
      const dlData = await dlRes.json();

      if (!dlRes.ok || !dlData.success) {
        throw new Error(dlData.error || 'Download failed');
      }

      progressFill.style.width = '100%';

      // Show confirm step
      setTimeout(() => {
        stepDownload.classList.add('hidden');
        stepConfirm.classList.remove('hidden');
        document.getElementById('update-confirm-text').textContent = I18n.t('update.confirmInstall');
      }, 500);

      // Wait for user decision
      const userChoice = await new Promise(resolve => {
        const onInstall = () => { cancelBtn.removeEventListener('click', onCancel); resolve(true); };
        const onCancel = () => { installBtn.removeEventListener('click', onInstall); resolve(false); };
        installBtn.addEventListener('click', onInstall, { once: true });
        cancelBtn.addEventListener('click', onCancel, { once: true });
      });

      if (!userChoice) {
        modal.classList.add('hidden');
        return;
      }

      // Install
      stepConfirm.classList.add('hidden');
      stepInstalling.classList.remove('hidden');
      closeBtn.style.display = 'none'; // prevent closing during install

      // Progress bar + timer for install phase
      const installProgressFill = document.getElementById('update-install-progress-fill');
      const installTimer = document.getElementById('update-install-timer');
      installProgressFill.style.width = '5%'; // start visible
      installTimer.textContent = '0:00';
      let installSeconds = 0;
      timerInterval = setInterval(() => {
        installSeconds++;
        const mins = Math.floor(installSeconds / 60);
        const secs = installSeconds % 60;
        installTimer.textContent = mins + ':' + String(secs).padStart(2, '0');
      }, 1000);
      // Smooth progress: 0→60% over ~30s during install, then 60→95% during restart polling
      let installProgress = 0;
      installProgressInterval = setInterval(() => {
        if (installProgress < 60) {
          installProgress += 1.5;
          installProgressFill.style.width = Math.min(installProgress, 60) + '%';
        }
      }, 500);

      const instRes = await fetch('/api/update/install', { method: 'POST' });
      const instData = await instRes.json();

      if (!instRes.ok || !instData.success) {
        clearInterval(timerInterval);
        clearInterval(installProgressInterval);
        throw new Error(instData.error || 'Install failed');
      }

      // Install API returned — switch to restart polling phase (60→95%)
      clearInterval(installProgressInterval);
      installProgress = 60;
      installProgressFill.style.width = '60%';
      restartProgressInterval = setInterval(() => {
        if (installProgress < 95) {
          installProgress += 0.5;
          installProgressFill.style.width = installProgress + '%';
        }
      }, 300);

      // Update installing text to show restarting phase (keep progress bar + timer visible)
      document.getElementById('update-installing-text').textContent = I18n.t('update.restarting');

      // Poll until new server is up
      const pollForRestart = setInterval(async () => {
        try {
          const r = await fetch('/api/version', { cache: 'no-store' });
          if (r.ok) {
            clearInterval(pollForRestart);
            clearInterval(timerInterval);
            clearInterval(restartProgressInterval);
            installProgressFill.style.width = '100%';
            // Switch to result step
            stepInstalling.classList.add('hidden');
            stepResult.classList.remove('hidden');
            resultIcon.textContent = '\u2714';
            resultIcon.classList.remove('spinner');
            resultText.textContent = I18n.t('update.success', { version: instData.version });
            closeBtn.style.display = '';
            // Auto-reload after 3 seconds
            setTimeout(() => location.reload(), 3000);
          }
        } catch { /* server still restarting */ }
      }, 1000);

    } catch (err) {
      clearInterval(progressInterval);
      if (timerInterval) clearInterval(timerInterval);
      if (installProgressInterval) clearInterval(installProgressInterval);
      if (restartProgressInterval) clearInterval(restartProgressInterval);
      [stepDownload, stepConfirm, stepInstalling].forEach(s => s.classList.add('hidden'));
      stepResult.classList.remove('hidden');
      resultIcon.textContent = '\u2718';
      resultIcon.classList.remove('spinner');
      resultText.textContent = I18n.t('update.failed', { error: err.message });
      closeBtn.style.display = '';
    }

    // Close modal handler
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    }, { once: true });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    }, { once: true });
  }

  // Init on DOM ready
  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    init();
    const restartBtn = document.getElementById('restart-btn');

    // Restart server button
    restartBtn.addEventListener('click', async () => {
      if (!confirm(I18n.t('footer.confirmRestart'))) return;
      try {
        await fetch('/api/restart', { method: 'POST' });
        showToast(I18n.t('footer.restarting'), 'success');
        restartBtn.classList.remove('highlight');
        // Poll until server is back up, then reload
        const poll = setInterval(async () => {
          try {
            const r = await fetch('/api/server-hash', { cache: 'no-store' });
            if (r.ok) { clearInterval(poll); location.reload(); }
          } catch { /* still down */ }
        }, 500);
      } catch { /* server is stopping */ }
    });

    // Check for server code changes every 10 seconds
    let knownHash = null;
    async function checkServerHash() {
      try {
        const resp = await fetch('/api/server-hash');
        const data = await resp.json();
        if (knownHash === null) {
          knownHash = data.hash;
        } else if (data.hash !== knownHash) {
          restartBtn.classList.add('highlight');
        }
      } catch { /* server down */ }
    }
    checkServerHash();
    setInterval(checkServerHash, 10000);

    // Scroll to top button
    const scrollBtn = document.getElementById('scroll-top-btn');
    scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('hidden', window.scrollY < 300);
    });
  });
})();

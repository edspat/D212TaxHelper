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
      btn.textContent = '🖥️';
      btn.title = 'Theme: Auto (System)';
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
      // Cycle: auto → dark → light → auto
      const next = current === 'auto' ? 'dark' : current === 'dark' ? 'light' : 'auto';
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
        // Skip nav-btn-styled buttons that aren't actual top-level tabs (e.g. the
        // Add Data sub-tab switcher uses .nav-btn for visual parity but no data-tab).
        if (!btn.dataset.tab) return;
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
      clearInlineEditState();
      render();
    });

    // Forms
    document.getElementById('data-form').addEventListener('submit', handleDataSubmit);
    document.getElementById('upload-form').addEventListener('submit', handleUpload);
    document.getElementById('rates-form').addEventListener('submit', handleRatesSubmit);
    document.getElementById('tax-rates-form').addEventListener('submit', handleTaxRatesSubmit);

    // D-7 — export D212 XML skeleton from current year's computed data
    const xmlBtn = document.getElementById('btn-export-d212-xml');
    if (xmlBtn) xmlBtn.addEventListener('click', () => exportD212Xml(selectedYear));

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
            html += '<pre style="background:var(--bg-secondary);padding:0.75rem;border-radius:var(--radius);overflow-x:auto;font-size:0.85rem;line-height:1.6;white-space:pre;"><code style="padding:0;background:none;">' + codeLines.join('\n') + '</code></pre>';
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
      if (inCode) html += '<pre style="background:var(--bg-secondary);padding:0.75rem;border-radius:var(--radius);overflow-x:auto;font-size:0.85rem;line-height:1.6;white-space:pre;"><code style="padding:0;background:none;">' + codeLines.join('\n') + '</code></pre>';
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

    // Wire Add Data sub-tab switcher + advanced toggle (one-time)
    setupAddDataModeSwitcher();

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

  // ============ Tab navigation (Phase: consolidated 5-tab layout) ============
  //
  // The top-level nav was reduced from 8 to 5 buttons (Dashboard / Date /
  // Calcul / Depunere / Avansat). The 7 functional sections still exist in
  // the DOM under their original IDs (`tab-input`, `tab-import`, `tab-income`,
  // `tab-taxes`, `tab-validate`, `tab-submit`, `tab-raw`); they are now grouped
  // under the 4 multi-subtab groups below. A second-row "sub-tab bar" appears
  // between the header and the active section whenever the active group has
  // more than one subtab.
  //
  // Legacy callers that pass a subtab name (e.g. `switchTab('validate')`) and
  // anchor links like `#tab-income` continue to work: the resolver below
  // detects whether `tabName` is a group key or a subtab key and activates
  // BOTH the parent group AND the right subtab.
  const TAB_GROUPS = {
    data: [
      { id: 'input',  i18n: 'nav.subInput',  fallback: '✏️ Adaugă/editează date' },
      { id: 'import', i18n: 'nav.subImport', fallback: '📁 Importă document' },
    ],
    calc: [
      { id: 'income', i18n: 'nav.subIncome', fallback: '📊 Detalii venituri' },
      { id: 'taxes',  i18n: 'nav.subTaxes',  fallback: '💰 Impozit & CASS' },
    ],
    depunere: [
      { id: 'validate', i18n: 'nav.subValidate', fallback: '🔬 Validează & pregătește' },
      { id: 'submit',   i18n: 'nav.subSubmit',   fallback: '🧭 Ghid depunere ANAF' },
    ],
    advanced: [
      { id: 'raw', i18n: 'nav.subRaw', fallback: '📜 Raw Data' },
    ],
  };
  // Reverse map for routing legacy subtab names through their parent group.
  const SUBTAB_PARENT = {};
  for (const [g, subs] of Object.entries(TAB_GROUPS)) {
    for (const s of subs) SUBTAB_PARENT[s.id] = g;
  }
  // Per-group memory so users land on the last-visited subtab when they
  // re-enter a group during the same session. Persisted across reloads via
  // localStorage so the experience survives a refresh.
  const _LAST_SUBTAB_KEY = 'd212.lastSubtab';
  function _loadLastSubtabs() {
    try { return JSON.parse(localStorage.getItem(_LAST_SUBTAB_KEY) || '{}') || {}; } catch { return {}; }
  }
  function _saveLastSubtab(group, sub) {
    try {
      const m = _loadLastSubtabs();
      m[group] = sub;
      localStorage.setItem(_LAST_SUBTAB_KEY, JSON.stringify(m));
    } catch { /* localStorage disabled — ignore */ }
  }

  /** Render the second-row sub-tab bar for a given group + active subtab. */
  function _renderSubtabBar(group, activeSub) {
    const bar = document.getElementById('subtab-bar');
    if (!bar) return;
    const subs = TAB_GROUPS[group] || [];
    if (subs.length <= 1) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }
    bar.style.display = '';
    bar.innerHTML = subs.map(s => {
      const label = (I18n && I18n.t && I18n.t(s.i18n)) || s.fallback;
      const isActive = s.id === activeSub ? ' active' : '';
      const ariaSel = s.id === activeSub ? 'true' : 'false';
      return `<button type="button" role="tab" aria-selected="${ariaSel}" class="subtab-btn${isActive}" data-subtab="${s.id}">${label}</button>`;
    }).join('');
    bar.querySelectorAll('.subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.subtab));
    });
  }

  function switchTab(tabName) {
    // Resolve the target group + subtab. `tabName` may be either:
    //   - a top-level group key (e.g. "data", "calc") — pick the remembered
    //     or first subtab; OR
    //   - a subtab key (e.g. "income", "validate") — activate its parent
    //     group automatically. Standalone tabs (dashboard) have no group.
    let group, subtab;
    if (TAB_GROUPS[tabName]) {
      group = tabName;
      const remembered = _loadLastSubtabs()[group];
      const subs = TAB_GROUPS[group];
      subtab = (remembered && subs.some(s => s.id === remembered)) ? remembered : subs[0].id;
    } else if (SUBTAB_PARENT[tabName]) {
      group = SUBTAB_PARENT[tabName];
      subtab = tabName;
    } else {
      // Standalone tab (Dashboard). Hide the subtab bar.
      group = null;
      subtab = tabName;
    }

    // Clear active state on real top-level tabs (those with a data-tab attr).
    // Sub-tab buttons (e.g. Add Data mode switcher) share the .nav-btn class
    // for styling and manage their own .active state via applyAddDataMode().
    document.querySelectorAll('.nav-btn[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    // Activate the top-level group button (or the standalone Dashboard).
    const topName = group || subtab;
    document.querySelector(`.nav-btn[data-tab="${topName}"]`)?.classList.add('active');
    document.getElementById(`tab-${subtab}`)?.classList.add('active');

    if (group) {
      _saveLastSubtab(group, subtab);
      _renderSubtabBar(group, subtab);
    } else {
      // Hide subtab bar for standalone tabs (Dashboard).
      const bar = document.getElementById('subtab-bar');
      if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; }
    }

    // Section-specific render hooks — keep behavior parity with the old flow.
    if (subtab === 'raw') loadRawFiles();
    if (subtab === 'input') populateForm();
    if (subtab === 'import') renderImportExistingPanel();
    if (subtab === 'submit') wireSubmitTabLinks();
    if (subtab === 'validate') renderSubmissionGuide();
  }

  /** Wire the "Go to Validate & Prepare" link inside Submission Guide. */
  function wireSubmitTabLinks() {
    const link = document.getElementById('submit-goto-validate');
    if (link && !link.dataset.wired) {
      link.dataset.wired = '1';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('validate');
      });
    }
  }

  // ============ D212 SUBMISSION GUIDE TAB ============
  /**
   * Render the "Valorile de introdus în DUF" table on the submission guide tab.
   * Maps our computed numbers to the DUF web form's field labels so the user
   * has a one-screen reference while filling the form online.
   *
   * Per the official ANAF guide (Ghid_Precompletare_D212_2026 v1, May 2026),
   * the DUF portal does NOT accept external XML upload — values are typed
   * into the web form. This panel is the bridge between our calculations
   * and the user's keyboard.
   */
  function renderSubmissionGuide() {
    const container = document.getElementById('validate-duf-values');
    if (!container) return;
    const data = computeYearData(selectedYear);
    const fmtRON = (n) => Math.round(n || 0).toLocaleString('ro-RO') + ' RON';

    const sections = [];

    const dufEntry = _dufImports.get(selectedYear);
    const compare = dufEntry && dufEntry.compare;
    const picks = _getPicksForYear(selectedYear);
    // Build a quick lookup: rowKey -> { effectivePick, anaf, local } so per-field
    // resolution below is O(1). When no DUF XML has been imported, this stays empty
    // and every value falls back to local (current behavior).
    const pickIndex = new Map();
    if (compare) {
      for (const row of compare.rows) {
        pickIndex.set(row.rowKey, {
          pick: _effectivePick(row, picks),
          anaf: row.anaf,
          local: row.local,
        });
      }
    }
    /**
     * Resolve a single (label, localValue, rowKey) tuple to the final value the
     * user should type into DUF, picking ANAF when the user (or default policy)
     * decided so. Returns `{val, source}` — source is 'anaf' / 'local' / null.
     */
    const resolve = (localValue, rowKey) => {
      if (!rowKey) return { val: localValue, source: null };
      const idx = pickIndex.get(rowKey);
      if (!idx) return { val: localValue, source: null };
      if (idx.pick === 'anaf' && idx.anaf != null) return { val: idx.anaf, source: 'anaf' };
      if (idx.pick === 'local') return { val: idx.local, source: 'local' };
      if (idx.pick == null && idx.anaf != null && idx.local == null) return { val: idx.anaf, source: 'anaf' };
      return { val: localValue, source: idx.pick };
    };
    const fmtR = (v) => ({ val: fmtRON(v.val), source: v.source });

    // cap14 — Foreign-source income (Venituri din străinătate, secțiunea cap14)
    if ((data.cap14Rows || []).length > 0) {
      const rows = [];
      for (const r of data.cap14Rows) {
        const isDividends = r.str_categ_venit === '2018';
        const catLabel = isDividends
          ? (I18n.t('submit.catDividends') || 'Dividende (cod 2018)')
          : (I18n.t('submit.catCapGains') || 'Câștiguri din transferul titlurilor de valoare (cod 2012)');
        const country = r.str_stat_realiz_v;
        const code = r.str_categ_venit;
        const kVN = `cap14.${country}.${code}.str_venit_net_anual`;
        const kCF = `cap14.${country}.${code}.str_credit_fiscal`;
        rows.push({ section: `🌍 cap14 — ${country} · ${catLabel}`, items: [
          { duf: 'Țara realizării venitului', val: country },
          { duf: 'Categoria de venit', val: `${code} — ${isDividends ? 'Dividende' : 'Câștiguri titluri'}` },
          { duf: 'Metoda dublei impuneri', val: r.dubla_impunere === '1' ? 'Credit fiscal (1)' : 'Scutire (2)' },
          { duf: 'Rd.1 Venit brut (RON)', ...fmtR(resolve(r.str_venit_brut, null)) },
          { duf: 'Rd.2 Cheltuieli deductibile (RON)', ...fmtR(resolve(r.str_chelt_deduc, null)) },
          { duf: 'Rd.3 Venit net anual (RON)', ...fmtR(resolve(r.str_venit_net_anual, kVN)) },
          { duf: 'Rd.7 Venit recalculat (RON)', ...fmtR(resolve(r.str_venit_recalculat, null)) },
          { duf: 'Rd.8 Impozit datorat în RO (RON)', ...fmtR(resolve(r.str_impozit_datorat_Ro, null)) },
          { duf: 'Rd.9 Impozit plătit în străinătate (RON)', ...fmtR(resolve(r.str_impozit_platit, null)) },
          { duf: 'Rd.10 Credit fiscal recunoscut (RON)', ...fmtR(resolve(r.str_credit_fiscal, kCF)) },
          { duf: 'Rd.11 Diferență impozit datorat (RON)', ...fmtR(resolve(r.str_dif_impozit_datorat, null)) },
        ]});
      }
      sections.push(...rows);
    }

    // cap11 — Romanian-source investment income
    if ((data.cap11Rows || []).length > 0) {
      const r = data.cap11Rows[0];
      const code = r.categ_venit;
      const kVN = `cap11.${code}.venit_net_anual`;
      const kIR = `cap11.${code}.impozit_retinut`;
      sections.push({ section: '🇷🇴 cap11 — Câștiguri RO (titluri de valoare, cod 1012)', items: [
        { duf: 'Categoria de venit', val: '1012 — Câștiguri din transferul titlurilor de valoare' },
        { duf: 'Rd.1 Venit brut (RON)', ...fmtR(resolve(r.venit_brut, null)) },
        { duf: 'Rd.3 Venit net anual (RON)', ...fmtR(resolve(r.venit_net_anual, kVN)) },
        { duf: 'Rd.5 Pierdere precedentă (RON)', ...fmtR(resolve(r.pierdere_precedenta, null)) },
        { duf: 'Rd.6 Pierdere compensată (RON)', ...fmtR(resolve(r.pierdere_compensata, null)) },
        { duf: 'Rd.7 Venit recalculat (RON)', ...fmtR(resolve(r.venit_recalculat, null)) },
        { duf: 'Rd.8 Impozit anual (RON)', ...fmtR(resolve(r.impozit11, null)) },
        { duf: 'Rd.9 Impozit reținut la sursă (RON)', ...fmtR(resolve(r.impozit_retinut, kIR)) },
      ]});
    }

    // CASS investments (Capitolul II)
    if (data.obligRealizat && data.obligRealizat.cass_ven_inv > 0) {
      const o = data.obligRealizat;
      sections.push({ section: '💊 CASS pe venituri din investiții (Capitolul II)', items: [
        { duf: 'Total venituri din investiții (RON)', ...fmtR(resolve(o.cass_ven_inv, 'oblig.cass_ven_inv')) },
        { duf: 'Bază anuală de calcul CASS (RON)', ...(function(){
            const r = resolve(o.cass_baza, 'oblig.cass_baza');
            const baseStr = fmtRON(r.val);
            const suffix = r.val > 0 ? ' (' + (r.val / 4050).toFixed(0) + ' × salariu minim)' : '';
            return { val: baseStr + suffix, source: r.source };
          })() },
        { duf: 'CASS anuală 10% (RON)', ...fmtR(resolve(o.cass_anuala, null)) },
        { duf: 'CASS datorat (RON)', ...fmtR(resolve(o.cass_datorat, 'oblig.cass_datorat')) },
        { duf: 'CASS reținut la sursă (RON)', ...fmtR(resolve(o.cass_retinut, null)) },
        { duf: 'CASS de plată (RON)', ...fmtR(resolve(o.cass_dif_plus, null)) },
        { duf: 'Bifa "sistem real, plafon 24 SM"', val: 'Da (cod 3)' },
      ]});
    }

    if (sections.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted);font-style:italic;">${esc(I18n.t('submit.noValues') || 'Nu există valori de introdus în DUF pentru acest an — adaugă mai întâi date sau importă documente.')}</p>`;
      return;
    }

    let html = '';
    if (compare) {
      // Optional header: tell the user we've baked DUF picks into the values.
      const anafCount = sections.reduce((s, sec) => s + sec.items.filter((i) => i.source === 'anaf').length, 0);
      html += `<p style="background:rgba(88,166,255,0.06);border-left:3px solid var(--accent);padding:0.5rem 0.75rem;font-size:0.85rem;margin:0 0 0.75rem;border-radius:var(--radius);">
        ${esc(I18n.t('submit.valuesWithPicks') || 'Valorile reflectă XML-ul DUF importat')} ${anafCount > 0 ? ` — <strong>${anafCount}</strong> ${esc(I18n.t('submit.valuesFromAnaf') || 'preluate din ANAF')}` : ''}
      </p>`;
    }
    for (const s of sections) {
      html += `<div style="margin:1rem 0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
        <header style="background:var(--bg-secondary);padding:0.6rem 1rem;font-weight:600;font-size:0.95rem;">${esc(s.section)}</header>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="border-bottom:1px solid var(--border);font-size:0.8rem;color:var(--text-muted);">
            <th style="padding:0.5rem 1rem;text-align:left;">${esc(I18n.t('submit.dufField') || 'Câmpul din DUF')}</th>
            <th style="padding:0.5rem 1rem;text-align:right;">${esc(I18n.t('submit.dufValue') || 'Valoare')}</th>
            <th style="padding:0.5rem 1rem;text-align:center;">${esc(I18n.t('submit.dufSource') || 'Sursă')}</th>
          </tr></thead>
          <tbody>`;
      for (const it of s.items) {
        const sourceBadge = it.source === 'anaf'
          ? `<span title="${esc(I18n.t('submit.sourceAnafTip') || 'Preluat din XML-ul DUF (decizia ta)')}" style="font-size:0.7rem;padding:0.1rem 0.4rem;background:var(--accent);color:#fff;border-radius:var(--radius);">🅰 ANAF</span>`
          : it.source === 'local'
            ? `<span title="${esc(I18n.t('submit.sourceLocalTip') || 'Calculat local din PDF-urile broker')}" style="font-size:0.7rem;padding:0.1rem 0.4rem;background:var(--success);color:#fff;border-radius:var(--radius);">🟢 Local</span>`
            : '';
        html += `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:0.45rem 1rem;font-size:0.9rem;">${esc(it.duf)}</td>
          <td style="padding:0.45rem 1rem;text-align:right;font-variant-numeric:tabular-nums;font-weight:500;">${esc(it.val)}</td>
          <td style="padding:0.45rem 1rem;text-align:center;">${sourceBadge}</td>
        </tr>`;
      }
      html += `</tbody></table></div>`;
    }
    container.innerHTML = html;

    // Wire the DUF XML drop-zone (idempotent — replaces handlers each render)
    setupDufImportZone();
    setupD205Editor();
  }

  // ============ D205 PER-PAYER MANUAL ENTRY + MATCHING ============
  /**
   * Per-year list of D205 entries the user manually transcribed from the
   * portal's "Sursa informațiilor în detaliu → Toate sursele" dialog.
   * Map<year, Array<{id, payerName, payerCif, category, grossRON, taxRON, regNumber?}>>.
   * In-memory only — cleared on reload, by design (PII safety).
   */
  const _d205Entries = new Map();
  function _getD205EntriesForYear(year) {
    if (!_d205Entries.has(year)) _d205Entries.set(year, []);
    return _d205Entries.get(year);
  }

  function setupD205Editor() {
    const addBtn = document.getElementById('validate-d205-add');
    const pasteBtn = document.getElementById('validate-d205-paste');
    const clearBtn = document.getElementById('validate-d205-clear');
    if (!addBtn || !pasteBtn || !clearBtn) return;
    if (addBtn.dataset.wired === '1') {
      _renderD205Table();
      return;
    }
    addBtn.dataset.wired = '1';
    addBtn.addEventListener('click', () => {
      const list = _getD205EntriesForYear(selectedYear);
      list.push({ id: 'd205-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), payerName: '', payerCif: '', category: '', grossRON: 0, taxRON: 0, regNumber: '' });
      _renderD205Table();
    });
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const added = _ingestD205Paste(text, selectedYear);
        showToast(`${added} ${I18n.t('validate.d205PasteOk') || 'rânduri adăugate din clipboard'}`, added > 0 ? 'success' : 'error');
        _renderD205Table();
      } catch (err) {
        showToast(err.message || (I18n.t('validate.d205PasteErr') || 'Eroare lipire clipboard'), 'error');
      }
    });
    clearBtn.addEventListener('click', () => {
      if (!confirm(I18n.t('validate.d205ClearConfirm') || 'Ștergi toate rândurile D205 pentru anul curent?')) return;
      _d205Entries.set(selectedYear, []);
      _renderD205Table();
    });
    _renderD205Table();
  }

  /**
   * Ingest a tab-separated paste (typical when copying from a web table) and
   * try to map columns by header keywords. Returns how many rows were added.
   *
   * Expected columns (any order, case-insensitive):
   *   cod fiscal / cif / payer  → payerCif
   *   nume / payer name         → payerName
   *   categoria / cat            → category
   *   venit brut / brut / suma   → grossRON
   *   impozit                    → taxRON
   *   numar inregistrare / nr    → regNumber
   *
   * If no header row is detected, falls back to a positional guess:
   *   [regNumber?, date?, cif, name, category, ..., gross, tax, ...]
   */
  function _ingestD205Paste(text, year) {
    if (!text || !text.trim()) return 0;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return 0;
    const list = _getD205EntriesForYear(year);
    let added = 0;
    // Detect a header row by looking for known keywords.
    const headerRe = /\b(cod fiscal|cif|categori|venit brut|brut|impozit|platit)/i;
    let hasHeader = headerRe.test(lines[0]);
    let cols = null;
    if (hasHeader) {
      const header = lines[0].split(/\t|\s{2,}|;|,/).map((c) => c.trim().toLowerCase());
      cols = {
        cif: header.findIndex((h) => /cod fiscal|^cif$/.test(h)),
        name: header.findIndex((h) => /nume firm|nume|denumire|payer/.test(h)),
        cat: header.findIndex((h) => /categori|^cat$/.test(h)),
        gross: header.findIndex((h) => /venit brut|brut|baza|suma/.test(h)),
        tax: header.findIndex((h) => /impozit/.test(h)),
        reg: header.findIndex((h) => /num.?r ?inreg|registratur|^nr$/.test(h)),
      };
    }
    for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
      const parts = lines[i].split(/\t|\s{2,}|;/).map((p) => p.trim());
      if (parts.length < 3) continue;
      let payerName, payerCif, category, grossRON, taxRON, regNumber;
      if (cols) {
        payerCif = cols.cif >= 0 ? (parts[cols.cif] || '') : '';
        payerName = cols.name >= 0 ? (parts[cols.name] || '') : '';
        category = cols.cat >= 0 ? (parts[cols.cat] || '').replace(/[^\d]/g, '') : '';
        grossRON = cols.gross >= 0 ? _parsePasteNumber(parts[cols.gross]) : 0;
        taxRON = cols.tax >= 0 ? _parsePasteNumber(parts[cols.tax]) : 0;
        regNumber = cols.reg >= 0 ? (parts[cols.reg] || '') : '';
      } else {
        // Positional fallback: heuristic detect cif (long digits) + name (longest token).
        const cifIdx = parts.findIndex((p) => /^\d{7,10}$/.test(p));
        payerCif = cifIdx >= 0 ? parts[cifIdx] : '';
        // Name = the longest non-numeric token after cif.
        let nameCandidate = '';
        for (let j = cifIdx + 1; j < parts.length; j++) {
          if (/^\d/.test(parts[j])) continue;
          if (parts[j].length > nameCandidate.length) nameCandidate = parts[j];
        }
        payerName = nameCandidate;
        // Category = a 2-digit number near the name.
        const catIdx = parts.findIndex((p) => /^\d{1,2}$/.test(p) && Number(p) > 0 && Number(p) < 60);
        category = catIdx >= 0 ? parts[catIdx].padStart(2, '0') : '';
        // Gross + tax: try to find the two largest numbers.
        const nums = parts.map(_parsePasteNumber).filter((n) => n > 0).sort((a, b) => b - a);
        grossRON = nums[0] || 0;
        taxRON = nums[1] || 0;
        regNumber = '';
      }
      if (!payerName && !payerCif && !grossRON) continue;
      list.push({
        id: 'd205-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '-' + i,
        payerName, payerCif, category, grossRON, taxRON, regNumber,
      });
      added++;
    }
    return added;
  }

  function _parsePasteNumber(s) {
    if (!s) return 0;
    const cleaned = String(s).replace(/[^\d,.\-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function _renderD205Table() {
    const tableEl = document.getElementById('validate-d205-table');
    const summaryEl = document.getElementById('validate-d205-match-summary');
    if (!tableEl || !summaryEl) return;
    const list = _getD205EntriesForYear(selectedYear);
    if (list.length === 0) {
      tableEl.innerHTML = `<p style="color:var(--text-muted);font-style:italic;font-size:0.9rem;">${esc(I18n.t('validate.d205Empty') || 'Niciun rând D205 introdus. Folosește butoanele de mai sus.')}</p>`;
      summaryEl.innerHTML = '';
      return;
    }
    let html = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
      <thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted);">
        <th style="padding:0.4rem;text-align:left;">${esc(I18n.t('validate.d205Payer') || 'Plătitor')}</th>
        <th style="padding:0.4rem;text-align:left;">${esc(I18n.t('validate.d205Cif') || 'CIF')}</th>
        <th style="padding:0.4rem;text-align:left;">${esc(I18n.t('validate.d205Category') || 'Cod')}</th>
        <th style="padding:0.4rem;text-align:right;">${esc(I18n.t('validate.d205Gross') || 'Venit brut (RON)')}</th>
        <th style="padding:0.4rem;text-align:right;">${esc(I18n.t('validate.d205Tax') || 'Impozit (RON)')}</th>
        <th style="padding:0.4rem;"></th>
      </tr></thead><tbody>`;
    for (const r of list) {
      html += `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:0.3rem;"><input type="text" data-id="${esc(r.id)}" data-field="payerName" value="${esc(r.payerName)}" style="width:100%;background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:0.25rem;border-radius:var(--radius);font-size:0.85rem;" placeholder="ex: XTB SA"></td>
        <td style="padding:0.3rem;"><input type="text" data-id="${esc(r.id)}" data-field="payerCif" value="${esc(r.payerCif)}" style="width:100%;background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:0.25rem;border-radius:var(--radius);font-size:0.85rem;" placeholder="ex: 24270192"></td>
        <td style="padding:0.3rem;"><input type="text" data-id="${esc(r.id)}" data-field="category" value="${esc(r.category)}" style="width:60px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:0.25rem;border-radius:var(--radius);font-size:0.85rem;" placeholder="09"></td>
        <td style="padding:0.3rem;text-align:right;"><input type="number" step="any" data-id="${esc(r.id)}" data-field="grossRON" value="${esc(String(r.grossRON))}" style="width:120px;text-align:right;background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:0.25rem;border-radius:var(--radius);font-variant-numeric:tabular-nums;font-size:0.85rem;"></td>
        <td style="padding:0.3rem;text-align:right;"><input type="number" step="any" data-id="${esc(r.id)}" data-field="taxRON" value="${esc(String(r.taxRON || 0))}" style="width:100px;text-align:right;background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:0.25rem;border-radius:var(--radius);font-variant-numeric:tabular-nums;font-size:0.85rem;"></td>
        <td style="padding:0.3rem;text-align:center;"><button type="button" data-id="${esc(r.id)}" class="d205-row-delete" style="background:transparent;border:0;color:var(--danger,#c53030);cursor:pointer;font-size:1rem;">🗑</button></td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
    tableEl.innerHTML = html;

    // Wire inputs
    tableEl.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const row = list.find((x) => x.id === inp.dataset.id);
        if (!row) return;
        const f = inp.dataset.field;
        if (f === 'grossRON' || f === 'taxRON') row[f] = parseFloat(inp.value) || 0;
        else row[f] = inp.value;
        _renderD205MatchSummary();
      });
    });
    tableEl.querySelectorAll('.d205-row-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = list.findIndex((x) => x.id === btn.dataset.id);
        if (idx >= 0) list.splice(idx, 1);
        _renderD205Table();
      });
    });
    _renderD205MatchSummary();
  }

  /** Render the match table below the editor — calls the inline matcher. */
  function _renderD205MatchSummary() {
    const summaryEl = document.getElementById('validate-d205-match-summary');
    if (!summaryEl) return;
    const list = _getD205EntriesForYear(selectedYear);
    if (list.length === 0) {
      summaryEl.innerHTML = '';
      return;
    }
    const yd = appData.years?.[selectedYear] || {};
    const result = _d205MatchInline(list, yd);
    const fmt = (n) => Math.round(n || 0).toLocaleString('ro-RO') + ' RON';
    const badge = (status) => {
      const cfg = {
        'matched-exact':   { c: 'var(--success)',                t: '✓ Match exact' },
        'matched-amount':  { c: 'var(--warning,#b35900)',         t: '≈ Match (≈)' },
        'possible':        { c: 'var(--accent)',                  t: '❓ Posibil' },
        'unmatched-anaf':  { c: 'var(--danger,#c53030)',          t: '🆕 Doar ANAF' },
        'unmatched-local': { c: 'var(--text-muted)',              t: '⚠ Doar local' },
      }[status] || { c: 'var(--text-muted)', t: status };
      return `<span style="background:${cfg.c};color:#fff;font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:var(--radius);white-space:nowrap;">${esc(cfg.t)}</span>`;
    };

    let html = `<div style="background:var(--bg-secondary);padding:0.5rem 1rem;border-radius:var(--radius);font-size:0.85rem;margin-bottom:0.5rem;">
      <strong>${esc(I18n.t('validate.d205MatchSummary') || 'Rezumat potrivire:')}</strong>
      ${result.totals.exactCount} ${esc(I18n.t('validate.d205Exact') || 'exact')} · ${result.totals.nearCount} ${esc(I18n.t('validate.d205Near') || 'aproape')} · ${result.totals.possibleCount} ${esc(I18n.t('validate.d205Possible') || 'posibil')} · ${result.totals.unmatchedAnafCount} ${esc(I18n.t('validate.d205OnlyAnaf') || 'doar ANAF')} · ${result.totals.unmatchedLocalCount} ${esc(I18n.t('validate.d205OnlyLocal') || 'doar local')}
    </div>`;
    if (result.matches.length > 0) {
      html += `<div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:0.5rem;"><table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
        <thead><tr style="border-bottom:1px solid var(--border);background:var(--bg-secondary);color:var(--text-muted);">
          <th style="padding:0.35rem;text-align:left;">ANAF</th>
          <th style="padding:0.35rem;text-align:right;">${esc(fmt(0).replace('0', I18n.t('validate.d205AnafGross') || 'Sumă ANAF'))}</th>
          <th style="padding:0.35rem;text-align:left;">Local</th>
          <th style="padding:0.35rem;text-align:right;">${esc(I18n.t('validate.d205LocalGross') || 'Sumă local')}</th>
          <th style="padding:0.35rem;text-align:center;">${esc(I18n.t('submit.colStatus') || 'Stare')}</th>
        </tr></thead><tbody>`;
      for (const m of result.matches) {
        html += `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:0.35rem;"><strong>${esc(m.anaf.payerName || '?')}</strong> · cat ${esc(m.anaf.category || '?')}${m.anaf.broker ? ` · <small>(${esc(m.anaf.broker)})</small>` : ''}${m.hint ? `<br><small style="color:var(--text-muted);">${esc(m.hint)}</small>` : ''}</td>
          <td style="padding:0.35rem;text-align:right;font-variant-numeric:tabular-nums;">${esc(fmt(m.anaf.grossRON))}</td>
          <td style="padding:0.35rem;">${m.local ? `<strong>${esc(m.local.broker)}</strong> · ${esc(m.local.label)} <small style="color:var(--text-muted);">(${esc(m.local.source)})</small>` : '—'}</td>
          <td style="padding:0.35rem;text-align:right;font-variant-numeric:tabular-nums;">${m.local ? esc(fmt(m.local.grossRON)) : '—'}</td>
          <td style="padding:0.35rem;text-align:center;">${badge(m.status)}</td>
        </tr>`;
      }
      html += `</tbody></table></div>`;
    }
    if (result.unmatchedLocal.length > 0) {
      html += `<details style="border:1px solid var(--border);border-radius:var(--radius);padding:0.5rem 0.75rem;background:rgba(255,193,7,0.04);">
        <summary style="cursor:pointer;font-size:0.85rem;font-weight:500;">⚠ ${result.unmatchedLocal.length} ${esc(I18n.t('validate.d205UnmatchedLocalSummary') || 'surse locale fără potrivire ANAF')}</summary>
        <ul style="margin:0.5rem 0 0;padding-left:1.2rem;font-size:0.8rem;">`;
      for (const u of result.unmatchedLocal) {
        html += `<li><strong>${esc(u.broker)}</strong> · ${esc(u.label)} · ${esc(fmt(u.grossRON))} — <small style="color:var(--text-muted);">${esc(u.hint || '')}</small></li>`;
      }
      html += `</ul></details>`;
    }
    summaryEl.innerHTML = html;
  }

  /**
   * Inline mirror of lib/d205-matcher.js — see that file for full docs.
   * Kept in sync; lib is canonical and tested.
   */
  function _d205MatchInline(d205Entries, yd) {
    const MATCH_EPS = 1, NEAR_ABS = 50, NEAR_REL = 0.005;
    const norm = (s) => !s ? '' : String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/\b(s\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|n\.?\s?v\.?)\b/g, ' ')
      .replace(/\b(sa|srl|nv|sucursala|bucuresti|romania|amsterdam|warsaw|varsovia|partners|trust|group)\b/g, ' ')
      .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const fps = [
      [/^xtb\b|xtrade brokers/, 'XTB'], [/^bt capital|bt securities/, 'BT Capital'],
      [/tradeville/, 'Tradeville'], [/goldring/, 'Goldring'],
      [/^ing\b/, 'ING Bank'], [/^salt\b/, 'SALT Bank'], [/^bcr\b/, 'BCR'],
      [/^bt\b|banca transilvania/, 'Banca Transilvania'],
      [/raiffeisen/, 'Raiffeisen'], [/unicredit/, 'UniCredit'],
    ];
    const identifyBroker = (name) => {
      const n = norm(name); if (!n) return null;
      for (const [re, label] of fps) if (re.test(n)) return label;
      return null;
    };
    const local = [];
    if (yd && yd.xtbDividendsReport) {
      const d = yd.xtbDividendsReport;
      if (d.dividends && d.dividends.grossRON > 0) local.push({ broker: 'XTB', category: '20', label: 'Dividende', grossRON: d.dividends.grossRON, taxRON: d.dividends.taxWithheldRON || 0, source: 'xtbDividendsReport.dividends' });
      if (d.interest && d.interest.grossRON > 0) local.push({ broker: 'XTB', category: '09', label: 'Dobânzi', grossRON: d.interest.grossRON, taxRON: d.interest.taxWithheldRON || 0, source: 'xtbDividendsReport.interest' });
    }
    for (const [src, key] of [['XTB', 'xtbPortfolio'], ['Tradeville', 'tradevillePortfolio']]) {
      const p = yd && yd[key]; if (!p || !Array.isArray(p.countries)) continue;
      let lg = 0, lt = 0, sg = 0, st = 0;
      for (const c of p.countries) {
        lg += (c.longGainRON || c.longGain || 0) - (c.longLossRON || c.longLoss || 0);
        lt += c.longTaxRON || c.longTax || 0;
        sg += (c.shortGainRON || c.shortGain || 0) - (c.shortLossRON || c.shortLoss || 0);
        st += c.shortTaxRON || c.shortTax || 0;
      }
      if (lg > 0 || lt > 0) local.push({ broker: src, category: '26', label: 'Capgains ≥1y', grossRON: lg, taxRON: lt, source: `${key}.long` });
      if (sg > 0 || st > 0) local.push({ broker: src, category: '27', label: 'Capgains <1y', grossRON: sg, taxRON: st, source: `${key}.short` });
    }
    const pool = local.map((l) => ({ ...l, _matched: false }));
    const matches = [];
    for (const a of d205Entries) {
      const aGross = Number(a.grossRON) || 0;
      const aBroker = identifyBroker(a.payerName);
      const aCat = String(a.category || '');
      let best = null, status = null, delta = null;
      for (const l of pool) {
        if (l._matched || l.broker !== aBroker || l.category !== aCat) continue;
        const d = Math.abs((l.grossRON || 0) - aGross);
        if (d <= MATCH_EPS) { best = l; status = 'matched-exact'; delta = d; break; }
      }
      if (!best) for (const l of pool) {
        if (l._matched || l.broker !== aBroker || l.category !== aCat) continue;
        const d = Math.abs((l.grossRON || 0) - aGross);
        const denom = Math.max(Math.abs(l.grossRON || 0), Math.abs(aGross), 1);
        if (d <= NEAR_ABS || d / denom <= NEAR_REL) { best = l; status = 'matched-amount'; delta = d; break; }
      }
      if (!best) for (const l of pool) {
        if (l._matched || l.category !== aCat) continue;
        const d = Math.abs((l.grossRON || 0) - aGross);
        const denom = Math.max(Math.abs(l.grossRON || 0), Math.abs(aGross), 1);
        if (d <= NEAR_ABS || d / denom <= NEAR_REL) { best = l; status = 'possible'; delta = d; break; }
      }
      if (best) {
        best._matched = true;
        matches.push({
          anaf: { ...a, broker: aBroker },
          local: best,
          status, delta,
          hint: status === 'matched-exact' ? null
              : status === 'matched-amount' ? `Diferență mică (~${Math.round(delta)} RON) — probabil rotunjire.`
              : `Posibil match prin categorie + sumă, dar plătitorul nu a putut fi identificat sigur.`,
        });
      } else {
        matches.push({
          anaf: { ...a, broker: aBroker }, local: null, status: 'unmatched-anaf', delta: null,
          hint: `ANAF a primit D205 de la "${a.payerName}" pentru categoria ${aCat} (${aGross.toLocaleString('ro-RO')} RON), dar nu avem date locale care să acopere această sumă. Importă PDF-ul broker/banca corespunzător sau adaugă-l în „Adaugă date".`,
        });
      }
    }
    const unmatchedLocal = pool.filter((l) => !l._matched).map(({ _matched, ...rest }) => ({
      ...rest, status: 'unmatched-local',
      hint: `Avem date locale (${rest.broker} · ${rest.label} · ${Math.round(rest.grossRON || 0).toLocaleString('ro-RO')} RON) dar nu apare D205 corespunzător la ANAF.`,
    }));
    const totals = {
      exactCount: matches.filter((m) => m.status === 'matched-exact').length,
      nearCount: matches.filter((m) => m.status === 'matched-amount').length,
      possibleCount: matches.filter((m) => m.status === 'possible').length,
      unmatchedAnafCount: matches.filter((m) => m.status === 'unmatched-anaf').length,
      unmatchedLocalCount: unmatchedLocal.length,
    };
    return { matches, unmatchedLocal, totals };
  }

  // ============ DUF XML IMPORT + VALIDATION ============
  /**
   * In-memory cache of the most recently parsed DUF XML, keyed by year so a
   * user can flip the year selector and we still remember what they uploaded.
   * Never persisted; cleared on page reload.
   */
  const _dufImports = new Map();

  /**
   * Per-year, per-row decision overrides. Map<year, Map<rowKey, 'anaf'|'local'|null>>.
   * `null` means "explicit reset to default". A missing key means "use default".
   * Never persisted; cleared on page reload.
   */
  const _dufPicks = new Map();
  function _getPicksForYear(year) {
    if (!_dufPicks.has(year)) _dufPicks.set(year, new Map());
    return _dufPicks.get(year);
  }
  /** The effective pick: explicit override if set, otherwise the row's default. */
  function _effectivePick(row, picks) {
    if (picks && picks.has(row.rowKey)) {
      const v = picks.get(row.rowKey);
      if (v === 'anaf' || v === 'local') return v;
    }
    return row.defaultPick;
  }
  /** The effective numeric value implied by the pick for a single compare row. */
  function _effectiveValue(row, picks) {
    const pick = _effectivePick(row, picks);
    if (pick === 'anaf') return row.anaf;
    if (pick === 'local') return row.local;
    return null;
  }

  function setupDufImportZone() {
    const dz = document.getElementById('validate-duf-dropzone');
    const input = document.getElementById('validate-duf-file-input');
    if (!dz || !input) return;

    // Avoid double-binding when renderSubmissionGuide is called again
    if (dz.dataset.wired === '1') {
      _renderDufCompare();
      return;
    }
    dz.dataset.wired = '1';

    const onPick = () => input.click();
    dz.addEventListener('click', onPick);
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.style.background = 'rgba(88,166,255,0.08)'; });
    dz.addEventListener('dragleave', () => { dz.style.background = ''; });
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.style.background = '';
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleDufFile(f);
    });
    input.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) handleDufFile(f);
      input.value = '';
    });

    // If we already have an import cached for the current year, re-render
    _renderDufCompare();
  }

  async function handleDufFile(file) {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      showToast(I18n.t('submit.errorNotXml') || 'Fișierul trebuie să fie .xml', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(I18n.t('submit.errorTooBig') || 'Fișierul depășește 5 MB', 'error');
      return;
    }
    const xml = await file.text();
    try {
      const resp = await fetch('/api/duf-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Parse failed');
      }
      const parsed = data.parsed;
      // Pick the year from the XML if present, else fall back to selectedYear.
      // an_r is the *submission* year; the fiscal year is an_r - 1.
      const fiscalYear = parsed.root && parsed.root.an_r ? Number(parsed.root.an_r) - 1 : selectedYear;
      _dufImports.set(fiscalYear, { parsed, fileName: file.name, importedAt: new Date().toISOString() });
      // Auto-pivot the year selector if the XML's fiscal year differs
      if (fiscalYear !== selectedYear) {
        const sel = document.getElementById('year-select');
        if (sel && Array.from(sel.options).some((o) => Number(o.value) === fiscalYear)) {
          sel.value = String(fiscalYear);
          selectedYear = fiscalYear;
          await render();
        }
      }
      _renderDufCompare();
      showToast(I18n.t('submit.parseOk') || `XML încărcat: ${file.name}`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  /** Render the comparison table below the dropzone for the current year. */
  function _renderDufCompare() {
    const out = document.getElementById('validate-duf-compare-result');
    if (!out) return;
    const entry = _dufImports.get(selectedYear);
    if (!entry) {
      out.innerHTML = '';
      return;
    }
    const local = computeYearData(selectedYear);
    let compare;
    try {
      // The comparator lives server-side as lib/d212-duf-compare.js. The
      // browser bundle doesn't load lib/ modules, so we ship a tiny inline
      // mirror below. The lib version is the canonical one and tested.
      compare = _dufCompareInline(entry.parsed, local);
    } catch (err) {
      out.innerHTML = `<p style="color:var(--danger);">${esc(err.message)}</p>`;
      return;
    }
    const picks = _getPicksForYear(selectedYear);
    // Cache compare result on the entry so renderSubmissionGuide can read
    // the picked values to render the "Valori de introdus" table.
    entry.compare = compare;

    const unresolvedMismatches = compare.rows.filter((r) => r.status === 'mismatch' && _effectivePick(r, picks) == null).length;

    const badge = (status) => {
      const cfg = {
        match:      { c: 'var(--success)', t: '✓ Match' },
        near:       { c: 'var(--warning,#b35900)', t: '⚠ ≈' },
        mismatch:   { c: 'var(--danger,#c53030)', t: '✗ Diferit' },
        'only-anaf': { c: 'var(--text-muted)', t: '🆕 Doar ANAF' },
        'only-local': { c: 'var(--accent)', t: '❓ Doar local' },
      }[status] || { c: 'var(--text-muted)', t: status };
      return `<span style="background:${cfg.c};color:#fff;font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:var(--radius);white-space:nowrap;">${esc(cfg.t)}</span>`;
    };
    const fmt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('ro-RO') + ' RON');

    const headlineCfg = {
      match: { c: 'var(--success)', t: I18n.t('submit.headlineMatch') || '✓ Toate datele se potrivesc cu ANAF' },
      partial: { c: 'var(--warning,#b35900)', t: I18n.t('submit.headlinePartial') || '⚠ Diferențe sau date lipsă' },
      mismatch: { c: 'var(--danger,#c53030)', t: I18n.t('submit.headlineMismatch') || '✗ Diferențe semnificative — verifică!' },
    }[compare.headline] || { c: 'var(--text-muted)', t: compare.headline };

    let html = `<div style="background:${headlineCfg.c};color:#fff;padding:0.6rem 1rem;border-radius:var(--radius);font-weight:600;margin-bottom:0.75rem;">${esc(headlineCfg.t)} <small style="opacity:0.85;font-weight:normal;">— ${compare.totals.matchCount} match · ${compare.totals.nearCount} aproape · ${compare.totals.mismatchCount} diferit · ${compare.totals.onlyAnafCount} doar ANAF · ${compare.totals.onlyLocalCount} doar local</small></div>`;

    html += `<p style="font-size:0.8rem;color:var(--text-muted);">${esc(I18n.t('submit.compareImported') || 'Importat')}: <strong>${esc(entry.fileName)}</strong> · ${esc(entry.parsed.raw.version || '')} · <a href="#" id="submit-duf-clear" style="color:var(--accent);">${esc(I18n.t('submit.compareClear') || 'Șterge')}</a></p>`;

    // Quick actions for bulk picks — visible only when there's something to do
    if (unresolvedMismatches > 0 || compare.totals.onlyAnafCount > 0 || compare.totals.nearCount > 0) {
      html += `<div style="margin:0.5rem 0;display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">
        <span style="font-size:0.8rem;color:var(--text-muted);">${esc(I18n.t('submit.quickActions') || 'Acțiuni rapide:')}</span>
        ${unresolvedMismatches > 0 ? `<button type="button" id="duf-pick-mismatch-anaf" class="btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.6rem;">${esc(I18n.t('submit.pickAllMismatchAnaf') || 'Diferențe → ANAF')}</button>` : ''}
        ${unresolvedMismatches > 0 ? `<button type="button" id="duf-pick-mismatch-local" class="btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.6rem;">${esc(I18n.t('submit.pickAllMismatchLocal') || 'Diferențe → Local')}</button>` : ''}
        <button type="button" id="duf-pick-reset-all" class="btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.6rem;">${esc(I18n.t('submit.pickResetAll') || '↺ Reset toate la default')}</button>
      </div>`;
      if (unresolvedMismatches > 0) {
        html += `<p style="font-size:0.75rem;color:var(--danger,#c53030);margin:0 0 0.5rem;">⚠ ${unresolvedMismatches} ${esc(I18n.t('submit.unresolvedHint') || 'diferențe necesită alegere explicită (rândurile evidențiate cu roșu mai jos)')}</p>`;
      }
    }

    const groups = { oblig: [], cap11: [], cap14: [] };
    for (const row of compare.rows) {
      (groups[row.section] || (groups[row.section] = [])).push(row);
    }
    const sectionTitle = {
      oblig: I18n.t('submit.sectionOblig') || '💊 oblig_realizat — CASS + totaluri',
      cap11: I18n.t('submit.sectionCap11') || '🇷🇴 cap11 — Venituri România',
      cap14: I18n.t('submit.sectionCap14') || '🌍 cap14 — Venituri din străinătate',
    };
    for (const sec of ['oblig', 'cap11', 'cap14']) {
      const rows = groups[sec];
      if (!rows || rows.length === 0) continue;
      html += `<div style="margin:0.75rem 0;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
        <header style="background:var(--bg-secondary);padding:0.5rem 1rem;font-weight:600;font-size:0.9rem;">${esc(sectionTitle[sec])}</header>
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
          <thead><tr style="border-bottom:1px solid var(--border);color:var(--text-muted);">
            <th style="padding:0.4rem 1rem;text-align:left;">${esc(I18n.t('submit.colField') || 'Câmp')}</th>
            <th style="padding:0.4rem 1rem;text-align:right;">${esc(I18n.t('submit.colAnaf') || 'ANAF')}</th>
            <th style="padding:0.4rem 1rem;text-align:right;">${esc(I18n.t('submit.colLocal') || 'Calculat local')}</th>
            <th style="padding:0.4rem 1rem;text-align:right;">${esc(I18n.t('submit.colDelta') || 'Δ')}</th>
            <th style="padding:0.4rem 1rem;text-align:center;">${esc(I18n.t('submit.colStatus') || 'Stare')}</th>
            <th style="padding:0.4rem 1rem;text-align:center;">${esc(I18n.t('submit.colPick') || 'Folosesc')}</th>
          </tr></thead>
          <tbody>`;
      for (const r of rows) {
        const deltaStr = r.delta == null ? '—' : (r.delta > 0 ? '+' : '') + r.delta.toLocaleString('ro-RO');
        const deltaColor = r.delta == null ? 'var(--text-muted)' : (r.status === 'match' ? 'var(--text-muted)' : (r.delta > 0 ? 'var(--danger,#c53030)' : 'var(--accent)'));
        const pick = _effectivePick(r, picks);
        const explicit = picks.has(r.rowKey) && (picks.get(r.rowKey) === 'anaf' || picks.get(r.rowKey) === 'local');
        const isMismatchUnset = r.status === 'mismatch' && pick == null;
        // Pick segmented control: only meaningful when both ANAF and local values exist.
        // For only-anaf / only-local, the single available source is shown as a static badge.
        let pickCtl;
        if (r.anaf != null && r.local != null) {
          const btnStyle = (active) => `padding:0.2rem 0.5rem;font-size:0.75rem;border:1px solid var(--border);background:${active ? 'var(--accent)' : 'transparent'};color:${active ? '#fff' : 'var(--text)'};cursor:pointer;`;
          pickCtl = `<div style="display:inline-flex;border-radius:var(--radius);overflow:hidden;${isMismatchUnset ? 'box-shadow:0 0 0 2px var(--danger,#c53030);' : ''}">
            <button type="button" class="duf-pick-btn" data-key="${esc(r.rowKey)}" data-pick="anaf" style="${btnStyle(pick === 'anaf')}border-right:0;">🅰 ANAF</button>
            <button type="button" class="duf-pick-btn" data-key="${esc(r.rowKey)}" data-pick="local" style="${btnStyle(pick === 'local')}">🟢 Local</button>
          </div>${explicit ? `<a href="#" class="duf-pick-reset" data-key="${esc(r.rowKey)}" style="margin-left:0.4rem;font-size:0.7rem;color:var(--text-muted);">↺</a>` : ''}`;
        } else if (r.anaf != null) {
          pickCtl = `<span style="font-size:0.72rem;color:var(--text-muted);">🅰 ANAF</span>`;
        } else {
          pickCtl = `<span style="font-size:0.72rem;color:var(--text-muted);">🟢 Local</span>`;
        }
        html += `<tr style="border-bottom:1px solid var(--border);${isMismatchUnset ? 'background:rgba(197,48,48,0.05);' : ''}">
          <td style="padding:0.4rem 1rem;">${esc(r.label)}${r.hint ? `<br><small style="color:var(--text-muted);">${esc(r.hint)}</small>` : ''}</td>
          <td style="padding:0.4rem 1rem;text-align:right;font-variant-numeric:tabular-nums;${pick === 'anaf' ? 'font-weight:600;' : ''}">${esc(fmt(r.anaf))}</td>
          <td style="padding:0.4rem 1rem;text-align:right;font-variant-numeric:tabular-nums;${pick === 'local' ? 'font-weight:600;' : ''}">${esc(fmt(r.local))}</td>
          <td style="padding:0.4rem 1rem;text-align:right;font-variant-numeric:tabular-nums;color:${deltaColor};">${esc(deltaStr)}</td>
          <td style="padding:0.4rem 1rem;text-align:center;">${badge(r.status)}</td>
          <td style="padding:0.4rem 1rem;text-align:center;white-space:nowrap;">${pickCtl}</td>
        </tr>`;
      }
      html += `</tbody></table></div>`;
    }
    out.innerHTML = html;

    const clearBtn = document.getElementById('submit-duf-clear');
    if (clearBtn) clearBtn.addEventListener('click', (e) => {
      e.preventDefault();
      _dufImports.delete(selectedYear);
      _dufPicks.delete(selectedYear);
      _renderDufCompare();
      renderSubmissionGuide();
    });

    // Per-row pick buttons
    out.querySelectorAll('.duf-pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.key;
        const v = btn.dataset.pick;
        picks.set(k, v);
        _renderDufCompare();
        renderSubmissionGuide();
      });
    });
    out.querySelectorAll('.duf-pick-reset').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        picks.delete(a.dataset.key);
        _renderDufCompare();
        renderSubmissionGuide();
      });
    });

    // Quick actions
    const qaAnaf = document.getElementById('duf-pick-mismatch-anaf');
    if (qaAnaf) qaAnaf.addEventListener('click', () => {
      for (const r of compare.rows) {
        if (r.status === 'mismatch' && _effectivePick(r, picks) == null) picks.set(r.rowKey, 'anaf');
      }
      _renderDufCompare();
      renderSubmissionGuide();
    });
    const qaLocal = document.getElementById('duf-pick-mismatch-local');
    if (qaLocal) qaLocal.addEventListener('click', () => {
      for (const r of compare.rows) {
        if (r.status === 'mismatch' && _effectivePick(r, picks) == null) picks.set(r.rowKey, 'local');
      }
      _renderDufCompare();
      renderSubmissionGuide();
    });
    const qaReset = document.getElementById('duf-pick-reset-all');
    if (qaReset) qaReset.addEventListener('click', () => {
      picks.clear();
      _renderDufCompare();
      renderSubmissionGuide();
    });
  }

  /**
   * Inline mirror of lib/d212-duf-compare.js compareDufVsLocal — see that
   * file for full docs. Kept in sync by the test suite; the lib is canonical.
   */
  function _dufCompareInline(anaf, local) {
    const MATCH_EPS = 1, NEAR_ABS = 100, NEAR_REL = 0.01;
    const num = (v) => {
      if (v == null) return null;
      if (typeof v === 'number') return v;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const classify = (a, l) => {
      if (a == null && l == null) return 'match';
      if (a == null) return 'only-local';
      if (l == null) return 'only-anaf';
      const d = Math.abs(a - l);
      if (d <= MATCH_EPS) return 'match';
      const denom = Math.max(Math.abs(a), Math.abs(l), 1);
      if (d <= NEAR_ABS || d / denom <= NEAR_REL) return 'near';
      return 'mismatch';
    };
    const hintFor = (status, isPfa, anaf, local) => {
      if (status === 'match') return null;
      if (status === 'only-anaf') return isPfa
        ? 'ANAF are aceste date din declarațiile PFA / D205 anterioare. Aplicația noastră nu calculează PFA — folosește valorile ANAF în DUF.'
        : 'ANAF a primit suma asta prin D205 de la un plătitor (broker / bancă). Verifică dacă ai documentul corespunzător; dacă nu, importă-l în „Adaugă date".';
      if (status === 'only-local') return 'Tu ai calculat această sumă local (de obicei din PDF-uri broker pentru venituri din străinătate). ANAF nu o are — trebuie adăugată manual în DUF.';
      const d = Math.round((local || 0) - (anaf || 0));
      if (status === 'near') return `Diferență mică (~${Math.abs(d)} RON). Probabil rotunjire.`;
      return `Diferență ${d > 0 ? '+' : ''}${d} RON între local și ANAF. Verifică PDF-ul broker.`;
    };
    const rowKeyFor = (section, opts) => {
      const o = opts || {};
      if (section === 'oblig') return `oblig.${o.field}`;
      if (section === 'cap11') return `cap11.${o.code || '?'}.${o.field}`;
      if (section === 'cap14') return `cap14.${o.country || '?'}.${o.code || '?'}.${o.field}`;
      return `${section}.${o.field || '?'}`;
    };
    const defaultPickFor = (status) => {
      if (status === 'only-anaf') return 'anaf';
      if (status === 'mismatch') return null;
      return 'local';
    };
    const rows = [];
    const push = (section, label, anaf, local, opts) => {
      const a = num(anaf), l = num(local);
      if (a == null && l == null) return;
      const status = classify(a, l);
      rows.push({
        section, label,
        rowKey: rowKeyFor(section, opts || {}),
        anaf: a, local: l,
        delta: a != null && l != null ? Math.round((a || 0) - (l || 0)) : null,
        status, hint: hintFor(status, opts && opts.isPfa, a, l),
        defaultPick: defaultPickFor(status),
      });
    };
    const ao = (anaf && anaf.obligRealizat) || {}, lo = (local && local.obligRealizat) || {};
    push('oblig', 'Total venit din investiții (cass_ven_inv)', ao.cass_ven_inv, lo.cass_ven_inv, { field: 'cass_ven_inv' });
    push('oblig', 'Bază CASS (cass_baza)', ao.cass_baza, lo.cass_baza, { field: 'cass_baza' });
    push('oblig', 'CASS datorat (cass_datorat)', ao.cass_datorat, lo.cass_datorat, { field: 'cass_datorat' });
    push('oblig', 'Impozit pe venit de plată (impozit_venit_plus)', ao.impozit_venit_plus, lo.impozit_venit_plus, { field: 'impozit_venit_plus' });
    push('oblig', 'Impozit pe venit de restituit (impozit_venit_minus)', ao.impozit_venit_minus, lo.impozit_venit_minus, { field: 'impozit_venit_minus' });
    const a11 = (anaf && Array.isArray(anaf.cap11)) ? anaf.cap11 : [];
    const l11 = (local && Array.isArray(local.cap11Rows)) ? local.cap11Rows : [];
    const seenCodes = new Set();
    for (const r of a11) {
      const code = String(r.categ_venit || '');
      seenCodes.add(code);
      const lRow = l11.find((x) => String(x.categ_venit || '') === code);
      const isPfa = code.startsWith('10') && code !== '1012';
      const label = isPfa ? `Cap11 PFA / activități independente (cod ${code})` : `Câștiguri RO din titluri (cod ${code})`;
      push('cap11', label, r.venit_net_anual, lRow ? lRow.venit_net_anual : null, { isPfa, code, field: 'venit_net_anual' });
      if (r.impozit_retinut != null || (lRow && lRow.impozit_retinut != null)) {
        push('cap11', `Impozit reținut RO (cod ${code})`, r.impozit_retinut, lRow ? lRow.impozit_retinut : null, { isPfa, code, field: 'impozit_retinut' });
      }
    }
    for (const r of l11) {
      const code = String(r.categ_venit || '');
      if (seenCodes.has(code)) continue;
      push('cap11', `Câștiguri RO din titluri (cod ${code})`, null, r.venit_net_anual, { code, field: 'venit_net_anual' });
    }
    const a14 = (anaf && Array.isArray(anaf.cap14)) ? anaf.cap14 : [];
    const l14 = (local && Array.isArray(local.cap14Rows)) ? local.cap14Rows : [];
    const keyOf = (r) => `${r.str_stat_realiz_v || '?'}:${r.str_categ_venit || '?'}`;
    const seenKeys = new Set();
    for (const r of a14) {
      const k = keyOf(r);
      seenKeys.add(k);
      const lRow = l14.find((x) => keyOf(x) === k);
      const country = String(r.str_stat_realiz_v || '?'), code = String(r.str_categ_venit || '?');
      const label = `Venit străinătate ${country} — cod ${code}`;
      push('cap14', label, r.str_venit_net_anual, lRow ? lRow.str_venit_net_anual : null, { country, code, field: 'str_venit_net_anual' });
      push('cap14', `${label} — credit fiscal`, r.str_credit_fiscal, lRow ? lRow.str_credit_fiscal : null, { country, code, field: 'str_credit_fiscal' });
    }
    for (const r of l14) {
      const k = keyOf(r);
      if (seenKeys.has(k)) continue;
      const country = String(r.str_stat_realiz_v || '?'), code = String(r.str_categ_venit || '?');
      push('cap14', `Venit străinătate ${country} — cod ${code}`, null, r.str_venit_net_anual, { country, code, field: 'str_venit_net_anual' });
    }
    const totals = { matchCount: 0, nearCount: 0, mismatchCount: 0, onlyAnafCount: 0, onlyLocalCount: 0 };
    for (const r of rows) {
      if (r.status === 'match') totals.matchCount++;
      else if (r.status === 'near') totals.nearCount++;
      else if (r.status === 'mismatch') totals.mismatchCount++;
      else if (r.status === 'only-anaf') totals.onlyAnafCount++;
      else if (r.status === 'only-local') totals.onlyLocalCount++;
    }
    let headline = 'match';
    if (totals.mismatchCount > 0) headline = 'mismatch';
    else if (totals.onlyAnafCount > 0 || totals.onlyLocalCount > 0 || totals.nearCount > 0) headline = 'partial';
    return { rows, totals, headline };
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
    // Refresh the "already imported" panel on the Import subtab. Cheap when
    // no imports exist (panel just hides) so we run it unconditionally
    // rather than gating on the current subtab.
    try { renderImportExistingPanel(); } catch (e) { console.error('renderImportExistingPanel error:', e); }
    // Sync Import Document year picker with global year
    if (window._syncYearPicker) {
      window._syncYearPicker(selectedYear);
    }
  }

  let _docTypeHintBound = false;
  function sortDocTypeDropdown() {
    const sel = document.getElementById('upload-type');
    if (!sel) return;
    // Sort each <optgroup>'s options alphabetically while preserving the
    // grouping. The placeholder <option value=""> stays at the top.
    sel.querySelectorAll('optgroup').forEach(group => {
      const opts = Array.from(group.querySelectorAll('option'));
      opts.sort((a, b) => a.textContent.localeCompare(b.textContent));
      group.innerHTML = '';
      opts.forEach(o => group.appendChild(o));
    });

    // Show OCR hint when a type that typically needs OCR is selected (bind only once)
    if (_docTypeHintBound) return;
    _docTypeHintBound = true;
    const OCR_TYPES = new Set(['declaratie', 'tradeville_portfolio', 'fidelity_statement', 'ms_statement']);
    const TEXT_PDF_TYPES = new Set(['investment', 'trade_confirmation', 'form_1042s', 'adeverinta', 'stock_award', 'xtb_dividends', 'xtb_portfolio', 'bt_dividends', 'bt_portfolio', 'revolut_statement']);
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
    // Form 1042-S: aggregate by income code so each code feeds the right
    // line item. Code 06 = dividends, code 01 = interest (typically subject
    // to the US "portfolio interest exemption" so withholding is 0; the
    // gross is still taxable in RO as worldwide income for a fiscal resident).
    const form1042sAll = (yd.form1042s || []);
    const form1042s = form1042sAll.filter(f => f.incomeCode === '06');
    const f1042sDivUSD = form1042s.reduce((s, f) => s + (f.grossIncomeUSD || 0), 0);
    const f1042sTaxUSD = form1042s.reduce((s, f) => s + (f.federalTaxWithheldUSD || 0), 0);
    const form1042sInt = form1042sAll.filter(f => f.incomeCode === '01');
    const f1042sIntUSD = form1042sInt.reduce((s, f) => s + (f.grossIncomeUSD || 0), 0);
    const f1042sIntTaxUSD = form1042sInt.reduce((s, f) => s + (f.federalTaxWithheldUSD || 0), 0);
    const savedRate = yd.exchangeRate ? parseFloat(yd.exchangeRate) : null;
    const defaultRate = exchangeRates[year]?.usdRon || 4.57;
    const rate = savedRate || decl.exchangeRate || defaultRate;
    const savedEurRate = yd.eurRate ? parseFloat(yd.eurRate) : null;
    const defaultEurRate = exchangeRates[year]?.eurRon || 4.97;
    const eurRate = savedEurRate || defaultEurRate;

    // Dividend tax rate: 16% from 2026, 10% for 2025, 8% for 2023-2024, 5% for 2019-2022
    const divTaxRate = year >= 2026 ? 0.16 : year >= 2025 ? 0.10 : year >= 2023 ? 0.08 : 0.05;
    const divTaxRateLabel = year >= 2026 ? '16%' : year >= 2025 ? '10%' : year >= 2023 ? '8%' : '5%';
    // Capital gains tax rate: 16% from 2026, 10% for 2025 and earlier
    const capGainsTaxRate = year >= 2026 ? 0.16 : 0.10;

    // ---- Trade aggregation + yearly stock-award filtering (used as inputs to the resolvers below) ----
    const yearAlloc = ledgerAllocations[year] || {};
    const allAwardsForCalc = (window._cachedStockAwards || []);
    const yearAwards = allAwardsForCalc.filter(r => r._assignedYear === year);
    const tradeProceedsUSD = (yd.fidelityTrades && yd.fidelityTrades.totalNet) || 0;
    const tvPort = yd.tradevillePortfolio || {};

    // ---- Phase 3 calc-engine refactor (2026-05-19) ----
    // The inline `||` priority chains that used to live here are now driven
    // by per-category resolvers in lib/income-resolvers.js. The resolvers
    // implement the tier model documented in lib/source-resolver.js and
    // produce a sourceMap that the UI consumes for 📄 / ✋ / 🛠️ badges.
    //
    // Resolvers are loaded via <script src="/lib/income-resolvers.js"> in
    // index.html; the same module is require()d by the server-side tests
    // (test/income-resolvers.test.js + test/source-resolver.test.js) so the
    // browser and the test runner exercise identical code.
    const _Resolvers = (typeof window !== 'undefined' ? window.IncomeResolvers : null);
    if (!_Resolvers) {
      throw new Error('IncomeResolvers global missing — was /lib/income-resolvers.js loaded?');
    }
    const _ctx = {
      year, usdRate: rate, eurRate,
      yearAlloc, yearAwards,
      trades: yd.fidelityTrades || {},
    };
    const _resUsDiv = _Resolvers.resolveUsDividends(yd, _ctx);
    const _resRoDiv = _Resolvers.resolveRoBrokerDividends(yd, _ctx);
    const _resInt = _Resolvers.resolveInterest(yd, _ctx);
    const _resUsCG = _Resolvers.resolveUsCapitalGains(yd, _ctx);
    const _resRoCG = _Resolvers.resolveRoBrokerGains(yd, _ctx);
    const _resBIK = _Resolvers.resolveSalaryBIK(yd, _ctx);

    let dividendsUSD = _resUsDiv.grossUSD;
    let usDivTaxPaidUSD = _resUsDiv.foreignTaxUSD;
    let dividendsRON = _resUsDiv.grossRON;
    let capitalGainsSaleUSD = _resUsCG.saleUSD;
    let capitalGainsCostUSD = _resUsCG.costUSD;
    let capitalGainsTaxableRON = _resUsCG.taxableRON;
    let salaryDeduction = _resUsCG.salaryDeductionRON;
    let interestIncomeRON = _resInt.incomeRON;
    let interestTaxRON = _resInt.taxWithheldRON;
    // Foreign-only portion exposed for the legacy renderer that displays
    // bank + foreign as distinct rows in the income breakdown.
    let roInterestRON = _resInt.foreignIncomeRON;
    let dividendsRON_ro = _resRoDiv.grossRON;
    let roDivTaxWithheld = _resRoDiv.taxWithheldRON;
    let roLongTermGainRON = _resRoCG.longGainRON;
    let roShortTermGainRON = _resRoCG.shortGainRON;
    let capitalGainsRON_ro = _resRoCG.totalGainRON;
    let currentYearLossRON = _resRoCG.currentYearLossRON;
    let roPortTaxWithheld = _resRoCG.taxWithheldRON;
    let salaryTaxedRON = _resBIK.taxedRON;
    let withholding = _resBIK.withholdingRON;

    let usCassTax = fd.cass?.cassRON || 0;
    let usTotalPaid = fd.totalPaid || 0;

    // Romania-broker EUR/USD income & tax components are still surfaced in the
    // result object because several downstream renderers display them as
    // distinct rows (Income Details "EUR" / "USD" lines, manual-country
    // breakdown, etc.). The resolver already sums them into the totals; these
    // standalone constants are display-only.
    const roEurDiv = parseFloat(yd.roEurDividends) || 0;
    const roEurDivTax = parseFloat(yd.roEurDivTaxPaid) || 0;
    const roUsdDiv = parseFloat(yd.roUsdDividends) || 0;
    const roUsdDivTax = parseFloat(yd.roUsdDivTaxPaid) || 0;
    const roEurInt = parseFloat(yd.roEurInterest) || 0;
    const roEurIntTax = parseFloat(yd.roEurInterestTaxPaid) || 0;
    const roUsdInt = parseFloat(yd.roUsdInterest) || 0;
    const roUsdIntTax = parseFloat(yd.roUsdInterestTaxPaid) || 0;

    // Determine US broker sources from trades
    const tradeSources = new Set();
    if (Array.isArray(yd.fidelityTrades && yd.fidelityTrades.trades)) {
      for (const t of yd.fidelityTrades.trades) {
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
    if (yd.btDividendsReport || yd.btPortfolio) roSources.add('BT Capital Partners');
    // Note: Revolut is intentionally NOT added to roSources because it is a
    // non-resident foreign broker (Revolut Securities Europe UAB, Lithuania)
    // whose gains belong on D212 cap14 (foreign-source), not cap11 (RO source).
    // The Revolut totals are surfaced separately via revolutNetGainsRON and
    // are emitted as their own cap14 rows per country code in the block above.
    if (yd.roBroker) roSources.add(yd.roBroker);
    const roBrokerLabel = roSources.size > 0 ? ' (' + [...roSources].join(' & ') + ')' : '';

    // Surface 1042-S US-source interest separately so cap14 can emit a
    // categ_venit=2010 row without re-deriving it. Resolver path. The
    // per-year-rate tax due/credit/toPay values are computed later, once
    // `interestTaxRate` is in scope.
    const usForeignInterestRON = _resInt.usForeignInterestRON;
    const usForeignInterestTaxRON = _resInt.usForeignInterestTaxRON;


    // Tax from declaration or US broker data (source of truth)
    // US dividends: US withholds 10% at source per RO-US treaty.
    // Romania taxes at divTaxRate. Credit fiscal = min(RO tax, US tax paid).
    // Difference to pay = max(0, RO tax - US credit).
    // Resolver path: `_resUsDiv` already prioritizes override > ANAF > parsed > manual.
    const usForeignTaxUSD = _resUsDiv.foreignTaxUSD;
    const usForeignTaxRON = _resUsDiv.foreignTaxRON;
    // US dividends: RO tax due minus credit for US tax already paid
    // If D-212 has been imported (ANAF-validated), use its values directly
    const usDivTaxDueRON = dividendsRON * divTaxRate;
    const hasAnafDecl = decl.anafXml || decl.anafFlatText;
    const usDivCreditRON = hasAnafDecl ? (decl.dividends?.creditFiscalRON || 0) : Math.min(usDivTaxDueRON, usForeignTaxRON);
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
    // Romania capital gains tax rates per year:
    // 2019-2022: flat 10% (no long/short distinction)
    // 2023-2025: 1% long (>=1yr), 3% short (<1yr)
    // 2026+: 3% long, 6% short
    const tr = yd.taxRates || {};
    const defaultRoLong = year >= 2026 ? 3 : year >= 2023 ? 1 : 10;
    const defaultRoShort = year >= 2026 ? 6 : year >= 2023 ? 3 : 10;
    const roLongRate = (tr.roCapGainsLongRate != null ? tr.roCapGainsLongRate : defaultRoLong) / 100;
    const roShortRate = (tr.roCapGainsShortRate != null ? tr.roCapGainsShortRate : defaultRoShort) / 100;

    // Apply prior-year capital losses (D212 Rd.5-6) using the formula from
    // Instructiuni_D212_2736_2025, Section 7.3.3:
    //   Rd.6 (pierdere fiscala compensata in anul de raportare) =
    //        min( Rd.5 (priorLosses available), 0.70 * Rd.3 (current year net gain) )
    // Per Cod Fiscal art. 119, losses can only offset gains "of the same nature".
    // Our priorLosses input represents Romanian-source carryforward losses (the
    // most common case from XTB/Tradeville/BT Trade past activity), so we apply
    // them to RO capital gains only. Within RO, we consume the highest-tax-rate
    // bucket first (short 3% before long 1%) to minimize the user's tax liability.
    const priorLossesAvailable = parseFloat(yd.priorLosses) || 0;
    const totalRoCapGains = roLongTermGainRON + roShortTermGainRON;
    const maxLossOffset = 0.70 * totalRoCapGains;
    const priorLossesApplied = Math.min(priorLossesAvailable, maxLossOffset);
    const priorLossesRemaining = priorLossesAvailable - priorLossesApplied;
    // Distribute the applied loss: short bucket first (higher rate = bigger tax saving)
    let consumeFromShort = Math.min(priorLossesApplied, roShortTermGainRON);
    let roShortAfterLoss = roShortTermGainRON - consumeFromShort;
    let consumeFromLong = priorLossesApplied - consumeFromShort;
    let roLongAfterLoss = roLongTermGainRON - consumeFromLong;

    const roCapitalGainsTax = (roLongAfterLoss * roLongRate) + (roShortAfterLoss * roShortRate);
    // Romania capital gains: tax already withheld by XTB / Tradeville / BT Trade
    const roGainsTaxNet = Math.max(0, roCapitalGainsTax - (roPortTaxWithheld || 0));

    // US income: deduct salary-taxed BIK from US capital gains as cost basis
    // BIK (stock_award_bik) = income already taxed as salary in Romania, deducted from capital gains
    // Stock withholding = tax/CASS paid on the BIK through payroll (shown as "already paid", not deducted from base)
    const usNetGainsRON = Math.max(0, capitalGainsTaxableRON - salaryTaxedRON);
    const usGrossIncomeRON = capitalGainsTaxableRON + dividendsRON;
    const usNetIncomeRON = usNetGainsRON + dividendsRON;

    let capitalGainsTaxRON;
    // Revolut foreign-broker capital gains (per-country aggregates from the
    // parsed statement). Per net bucket, then summed across countries.
    // Revolut never withholds tax at source → no credit fiscal offsets.
    let revolutNetGainsRON = 0;
    {
      const revolut = yd.revolutStatement || {};
      if (Array.isArray(revolut.countries)) {
        for (const c of revolut.countries) {
          const longNet = (c.longGainRON || 0) - (c.longLossRON || 0);
          const shortNet = (c.shortGainRON || 0) - (c.shortLossRON || 0);
          revolutNetGainsRON += Math.max(0, longNet) + Math.max(0, shortNet);
        }
      }
    }
    const revolutGainsTaxRON = revolutNetGainsRON * capGainsTaxRate;

    if (fd.capitalGains?.taxPaidRON) {
      capitalGainsTaxRON = fd.capitalGains.taxPaidRON;
    } else if (hasAnafDecl && decl.capitalGains?.difImpozitRON != null) {
      capitalGainsTaxRON = decl.capitalGains.difImpozitRON;
    } else if (decl.capitalGains?.taxDueRON) {
      capitalGainsTaxRON = decl.capitalGains.taxDueRON;
    } else {
      capitalGainsTaxRON = usNetGainsRON * capGainsTaxRate + roGainsTaxNet + revolutGainsTaxRON;
    }
    const interestTaxRate = (tr.roInterestRate != null ? tr.roInterestRate / 100 : (year >= 2026 ? 0.16 : 0.10));
    const interestTaxGross = interestIncomeRON * interestTaxRate;
    // Resolver-path: _resInt.taxWithheldRON already combines bank-style tax
    // (override yd.interestTaxPaid OR adv.interestTax) with foreign tax (EUR
    // + USD broker + 1042-S code 01). Preserves the pre-refactor formula.
    const interestTaxPaid = _resInt.taxWithheldRON;
    const interestTax = Math.max(0, interestTaxGross - interestTaxPaid);

    // Foreign-source interest (US) split out so D212 cap14 can emit a separate
    // categ_venit=2010 row. Recompute using the proper interestTaxRate (the
    // raw values above were a placeholder before we knew the per-year rate).
    const usForeignInterestTaxDueRON = _resInt.usForeignInterestRON * interestTaxRate;
    const usForeignInterestCreditRON = Math.min(usForeignInterestTaxDueRON, _resInt.usForeignInterestTaxRON);
    const usForeignInterestTaxToPayRON = Math.max(0, usForeignInterestTaxDueRON - usForeignInterestCreditRON);

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
    const totalCapitalGainsRON = capitalGainsTaxableRON + capitalGainsRON_ro + revolutNetGainsRON;
    const interestNetRON = Math.max(0, interestIncomeRON - interestTaxPaid);
    const totalAlreadyPaid = usForeignTaxRON + withholding + (roPortTaxWithheld || 0) + (roDivTaxWithheld || 0) + interestTaxPaid + rentalTaxPaid + royaltyTaxPaid + gamblingTaxTotal + otherTaxPaid;
    // Capital gains for CASS: use net gain (gross - cost basis), do NOT subtract broker tax withheld
    const usNetCapGainsRON_cass = Math.max(0, capitalGainsTaxableRON - salaryTaxedRON);
    const roNetCapGainsRON_cass = Math.max(0, capitalGainsRON_ro);
    // Revolut net capital gains contribute to CASS base on the same footing
    // as US net gains (no salary-tax deduction applies since Revolut sales
    // are not BIK-related vest income).
    const revolutNetCapGainsRON_cass = Math.max(0, revolutNetGainsRON);
    // Include income types for CASS per D212 pct. 50.1 and pct. 51:
    // - investiții: dividends (net of tax), capital gains (net gain), interest (net of tax) ✓
    // - cedarea folosinței bunurilor (rental): net income (after 40% deduction) ✓
    // - drepturi de proprietate intelectuală (royalties): net income (after 40% deduction) ✓
    // - alte surse (other income): gross ✓ (pct. 50.1 lit. f + pct. 51)
    // NOT included: gambling (Art. 110 - impozit final reținut la sursă)
    const rentalNetCass = rentalNet;
    const royaltyNetCass = royaltyNet;
    const totalInvestmentIncome_cass = Math.max(0, totalDividendsRON_cass + usNetCapGainsRON_cass + roNetCapGainsRON_cass + revolutNetCapGainsRON_cass + interestNetRON + rentalNetCass + royaltyNetCass + otherGross);
    const totalInvestmentIncome = totalDividendsRON + totalCapitalGainsRON + interestIncomeRON + gamblingIncomeTotal + rentalGross + royaltyGross + otherGross;
    const savedMinSalary = (yd.minSalary !== undefined && yd.minSalary !== '') ? parseFloat(yd.minSalary) : null;
    const cassResult = calculateCASS(totalInvestmentIncome_cass, year, savedMinSalary, 'investment');
    let cassTax = usCassTax || decl.cassContribution || cassResult.amount;
    let cassApplies = cassResult.applies;
    const cassInfo = cassResult;

    const incomeTaxGross = decl.totalTax || (dividendTaxRON + capitalGainsTaxRON + interestTax + rentalTaxToPay + royaltyTaxToPay + otherTaxToPay);
    const incomeTaxOnly = incomeTaxGross;
    const totalTax = incomeTaxOnly + cassTax;

    // Refund detection: when a Romanian payer has withheld more tax than what
    // the D212 calculation actually requires (typically broker capital-gains
    // withholding before applying same-year or carried-forward losses), the
    // difference can be claimed back on the declaration. We surface this
    // separately so the UI can show "X RON de restituit" instead of hiding
    // over-withholding behind a Math.max(0, ...) clamp.
    //
    // Foreign withholding (US 1042-S etc.) is NOT included here — per the
    // double-taxation treaty it is only creditable up to the RO tax due
    // (`min(usForeignTaxRON, usDivTaxDueRON)`); the excess is recovered, if
    // at all, through the foreign jurisdiction, not via D212.
    const roCapGainsOverwithheld = Math.max(0, (roPortTaxWithheld || 0) - roCapitalGainsTax);
    const roDivOverwithheld = Math.max(0, (roDivTaxWithheld || 0) - roDivTaxDue);
    const interestOverwithheld = Math.max(0, interestTaxPaid - interestTaxGross);
    const refundOwedRON = roCapGainsOverwithheld + roDivOverwithheld + interestOverwithheld;
    // Net cash flow on D212: positive = pay, negative = refund.
    const d212NetCashFlowRON = incomeTaxOnly - refundOwedRON;

    // D212 Cap. I §1.1 — cap11 rows (Romanian-source capital gains, real system).
    // Mirror of lib/d212-cap11.js: buildCap11Rows. Kept inline because the browser
    // bundle does not load lib/ modules; the lib version is the canonical one and
    // covered by test/d212-cap11.test.js. Update both sides if the shape changes.
    // See docs/d212-mapping.md § 3 for field semantics.
    const cap11Rows = [];
    {
      const _totalGain = roLongTermGainRON + roShortTermGainRON;
      const _emit = (_totalGain > 0 || currentYearLossRON > 0 || (roPortTaxWithheld || 0) > 0 || priorLossesAvailable > 0);
      if (_emit) {
        const Rd1 = _totalGain;
        const Rd3 = Rd1;
        const Rd6 = priorLossesApplied;
        cap11Rows.push({
          categ_venit: '1012',
          den_venit: 'Câștiguri din transferul titlurilor de valoare',
          venit_brut: Math.round(Rd1),
          chelt_deduc: 0,
          venit_net_anual: Math.round(Rd3),
          pierdere: Math.round(currentYearLossRON || 0),
          pierdere_precedenta: Math.round(priorLossesAvailable),
          pierdere_compensata: Math.round(Rd6),
          venit_recalculat: Math.round(Math.max(0, Rd3 - Rd6)),
          impozit11: Math.round(roCapitalGainsTax),
          impozit_retinut: Math.round(roPortTaxWithheld || 0),
        });
      }
    }

    // D212 Cap. I §2.1 — cap14 rows (foreign-source income, gap D-7 prep).
    // Mirror of lib/d212-cap14.js: buildCap14Rows. Inline because the browser
    // bundle cannot require() lib/ modules; the lib version is canonical and
    // covered by test/d212-cap14.test.js. Keep both sides aligned.
    const cap14Rows = [];
    // Country-code → Romanian denumire mapping used to populate `den_stat`
    // for the Schematron-validated cap14 rows. Extended as new foreign
    // brokers add countries (Revolut currently emits IE, DE, FR, US, GB,
    // NL most often).
    const COUNTRY_NAME_RO = {
      US: 'Statele Unite ale Americii',
      DE: 'Germania',
      FR: 'Franța',
      IE: 'Irlanda',
      NL: 'Olanda',
      GB: 'Marea Britanie',
      LU: 'Luxemburg',
      CH: 'Elveția',
      AT: 'Austria',
      BE: 'Belgia',
      IT: 'Italia',
      ES: 'Spania',
      PT: 'Portugalia',
      LT: 'Lituania',
      CA: 'Canada',
    };
    {
      const capGainsSaleRON = (capitalGainsSaleUSD || 0) * rate;
      const capGainsCostRON = (capitalGainsCostUSD || 0) * rate;
      if (dividendsRON > 0 || usForeignTaxRON > 0) {
        const Rd1 = dividendsRON;
        const Rd3 = Rd1;
        const Rd7 = Rd3;
        const Rd8 = Rd7 * divTaxRate;
        const Rd9 = usForeignTaxRON;
        const Rd10 = Math.min(Rd8, Rd9);
        const Rd11 = Math.max(0, Rd8 - Rd10);
        cap14Rows.push({
          str_stat_realiz_v: 'US',
          den_stat: 'Statele Unite ale Americii',
          str_categ_venit: '2018',
          den_categ_venit: 'Dividende',
          dubla_impunere: '1',
          str_venit_brut: Math.round(Rd1),
          str_chelt_deduc: 0,
          str_venit_net_anual: Math.round(Rd3),
          str_pierdere_anuala: 0,
          str_pierdere_precedenta: 0,
          str_pierdere_compensata: 0,
          str_venit_recalculat: Math.round(Rd7),
          str_impozit_datorat_Ro: Math.round(Rd8),
          str_impozit_platit: Math.round(Rd9),
          str_credit_fiscal: Math.round(Rd10),
          str_dif_impozit_datorat: Math.round(Rd11),
        });
      }
      if (capGainsSaleRON > 0 || usNetGainsRON > 0) {
        const Rd1 = capGainsSaleRON;
        const Rd2 = capGainsCostRON + salaryTaxedRON;
        const Rd3 = Math.max(0, Rd1 - Rd2);
        const Rd9 = 0;
        const Rd7 = Rd3;
        const Rd8 = Rd7 * capGainsTaxRate;
        const Rd10 = Math.min(Rd8, Rd9);
        const Rd11 = Math.max(0, Rd8 - Rd10);
        cap14Rows.push({
          str_stat_realiz_v: 'US',
          den_stat: 'Statele Unite ale Americii',
          str_categ_venit: '2012',
          den_categ_venit: 'Câștiguri din transferul titlurilor de valoare',
          dubla_impunere: '1',
          str_venit_brut: Math.round(Rd1),
          str_chelt_deduc: Math.round(Rd2),
          str_venit_net_anual: Math.round(Rd3),
          str_pierdere_anuala: 0,
          str_pierdere_precedenta: 0,
          str_pierdere_compensata: 0,
          str_venit_recalculat: Math.round(Rd7),
          str_impozit_datorat_Ro: Math.round(Rd8),
          str_impozit_platit: Math.round(Rd9),
          str_credit_fiscal: Math.round(Rd10),
          str_dif_impozit_datorat: Math.round(Rd11),
        });
      }

      // Revolut foreign-broker capital gains. One cap14 row per country
      // (str_categ_venit=2012, dubla_impunere=1, str_impozit_platit=0).
      // Net per bucket within a country is gain − loss; we sum the long
      // and short buckets for a single str_venit_brut. ANAF accepts gross
      // gain here; the per-bucket distinction lives in cap11 for RO source
      // gains, not cap14.
      const revolut = yd.revolutStatement || {};
      if (Array.isArray(revolut.countries) && revolut.countries.length > 0) {
        for (const c of revolut.countries) {
          const longNet = (c.longGainRON || 0) - (c.longLossRON || 0);
          const shortNet = (c.shortGainRON || 0) - (c.shortLossRON || 0);
          const totalNet = Math.max(0, longNet) + Math.max(0, shortNet);
          const totalLoss = Math.max(0, -longNet) + Math.max(0, -shortNet);
          if (totalNet === 0 && totalLoss === 0) continue;
          const Rd1 = totalNet;
          const Rd3 = Rd1;
          const Rd7 = Rd3;
          const Rd8 = Rd7 * capGainsTaxRate;
          // Revolut never withholds at source on capital gains.
          const Rd9 = 0;
          const Rd10 = 0;
          const Rd11 = Math.max(0, Rd8 - Rd10);
          cap14Rows.push({
            str_stat_realiz_v: c.country || 'XX',
            den_stat: COUNTRY_NAME_RO[c.country] || c.country || 'Necunoscut',
            str_categ_venit: '2012',
            den_categ_venit: 'Câștiguri din transferul titlurilor de valoare',
            dubla_impunere: '1',
            str_venit_brut: Math.round(Rd1),
            str_chelt_deduc: 0,
            str_venit_net_anual: Math.round(Rd3),
            str_pierdere_anuala: Math.round(totalLoss),
            str_pierdere_precedenta: 0,
            str_pierdere_compensata: 0,
            str_venit_recalculat: Math.round(Rd7),
            str_impozit_datorat_Ro: Math.round(Rd8),
            str_impozit_platit: Math.round(Rd9),
            str_credit_fiscal: Math.round(Rd10),
            str_dif_impozit_datorat: Math.round(Rd11),
            // Internal hint for the UI — not in the official XML schema.
            _source: 'Revolut',
          });
        }
      }
    }

    // D212 <oblig_realizat> (etapa 2 of the DUF integration plan).
    // Mirror of lib/d212-oblig-realizat.js: buildObligRealizat. Inline so the
    // browser bundle is self-contained; the lib version is canonical and
    // tested. Keep both sides aligned — see docs/d212-mapping.md.
    let obligRealizat = null;
    {
      const cassVenInv = Math.max(0, totalInvestmentIncome_cass || 0);
      const _ci = cassInfo || {};
      const _cassApplies = !!_ci.applies;
      const cassBase = _cassApplies ? (_ci.base || 0) : 0;
      const cassAmount = _cassApplies ? (_ci.amount || 0) : 0;
      const _incomeTax = Math.max(0, incomeTaxOnly || 0);
      const _refund = Math.max(0, refundOwedRON || 0);
      if (cassVenInv > 0 || cassAmount > 0 || _incomeTax > 0 || _refund > 0) {
        const _difPlata = _incomeTax + cassAmount;
        const _difRest = _refund;
        obligRealizat = {
          cass_ven_dpi: 0,
          cass_ven_asc: 0,
          cass_ven_cfb: 0,
          cass_ven_inv: Math.round(cassVenInv),
          cass_ven_asp: 0,
          cass_ven_alt: 0,
          cass_total_ven: Math.round(cassVenInv),
          cass_baza: Math.round(cassBase),
          cass_anuala: Math.round(cassAmount),
          cass_datorat_art180: 0,
          cass_datorat: Math.round(cassAmount),
          cass_retinut: 0,
          cass_dif_plus: Math.round(cassAmount),
          cass_dif_minus: 0,
          bifa_cass_real: '3',
          impozit_venit_plus: Math.round(_incomeTax),
          impozit_venit_minus: Math.round(_refund),
          cas_plus: 0,
          cass_plus: Math.round(cassAmount),
          cass_minus: 0,
          dif_de_plata: Math.round(_difPlata),
          dif_de_restituit: Math.round(_difRest),
          venit_ret_inv: Math.round(cassVenInv),
        };
      }
    }

    return {
      dividendsUSD,
      dividendsRON,
      dividendsRON_ro,
      capitalGainsSaleUSD,
      capitalGainsCostUSD,
      capitalGainsTaxableRON,
      capitalGainsRON_ro,
      // Revolut foreign-broker capital gains (per-country net) — surfaced
      // separately so the Income Details renderer can show them as their
      // own row(s) with the right country flag instead of folding into the
      // RO bucket. Empty when no Revolut statement is uploaded.
      revolutNetGainsRON,
      revolutGainsTaxRON,
      roLongTermGainRON,
      roShortTermGainRON,
      currentYearLossRON,
      salaryDeduction,
      interestIncomeRON,
      exchangeRate: rate,
      eurRate,
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
      // Foreign-source interest (US 1042-S code 01) — surfaced separately so
      // D212 cap14 can emit a categ_venit=2010 row without re-deriving it.
      usForeignInterestRON,
      usForeignInterestTaxRON,
      usForeignInterestTaxDueRON,
      usForeignInterestCreditRON,
      usForeignInterestTaxToPayRON,
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
      // Romania broker EUR/USD breakdown (manual entries on Add Data)
      roEurDiv, roEurDivTax,
      roUsdDiv, roUsdDivTax,
      roEurInt, roEurIntTax,
      roUsdInt, roUsdIntTax,
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
      incomeTaxGross,
      totalAlreadyPaid,
      // Refund detection (over-withholding by Romanian payers)
      refundOwedRON,
      roCapGainsOverwithheld,
      roDivOverwithheld,
      interestOverwithheld,
      d212NetCashFlowRON,
      // Prior-year loss carryforward (D212 Rd.5-6)
      priorLossesAvailable,
      priorLossesApplied,
      priorLossesRemaining,
      maxLossOffset,
      // D212 Cap. I §1.1 — Romanian-source income block (gap D-6)
      cap11Rows,
      // D212 Cap. I §2.1 — Foreign-source income block (gap D-7 prep)
      cap14Rows,
      // D212 oblig_realizat — CASS investments + global summary (etapa 2)
      obligRealizat,
      // Phase 3 source map: per-field tier + label so the UI can render
      // 📄 / ✋ / 🛠️ / 🏛️ badges and the Phase 4 conflict-detection banner.
      sourceMap: {
        usDividends: _resUsDiv.sources,
        roBrokerDividends: _resRoDiv.sources,
        interest: _resInt.sources,
        usCapitalGains: _resUsCG.sources,
        roBrokerGains: _resRoCG.sources,
        salaryBIK: _resBIK.sources,
      }
    };
  }

  // ============ DASHBOARD ============
  function renderDashboard() {
    const data = computeYearData(selectedYear);

    document.getElementById('total-income-value').textContent = fmt(data.totalIncome);
    document.getElementById('already-paid-value').textContent = fmt(data.totalAlreadyPaid);
    document.getElementById('cass-value').textContent = fmt(data.cassTax);
    document.getElementById('total-tax-value').textContent = fmt(data.incomeTaxOnly);

    // Show refund card only when there's a refund owed (Romanian broker over-withholding)
    const refundCard = document.getElementById('card-refund');
    const refundValue = document.getElementById('refund-value');
    if (refundCard && refundValue) {
      if ((data.refundOwedRON || 0) > 0) {
        refundCard.style.display = '';
        refundValue.textContent = fmt(data.refundOwedRON);
      } else {
        refundCard.style.display = 'none';
      }
    }

    // Charts - only show if there's actual financial data
    const allYears = Object.keys(appData.years || {}).map(Number).sort((a, b) => a - b);
    const manualKeys = new Set(['year','exchangeRate','eurRate','minSalary','d212Deadline','usBroker','roBroker','taxRates',
      'fidelityDividends','usDivTaxPaid','xtbDividends','roDivTaxPaid','fidelityGains','fidelityCost',
      'roEurDividends','roEurDivTaxPaid','roUsdDividends','roUsdDivTaxPaid',
      'roEurInterest','roEurInterestTaxPaid','roUsdInterest','roUsdInterestTaxPaid',
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
        ron: data.dividendsRON_ro - (data.roEurDiv * data.eurRate) - (data.roUsdDiv * data.exchangeRate),
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: data.divTaxRateLabel,
        paid: (data.roDivTaxWithheld || 0) - (data.roEurDivTax * data.eurRate) - (data.roUsdDivTax * data.exchangeRate),
        tax: Math.max(0, (data.dividendsRON_ro - (data.roEurDiv * data.eurRate) - (data.roUsdDiv * data.exchangeRate)) * data.divTaxRate - ((data.roDivTaxWithheld || 0) - (data.roEurDivTax * data.eurRate) - (data.roUsdDivTax * data.exchangeRate))),
        tooltip: data.roDivTaxWithheld ? I18n.t('misc.creditFiscalTooltip') : undefined
      },
      ...((data.roEurDiv || 0) > 0 ? [{
        cat: I18n.t('income.roDividends') + data.roBrokerLabel + ' (EUR)' + (data.roEurDivTax ? ' ' + I18n.t('misc.creditFiscal') : ''),
        usd: data.roEurDiv,
        rate: data.eurRate,
        ron: data.roEurDiv * data.eurRate,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: data.divTaxRateLabel,
        paid: (data.roEurDivTax || 0) * data.eurRate,
        tax: Math.max(0, data.roEurDiv * data.eurRate * data.divTaxRate - (data.roEurDivTax || 0) * data.eurRate),
        tooltip: I18n.t('misc.creditFiscalTooltip'),
        isEur: true
      }] : []),
      ...((data.roUsdDiv || 0) > 0 ? [{
        cat: I18n.t('income.roDividends') + data.roBrokerLabel + ' (USD)' + (data.roUsdDivTax ? ' ' + I18n.t('misc.creditFiscal') : ''),
        usd: data.roUsdDiv,
        rate: data.exchangeRate,
        ron: data.roUsdDiv * data.exchangeRate,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: data.divTaxRateLabel,
        paid: (data.roUsdDivTax || 0) * data.exchangeRate,
        tax: Math.max(0, data.roUsdDiv * data.exchangeRate * data.divTaxRate - (data.roUsdDivTax || 0) * data.exchangeRate),
        tooltip: I18n.t('misc.creditFiscalTooltip')
      }] : []),
      {
        cat: I18n.t('income.usGains') + data.usBrokerLabel + (data.tradeCount ? ` (${data.tradeCount} ${I18n.t('misc.sales') || 'sales'})` : ''),
        usd: data.capitalGainsSaleUSD || data.tradeProceedsUSD || 0,
        rate: data.exchangeRate,
        ron: Math.round((data.capitalGainsSaleUSD || data.tradeProceedsUSD || 0) * data.exchangeRate),
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.capGainsTaxRate * 100) + '%',
        paid: 0,
        tax: Math.round(data.capitalGainsTaxableRON * data.capGainsTaxRate),
        tooltip: undefined
      },
      ...(data.capitalGainsCostUSD > 0 ? [{
        cat: '↳ ' + (I18n.t('misc.costBasisTooltip') || 'ESPP contributions deducted'),
        usd: -data.capitalGainsCostUSD,
        rate: data.exchangeRate,
        ron: -Math.round(data.capitalGainsCostUSD * data.exchangeRate),
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
      ...((data.priorLossesApplied || 0) > 0 ? [{
        cat: '↳ ' + I18n.t('income.priorLossDeduction'),
        usd: '-',
        rate: '-',
        ron: -data.priorLossesApplied,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: '-',
        paid: 0,
        tax: 0,
        isDeduction: true,
        tooltip: I18n.t('misc.priorLossTooltip', {
          available: Math.round(data.priorLossesAvailable).toLocaleString('ro-RO'),
          applied: Math.round(data.priorLossesApplied).toLocaleString('ro-RO'),
          remaining: Math.round(data.priorLossesRemaining).toLocaleString('ro-RO'),
          cap: Math.round(data.maxLossOffset).toLocaleString('ro-RO')
        })
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
        ron: data.interestIncomeRON - (data.roEurInt * data.eurRate) - (data.roUsdInt * data.exchangeRate),
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.interestTaxRate * 100) + '%',
        paid: (data.interestTaxPaid || 0) - (data.roEurIntTax * data.eurRate) - (data.roUsdIntTax * data.exchangeRate),
        tax: data.interestTax,
        tooltip: (data.interestTax === 0 && (data.interestTaxPaid || 0) > 0) ? I18n.t('misc.roWithheldTooltip') : undefined
      },
      ...((data.roEurInt || 0) > 0 ? [{
        cat: I18n.t('income.interestIncome') + data.roBrokerLabel + ' (EUR)' + ((data.roEurIntTax || 0) > 0 ? ' ' + I18n.t('misc.roWithheld') : ''),
        usd: data.roEurInt,
        rate: data.eurRate,
        ron: data.roEurInt * data.eurRate,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.interestTaxRate * 100) + '%',
        paid: (data.roEurIntTax || 0) * data.eurRate,
        tax: Math.max(0, data.roEurInt * data.eurRate * data.interestTaxRate - (data.roEurIntTax || 0) * data.eurRate),
        tooltip: (data.roEurIntTax || 0) > 0 ? I18n.t('misc.roWithheldTooltip') : undefined
      }] : []),
      ...((data.roUsdInt || 0) > 0 ? [{
        cat: I18n.t('income.interestIncome') + data.roBrokerLabel + ' (USD)' + ((data.roUsdIntTax || 0) > 0 ? ' ' + I18n.t('misc.roWithheld') : ''),
        usd: data.roUsdInt,
        rate: data.exchangeRate,
        ron: data.roUsdInt * data.exchangeRate,
        usTaxRate: '-',
        usTaxPaid: 0,
        taxRate: (data.interestTaxRate * 100) + '%',
        paid: (data.roUsdIntTax || 0) * data.exchangeRate,
        tax: Math.max(0, data.roUsdInt * data.exchangeRate * data.interestTaxRate - (data.roUsdIntTax || 0) * data.exchangeRate),
        tooltip: (data.roUsdIntTax || 0) > 0 ? I18n.t('misc.roWithheldTooltip') : undefined
      }] : [])
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
    const totalRON = rows.reduce((s, r) => s + (typeof r.ron === 'number' ? r.ron : 0), 0);
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
      ${(data.currentYearLossRON || 0) > 0 ? `<tr><td colspan="9" style="font-size:0.8rem;color:var(--warning,#b35900);border:none;padding-top:0.5rem;">${I18n.t('income.currentYearLossNote', { amount: fmt(data.currentYearLossRON) })}</td></tr>` : ''}
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
    const manualCountriesAll = yd.roGainsCountries || [];
    const hasManualEur = (data.roEurDiv || 0) > 0 || (data.roEurInt || 0) > 0;
    const hasManualUsd = (data.roUsdDiv || 0) > 0 || (data.roUsdInt || 0) > 0;

    if (!xtbPort.longTerm && !xtbPort.shortTerm && !xtbDiv.dividends && !tvPort.longTerm && !tvPort.shortTerm && manualCountriesAll.length === 0 && !hasManualEur && !hasManualUsd) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">' + I18n.t('misc.noRoData') + '</td></tr>';
      tfoot.innerHTML = '';
      return;
    }

    const rows = [];
    // XTB data: prefer per-country breakdown when available (multi-row report).
    if (xtbPort.countries && xtbPort.countries.length > 0) {
      for (const c of xtbPort.countries) {
        const curSuffix = c.currency && c.currency !== 'RON' ? ' ' + c.currency : '';
        const longNet = (c.longGainRON || 0) - (c.longLossRON || 0);
        const shortNet = (c.shortGainRON || 0) - (c.shortLossRON || 0);
        if (longNet !== 0 || (c.longTaxRON || 0) > 0) {
          rows.push({
            cat: I18n.t('income.roGainsLong') + ' (XTB' + curSuffix + ')',
            country: c.country || 'USA',
            gross: longNet,
            rate: (data.roLongRate * 100) + '%',
            withheld: c.longTaxRON || 0,
            net: Math.max(0, longNet * data.roLongRate - (c.longTaxRON || 0))
          });
        }
        if (shortNet !== 0 || (c.shortTaxRON || 0) > 0) {
          rows.push({
            cat: I18n.t('income.roGainsShort') + ' (XTB' + curSuffix + ')',
            country: c.country || 'USA',
            gross: shortNet,
            rate: (data.roShortRate * 100) + '%',
            withheld: c.shortTaxRON || 0,
            net: Math.max(0, shortNet * data.roShortRate - (c.shortTaxRON || 0))
          });
        }
      }
    } else {
      // Fallback for legacy single-country XTB data
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
    // Manual country rows from Add Data (convert currency to RON for display).
    // Show even when XTB/Tradeville data is also present (additive, not exclusive).
    const manualCountries = yd.roGainsCountries || [];
    if (manualCountries.length > 0) {
      for (const c of manualCountries) {
        const broker = yd.roBroker || 'RO Broker';
        const cur = (c.currency || 'RON').toUpperCase();
        const fx = cur === 'EUR' ? (data.eurRate || 1) : (cur === 'USD' ? (data.exchangeRate || 1) : 1);
        const curSuffix = cur !== 'RON' ? ' ' + cur : '';
        if (c.longGain > 0) {
          rows.push({
            cat: I18n.t('income.roGainsLong') + ' (' + broker + curSuffix + ')',
            country: c.country,
            gross: (c.longGain || 0) * fx,
            rate: (data.roLongRate * 100) + '%',
            withheld: 0,
            net: 0
          });
        }
        if (c.shortGain > 0) {
          rows.push({
            cat: I18n.t('income.roGainsShort') + ' (' + broker + curSuffix + ')',
            country: c.country,
            gross: (c.shortGain || 0) * fx,
            rate: (data.roShortRate * 100) + '%',
            withheld: 0,
            net: 0
          });
        }
      }
    }
    // Manual RO broker dividends (EUR/USD from Add Data)
    if ((data.roEurDiv || 0) > 0) {
      const grossRON = data.roEurDiv * data.eurRate;
      const withheldRON = (data.roEurDivTax || 0) * data.eurRate;
      rows.push({
        cat: I18n.t('income.roDividends') + ' (' + (yd.roBroker || 'RO Broker') + ' EUR)',
        country: 'EU',
        gross: grossRON,
        rate: data.divTaxRateLabel,
        withheld: withheldRON,
        net: Math.max(0, grossRON * data.divTaxRate - withheldRON)
      });
    }
    if ((data.roUsdDiv || 0) > 0) {
      const grossRON = data.roUsdDiv * data.exchangeRate;
      const withheldRON = (data.roUsdDivTax || 0) * data.exchangeRate;
      rows.push({
        cat: I18n.t('income.roDividends') + ' (' + (yd.roBroker || 'RO Broker') + ' USD)',
        country: 'US',
        gross: grossRON,
        rate: data.divTaxRateLabel,
        withheld: withheldRON,
        net: Math.max(0, grossRON * data.divTaxRate - withheldRON)
      });
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
    // Manual RO broker interest (EUR/USD from Add Data)
    if ((data.roEurInt || 0) > 0) {
      const grossRON = data.roEurInt * data.eurRate;
      const withheldRON = (data.roEurIntTax || 0) * data.eurRate;
      rows.push({
        cat: I18n.t('income.interestIncome') + ' (' + (yd.roBroker || 'RO Broker') + ' EUR)',
        country: 'EU',
        gross: grossRON,
        rate: (data.interestTaxRate * 100) + '%',
        withheld: withheldRON,
        net: Math.max(0, grossRON * data.interestTaxRate - withheldRON)
      });
    }
    if ((data.roUsdInt || 0) > 0) {
      const grossRON = data.roUsdInt * data.exchangeRate;
      const withheldRON = (data.roUsdIntTax || 0) * data.exchangeRate;
      rows.push({
        cat: I18n.t('income.interestIncome') + ' (' + (yd.roBroker || 'RO Broker') + ' USD)',
        country: 'US',
        gross: grossRON,
        rate: (data.interestTaxRate * 100) + '%',
        withheld: withheldRON,
        net: Math.max(0, grossRON * data.interestTaxRate - withheldRON)
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
    const usGainsTax = usGainsRON > 0 ? Math.max(0, usGainsRON - stockWithholding) * (data.capGainsTaxRate || 0.10) : 0;
    const usDivTax = data.usDivToPayRON ?? 0;
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
    html += dataRow(I18n.t('taxes.earnUsGains') + data.usBrokerLabel, fmtR(usGainsRON) + ' RON', { indent: true });
    html += dataRow(I18n.t('taxes.earnUsDiv') + data.usDivBrokerLabel, fmtR(usDivRON) + ' RON', { indent: true });
    if (data.salaryTaxedRON > 0) {
      html += dataRow(I18n.t('taxes.earnSalaryTaxedDeduction') || 'Income already taxed as salary', '-' + fmtR(data.salaryTaxedRON) + ' RON', { indent: true, green: true });
    }
    const usSubtotalIncome = usGainsRON + usDivRON - (data.salaryTaxedRON || 0);
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

    // -- Foreign-broker income (Revolut) --
    // Revolut Securities Europe UAB is a non-resident broker (Lithuania).
    // Per Cod fiscal, its capital gains belong on D212 cap14 (str_categ_venit
    // = 2012) as foreign-source income, NOT on cap11 alongside XTB / BT.
    // Surfaced separately so the user doesn't confuse it with RO-broker
    // amounts.
    let foreignSubtotalIncome = 0;
    if ((data.revolutNetGainsRON || 0) > 0) {
      html += dataRow('<strong>' + (I18n.t('taxes.subsectionForeign') || 'Broker extern (UE/Internațional)') + '</strong>', '', { indent: false });
      html += dataRow((I18n.t('taxes.earnRevolutGains') || 'Câștiguri capital prin Revolut (broker extern)'), fmtR(data.revolutNetGainsRON) + ' RON', { indent: true });
      foreignSubtotalIncome = data.revolutNetGainsRON;
      html += dataRow((I18n.t('taxes.subtotalForeign') || 'Subtotal broker extern'), fmtR(foreignSubtotalIncome) + ' RON', { indent: true, bold: true, topBorder: true });
    }

    html += dataRow(I18n.t('taxes.earnTotal'), fmtR(usSubtotalIncome + roSubtotalIncome + foreignSubtotalIncome) + ' RON', { bold: true, topBorder: true });

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
    // Foreign-broker capital gains (Revolut): no source withholding → full
    // RO rate applies (10% in 2025, 16% from 2026).
    const revolutTaxOwed = (data.revolutGainsTaxRON || 0);
    if (revolutTaxOwed > 0) {
      html += dataRow((I18n.t('taxes.oweRevolutGains') || 'Impozit câștiguri capital broker extern (Revolut)'), fmtR(revolutTaxOwed) + ' RON', { indent: true });
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
    const incomeTaxToPay = Math.max(0, usGainsTax) + usDivTax + roCapGainsNetOwed + revolutTaxOwed + roDivNetOwed + interestTaxRemaining + (data.rentalTaxToPay || 0) + (data.royaltyTaxToPay || 0) + (data.otherTaxToPay || 0);
    html += dataRow(I18n.t('taxes.oweIncomeTaxSubtotal'), '<strong>' + fmtR(incomeTaxToPay) + ' RON</strong>', { topBorder: true });
    // Refund: when Romanian broker withheld more than the actual tax due (after losses)
    if ((data.refundOwedRON || 0) > 0) {
      html += emptyRow();
      html += `<tr><td colspan="2" style="background:rgba(0,128,0,0.05);font-size:0.85rem;color:var(--success);padding:0.5rem;"><strong>💰 ${I18n.t('taxes.refundDetected')}</strong></td></tr>`;
      if ((data.roCapGainsOverwithheld || 0) > 0) {
        html += dataRow(I18n.t('taxes.refundRoCapGains'), '<strong style="color:var(--success);">' + fmtR(data.roCapGainsOverwithheld) + ' RON</strong>', { indent: true });
      }
      if ((data.roDivOverwithheld || 0) > 0) {
        html += dataRow(I18n.t('taxes.refundRoDiv'), '<strong style="color:var(--success);">' + fmtR(data.roDivOverwithheld) + ' RON</strong>', { indent: true });
      }
      if ((data.interestOverwithheld || 0) > 0) {
        html += dataRow(I18n.t('taxes.refundInterest'), '<strong style="color:var(--success);">' + fmtR(data.interestOverwithheld) + ' RON</strong>', { indent: true });
      }
      html += dataRow(I18n.t('taxes.refundTotal'), '<strong style="color:var(--success);">' + fmtR(data.refundOwedRON) + ' RON</strong>', { topBorder: true });
    }
    // CASS
    html += dataRow(I18n.t('taxes.oweCASS'), fmtR(data.cassTax) + ' RON', { indent: true });
    html += emptyRow();
    // Final amount: cash flow taking refund into account
    const finalNet = incomeTaxToPay - (data.refundOwedRON || 0) + data.cassTax;
    if (finalNet >= 0) {
      html += dataRow(I18n.t('taxes.oweTotalToPay'), '<strong style="color:var(--warning);font-size:1.15rem;">' + fmtR(finalNet) + ' RON</strong>', { bold: true, topBorder: true, highlight: true });
    } else {
      html += dataRow(I18n.t('taxes.refundFinalAmount'), '<strong style="color:var(--success);font-size:1.15rem;">' + fmtR(-finalNet) + ' RON</strong>', { bold: true, topBorder: true, highlight: true });
    }

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
      // ANAF formula: Taxable = Sale_RON - Cost_RON - BIK_RON
      const usNetGainsRON = Math.max(0, usGainsGrossRON - esppCostRON - salaryTaxed);
      const usCapGainsTax = usNetGainsRON * (data.capGainsTaxRate || 0.10);
      const usDivTaxDue = usDivRON * data.divTaxRate;
      const usTaxPaidRON = data.usDivForeignTaxRON || 0;
      const usDivDiff = Math.max(0, usDivTaxDue - usTaxPaidRON);

      foreignTbody.innerHTML = [
        [I18n.t('dcl.sourceCountry'), 'S.U.A.'],
        [I18n.t('dcl.exchangeRateLabel'), data.exchangeRate?.toFixed(4)],
        ['--- ' + I18n.t('dcl.sepCapitalGains') + ' ---', ''],
        [I18n.t('dcl.saleValueUSD'), fmtD(usGainsGrossUSD) + ' USD'],
        [I18n.t('dcl.saleValueRON'), fmtR(usGainsGrossRON) + ' RON'],
        [I18n.t('dcl.esppCostUSD'), fmtD(esppCost) + ' USD' + (data.esppSharesConsumed > 0 ? ' <small>(' + data.esppSharesConsumed + ' ' + (I18n.t('income.shares') || 'shares') + ' ESPP FIFO)</small>' : '')],
        [I18n.t('dcl.esppCostRON'), fmtR(esppCostRON) + ' RON'],
        [I18n.t('dcl.alreadyTaxedSalary'), fmtR(salaryTaxed) + ' RON'],
        [I18n.t('dcl.taxableCapitalGains'), '<strong>' + fmtR(usNetGainsRON) + ' RON</strong>'],
        [I18n.t('dcl.incomeTaxDue10').replace('10%', (data.capGainsTaxRate * 100) + '%'), '<strong>' + fmtR(usCapGainsTax) + ' RON</strong>'],
        ['--- ' + I18n.t('dcl.sepDividends') + ' ---', ''],
        [I18n.t('dcl.grossDividendsUSD'), fmtD(data.dividendsUSD) + ' USD'],
        [I18n.t('dcl.grossDividendsRON'), fmtR(usDivRON) + ' RON'],
        [I18n.t('dcl.divTaxDueRO10').replace('10%', data.divTaxRateLabel), fmtR(usDivTaxDue) + ' RON'],
        [I18n.t('dcl.usTaxWithheldUSD'), fmtD(data.usDivForeignTaxUSD || 0) + ' USD'],
        [I18n.t('dcl.usTaxWithheldRON'), fmtR(usTaxPaidRON) + ' RON'],
        [I18n.t('dcl.divCreditRecognized'), fmtR(Math.min(usDivTaxDue, usTaxPaidRON)) + ' RON'],
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

    // D212 Cap. I §1.1 — cap11 rows (gap D-6). Only shown when there's RO-source
    // activity to declare. The user can verify the structured row that will be
    // emitted in the future D-7 XML export here.
    const cap11Section = document.getElementById('dcl-cap11-section');
    const cap11Tbody = document.getElementById('dcl-cap11-tbody');
    if (cap11Section && cap11Tbody) {
      const rows = data.cap11Rows || [];
      if (rows.length === 0) {
        cap11Section.style.display = 'none';
      } else {
        cap11Section.style.display = '';
        const r = rows[0];
        cap11Tbody.innerHTML = [
          [I18n.t('taxes.cap11CategVenit') || 'Cod categorie (categ_venit)', '<code>' + r.categ_venit + '</code> — ' + r.den_venit],
          [I18n.t('taxes.cap11Rd1') || 'Rd.1 Venit brut (venit_brut)', fmtR(r.venit_brut) + ' RON'],
          [I18n.t('taxes.cap11Rd2') || 'Rd.2 Cheltuieli deductibile (chelt_deduc)', fmtR(r.chelt_deduc) + ' RON'],
          [I18n.t('taxes.cap11Rd3') || 'Rd.3 Venit net anual (venit_net_anual)', fmtR(r.venit_net_anual) + ' RON'],
          [I18n.t('taxes.cap11Rd4') || 'Rd.4 Pierdere anuală (pierdere)', fmtR(r.pierdere) + ' RON'],
          [I18n.t('taxes.cap11Rd5') || 'Rd.5 Pierdere precedentă (pierdere_precedenta)', fmtR(r.pierdere_precedenta) + ' RON'],
          [I18n.t('taxes.cap11Rd6') || 'Rd.6 Pierdere compensată (pierdere_compensata)', fmtR(r.pierdere_compensata) + ' RON'],
          [I18n.t('taxes.cap11Rd7') || 'Rd.7 Venit recalculat (venit_recalculat)', fmtR(r.venit_recalculat) + ' RON'],
          [I18n.t('taxes.cap11Rd8') || 'Rd.8 Impozit anual (impozit11)', fmtR(r.impozit11) + ' RON'],
          [I18n.t('taxes.cap11Rd9') || 'Rd.9 Impozit reținut la sursă (impozit_retinut)', fmtR(r.impozit_retinut) + ' RON'],
        ].map(([f, v]) => `<tr><td style="font-size:0.85rem;">${f}</td><td style="font-variant-numeric:tabular-nums;">${v}</td></tr>`).join('');
      }
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
      const usDivTaxDue = usDivRON * data.divTaxRate;
      const usTaxPaidRON = data.usDivForeignTaxRON || 0;
      const usDivTax = Math.max(0, usDivTaxDue - usTaxPaidRON);
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

  // ============ ADD DATA TAB — IMPORTS DETECTION & SUB-TAB MODES ============
  /**
   * Catalog of importable data sources. Each descriptor declares:
   *   - id: matches the upload type from server.js (xtb_dividends, xtb_portfolio, ...)
   *   - title: i18n key for the human-readable label
   *   - isActive(yd): true when this import has produced data for the year
   *   - rawFilePattern: filename produced under data/ when this import succeeds
   *   - rows(yd): editable rows for the imports panel, each with
   *       { label, parsedValue, manualKey, formatted, currency? }
   *   - relatedFieldsetIds: HTML <fieldset> IDs whose inputs become redundant
   *     when this import is active. Tab 2 hides them by default; "Mod avansat"
   *     reveals them.
   *
   * Adding a new import type means adding one entry here — the imports panel
   * and the Tab 2 filtering pick it up automatically.
   */
  const IMPORT_DESCRIPTORS = [
    {
      id: 'xtb_dividends',
      title: 'XTB · Raport Dividende & Dobânzi',
      icon: '📄',
      isActive: (yd) => !!yd.xtbDividendsReport,
      rawFilePattern: 'xtb_dividends_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-ro-dividends', 'fieldset-interest'],
      rows: (yd) => {
        const d = yd.xtbDividendsReport || {};
        const rows = [];
        if (d.dividends?.grossRON != null) {
          rows.push({ label: 'Dividende brute (RON)', parsedValue: d.dividends.grossRON, manualKey: 'xtbDividends', currency: 'RON' });
        }
        if (d.dividends?.taxWithheldRON != null) {
          rows.push({ label: 'Impozit dividende reținut (RON)', parsedValue: d.dividends.taxWithheldRON, manualKey: 'roDivTaxPaid', currency: 'RON' });
        }
        if (d.interest?.grossRON != null) {
          rows.push({ label: 'Dobânzi brute (RON)', parsedValue: d.interest.grossRON, manualKey: 'interestIncome', currency: 'RON' });
        }
        if (d.interest?.taxWithheldRON != null) {
          rows.push({ label: 'Impozit dobânzi reținut (RON)', parsedValue: d.interest.taxWithheldRON, manualKey: 'interestTaxPaid', currency: 'RON' });
        }
        return rows;
      }
    },
    {
      id: 'xtb_portfolio',
      title: 'XTB · Fișă de Portofoliu',
      icon: '📄',
      isActive: (yd) => !!yd.xtbPortfolio,
      rawFilePattern: 'xtb_portfolio_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-ro-gains'],
      // Per-country editing is rendered specially in renderImportsPanel().
      perCountry: true,
      countriesSource: (yd) => yd.xtbPortfolio?.countries || [],
    },
    {
      id: 'tradeville_portfolio',
      title: 'Tradeville · Fișă de Portofoliu',
      icon: '📄',
      isActive: (yd) => !!yd.tradevillePortfolio,
      rawFilePattern: 'tradeville_portfolio_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-ro-gains'],
      perCountry: true,
      countriesSource: (yd) => yd.tradevillePortfolio?.countries || [],
    },
    {
      id: 'bt_dividends',
      title: 'BT Capital Partners · Fișă Dividende (piețe externe)',
      icon: '📄',
      isActive: (yd) => !!yd.btDividendsReport,
      rawFilePattern: 'bt_dividends_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-ro-dividends'],
      rows: (yd) => {
        const d = yd.btDividendsReport || {};
        const rows = [];
        if (d.dividends?.grossRON != null) {
          rows.push({ label: 'Dividende brute (RON)', parsedValue: d.dividends.grossRON, manualKey: 'xtbDividends', currency: 'RON' });
        }
        if (d.dividends?.taxWithheldRON != null) {
          rows.push({ label: 'Impozit dividende reținut (RON)', parsedValue: d.dividends.taxWithheldRON, manualKey: 'roDivTaxPaid', currency: 'RON' });
        }
        // Display per-row symbol/ISIN breakdown count so the user can spot
        // missing payments at a glance.
        if (Array.isArray(d.dividendRows) && d.dividendRows.length > 0) {
          rows.push({ label: `Număr plăți individuale`, parsedValue: d.dividendRows.length, manualKey: null, currency: '' });
        }
        return rows;
      }
    },
    {
      id: 'bt_portfolio',
      title: 'BT Capital Partners · Fișă de Portofoliu',
      icon: '📄',
      isActive: (yd) => !!yd.btPortfolio,
      rawFilePattern: 'bt_portfolio_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-ro-gains'],
      perCountry: true,
      countriesSource: (yd) => yd.btPortfolio?.countries || [],
    },
    {
      id: 'revolut_statement',
      title: 'Revolut · Consolidated Statement',
      icon: '📄',
      isActive: (yd) => !!yd.revolutStatement && (yd.revolutStatement.sales?.length > 0 || (yd.revolutStatement.summary?.grossProceeds || yd.revolutStatement.summary?.grossProceedsEUR) > 0),
      rawFilePattern: 'revolut_statement_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-ro-gains'],
      perCountry: true,
      countriesSource: (yd) => yd.revolutStatement?.countries || [],
      rows: (yd) => {
        const stmt = yd.revolutStatement || {};
        const s = stmt.summary || {};
        const ccy = stmt.currency || s.currency || 'EUR';
        const rows = [];
        // Prefer the new currency-neutral field names; fall back to the
        // legacy *EUR aliases for statements parsed before the multi-
        // currency refactor.
        const gross = s.grossProceeds != null ? s.grossProceeds : s.grossProceedsEUR;
        const cost = s.costBasis != null ? s.costBasis : s.costBasisEUR;
        const pnl = s.realisedPnL != null ? s.realisedPnL : s.realisedPnLEUR;
        const divs = s.dividends != null ? s.dividends : s.dividendsEUR;
        if (gross) rows.push({ label: `Vânzări brute (${ccy})`, parsedValue: gross, manualKey: null, currency: ccy });
        if (cost) rows.push({ label: `Cost achiziție (${ccy})`, parsedValue: cost, manualKey: null, currency: ccy });
        if (pnl != null) rows.push({ label: `Câștig/pierdere brut (${ccy})`, parsedValue: pnl, manualKey: null, currency: ccy });
        if (divs) rows.push({ label: `Dividende (${ccy})`, parsedValue: divs, manualKey: null, currency: ccy });
        return rows;
      },
    },
    {
      id: 'fidelity_statement',
      title: 'Fidelity · Stock Plan Statement',
      icon: '📄',
      isActive: (yd) => (yd.fidelityDividendsYTD || 0) > 0 || (yd.fidelityTaxWithheldYTD || 0) > 0 || (yd.fidelityVests || []).length > 0,
      rawFilePattern: 'fidelity_statement_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-dividends', 'fieldset-capital-gains'],
      rows: (yd) => {
        const rows = [];
        if (yd.fidelityDividendsYTD) {
          rows.push({ label: 'Dividende SUA YTD (USD)', parsedValue: yd.fidelityDividendsYTD, manualKey: 'fidelityDividends', currency: 'USD' });
        }
        if (yd.fidelityTaxWithheldYTD) {
          rows.push({ label: 'Impozit dividende SUA reținut YTD (USD)', parsedValue: yd.fidelityTaxWithheldYTD, manualKey: 'usDivTaxPaid', currency: 'USD' });
        }
        if (yd.fidelityRealizedGainYTD) {
          rows.push({ label: 'Câștiguri realizate YTD (USD)', parsedValue: yd.fidelityRealizedGainYTD, manualKey: 'fidelityGains', currency: 'USD' });
        }
        return rows;
      }
    },
    {
      id: 'ms_statement',
      title: 'Morgan Stanley · Stock Plan Statement',
      icon: '📄',
      isActive: (yd) => !!yd.msStatement,
      rawFilePattern: 'ms_statement_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-dividends'],
      rows: (yd) => {
        const ms = yd.msStatement || {};
        const rows = [];
        if (ms.dividends) {
          rows.push({ label: 'Dividende MS (USD)', parsedValue: ms.dividends, manualKey: 'fidelityDividends', currency: 'USD' });
        }
        if (ms.taxWithheld) {
          rows.push({ label: 'Impozit MS reținut (USD)', parsedValue: ms.taxWithheld, manualKey: 'usDivTaxPaid', currency: 'USD' });
        }
        return rows;
      }
    },
    {
      id: 'form_1042s',
      title: 'IRS Form 1042-S',
      icon: '📄',
      isActive: (yd) => Array.isArray(yd.form1042s) && yd.form1042s.length > 0,
      rawFilePattern: 'form_1042s_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-dividends'],
      rows: (yd) => {
        const forms = yd.form1042s || [];
        const totalGross = forms.reduce((s, f) => s + (f.grossIncomeUSD || 0), 0);
        const totalTax = forms.reduce((s, f) => s + (f.federalTaxWithheldUSD || 0), 0);
        const rows = [];
        if (totalGross) {
          rows.push({ label: `Venit brut total (${forms.length} formulare) (USD)`, parsedValue: totalGross, manualKey: 'fidelityDividends', currency: 'USD' });
        }
        if (totalTax) {
          rows.push({ label: 'Impozit federal reținut total (USD)', parsedValue: totalTax, manualKey: 'usDivTaxPaid', currency: 'USD' });
        }
        return rows;
      }
    },
    {
      id: 'declaratie',
      title: 'ANAF · Declarație Unică D-212 importată',
      icon: '📄',
      isActive: (yd) => !!yd.declaratie,
      rawFilePattern: 'declaratie_{year}_raw.txt',
      relatedFieldsetIds: ['fieldset-dividends', 'fieldset-capital-gains', 'fieldset-ro-dividends', 'fieldset-ro-gains'],
      rows: (yd) => {
        const d = yd.declaratie || {};
        const rows = [];
        if (d.dividends?.grossRON) rows.push({ label: 'Dividende declarate (RON)', parsedValue: d.dividends.grossRON, manualKey: null, currency: 'RON' });
        if (d.capitalGains?.taxableRON) rows.push({ label: 'Câștig capital taxabil (RON)', parsedValue: d.capitalGains.taxableRON, manualKey: null, currency: 'RON' });
        if (d.totalTax) rows.push({ label: 'Total impozit declarat (RON)', parsedValue: d.totalTax, manualKey: null, currency: 'RON' });
        return rows;
      }
    }
  ];

  /**
   * Inline edit state for the imports panel. Cleared on year change.
   * Keys for flat rows: `${imp.id}:${manualKey}` (e.g. 'xtb_dividends:xtbDividends')
   * Keys for per-country rows: `${imp.id}:country:${idx}`
   */
  const inlineEditingRows = new Set();
  const inlineEditingCountries = new Set();
  function clearInlineEditState() {
    inlineEditingRows.clear();
    inlineEditingCountries.clear();
  }

  /** Returns the list of imports active for `year` based on the current yd. */
  function detectActiveImports(year) {
    const yd = appData.years?.[year] || {};
    return IMPORT_DESCRIPTORS.filter(d => d.isActive(yd));
  }

  /**
   * Render the "already imported documents" summary card on the Import
   * subtab. The user asked for this so they don't accidentally re-upload
   * the same document — though uploads do dedupe / overwrite as expected.
   *
   * Pulls active descriptors from `detectActiveImports(year)` and enriches
   * them with the raw-file mtime from `rawFilesList` (cached at app load
   * and refreshed after each successful upload). Each row offers two quick
   * actions: "📃 View raw" (jumps to Avansat → Raw Data with the file
   * pre-selected) and "🗑 Delete" (same endpoint the Add Data delete
   * button uses, so behavior stays consistent).
   *
   * Re-rendered on subtab switch + after each upload.
   */
  function renderImportExistingPanel() {
    const panel = document.getElementById('import-existing-panel');
    if (!panel) return;
    const yd = appData.years?.[selectedYear] || {};
    const active = (IMPORT_DESCRIPTORS || []).filter(d => d.isActive(yd));
    if (active.length === 0) {
      panel.style.display = 'none';
      panel.innerHTML = '';
      return;
    }
    // Helper: find the raw file metadata for a descriptor + year.
    const fileMetaFor = (imp) => {
      if (!imp.rawFilePattern) return null;
      const name = imp.rawFilePattern.replace('{year}', selectedYear);
      return rawFilesList.find(f => f.name === name) || null;
    };
    const fmtDate = (iso) => {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        return d.toLocaleDateString('ro-RO') + ' ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
      } catch { return ''; }
    };
    const fmtSize = (b) => {
      if (b == null) return '';
      if (b < 1024) return `${b} B`;
      if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
      return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    };
    const title = (I18n.t('import.existingTitle') || 'Documente deja importate pentru {year}').replace('{year}', selectedYear);
    const hint = I18n.t('import.existingHint') || 'Un upload nou pentru același tip suprascrie datele existente. Datele duplicate sunt deduplicate automat la importurile multi-formă (ex. 1042-S).';

    const rows = active.map(imp => {
      const meta = fileMetaFor(imp);
      const fileName = imp.rawFilePattern ? imp.rawFilePattern.replace('{year}', selectedYear) : null;
      const dateStr = meta ? fmtDate(meta.date) : '';
      const sizeStr = meta ? fmtSize(meta.size) : '';
      const metaLine = (dateStr || sizeStr) ? `<span style="color:var(--text-muted);font-size:0.75rem;">${esc(dateStr)} · ${esc(sizeStr)}</span>` : '';
      const rawBtn = fileName ? `<button type="button" class="btn-primary import-action-raw" data-file="${esc(fileName)}" style="font-size:0.75rem;padding:0.25rem 0.6rem;">📃 ${esc(I18n.t('input.viewRaw') || 'Raw')}</button>` : '';
      const delBtn = fileName ? `<button type="button" class="btn-primary import-action-delete" data-file="${esc(fileName)}" style="font-size:0.75rem;padding:0.25rem 0.6rem;background:var(--danger);">🗑</button>` : '';
      const reBtn = `<button type="button" class="btn-primary import-action-reimport" data-type="${esc(imp.id)}" style="font-size:0.75rem;padding:0.25rem 0.6rem;background:var(--bg-secondary);color:var(--text-primary);" title="${esc(I18n.t('import.reimportTooltip') || 'Re-importă același tip')}">↻ ${esc(I18n.t('import.reimport') || 'Re-import')}</button>`;
      return `<tr>
        <td style="padding:0.4rem 0.5rem;border-bottom:1px solid var(--border);">
          <strong>${esc(imp.icon || '📄')} ${esc(imp.title || imp.id)}</strong>
          ${metaLine ? '<br>' + metaLine : ''}
        </td>
        <td style="padding:0.4rem 0.5rem;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap;">
          ${reBtn} ${rawBtn} ${delBtn}
        </td>
      </tr>`;
    }).join('');

    panel.style.display = '';
    panel.innerHTML = `
      <div class="card" style="background:var(--bg-secondary);">
        <h3 style="margin:0 0 0.4rem;font-size:0.95rem;">📋 ${esc(title)}</h3>
        <p style="margin:0 0 0.6rem;font-size:0.8rem;color:var(--text-muted);">${esc(hint)}</p>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
      </div>
    `;

    // Wire actions — same handlers as the Add Data imports panel uses.
    panel.querySelectorAll('.import-action-raw').forEach(btn => {
      btn.onclick = () => {
        const file = btn.dataset.file;
        switchTab('raw');
        window._rawSelectFile?.(file);
      };
    });
    panel.querySelectorAll('.import-action-reimport').forEach(btn => {
      btn.onclick = () => {
        // Already on the import subtab — just preselect the type and focus
        // the file input so the user can pick a new PDF immediately.
        const typeSel = document.getElementById('upload-type');
        if (typeSel) typeSel.value = btn.dataset.type;
        const fileInput = document.getElementById('upload-file');
        if (fileInput) fileInput.click();
      };
    });
    panel.querySelectorAll('.import-action-delete').forEach(btn => {
      btn.onclick = async () => {
        const file = btn.dataset.file;
        if (!confirm((I18n.t('input.confirmDeleteImport') || 'Confirmi ștergerea importului "{file}"?').replace('{file}', file))) return;
        try {
          const resp = await fetch('/api/raw/' + encodeURIComponent(file), { method: 'DELETE' });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          // Refresh app data + re-render the panel.
          const dataResp = await fetch('/api/data');
          if (dataResp.ok) appData = await dataResp.json();
          const rawResp = await fetch('/api/raw');
          if (rawResp.ok) rawFilesList = await rawResp.json();
          invalidateComputeCache();
          renderImportExistingPanel();
          try { render(); } catch (_) { /* re-render the whole UI */ }
          showToast?.((I18n.t('input.deletedImport') || 'Import șters: {file}').replace('{file}', file), 'success');
        } catch (err) {
          alert((I18n.t('input.deleteImportError') || 'Eroare la ștergere:') + ' ' + err.message);
        }
      };
    });
  }

  /** Persisted preference for the Add Data mode + advanced toggle. */
  function getAddDataMode() {
    return localStorage.getItem('addDataMode') || 'auto';
  }
  function setAddDataMode(mode) {
    localStorage.setItem('addDataMode', mode);
  }
  function isAdvancedMode() {
    return localStorage.getItem('addDataAdvanced') === '1';
  }
  function setAdvancedMode(on) {
    localStorage.setItem('addDataAdvanced', on ? '1' : '0');
  }

  /**
   * Apply the current sub-tab mode + advanced toggle to the Add Data UI.
   * Called from populateForm() and from the switcher click handlers.
   *
   *   mode === 'imports' → show #data-imports-panel, hide the flat form below
   *   mode === 'new'     → hide #data-imports-panel, show the form. In NORMAL
   *                        mode, fieldsets whose relatedFieldsetIds match an
   *                        active import are hidden; ADVANCED reveals them.
   *
   * The brokers, rates, taxes, and unrelated income fieldsets are always shown
   * in both modes — they don't have import equivalents.
   */
  function applyAddDataMode() {
    const imports = detectActiveImports(selectedYear);
    const hasImports = imports.length > 0;
    let mode = getAddDataMode();
    if (mode === 'auto') mode = hasImports ? 'imports' : 'new';
    const advanced = isAdvancedMode();

    const importsBtn = document.getElementById('data-mode-imports');
    const newBtn = document.getElementById('data-mode-new');
    const advancedToggle = document.getElementById('data-advanced-toggle');
    const importsPanel = document.getElementById('data-imports-panel');
    const dataForm = document.getElementById('data-form');
    const modeHint = document.getElementById('data-mode-hint');
    if (!importsBtn || !newBtn || !advancedToggle || !importsPanel || !dataForm) return;

    // Disable the "imports" tab when nothing is imported yet
    importsBtn.disabled = !hasImports;
    importsBtn.style.opacity = hasImports ? '' : '0.5';
    importsBtn.style.cursor = hasImports ? 'pointer' : 'not-allowed';
    importsBtn.title = hasImports ? '' : (I18n.t('input.modeImportsDisabled') || 'Nu există documente importate pentru acest an');

    // Toggle the .active class on the buttons
    importsBtn.classList.toggle('active', mode === 'imports');
    importsBtn.setAttribute('aria-selected', mode === 'imports' ? 'true' : 'false');
    newBtn.classList.toggle('active', mode === 'new');
    newBtn.setAttribute('aria-selected', mode === 'new' ? 'true' : 'false');

    // Sync the advanced checkbox
    advancedToggle.checked = advanced;

    if (mode === 'imports') {
      importsPanel.style.display = '';
      dataForm.style.display = 'none';
      modeHint.textContent = I18n.t('input.modeImportsHint') || 'Verifică datele extrase din documente și corectează valorile dacă parser-ul a greșit.';
      renderImportsPanel(imports);
    } else {
      importsPanel.style.display = 'none';
      dataForm.style.display = '';
      // Hide fieldsets whose import is active (unless advanced mode)
      const hiddenIds = new Set();
      if (!advanced) {
        for (const imp of imports) {
          for (const fid of (imp.relatedFieldsetIds || [])) hiddenIds.add(fid);
        }
      }
      const allFieldsetIds = ['fieldset-dividends', 'fieldset-capital-gains', 'fieldset-ro-gains', 'fieldset-interest'];
      for (const fid of allFieldsetIds) {
        const el = document.getElementById(fid);
        if (!el) continue;
        el.style.display = hiddenIds.has(fid) ? 'none' : '';
      }
      if (advanced) {
        modeHint.textContent = I18n.t('input.modeAdvancedHint') || 'Toate câmpurile sunt vizibile, inclusiv cele care au valori importate.';
      } else if (hiddenIds.size > 0) {
        modeHint.textContent = (I18n.t('input.modeNewHint') || 'Câmpurile pentru tipurile cu import sunt ascunse. Activează „Mod avansat" pentru a le vedea.');
      } else {
        modeHint.textContent = I18n.t('input.modeNewHintNoImports') || 'Adaugă date pentru categoriile de venit pentru care nu ai documente importate.';
      }
    }
  }

  /**
   * Render the imports verification panel: one card per active import with a
   * table of editable rows. This is the read-only first pass; inline edit and
   * per-country editing for portfolio imports land in follow-up commits.
   */
  function renderImportsPanel(imports) {
    const panel = document.getElementById('data-imports-panel');
    if (!panel) return;
    const yd = appData.years?.[selectedYear] || {};
    if (!imports || imports.length === 0) {
      panel.innerHTML = `<div class="card"><p style="color:var(--text-muted);">${esc(I18n.t('input.noImports') || 'Nu există documente importate pentru anul curent.')}</p></div>`;
      return;
    }
    const fmtVal = (v, currency) => {
      if (v == null) return '—';
      const n = Math.round((v + Number.EPSILON) * 100) / 100;
      const formatted = (currency === 'RON' ? Math.round(n).toLocaleString('ro-RO') : n.toFixed(2));
      return `${formatted}${currency ? ' ' + currency : ''}`;
    };
    let html = '';
    for (const imp of imports) {
      html += `<div class="card import-card" style="margin-bottom:1rem;">
        <header style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
          <span style="font-size:1.3rem;">${imp.icon || '📄'}</span>
          <h3 style="margin:0;font-size:1.05rem;">${esc(imp.title)}</h3>
          <span class="status-badge" style="margin-left:auto;background:rgba(63,185,80,0.15);color:var(--success);padding:0.2rem 0.5rem;border-radius:var(--radius);font-size:0.75rem;">✓ ${esc(I18n.t('input.importParsedOk') || 'Parsat')}</span>
        </header>`;

      if (imp.perCountry) {
        const countries = (imp.countriesSource ? imp.countriesSource(yd) : []) || [];
        if (countries.length === 0) {
          html += `<p style="color:var(--text-muted);font-size:0.85rem;">${esc(I18n.t('input.noCountryRows') || 'Niciun rând per țară.')}</p>`;
        } else {
          html += `<div style="overflow-x:auto;"><table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--border);">
              <th style="text-align:left;padding:0.4rem;">${esc(I18n.t('input.country'))}</th>
              <th style="text-align:left;padding:0.4rem;">${esc(I18n.t('input.currency') || 'Monedă')}</th>
              <th style="text-align:right;padding:0.4rem;">${esc(I18n.t('input.roGainsLong'))}</th>
              <th style="text-align:right;padding:0.4rem;">≥1y ${esc(I18n.t('income.taxRON'))}</th>
              <th style="text-align:right;padding:0.4rem;">${esc(I18n.t('input.roGainsShort'))}</th>
              <th style="text-align:right;padding:0.4rem;">&lt;1y ${esc(I18n.t('income.taxRON'))}</th>
              <th style="text-align:right;padding:0.4rem;">${esc(I18n.t('input.actions') || 'Acțiuni')}</th>
            </tr></thead>
            <tbody>`;
          for (let idx = 0; idx < countries.length; idx++) {
            const c = countries[idx];
            const editKey = `${imp.id}:country:${idx}`;
            const isEditing = inlineEditingCountries.has(editKey);
            const longGain = (c.longGain || 0) - (c.longLoss || 0);
            const shortGain = (c.shortGain || 0) - (c.shortLoss || 0);
            const cur = c.currency || 'RON';
            const reasonVal = c.correctionReason || '';
            if (isEditing) {
              html += `<tr class="inline-edit-row" data-edit-key="${esc(editKey)}" style="background:rgba(88,166,255,0.05);border-bottom:1px solid var(--border);">
                <td colspan="7" style="padding:0.6rem;">
                  <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.4rem;">${esc(I18n.t('input.editCountryTitle') || 'Editare rând per țară')} — <strong>${esc(c.country || '?')}</strong> [${esc(cur)}]</div>
                  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0.5rem;margin-bottom:0.5rem;">
                    <label style="display:flex;flex-direction:column;font-size:0.75rem;color:var(--text-muted);">${esc(I18n.t('input.roGainsLong'))} <input type="number" step="any" class="inline-edit-country-field" data-edit-key="${esc(editKey)}" data-field="longGain" value="${esc(String(c.longGain ?? 0))}" style="margin-top:0.15rem;padding:0.35rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.85rem;"></label>
                    <label style="display:flex;flex-direction:column;font-size:0.75rem;color:var(--text-muted);">${esc(I18n.t('input.longLoss') || 'Pierdere ≥1 an')} <input type="number" step="any" class="inline-edit-country-field" data-edit-key="${esc(editKey)}" data-field="longLoss" value="${esc(String(c.longLoss ?? 0))}" style="margin-top:0.15rem;padding:0.35rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.85rem;"></label>
                    <label style="display:flex;flex-direction:column;font-size:0.75rem;color:var(--text-muted);">${esc(I18n.t('input.taxLong') || 'Impozit ≥1 an')} <input type="number" step="any" class="inline-edit-country-field" data-edit-key="${esc(editKey)}" data-field="longTax" value="${esc(String(c.longTax ?? 0))}" style="margin-top:0.15rem;padding:0.35rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.85rem;"></label>
                    <label style="display:flex;flex-direction:column;font-size:0.75rem;color:var(--text-muted);">${esc(I18n.t('input.roGainsShort'))} <input type="number" step="any" class="inline-edit-country-field" data-edit-key="${esc(editKey)}" data-field="shortGain" value="${esc(String(c.shortGain ?? 0))}" style="margin-top:0.15rem;padding:0.35rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.85rem;"></label>
                    <label style="display:flex;flex-direction:column;font-size:0.75rem;color:var(--text-muted);">${esc(I18n.t('input.shortLoss') || 'Pierdere <1 an')} <input type="number" step="any" class="inline-edit-country-field" data-edit-key="${esc(editKey)}" data-field="shortLoss" value="${esc(String(c.shortLoss ?? 0))}" style="margin-top:0.15rem;padding:0.35rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.85rem;"></label>
                    <label style="display:flex;flex-direction:column;font-size:0.75rem;color:var(--text-muted);">${esc(I18n.t('input.taxShort') || 'Impozit <1 an')} <input type="number" step="any" class="inline-edit-country-field" data-edit-key="${esc(editKey)}" data-field="shortTax" value="${esc(String(c.shortTax ?? 0))}" style="margin-top:0.15rem;padding:0.35rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.85rem;"></label>
                  </div>
                  <div style="margin-bottom:0.5rem;">
                    <label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:0.2rem;">${esc(I18n.t('input.reasonOptional') || 'Motiv corecție (opțional)')}</label>
                    <input type="text" class="inline-edit-country-reason" data-edit-key="${esc(editKey)}" value="${esc(reasonVal)}" placeholder="${esc(I18n.t('input.reasonPlaceholder') || '')}" style="width:100%;padding:0.4rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.85rem;">
                  </div>
                  <div style="display:flex;gap:0.4rem;justify-content:flex-end;">
                    <button type="button" class="btn-secondary inline-edit-cancel" data-edit-key="${esc(editKey)}" style="font-size:0.8rem;padding:0.4rem 0.8rem;">${esc(I18n.t('input.cancelEdit') || 'Anulează')}</button>
                    <button type="button" class="btn-primary inline-edit-country-save" data-edit-key="${esc(editKey)}" data-imp-id="${esc(imp.id)}" data-idx="${idx}" style="font-size:0.8rem;padding:0.4rem 0.8rem;">${esc(I18n.t('input.saveEdit') || 'Salvează')}</button>
                  </div>
                </td>
              </tr>`;
            } else {
              html += `<tr style="border-bottom:1px solid var(--border);">
                <td style="padding:0.4rem;">${esc(c.country || '?')}${reasonVal ? `<br><small style="color:var(--text-muted);font-style:italic;">📝 ${esc(reasonVal)}</small>` : ''}</td>
                <td style="padding:0.4rem;">${esc(cur)}</td>
                <td style="padding:0.4rem;text-align:right;font-variant-numeric:tabular-nums;">${esc(fmtVal(longGain, cur))}</td>
                <td style="padding:0.4rem;text-align:right;font-variant-numeric:tabular-nums;">${esc(fmtVal(c.longTax || 0, cur))}</td>
                <td style="padding:0.4rem;text-align:right;font-variant-numeric:tabular-nums;">${esc(fmtVal(shortGain, cur))}</td>
                <td style="padding:0.4rem;text-align:right;font-variant-numeric:tabular-nums;">${esc(fmtVal(c.shortTax || 0, cur))}</td>
                <td style="padding:0.4rem;text-align:right;"><button type="button" class="btn-secondary inline-edit-country-start" data-imp-id="${esc(imp.id)}" data-idx="${idx}" style="font-size:0.75rem;padding:0.25rem 0.55rem;">${esc(I18n.t('input.editInline') || '✎ Editare')}</button></td>
              </tr>`;
            }
          }
          html += `</tbody></table></div>`;
        }
      } else {
        const rows = imp.rows ? imp.rows(yd) : [];
        if (rows.length === 0) {
          html += `<p style="color:var(--text-muted);font-size:0.85rem;">${esc(I18n.t('input.noEditableFields') || 'Niciun câmp editabil.')}</p>`;
        } else {
          html += `<div style="overflow-x:auto;"><table style="width:100%;font-size:0.9rem;border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid var(--border);">
              <th style="text-align:left;padding:0.4rem;">${esc(I18n.t('input.fieldLabel') || 'Câmp')}</th>
              <th style="text-align:right;padding:0.4rem;">${esc(I18n.t('input.parsedValue') || 'Parsat')}</th>
              <th style="text-align:right;padding:0.4rem;">${esc(I18n.t('input.currentOverride') || 'Override manual')}</th>
              <th style="text-align:right;padding:0.4rem;">${esc(I18n.t('input.actions') || 'Acțiuni')}</th>
            </tr></thead>
            <tbody>`;
          for (const r of rows) {
            const manualVal = r.manualKey ? yd[r.manualKey] : null;
            const reasonVal = r.manualKey ? (yd[r.manualKey + 'Reason'] || '') : '';
            const hasManual = manualVal !== undefined && manualVal !== '' && manualVal !== null;
            const editKey = r.manualKey ? `${imp.id}:${r.manualKey}` : null;
            const isEditing = editKey && inlineEditingRows.has(editKey);
            if (isEditing) {
              const editValue = hasManual ? String(manualVal) : (r.parsedValue != null ? String(r.parsedValue) : '');
              html += `<tr class="inline-edit-row" data-edit-key="${esc(editKey)}" style="background:rgba(88,166,255,0.05);border-bottom:1px solid var(--border);">
                <td colspan="4" style="padding:0.6rem;">
                  <div style="display:flex;flex-wrap:wrap;gap:0.6rem;align-items:flex-end;">
                    <div style="flex:1;min-width:180px;">
                      <label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:0.2rem;">${esc(r.label)} ${r.currency ? `<span style="color:var(--text-muted);">(${esc(r.currency)})</span>` : ''}</label>
                      <input type="number" step="any" class="inline-edit-value" data-edit-key="${esc(editKey)}" value="${esc(editValue)}" style="width:100%;padding:0.4rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.9rem;">
                      <small style="display:block;color:var(--text-muted);font-size:0.7rem;margin-top:0.15rem;">${esc(I18n.t('input.parsedValue') || 'Parsat')}: ${esc(fmtVal(r.parsedValue, r.currency))}</small>
                    </div>
                    <div style="flex:2;min-width:200px;">
                      <label style="display:block;font-size:0.75rem;color:var(--text-muted);margin-bottom:0.2rem;">${esc(I18n.t('input.reasonOptional') || 'Motiv corecție (opțional)')}</label>
                      <input type="text" class="inline-edit-reason" data-edit-key="${esc(editKey)}" value="${esc(reasonVal)}" placeholder="${esc(I18n.t('input.reasonPlaceholder') || '')}" style="width:100%;padding:0.4rem;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius);font-size:0.85rem;">
                    </div>
                    <div style="display:flex;gap:0.4rem;">
                      <button type="button" class="btn-secondary inline-edit-cancel" data-edit-key="${esc(editKey)}" style="font-size:0.8rem;padding:0.4rem 0.8rem;">${esc(I18n.t('input.cancelEdit') || 'Anulează')}</button>
                      <button type="button" class="btn-primary inline-edit-save" data-edit-key="${esc(editKey)}" data-imp-id="${esc(imp.id)}" data-manual-key="${esc(r.manualKey)}" style="font-size:0.8rem;padding:0.4rem 0.8rem;">${esc(I18n.t('input.saveEdit') || 'Salvează')}</button>
                    </div>
                  </div>
                </td>
              </tr>`;
            } else {
              const cellStyle = hasManual ? 'color:var(--warning);font-weight:600;' : 'color:var(--text-muted);';
              html += `<tr style="border-bottom:1px solid var(--border);">
                <td style="padding:0.4rem;">${esc(r.label)}${reasonVal ? `<br><small style="color:var(--text-muted);font-style:italic;">📝 ${esc(reasonVal)}</small>` : ''}</td>
                <td style="padding:0.4rem;text-align:right;font-variant-numeric:tabular-nums;">${esc(fmtVal(r.parsedValue, r.currency))}</td>
                <td style="padding:0.4rem;text-align:right;font-variant-numeric:tabular-nums;${cellStyle}">${hasManual ? esc(fmtVal(parseFloat(manualVal), r.currency)) : '—'}</td>
                <td style="padding:0.4rem;text-align:right;">${r.manualKey ? `<button type="button" class="btn-secondary inline-edit-start" data-imp-id="${esc(imp.id)}" data-manual-key="${esc(r.manualKey)}" style="font-size:0.75rem;padding:0.25rem 0.55rem;">${esc(I18n.t('input.editInline') || '✎ Editare')}</button>` : ''}</td>
              </tr>`;
            }
          }
          html += `</tbody></table></div>`;
        }
      }

      html += `<footer style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" class="btn-primary import-action-raw" data-file="${esc(imp.rawFilePattern.replace('{year}', selectedYear))}" style="font-size:0.8rem;padding:0.35rem 0.7rem;">📃 ${esc(I18n.t('input.viewRaw') || 'Vezi raw text')}</button>
        <button type="button" class="btn-primary import-action-reimport" data-type="${esc(imp.id)}" style="font-size:0.8rem;padding:0.35rem 0.7rem;">⟳ ${esc(I18n.t('input.reimport') || 'Re-importă')}</button>
        <button type="button" class="btn-primary import-action-delete" data-file="${esc(imp.rawFilePattern.replace('{year}', selectedYear))}" style="font-size:0.8rem;padding:0.35rem 0.7rem;background:var(--danger);">🗑 ${esc(I18n.t('input.deleteImport') || 'Șterge import')}</button>
      </footer>`;
      html += `</div>`;
    }
    panel.innerHTML = html;

    // Wire the action buttons
    panel.querySelectorAll('.import-action-raw').forEach(btn => {
      btn.onclick = () => {
        const file = btn.dataset.file;
        // Switch to Raw Data subtab (now nested under the "Avansat" group).
        // switchTab() resolves the parent group automatically.
        switchTab('raw');
        window._rawSelectFile?.(file);
      };
    });
    panel.querySelectorAll('.import-action-reimport').forEach(btn => {
      btn.onclick = () => {
        // Switch to the Import subtab (now nested under the "Date" group).
        switchTab('import');
        // Pre-select the type
        const typeSel = document.getElementById('upload-type');
        if (typeSel) typeSel.value = btn.dataset.type;
      };
    });
    panel.querySelectorAll('.import-action-delete').forEach(btn => {
      btn.onclick = async () => {
        const file = btn.dataset.file;
        if (!confirm((I18n.t('input.confirmDeleteImport') || 'Confirmi ștergerea importului "{file}"?').replace('{file}', file))) return;
        try {
          await fetch(`/api/raw/${encodeURIComponent(file)}`, { method: 'DELETE' });
          await loadAllData();
          applyAddDataMode();
          render();
          showToast(I18n.t('raw.deleted') || 'Import șters', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    });

    // Inline edit — start (flat row)
    panel.querySelectorAll('.inline-edit-start').forEach(btn => {
      btn.onclick = () => {
        const key = `${btn.dataset.impId}:${btn.dataset.manualKey}`;
        inlineEditingRows.add(key);
        renderImportsPanel(detectActiveImports(selectedYear));
      };
    });
    // Inline edit — start (country row)
    panel.querySelectorAll('.inline-edit-country-start').forEach(btn => {
      btn.onclick = () => {
        const key = `${btn.dataset.impId}:country:${btn.dataset.idx}`;
        inlineEditingCountries.add(key);
        renderImportsPanel(detectActiveImports(selectedYear));
      };
    });
    // Inline edit — cancel (handles both flat and country)
    panel.querySelectorAll('.inline-edit-cancel').forEach(btn => {
      btn.onclick = () => {
        const k = btn.dataset.editKey;
        inlineEditingRows.delete(k);
        inlineEditingCountries.delete(k);
        renderImportsPanel(detectActiveImports(selectedYear));
      };
    });
    // Inline edit — save (flat row)
    panel.querySelectorAll('.inline-edit-save').forEach(btn => {
      btn.onclick = async () => {
        const editKey = btn.dataset.editKey;
        const manualKey = btn.dataset.manualKey;
        const valEl = panel.querySelector(`.inline-edit-value[data-edit-key="${editKey}"]`);
        const reasonEl = panel.querySelector(`.inline-edit-reason[data-edit-key="${editKey}"]`);
        const rawVal = (valEl?.value || '').trim();
        const parsedVal = rawVal === '' ? null : parseFloat(rawVal);
        if (rawVal !== '' && (parsedVal == null || isNaN(parsedVal))) {
          showToast(I18n.t('errors.invalidNumber') || 'Valoare numerică invalidă', 'error');
          return;
        }
        const reasonVal = (reasonEl?.value || '').trim();
        const payload = {
          [manualKey]: parsedVal,
          [manualKey + 'Reason']: reasonVal || null,
        };
        try {
          const resp = await fetch(`/api/data/${selectedYear}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await resp.json();
          if (!result.success) throw new Error(result.error || 'Save failed');
          inlineEditingRows.delete(editKey);
          await loadAllData();
          render();
          showToast(I18n.t('input.editApplied') || 'Corecție aplicată', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    });
    // Inline edit — save (country row)
    panel.querySelectorAll('.inline-edit-country-save').forEach(btn => {
      btn.onclick = async () => {
        const editKey = btn.dataset.editKey;
        const impId = btn.dataset.impId;
        const idx = parseInt(btn.dataset.idx, 10);
        const desc = IMPORT_DESCRIPTORS.find(d => d.id === impId);
        if (!desc || !desc.perCountry) return;
        const ydNow = appData.years?.[selectedYear] || {};
        const rootKey = impId === 'xtb_portfolio' ? 'xtbPortfolio' : impId === 'tradeville_portfolio' ? 'tradevillePortfolio' : null;
        if (!rootKey) return;
        const root = ydNow[rootKey];
        if (!root || !Array.isArray(root.countries) || !root.countries[idx]) return;
        const fieldEls = panel.querySelectorAll(`.inline-edit-country-field[data-edit-key="${editKey}"]`);
        const reasonEl = panel.querySelector(`.inline-edit-country-reason[data-edit-key="${editKey}"]`);
        const newCountry = { ...root.countries[idx] };
        for (const el of fieldEls) {
          const f = el.dataset.field;
          const raw = (el.value || '').trim();
          const num = raw === '' ? 0 : parseFloat(raw);
          if (raw !== '' && isNaN(num)) {
            showToast(I18n.t('errors.invalidNumber') || 'Valoare numerică invalidă', 'error');
            return;
          }
          newCountry[f] = num;
        }
        const reasonVal = (reasonEl?.value || '').trim();
        newCountry.correctionReason = reasonVal || null;
        const newCountries = root.countries.slice();
        newCountries[idx] = newCountry;
        const payload = { [rootKey]: { ...root, countries: newCountries } };
        try {
          const resp = await fetch(`/api/data/${selectedYear}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await resp.json();
          if (!result.success) throw new Error(result.error || 'Save failed');
          inlineEditingCountries.delete(editKey);
          await loadAllData();
          render();
          showToast(I18n.t('input.editApplied') || 'Corecție aplicată', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
    });
  }

  /** Wire the sub-tab buttons + advanced toggle once on init. */
  function setupAddDataModeSwitcher() {
    const importsBtn = document.getElementById('data-mode-imports');
    const newBtn = document.getElementById('data-mode-new');
    const advancedToggle = document.getElementById('data-advanced-toggle');
    if (!importsBtn || !newBtn || !advancedToggle) return;
    importsBtn.addEventListener('click', () => {
      if (importsBtn.disabled) return;
      setAddDataMode('imports');
      applyAddDataMode();
    });
    newBtn.addEventListener('click', () => {
      setAddDataMode('new');
      applyAddDataMode();
    });
    advancedToggle.addEventListener('change', (e) => {
      setAdvancedMode(e.target.checked);
      applyAddDataMode();
    });
  }

  // ============ DATA FORM ============
  /**
   * Set a manual input's value from yd[manualKey] when present, otherwise
   * fall back to a value from an imported document. Adds a small "📄 imported"
   * hint below the input so the user knows where the value comes from.
   */
  function fillInputWithImport(inputId, yd, manualKey, importedVal, sourceLabel) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const manual = yd[manualKey];
    const hasManual = manual !== undefined && manual !== '' && manual !== null;
    const importNum = (importedVal != null && Math.abs(importedVal) > 0.005)
      ? Math.round(importedVal * 100) / 100
      : null;

    if (hasManual) {
      input.value = manual;
    } else if (importNum != null) {
      input.value = importNum;
    } else {
      input.value = '';
    }

    let hint = input.parentElement.querySelector('.import-hint');
    if (importNum != null) {
      if (!hint) {
        hint = document.createElement('small');
        hint.className = 'import-hint';
        hint.style.cssText = 'color:var(--success);font-size:0.7rem;display:block;margin-top:0.2rem;font-style:italic;';
        input.parentElement.appendChild(hint);
      }
      const baseLabel = I18n.t('input.importedFrom');
      if (hasManual) {
        hint.textContent = `📄 ${baseLabel} ${sourceLabel}: ${importNum} (${I18n.t('input.manualOverride')})`;
      } else {
        hint.textContent = `📄 ${baseLabel} ${sourceLabel}`;
      }
      hint.style.display = '';
    } else if (hint) {
      hint.style.display = 'none';
    }
  }

  function populateForm() {
    const yd = appData.years?.[selectedYear] || {};
    const rate = exchangeRates[selectedYear]?.usdRon || 4.57;
    const defaultMinSalary = (cassThresholds[selectedYear] || cassThresholds[2025]).minSalary;

    // Show year banner with a "Reset year" button on the right.
    const banner = document.getElementById('input-year-banner');
    if (banner) {
      banner.innerHTML = `<span class="year-badge">${selectedYear}</span><span style="flex:1;">${I18n.t('misc.editingBanner')} <strong>${selectedYear}</strong>. ${I18n.t('misc.rateAndSalaryApply')}</span><button type="button" id="reset-year-btn" class="btn-primary" style="background:var(--danger); font-size:0.8rem; padding:0.35rem 0.7rem; margin-left:auto;" title="${I18n.t('resetYear.tooltip') || ''}">🗑 ${I18n.t('resetYear.button') || 'Reset an'}</button>`;
      const resetBtn = document.getElementById('reset-year-btn');
      if (resetBtn) resetBtn.addEventListener('click', () => openResetYearModal(selectedYear));
    }

    document.getElementById('input-us-broker').value = yd.usBroker || '';
    document.getElementById('input-ro-broker').value = yd.roBroker || '';

    // US dividends & gains: imported data may come from Fidelity statements or 1042-S
    fillInputWithImport('input-us-dividends', yd, 'fidelityDividends', yd.fidelityDividendsYTD, 'Fidelity');
    fillInputWithImport('input-us-div-tax', yd, 'usDivTaxPaid', yd.fidelityTaxWithheldYTD, 'Fidelity');

    // Romania RON dividends & interest: imported from XTB Dividends report
    const xtbDiv = yd.xtbDividendsReport || {};
    fillInputWithImport('input-ro-dividends', yd, 'xtbDividends', xtbDiv.dividends?.grossRON, 'XTB');
    fillInputWithImport('input-ro-div-tax', yd, 'roDivTaxPaid', xtbDiv.dividends?.taxWithheldRON, 'XTB');
    fillInputWithImport('input-interest', yd, 'interestIncome', xtbDiv.interest?.grossRON, 'XTB');
    fillInputWithImport('input-interest-tax-paid', yd, 'interestTaxPaid', xtbDiv.interest?.taxWithheldRON, 'XTB');

    document.getElementById('input-ro-eur-dividends').value = yd.roEurDividends || '';
    document.getElementById('input-ro-eur-div-tax').value = yd.roEurDivTaxPaid || '';
    document.getElementById('input-ro-usd-dividends').value = yd.roUsdDividends || '';
    document.getElementById('input-ro-usd-div-tax').value = yd.roUsdDivTaxPaid || '';
    document.getElementById('input-us-gains').value = yd.fidelityGains || '';
    document.getElementById('input-us-cost').value = yd.fidelityCost || '';
    document.getElementById('input-ro-eur-interest').value = yd.roEurInterest || '';
    document.getElementById('input-ro-eur-interest-tax').value = yd.roEurInterestTaxPaid || '';
    document.getElementById('input-ro-usd-interest').value = yd.roUsdInterest || '';
    document.getElementById('input-ro-usd-interest-tax').value = yd.roUsdInterestTaxPaid || '';
    document.getElementById('input-rental-income').value = yd.rentalIncome || '';
    document.getElementById('input-rental-tax-paid').value = yd.rentalTaxPaid || '';
    document.getElementById('input-royalty-income').value = yd.royaltyIncome || '';
    document.getElementById('input-royalty-tax-paid').value = yd.royaltyTaxPaid || '';
    document.getElementById('input-gambling-income').value = yd.gamblingIncome || '';
    document.getElementById('input-gambling-tax-paid').value = yd.gamblingTaxPaid || '';
    document.getElementById('input-other-income').value = yd.otherIncome || '';
    document.getElementById('input-other-tax-paid').value = yd.otherTaxPaid || '';
    document.getElementById('input-exchange-rate').value = yd.exchangeRate || rate;
    const defaultEurRate = exchangeRates[selectedYear]?.eurRon || 4.97;
    document.getElementById('input-eur-rate').value = yd.eurRate || defaultEurRate;
    document.getElementById('input-min-salary').value = yd.minSalary || defaultMinSalary;
    document.getElementById('input-d212-deadline').value = yd.d212Deadline || d212DefaultDeadline(selectedYear);
    document.getElementById('input-stock-withholding').value = yd.stockWithholdingPaid || '';
    document.getElementById('input-salary-taxed').value = yd.salaryTaxedIncome || '';

    // Populate RO gains country rows: prefer manual; fall back to imported XTB / Tradeville portfolio
    const manualCountries = yd.roGainsCountries;
    const xtbCountries = yd.xtbPortfolio?.countries;
    const tvCountries = yd.tradevillePortfolio?.countries;
    let rowsToRender;
    let sourceForRows = null;
    if (Array.isArray(manualCountries) && manualCountries.length > 0) {
      rowsToRender = manualCountries;
    } else if (Array.isArray(xtbCountries) && xtbCountries.length > 0) {
      rowsToRender = xtbCountries.map(c => ({
        country: c.country,
        currency: c.currency || 'RON',
        longGain: c.longGain || 0,
        shortGain: c.shortGain || 0,
        taxWithheld: (c.longTax || 0) + (c.shortTax || 0)
      }));
      sourceForRows = 'XTB';
    } else if (Array.isArray(tvCountries) && tvCountries.length > 0) {
      rowsToRender = tvCountries.map(c => ({
        country: c.country,
        currency: c.currency || 'RON',
        longGain: c.longGain || 0,
        shortGain: c.shortGain || 0,
        taxWithheld: (c.longTax || 0) + (c.shortTax || 0)
      }));
      sourceForRows = 'Tradeville';
    } else {
      rowsToRender = [];
    }
    renderRoGainsRows(rowsToRender);
    // Show a hint above the country rows when they came from an import
    const roGainsContainer = document.getElementById('ro-gains-rows');
    if (roGainsContainer) {
      let importedHint = roGainsContainer.parentElement.querySelector('.ro-gains-import-hint');
      if (sourceForRows) {
        if (!importedHint) {
          importedHint = document.createElement('p');
          importedHint.className = 'ro-gains-import-hint';
          importedHint.style.cssText = 'color:var(--success);font-size:0.8rem;font-style:italic;margin:0 0 0.5rem 0;';
          roGainsContainer.parentElement.insertBefore(importedHint, roGainsContainer);
        }
        importedHint.textContent = `📄 ${I18n.t('input.importedFrom')} ${sourceForRows}`;
        importedHint.style.display = '';
      } else if (importedHint) {
        importedHint.style.display = 'none';
      }
    }

    // Update fieldset legend with year
    const legend = document.getElementById('legend-rates');
    if (legend) {
      legend.textContent = `${I18n.t('misc.exchangeRateAndSalary')} (${selectedYear})`;
    }

    // Populate tax rates
    populateTaxRates();

    // Apply the Add Data sub-tab mode (imports vs new) + advanced toggle.
    // Done last so that all inputs are populated before deciding which to hide.
    applyAddDataMode();

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
    row.style.cssText = 'display:grid;grid-template-columns:1fr 0.7fr 1fr 1fr 1fr auto;gap:0.75rem;align-items:end;margin-bottom:0.75rem;';
    const countryOpts = `<option value="" disabled ${!data?.country ? 'selected' : ''}>${I18n.t('input.selectCountry')}</option>` + RO_COUNTRIES.map(c => `<option value="${c}"${data?.country === c ? ' selected' : ''}>${c}</option>`).join('');
    const curVal = (data?.currency || 'RON').toUpperCase();
    const curOpts = ['RON', 'EUR', 'USD'].map(c => `<option value="${c}"${curVal === c ? ' selected' : ''}>${c}</option>`).join('');
    row.innerHTML = `
      <div class="form-row" style="margin-bottom:0;">
        <label>${I18n.t('input.country')}</label>
        <select class="ro-country">${countryOpts}</select>
        <small style="color:var(--text-muted);font-size:0.7rem;">${I18n.t('input.countryHint')}</small>
      </div>
      <div class="form-row" style="margin-bottom:0;">
        <label>${I18n.t('input.currency') || 'Currency'}</label>
        <select class="ro-currency">${curOpts}</select>
        <small style="color:var(--text-muted);font-size:0.7rem;">${I18n.t('input.currencyHint') || 'Currency of amounts in this row'}</small>
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
      const currency = row.querySelector('.ro-currency')?.value || 'RON';
      const longGain = row.querySelector('.ro-long').value;
      const shortGain = row.querySelector('.ro-short').value;
      const taxWithheld = row.querySelector('.ro-tax').value;
      if (longGain || shortGain || taxWithheld) {
        result.push({
          country,
          currency,
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
      roEurDividends: document.getElementById('input-ro-eur-dividends').value,
      roEurDivTaxPaid: document.getElementById('input-ro-eur-div-tax').value,
      roUsdDividends: document.getElementById('input-ro-usd-dividends').value,
      roUsdDivTaxPaid: document.getElementById('input-ro-usd-div-tax').value,
      fidelityGains: document.getElementById('input-us-gains').value,
      fidelityCost: document.getElementById('input-us-cost').value,
      roGainsCountries: collectRoGainsRows(),
      interestIncome: document.getElementById('input-interest').value,
      interestTaxPaid: document.getElementById('input-interest-tax-paid').value,
      roEurInterest: document.getElementById('input-ro-eur-interest').value,
      roEurInterestTaxPaid: document.getElementById('input-ro-eur-interest-tax').value,
      roUsdInterest: document.getElementById('input-ro-usd-interest').value,
      roUsdInterestTaxPaid: document.getElementById('input-ro-usd-interest-tax').value,
      rentalIncome: document.getElementById('input-rental-income').value,
      rentalTaxPaid: document.getElementById('input-rental-tax-paid').value,
      royaltyIncome: document.getElementById('input-royalty-income').value,
      royaltyTaxPaid: document.getElementById('input-royalty-tax-paid').value,
      gamblingIncome: document.getElementById('input-gambling-income').value,
      gamblingTaxPaid: document.getElementById('input-gambling-tax-paid').value,
      otherIncome: document.getElementById('input-other-income').value,
      otherTaxPaid: document.getElementById('input-other-tax-paid').value,
      stockWithholdingPaid: document.getElementById('input-stock-withholding').value,
      salaryTaxedIncome: document.getElementById('input-salary-taxed').value
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
      eurRate: document.getElementById('input-eur-rate').value,
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

  // ============ D-7: D212 XML EXPORT ============
  /**
   * Build a D212 XML skeleton for the given year and trigger a download.
   * The XML carries the computed cap11 + cap14 elements; required personal
   * data attributes (nume_c, prenume_c, cif, nerezident) are placeholders
   * that the user replaces in the official ANAF tool before submission.
   *
   * Server endpoint: POST /api/d212-xml/:year with { cap11Rows, cap14Rows }
   * — server calls lib/d212-xml-builder.js (canonical, tested) and returns
   * the XML with the right Content-Disposition for browser download.
   */
  async function exportD212Xml(year) {
    try {
      const data = computeYearData(year);
      const cap11Rows = data.cap11Rows || [];
      const cap14Rows = data.cap14Rows || [];
      const obligRealizat = data.obligRealizat || null;
      if (cap11Rows.length === 0 && cap14Rows.length === 0 && !obligRealizat) {
        showToast(I18n.t('taxes.exportXmlEmpty') || 'Nu există venituri de declarat pentru acest an.', 'error');
        return;
      }
      const resp = await fetch(`/api/d212-xml/${year}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cap11Rows, cap14Rows, obligRealizat }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const xml = await resp.text();
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `D212_${year}_skeleton.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(I18n.t('taxes.exportXmlDone') || `XML salvat: D212_${year}_skeleton.xml`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
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
  /**
   * Mapping of upload document type → manual fields it will override.
   * Used to warn the user before an import overwrites their manual entries.
   * Each entry is a list of keys from yd (year data) considered "manual" for
   * the given document type. roGainsCountries is an array; everything else is
   * a scalar where non-empty means user-entered.
   */
  const MANUAL_FIELDS_BY_UPLOAD = {
    xtb_portfolio:        ['roGainsCountries', 'roGainsLong', 'roGainsShort', 'roGainsTaxWithheld'],
    tradeville_portfolio: ['roGainsCountries', 'roGainsLong', 'roGainsShort', 'roGainsTaxWithheld'],
    xtb_dividends:        ['xtbDividends', 'roDivTaxPaid',
                           'roEurDividends', 'roEurDivTaxPaid', 'roUsdDividends', 'roUsdDivTaxPaid',
                           'roEurInterest', 'roEurInterestTaxPaid', 'roUsdInterest', 'roUsdInterestTaxPaid',
                           'interestIncome', 'interestTaxPaid'],
    fidelity_statement:   ['fidelityDividends', 'usDivTaxPaid', 'fidelityGains', 'fidelityCost'],
    ms_statement:         ['fidelityDividends', 'usDivTaxPaid', 'fidelityGains', 'fidelityCost'],
    investment:           ['fidelityDividends', 'fidelityGains'],
    form_1042s:           ['fidelityDividends', 'usDivTaxPaid'],
    stock_award:          ['salaryTaxedIncome', 'stockWithholdingPaid'],
    adeverinta:           ['salaryTaxedIncome', 'stockWithholdingPaid'],
    trade_confirmation:   ['fidelityGains', 'fidelityCost'],
    declaratie:           ['fidelityDividends', 'usDivTaxPaid', 'fidelityGains', 'fidelityCost',
                           'xtbDividends', 'roDivTaxPaid', 'roEurDividends', 'roEurDivTaxPaid',
                           'roUsdDividends', 'roUsdDivTaxPaid', 'roGainsCountries',
                           'roGainsLong', 'roGainsShort', 'roGainsTaxWithheld',
                           'roEurInterest', 'roEurInterestTaxPaid', 'roUsdInterest', 'roUsdInterestTaxPaid',
                           'interestIncome', 'interestTaxPaid', 'salaryTaxedIncome', 'stockWithholdingPaid'],
  };

  /** Return the manual-field keys for `type` that currently have user-entered values for `year`. */
  function detectManualConflict(year, type) {
    const yd = appData.years?.[year] || {};
    const keys = MANUAL_FIELDS_BY_UPLOAD[type] || [];
    const hits = [];
    for (const k of keys) {
      const v = yd[k];
      if (k === 'roGainsCountries') {
        if (Array.isArray(v) && v.length > 0) hits.push(k);
      } else if (v !== undefined && v !== '' && v !== null && v !== 0) {
        hits.push(k);
      }
    }
    return hits;
  }

  /** Send a PUT that clears the given manual fields (sets to empty / []). */
  async function clearManualFields(year, keys) {
    if (!keys || !keys.length) return;
    const payload = {};
    for (const k of keys) {
      payload[k] = k === 'roGainsCountries' ? [] : '';
    }
    await fetch(`/api/data/${year}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Given the dryRun upload response, derive the values the import would assign
   * to each manual field. Returns a map { fieldKey: { value, formatted } } —
   * undefined entries mean the field will simply be cleared.
   */
  function extractNewValuesFromDryRun(uploadType, parsed) {
    if (!parsed) return {};
    const out = {};
    const fmtRON = (v) => Math.round(v || 0).toLocaleString('ro-RO') + ' RON';
    const fmtUSDv = (v) => '$' + (v || 0).toFixed(2);

    if (uploadType === 'xtb_dividends') {
      if (parsed.dividends) {
        out.xtbDividends = { formatted: fmtRON(parsed.dividends.grossRON) };
        out.roDivTaxPaid = { formatted: fmtRON(parsed.dividends.taxWithheldRON) };
      }
      if (parsed.interest) {
        out.interestIncome = { formatted: fmtRON(parsed.interest.grossRON) };
        out.interestTaxPaid = { formatted: fmtRON(parsed.interest.taxWithheldRON) };
      }
      // EUR/USD manuals would just be cleared (the report aggregates everything in RON)
    } else if (uploadType === 'xtb_portfolio' || uploadType === 'tradeville_portfolio') {
      if (Array.isArray(parsed.countries) && parsed.countries.length > 0) {
        out.roGainsCountries = {
          formatted: parsed.countries.length + ' ' + I18n.t('import.overrideRows'),
          detail: parsed.countries.map(c => {
            const cur = c.currency || 'RON';
            const lg = c.longGainRON ?? c.longGain ?? 0;
            const ll = c.longLossRON ?? c.longLoss ?? 0;
            const sg = c.shortGainRON ?? c.shortGain ?? 0;
            const sl = c.shortLossRON ?? c.shortLoss ?? 0;
            const lt = c.longTaxRON ?? c.longTax ?? 0;
            const st = c.shortTaxRON ?? c.shortTax ?? 0;
            return `${c.country} [${cur}]: ≥1y +${Math.round(lg)} -${Math.round(ll)} (tax ${Math.round(lt)}), <1y +${Math.round(sg)} -${Math.round(sl)} (tax ${Math.round(st)})`;
          }).join('\n')
        };
      }
    } else if (uploadType === 'fidelity_statement' || uploadType === 'ms_statement') {
      if (parsed.dividendsYTD !== undefined && parsed.dividendsYTD > 0) {
        out.fidelityDividends = { formatted: fmtUSDv(parsed.dividendsYTD) };
      } else if (parsed.dividends && typeof parsed.dividends === 'number' && parsed.dividends > 0) {
        out.fidelityDividends = { formatted: fmtUSDv(parsed.dividends) };
      }
      if (parsed.taxWithheldYTD !== undefined && parsed.taxWithheldYTD > 0) {
        out.usDivTaxPaid = { formatted: fmtUSDv(parsed.taxWithheldYTD) };
      } else if (parsed.taxWithheld !== undefined && parsed.taxWithheld > 0) {
        out.usDivTaxPaid = { formatted: fmtUSDv(parsed.taxWithheld) };
      }
      if (parsed.sales?.length) {
        const totalProceeds = parsed.sales.reduce((s, x) => s + (x.netProceeds || x.saleProceeds || 0), 0);
        out.fidelityGains = { formatted: fmtUSDv(totalProceeds) + ' (' + parsed.sales.length + ' sales)' };
      }
    } else if (uploadType === 'form_1042s') {
      // Sum all forms in the batch: 1042-S PDFs commonly carry 2+ forms
      // (e.g. one for interest code 01, one for dividends code 06).
      const forms = (parsed && Array.isArray(parsed.forms)) ? parsed.forms : (parsed && parsed.grossIncomeUSD != null ? [parsed] : []);
      const totalGross = forms.reduce((s, f) => s + (Number(f.grossIncomeUSD) || 0), 0);
      const totalTax = forms.reduce((s, f) => s + (Number(f.federalTaxWithheldUSD) || 0), 0);
      if (totalGross) out.fidelityDividends = { formatted: fmtUSDv(totalGross) + (forms.length > 1 ? ` (${forms.length} forms)` : '') };
      if (totalTax) out.usDivTaxPaid = { formatted: fmtUSDv(totalTax) + (forms.length > 1 ? ` (${forms.length} forms)` : '') };
    } else if (uploadType === 'stock_award') {
      if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
        const totalBik = parsed.rows.reduce((s, r) => s + (parseFloat(r.stock_award_bik) || 0) + (parseFloat(r.espp_gain_bik) || 0), 0);
        const totalWh = parsed.rows.reduce((s, r) => s + (parseFloat(r.stock_withholding) || 0), 0);
        out.salaryTaxedIncome = { formatted: fmtRON(totalBik) + ' (' + parsed.rows.length + ' vests)' };
        out.stockWithholdingPaid = { formatted: fmtRON(totalWh) };
      }
    } else if (uploadType === 'trade_confirmation') {
      // single trade — append-style, but flagged as conflicting if user already had manual override
      if (parsed.transactionType !== 'purchase') {
        out.fidelityGains = { formatted: fmtUSDv(parsed.netProceeds || 0) + ' (1 sale)' };
      }
    }
    return out;
  }

  /** Format a current manual value for display in the diff dialog. */
  function formatCurrentManual(key, value) {
    if (value === undefined || value === '' || value === null) return '—';
    if (key === 'roGainsCountries') {
      if (!Array.isArray(value) || value.length === 0) return '—';
      return value.length + ' ' + I18n.t('import.overrideRows') + '\n' +
        value.map(c => {
          const cur = c.currency || 'RON';
          return `${c.country || '?'} [${cur}]: ≥1y +${c.longGain || 0}, <1y +${c.shortGain || 0}, tax ${c.taxWithheld || 0}`;
        }).join('\n');
    }
    if (key === 'fidelityDividends' || key === 'usDivTaxPaid' ||
        key === 'fidelityGains' || key === 'fidelityCost') {
      return '$' + (parseFloat(value) || 0).toFixed(2);
    }
    if (key === 'roEurDividends' || key === 'roEurDivTaxPaid' ||
        key === 'roEurInterest' || key === 'roEurInterestTaxPaid') {
      return (parseFloat(value) || 0).toFixed(2) + ' EUR';
    }
    if (key === 'roUsdDividends' || key === 'roUsdDivTaxPaid' ||
        key === 'roUsdInterest' || key === 'roUsdInterestTaxPaid') {
      return (parseFloat(value) || 0).toFixed(2) + ' USD';
    }
    // RON or generic numeric
    const num = parseFloat(value);
    if (!isNaN(num)) return Math.round(num).toLocaleString('ro-RO') + ' RON';
    return String(value);
  }

  /**
   * Open the "Reset year" confirmation modal. Fetches the server-side
   * manifest first so the user sees the exact list of files / data the
   * action will wipe, then requires typing the year before the destructive
   * button enables. On confirm, calls DELETE /api/year/:year and reloads
   * appData so every tab reflects the cleared state.
   */
  async function openResetYearModal(year) {
    const modal = document.getElementById('reset-year-modal');
    const body = document.getElementById('reset-year-modal-body');
    const confirmBtn = document.getElementById('reset-year-confirm-btn');
    const cancelBtn = document.getElementById('reset-year-cancel-btn');
    const closeBtn = document.getElementById('reset-year-modal-close');
    if (!modal || !body || !confirmBtn) return;

    body.innerHTML = `<p style="color:var(--text-muted)">${esc(I18n.t('resetYear.loading') || 'Loading…')}</p>`;
    confirmBtn.disabled = true;
    modal.classList.remove('hidden');

    let preview;
    try {
      const resp = await fetch(`/api/year/${year}/reset-preview`);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      preview = await resp.json();
    } catch (err) {
      body.innerHTML = `<p style="color:var(--danger)">${esc(I18n.t('resetYear.previewError') || 'Could not load reset preview.')} ${esc(err.message)}</p>`;
      return;
    }

    const t = (k, fallback) => I18n.t(k) || fallback;
    const hasAnything =
      (preview.rawFiles && preview.rawFiles.length) ||
      (preview.yearDataFields && preview.yearDataFields.length) ||
      preview.tradeCount > 0 ||
      preview.stockAwardsAssigned > 0 ||
      preview.ledgerVests > 0 ||
      preview.ledgerSales > 0;

    if (!hasAnything) {
      body.innerHTML = `
        <p>${esc(t('resetYear.nothingToReset', `Nothing to reset for year ${year}. No documents, trades, or manual entries are stored for this year.`).replace('{year}', year))}</p>
      `;
      confirmBtn.disabled = true;
      // Allow closing only.
      const cleanup = () => {
        modal.classList.add('hidden');
        cancelBtn.removeEventListener('click', cleanup);
        closeBtn.removeEventListener('click', cleanup);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
      };
      const onBackdrop = (e) => { if (e.target === modal) cleanup(); };
      const onKey = (e) => { if (e.key === 'Escape') cleanup(); };
      cancelBtn.addEventListener('click', cleanup);
      closeBtn.addEventListener('click', cleanup);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);
      return;
    }

    const rawList = (preview.rawFiles || []).map(f => `<li><code>${esc(f)}</code></li>`).join('');
    const fieldsList = (preview.yearDataFields || []).map(f => `<code style="background:var(--bg-secondary); padding:0.1rem 0.3rem; border-radius:3px; margin-right:0.3rem; display:inline-block; margin-bottom:0.2rem;">${esc(f)}</code>`).join('');

    body.innerHTML = `
      <p style="margin-top:0;">${esc(t('resetYear.intro', `You are about to permanently wipe everything stored for year ${year}. This cannot be undone.`).replace('{year}', year))}</p>

      <h4 style="margin:1rem 0 0.5rem; font-size:0.9rem;">${esc(t('resetYear.willDelete', 'Will be deleted:'))}</h4>
      <ul style="margin:0; padding-left:1.2rem; font-size:0.85rem;">
        ${(preview.rawFiles || []).length > 0 ? `<li>${esc(t('resetYear.rawFiles', '{n} raw document file(s):').replace('{n}', preview.rawFiles.length))}<ul style="margin-top:0.3rem;">${rawList}</ul></li>` : ''}
        ${(preview.yearDataFields || []).length > 0 ? `<li>${esc(t('resetYear.yearDataFields', '{n} parsed/manual field(s):').replace('{n}', preview.yearDataFields.length))}<div style="margin-top:0.3rem;">${fieldsList}</div></li>` : ''}
        ${preview.tradeCount > 0 ? `<li>${esc(t('resetYear.trades', '{n} trade record(s)').replace('{n}', preview.tradeCount))}</li>` : ''}
        ${preview.ledgerVests > 0 ? `<li>${esc(t('resetYear.ledgerVests', '{n} stock-vest ledger entry/entries').replace('{n}', preview.ledgerVests))}</li>` : ''}
        ${preview.ledgerSales > 0 ? `<li>${esc(t('resetYear.ledgerSales', '{n} sale ledger entry/entries').replace('{n}', preview.ledgerSales))}</li>` : ''}
        ${preview.stockAwardsAssigned > 0 ? `<li>${esc(t('resetYear.stockAwards', '{n} stock award(s) will be unassigned from this year (records kept for other years).').replace('{n}', preview.stockAwardsAssigned))}</li>` : ''}
      </ul>

      <p style="margin:1rem 0 0.5rem; font-size:0.85rem; color:var(--text-muted);">${esc(t('resetYear.preserved', 'Stock award records, ledger entries from other years, BNR rates, and CASS thresholds are NOT affected.'))}</p>

      <p style="margin:1rem 0 0.3rem; font-size:0.9rem;"><strong>${esc(t('resetYear.typeToConfirm', 'Type {year} to confirm:').replace('{year}', year))}</strong></p>
      <input type="text" id="reset-year-confirm-input" autocomplete="off" style="width:100%; padding:0.5rem; font-size:1rem; border:1px solid var(--border); border-radius:var(--radius); background:var(--bg-primary); color:var(--text-primary);">
    `;

    const input = document.getElementById('reset-year-confirm-input');
    const updateBtn = () => {
      confirmBtn.disabled = (input.value || '').trim() !== String(year);
    };
    if (input) {
      input.addEventListener('input', updateBtn);
      setTimeout(() => input.focus(), 50);
    }
    updateBtn();

    const cleanup = (result) => {
      modal.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      if (input) input.removeEventListener('input', updateBtn);
      if (result === 'confirm') performResetYear(year);
    };
    const onConfirm = () => { if (!confirmBtn.disabled) cleanup('confirm'); };
    const onCancel = () => cleanup('cancel');
    const onBackdrop = (e) => { if (e.target === modal) cleanup('cancel'); };
    const onKey = (e) => { if (e.key === 'Escape') cleanup('cancel'); };
    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  }

  /**
   * Execute the year reset on the server and refresh local app state.
   */
  async function performResetYear(year) {
    try {
      const resp = await fetch(`/api/year/${year}`, { method: 'DELETE' });
      if (!resp.ok) {
        const errPayload = await resp.json().catch(() => ({}));
        throw new Error(errPayload.error || `HTTP ${resp.status}`);
      }
      const summary = await resp.json();
      // Invalidate the compute cache and any DUF picks for the year so the UI
      // re-renders cleanly.
      _computeDataVersion++;
      if (typeof _dufImports !== 'undefined' && _dufImports.delete) _dufImports.delete(year);
      if (typeof _dufPicks !== 'undefined' && _dufPicks.delete) _dufPicks.delete(year);
      if (typeof _d205Entries !== 'undefined' && _d205Entries.delete) _d205Entries.delete(year);

      // Re-fetch the global app state so every tab reflects the wipe.
      try {
        const dataResp = await fetch('/api/data');
        if (dataResp.ok) {
          appData = await dataResp.json();
        }
      } catch (_) { /* best-effort refresh */ }

      // Reload stock awards (since some may now be unassigned).
      try {
        const swResp = await fetch('/api/stock-awards');
        if (swResp.ok) window._cachedStockAwards = await swResp.json();
      } catch (_) { /* best-effort */ }

      // Re-render the form for the cleared year and refresh tabs.
      try { populateForm(); } catch (_) {}
      try { if (typeof renderTaxes === 'function') renderTaxes(); } catch (_) {}
      try { if (typeof renderImportsPanel === 'function') renderImportsPanel(detectActiveImports(year)); } catch (_) {}

      const parts = [];
      if (summary.rawFilesDeleted) parts.push(`${summary.rawFilesDeleted} ${I18n.t('resetYear.summaryRawFiles') || 'fișiere'}`);
      if (summary.yearDataDeleted) parts.push(I18n.t('resetYear.summaryYearData') || 'date an');
      if (summary.tradesDeleted) parts.push(`${summary.tradesDeleted} ${I18n.t('resetYear.summaryTrades') || 'tranzacții'}`);
      if (summary.vestsDeleted || summary.salesDeleted) parts.push(`${summary.vestsDeleted + summary.salesDeleted} ${I18n.t('resetYear.summaryLedger') || 'ledger'}`);
      if (summary.awardsUnassigned) parts.push(`${summary.awardsUnassigned} ${I18n.t('resetYear.summaryAwards') || 'awards'}`);
      const msg = (I18n.t('resetYear.success') || 'Year {year} reset.').replace('{year}', year)
        + (parts.length ? ' ' + parts.join(', ') + '.' : '');
      alert(msg);
    } catch (err) {
      alert((I18n.t('resetYear.error') || 'Reset failed:') + ' ' + err.message);
    }
  }

  /**
   * Show the override-confirmation modal with a diff table.
   * Returns a promise that resolves to true (confirm) or false (cancel).
   */
  function showOverrideConfirm(year, uploadType, conflictingFields, newValuesMap) {
    const modal = document.getElementById('override-modal');
    const body = document.getElementById('override-modal-body');
    const confirmBtn = document.getElementById('override-confirm-btn');
    const cancelBtn = document.getElementById('override-cancel-btn');
    const closeBtn = document.getElementById('override-modal-close');

    const yd = appData.years?.[year] || {};
    const rows = conflictingFields.map(k => {
      const label = I18n.t('import.manualFieldLabels.' + k) || k;
      const currentRaw = yd[k];
      const current = esc(formatCurrentManual(k, currentRaw)).replace(/\n/g, '<br>');
      const newEntry = newValuesMap[k];
      let newCell;
      if (newEntry === undefined) {
        // Field will be cleared, not replaced with anything specific
        newCell = `<em style="color:var(--text-muted)">${esc(I18n.t('import.overrideWillClear'))}</em>`;
      } else {
        const main = esc(newEntry.formatted || '').replace(/\n/g, '<br>');
        const detail = newEntry.detail
          ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem;white-space:pre-wrap;">${esc(newEntry.detail)}</div>`
          : '';
        newCell = main + detail;
      }
      return `<tr>
        <td style="padding:0.5rem; border-bottom:1px solid var(--border); vertical-align:top;"><strong>${esc(label)}</strong></td>
        <td style="padding:0.5rem; border-bottom:1px solid var(--border); vertical-align:top; color:var(--danger);">${current}</td>
        <td style="padding:0.5rem; border-bottom:1px solid var(--border); vertical-align:top; color:var(--success);">${newCell}</td>
      </tr>`;
    }).join('');

    body.innerHTML = `
      <p style="margin-top:0;">${esc(I18n.t('import.overrideIntro', { year }))}</p>
      <table style="width:100%; border-collapse:collapse; margin-top:0.5rem; font-size:0.9rem;">
        <thead>
          <tr>
            <th style="text-align:left; padding:0.5rem; border-bottom:2px solid var(--border);">${esc(I18n.t('import.overrideColField'))}</th>
            <th style="text-align:left; padding:0.5rem; border-bottom:2px solid var(--border); color:var(--danger);">${esc(I18n.t('import.overrideColCurrent'))}</th>
            <th style="text-align:left; padding:0.5rem; border-bottom:2px solid var(--border); color:var(--success);">${esc(I18n.t('import.overrideColNew'))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">${esc(I18n.t('import.overrideFooter'))}</p>
    `;

    modal.classList.remove('hidden');

    return new Promise((resolve) => {
      const cleanup = (result) => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };
      const onConfirm = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };
      const onKey = (e) => { if (e.key === 'Escape') cleanup(false); };
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      closeBtn.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);
    });
  }

  async function handleUpload(e) {
    e.preventDefault();
    const yearVal = document.getElementById('upload-year').value;
    const typeVal = document.getElementById('upload-type').value;
    const files = document.getElementById('upload-file').files;

    // Pre-flight override check: only meaningful for single-file uploads
    // (multi-file uploads run sequentially and conflict per file is ambiguous).
    let conflictingFields = [];
    if (files.length === 1) {
      conflictingFields = detectManualConflict(parseInt(yearVal, 10), typeVal);
      if (conflictingFields.length > 0) {
        // Dry-run upload first to obtain the parsed values from the document
        const dryForm = new FormData();
        dryForm.append('year', yearVal);
        dryForm.append('type', typeVal);
        dryForm.append('file', files[0]);
        const submitBtn = document.getElementById('upload-submit-btn');
        const origLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = I18n.t('import.overrideAnalyzing');
        let dryResult;
        try {
          const dryResp = await fetch('/api/upload?dryRun=true', { method: 'POST', body: dryForm });
          dryResult = await dryResp.json();
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = origLabel;
          showToast(I18n.t('import.error') + ': ' + err.message, 'error');
          return;
        }
        submitBtn.textContent = origLabel;
        submitBtn.disabled = false;

        if (!dryResult || !dryResult.success) {
          // Dry run failed (low OCR quality, parse error). Fall back to plain warning.
          const fallbackMsg = I18n.t('import.overrideManualWarn', {
            year: yearVal,
            fields: conflictingFields
              .map(k => '• ' + (I18n.t('import.manualFieldLabels.' + k) || k))
              .join('\n')
          });
          if (!confirm(fallbackMsg)) return;
        } else {
          const newValuesMap = extractNewValuesFromDryRun(typeVal, dryResult.parsed);
          const ok = await showOverrideConfirm(parseInt(yearVal, 10), typeVal, conflictingFields, newValuesMap);
          if (!ok) return;
        }
      }
    }

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
        const timeInfo = ` <span style="color:var(--text-muted);font-size:0.8rem;">(${_elapsed})</span>`;
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
          // result.parsed is now {forms: [...]} (refactored to support PDFs that
          // bundle multiple distinct 1042-S forms — one per income code).
          const forms = (result.parsed && result.parsed.forms) || (result.forms || []);
          if (forms.length === 0) {
            resultHtml += `<p style="color:var(--warning);margin-top:0.5rem;">⚠ Nu am extras nicio formă 1042-S din PDF.</p>`;
          } else {
            const fmtN = (n) => Number(n || 0).toFixed(2);
            resultHtml += `<div style="margin-top:0.5rem;">
              <p><strong>Form 1042-S</strong> — ${forms.length} ${forms.length === 1 ? 'formă' : 'forme'} extrase${result.duplicates ? ` (${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} ignorate)` : ''}</p>`;
            for (const p of forms) {
              resultHtml += `<div style="margin-left:0.5rem;padding:0.4rem 0.5rem;border-left:2px solid var(--border);margin-bottom:0.35rem;">
                <p style="margin:0;"><strong>${esc(p.incomeType)}</strong> (code ${esc(p.incomeCode)}) — UID <code>${esc(p.uniqueFormId || '?')}</code></p>
                <p style="margin:0;font-size:0.9em;">Gross Income: <strong>$${fmtN(p.grossIncomeUSD)}</strong> · Tax Rate: ${p.taxRate}% · Tax Withheld: <strong>$${fmtN(p.federalTaxWithheldUSD)}</strong></p>
                <p style="margin:0;font-size:0.85em;color:var(--text-muted);">Agent: ${esc(p.withholdingAgent)} · Recipient: ${esc(p.recipientName)} (${esc(p.recipientCountry)})</p>
              </div>`;
            }
            resultHtml += `</div>`;
          }
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
        } else if (result.type === 'xtb_dividends') {
          const p = result.parsed || {};
          const parts = [];
          if (p.dividends?.grossRON) {
            parts.push(`${I18n.t('income.dividends')}: ${fmt(p.dividends.grossRON)} RON (${I18n.t('income.taxRON')}: ${fmt(p.dividends.taxWithheldRON)} RON)`);
          }
          if (p.interest?.grossRON) {
            parts.push(`${I18n.t('income.interestIncome')}: ${fmt(p.interest.grossRON)} RON (${I18n.t('income.taxRON')}: ${fmt(p.interest.taxWithheldRON)} RON)`);
          }
          if ((p.dividendRows || []).length > 0) parts.push(`${p.dividendRows.length} ${I18n.t('misc.rows') || 'rows'}`);
          resultHtml += parts.length > 0 ? `<p style="margin-top:0.3rem;color:var(--text-secondary);font-size:0.85rem;">${parts.join(' | ')}</p>` : '';
        } else if (result.type === 'xtb_portfolio' || result.type === 'tradeville_portfolio') {
          const p = result.parsed || {};
          const parts = [];
          if (Array.isArray(p.countries) && p.countries.length > 0) {
            const countryList = p.countries.map(c => `${c.country}${c.currency && c.currency !== 'RON' ? ' [' + c.currency + ']' : ''}`).join(', ');
            parts.push(`${p.countries.length} ${I18n.t('input.country').toLowerCase()}: ${countryList}`);
          }
          if (p.longTerm) parts.push(`≥1yr: +${fmt(p.longTerm.gainRON || 0)} / -${fmt(p.longTerm.lossRON || 0)} RON`);
          if (p.shortTerm) parts.push(`<1yr: +${fmt(p.shortTerm.gainRON || 0)} / -${fmt(p.shortTerm.lossRON || 0)} RON`);
          if (p.totalTaxWithheldRON) parts.push(`${I18n.t('income.taxRON')}: ${fmt(p.totalTaxWithheldRON)} RON`);
          resultHtml += parts.length > 0 ? `<p style="margin-top:0.3rem;color:var(--text-secondary);font-size:0.85rem;">${parts.join(' | ')}</p>` : '';
        } else {
          // Generic: show a compact summary, filtering out object/array values
          const keys = Object.keys(result.parsed || {}).filter(k => {
            if (k === 'year' || k === 'source') return false;
            const v = result.parsed[k];
            return v != null && typeof v !== 'object';
          });
          if (keys.length > 0 && keys.length <= 6) {
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
          if (resultSpan) resultSpan.textContent = `${I18n.t('import.success')} (${_elapsed})`;
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
          if (resultSpan) resultSpan.textContent = I18n.t('import.ocrLowQuality');
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
        // Clear manual fields that this upload type overrides, so the
        // import becomes the authoritative source going forward.
        if (conflictingFields.length > 0) {
          await clearManualFields(parseInt(yearVal, 10), conflictingFields);
        }
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

    const dlLabel = I18n.t('update.downloading', { version: data.latestVersion });
    const dlCompleteLabel = I18n.t('update.complete') || 'complete';
    downloadText.textContent = dlLabel;

    // Animate progress bar (indeterminate-ish since we don't have streaming progress)
    let dlPercent = 0;
    let progressInterval = setInterval(() => {
      if (dlPercent < 90) {
        dlPercent += 2;
        progressFill.style.width = dlPercent + '%';
        downloadText.textContent = dlLabel + ' ' + dlPercent + '% ' + dlCompleteLabel;
      }
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
      downloadText.textContent = dlLabel + ' 100% ' + dlCompleteLabel;

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

      // Animate install progress bar + timer + percentage text
      const installProgressFill = document.getElementById('update-install-progress-fill');
      const installTimer = document.getElementById('update-install-timer');
      const installingText = document.getElementById('update-installing-text');
      const installFullLabel = I18n.t('update.installing');
      const installCompleteLabel = I18n.t('update.complete') || 'complete';
      let installPercent = 0;
      installingText.textContent = installFullLabel + ' 0% ' + installCompleteLabel;
      const installStart = performance.now();
      const installInterval = setInterval(() => {
        // Fast ramp: +5% up to 60%, then +2% up to 85%, then +1% up to 95%
        if (installPercent < 60) installPercent += 5;
        else if (installPercent < 85) installPercent += 2;
        else if (installPercent < 95) installPercent += 1;
        installProgressFill.style.width = installPercent + '%';
        installingText.textContent = installFullLabel + ' ' + installPercent + '% ' + installCompleteLabel;
        const elapsed = performance.now() - installStart;
        const mins = Math.floor(elapsed / 60000);
        const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
        installTimer.textContent = mins + ':' + secs;
      }, 300);

      const instRes = await fetch('/api/update/install', { method: 'POST' });
      clearInterval(installInterval);
      const instData = await instRes.json();

      if (!instRes.ok || !instData.success) {
        throw new Error(instData.error || 'Install failed');
      }

      installProgressFill.style.width = '100%';
      installingText.textContent = installFullLabel + ' 100% ' + installCompleteLabel;

      // Show success and poll for server restart
      stepInstalling.classList.add('hidden');
      stepResult.classList.remove('hidden');
      resultIcon.textContent = ''; // cleared for CSS circle spinner
      resultIcon.classList.add('spinner');
      resultText.textContent = I18n.t('update.restarting');

      // Poll until new server is up
      const pollForRestart = setInterval(async () => {
        try {
          const r = await fetch('/api/version', { cache: 'no-store' });
          if (r.ok) {
            clearInterval(pollForRestart);
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
  document.addEventListener('DOMContentLoaded', () => {
    // Tear down the boot splash once init() resolves (or fails). The fade-out
    // is CSS-driven; we add .hidden first, then remove the node after the
    // transition so screen readers don't see two competing trees.
    const dismissBootSplash = () => {
      const el = document.getElementById('boot-splash');
      if (!el) return;
      el.classList.add('hidden');
      setTimeout(() => el.remove(), 300);
    };
    // Safety net: even if something throws inside init() before render() lands,
    // never leave the splash up for more than 15 seconds.
    const splashFallbackTimer = setTimeout(dismissBootSplash, 15000);
    Promise.resolve(init()).finally(() => {
      clearTimeout(splashFallbackTimer);
      dismissBootSplash();
    });
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

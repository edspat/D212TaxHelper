# D212 Tax Helper - Changelog

## v2.1.0 (2026-04-07)

### New Features
- **Morgan Stanley Stock Plan Statement parser** — yearly statement with sales, RSU releases, dividends, IRS withholding
- **Broker selector** in Add Data tab — US broker (Fidelity / Morgan Stanley) and Romania broker (XTB)
- **Dynamic broker labels** — Income Details and Tax Calculation show the actual broker used (auto-detected from uploads or manual selection)
- **BNR official exchange rates** hardcoded for 2019-2025 (Serii anuale, valori medii)
- **Minimum salary data** for 2019-2026

### Fixes
- **Tax algorithm**: stock withholding deducted from capital gains only (not dividends), per Think People methodology
- **CASS base**: uses net income after stock withholding deduction
- **Decimal formatting**: small USD amounts (dividends, tax) now display with 2 decimal places
- **Floating point fix**: total shares no longer shows values like `9.280999999999999`
- **trades.json robustness**: defensive parsing prevents crash on malformed data
- **Error handler**: fixed `ReferenceError: type is not defined` in upload error path

### Changes
- Removed static "(Fidelity / Morgan Stanley)" text from all labels — now dynamic
- Year selector shows all years from exchange rates (2019-2025)
- Start.bat launches server minimized and exits immediately
- 2025 BNR exchange rate updated to official 4.4705

---

## v2.0.0 (2026-03-29)

### Major
- Renamed app from "ANAF Financial Dashboard" to "D212 Tax Helper"
- Redesigned Tax Calculation tab with 3 sections: Earned / Already Paid / Still to Pay
- Added 2026 tax rates support (16% income tax, 3%/6% XTB capital gains)
- CASS calculation now uses net dividends and net interest (per case study validation)
- ESPP purchase cost deduction added to capital gains calculation
- Chapter II (CASS option) marked as optional for D212/2025+, with threshold check
- Form 1042-S (IRS) import with dedup by unique form identifier
- 1042-S takes precedence over Investment Report for dividend data

### Features
- D212 filing deadline field (date picker, per year, editable)
- Deadline displayed in tax table and CASS section
- Capital gains calculation method reference table (4 scenarios)
- Detailed dividend calculation steps in D212 Helper
- CASS income types list, payment deadline, CAS not applicable notice
- Gambling income parsing from ANAF income certificate (adeverinta)
- OCR fallback for scanned/image-based PDFs
- OCR quality detection with manual entry prompt
- File logging system (logs/ folder with daily log files)
- Configurable XTB tax rates (read from saved taxRates)
- Form grid layouts (2-col / 3-col responsive fieldsets)
- Save buttons show selected year
- Year banner outside cards as section header
- Sticky footer matching header style
- Scroll-to-top button positioned above footer
- App version in footer with changelog

### Improvements
- Chart.js uses .update() instead of destroy/recreate (performance)
- Chart colors read from CSS variables (theme consistency)
- computeYearData() memoized with version-based cache invalidation
- Number formatting locale-aware (ro-RO / en-US based on language)
- Resize handler debounced (150ms) to prevent jank
- Form controls disabled during file upload processing
- Toast notification on data load failure
- Server restart spawns new process before exiting (self-healing)
- PORT configurable via environment variable

### Accessibility
- Hamburger menu button: aria-label added
- Chart canvases: aria-label added
- Header selects: sr-only labels for screen readers
- Navigation buttons: focus-visible outline styles
- .sr-only utility class added

### i18n
- All 321 keys balanced between EN and RO
- Footer app name translatable (D212 Tax Helper / D212 Asistent Fiscal)

---

## v1.0.0 (2026-03-24)

### Initial Release
- Dashboard with 4 summary cards and 4 charts
- Income Details tab (Fidelity dividends, capital gains, XTB trades)
- Tax Calculation tab with CASS tiered system (2023-2025)
- D212 Form Helper (Chapter I: foreign income, XTB, CASS, summary)
- D212 Chapter II: CASS payment option
- Add Data tab with manual input forms
- Import Document tab (PDF/image upload with OCR)
- Raw Data tab (view/edit/purge extracted text)
- Document types: declaratie, investment, adeverinta, stock_award, trade_confirmation, xtb_dividends, xtb_portfolio, fidelity_statement
- Trade confirmation dedup by ref number
- Stock withholding from payslip documents
- Bilingual support (RO/EN) with i18n system
- Dark theme with CSS variables
- Responsive design with hamburger menu
- Year comparison charts
- Exchange rate chart (BNR data)
- Portable version with bundled Node.js

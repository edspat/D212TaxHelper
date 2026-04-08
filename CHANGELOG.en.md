# D212 Tax Helper - Changelog

## v3.1.2 (2026-04-09)

### Improvements
- **Progress bar on Upload button** — green gradient fills left-to-right during document processing; for multiple files shows per-file progress
- **Progress bar on Upgrade/Downgrade buttons** — shows "Installing... X%" with real-time progress from disk usage, "Removing... X%" with reverse animation
- **Button width locked** during progress animations to prevent layout jumps
- **setup_paddleocr.js fix** — `stdio: 'inherit'` replaced with explicit pipe to prevent child process hang when called via server API

---

## v3.1.1 (2026-04-09)

### Fixes
- **Changelog links in Guide** — clicking CHANGELOG.en.md / CHANGELOG.ro.md links in the Guide now opens a stacked Changelog modal instead of navigating away
- **Portable build: README.ro.md** — Romanian README was missing from portable builds
- **Portable build: Upgrade-to-Full.bat** — now included in both Lite and Full builds (needed after downgrade)
- **Portable build: generated README** — lists Upgrade-to-Full.bat and Downgrade-to-Lite.bat, mentions in-app upgrade button

---

## v3.1.0 (2026-04-09)

### OCR Engine Management
- **Upgrade to Full / Downgrade to Lite buttons** — switch between PaddleOCR and Tesseract.js directly from the Import tab
- **In-app PaddleOCR installation** — "Upgrade to Full" button downloads Python 3.12 + PaddleOCR (~1.7 GB) without leaving the app
- **In-app PaddleOCR removal** — "Downgrade to Lite" button deletes the python/ folder to free disk space
- **Real disk usage** — downgrade hint shows actual PaddleOCR folder size (not estimated)
- **Info hint** — clickable ℹ message opens the User Guide for upgrade/downgrade details
- OCR badge, button, and hint update live after install/remove (no restart needed)
- OCR detection cache fix — upgrade no longer silently fails due to stale detection

### Raw Data Improvements
- **Bulk delete** — checkboxes on each file with "Select All" and "Delete Selected" toolbar
- Separate confirmation dialogs for partial vs. full deletion

### Document Viewer Improvements
- **Back to Top button** — ↑ button in Changelog, README, and Guide modals (appears on scroll)
- **Anchor links work inside modals** — Table of Contents links scroll within the modal instead of navigating away
- **Em dash handling** — headings with — characters generate correct anchor IDs
- Guide/README links with `#section` anchors now scroll smoothly to the target heading

### Bug Fixes
- OCR badge and hints translate correctly on language switch
- Fixed stale PaddleOCR detection cache preventing upgrade/downgrade

---

## v3.0.1 (2026-04-08)

### Improvements
- **Bulk delete in Raw Data** — checkboxes on each file row with "Select All" and "Delete Selected" toolbar
- Separate confirmation dialogs for partial vs. full deletion
- Bilingual support (EN/RO) for all new bulk delete strings

---

## v3.0.0 (2026-04-08)

### New Feature: PaddleOCR Integration
- **PaddleOCR (PP-StructureV3)** — replaced Tesseract.js as primary OCR engine for superior text extraction from scanned documents
- **Python subprocess architecture** — PaddleOCR runs via bundled Python Embeddable 3.12, called from Node.js via `child_process`
- **Tradeville Portfolio extraction** — scanned Fișă de Portofoliu PDFs now parse correctly (was previously impossible with Tesseract)
- **OCR engine auto-detection** — server detects PaddleOCR availability at startup, falls back to Tesseract.js automatically
- **OCR status badge** — Import Document tab shows which OCR engine is active (green = PaddleOCR, yellow = Tesseract)
- **OCR engine in results** — upload responses include which engine processed the document
- **Two portable builds** — `npm run build` (Lite ~174 MB, Tesseract only) and `npm run build:full` (Full ~1.9 GB, with PaddleOCR)

### Technical Details
- `ocr_service.py` — Python CLI service using PaddleOCR 3.x `predict()` API
- `setup_paddleocr.js` — downloads Python Embeddable + installs PaddleOCR packages
- PaddlePaddle pinned to v3.0.0 (v3.3.1 has OneDNN crash on Windows)
- `paddlex[ocr]` extra required for full OCR pipeline
- Multer temp files renamed with correct extension (.pdf/.jpg) for PaddleOCR format detection
- Self-validated document types skip generic OCR quality gate
- Environment: `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK`, `GLOG_minloglevel` suppress verbose logs
- `GET /api/ocr-status` — new endpoint for frontend OCR engine detection

---

## v2.4.0 (2026-04-08)

### New Features
- **Tradeville Portfolio parser** — Romania (Tradeville) - Fișă de Portofoliu (Capital Gains)
- **Per-country RO gains input** — Add Data tab: dynamic rows for capital gains per country (40 countries)
- **Free-text broker input** — type any broker name or pick from suggestions
- **Raw Data file list** — table with name, upload date, View/Purge buttons (replaces dropdown)
- **ANAF D212 link** — button on Tax Calculation opens anaf.ro/declaratii/duf in new window

### Fixes
- Purge correctly removes only source-specific trades (MS/Fidelity/trade confirmation)
- Purge recalculates trade aggregates after deletion
- US Stock Sales "Paid" column = 0 (stock withholding is deduction, not tax paid)
- Tradeville OCR: shows bilingual warning when table can't be parsed, suggests manual entry
- Raw Data API returns file metadata (date, size)
- Document type labels: "Portfolio Statement" in English for XTB and Tradeville

---

## v2.3.0 (2026-04-08)

### Calculation Fixes (ANAF Compliance Audit)
- US dividend tax: correctly computes credit fiscal difference for 2026+ (RO 16% - US 10% = 6% to pay)
- Interest tax rate: dynamic 10%/16% based on year (was hardcoded 10%)
- RO broker capital gains rates: dynamic 1%/3% or 3%/6% based on year in all tables
- CASS base: consistent net treatment for all income types including RO capital gains
- Stock withholding variable: consistent usage across tax calculation and display
- D212 summary: no longer double-counts interest tax or shows mismatched totals
- RON amounts: rounded to integers per ANAF requirements (lei întregi)

### D212 Form Helper
- Added ESPP cost and credit fiscal detail to foreign income section
- Added Romania broker capital gains (≥1yr / <1yr) with tax withheld detail
- Added Romania broker dividends with tax withheld detail
- New "Venituri cu reținere la sursă" section for CASS (maps directly to ANAF form)
- Section headers correlate with ANAF D212 form buttons

### UI Improvements
- ANAF D212 form link button — opens https://www.anaf.ro/declaratii/duf in a new window
- Tax Calculation grouped into US/Romania subsections with subtotals
- Document type dropdown reordered: US brokers → RO broker → ANAF/Tax
- Upload button no longer stuck on "Processing" when render errors occur
- Exchange rate chart only shown when actual financial data exists

### Bug Fixes
- Purge now fully deletes 1042-S data (was broken due to key mismatch)
- Purge cleans up fidelity/MS/trade trades from trades.json
- Empty year objects removed after purge
- stockWithholding temporal dead zone error fixed
- Removed obsolete migration scripts

---

## v2.2.0 (2026-04-07)

### Upgrades
- **Express 5.2.1** — upgraded from v4 (improved async error handling, Brotli encoding support)
- **Tesseract.js 7.0.0** — upgraded from v5 (15-35% faster OCR via relaxedsimd WASM build)
- **Multer 2.1.1** — upgraded from v1 (resolved deprecation warning)
- Removed unused `xlsx` package (resolved high severity vulnerability)
- Updated `path-to-regexp` (resolved high severity vulnerability)
- **0 vulnerabilities, 0 deprecations, 0 outdated packages**

### Fixes
- OCR crash prevention — server no longer crashes on image-based PDFs
- Hidden server window — Start.bat runs invisibly in background
- Exchange rate chart hidden when no data
- LICENSE included in portable build

---

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

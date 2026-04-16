# D212 Tax Helper - Changelog

## v1.5.0 (2026-04-16)

### Performance
- **Gzip compression** — all HTTP responses now compressed via `compression` middleware, reducing page payload by ~60-70%
- **Cached Python directory size** — `/api/ocr-status` no longer walks 31,000+ files on every call; computed once at startup and cached
- **Static asset caching** — JS, CSS, and HTML files served with `Cache-Control: max-age=1h`, eliminating redundant downloads on page refresh
- **Non-blocking Chart.js** — CDN script tag changed from render-blocking to `defer`, allowing the page to render faster
- **Removed duplicate API call** — `/api/stock-withholding` was fetched twice per page load (in `loadAllData` and `render`); now fetched once
- **Parallel init loading** — `loadAllData()` and `/api/version` now fetched concurrently instead of sequentially

### Auto-Update Checker
- **In-app self-update** — on startup, the app checks GitHub for new releases and shows a banner; clicking “Update” downloads the latest ZIP, prompts for confirmation, then applies the update in-place while preserving all user data (data/, uploads/, python/)
- **Automatic server restart** — after a successful update, the server restarts automatically and the page reloads
- **Persistent banner** — dismissing the update banner only hides it for the current session; it reappears on every startup until the update is installed
- **Error handling** — if the update fails, the user sees a clear error message and existing files remain untouched

### PaddleOCR Upgrade UX
- **Per-package progress** — `setup_paddleocr.js` now installs packages one by one with `[1/7] Installing paddlepaddle==3.0.0 ...` progress messages instead of a single silent bulk install
- **No more stuck at 99%** — pip progress bar disabled (`--progress-bar off`) during upgrade to prevent misleading frozen display
- **Increased timeout** — 15 minutes per package (up from 10 minutes total) for slower connections

---

## v1.4.6 (2026-04-16)

### ESPP & Stock Award Integration
- **ESPP purchase support** — Trade Confirmation parser now detects `YOU PURCHASED` (ESPP) alongside `YOU SOLD`, extracting Market Value, Accumulated Contributions, ESPP Gain, and Offering Period
- **ESPP cost basis FIFO** — ESPP purchase cost ($contributions) is automatically tracked via FIFO across years and deducted from sale proceeds in USD before RON conversion, matching ANAF D-212 formula
- **Separate ESPP/Sales tables** — US stock transactions split into two tables: "Achiziții Acțiuni ESPP SUA" (purchases) and "Vânzări Acțiuni SUA" (sales), each with own totals
- **ESPP consumption tracking** — tooltip on US gains row shows which ESPP lots were consumed (shares + cost)

### Stock Award BIK Deduction
- **"Venit impozitat deja ca salariu" (BIK)** — stock_award_bik values from imported Stock Award documents are summed and deducted from capital gains per ANAF D-212 rules: `Taxable = Sale_RON - Cost_RON - BIK_RON`
- **Multi-year upload** — multiple Stock Award documents from different years can be uploaded under a single tax year to maximize BIK deduction (e.g., upload 2019-2023 docs under year 2023 to reduce CASS threshold)
- **Year-scoped display** — BIK deduction and withholding table only appear for years where Stock Award documents were uploaded
- **Manual BIK override** — new "Venit impozitat deja ca salariu (RON)" field in Add Data form for entering Think People / tax advisor values
- **Separate deduction row** in income details table with green styling and hover tooltip showing taxable amount after BIK

### Stock Award Parser Improvements
- **Multi-format date support** — parser handles `DD-Mon-YY` (2019-2023), `DD-Mon-YYYY` (2025), and `DD.MM.YYYY` (2024) date formats
- **Merged header fix** — handles PDF extraction where column headers merge (e.g., `espp_gain_bikstock_award_bik`)
- **Append mode** — uploading additional Stock Award documents appends entries with deduplication (no overwrite)
- **Purge clears all** — deleting a stock_award raw file removes ALL stock award entries (supports multi-year uploads)

### Persistent Ledger
- **ledger.json** — new persistent financial entry tracking with FIFO cost basis allocation
- **Auto-migration** — existing trades and stock awards are automatically migrated to ledger on first server start
- **Soft-delete on purge** — deleted entries preserved for audit trail
- **API endpoints** — `/api/ledger/allocations`, `/api/ledger/summary`, `POST /api/ledger/migrate`

### Document Type Changes
- **Removed** "SUA (Fidelity) - Extras de Cont (Raport Periodic)" (fidelity_statement) integration
- **Renamed** Trade Confirmation to "Confirmare Tranzacție (Vânzare / Achiziție)" reflecting both sale and purchase support

### Dashboard & Charts
- **Removed** "Impozit de Plată" tile (redundant)
- **Charts follow selected year** — all charts (Total Impozite, Cursuri de Schimb, Salariu Minim) now show years up to the selected year, matching Comparație pe Ani behavior
- **Year-specific data isolation** — charts compute taxes independently per year without cross-year data pollution
- **No-cache headers** for locale JSON files to prevent stale translations after updates

### Display Improvements
- **Normalized dates** — all dates displayed as `YYYY.MM.DD` format throughout the app
- **Withholding table** shows both BIK and Withholding columns with date, sorted chronologically
- **Income table totals** computed from actual rows (including deductions with +/- math)

### Bug Fixes
- **Stock withholding double-counting** — fixed duplicate `total += val` in withholding API
- **Stale data on purge** — purging files now properly clears all related data from parsed_data.json, trades.json, stock_awards.json, and ledger.json
- **Trade confirmation purge** — fixed variable name bug (`filename` → `safeName`) in ledger purge call
- **CASS calculation** — BIK deduction correctly reduces CASS base; withholding no longer incorrectly subtracted from capital gains base

---

## v1.4.5 (2026-04-15)

### Tax Compliance Fixes
- **ANAF D-212 fiscal credit** — when importing ANAF declarations, the app now correctly uses `difImpozitDatorat` (actual tax to pay after credit) instead of `impozitDatoratRO` (gross tax before credit). For US dividends with double taxation treaty, this means dividend tax shows as **0** when the US-withheld tax covers the Romanian tax obligation.
- **Credit fiscal & foreign tax** — new fields `creditFiscalRON` and `difImpozitRON` extracted from both XFA and rendered ANAF PDFs, properly flowing through Dashboard, Income Details, and Tax Calculation screens
- **Capital gains difImpozit** — capital gains tax now uses `difImpozitRON` from D-212 when available (handles cases where foreign credits apply)
- **US dividend foreign tax fallback** — `foreignTaxRON` now correctly falls back to D-212 data when no Fidelity/1042-S/investment report is present

### Version Numbering
- **Unified version scheme** — all versions renumbered to 1.x.x series for consistency (v2.0.0→v1.1.0, v3.0.0→v1.2.0, etc.)

---

## v1.4.4 (2026-04-15)

### Dashboard Improvements
- **6 charts layout** — reorganized into two rows of 3: Income Breakdown, Tax Breakdown, Year Comparison (row 1) and Total Taxes, Exchange Rates, Minimum Salary (row 2)
- **Total Taxes chart** (new) — stacked bar chart showing Already Paid (green), Income Tax (red), and CASS (purple) per year with tooltip totals
- **Year Comparison now shows 5 years** — expanded from 3 to 5 years of comparison data
- **Navigation arrows on all multi-year charts** — Year Comparison, Total Taxes, Exchange Rates, and Minimum Salary all show ◀▶ arrows when there are 6+ years of data, using a shared generic navigation system

### Label Changes
- **"Total de Plătit (D212)"** renamed to **"Impozit Venit"** / **"Income Tax"** in dashboard cards and chart legends
- **"Plată Totală D212"** chart renamed to **"Total Impozite"** / **"Total Taxes"**

### Bug Fixes
- **ANAF D-212 image PDF parser** — fixed parsing for 2020-2022 declarations with dividends-only (single country section), old 9-field format vs new 7-field format, and blank-line boundary detection between data sections

---

## v1.4.3 (2026-04-14)

### New Features
- **ANAF D-212 import (XFA PDFs)** — imports official ANAF Declarație Unică D-212 PDFs by extracting embedded XML data directly from FlateDecode streams (no OCR needed)
- **ANAF D-212 import (rendered/image PDFs)** — parses ANAF-rendered PDFs with text layers containing "FORMULAR VALIDAT" signature, handling the special number format (e.g., "18 .424" = 18424)
- **Extracted fields** — capital gains (taxable income, tax due), dividends (gross, foreign tax, tax due RO), CASS contribution, total tax obligations
- **Automatic format detection** — the declaratie parser now handles 3 PDF formats: XFA dynamic forms, ANAF rendered PDFs, and Think People advisory reports

### Bug Fixes
- **Hidden CMD/PS windows** — all child process operations (PaddleOCR detection, OCR processing, server restart, upgrade/downgrade) now run with `windowsHide: true` so no console windows flash on screen
- **Slow PaddleOCR on ANAF PDFs** — ANAF-format PDFs with text layers ("FORMULAR VALIDAT") now skip unnecessary PaddleOCR table extraction, making import near-instant
- **Year Comparison chart decimals** — values now display as whole numbers in both axis labels and tooltips

---

## v1.4.2 (2026-04-14)

### Bug Fixes
- **OCR badge stuck on Lite after upgrade** — the OCR engine badge now updates immediately after upgrading to Full or downgrading to Lite, without needing a server restart
- **OCR badge shows Lite on page load** — when PaddleOCR detection is still running at startup, the frontend now retries automatically until detection completes instead of showing the wrong badge

---

## v1.4.1 (2026-04-14)

### UX Improvements
- **Detailed hover tooltips** on all income table rows explaining tax treatment:
  - "(withheld at source)" rows: explains final tax, not declared on D212, counts for CASS
  - "(tax credit)" rows: explains foreign tax credit formula (max(0, RO tax - foreign tax))
  - Rental/Royalty rows: explains 40% flat deduction with example calculation
- **Interest tax paid field** — manual input for tax already withheld on interest income
- **"Citește" label** — renamed from "Citește-mă" for cleaner footer
- **Charts hidden when no data** — all 5 charts only appear when financial data exists
- **Income table footnote** — asterisk (*) with detailed 40% deduction explanation for rental/royalty

---

## v1.4.0 (2026-04-14)

### New Income Types
- **Rental Income (Chirii)** — 40% flat deduction, 10%/16% tax, CASS eligible
- **Intellectual Property / Royalties** — 40% flat deduction, 10%/16% tax, CASS eligible
- **Gambling Income** — final tax at source, manual input, NOT in CASS
- **Other Income Sources** — 10%/16% tax, NOT in CASS
- **US Dividend Tax Withheld** — manual input for 10% RO-US treaty credit
- **RO Dividend Tax Withheld** — manual input for broker withholding

### Tax Compliance Fixes (ANAF)
- **Dividend tax rate 2019-2022** — fixed from 8% to correct 5%
- **RO domestic capital gains 2019-2022** — fixed from 1%/3% to correct 10% flat
- **Gambling excluded from CASS** — per Art. 174 Cod Fiscal
- **Other income excluded from CASS** — per Art. 174
- **Income table: US dividends tax** — no longer double-counts RO dividend tax
- **Income table: RO gains "paid"** — shows actual broker withholding
- **Tax table: RO gains/dividends owed** — shows net amount if broker under-withheld

### Dashboard Improvements
- **5 summary cards** — Total Income, Already Paid, Income Tax, CASS, Total D212
- **Income chart with percentages** — legend and tooltips show % breakdown
- **Tax chart includes all types** — rental, royalty, other tax segments added
- **Minimum Salary chart** — shows salary evolution 2019-2026
- **2×3 chart layout** — row 1: income + tax charts, row 2: comparison + exchange rates + salary
- **Larger chart fonts** — +2pt for legends and axis labels

### Data Management
- **Manual data raw file** — "Adaugă Date" creates a raw file viewable/editable in Date Brute
- **Form field fix** — dividends and gains persist correctly after save
- **Manual data purge** — purging raw file clears all manual fields

### Performance
- **Async PaddleOCR detection** — server starts instantly, OCR detection runs in background

---

## v1.3.2 (2026-04-09)

### Improvements
- **Progress bar on Upload button** — green gradient fills left-to-right during document processing; for multiple files shows per-file progress
- **Progress bar on Upgrade/Downgrade buttons** — shows "Installing... X%" with real-time progress from disk usage, "Removing... X%" with reverse animation
- **Button width locked** during progress animations to prevent layout jumps
- **setup_paddleocr.js fix** — `stdio: 'inherit'` replaced with explicit pipe to prevent child process hang when called via server API

---

## v1.3.1 (2026-04-09)

### Fixes
- **Changelog links in Guide** — clicking CHANGELOG.en.md / CHANGELOG.ro.md links in the Guide now opens a stacked Changelog modal instead of navigating away
- **Portable build: README.ro.md** — Romanian README was missing from portable builds
- **Portable build: Upgrade-to-Full.bat** — now included in both Lite and Full builds (needed after downgrade)
- **Portable build: generated README** — lists Upgrade-to-Full.bat and Downgrade-to-Lite.bat, mentions in-app upgrade button

---

## v1.3.0 (2026-04-09)

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

## v1.2.1 (2026-04-08)

### Improvements
- **Bulk delete in Raw Data** — checkboxes on each file row with "Select All" and "Delete Selected" toolbar
- Separate confirmation dialogs for partial vs. full deletion
- Bilingual support (EN/RO) for all new bulk delete strings

---

## v1.2.0 (2026-04-08)

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
- PaddlePaddle pinned to 3.0.0 (PaddlePaddle 3.3.1 has OneDNN crash on Windows)
- `paddlex[ocr]` extra required for full OCR pipeline
- Multer temp files renamed with correct extension (.pdf/.jpg) for PaddleOCR format detection
- Self-validated document types skip generic OCR quality gate
- Environment: `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK`, `GLOG_minloglevel` suppress verbose logs
- `GET /api/ocr-status` — new endpoint for frontend OCR engine detection

---

## v1.1.4 (2026-04-08)

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

## v1.1.3 (2026-04-08)

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

## v1.1.2 (2026-04-07)

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

## v1.1.1 (2026-04-07)

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

## v1.1.0 (2026-03-29)

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

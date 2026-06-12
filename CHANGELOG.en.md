# D212 Tax Helper - Changelog

## v1.6.1 (2026-06-12)

Maintenance release on top of v1.6.0. No tax-calculation changes.

### 📖 Documentation
- **ROADMAP is now bilingual.** The English roadmap moved to `ROADMAP.en.md`; `ROADMAP.md` is now the full Romanian translation (header links the two).

### 🖼️ In-app document viewer
- The built-in Markdown renderer (`md2html` in `public/js/app.js`) now supports images `![alt](src)`, including image-in-link badges like the CI status badge. Previously these showed as raw `![CI](...)` text in the README/Guide viewer.

### 📦 Portable build
- `build-portable.js` now ships both `ROADMAP.md` and `ROADMAP.en.md` in the portable distribution (they were previously omitted).

## v1.6.0 (2026-06-12)

> Initial v1.6.0 cut was tagged on 2026-05-12; the entries below were added incrementally
> on the `develop` branch up to 2026-06-12 and are all part of the same v1.6.0 release.

### 🗂️ Navigation rebuilt: 5 top-level tabs with sub-tabs
- Top navigation consolidated from 8 flat tabs to **5 grouped tabs**: **Dashboard**, **📥 Data** (Add/Edit · Import), **📊 Calculation** (Income Details · Tax & CASS), **🧾 Submission** (Validate & Prepare D212 · D212 Submission Guide), **⚙ Advanced** (Raw Data · Rules & References)
- Second-row **sub-tab bar** appears only when the active group has more than one sub-tab; per-group memory restores the last visited sub-tab via `localStorage`
- Legacy anchor links and `switchTab('income'|'validate'|...)` callers keep working through an automatic group/sub-tab resolver

### 🧾 D212 Submission Guide (new top-level tab)
- Step-by-step walkthrough of the official ANAF DUF flow (pre-fill → modify → submit), with anonymized reference screenshots in `public/assets/screenshots/`
- DUF field-mapping table cross-referencing every value the app computes with the corresponding XML attribute / DUF screen field
- Caveat banner: DUF pre-fill is unavailable when authenticating with a qualified digital certificate (only SPV username+password)

### 🔬 Validate & Prepare D212 (new sub-tab under Submission)
- **DUF XML import** — drop the XML downloaded from `Preluare/modificare date` and the app diffs it side-by-side against the values computed locally from broker documents
- **Per-row ANAF/Local picker** — each conflicting row exposes an explicit choice; the picks bake straight into the *"Values to enter in DUF"* table at the bottom of the page
- **Per-payer D205 cross-check** — manual entry (or clipboard paste from the *Toate sursele* portal modal) of D205 rows per payer (XTB / ING / SALT / BT…); the matcher flags `exact / near / possible / only ANAF / only local`, with a dedicated bucket for foreign-source income expected to be absent from D205
- **In-tab "How to collect from the DUF portal" guide** with 2 paths (Preluare/modificare wizard vs. Centralizator) and 4 anonymized screenshots
- All scrubbing of personal data (CNP, fiscal codes, amounts) is gated by an anonymization regression test

### 📤 D212 XML export (skeleton level)
- New `lib/d212-xml-builder.js` emits a D212 XML aligned with the ANAF DUF output structure
- `<oblig_realizat>` block now carries the CASS investment block (`cass_ven_inv`) computed by the app
- `cap11Rows` emitted for Romanian-source capital gains (per-category breakdown with Rd.1–Rd.8 lines)
- `cap14` emits XTB/BT foreign dividends **per source country** with the proper credit fiscal, confirms 10% as the W-8BEN treaty WHT, and surfaces the numbers in a banner on the Calculation tab
- Country extraction added to BT (via ISIN) and XTB (via Romanian text) parsers; `byCountry` aggregate flows all the way to `cap14`
- Schema and rules backed by the official ANAF XSD + 6 schematron files shipped in `docs/anaf/d212-2025/`

### 📥 "Data" tab: imports verification + manual entry, separated
- New two-mode UX with an "Advanced" toggle to expose seldom-used fields
- **"Documents already imported"** panel on the Import sub-tab — at-a-glance list with delete buttons for everything currently feeding the calculation
- **Inline edit** of imported per-country rows + dedicated *Motiv* (reason) field for manual overrides
- **Document-type dropdown grouped into 6 optgroups** (was a flat list of 14) — easier to find Fidelity vs. Morgan Stanley vs. XTB vs. BT vs. Revolut vs. ANAF documents
- **"Reset year"** action — wipe all data for the selected fiscal year in one click (with confirm)
- Fix: clicking a sub-tab no longer deactivates its parent tab

### 🆕 New broker support
- **Revolut consolidated statement** (foreign broker) — currency auto-detected from the PDF; CASS base pinned to NET gain per Instr. D212 pct.51; surfaced on Income Details as *"Vânzări Acțiuni International"*; tooltip explains Revolut Securities Europe UAB does NOT withhold capital-gains tax at source so the full RO tax is owed with no foreign credit
- **BT Capital Partners (bt-trade.ro)** — full parser for the Romanian broker, with ISIN-based country extraction, foreign-source dividend handling, and matcher aligned with the Romanian broker label

### 💼 PFA support (independent activities, art. 155(1)b)
- New PFA net income input + dedicated CASS calculation that runs the 6/12/24 SM ladder **independently** of investment CASS
- New PFA income tax line: `10% × (net − deductible CASS)` per Cod fiscal art. 64-67 (rate clarified vs. the 16% investment-income rate)
- Opt-in checkbox for art. 180(2): pay PFA CASS at the minimum 6 SM base even when net income is below the threshold

### ⚖️ "Rules & References" page (Advanced sub-tab)
- New `lib/rules-catalog.js` exposes every rule the engine applies, with citations to Cod fiscal articles + Instr. D212 paragraphs
- Searchable page for accountants — each rule lists the legal anchor, the affected lines, and an *"open an issue"* link to report missing rules
- New `.github/ISSUE_TEMPLATE/missing-rule.md` for rule proposals

### 📦 ANAF Audit Pack export
- One-click **deterministic ZIP** of everything needed for an ANAF audit: raw broker files, parsed JSON, D205 entries, D212 XML, rules trace
- Pure-JS `lib/minizip.js` — no external compression dependency, deterministic CRC + timestamps so two exports from the same data produce identical bytes
- Hardened against path-traversal attacks (review fix)

### 🔢 Calculation refactor: source-resolver + per-category resolvers
- **Phase 1**: new `lib/source-resolver.js` primitive — single place that knows where each value comes from (XTB / Fidelity / BT / Revolut / 1042-S / manual)
- **Phase 2**: `lib/income-resolvers.js` — per-category resolvers (dividends, interest, capital gains, gambling, other) with a 422-line test suite; **no behavior change**, just a clean substrate
- **Phase 3**: resolvers wired into `_computeYearDataImpl` with a `sourceMap` returned alongside the computed totals; `lib/` modules IIFE-wrapped so the browser can load them without bundling
- **Source badges + conflict detector** on the Tax Calculation tab — every figure shows where it came from; conflicts (e.g. ANAF DUF vs. local broker doc) raise a visible warning

### 🐛 Real-money parser fixes
- **1042-S — multi-form PDFs**: forms bundling more than one income code (e.g. 06 dividends + 01 interest) were dropping all but the first. Now extracts every form; federal tax withheld is read from the trailing value block (was sometimes blank)
- **1042-S Interest (code 01)** now feeds both the RO interest calculation **and** the `cap14` foreign-tax credit (was silently dropped)
- **D205 paste** — when the *Venit brut* column is empty (some payers leave it blank), the matcher now picks the value from the *Baza* column instead of recording 0

### 🧪 Tests
- D212 end-to-end integration scenarios (`test/d212-integration.test.js`) — 596 lines, covering 5 representative real-world configurations
- `audit-pack-builder`, `d205-categories`, `d205-matcher`, `d212-cap11`, `d212-cap14`, `d212-oblig-realizat`, `d212-personal`, `d212-xml-builder`, `d212-xml-parser`, `income-resolvers`, `minizip`, `parser-1042s`, `parsers-bt`, `parsers-revolut`, `rules-catalog`, `source-resolver` — all new test files

### 🛡️ CI / hygiene
- New **pr-cleanliness** GitHub Actions job enforces `.gitignore` via `git check-ignore` on every PR (no more `_commit_msg.txt` or `_PR_BODY.md` leaks)
- Anonymization regression test gates any change to the screenshots / sample data
- Scratch files `_commit_msg.txt`, `_PR_BODY.md` and friends added to `.gitignore`

### 🛠️ Internal modules (new in `lib/`)
- `audit-pack-builder.js`, `d205-categories.js`, `d205-matcher.js`, `d212-cap11.js`, `d212-cap14.js`, `d212-duf-compare.js`, `d212-oblig-realizat.js`, `d212-personal.js`, `d212-xml-builder.js`, `d212-xml-parser.js`, `income-resolvers.js`, `minizip.js`, `parsers/bt.js`, `parsers/revolut.js`, `rules-catalog.js`, `source-resolver.js`
- CNP + IBAN validators in `lib/` (UI wiring deferred to a future release)

### 🇷🇴 New brokers & EUR/USD income via Romanian broker
- **BT Trade** added to the Romanian broker list (suggested values under "Add Data → Romania Broker")
- **Full support for EUR and USD income through a Romanian broker** — dividends, interest, and capital gains denominated in EUR or USD via a Romanian broker (e.g. XTB trading European or American shares). New fields on "Add Data":
  - Romania Dividends (EUR / USD) + tax withheld
  - Romania Interest (EUR / USD) + tax withheld
  - Per-row currency dropdown on "Capital Gains per country" (RON / EUR / USD; defaults to RON for backwards compatibility)
- **BNR EUR/RON exchange rates 2019-2025** added (source: BNR statistical series). New "EUR/RON Rate" input on "Add Data → Exchange Rate" alongside USD/RON.

### 💰 Two real-money bugs fixed
- **Undeclared refund**: when a Romanian broker withholds more tax than what's actually due (e.g. on capital gains, before applying losses), the app was hiding the difference behind `Math.max(0, ...)`. Now surfaced explicitly:
  - Dashboard: new "Refund Owed (D212)" card (green, visible only when present)
  - Tax Calculation: dedicated section with per-category breakdown (RO capital gains, RO dividends, interest); the final line alternates between "TO PAY" (warning) and "TO REFUND" (success)
  - On the real 2025 sample, ~1,644 RON of refundable tax was previously hidden
- **Prior-year losses ignored**: `priorLosses` was collected but never applied to the computation. Now implements the official formula from Instr. § 7.3.3: `Rd.6 = min(Rd.5, 0.70 × Rd.3)`, consuming the higher-rate bucket first (short 3% > long 1%) for maximum tax savings

### 📄 Rewritten XTB parsers (multi-row + multi-currency)
- **Critical bug fixed**: the previous parser captured only the first row of the portfolio report, dropping all other countries. On the real 2025 sample with Ireland + United States, the 17,128 RON Ireland loss was being silently discarded
- The new parser captures every row, each with its own currency, and converts to RON using BNR rates
- Capital gains now use `net = max(0, gain − loss)` per bucket (long / short); the current-year net loss is surfaced as `currentYearLossRON` for carryforward into the next year

### ✨ UX
- **Side-by-side diff dialog** before any import that would override manually entered data ("Add Data"). The user sees a `Field | Current | New` table and explicitly confirms before the document overwrites their manual entries. Implemented via a `dryRun` upload that parses but persists nothing
- **Imported data pre-fills "Add Data"** with a visual indicator "📄 Imported from XTB" (or Fidelity). If a manual override is also set, the hint mentions the hidden imported value
- **Loading splash** between launching the app and the dashboard appearing (CSS-only, no dependencies; respects dark/light theme)
- **Income Details**: separate rows for EUR/USD dividends and interest with the rate column populated; the Romania Trades table now shows one row per country (with currency suffix when not RON)

### 📚 ANAF documents in the repo
- `docs/anaf/d212-2025/` — all official ANAF / Ministry of Finance documents as a versioned source of truth:
  - `D212.xsd` (schema v1.0.4 of 24.11.2025)
  - 6 schematron files (76+ BR-D212-* rules)
  - `Instructiuni_D212_OMF_2736_2025.pdf` (official OMF instructions)
  - `structura_D212_v1.0.8_17042026.pdf` + `d212_docTehnica_v1.0.8.xls`
  - `nomenclator_caen.xml`
- `docs/d212-mapping.md` — exhaustive D212 → app mapping with BT-code citations for every attribute
- `ROADMAP.md` — open list of remaining gaps with starter info (paths, pitfalls, acceptance criteria) for contributors

### 🧪 Quality & infrastructure
- **First test suite** (35 cases, `node:test`, zero new dependencies):
  - `test/rates.test.js` — BNR rates, toRON, parseNumber, detectCurrency
  - `test/parsers-xtb.test.js` — multi-row, multi-currency, country-name cleanup
  - `test/parsers-xtb-e2e.test.js` — full pipeline pdf-parse + parsers on synthetic anonymized PDFs generated by `scripts/generate-test-pdfs.js`
- **CI GitHub Actions** — runs on push to `develop`/`main` and PRs, matrix Node 18/20/22 on ubuntu-latest (`npm test`, `npm run check-i18n`, `node --check`)
- **Branch strategy**: `develop` as the integration branch (continuous CI); `main` only for releases (develop→main PR + tag)
- **Scoped Claude skill** for the core tax engine (`.github/skills/anaf-tax-engine/SKILL.md`) — future AI changes stay within `lib/`, `computeYearData`, and tests; UI styling, portable build, and db schema require explicit human review

### 🛠️ Internal refactor
- BNR rates + `parseNumber` + `toRON` + `detectCurrency` extracted from `server.js` into a dedicated `lib/rates.js` module (single source of truth)
- XTB parsers moved into `lib/parsers/xtb.js` (imported in `server.js`); ~190 lines removed from `server.js` through deduplication
- Latent bug found by the tests: regex `\bîn` did not work in JS because `î` (Unicode) is not a word-character without the `/u` flag. Fixed with `(?:^|\s)în`

### 🐛 Minor fixes
- XTB import success output no longer shows `dividends: [object Object] | interest: [object Object]` — instead, a readable summary with per-category totals
- `currentYearLossRON` (current-year net loss) displayed with a note suggesting the user add it to `priorLosses` next year

## v1.5.3 (2026-04-19)

### Light/Dark/Auto Theme Support
- **Three theme modes** — Dark (🌙), Light (☀️), and Auto (🖥️ follows system/browser `prefers-color-scheme`). Toggle cycles: Auto → Dark → Light → Auto.
- **WCAG 2.1 AA accessibility audit** — all color pairs verified for contrast compliance:
  - Dark `--text-muted` upgraded from `#6e7681` to `#848d97` (4.52–5.62:1 on all backgrounds)
  - Light `--text-muted` upgraded from `#8b949e` to `#636c76` (5.01–5.33:1 on all backgrounds)
  - Dark `--btn-text` changed from `#fff` to `#0d1117` (7.49:1 on accent)
- **Global `:focus-visible` outline** — 2px accent ring on all interactive elements for keyboard navigation
- **Skip-to-content link** — hidden until focused via keyboard, for screen reader accessibility
- **`prefers-reduced-motion`** — all animations and transitions disabled when the user prefers reduced motion
- **`color-scheme` CSS property** — native browser controls (date pickers, scrollbars) automatically match the theme
- **ARIA landmarks** — `role="banner"` on header, `aria-label` on navigation, `alt` text on images
- Theme choice persisted in localStorage across sessions

### Prior Year Capital Losses (D212 Rd.5-6)
- **New field: "Prior Year Capital Losses (RON)"** in the Add Data → Capital Gains section
- Implements D212 Rd.5 (pierderi reportate din anii precedenți) and Rd.6 (pierdere compensată — max 70% of current year net gain, 7-year carryforward)
- **Loss offset applied across all views:**
  - Dashboard: new "Loss Offset" summary card (green, shown only when active) between Total Income and Already Paid
  - Income Details: new deduction row "↳ Prior year losses offset (D212 Rd.5-6)" with tooltip
  - Tax Calculation: gross gains → deductions breakdown → net gains → subtotal flow
  - D212 Form Helper: Rd.5 and Rd.6 rows in the capital gains section

### Tax Calculation Display Improvements
- **Subtotal US clarity** — when ESPP/BIK/loss deductions exist, the Tax Calculation section now shows: gross capital gains → deductions detail → net capital gains (green) → dividends → subtotal. Previously the deductions appeared as an info line after the already-net figure.

### Documentation
- Updated CHANGELOG, README, and GUIDE for all three features

---

## v1.5.2 (2026-04-17)

### Tax Calculation Fixes
- **Dividend credit fiscal rounding** — when US withholding rate matches the Romanian rate (e.g., both 10%), the credit fiscal now fully covers the Romanian tax. Previously, USD→RON conversion rounding caused a phantom 1 RON liability.
- **US tax withheld RON rounding** — USD tax amounts are now rounded up (ceiling) when converted to RON, ensuring the displayed RON value is never less than the actual tax paid.
- **Tax summary consistency** — US capital gains tax in the "Sumar Calcul Impozite" table now correctly applies both ESPP and BIK deductions before computing the tax rate.
- **Income table display** — ESPP deduction row now shows only USD (no rate/RON columns), and the US gains row shows net taxable RON after all deductions with a tooltip showing the breakdown formula.
- **Total RON accuracy** — deduction rows (ESPP, BIK) are excluded from the Total RON sum since their effect is already reflected in the US gains row.
- **D212 helper dividend section** — credit fiscal and difference to pay now use the same rounding tolerance across all three D212 sections.

### Trade Deduplication
- **Cross-source dedup fix** — trade confirmations now use `addTradeIfNotDuplicate` (was `addTrade` with no dedup), preventing duplicates when both Fidelity statements and trade confirmations are imported.
- **Trade source tracking** — trade confirmation parser now sets `source: 'trade_confirmation'` on parsed trades.

### UI Improvements
- **Consistent import messages** — per-file status row now shows the specific message instead of the generic "OCR quality too low" when a messageKey is provided.
- **Elapsed time display** — "Document procesat cu succes!" no longer shows "(0:00)" when processing completes in under 1 second.

### Documentation
- **Romanian-first documentation** — `README.md` is now in Romanian (default), English version moved to `README.en.md`.
- **Manual install instructions** — added download-and-extract installation option (no Git required) to README and GUIDE.

---

## v1.5.1 (2026-04-17)

### ANAF D212 Compliance Fixes (deep audit against [Instrucțiuni D212 2736/2025](https://static.anaf.ro/static/10/Anaf/formulare/Instructiuni_D212_2736_2025.pdf))

- **CRITICAL: BIK cost basis** — `salaryTaxedRON` (deducted from capital gains as cost basis) now correctly uses `stock_award_bik + espp_gain_bik` (the income amount already taxed as salary) instead of `stock_withholding` (the tax paid on the BIK). Per D212 Section 2 Rd.2 "Cheltuieli deductibile", the **cost basis** (FMV at vesting for RSU) must be deducted, not the tax amount. Previously, capital gains were overstated by the difference between BIK income and withholding tax.
- **CRITICAL: CASS 60SM tier** — investment income CASS is now correctly capped at **24SM** (3-tier: 6SM / 12SM / 24SM) per D212 pct. 52.1.1–52.1.3. The 60SM tier applies **only** to independent activities (pct. 49.1.2.1). Previously, investment income above 243,000 RON would compute CASS at 24,300 RON instead of the correct 9,720 RON (a 149% overcharge).
- **CRITICAL: CASS base components** — capital gains, rental, and royalty income no longer subtract tax withheld for CASS threshold calculation. Per D212 pct. 51, only dividends and interest use net-of-tax amounts ("diminuate cu impozitul reținut"). Capital gains use "câștigul net" (gains minus losses, not gains minus tax).
- **BUG FIX: dividendsRON fallback** — when only Form 1042-S data exists (USD-only), `dividendsRON` is now auto-computed as `dividendsUSD × exchangeRate`. Previously, dividend tax was calculated as zero when no RON value was available.
- **BUG FIX: other income in CASS** — "other income" (`alte surse`) is now included in the CASS threshold calculation per D212 pct. 50.1 lit. f) and pct. 51.

### ESPP Year Assignment
- **Assign ESPP purchases to fiscal years** — ESPP stock purchases can now be assigned to specific fiscal years for BIK deduction and cost basis allocation. Unassigned purchases are excluded from tax calculations.
- **Bulk select/assign** — select multiple stock award entries and assign/unassign them to a year with one click

### Build
- Suppressed prebuild-install deprecation warning during portable build

### Self-Update Fixes
- **ZIP extraction fix** — self-update now uses `tar` (handles long paths in node_modules) with PowerShell `Expand-Archive` as fallback, fixing "Failed to extract ZIP" errors on paths exceeding 260 characters
- **Update progress bar & timer** — the installing step now shows a visible progress bar and elapsed time counter (M:SS) throughout the install and server restart phases
- **EBUSY crash fix** — self-update no longer crashes with an HTML error page when Windows locks staging files during cleanup; all `fs.rmSync` calls in update handlers are now wrapped in try/catch (leftover files are cleaned on the next run)

### Other
- Updated GitHub repository from `edmund-1` to `edspat`
- Added manual download installation instructions (no Git required)

---

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

> **[Versiunea în română](README.md)**

# D212 Tax Helper

[![CI](https://github.com/edspat/D212TaxHelper/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/edspat/D212TaxHelper/actions/workflows/ci.yml)

A local web application that helps Romanian tax residents calculate and prepare their **Declarație Unică D212** for investment income from US and Romanian brokers.

## Who is this for?

- Employees of US companies with offices in Romania receiving stock awards (RSUs), ESPP shares, and dividends via **Fidelity / Morgan Stanley**
- Investors who trade or hold stocks through Romanian brokers **XTB**, **BT Capital Partners (bt-trade.ro)** or **Tradeville**, and/or the foreign broker **Revolut** (for other brokers, [contact me](https://github.com/edspat))
- PFA (independent activities) filers who submit D212 alongside investment income
- Anyone filing a D212 for investment income in Romania

## Features

- **13+ document parsers** — Fidelity (year-end report, statement, trade confirmations), Morgan Stanley Stock Plan, 1042-S forms (with multi-form PDF support), XTB (dividends + portfolio), Tradeville, BT Capital Partners, Revolut consolidated statement, ANAF income certificates, D-212 declarations, pre-filled DUF XML
- **Tax calculations** — income tax, capital gains, dividends, interest, investment-CASS and PFA-CASS, plus PFA income tax (art. 64-67)
- **5 grouped top-level tabs** — Dashboard · 📥 Data (Add/Edit + Import) · 📊 Calculation (Income Details + Tax & CASS) · 🧾 Submission (Validate & Prepare D212 + D212 Submission Guide) · ⚙ Advanced (Raw Data + Rules & References)
- **🔬 Validate & Prepare D212** — DUF XML import, side-by-side ANAF vs. local diff, per-row ANAF/Local picker, per-payer D205 cross-check (matcher: exact / near / possible / only ANAF / only local)
- **🧾 D212 Submission Guide** — official DUF flow walkthrough with anonymized screenshots and DUF field-mapping table
- **📤 D212 XML export** — emits XML aligned with the DUF structure (cap11Rows for RO capital gains, cap14 for foreign dividends per country, `<oblig_realizat>` with the investment-CASS block)
- **📦 ANAF Audit Pack** — deterministic ZIP (stable CRC + timestamps) with everything needed for an audit: raw files, parsed JSON, D205 entries, D212 XML, rules trace
- **⚖️ Rules & References** — searchable page for accountants; every rule cites the Cod fiscal article + Instr. D212 paragraph
- **Source badges + conflict detector** on the Calculation tab — every figure shows where it came from; conflicts between DUF and local documents raise a warning
- **Multi-currency support** — RON / EUR / USD via Romanian brokers (XTB, BT) with BNR EUR/RON and USD/RON rates 2019-2025
- **PFA support** — net income, CASS independent of investment CASS with the 6/12/24 SM ladder, art. 180(2) opt-in
- **Prior year loss carryforward** — offset capital losses from previous years per D212 Rd.5-6 (max 70%, 7-year carryforward)
- **6 interactive charts** — income breakdown, tax breakdown, year comparison, total taxes, exchange rates, and minimum salary
- **Bilingual** — full Romanian and English interface
- **Offline & private** — runs entirely on your computer, no data is sent anywhere
- **Light/Dark/Auto theme** — follows system preference or manual toggle; WCAG 2.1 AA accessibility verified
- **Auto-update checker** — checks GitHub for new releases on startup; download, install, and restart directly from within the app while preserving all your data
- **Portable version** — self-contained folder with embedded Node.js (no installation needed)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (recommended: v22 LTS) | Mandatory for options A and C. **Option B** => **Just run it** (portable)
- A modern browser (Edge, Chrome, Firefox)
- Windows

### Option A — Git Clone

```bash
git clone https://github.com/edspat/D212TaxHelper.git
cd D212TaxHelper
npm install
npm start
```

### Option B — Manual Download (no Git required)

1. Go to the [latest release](https://github.com/edspat/D212TaxHelper/releases/latest)
2. Download `D212TaxHelper-Portable-v*.zip`
3. Extract the ZIP to any folder
4. Optional: rename it `D212TaxHelper-Portable`
5. Double-click `Start.bat` — the browser opens automatically

That's it — the portable version includes Node.js, no installation needed.

### Option C — Source ZIP (requires Node.js)

1. Click the green **Code** button on the [repository page](https://github.com/edspat/D212TaxHelper) → **Download ZIP**
2. Extract the ZIP to any folder
3. Open a terminal in the extracted folder and run:

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser.

### Windows Shortcuts

- **Start.bat** — starts the server and opens the browser
- **Stop.bat** — stops the server

## Portable Version

Two fully self-contained builds (include Node.js) that require no installation:

| Variant | Command | Size | OCR Engine |
|---------|---------|------|------------|
| **Lite** | `npm run build` | ~174 MB | Tesseract.js only |
| **Full** | `npm run build:full` | ~1.9 GB | PaddleOCR + Tesseract.js |

Output is created alongside the source folder. Just double-click `Start.bat` to run.

The **Full** build includes PaddleOCR for superior text extraction from scanned documents (especially Tradeville portfolio tables that Tesseract cannot read).

You can switch between Lite and Full at any time — either from the **Import Document** tab (Upgrade to Full / Downgrade to Lite buttons) or using `Upgrade-to-Full.bat` / `Downgrade-to-Lite.bat`.

## Supported Documents

The document-type dropdown is grouped into 6 optgroups (Fidelity / Morgan Stanley / XTB / BT / Revolut / ANAF), and the Import tab shows an "Already imported documents" panel with per-document delete buttons.

| Document | Source |
|---|---|
| Year-End Investment Report | Fidelity |
| Fidelity Statement | Fidelity |
| Trade Confirmation | Fidelity |
| Stock Plan Statement | Morgan Stanley |
| Form 1042-S (multi-form PDFs) | IRS / Fidelity |
| Adeverință venit | Employer |
| Calcul declarație unică | Tax consultant |
| Dividends report | XTB |
| Portfolio report | XTB |
| Portfolio (Fișă Portofoliu) | Tradeville |
| Trades / dividends report | BT Capital Partners (bt-trade.ro) |
| Consolidated statement | Revolut Securities Europe |
| Pre-filled DUF XML | ANAF (Preluare/modificare date) |
| Images (OCR) | Any (via PaddleOCR / Tesseract.js) |

## Project Structure

```
D212TaxHelper/
├── server.js            # Express server & API routes
├── db.js                # SQLite database layer
├── ledger.js            # FIFO cost basis engine
├── ocr_service.py       # PaddleOCR subprocess (Python)
├── setup_paddleocr.js   # PaddleOCR setup script
├── lib/                 # Tax-logic modules (independently testable)
│   ├── rates.js                 # BNR rates, parseNumber, toRON, detectCurrency
│   ├── source-resolver.js       # Single source of truth: where every value comes from
│   ├── income-resolvers.js      # Per-category resolvers (dividends, interest, gains…)
│   ├── rules-catalog.js         # Rules with Cod fiscal + Instr. D212 citations
│   ├── d205-categories.js       # D205 income category catalog
│   ├── d205-matcher.js          # Per-payer D205 ANAF vs. local cross-check
│   ├── d212-cap11.js            # Chapter I.1 (RO capital gains, Rd.1-Rd.8)
│   ├── d212-cap14.js            # Chapter I.4 (foreign dividends per country, credit)
│   ├── d212-oblig-realizat.js   # <oblig_realizat> + investment CASS block
│   ├── d212-personal.js         # Personal data (CNP, address, IBAN)
│   ├── d212-xml-builder.js      # Emit D212 XML aligned with DUF structure
│   ├── d212-xml-parser.js       # Import pre-filled DUF XML
│   ├── d212-duf-compare.js      # Diff ANAF DUF vs. local values
│   ├── audit-pack-builder.js    # Build deterministic ANAF audit ZIP
│   ├── minizip.js               # Pure-JS ZIP implementation (zero deps)
│   └── parsers/                 # Per-broker parsers (xtb, bt, revolut…)
├── public/              # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js       # Main application logic (5 tabs × sub-tabs)
│   │   ├── charts.js    # Chart rendering
│   │   └── i18n.js      # Internationalization
│   ├── assets/screenshots/  # Anonymized screenshots for the DUF guide
│   └── locales/         # EN/RO translations
├── scripts/             # Utility scripts
│   └── check-i18n.js    # Translation completeness checker
├── test/                # Test suite (node:test, zero deps)
├── data/                # Parsed financial data (gitignored)
├── uploads/             # Uploaded PDFs (gitignored)
├── build-portable.js    # Portable version builder (--full for PaddleOCR)
├── GUIDE.en.md          # User guide (English)
├── GUIDE.ro.md          # User guide (Romanian)
├── CHANGELOG.en.md      # Changelog (English)
└── CHANGELOG.ro.md      # Changelog (Romanian)
```

## Tech Stack

- **Backend:** Node.js, Express 5, compression
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vanilla JS, HTML, CSS
- **PDF parsing:** pdf-parse-new
- **OCR (primary):** PaddleOCR 3.x via Python subprocess (PP-StructureV3)
- **OCR (fallback):** Tesseract.js 7
- **Python:** Embeddable 3.12 (optional, for PaddleOCR Full build)

## Privacy

All data stays on your machine. The application runs a local server on `localhost:3000` with no external network calls. Your financial documents and parsed data are never uploaded anywhere.

## Contributing & Roadmap

- 📋 [ROADMAP.md](ROADMAP.md) — what's next (D212 compliance gaps + platform improvements), priorities, and how to claim a task
- 📖 [docs/d212-mapping.md](docs/d212-mapping.md) — exhaustive D212 → app field mapping, with citations to the ANAF XSD and the official instructions (OMF 2736/2025)
- 📚 [docs/anaf/d212-2025/](docs/anaf/d212-2025/) — official ANAF documents (XSD, schematron, instructions) kept in-repo as a versioned source of truth

Accountants who spot rules we are missing are invited to open an issue titled `[Roadmap proposal] <description>` citing the Cod fiscal article / D212 instruction paragraph that grounds the rule.

## License

This work is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You may share and adapt it for non-commercial purposes with attribution.

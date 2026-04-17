> **[Versiunea în română](README.md)**

# D212 Tax Helper

A local web application that helps Romanian tax residents calculate and prepare their **Declarație Unică D212** for investment income from US and Romanian brokers.

## Who is this for?

- Microsoft employees (or similar) in Romania receiving stock awards (RSUs), ESPP shares, and dividends via **Fidelity / Morgan Stanley**
- Investors who trade or hold stocks through **XTB** (currently the only supported Romanian broker — for Tradeville or other Romanian brokers, [contact me](https://github.com/edspat))
- Anyone filing a D212 for investment income in Romania

## Features

- **11 document parsers** — automatically extracts data from PDFs and images (Fidelity statements, Morgan Stanley statements, 1042-S forms, XTB reports, Tradeville portfolio, trade confirmations, ANAF D-212 declarations, etc.)
- **Tax calculations** — income tax, capital gains tax, dividend tax, and CASS (health insurance contribution)
- **D212 form helper** — generates the exact values needed to fill in the ANAF declaration
- **6 interactive charts** — income breakdown, tax breakdown, year comparison, total taxes, exchange rates, and minimum salary — with navigation arrows for 6+ years
- **Multi-year comparison** — compare financial data across fiscal years
- **Bilingual** — full Romanian and English interface
- **Offline & private** — runs entirely on your computer, no data is sent anywhere
- **Dark theme** — responsive design
- **Auto-update checker** — checks GitHub for new releases on startup; download, install, and restart directly from within the app while preserving all your data
- **Portable version** — self-contained folder with embedded Node.js (no installation needed)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (recommended: v22 LTS)
- A modern browser (Chrome, Edge, Firefox)

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
4. Double-click `Start.bat` — the browser opens automatically

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

| Document | Source |
|---|---|
| Year-End Investment Report | Fidelity |
| Fidelity Statement | Fidelity |
| Trade Confirmation | Fidelity |
| Stock Plan Statement | Morgan Stanley |
| Form 1042-S | Fidelity |
| Adeverință venit | Employer |
| Calcul declarație unică | Tax consultant |
| Dividends report | XTB |
| Portfolio report | XTB |
| Portfolio (Fișă Portofoliu) | Tradeville |
| Images (OCR) | Any (via PaddleOCR / Tesseract.js) |

## Project Structure

```
D212TaxHelper/
├── server.js            # Express server & API routes
├── db.js                # SQLite database layer
├── ledger.js            # FIFO cost basis engine
├── ocr_service.py       # PaddleOCR subprocess (Python)
├── setup_paddleocr.js   # PaddleOCR setup script
├── public/              # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js       # Main application logic
│   │   ├── charts.js    # Chart rendering
│   │   └── i18n.js      # Internationalization
│   └── locales/         # EN/RO translations
├── scripts/             # Utility scripts
│   └── check-i18n.js    # Translation completeness checker
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

## License

This work is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You may share and adapt it for non-commercial purposes with attribution.

# D212 Tax Helper

A local web application that helps Romanian tax residents calculate and prepare their **Declarație Unică D212** for investment income from US and Romanian brokers.

## Who is this for?

- Microsoft employees (or similar) in Romania receiving stock awards (RSUs), ESPP shares, and dividends via **Fidelity / Morgan Stanley**
- Investors who trade or hold stocks through **XTB** (currently the only supported Romanian broker — for Tradeville or other Romanian brokers, [contact me](https://github.com/edmund-1))
- Anyone filing a D212 for investment income in Romania

## Features

- **10 document parsers** — automatically extracts data from PDFs and images (Fidelity statements, Morgan Stanley statements, 1042-S forms, XTB reports, trade confirmations, etc.)
- **Tax calculations** — income tax, capital gains tax, dividend tax, and CASS (health insurance contribution)
- **D212 form helper** — generates the exact values needed to fill in the ANAF declaration
- **Multi-year comparison** — compare financial data across fiscal years
- **Bilingual** — full Romanian and English interface
- **Offline & private** — runs entirely on your computer, no data is sent anywhere
- **Dark theme** — responsive design
- **Portable version** — self-contained folder with embedded Node.js (no installation needed)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (recommended: v22 LTS)
- A modern browser (Chrome, Edge, Firefox)

### Install & Run

```bash
git clone https://github.com/edmund-1/D212TaxHelper.git
cd D212TaxHelper
npm install
npm start
```

Open http://localhost:3000 in your browser.

### Windows Shortcuts

- **Start.bat** — starts the server and opens the browser
- **Stop.bat** — stops the server

## Portable Version

A fully self-contained build (includes Node.js) that requires no installation:

```bash
node build-portable.js
```

Output is created in `../D212TaxHelper-Portable/`. Just double-click `Start.bat` to run.

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
| Images (OCR) | Any (via Tesseract.js) |

## Project Structure

```
D212TaxHelper/
├── server.js            # Express server & API routes
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
├── build-portable.js    # Portable version builder
├── GUIDE.en.md          # User guide (English)
├── GUIDE.ro.md          # User guide (Romanian)
├── CHANGELOG.en.md      # Changelog (English)
└── CHANGELOG.ro.md      # Changelog (Romanian)
```

## Tech Stack

- **Backend:** Node.js, Express 5
- **Frontend:** Vanilla JS, HTML, CSS
- **PDF parsing:** pdf-parse-new
- **OCR:** Tesseract.js 7

## Privacy

All data stays on your machine. The application runs a local server on `localhost:3000` with no external network calls. Your financial documents and parsed data are never uploaded anywhere.

## License

This work is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You may share and adapt it for non-commercial purposes with attribution.

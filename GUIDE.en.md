# D212 Tax Helper - User Guide

**Guide version:** 1.7 | **App version:** 3.1.1 | **Last updated:** 2026-04-09

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Navigation & Controls](#3-navigation--controls)
4. [Tab 1 - Dashboard](#4-tab-1---dashboard)
5. [Tab 2 - Income Details](#5-tab-2---income-details)
6. [Tab 3 - Tax Calculation](#6-tab-3---tax-calculation)
7. [Tab 4 - Add Data](#7-tab-4---add-data)
8. [Tab 5 - Import Document](#8-tab-5---import-document)
9. [Tab 6 - Raw Data](#9-tab-6---raw-data)
10. [Tax Logic & Rules](#10-tax-logic--rules)
11. [D212 Form Helper — How to Fill in the Declarație Unică](#11-d212-form-helper--how-to-fill-in-the-declaratie-unică)
12. [Data Management](#12-data-management)
13. [Portable Version](#13-portable-version)
14. [Troubleshooting](#14-troubleshooting)
15. [App Changelog](#15-app-changelog)

---

## 1. Introduction

**D212 Tax Helper** is a local web application designed to help Romanian tax residents who receive investment income from both **US brokers** (Fidelity, Morgan Stanley) and **Romanian brokers** (XTB) to:

- Import and parse financial documents (PDFs and images)
- Calculate income tax, capital gains tax, dividend tax, and CASS (health insurance contribution)
- Generate the values needed to fill in the **Declarație Unică D212** on the ANAF portal
- Compare financial data across multiple fiscal years

### Who is this for?

This application is specifically designed for:
- Microsoft employees (or similar) in Romania who receive stock awards (RSUs), ESPP shares, and dividends via Fidelity / Morgan Stanley
- Investors who have transferred stocks to a Romanian broker (e.g., XTB)
- Anyone filing a D212 for investment income in Romania

### Key features
- **11 document parsers** — automatically extracts data from PDFs and images
- **PaddleOCR** — superior OCR for scanned documents (including Tradeville portfolio tables)
- **Bilingual** — full Romanian (RO) and English (EN) interface
- **Offline & private** — runs entirely on your computer, no data is sent anywhere
- **Dark theme** — easy on the eyes, responsive design
- **Portable** — can be distributed as a self-contained folder (no installation needed)

---

## 2. Getting Started

### Prerequisites
- **Node.js** 18 or later (recommended: v22 LTS)
- A modern web browser (Chrome, Edge, Firefox)
- OR: use the **Portable version** (includes Node.js, no install required)

### Starting the application

**Option A — From source:**
```bash
cd D212TaxHelper
npm install          # first time only
node server.js
```

**Option B — Portable version:**
Double-click `Start.bat`. The browser opens automatically.

The application runs at **http://localhost:3000**.

### Stopping the application
- Press `Ctrl+C` in the terminal, OR
- Click the **Restart Server** button in the footer (restarts, doesn't stop), OR
- Run `Stop.bat` (portable version — kills all node processes)

---

## 3. Navigation & Controls

### Header bar

| Element | Description |
|---------|-------------|
| **☰ (Hamburger)** | Toggles the navigation menu on narrow screens |
| **Tab buttons** | 6 tabs: Dashboard, Income Details, Tax Calculation, Add Data, Import Document, Raw Data |
| **Language selector** | Switch between **RO** (Romanian) and **EN** (English). All labels, hints, and translations update instantly. |
| **Year selector** | Choose the fiscal year you're viewing/editing. The dropdown shows all years with BNR exchange rates (2019-2025) plus any year with imported data. All tabs update when you change the year. |

### Footer bar

| Element | Description |
|---------|-------------|
| **App version** (e.g., v2.4.0) | Click to view the full changelog |
| **Data source** | Shows where data comes from (ANAF, BNR, Fidelity, XTB) |
| **Contact** | Email link to the author |
| **Restart Server** | Restarts the Node.js server (page reloads automatically) |
| **↑ Top** | Scroll-to-top button (appears when you scroll down) |

---

## 4. Tab 1 — Dashboard

The Dashboard provides a high-level overview of your financial situation for the selected year.

### Summary Cards (top row)

| Card | Description |
|------|-------------|
| **Total Income** | Sum of all investment income (dividends + capital gains + interest) in RON |
| **Total Tax Due** | Total tax calculated (income tax + CASS) in RON |
| **Stock Withholding** | Amount already paid as tax withholding on stock awards (from payslip) |
| **Net Tax to Pay** | Total Tax Due minus Stock Withholding = what you actually need to pay via D212 |

### Charts (bottom grid)

| Chart | Description |
|-------|-------------|
| **Income Breakdown** | Doughnut chart showing the proportion of dividends, capital gains, and interest |
| **Tax Breakdown** | Doughnut chart showing dividend tax, capital gains tax, interest tax, and CASS |
| **Year Comparison** | Bar chart comparing income and taxes across all years with data |
| **Exchange Rates** | Line chart showing the BNR USD/RON annual average exchange rate trend |

---

## 5. Tab 2 — Income Details

This tab shows detailed breakdowns of your income with all the numbers behind the calculations.

### Main Income Table

Each row represents an income category:

| Row | USD | RON | US Tax | RO Tax |
|-----|-----|-----|--------|--------|
| US Dividends | ✓ | ✓ (converted) | 10% withheld (treaty) | 0% (no double taxation) |
| Romania Dividends | - | ✓ | - | 8-16% (withheld by broker) |
| US Stock Sales | ✓ | ✓ (converted) | - | 10-16% |
| Romania Stock Sales ≥1yr | - | ✓ | - | 1-3% (final, withheld) |
| Romania Stock Sales <1yr | - | ✓ | - | 3-6% (final, withheld) |
| Interest Income | - | ✓ | - | 10-16% |
| Gambling Income | - | ✓ | - | Already withheld |

### Stock Withholding Deductions

Shows the individual stock award withholding entries from your payslip (imported via **MSFT - Stock Award Document**). These amounts are deducted from your total tax due.

### Romania Stock Sales

Detailed view of stock trades executed through your Romanian broker (XTB), split by:
- **≥1 year** holding period (lower tax rate)
- **<1 year** holding period (higher tax rate)
- **Dividends** received through the Romanian broker
- **Interest** earned through the Romanian broker

### US Stock Sales (Trade Confirmations)

Individual trade-by-trade listing from US broker trade confirmations (Fidelity). Shows date, symbol, shares sold, price, proceeds, fees, and net proceeds.

---

## 6. Tab 3 — Tax Calculation

The most important tab — shows exactly what you owe and provides the D212 form helper.

### Tax Calculation Summary

Divided into 3 clearly labeled sections:

#### 💰 Section A: What I Earned (Gross Income)
Lists all income categories with their RON values:
- US capital gains, US dividends (with dynamic broker label: Fidelity / Morgan Stanley)
- Stock withholding deduction (deducted from capital gains only)
- Net US income after deduction
- Romania capital gains (≥1yr and <1yr), Romania dividends (with broker label: XTB)
- Interest income, Gambling income
- **Total Investment Income**

#### ✅ Section B: Already Paid (Withheld at Source)
Shows what has already been collected:
- US dividend tax withheld (10% per RO-US treaty)
- Romania broker capital gains tax (final tax, 1%/3%)
- Romania broker dividend tax
- Interest tax withheld
- Stock award withholdings
- **Total Already Paid**

#### 📝 Section C: Still to Pay (D212 Obligations)
What remains to declare and pay:
- US capital gains tax (10%)
- US dividend tax (usually 0 — treaty)
- Romania broker items (marked as "Final tax - withheld at source, not declared")
- Interest tax remaining
- CASS (health contribution)
- Stock withholding deduction
- **⚠ TOTAL TO PAY ON D212** — this is the number that matters

#### Payment Deadline
Displayed at the bottom — the D212 filing and payment deadline (e.g., May 25, 2026 for fiscal year 2025).

### CASS (Health Insurance Contribution)

Detailed breakdown of the CASS calculation:
- Shows the minimum gross salary and the tier system
- Highlights your active tier
- Shows the CASS amount due
- Lists which income types are subject to CASS
- Confirms CAS (pension 25%) does NOT apply to investment income

**CASS Tier System (2025):**

| Tier | Income Range | CASS Base | CASS Amount |
|------|-------------|-----------|-------------|
| <6 SM | < 24,300 RON | - | 0 |
| 6-12 SM | 24,300 - 48,600 | 24,300 | 2,430 |
| 12-24 SM | 48,600 - 97,200 | 48,600 | 4,860 |
| 24-60 SM | 97,200 - 243,000 | 97,200 | 9,720 |
| >60 SM | > 243,000 | 243,000 | 24,300 |

*SM = minimum gross salary (4,050 RON/month in 2025)*

### D212 Form Helper

See [Section 11](#11-d212-form-helper--how-to-fill-in-the-declaratie-unică) for detailed instructions.

---

## 7. Tab 4 — Add Data

Use this tab to manually enter or override financial data for the selected year. Data entered here takes precedence over imported document data.

### Income & Deductions Card

| Field | Description |
|-------|-------------|
| **US Broker** | Select which US broker you use: Fidelity, Morgan Stanley, or None. This determines the broker label shown in Income Details and Tax Calculation. If you upload documents from both brokers, the labels combine automatically. |
| **Romania Broker** | Select which Romanian broker you use: XTB or None. |
| **US Dividends (USD)** | Total gross dividends received from US broker |
| **Romania Dividends (RON)** | Total dividends received from Romanian broker |
| **US Stock Sales (USD)** | Total gross proceeds from US stock sales |
| **ESPP Purchase Cost (USD)** | The cost you paid for ESPP shares. For free stock awards, enter 0. This is deducted from sale proceeds to calculate taxable capital gains. |
| **Romania Stock Sales (RON)** | Total proceeds from Romanian broker stock sales |
| **Interest Income (RON)** | Total interest received from bank deposits |
| **Stock Withholding Already Paid (RON)** | Total stock award withholdings already deducted from your salary (from payslip). This amount is subtracted from your final tax due. |

### Exchange Rate & Minimum Salary Card

| Field | Description |
|-------|-------------|
| **USD/RON Rate** | BNR annual average exchange rate. Pre-filled from built-in data. |
| **Minimum Gross Salary (RON/month)** | Used to calculate CASS tiers. Pre-filled for each year. |
| **D212 Filing & Payment Deadline** | Calendar date picker. When is the D212 filing + payment due. |

### Tax Rates by Country Card

Override the default tax rates for the selected year:

**United States (US):**
| Rate | Default | Description |
|------|---------|-------------|
| US Dividend Tax Rate | 10% | Withheld at source per RO-US treaty |
| US Capital Gains Tax Rate | 0% | US does not tax non-resident stock sales |

**Romania (RO):**
| Rate | 2024 | 2025 | 2026+ | Description |
|------|------|------|-------|-------------|
| Dividend Tax | 8% | 10% | 16% | Applied to all dividends |
| Capital Gains (Foreign/US) | 10% | 10% | 16% | For non-RO brokers (Fidelity, Morgan Stanley) |
| Capital Gains (Domestic ≥1yr) | - | 1% | 3% | Romania broker, final tax |
| Capital Gains (Domestic <1yr) | - | 3% | 6% | Romania broker, final tax |
| Interest Tax | 10% | 10% | 16% | Applied to bank interest |

Each section has its own **Save** button. Buttons display the selected year (e.g., "Save Data (2025)").

---

## 8. Tab 5 — Import Document

Upload PDFs or images to automatically extract financial data.

### How to import

1. **Select the year** using the year picker buttons
2. **Select the document type** from the dropdown
3. **Choose one or more files** (PDF or image — JPG, PNG, GIF, BMP, TIFF, WebP)
4. Click **Upload & Process**

The extracted data is parsed and saved automatically. A success/error message appears.

### Supported Document Types

| Document Type | Source | What it extracts |
|---------------|--------|-----------------|
| **ANAF - Tax Declaration D-212** | ANAF portal | Dividends (USD/RON), capital gains, CASS, exchange rate, total tax |
| **US (Fidelity) - Investment Report** | Fidelity (yearly PDF) | Total dividends, taxes withheld, account value, net gains |
| **ANAF - Income Certificate** | Employer (salary document) | Interest income, interest tax paid, gambling income & tax |
| **MSFT - Stock Award Document** | Payslip / benefits portal | Individual stock award withholding entries (dates + amounts in RON) |
| **US (Fidelity) - Trade Confirmation** | Fidelity (per-trade PDF) | Individual trades: date, symbol, shares, price, proceeds, fees. Supports **multiple files** at once. Deduplicates by reference number. |
| **Romania (XTB) - Dividends & Interest** | XTB account (RAPORT DIVIDENDE) | Dividends (gross, tax withheld), interest (gross, tax withheld) |
| **Romania (XTB) - Portfolio** | XTB account (FIȘĂ PORTOFOLIU) | Long-term and short-term capital gains, tax withheld, country breakdown |
| **US (Fidelity) - Statement** | Fidelity (periodic report) | Sold shares, stock transfers (to XTB), dividends YTD, trade totals |
| **US (Morgan Stanley) - Stock Plan Statement** | Morgan Stanley (yearly PDF) | Stock sales (gross, fees, net), RSU releases, dividends, IRS tax withheld |
| **Tax Form - 1042-S** | IRS form | Gross income, federal tax withheld, income code. For dividends (code 06), takes precedence over investment report. |

### Tips
- **OCR Engine:** The app auto-detects PaddleOCR (Full build) or falls back to Tesseract.js (Lite build). The active engine is shown as a badge at the top of the Import tab.
- **Upgrade / Downgrade buttons:** Next to the badge, click **Upgrade to Full** to install PaddleOCR (~1.7 GB download) or **Downgrade to Lite** to remove it — all from within the app, no restart needed.
- **PaddleOCR** provides much better results for scanned documents, especially complex tables like Tradeville Portfolio Statements.
- **Images** (screenshots, photos) are processed using OCR. This takes a few seconds.
- If OCR quality is too low, the app will tell you to enter data manually in the Add Data tab.
- **Trade confirmations** support uploading multiple files at once — each file is parsed separately and appended (with dedup).
- **1042-S forms** are deduplicated by their unique form identifier — re-uploading the same form won't create duplicates.

---

## 9. Tab 6 — Raw Data

View, edit, or delete the raw extracted text from imported documents.

### Controls

| Button | Description |
|--------|-------------|
| **Select File** dropdown | Choose which raw data file to view (e.g., `investment_2025_raw.txt`) |
| **Edit** | Switch to edit mode — the content becomes editable |
| **Save** | Save your changes to the raw text file |
| **Cancel** | Discard changes and return to view mode |
| **Purge** | **Permanently delete** the raw text file AND its associated parsed data. Requires confirmation. |

### What files are stored

Each imported document creates a raw text file in `data/`:
```
adeverinta_2025_raw.txt
declaratie_2024_raw.txt
investment_2025_raw.txt
fidelity_statement_2025_raw.txt
ms_statement_2025_raw.txt
trade_confirmation_2025_raw.txt
xtb_dividends_2025_raw.txt
xtb_portfolio_2025_raw.txt
form_1042s_2025_raw.txt
```

### When to use Purge
- If you imported the wrong document
- If you want to re-import a corrected version (purge first, then re-import)
- Purging `trade_confirmation_*` also clears `trades.json`
- Purging `stock_award_*` also clears `stock_awards.json`

---

## 10. Tax Logic & Rules

### US Dividends (RO-US Double Taxation Treaty)

The Romania-US tax treaty (Convention for Avoidance of Double Taxation) provides:
- The **US withholds 10%** on dividends at source
- **Romania does NOT tax** US dividends again (no double taxation)
- However, US dividends **DO count toward the CASS income threshold**

In practice: you don't owe additional tax on US dividends, but the income is included when determining your CASS tier.

### Romania Broker (XTB) — Final Tax

When stocks are sold through a Romanian broker (XTB):
- Capital gains tax is **withheld by the broker** (1%/3% for 2025, 3%/6% from 2026)
- Dividend tax is **withheld by the broker**
- These are **final taxes** — you do NOT need to declare them in D212
- They only count toward the CASS income threshold

### Capital Gains Calculation Methods

There are 4 scenarios for capital gains from US broker sales:

| Scenario | Formula |
|----------|---------|
| **ESPP (vesting <1yr)** | Taxable = [Sale − Purchase − Fees] × rate − Amount taxed as salary. Tax = Taxable × 10% |
| **ESPP (vesting ≥1yr)** | Taxable = [Sale − Purchase − Fees] × rate. Tax = Taxable × 10% |
| **Stock award (vesting <1yr)** | Taxable = [Sale − Fees] × rate − Amount taxed as salary. Tax = Taxable × 10% |
| **Stock award (vesting ≥1yr)** | Taxable = [Sale − Fees] × rate. Tax = Taxable × 10% |

*"Amount taxed as salary" = values recorded on your payslip as "stock withholding", "SPP gain BIK", or "Stock award BIK".*

### Interest Income

- Bank interest is subject to 10% tax (16% from 2026)
- Banks typically withhold this tax at source
- The amount already paid (from the ANAF income certificate) is deducted from your tax obligation

### CASS (Health Insurance)

- CASS of 10% applies when total net investment income exceeds 6 × minimum gross salary
- The contribution uses a tiered bracket system (see table in Section 6)
- CAS (pension 25%) does **NOT** apply for investment income
- Your Romanian broker does **NOT** withhold CASS — you must declare and pay it yourself via D212

### Tax Rate Changes by Year

| Tax | 2024 | 2025 | 2026+ |
|-----|------|------|-------|
| Dividend tax | 8% | 10% | 16% |
| Capital gains (US broker) | 10% | 10% | 16% |
| Capital gains (RO broker ≥1yr) | - | 1% | 3% |
| Capital gains (RO broker <1yr) | - | 3% | 6% |
| Interest tax | 10% | 10% | 16% |
| CASS (health) | 10% | 10% | 10% |

---

## 11. D212 Form Helper — How to Fill in the Declarație Unică

The D212 Form Helper (located at the bottom of the **Tax Calculation** tab) provides the exact values to copy into the ANAF online form. Click the **"🔗 Open D212 Form on ANAF"** button to open the form directly in a new window.

### Step-by-step: Filing D212 on ANAF portal

1. Click the **"🔗 Open D212 Form on ANAF"** button (or go to [ANAF D212](https://www.anaf.ro/declaratii/duf)) and log in
2. Navigate to **Declarații** → **Declarația Unică 212**
3. Create a new declaration for the fiscal year shown

### Chapter I — Income Tax & Social Contributions

#### Subsection I.2.1: Foreign Income (US)

Copy these values from the **Foreign Income** table in the app:
- Source country: **U.S.A.**
- Exchange rate: RON/USD (BNR annual average)
- **CAPITAL GAINS:** Sale value (USD and RON), already-taxed-as-salary deduction, taxable capital gains, income tax due
- **DIVIDENDS:** Gross dividends (USD and RON), tax due in Romania, US tax paid (10% treaty credit), difference to pay (usually 0)

#### Romania Income (Interest only)

Only **interest income** from the Romanian broker needs to be declared. Stocks and dividends from the Romanian broker are final tax (withheld at source), marked as "Final tax - withheld at source, not declared".

#### Subsection I.3.2: CASS

Copy:
- Minimum salary, total non-salary income, CASS tier, calculation base, CASS due

#### Section I.7: Obligations Summary

Copy the summary amounts:
- US capital gains tax
- US dividend tax to pay
- Interest tax
- Total income tax
- CASS due
- Stock withholding deduction (if any)
- **TOTAL TO PAY** — this is what you must pay by the deadline

### Chapter II — CASS Payment Option (Optional for 2025+)

Starting with D212 for fiscal year 2025, **Chapter II is no longer required**. The app shows:
- If CASS is not due (income below 6×SM), it confirms with ✅
- If you voluntarily want to opt for advance CASS payment, the base and amount are shown

---

## 12. Data Management

### Where data is stored

All data is stored locally in the `data/` folder:

| File | Contents |
|------|----------|
| `parsed_data.json` | Main data store: all years, income, tax rates, exchange rates, parsed documents |
| `trades.json` | Fidelity trade confirmations (per-trade detail) |
| `stock_awards.json` | Stock award withholding entries |
| `*_raw.txt` files | Raw extracted text from imported documents |
| `pdf_metadata.json` | Metadata about source PDF files (paths, sizes) |

### Backup

To back up your data, copy the entire `data/` folder. To restore, paste it back.

### Reset

To start fresh:
1. Delete all files in the `data/` folder
2. Create an empty `parsed_data.json` with content: `{ "years": {} }`
3. Restart the server

### Data flow

```
PDF/Image upload
    ↓
Text extraction (pdf-parse or PaddleOCR / Tesseract OCR)
    ↓
Raw text saved (data/*_raw.txt)
    ↓
Parser extracts structured data
    ↓
Saved to parsed_data.json
    ↓
Frontend computes taxes and renders tables/charts
```

---

## 13. Portable Version

The portable version is a self-contained folder that runs on any Windows 10/11 (64-bit) machine without installing anything.

### Two build variants

| Variant | Command | Size | OCR Engine |
|---------|---------|------|------------|
| **Lite** | `npm run build` | ~174 MB | Tesseract.js only |
| **Full** | `npm run build:full` | ~1.9 GB | PaddleOCR + Tesseract.js fallback |

The **Full** build includes Python Embeddable 3.12 and PaddleOCR for superior OCR on scanned documents (especially Tradeville portfolio tables).

### Contents

| Item | Description |
|------|-------------|
| `node/` | Portable Node.js v22 LTS runtime |
| `app/` | Application files (server, frontend, scripts) |
| `app/python/` | *(Full build only)* Python 3.12 + PaddleOCR |
| `Start.bat` | Launch the application (opens browser automatically) |
| `Stop.bat` | Stop the server |
| `Upgrade-to-Full.bat` | *(Lite build only)* Downloads Python + PaddleOCR to upgrade OCR engine |
| `Downgrade-to-Lite.bat` | Removes Python/PaddleOCR folder to free disk space |
| `README.md` | Quick start instructions |

### Upgrading Lite to Full

You can upgrade in two ways:

**Option A — From the app (recommended):**
1. Open the **Import Document** tab
2. Click the **Upgrade to Full** button next to the OCR badge
3. Confirm when prompted (downloads ~1.7 GB)
4. Wait for installation to complete — the badge will turn green automatically

**Option B — Using the batch file:**
1. Double-click **Upgrade-to-Full.bat**
2. Confirm when prompted
3. Restart the app

### Downgrading Full to Lite

To free disk space (~1 GB+):

**Option A — From the app:**
1. Open the **Import Document** tab
2. Click the **Downgrade to Lite** button
3. Confirm — the python/ folder is deleted and the badge switches to yellow

**Option B — Using the batch file:**
1. Double-click **Downgrade-to-Lite.bat**
2. Restart the app

Your data is preserved in both cases. You can switch back and forth at any time.

### Building a portable version

From the source project:
```bash
npm run build          # Lite build (Tesseract only)
npm run build:full     # Full build (PaddleOCR + Tesseract)
```

The portable version:
- Downloads Node.js v22 LTS automatically
- Copies all application files (no personal data)
- Installs production dependencies
- *(Full build)* Downloads Python Embeddable 3.12 and installs PaddleOCR
- Creates launcher scripts

### Important notes
- The portable version starts with an **empty data folder** — no personal financial data is included
- Your data is stored in `app/data/` within the portable folder — back up this folder

---

## 14. Troubleshooting

### Application won't start

| Problem | Solution |
|---------|----------|
| Port 3000 in use | Set a different port: `PORT=3001 node server.js` |
| Node.js not found | Install Node.js 18+ from https://nodejs.org/ |
| Missing dependencies | Run `npm install` in the D212TaxHelper folder |

### Import errors

| Problem | Solution |
|---------|----------|
| "OCR quality too low" | Use the Full build with PaddleOCR, or upload the text-based PDF version (not a scanned version) |
| Image takes too long | OCR processing requires CPU time. Wait 10-30 seconds. PaddleOCR is faster than Tesseract for most documents. |
| Wrong data extracted | Check the Raw Data tab, edit if needed, or purge & re-import |
| Duplicate trades | Trade confirmations are deduplicated by reference number — duplicates are skipped automatically |

### Data issues

| Problem | Solution |
|---------|----------|
| Wrong year data | Check the year selector in the header — all tabs use this year |
| Manual data not saving | Make sure you click the correct Save button (there are 3 separate forms) |
| Numbers look wrong | Check the exchange rate in Add Data — the rate affects all USD→RON calculations |
| Old data showing | Try the Restart Server button in the footer |

### Server issues

| Problem | Solution |
|---------|----------|
| Page not loading | Check if the server is running (terminal should show "Server running" message) |
| Server crash | Check the `logs/` folder for error details. Restart with `node server.js` |
| Stop.bat kills too much | `Stop.bat` uses `taskkill /f /im node.exe` which stops ALL Node.js processes on the machine |

---

## 15. App Changelog

See the full changelog by clicking the version number in the app footer, or view:
- [CHANGELOG.en.md](CHANGELOG.en.md) (English)
- [CHANGELOG.ro.md](CHANGELOG.ro.md) (Romanian)

### Current Version: v2.4.0 (2026-04-08)

**Major changes:**
- Tradeville Portfolio parser
- Per-country Romania broker gains input with 40 countries
- Free-text broker names with suggestions
- Raw Data as file list with View/Purge
- ANAF D212 form link
- Purge correctly handles per-source trades

### Previous Version: v2.3.0 (2026-04-08)

Initial release with full 6-tab interface, 8 document parsers, bilingual support, dark theme, and portable build.

---

*D212 Tax Helper © 2026 | Contact: edmund.spatariu@microsoft.com*

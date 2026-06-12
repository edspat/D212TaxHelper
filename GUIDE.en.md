# D212 Tax Helper - User Guide

**Guide version:** 3.0 | **App version:** 1.6.0 | **Last updated:** 2026-06-12

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Navigation & Controls](#3-navigation--controls)
4. [Tab 1 - Dashboard](#4-tab-1---dashboard)
5. [Tab 2 - 📥 Data (Add/Edit + Import)](#5-tab-2----data-addedit--import)
6. [Tab 3 - 📊 Calculation (Income Details + Tax & CASS)](#6-tab-3----calculation-income-details--tax--cass)
7. [Tab 4 - 🧾 Submission (Validate & Prepare + Submission Guide)](#7-tab-4----submission-validate--prepare--submission-guide)
8. [Tab 5 - ⚙ Advanced (Raw Data + Rules & References)](#8-tab-5----advanced-raw-data--rules--references)
9. [Tax Logic & Rules](#9-tax-logic--rules)
10. [PFA Support (independent activities)](#10-pfa-support-independent-activities)
11. [Multi-Currency Support (RON / EUR / USD)](#11-multi-currency-support-ron--eur--usd)
12. [ANAF Audit Pack (deterministic ZIP export)](#12-anaf-audit-pack-deterministic-zip-export)
13. [Data Management](#13-data-management)
14. [Portable Version](#14-portable-version)
15. [Troubleshooting](#15-troubleshooting)
16. [App Changelog](#16-app-changelog)

---

## 1. Introduction

**D212 Tax Helper** is a local web application designed to help Romanian tax residents who receive investment income from both **US brokers** (Fidelity, Morgan Stanley) and **Romanian brokers** (XTB, BT Capital Partners, Tradeville) or **foreign brokers** (Revolut) to:

- Import and parse financial documents (PDFs, images, pre-filled DUF XML from ANAF)
- Calculate income tax, capital gains, dividends, interest, and CASS (tiered bracket system)
- Generate the values (and an XML file) needed to fill in the **Declarație Unică D212** on the ANAF portal
- Validate ANAF (DUF) pre-filled values against your own documents and against D205 entries reported by payers
- Compare financial data across multiple fiscal years

### Who is this for?

This application is specifically designed for:
- Employees of US companies with offices in Romania who receive stock awards (RSUs), ESPP shares, and dividends via Fidelity / Morgan Stanley
- Investors who trade through Romanian brokers (**XTB**, **BT Capital Partners**, **Tradeville**) or the foreign broker **Revolut**
- PFA (independent activities) filers who submit D212 alongside investment income
- Anyone filing a D212 for investment income in Romania

### Key features
- **13+ document parsers** — Fidelity (year-end, statement, confirmations), Morgan Stanley Stock Plan, 1042-S (multi-form), XTB (dividends + portfolio), Tradeville, BT Capital Partners, Revolut, ANAF income certificates, D-212, DUF XML
- **5 grouped top-level tabs** — Dashboard · 📥 Data · 📊 Calculation · 🧾 Submission · ⚙ Advanced
- **Validate & Prepare D212** — DUF XML import, side-by-side ANAF vs. local diff, per-payer D205 cross-check
- **D212 XML export** — XML file aligned with the DUF structure (Cap I.1 + Cap I.4 + `<oblig_realizat>` + CASS)
- **D212 Submission Guide** — official DUF flow walkthrough with anonymized screenshots and DUF field-mapping table
- **Rules & References** — searchable page for accountants (Cod fiscal + Instr. D212)
- **ANAF Audit Pack** — deterministic ZIP with everything needed for an audit
- **Source badges + conflict detector** on the Calculation tab
- **Multi-currency support** (RON / EUR / USD) via Romanian brokers (XTB, BT) with BNR rates 2019-2025
- **PFA support** — net income, CASS 6/12/24 SM ladder, art. 180(2) opt-in
- **PaddleOCR** — superior OCR for scanned documents (Full build)
- **Bilingual** — full Romanian (RO) and English (EN) interface
- **Offline & private** — runs entirely on your computer, no data is sent anywhere
- **Dark/Light/Auto theme** — easy on the eyes, responsive design, WCAG 2.1 AA
- **Portable** — can be distributed as a self-contained folder (no installation needed)

---

## 2. Getting Started

### Prerequisites
- **Node.js** 18 or later (recommended: v22 LTS)
- A modern web browser (Chrome, Edge, Firefox)
- OR: use the **Portable version** (includes Node.js, no install required)

### Starting the application

**Option A — Portable version (recommended):**
1. Download the latest `D212TaxHelper-Portable-v*.zip` from [Releases](https://github.com/edspat/D212TaxHelper/releases/latest)
2. Extract the ZIP to any folder
3. Double-click `Start.bat`. The browser opens automatically.

**Option B — From source (requires Node.js):**
```bash
cd D212TaxHelper
npm install          # first time only
node server.js
```

**Option C — Portable version (already installed):**
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
| **Tab buttons (5 groups)** | **Dashboard** · **📥 Data** (sub-tabs: Add/Edit, Import) · **📊 Calculation** (sub-tabs: Income Details, Tax & CASS) · **🧾 Submission** (sub-tabs: Validate & Prepare D212, Submission Guide) · **⚙ Advanced** (sub-tabs: Raw Data, Rules & References). The sub-tab bar appears under the main bar whenever the active group has multiple pages. |
| **Language selector** | Switch between **RO** (Romanian) and **EN** (English). All labels, hints, and translations update instantly. |
| **🖥️/🌙/☀️ Theme toggle** | Cycle between **Auto** (🖥️ follows system preference), **Dark** (🌙), and **Light** (☀️). Choice is saved in your browser. Charts automatically re-render with the new theme colors. |
| **Year selector** | Choose the fiscal year you're viewing/editing. The dropdown shows all years with BNR exchange rates (2019-2025) plus any year with imported data. All tabs update when you change the year. |
| **↩ Reset year** | (Advanced) Deletes all data for the displayed year — raw files, parsed JSON, D205 entries, and trade confirmations. Requires confirmation. |

### Footer bar

| Element | Description |
|---------|-------------|
| **App version** (e.g., v1.1.4) | Click to view the full changelog |
| **Data source** | Shows where data comes from (ANAF, BNR, Fidelity, XTB) |
| **Contact** | Email link to the author |
| **Restart Server** | Restarts the Node.js server (page reloads automatically) |
| **Update banner** | Appears at the bottom of the page when a newer version is available on GitHub. Click **Update** to download and install the new version directly from the app. Your data and documents are preserved. The banner reappears on every startup until you install the update. |
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

## 5. Tab 2 — 📥 Data (Add/Edit + Import)

The **Data** tab groups the two data-entry flows under a single sub-tab bar: **Add/Edit** (manual input) and **Import** (PDF/image/XML upload).

### 5.1 Sub-tab Add/Edit

Use this sub-tab to manually enter or override financial data for the selected year. Data entered here takes precedence over imported document data.

#### Income & Deductions Card

| Field | Description |
|-------|-------------|
| **US Broker** | Select which US broker you use: Fidelity, Morgan Stanley, or None. This determines the broker label shown in Income Details and Tax Calculation. If you upload documents from both brokers, the labels combine automatically. |
| **Romania Broker** | Select which Romanian broker you use: XTB, BT Capital Partners, Tradeville, or None. |
| **US Dividends (USD)** | Total gross dividends received from US broker (Fidelity / Morgan Stanley) |
| **Romania Dividends (RON)** | Total dividends received from Romanian broker |
| **US Stock Sales (USD)** | Total gross proceeds from US stock sales |
| **ESPP Purchase Cost (USD)** | The cost you paid for ESPP shares. For free stock awards, enter 0. This is deducted from sale proceeds to calculate taxable capital gains. |
| **Income Already Taxed as Salary (RON)** | Stock award BIK taxed through Romanian payroll. Auto-calculated from imported Stock Award documents; override here if needed. |
| **Prior Year Capital Losses (RON)** | Capital losses from previous years (max 7-year carryforward). Per D212 Rd.5-6, up to 70% of current year net gains can be offset by prior losses. Enter the total losses still available for carryforward. |
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

### 5.2 Sub-tab Import

Upload PDFs, images or DUF XML to automatically extract financial data.

#### How to import

1. **Select the year** using the year picker buttons
2. **Select the document type** from the dropdown (grouped into 6 optgroups: Fidelity / Morgan Stanley / XTB / BT / Revolut / ANAF)
3. **Choose one or more files** (PDF, image — JPG, PNG, GIF, BMP, TIFF, WebP — or XML for DUF)
4. Click **Upload & Process**

The extracted data is parsed and saved automatically. A success/error message appears. Below the form, the **"Already imported documents"** panel lists processed files for the current year with a delete button per document.

#### Supported Document Types

| Document Type | Source | What it extracts |
|---------------|--------|-----------------|
| **ANAF - Tax Declaration D-212** | ANAF portal | Dividends (USD/RON), capital gains, CASS, exchange rate, total tax |
| **ANAF - Pre-filled DUF XML** | ANAF portal (Preluare/modificare date) | Chapter I.1 (cap11Rows), Chapter I.4 (foreign dividends), `<oblig_realizat>`, CASS — used in the Submission tab diff |
| **US (Fidelity) - Investment Report** | Fidelity (yearly PDF) | Total dividends, taxes withheld, account value, net gains |
| **ANAF - Income Certificate** | Employer (salary document) | Interest income, interest tax paid, gambling income & tax |
| **MSFT - Stock Award Document** | Payslip / benefits portal | Individual stock award withholding entries (dates + amounts in RON) |
| **US (Fidelity) - Trade Confirmation** | Fidelity (per-trade PDF) | Individual trades: date, symbol, shares, price, proceeds, fees. Supports **multiple files** at once. Deduplicates by reference number. |
| **US (Morgan Stanley) - Stock Plan Statement** | Morgan Stanley (yearly PDF) | Stock sales (gross, fees, net), RSU releases, dividends, IRS tax withheld |
| **Romania (XTB) - Dividends & Interest** | XTB account (RAPORT DIVIDENDE) | Dividends (gross, tax withheld), interest (gross, tax withheld), multi-currency support (RON/EUR/USD) |
| **Romania (XTB) - Portfolio** | XTB account (FIȘĂ PORTOFOLIU) | Long-term and short-term capital gains, tax withheld, country breakdown, multi-currency |
| **Romania (BT Capital Partners)** | bt-trade.ro | Trades, dividends, interest through BT broker, multi-currency EUR/USD |
| **Revolut (Consolidated Statement)** | Revolut Securities Europe | Stock sales, dividends (with tax withheld at source), interest |
| **Romania (Tradeville) - Portfolio Statement** | Tradeville | Portfolio, gains/losses, dividends (requires PaddleOCR) |
| **US (Fidelity) - Statement** | Fidelity (periodic report) | Sold shares, stock transfers (to XTB), dividends YTD, trade totals |
| **Tax Form - 1042-S (multi-form)** | IRS form | Gross income, federal tax withheld, income code. Supports PDFs with multiple forms. For dividends (code 06), takes precedence over investment report. |

#### Tips
- **OCR Engine:** The app auto-detects PaddleOCR (Full build) or falls back to Tesseract.js (Lite build). The active engine is shown as a badge at the top of the Import tab.
- **Upgrade / Downgrade buttons:** Next to the badge, click **Upgrade to Full** to install PaddleOCR (~1.7 GB download) or **Downgrade to Lite** to remove it — all from within the app, no restart needed.
- **PaddleOCR** provides much better results for scanned documents, especially complex tables like Tradeville Portfolio Statements.
- **Images** (screenshots, photos) are processed using OCR. This takes a few seconds.
- If OCR quality is too low, the app will tell you to enter data manually in the Add/Edit tab.
- **Trade confirmations** support uploading multiple files at once — each file is parsed separately and appended (with dedup).
- **1042-S forms** are deduplicated by their unique form identifier — re-uploading the same form won't create duplicates.

---

## 6. Tab 3 — 📊 Calculation (Income Details + Tax & CASS)

The **Calculation** tab groups the two analytical views: **Income Details** (per-category breakdown with source badges) and **Tax & CASS** (final calculation + D212 helper).

### 6.1 Sub-tab Income Details

Shows detailed breakdowns of your income with all the numbers behind the calculations.

#### Source badges + conflict detector (new in v1.6.0)

Every displayed figure is accompanied by a **source badge** indicating where the value comes from:
- 🔵 **DUF** — taken from the ANAF pre-filled DUF XML
- 🟢 **Local** — computed from your imported documents (Fidelity, XTB, BT, Revolut, 1042-S, etc.)
- 🟣 **Manual** — entered manually in the Data → Add/Edit tab
- 🟡 **D205** — extracted from the payer's D205 report

When the ANAF (DUF) value **differs** from the locally computed value, a **⚠️ conflict warning** appears with a "See differences" button that opens the side-by-side diff in the Submission tab.

#### Main Income Table

Each row represents an income category:

| Row | USD | RON | US Tax | RO Tax |
|-----|-----|-----|--------|--------|
| US Dividends | ✓ | ✓ (converted) | 10% withheld (treaty) | 0% (no double taxation) |
| Romania Dividends | - | ✓ | - | 8-16% (withheld by broker) |
| Foreign Dividends (other countries) | - | ✓ | per country | per country, with foreign tax credit capped at RO rate |
| US Stock Sales | ✓ | ✓ (converted) | - | 10-16% |
| Romania Stock Sales ≥1yr | - | ✓ | - | 1-3% (final, withheld) |
| Romania Stock Sales <1yr | - | ✓ | - | 3-6% (final, withheld) |
| Interest Income (RO + foreign) | - | ✓ | - | 10-16% |
| Gambling Income | - | ✓ | - | Already withheld |

#### Stock Withholding Deductions

Shows the individual stock award withholding entries from your payslip (imported via **MSFT - Stock Award Document**). These amounts are deducted from your total tax due.

#### Romania Stock Sales

Detailed view of stock trades executed through your Romanian broker (XTB, BT Capital Partners), split by:
- **≥1 year** holding period (lower tax rate)
- **<1 year** holding period (higher tax rate)
- **Dividends** received through the Romanian broker
- **Interest** earned through the Romanian broker
- **Multi-currency** — XTB and BT support RON, EUR and USD; values are converted at the BNR annual average

#### US Stock Sales (Trade Confirmations)

Individual trade-by-trade listing from US broker trade confirmations (Fidelity). Shows date, symbol, shares sold, price, proceeds, fees, and net proceeds.

### 6.2 Sub-tab Tax & CASS

The most important sub-tab — shows exactly what you owe and provides the D212 form helper.

#### Tax Calculation Summary

Divided into 3 clearly labeled sections:

##### 💰 Section A: What I Earned (Gross Income)
Lists all income categories with their RON values:
- US capital gains, US dividends
- Romania capital gains (≥1yr and <1yr), Romania dividends
- Foreign dividends (other countries), broken down per country
- Interest income, gambling income
- Net PFA income (if enabled — see Section 10)
- **Total Investment Income**

##### ✅ Section B: Already Paid (Withheld at Source)
Shows what has already been collected:
- US dividend tax withheld (10% per RO-US treaty)
- Foreign dividend tax withheld (per country, with foreign tax credit)
- Romania broker capital gains tax (final tax, 1%/3%)
- Romania broker dividend tax
- Interest tax withheld
- Stock award withholdings
- **Total Already Paid**

##### 📝 Section C: Still to Pay (D212 Obligations)
What remains to declare and pay:
- US capital gains tax (10%)
- US dividend tax (usually 0 — treaty)
- Foreign dividend tax (difference if foreign withholding < RO rate)
- Romania broker items (marked as "Final tax - withheld at source, not declared")
- Interest tax remaining
- Investment CASS (3 tiers) and PFA CASS (4 tiers, if active)
- PFA income tax (10%)
- Stock withholding deduction
- **⚠ TOTAL TO PAY ON D212** — this is the number that matters

##### Payment Deadline
Displayed at the bottom — the D212 filing and payment deadline (e.g., May 25, 2026 for fiscal year 2025).

#### CASS (Health Insurance Contribution)

Detailed breakdown of the CASS calculation:
- Shows the minimum gross salary and the tier system
- Highlights your active tier
- Shows the CASS amount due (separately for investment vs. PFA)
- Lists which income types are subject to CASS
- Confirms CAS (pension 25%) does NOT apply to investment income (it only applies to PFA when net income > 12 SM)

**CASS Tier System for Investment Income (2025):**

Per D212 instructions pct. 52.1.1–52.1.3, investment income CASS is capped at **24SM** (3 tiers).
The 60SM tier applies only to independent activities (PFA, see Section 10), not investment income.

| Tier | Income Range | CASS Base | CASS Amount |
|------|-------------|-----------|-------------|
| <6 SM | < 24,300 RON | - | 0 |
| 6-12 SM | 24,300 - 48,600 | 24,300 | 2,430 |
| 12-24 SM | 48,600 - 97,200 | 48,600 | 4,860 |
| ≥24 SM | ≥ 97,200 | 97,200 | 9,720 |

*SM = minimum gross salary (4,050 RON/month in 2025)*

#### D212 Helper (legacy mode)

The classic D212 helper (step-by-step text to copy) is still available here, but for fiscal year 2025+ we recommend using the **Submission → Validate & Prepare D212** tab and the XML export (see Section 7).

---

## 7. Tab 4 — 🧾 Submission (Validate & Prepare + Submission Guide)

The **Submission** tab is **new in v1.6.0** and groups the complete flow for preparing and submitting D212. It contains two sub-tabs.

### 7.1 Sub-tab 🔬 Validate & Prepare D212

This sub-tab is the central hub for reconciling **ANAF (DUF pre-filled XML)** values with **local (computed from your documents)** values and choosing what to submit to ANAF.

#### Step 1 — Import DUF XML

1. Log in to the ANAF portal → **Declarația Unică 212** → **Preluare/modificare date** → download DUF XML
2. Use the **"Import DUF XML"** button at the top of the sub-tab (or upload the file from the Data → Import tab)
3. The app parses:
   - `cap11Rows` (Chapter I.1 — Romania capital gains per transaction)
   - Chapter I.4 (foreign dividends per country, with foreign tax credit)
   - `<oblig_realizat>` block (obligation summary, CASS, final tax)
   - Personal data (CNP, address, IBAN) — Chapter I.5

#### Step 2 — Side-by-side ANAF vs. Local diff

For every row and value, the app displays a three-column table:
- **ANAF (DUF)** — what ANAF pre-filled
- **Local** — what the app calculated from your documents
- **Selector** — radio button to pick which version to use in the final XML

Differences are visually highlighted:
- ✅ **Identical** — ANAF and local match
- ⚠️ **Small difference** (< 10 RON) — probably rounding
- 🔴 **Large difference** — requires attention

#### Step 3 — Per-payer D205 cross-check

The app reads all D205 entries reported by payers (extracted from DUF or uploaded manually) and matches them against your per-payer (CUI/CIF) calculations. The matcher has 5 levels:
- 🟢 **Exact** — amounts match perfectly
- 🟡 **Near** — difference < 5%
- 🟠 **Possible** — difference 5-20%
- 🔴 **ANAF only** — payer reported by ANAF but no local document
- 🔵 **Local only** — local calculation with no matching D205 report

#### Step 4 — Export D212 XML

Click **"📤 Export D212 XML"**. The app emits an XML file 100% aligned with the DUF structure:
- Cap I.1 (`cap11Rows`) with RO per-transaction gains/losses
- Cap I.4 with foreign dividends per country (foreign tax credit capped at RO rate)
- `<oblig_realizat>` block with obligation summary + investment CASS
- Personal data (CNP, IBAN, address)

This XML can be uploaded directly to the ANAF portal under "Import declarație".

### 7.2 Sub-tab 🧾 D212 Submission Guide

Step-by-step walkthrough of the official DUF flow with **anonymized screenshots** and a **DUF field-mapping table** (ANAF field → app field):

1. **Authenticate** on the ANAF portal with digital certificate
2. **Preluare/modificare date** — download DUF XML
3. **Chapter I — Personal data and income** — DUF fields mapped to app values
4. **Chapter I.1 — RO capital gains** — `cap11Rows` rows
5. **Chapter I.4 — Foreign dividends** — per country, with foreign tax credit
6. **Obligation summary** — `<oblig_realizat>`, CASS, final tax
7. **Submission** — export XML from the app → import on ANAF portal → verify → sign → submit
8. **Payment** — generate payment order, due May 25

All screenshots are anonymized (CNP/IBAN/name redacted) and are bundled with the app under `public/assets/screenshots/`.

---

## 8. Tab 5 — ⚙ Advanced (Raw Data + Rules & References)

The **Advanced** tab groups two tools for power users and accountants: **Raw Data** (file inspection/editing) and **Rules & References** (tax rules catalog).

### 8.1 Sub-tab Raw Data

View, edit, or delete the raw extracted text from imported documents.

#### Controls

| Button | Description |
|--------|-------------|
| **Select File** dropdown | Choose which raw data file to view (e.g., `investment_2025_raw.txt`) |
| **Edit** | Switch to edit mode — the content becomes editable |
| **Save** | Save your changes to the raw text file |
| **Cancel** | Discard changes and return to view mode |
| **Purge** | **Permanently delete** the raw text file AND its associated parsed data. Requires confirmation. |

#### What files are stored

Each imported document creates a raw text file in `data/`:
```
adeverinta_2025_raw.txt
declaratie_2024_raw.txt
investment_2025_raw.txt
fidelity_statement_2025_raw.txt
trade_confirmation_2025_raw.txt
xtb_dividends_2025_raw.txt
xtb_portfolio_2025_raw.txt
bt_trades_2025_raw.txt
revolut_statement_2025_raw.txt
form_1042s_2025_raw.txt
duf_2025_raw.xml
```

#### When to use Purge
- If you imported the wrong document
- If you want to re-import a corrected version (purge first, then re-import)
- Purging `trade_confirmation_*` also clears `trades.json`
- Purging `stock_award_*` also clears `stock_awards.json`
- To delete **ALL** data for a year, use the **↩ Reset year** button in the header (faster)

### 8.2 Sub-tab Rules & References (new in v1.6.0)

A **searchable** page dedicated to accountants and users who want to verify the legal basis of each computation. Every rule displays:
- **Rule ID** (e.g., `R-CASS-INV-24SM`)
- **Human description**
- **Tax Code article** (e.g., Art. 170 alin. (1) Cod fiscal)
- **D212 Instructions paragraph** (e.g., pct. 52.1.2)
- **Application example** (when available)

#### Rule categories
- **Income tax** — dividends, interest, capital gains (rates 2019-2026+)
- **Investment CASS** — 6/12/24 SM tiers, cap, excludes finally-withheld income
- **PFA CASS** — 6/12/24/60 SM tiers, art. 180(2) opt-in
- **Foreign tax credit** — capped at RO rate, per country, proof of foreign withholding
- **Loss carryforward** — up to 70% of current-year gains, 7-year carryforward
- **D205** — income categories, per-payer mapping

#### Search
The search bar filters rules in real time by ID, description, article, or keyword.

---

## 9. Tax Logic & Rules

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

*"Amount taxed as salary" = values recorded on your payslip as "Stock award BIK" and/or "ESPP gain BIK". These represent the income (FMV at vesting) already taxed as salary, and are deducted from capital gains as cost basis per D212 Rd.2 "Cheltuieli deductibile". Note: "Stock withholding" is the tax paid on the BIK (shown as "already paid"), not the cost basis.*

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

## 10. PFA Support (independent activities)

**New in v1.6.0.** The app supports **PFA** filers (Persoană Fizică Autorizată — independent activities in real system, art. 64-67 Tax Code) who declare PFA income alongside investment income on the same D212.

### Activation

In the **Data → Add/Edit** sub-tab, there is a new card **"PFA Income — independent activities"**. Check the **"I have PFA income for this year"** option to enable it.

### Fields

| Field | Description |
|-------|-------------|
| **Gross PFA Income (RON)** | Total receipts from independent activity (real system) |
| **Deductible Expenses (RON)** | Expenses related to the activity (rent, utilities, materials, etc.) |
| **Net PFA Income (RON)** | Auto-calculated: Gross − Expenses. Editable if you declare net directly. |
| **Art. 180(2) opt-in** | Checkbox for those who voluntarily opt to set the CASS base = net income (instead of tier) |
| **CAS (pension)** | Auto-applied if net income > 12 SM. 25% rate on the chosen base. |

### PFA CASS Tier System (2025)

**Different** from investment tiers — PFA has 4 tiers, paid voluntarily below 6 SM:

| Tier | Net Income Range | CASS Base | CASS Amount (10%) |
|------|------------------|-----------|-------------------|
| <6 SM | < 24,300 RON | voluntary (6 SM) | 2,430 (optional) |
| 6-12 SM | 24,300 - 48,600 | 24,300 | 2,430 |
| 12-24 SM | 48,600 - 97,200 | 48,600 | 4,860 |
| 24-60 SM | 97,200 - 243,000 | actual net income | 10% × net |
| ≥60 SM | ≥ 243,000 | 243,000 (cap) | 24,300 |

### Impact on D212

- Net PFA income is added to **Chapter I.1** of D212 as income from independent activities
- PFA CASS and CAS (if applicable) are **separate** from investment CASS — both appear in the obligation summary
- The XML exported from the Submission tab includes the `<venituriActivitatiIndependente>` block plus the corresponding contributions

---

## 11. Multi-Currency Support (RON / EUR / USD)

**Extended in v1.6.0.** Romanian brokers **XTB** and **BT Capital Partners** may report trades in multiple currencies (RON, EUR, USD). The app auto-detects the currency per line and converts at the BNR annual average rate.

### Built-in BNR rates

| Year | EUR/RON | USD/RON |
|------|---------|---------|
| 2019 | 4.7452 | 4.2379 |
| 2020 | 4.8371 | 4.2440 |
| 2021 | 4.9204 | 4.1604 |
| 2022 | 4.9315 | 4.6884 |
| 2023 | 4.9465 | 4.5683 |
| 2024 | 4.9750 | 4.5982 |
| 2025 | 5.0700 | 4.6700 (provisional) |

### How it works

1. The broker parser detects the line currency (from `RON`/`EUR`/`USD` symbol or currency column)
2. Conversion is done using the BNR annual average rate — transparent in the **Income Details** tab (currency badge + applied rate)
3. Dividends withheld in EUR or USD via a Romanian broker are converted to RON and added to the `dividendePrinBrokerRO` total
4. The conflict detector flags when the converted value differs from what ANAF reported (DUF)

### Notes

- For **foreign** brokers (Fidelity, Morgan Stanley, Revolut), conversion uses the BNR rate per fiscal year
- For **Romanian** brokers, foreign-currency dividends (e.g. Microsoft dividends via XTB) are final taxes (withheld by the broker) and are not redeclared

---

## 12. ANAF Audit Pack (deterministic ZIP export)

**New in v1.6.0.** For the case where ANAF asks for supporting documents (generally 5 years after filing), the app can generate a **deterministic ZIP** containing everything needed for an audit.

### How to generate

In the **🧾 Submission → 🔬 Validate & Prepare D212** tab, after exporting the XML, an **"📦 Export ANAF Audit Pack"** button appears. Click → `D212-AuditPack-{Year}-{Hash}.zip` is saved.

### Contents

The ZIP includes (in an explicit hierarchical structure):

```
D212-AuditPack-2025-abc123/
├── README.txt                    # Pack index + checksums
├── manifest.json                 # App version, export date, fiscal year, hash
├── raw/                          # Raw files of imported documents
│   ├── investment_2025_raw.txt
│   ├── trade_confirmation_2025_raw.txt
│   ├── xtb_dividends_2025_raw.txt
│   └── … (all _raw.txt files)
├── parsed/                       # Parsed JSON data
│   ├── parsed_data_2025.json
│   ├── trades_2025.json
│   └── stock_awards_2025.json
├── d205/                         # D205 entries per payer
│   └── d205_2025.json
├── d212/                         # Generated D212 XML
│   ├── d212_2025.xml
│   └── d212_2025_anaf_duf.xml    # Original ANAF DUF (if imported)
└── trace/                        # Rule application trace
    ├── rules_applied.json        # Applied rules with Tax Code citations
    └── calculation_audit.json    # Step-by-step calculation income → tax → CASS
```

### Determinism

The ZIP is **bit-identical** on repeated export against the same data:
- File timestamps are fixed at `1980-01-01 00:00:00` (ZIP constant)
- File order is stable alphabetical
- CRC32 computed per file
- SHA256 hash of the ZIP appears in the filename and manifest

This allows **integrity verification** on ANAF request — the accountant can re-run the export and compare the hash.

### Implementation

The ZIP is created with the in-house implementation `lib/minizip.js` — **zero external dependencies** — to guarantee the same output regardless of Node.js version or platform.

---

## 13. Data Management

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

## 14. Portable Version

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
| `README.md` | Quick start instructions (Romanian) |

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

## 15. Troubleshooting

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

## 16. App Changelog

See the full changelog by clicking the version number in the app footer, or view:
- [CHANGELOG.en.md](CHANGELOG.en.md) (English)
- [CHANGELOG.ro.md](CHANGELOG.ro.md) (Romanian)

### Current Version: v1.6.0 (2026-06-12)

**Major changes brought by the develop branch on top of the initial v1.6.0 cut (2026-05-12):**
- **🗂️ Navigation refactored** — 6 flat tabs → 5 grouped tabs (Dashboard · Data · Calculation · Submission · Advanced) with sub-tabs
- **🧾 D212 Submission Guide** — official DUF flow walkthrough with anonymized screenshots
- **🔬 Validate & Prepare D212** — DUF XML import, side-by-side ANAF vs. local diff, ANAF/Local selector per row, D205 cross-check
- **📤 D212 XML export** — emits XML 100% aligned with DUF structure (cap11Rows, cap14, oblig_realizat, CASS)
- **📥 Data tab in two modes** — Add/Edit + Import with “Already imported documents” panel
- **🆕 New brokers** — BT Capital Partners (bt-trade.ro) and Revolut Securities Europe (consolidated statement)
- **💼 PFA Support** — independent activities, CASS 6/12/24/60 SM ladder, art. 180(2) opt-in
- **⚖️ Rules & References page** — searchable catalog with Cod fiscal + Instr. D212 citations
- **📦 ANAF Audit Pack** — deterministic ZIP export (stable CRC + timestamps) for audits
- **🔢 Calculation refactor** — source-resolver: every value knows where it came from (DUF/Local/Manual/D205)
- **💱 Multi-currency via RO broker** — EUR and USD via XTB and BT with BNR rates 2019-2025
- **🐛 1042-S parser fixes** — multi-form PDF support, deduplication per unique ID
- **🧪 Tests** — expanded suite with 100+ node:test tests (zero deps)
- **🛡️ CI/hygiene** — Node 18/20/22 matrix on ubuntu-latest + `pr-cleanliness` job
- **🛠️ New internal modules** — `lib/source-resolver.js`, `lib/rules-catalog.js`, `lib/d205-matcher.js`, `lib/d212-xml-builder.js`, `lib/audit-pack-builder.js`, `lib/minizip.js`

### Previous Version: v1.5.3 (2026-04-19)

Detailed hover tooltips on all income rows (withholding, credits, deductions), interest tax paid manual input, charts hidden when no data, 40% deduction footnote with example on rental/royalty rows, 4 new income types, ANAF tax compliance fixes, dashboard overhaul.

---

*D212 Tax Helper © 2026 | Contact: spatariu74@gmail.com*

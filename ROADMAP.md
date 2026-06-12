# Roadmap

> A living document. Pull requests welcome on every item. If something on this list looks wrong or your priority differs, open an issue or edit this file directly — better-informed contributors should keep it honest.

This page lists the work we know about, sorted by priority. The detailed *mapping* between the official ANAF D212 specification and the app lives in [`docs/d212-mapping.md`](docs/d212-mapping.md); the deep dive on every Cod fiscal article and Instructiuni paragraph behind each computation will live in the "Rules & References" page (see P2 below) once it ships.

---

## How to read this list

| Column | Meaning |
|---|---|
| **Impact** | 🔴 High (real money / correctness) · 🟡 Med (quality of life or D212 compliance) · 🟢 Low |
| **Effort** | 🟢 Low (single PR, < 1 day) · 🟡 Med (3-7 commits) · 🔴 High (multi-PR, design + tests) |
| **Status** | `open` · `claimed by @user` · `in review` · `done (commit XXXXXXX)` |

## How to claim a task

1. Open an issue titled `[Roadmap] <task title>` and reference the section below (`#d-1` etc.)
2. Edit this file: change `open` to `claimed by @yourhandle, issue #N`
3. Submit a PR with the implementation. Include tests where the task touches `lib/`, `server.js` or `public/js/app.js`.

## How to propose a new item

Open an issue titled `[Roadmap proposal] <short description>`. Include:

- **Why** it matters (audit trail to a Cod fiscal article, a real-money scenario, or a UX pain point)
- **Acceptance criteria** (what "done" looks like in one paragraph)
- A guess at impact / effort
- Optional: a `pierde` flag if it blocks something you're trying to do now

The maintainers will add accepted proposals to this file as part of merging the issue.

## Onboarding crash-course (read this once before claiming your first task)

If this is your first PR, these are the load-bearing rules and idioms in the codebase:

- **Single source of truth for tax constants:** [`lib/rates.js`](lib/rates.js) — BNR exchange rates (annual averages, 2019-2025), `parseNumber`, `toRON`, `detectCurrency`. Don't duplicate these elsewhere; import them.
- **D212 specification ground truth:** [`docs/anaf/d212-2025/`](docs/anaf/d212-2025/) — the official XSD, schematron rules, technical structure and filling instructions PDF. Every claim in `docs/d212-mapping.md` cites a paragraph in here. If a regulation question comes up, this folder answers it before any third-party blog does.
- **The mapping doc is gospel:** [`docs/d212-mapping.md`](docs/d212-mapping.md) — read § 1-5 in full before changing any computation. It maps every BT-code from the XSD to the corresponding app field.
- **The single big compute function:** [`public/js/app.js: computeYearData`](public/js/app.js) (around line 580-1020). All tax math flows through here. If you change a formula, change it here first.
- **Tests are `node:test`, zero deps:** `npm test`. Add a test for every formula or parser change. Synthetic fixtures live in [`test/fixtures/`](test/fixtures/).
- **i18n must stay green:** `npm run check-i18n` after any UI change. All user-facing strings have RO + EN keys.
- **Portable build is downstream of source:** any source change must be mirrored into `../D212TaxHelper-Portable-Full/app/` for the portable variant to pick it up. (We do this manually for now; see the [P4 skill task](#p4) for a future automation.)
- **Pitfalls discovered the hard way:**
  - Regex word boundary `\b` does **not** treat Romanian diacritics (`î`, `ă`, `ș`) as word characters in JavaScript without the `/u` flag. Use `(?:^|\s)` instead of `\b` before such characters. See commit `03e467a` for the fix.
  - `Math.max(0, owed - paid)` hides over-withholding scenarios. Use signed deltas when surfacing refunds. See commit `65cdcaa`.
  - Romanian capital-gains losses can only offset gains "of the same nature" (Cod fiscal art. 119). RO losses → RO gains; foreign losses → foreign gains. Don't pool them.

---

## 🚀 Recently shipped (since v1.5.x)

These are documented for context — they are NOT pending. See `docs/d212-mapping.md` for the up-to-date compliance picture.

| What | Commit | Why it matters |
|---|---|---|
| BT Trade added to Romanian broker list | `bc16d66` | Real ask from a user with a BT Trade account |
| Romania EUR/USD income support (dividends, interest, capital gains) | `52a2908` | XTB and similar brokers can report income in any of the three currencies |
| XTB report parsers — multi-row, multi-currency | `6e9ff82` | Old parser captured only the first country row; users with multiple countries (e.g. Irlanda + USA) were silently losing data |
| Capital gains use `net = max(0, gain - loss)` per long/short bucket | `c501d3c` | Surfaces current-year carryforward losses correctly |
| **Refund detection** — Romanian broker over-withholding | `65cdcaa` | 🔴 Real money. The user's 2025 sample had ~1,644 RON refundable that was previously hidden behind `Math.max(0, ...)` |
| **Prior-year capital losses applied to current tax** (D212 Rd.5-6) | `255dcca` | 🔴 Real money. `yd.priorLosses` was collected but never used in the computation. Implements the official `min(Rd.5, 0.70 × Rd.3)` formula from Instr. 7.3.3 |
| Import / manual override warning with side-by-side diff dialog | `46b9705` | Prevents accidental data loss when re-importing |
| Anonymized XTB PDF fixtures + 35 unit/e2e tests | `7c45c60` + `03e467a` | First test suite in the project. `node:test`, zero new deps |
| Comprehensive D212 mapping document | `c1f46e3` + `29a5609` | Single source of truth for what the app does vs. what ANAF expects |
| Official ANAF reference documents in repo (`docs/anaf/d212-2025/`) | `a5c33f7` | XSD, schematron rules, instructions PDF — versioned, diff-able on future ANAF releases |

---

## 📋 Next up — D212 compliance gaps

Numbered to match [`docs/d212-mapping.md` § 9](docs/d212-mapping.md#9-gap-analysis--recommendations).

### D-3 — Per-country, per-category grouping in cap14 generation 🟡 Med · 🟡 Med · `open` <a id="d-3"></a>

ANAF expects one `cap14` row per (country × income category). Today we lump everything under "US" in the computation when the user has multiple foreign sources.

**Files to touch**
- `public/index.html` — the "Adăugă Date" form, fieldset around the foreign income inputs
- `public/js/app.js` — `populateForm()` (~line 2370), `handleDataSubmit()` (~line 2540), `computeYearData()` (~line 580)
- `lib/rates.js` — may need a small helper to validate country ISO2 codes
- `public/locales/{ro,en}.json` — labels for the new dropdown
- `test/` — add unit tests for the multi-country aggregation in `computeYearData`

**Official references**
- XSD: `docs/anaf/d212-2025/D212.xsd` lines 1164-1259 — definition of `cap14` complex type (17 attributes)
- BT codes: `den_stat` (BT-05001), `str_stat_realiz_v` (BT-05002 — required ISO2 like `US`, `IE`, `DE`), `str_categ_venit` (BT-05004 — see D-4)
- Instructions: `docs/anaf/d212-2025/Instructiuni_D212_OMF_2736_2025.pdf` § 39 onwards

**Suggested data shape** (replaces today's flat `yd.usGains`, `yd.fidelityDividends`, …)
```js
yd.foreignIncome = [
  { country: 'US', categCode: '2012', currency: 'USD', grossAmount: ..., deductible: ..., taxPaidAbroad: ... },
  { country: 'US', categCode: '2018', currency: 'USD', grossAmount: ..., taxPaidAbroad: ... },
  { country: 'DE', categCode: '2018', currency: 'EUR', grossAmount: ..., taxPaidAbroad: ... },
];
```
Keep the legacy flat fields as a fallback during the transition (the parsers still produce them).

**Pitfalls**
- ISO2 country codes are 2 chars (`C2Type` in XSD). Don't use `RO` (Romanian source belongs in cap11, not cap14).
- `dubla_impunere` field (BT-05005) value `1` = credit method, `2` = exemption method. US treaty uses credit; default is `1`.

**Acceptance**
- A user with US dividends + EU dividends sees two rows on "Adăugă Date".
- `computeYearData` aggregates them separately into `cap14`-like records.
- Tests: at minimum 3 cases — single country single category, single country multi-category, multi-country.

### D-4 — Emit `str_categ_venit` codes beyond 2012/2018 🟡 Med · 🟢 Low · `open` <a id="d-4"></a>

Parsers hardcode `2012` (capital gains) and `2018` (dividends). For interest, royalties, etc. no code is set. Needed for D-7 (XML export).

**Files to touch**
- `lib/rates.js` — add a `CATEG_VENIT_LABELS` constant exporting `{ '2012': 'Câștiguri din transferul titlurilor de valoare', '2018': 'Venituri din dividende', ... }`
- `lib/parsers/xtb.js` — when emitting a cap14-like record, set the right code
- `server.js: parseForm1042S, parseFidelityStatement, parseMSStatement` — tag with correct codes
- `test/rates.test.js` — assert the label lookup works
- `test/parsers-xtb.test.js` — assert each parser sets the correct code

**Official references**
- Code whitelist: `docs/anaf/d212-2025/codes/d212-codes.sch` line 457-460 (19 valid codes)
- Labels: `docs/anaf/d212-2025/d212_docTehnica_v1.0.8_17042026.xls`, sheet "Nomenclator_venituri_STR" — extract once into the JS constant (do not require the xlsx at runtime)

**Decoded so far** (from existing comments in `server.js` and `docs/d212-mapping.md`)
- `2012` — Câștiguri din transferul titlurilor de valoare
- `2018` — Venituri din dividende — dubla impunere
- The other 17 codes need decoding from the XLS

**Suggested approach**
1. Open `d212_docTehnica_v1.0.8_17042026.xls` in LibreOffice / Excel, locate the Nomenclator_venituri_STR sheet
2. Manually transcribe the 19 codes + Romanian labels into `lib/rates.js`
3. Run `npm test` — the existing tests will catch missing entries via a new `CATEG_VENIT_LABELS` assertion

**Pitfalls**
- Codes are 4-digit strings (`N4Type`), not integers. Don't drop leading zeros.
- The label is required for `den_categ_venit` (BT-05003), which is `C500Type` in the XSD.

### D-5 — Split loss carryforward foreign vs. RO 🟡 Med · 🟡 Med · `open` <a id="d-5"></a>

Per Cod fiscal art. 119 and Instr. 7.3.3: losses can only offset gains "of the same nature". Today `yd.priorLosses` is one number applied to RO gains only. Foreign losses need their own pool.

**Files to touch**
- `public/index.html` — split the single "Pierderi reportate" input into two: RO and foreign
- `public/js/app.js: computeYearData` — find the section around the existing `priorLossesAvailable` (look for "D212 Rd.5-6" comment in commit `255dcca`) and apply each pool to its own gains bucket
- `public/locales/{ro,en}.json` — add labels: "Pierderi reportate (broker RO)" / "Pierderi reportate (străinătate)"
- `test/` — add a test where both pools are present and verify they apply independently

**Official references**
- Cod fiscal **art. 119 alin. (2)**: "Pierderile nete anuale din transferul titlurilor de valoare ... reportate în următorii 7 ani fiscali consecutivi" + "of the same nature" rule
- Instructions: `Instructiuni_D212_OMF_2736_2025.pdf` § 7.3.3 (RO source, page 17) and the equivalent paragraph for cap14 (foreign source — find by searching for "pierdere fiscală compensată" in `Instructiuni_D212_OMF_2736_2025.pdf` after page 17)
- XSD: `cap11.pierdere_precedenta` (BT-03022) and `cap14.str_pierdere_precedenta` (BT-05012) are separate attributes

**Migration path**
- Existing `yd.priorLosses` field stays as `yd.priorLossesRO` (rename + add compat reader)
- New `yd.priorLossesForeign` added
- Update `manualFields` whitelists in `server.js: app.put('/api/data/:year')` (~line 306, 396)

**Acceptance**
- Income Details shows both pools and their applied amounts; both have separate "remaining for carryforward" displays.
- Test that priorLossesRO does NOT offset US gains, and vice versa.

### D-6 — Romanian-source investment income declared on cap11 🔴 High · 🟡 Med · `done — capital gains side` <a id="d-6"></a>

XTB/Tradeville/BT Trade withhold tax at source ("impozit final"), but the income still counts toward the CASS base and must be declared on cap11 (with `impozit_retinut` set). Today the app skips cap11 entirely for these users, which means the **CASS base is potentially under-declared** for users who only have RO-broker income.

**Files to touch**
- `public/js/app.js: computeYearData` — already computes the right numbers (the refund flow uses them). Add a `cap11Rows[]` output structure mirroring `cap14`'s per-row shape.
- `server.js` — when D-7 ships, the XML emitter will read `cap11Rows`.
- `docs/d212-mapping.md` — flip gap #6 to "in progress" then "done" when this lands.

**Official references**
- XSD: `cap11` element, lines 849-995 in `D212.xsd`. 28 attributes; the relevant ones for investment income:
  - `categ_venit` (BT-03004) — code from Nomenclator_venituri_RO (different list from str)
  - `venit_brut` (BT-03018) — Rd.1
  - `pierdere_compensata` (BT-03023) — Rd.6 (use the formula already implemented for `data.priorLossesApplied`)
  - `impozit11` (BT-03026) — Rd.8 calculated tax (1%/3% × Rd.7)
  - `impozit_retinut` (BT-03027) — Rd.9 broker withholding (already in `data.roPortTaxWithheld`)
- Instructions: `Instructiuni_D212_OMF_2736_2025.pdf` § 7 (Subsection 1.5 — transferul titlurilor de valoare) for capital gains; check earlier subsections for dividends/interest categories
- Nomenclator codes for cap11: search `d212_docTehnica_v1.0.8_17042026.xls` sheet "Nomenclator_venituri_RO" (note: RO not STR)

**Pitfalls**
- The "impozit final" wording in everyday speech does NOT mean "skip D212". It means the broker's withholding is the final tax rate — the user still must declare it on cap11 for CASS purposes (and to claim regularization if applicable, which we already do via the refund flow).

**Acceptance**
- A user with XTB-only income sees a `cap11Rows[]` array in the computed data with the correct `venit_brut`, `pierdere_compensata`, `impozit11`, `impozit_retinut`.
- D-7 export uses it to emit a valid cap11 element.

**Status (shipped)**
- ✅ `lib/d212-cap11.js: buildCap11Rows({...})` — pure helper, returns 0-or-1 row (Schematron BR-D212-0085 uniqueness of `categ_venit=1012`).
- ✅ `public/js/app.js: computeYearData` — inline mirror, populates `data.cap11Rows`.
- ✅ `public/index.html` + render — new section "D212 Cap. I §1.1 — cap11" on the Calcul Impozite tab shows Rd.1..Rd.9 when the row is non-empty.
- ✅ Tests: 8 cases in `test/d212-cap11.test.js` covering empty / gain-only / prior-loss / cross-bucket-loss / over-withholding / loss-only / prior-loss-only / categ_venit format.
- Dividends + interest with "impozit final" deliberately remain off cap11 — they are not in Nomenclator_venituri_RO for individuals; they feed only the CASS base (Cap. II), already covered.

### D-7 — D212 XML export 🔴 High · 🔴 High · `done — skeleton level` <a id="d-7"></a>

Emit a partial XML conforming to `docs/anaf/d212-2025/D212.xsd` that the user can import directly into the official ANAF PDF tool.

**Files to touch**
- `public/js/app.js` — new `exportD212Xml(selectedYear)` function that consumes the computed `cap11Rows[]` + `cap14Rows[]` from D-6 and D-3
- `public/index.html` — new "Exportă D212 XML" button on the Tax Calculation page
- `lib/d212-xml-builder.js` (NEW) — small module that produces a string XML; no external XML library needed (the schema is simple attributes)
- `lib/d212-validator.js` (NEW, optional but recommended) — runs the schematron rules from `docs/anaf/d212-2025/business/*.sch` against the built XML and reports errors inline before download
- `test/d212-xml-builder.test.js` (NEW) — assert against a golden expected XML

**Official references**
- Full XSD at `docs/anaf/d212-2025/D212.xsd`
- Namespace: `xmlns="mfp:anaf:dgti:d212:declaratie:v11"`
- Root element required attributes (BR-D212-0006, 0005): `an_r="2026"`, `luna_r="12"` for fiscal year 2025
- Bifa flags must match presence of capitole: `bifa121=1 ↔ cap14 exists` (BR-D212-0009), `bifa111=1 ↔ cap11 exists` (BR-D212-0007), etc.
- `totalPlata_A` (BT-00004) = sum of digits of `cif` (BR-D212-0004) — but since we don't collect `cif`, leave blank and let the user fill in
- Validation rules: `docs/anaf/d212-2025/business/d212-business*.sch` — 76 rules total

**Dependencies**
- D-3 (per-country grouping) — needed to produce one cap14 row per (country, category)
- D-4 (categ_venit codes) — needed to set the right `str_categ_venit` / `categ_venit` attributes
- D-6 (cap11 emission) — needed if user has Romanian-broker income
- D-8 (personal data, optional) — without it, the user gets a "skeleton" XML they still need to fill out partially

**Pitfalls**
- ANAF schema uses **integer RON only** (no decimals) — `N15Type` = up to 15 digits, no decimal point. Use `Math.round()` on every numeric attribute.
- Date format is `DD/MM/YYYY` (`D10Type`), not ISO `YYYY-MM-DD`. Slashes, not dashes.
- Empty attributes should be **omitted** from the XML, not set to empty strings — the validator treats `""` differently from absent.
- XML must validate against both the XSD (structure) AND the schematron rules (cross-field consistency). The XSD-only validation is necessary but not sufficient.

**Acceptance**
- Build a sample XML for the user's 2025 data; import it into the official ANAF PDF tool with no errors.
- All 76 BR-D212-* rules pass (where applicable to the data).
- The user fills in only personal data ANAF-side and signs.

**Status (shipped — skeleton level)**
- ✅ `lib/d212-xml-builder.js: buildD212Xml({...})` — emits `<d212>` root with all 13 required `bifa*` flags (auto-set based on presence of capitols), placeholder personal data with a leading TODO comment, and a self-closing `<cap11>` / `<cap14>` element per row.
- ✅ `lib/d212-cap14.js: buildCap14Rows(data)` — pure helper producing 0-2 cap14 rows (US dividends categ_venit=2018, US capgains categ_venit=2012). Tested.
- ✅ `server.js` — POST `/api/d212-xml/:year` packages the client's precomputed `cap11Rows + cap14Rows` into the XML; Content-Disposition triggers a browser download as `D212_{year}_skeleton.xml`.
- ✅ `public/js/app.js: exportD212Xml(year)` + button on the Calcul Impozite tab.
- ✅ Tests: 5 cap14 + 9 xml-builder cases including special-char escaping, multi-row, personal-data-fill, totalPlata_A digit sum.

**Known limitations (next iterations):**
- Personal data attributes are emitted as placeholders (NUME / PRENUME / 0000000000000) — the user MUST replace them in the ANAF tool. D-8 will add an optional local form.
- Per-country grouping (D-3) is not yet wired: all foreign income goes under `str_stat_realiz_v="US"`. Multi-jurisdiction users (e.g. EU dividends via XTB) need to split the row manually for now.
- Schematron full re-validation pre-download is not wired (would require xslt2 or a JS schematron impl). Importing the generated XML into the official ANAF tool surfaces any issues at validation time.

### D-8 — Optional personal data step 🟢 Low · 🟢 Low · `open` <a id="d-8"></a>

We deliberately do not collect CNP / full name / IBAN. To make D-7 truly end-to-end, add an *optional* tab where the user enters them.

**Files to touch**
- `public/index.html` — new tab "Date personale (opțional)" or new fieldset on existing Add Data tab
- `db.js` — new table `personal_data` (single row) or store in existing `year_data` (year-independent fields)
- `server.js` — new PUT/GET endpoints `/api/personal-data`
- `public/js/app.js: exportD212Xml` — include personal data only if filled

**Official references**
- XSD root attributes: `nume_c` (BT-00023), `initiala_c` (BT-00024), `prenume_c` (BT-00025), `cif` (BT-00030), `cont_bancar` (BT-00035)
- Validation rules: BR-D212-0001 (CNP format), BR-D212-0004 (`totalPlata_A` = sum of CIF digits), BR-D212-0012 (IBAN RO format + mod 97 checksum)

**Pitfalls**
- Treat the personal data table as **sensitive**: do not log it, do not include in any API response by default, and add it to `.gitignore` (the DB is already gitignored, but the table contents should be clearly marked).
- IBAN RO checksum: `Modulus 97` is well-documented. Hand-rolling is fine; don't pull a dependency.
- Make the toggle very visible — the entire app's privacy posture (no personal data) depends on opt-in.

**Acceptance**
- A clear opt-in toggle.
- Data lives in the local SQLite db.
- Exports (D-7 XML, P3 audit zip) include it only if the user filled it in.
- README updated to clarify the opt-in.

---

## 📋 Next up — Platform & DX

Numbered to match [`docs/d212-mapping.md` § 10](docs/d212-mapping.md#10-platform--dx-gaps-non-d212-but-tracked-here).

### P1 — Loading splash before dashboard 🟡 Med · 🟢 Low · `open` <a id="p1"></a>

Browser opens to a blank page for several seconds while Node boots. Add a quick visual indicator.

**Files to touch**
- `public/index.html` — add an inline `<div id="boot-overlay">` at the top of `<body>` with a CSS spinner; the SPA bootstrap should remove it from `loadAllData().finally(() => removeOverlay())`
- `public/css/styles.css` — `.boot-overlay { position: fixed; inset: 0; z-index: 9999; ... }` plus a `@keyframes spin` for the indicator
- `public/js/app.js` — inside the existing initialization sequence (search for `loadAllData()` around line 444), call `document.getElementById('boot-overlay')?.remove()` once data is ready
- `Start.bat` (source + portable) — already opens the URL too early (sleep 2 sec). Bump to `timeout /t 4 /nobreak` so the splash gets a chance to paint before Express is ready. Optional.

**Pitfalls**
- Keep the overlay 100% CSS — no external fonts, no SVG dependencies, no JS framework. The whole point is showing *something* before the SPA loads.
- Don't use background images that need to be fetched from disk — inline-encode the spinner as CSS borders + rotation.
- Test in dark mode (`data-theme="dark"` on `<html>`). The overlay must match.

**Acceptance**
- Zero new dependencies.
- Works in both portable (`Start.bat`) and dev (`npm start`) modes.
- The user never sees a blank white page after clicking Start.bat.

### P2 — "Rules & References" page for accountants 🔴 High · 🟡 Med · `open` (unblocked by P5 ✅) <a id="p2"></a>

A single page that lets a Romanian fiscal accountant verify every computation by reading one document. The output is a public-facing reference document — design it the way a Romanian fiscal consultant would expect: citations first, formulas second, narrative third.

**Files to touch**
- `public/index.html` — new top-level tab "Reguli & Referințe" alongside Dashboard / Income Details / etc.
- `public/js/app.js` — new `renderRulesPage()` that builds the content from a structured data source (don't hard-code HTML; future contributors will edit data, not markup)
- `lib/rules-catalog.js` (NEW) — single source of truth: an array of rule objects with `{ category, lawArticle, instructionParagraph, formula, exampleInput, exampleOutput, codeRef: 'public/js/app.js:LINE' }`
- `public/locales/{ro,en}.json` — labels for the page, but rule definitions stay in `rules-catalog.js` so they can be Romanian-only (legal terms)
- `.github/ISSUE_TEMPLATE/missing-rule.md` (NEW) — issue template for accountants to submit a rule we missed

**Structure** (one card per rule)
```
🇷🇴 Dividende din străinătate (cap14, str_categ_venit=2018)
  Cota de impozit: 8% (2023-2024), 10% (2025), 16% (2026+)
  Cod fiscal: art. 91 alin. (2)
  Instrucțiuni D212: § 39.6.10-11
  Formula: impozit_RO = grossRON × cota
           credit_fiscal = min(impozit_RO, impozit_platit_strainatate)
           dif_de_plata = max(0, impozit_RO - credit_fiscal)
  Implementare: public/js/app.js: computeYearData() (line ~789)
  Verificat ultima dată împotriva: Instructiuni_D212_OMF_2736_2025.pdf
  [Submit a correction →]
```

**Initial rules to populate** (minimum viable set, ~15 entries)
- US dividends (treaty credit method) — cap14 cu str_categ_venit=2018
- US capital gains — cap14 cu str_categ_venit=2012
- Romanian-source dividends (final tax at source, but counted in CASS base)
- Romanian-source capital gains (1% long, 3% short for 2023-2025; 3%/6% from 2026)
- Romanian interest (10% withheld at source for 2023-2025; 16% from 2026)
- Interest paid by RO entity on bonds issued abroad (cap11, special handling)
- BIK from RSU / Stock Awards — deduction from US capital gains cost basis
- Prior-year loss carryforward (Rd.5-6, max 70% rule)
- Current-year loss carryforward — adds to next year's pool
- CASS thresholds for investment income: 6 SM / 12 SM / 24 SM (NOT 60 SM)
- CASS base composition (Instr. § 51): dividends NET of tax, interest NET, capital gains as net gain
- BNR exchange rate (annual average per BNR) — when to apply
- Rental income — 10% on net (40% flat-rate deduction)
- Royalty income — 10% on net (40% flat-rate deduction)
- Gambling income — final tax at source, declared for completeness

**Official references**
- All in-tree under [`docs/anaf/d212-2025/`](docs/anaf/d212-2025/)
- Cod fiscal articles to cite: 91 (dividends), 94-97 (capital gains), 98-99 (interest), 110 (gambling), 119 (loss carryforward), 154 + 174^1 (CASS exemptions and tiers)

**Pitfalls**
- Don't paraphrase the law in the formula box — quote it. Romanian accountants will trust an exact quote over a translation.
- Every rule must cite both the Cod fiscal article AND the D212 instruction paragraph. Discrepancies between them happen and are valuable to surface.
- Include a "Verificat ultima dată împotriva" timestamp so a stale rule is easy to spot.

**Acceptance**
- Every formula in `computeYearData` has a corresponding entry in `rules-catalog.js`.
- A Romanian accountant reads the page top-to-bottom and identifies at least one missing rule we should add (success = the workflow works).
- Issue template `[Roadmap proposal]` references the rules page.

### P3 — ANAF audit-package zip export 🔴 High · 🟡 Med · `open` (depends on P2) <a id="p3"></a>

Defensive bundle for ANAF inquiries: zip containing every supporting document so a third party can reproduce every number on the user's D212.

**Files to touch**
- `public/js/app.js` — new "Exportă pachet control ANAF" button on Dashboard
- `server.js` — new `POST /api/export/audit-pack/:year` endpoint that builds the zip on the server side (browser-side zipping would require JSZip dep; server-side is simpler)
- `lib/audit-pack-builder.js` (NEW) — produces the zip stream
- `package.json` — add `archiver` as a runtime dependency (most popular Node zip library, MIT, ~50 KB)
- `public/locales/{ro,en}.json` — button labels and the README content (parameterized)
- `test/audit-pack-builder.test.js` (NEW) — assert structure, file presence, and that the zip is reproducible (same inputs → byte-identical zip)

**Zip contents** (filename pattern: `D212-audit-pack-{year}-{YYYYMMDD}.zip`)
```
README.md                       ← explains the contents and how a third party can re-verify
methodology.html                ← snapshot of the P2 rules page rendered for the year
year-data.json                  ← full computed values exported from computeYearData
broker-statements-raw-text/
  xtb_dividends_2025_raw.txt    ← from data/*_raw.txt
  xtb_portfolio_2025_raw.txt
  ...
parsed-data/
  xtb-dividends.json
  xtb-portfolio.json
  ...
exchange-rates.json             ← BNR rates used (year + currency + value)
generated-d212.xml              ← from D-7 (if shipped) — what was actually submitted
calculation-trace.txt           ← per-category: formula → inputs → output, line by line
```

**Pitfalls**
- Raw uploaded PDFs are NOT stored today (they get deleted after parsing — see `server.js` around line 692). To support including the originals, either start retaining a copy under `data/raw-pdfs/{year}/{filename}` (consider disk space) or include only the extracted text + parsed JSON. Default to text-only for now.
- The audit pack contains potentially sensitive data — generate it locally and never POST it to any external service.
- Use deterministic file ordering inside the zip so two runs of the same data produce byte-identical archives — this lets the user verify their own pack with a checksum.

**Acceptance**
- Opening the zip and following the included README lets a third party (an accountant, an ANAF inspector) reproduce every number on the user's D212.
- The zip is < 10 MB for a typical year (text-only).
- A test asserts the zip contents match a golden manifest.

### P4 — Claude/AI skill for the core tax engine 🟢 Low · 🟢 Low · `open` <a id="p4"></a>

Scope AI changes to the high-trust paths (tax computation, parsers) and away from low-trust paths (UI styling, portable build, db schema).

**Files to touch**
- `.github/skills/anaf-tax-engine/SKILL.md` (NEW) — frontmatter + body
- (Optional) `.github/skills/anaf-tax-engine/examples/` — a few worked examples (before/after patches that should be inside the scope)

**Skill frontmatter** (suggested)
```yaml
---
name: anaf-tax-engine
description: Scoped changes to the D212 tax computation core. Use when fixing formulas in computeYearData, the parsers in lib/parsers/, or the rates module. Do NOT use for UI restyling or portable build changes.
allowed_paths:
  - lib/rates.js
  - lib/parsers/**
  - public/js/app.js  # computeYearData and its helpers only
  - test/**
  - docs/d212-mapping.md
  - docs/anaf/**  # read-only
forbidden_paths:
  - public/css/**
  - public/index.html  # unless wiring a new computed value into the UI
  - build-portable.js
  - setup_paddleocr.js
  - db.js  # schema changes require explicit human review
  - server.js  # most changes belong elsewhere; allow only when a parser depends on it
required_checks:
  - npm test
  - npm run check-i18n
  - node --check server.js
---
```

**Skill body** (key contents)
- Pointers to the load-bearing files (see "Onboarding crash-course" above)
- The "pitfalls discovered the hard way" list (regex `\bî`, `Math.max(0)`, "of the same nature" losses)
- Concrete invocations: "to fix a formula, edit `computeYearData`, add a test in `test/`, then update `docs/d212-mapping.md` with the citation"
- Forbidden actions: "do not rename existing exported fields without a deprecation alias"; "do not introduce new runtime dependencies"

**Pitfalls**
- The skill is advisory — it does not enforce. A reviewing human must still verify forbidden paths weren't touched.
- Keep the skill small. Bloated skills get ignored. Aim for < 200 lines.

**Acceptance**
- Running an AI coding session with the skill loaded keeps proposed changes within the listed paths.
- `npm test` passes after the session.
- A reviewer can run `git diff --name-only` and confirm only allowed paths changed.

---

## 💡 Ideas (open for discussion)

These are not formally planned. Open a `[Roadmap proposal]` issue if you want to upgrade one to **Next up**.

- **Schematron validators in JS.** Implement a subset of the `BR-D212-*` rules from `docs/anaf/d212-2025/business/*.sch` so the user gets a clear list of warnings before D-7 export. Medium effort.
- **Bonificație detection.** Most years the government issues an ordinance for an early-payment discount (e.g. 3% off if you pay by 25.05). The app currently ignores this. When an OUG comes out, add a flag.
- **CHEN exception decision tree.** Some users qualify for exceptions (CASS scutire pentru persoane cu handicap, double-tax-treaty scutire, etc.). Today these are silent overrides. A small dialog asking "do any of these apply to you?" with the right code emission would help.
- **Multi-user / multi-CNP support.** Today the app assumes one fiscal person. A family running it on one machine would have to fork data folders. A dropdown for "active profile" + per-profile SQLite would help.
- **Comparator pre/post-treaty.** For US-source income, show a side-by-side "with treaty" vs "without treaty" tax calculation so the user understands what the certificate of residence is buying them.

---

## ⏳ Currently in progress

Nothing actively in flight. The active branch (`feature/eur-usd-support-and-tests`, after rename) has the items under "Recently shipped" above.

---

## 🗂️ Status snapshot

Generated periodically from the SQL tracking the maintainers use internally. Update by running `npm run roadmap:sync` (TODO: wire this up — see proposal in P4-related discussion).

| Tier | Open | Done |
|---|---:|---:|
| D212 compliance | 5 (D-3, D-4, D-5, D-6, D-7, D-8 except 2 already done) | 2 (D-1 refund, D-2 prior losses) |
| Platform & DX | 4 (P1, P2, P3, P4) | 1 (P5) |
| **Total** | **9** | **3** |

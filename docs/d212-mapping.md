# D212 → App field mapping

> Authoritative source: ANAF D212 XSD v1.0.4 (24.11.2025) — `Downloads/d212/D212.xsd`
> Schema namespace: `mfp:anaf:dgti:d212:declaratie:v11`
> Filing year (`an_r`) = **2026** for the 2025 fiscal year
> Validation rules: `Downloads/d212/business/*.sch` (76+ rules BR-D212-0001 ... 0076)
> Filling instructions: `Instructiuni_D212_2736_2025.pdf` (ANAF official, Order 2736/2025)

This document maps every D212 attribute relevant to **investment income** (dividends, interest, capital gains) to the corresponding source/output in D212TaxHelper. Mapping is based on the official XSD documentation strings + the OMF 2736/2025 instructions — not on guesswork.

Status legend:
- ✅ Already collected/computed correctly
- ⚠️ Partially handled or computed but not surfaced in UI
- ❌ Not collected — gap to close
- 🗑️ Collected but never used for D212

---

## 1. D212 structure overview

A D212 declaration is built from the root `<d212>` element which contains zero or more chapter sub-elements. Each chapter is optional (`minOccurs="0"`) and only included when the matching `bifa1xx` flag is `1`.

| Chapter | XSD element | Purpose | Investment relevance |
|---|---|---|---|
| Cap. I §1 | (root attrs `real_*`, `oblig_realizat`) | Income realized in 2025 from RO sources requiring CASS computation | ⚠️ Partial — CASS base counts investment income |
| Cap. I §1.1 | `cap11` | Income from Romania taxed in real system (capital gains, rentals, etc.) | ✅ **Primary** for XTB/Tradeville/BT Trade Romanian-source income |
| Cap. I §1.2 | `cap12` (norma de venit) | Independent activities on income norm basis | ❌ Not for investments |
| Cap. I §2.1 | `cap14` | **Income from abroad** (US, EU, etc.) | ✅ **Primary** for Fidelity, Morgan Stanley, 1042-S |
| Cap. I §2.2 | (root attrs `str_cas_*`, `str_cass_*`) | Foreign salary-like income (CAS/CASS) | ❌ Not for investments |
| Cap. I §3 | (root `cas_*`, `cass_*` attrs on `oblig_realizat`) | **CAS/CASS calculation summary** | ✅ Driven by total income from all chapters |
| Cap. I §4 | `cap19` | Foreign pension income (CASS) | ❌ Not for investments |
| Cap. I §5 | `cap23` | Agricultural activities (norm) | ❌ Not for investments |
| Cap. II | `oblig_estimat` | Estimated CASS for next year (deprecated for D212/2025 in most cases) | ⚠️ App handles this |

---

## 2. Root `<d212>` element

Mandatory metadata + flags.

| Attribute | BT | App field | Status |
|---|---|---|---|
| `d_rec` | BT-00001 | (rectificative flag — not collected) | ❌ |
| `rectif1` / `rectif2` | BT-00002/3 | — | ❌ |
| `luna_r` | BT-00005 | hardcode `12` (BR-D212-0005) | ⚠️ implicit |
| `an_r` | BT-00006 | filing year = fiscal year + 1 (BR-D212-0006: must be 2026 for tax year 2025) | ⚠️ derived from `selectedYear` |
| `bifa121` | BT-00013 | "I filled cap14" — set automatically when cap14 entries exist | ⚠️ no explicit support |
| `bifa111` | BT-00010 | "I filled cap11" | ⚠️ no explicit support |
| `bifa132` | BT-00016 | "I filled CASS" — driven by total investment income vs 6 SM threshold | ⚠️ no explicit support |
| `bifa14` | BT-00017 | Establish annual tax due | ⚠️ implicit |
| `bifa18` | BT-00019 | "I want the early-payment bonification" | ❌ |
| `nume_c` / `initiala_c` / `prenume_c` | BT-00023/24/25 | Personal data — **NOT collected** (privacy-first; user fills directly in ANAF tool) | ❌ by design |
| `cif` | BT-00030 | CNP/NIF — **NOT collected** | ❌ by design |
| `cont_bancar` | BT-00035 | IBAN — **NOT collected** | ❌ by design |
| `totalPlata_A` | BT-00004 | Sum of digits of CIF (BR-D212-0004) | ⚠️ computed elsewhere |

> **Privacy note:** App is designed NOT to handle personal identifiers (CNP, full name, IBAN). The user transcribes computed totals into the official ANAF PDF themselves. The app only generates the *amounts*, not a ready-to-submit XML.

---

## 3. Cap. I §1.1 — `cap11` (Romanian-source income, real system)

**Used for:** capital gains via Romanian broker (XTB, Tradeville, BT Trade) where the broker withholds tax at source. Per Cod Fiscal art. 119, this income must still be reported on D212 for the CASS threshold calculation, even when the income tax is "impozit final" at source.

`cap11` repeats once per income source.

| Attribute | BT | Description | App field | Status |
|---|---|---|---|---|
| `categ_venit` | BT-03004 | Category code (investment = `7` per Nomenclator_venituri_RO) | implicit | ⚠️ not explicit |
| `den_venit` | BT-03003 | Category label | implicit | ⚠️ |
| `scutire` | BT-03001 | Tax-exempt under double-taxation treaty | n/a | n/a |
| `reg` | BT-03002 | Option for tax regularization | n/a | n/a |
| `venit_brut` | BT-03018 | **Rd.1** Gross income (RON) | `data.dividendsRON_ro`, `data.roLongTermGainRON`, `data.roShortTermGainRON`, `data.interestIncomeRON` (summed appropriately per category) | ✅ |
| `chelt_deduc` | BT-03019 | **Rd.2** Deductible expenses (RON) | `data.salaryTaxedRON` for stock-award BIK | ✅ |
| `venit_net_anual` | BT-03020 | **Rd.3 = Rd.1 - Rd.2** Net annual income | computed | ✅ |
| `pierdere` | BT-03021 | **Rd.4 = Rd.2 - Rd.1** Annual loss | `data.currentYearLossRON` (added recently) | ✅ |
| `pierdere_precedenta` | BT-03022 | **Rd.5** Prior-year losses carried forward (max 7 years) | `yd.priorLosses` | ✅ |
| `pierdere_compensata` | BT-03023 | **Rd.6** Prior losses compensated this year (max 70% of gain) | `data.priorLossesApplied` (Instr. 7.3.3 formula) | ✅ |
| `venit_recalculat` | BT-03024 | **Rd.7 = Rd.3 - Rd.6** Taxable income | computed | ✅ |
| `impozit11` | BT-03026 | Tax due (Rd.7 × 10%) | computed (using rates from year-specific config: 1%/3% for 2023-2025; 3%/6% for 2026+) | ✅ |
| `impozit_retinut` | BT-03027 | **Rd.9** Tax already withheld by broker | `data.roPortTaxWithheld` | ✅ |

> **Gap:** `cap11.categ_venit` requires a numeric category code per row. App doesn't currently emit one. Code `7` is "Câștiguri din transferul titlurilor de valoare" (capital gains) per Nomenclator_venituri_RO; dividends use a different code; interest yet another.

> **Format issue:** XTB / Tradeville / BT Trade may withhold at source (final tax) and the user simply ticks `scutire`/`reg` to declare without paying additional tax. Current app does not surface this option.

> **Confirmed loss-compensation formula (Instr. 7.3.3, page 17):**
> Rd.6 = min(Rd.5, 0.70 × Rd.3). Implementation in `computeYearData` consumes short bucket first (3% rate > 1%) to maximize tax saving for the user.

> **Loss "of the same nature" (Cod fiscal art. 119 + Instr. paragraph 7.3.3):**
> Prior losses from Romanian-source transactions offset Romanian-source gains only; foreign-source losses offset foreign gains only. The two are separate carryforward pools. The app's single `yd.priorLosses` input is treated as the RO pool (common case from XTB/Tradeville/BT Trade history). A separate input for foreign-source losses would be needed for full fidelity — tracked as gap #4.

---

## 4. Cap. I §2.1 — `cap14` (Foreign-source income) ⭐ Most-used section

**Used for:** US-based brokers (Fidelity, Morgan Stanley), 1042-S withholding, ESPP gains, RSU sales.

`cap14` repeats once per (country × category) tuple.

| Attribute | BT | Description | Current app source | Status |
|---|---|---|---|---|
| `str_stat_realiz_v` | BT-05002 | Country ISO2 code (`US`, `DE`, `IE`, etc.) | implicit | ⚠️ no UI; assumed `US` |
| `den_stat` | BT-05001 | Country name | implicit | ⚠️ |
| `str_categ_venit` | BT-05004 | Category code (must be one of 19 valid codes — see §7) | `2012` (capital gains) or `2018` (dividends) hardcoded in parser | ✅ |
| `den_categ_venit` | BT-05003 | Category label | hardcoded | ⚠️ |
| `dubla_impunere` | BT-05005 | Double-taxation method (`1`=credit, `2`=exemption) | implicit `1` for US | ⚠️ |
| `str_data_incep` / `str_data_sf` | BT-05006/7 | Activity start/end date | n/a for investment | n/a |
| `str_venit_brut` | BT-05008 | **Rd.1** Gross income RON | `data.dividendsRON` (dividends) or `data.capitalGainsSaleUSD × rate` (gains) | ✅ |
| `str_chelt_deduc` | BT-05009 | **Rd.2** Deductible expenses RON | `data.capitalGainsCostUSD × rate` + `data.salaryTaxedRON` for BIK | ✅ |
| `str_venit_net_anual` | BT-05010 | **Rd.3 = Rd.1 - Rd.2** | computed | ✅ |
| `str_pierdere_anuala` | BT-05011 | **Rd.4** Annual loss | `data.currentYearLossRON` for foreign | ⚠️ aggregated with RO |
| `str_pierdere_precedenta` | BT-05012 | **Rd.5** Prior losses carried forward | `yd.priorLosses` | ⚠️ not per-country |
| `str_pierdere_compensata` | BT-05013 | **Rd.6** Compensated this year | computed | ⚠️ |
| `str_venit_recalculat` | BT-05014 | **Rd.7 = Rd.3 - Rd.6** Taxable | computed | ✅ |
| `str_impozit_datorat_Ro` | BT-05016 | **Rd.8** Tax due in Romania (Rd.7 × 10%) | computed | ✅ |
| `str_impozit_platit` | BT-05017 | **Rd.9** Tax paid abroad (US withholding, 1042-S) | `data.usDivForeignTaxRON` | ✅ |
| `str_credit_fiscal` | BT-05018 | **Rd.10** Recognized fiscal credit = `min(Rd.8, Rd.9)` | computed | ✅ |
| `str_dif_impozit_datorat` | BT-05019 | **Rd.11 = Rd.8 - Rd.10** Diff to pay | computed | ✅ |

> **Strong coverage** of cap14. Most fields are computed correctly.

> **Confirmed credit-fiscal formula (Instr. 39.6.10-11):**
> `str_credit_fiscal` = `min(str_impozit_platit, str_impozit_datorat_Ro)`. Excess foreign tax above the RO amount due is NOT refundable through D212 — it can only be claimed from the foreign tax authority. Implementation matches: `usDivCreditRON = Math.min(usDivTaxDueRON, usForeignTaxRON)`.

> **Gaps:**
> - No explicit per-country, per-category grouping in UI. If user has US dividends + US capital gains, those are two separate `cap14` rows. Currently we lump them under "US" in computation.
> - No support for non-US foreign income (e.g., EU dividends via Romanian broker count as `cap14` if sourced abroad).

---

## 5. Cap. I §3 — `oblig_realizat` (CASS calculation)

The `oblig_realizat` element holds the FINAL totals that drive CASS. Investment income contributes to the CASS base via `cass_ven_inv` (BT-01030).

### Investment-specific fields

| Attribute | BT | Description | App | Status |
|---|---|---|---|---|
| `bifa_cass_real` | BT-01026 | Tick "I had income above threshold" | implicit | ⚠️ |
| `cass_ven_inv` | BT-01030 | **Total investment income** for CASS base. Per Instr. 51: dividends are counted NET of tax; interest is counted NET of tax; capital gains are counted as net gain (gross - cost). | `data.totalIncome_cass` (subset for investments) | ✅ confirmed against Instr. 51 |
| `cass_total_ven` | BT-01033 | TOTAL non-salary income across all categories | `data.totalIncome` | ✅ |
| `cass_baza` | BT-01034 | CASS calculation base (months × min salary, depends on threshold tier 6/12/24 SM) | `data.cassInfo.base` | ✅ |
| `cass_anuala` | BT-01035 | CASS due (Rd.2 × 10%) | `data.cassTax` | ✅ |
| `cass_datorat` | BT-01037 | Final CASS due | `data.cassTax` | ✅ |
| `cass_retinut` | BT-01038 | CASS already withheld by payer (rare for investments) | not collected | ❌ |
| `cass_dif_plus` / `cass_dif_minus` | BT-01039/40 | Diff to pay/refund | computed | ⚠️ implicit |

> **CASS thresholds for investment income (Instr. 52.1.1-3):** 6 SM / 12 SM / 24 SM tiers.
> The 60 SM cap that applies to independent-activity income does NOT apply here.
> For 2025: SM = 4,050 RON (HG 1506/2024), so the thresholds are 24,300 / 48,600 / 97,200 RON.
> CASS is **10%** of the *threshold reached* — not 10% of the actual income.

### Other CASS sub-categories (for awareness)

| Attribute | BT | Description |
|---|---|---|
| `cass_ven_dpi` | BT-01027 | Intellectual property |
| `cass_ven_asc` | BT-01028 | Association with legal entities |
| `cass_ven_cfb` | BT-01029 | Property rental |
| `cass_ven_asp` | BT-01031 | Agriculture |
| `cass_ven_alt` | BT-01032 | Other |

App collects rental, royalty, gambling, other but doesn't map them to these specific buckets when computing `cass_total_ven`.

### Final totals (`oblig_realizat` summary)

| Attribute | BT | Description | App |
|---|---|---|---|
| `oblimpoz_real_total` | BT-01070 | Total annual income tax | `data.incomeTaxOnly` | ✅ |
| `oblimpoz_real_anticipat` | BT-01071 | Tax withheld at source | `data.totalAlreadyPaid` (subset) | ⚠️ |
| `oblimpoz_real_dif_deplata` | BT-01072 | Diff in plus to pay | `data.netTaxPayable` | ✅ |
| `oblimpoz_real_dif_restituit` | BT-01073 | Diff in minus to refund | **not computed** (currently `Math.max(0,...)`) | ❌ |
| `oblimpozit_real_bonif` | BT-01090 | Early-payment bonification | `data.bonificatie` if applicable | ⚠️ |
| `dif_de_plata` | BT-01088 | Final amount to pay | computed | ✅ |
| `dif_de_restituit` | BT-01089 | Final amount to refund | **not computed** | ❌ |

> **Real-world gap:** App always shows `Math.max(0, owed - withheld)` so it never displays a refund. In the user's 2025 sample, XTB withheld ~1,644 RON more than owed → that's refundable but not shown.

---

## 6. Field type reference

| Type name | Meaning | Example |
|---|---|---|
| `N1Type` | 1-digit number (flag 0/1) | `bifa121=1` |
| `N4Type` | 4-digit code | `str_categ_venit="2012"` |
| `N15Type` | Up to 15 digits, NO decimals (RON integer) | `str_venit_brut="1417"` |
| `C2Type` | 2-char string | `str_stat_realiz_v="US"` |
| `C500Type` | Up to 500 chars | `den_stat="Statele Unite ale Americii"` |
| `D10Type` | Date DD/MM/YYYY | `str_data_incep="01/01/2025"` |

> **Important:** All monetary amounts in D212 are **integer RON** (no decimals). App rounds via `Math.round()` before display, which matches.

---

## 7. Income category codes (Nomenclator_venituri_STR)

For cap14 `str_categ_venit`, valid codes (per `d212-codes.sch:457`):

```
2003, 2004, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
2018, 2020, 2024, 2025, 2027, 2028, 2029, 2030
```

App currently knows:
- `2012` = Câștiguri din transferul titlurilor de valoare (capital gains)
- `2018` = Venituri din dividende — dubla impunere

The remaining 17 codes are unmapped. Their labels are in `d212_docTehnica_v1.0.8_17042026.xls` (needs Excel inspection). Likely relevant ones for our user base:
- Interest (foreign banks)
- Royalties / IP
- Pensions
- Rental income from abroad

---

## 8. Critical business rules (subset)

From `d212-business*.sch` — rules that affect investment-related fields:

| Rule | What it enforces |
|---|---|
| **BR-D212-0006** | `an_r` must equal 2026 (filing year for 2025 income) |
| **BR-D212-0009** | If `bifa121=1` then `cap14` element must exist |
| **BR-D212-0007** | If `bifa111=1` then `cap11` element must exist |
| **BR-D212-0011** | If `bifa23=1` then `cap23` must exist |
| **BR-D212-0012** | `cont_bancar` must be valid IBAN RO (mod 97 checksum) |
| **BR-D212-0016** | `bifa_optiune=1` ↔ `baza_optiune=24300` (CASS 6 SM threshold consistency) |

> Rules BR-D212-0017 ... 0076 are in business-2/3/4.sch and cover field-level corollations within capitole.

---

## 9. Gap analysis & recommendations

### ✅ What the app already does right
- BNR exchange rates (single source of truth, official values 2019-2025)
- Multi-row, multi-currency XTB report parsing
- Capital gains with `net = max(0, gain - loss)` per long/short bucket
- Carryforward loss surfaced to user (`currentYearLossRON`)
- **Prior-year loss application** using D212 Rd.5-6 formula (Instr. 7.3.3): consumes highest-rate bucket first, capped at 70% of net gain
- **Refund detection**: when a Romanian broker over-withholds, the excess is surfaced (instead of being hidden by `Math.max(0, ...)`)
- **CASS thresholds for investments** match Instr. 52.1 (6/12/24 SM tiers, not 60 SM)
- **Credit fiscal** for foreign dividends matches Instr. 39.6.10: `min(taxDueRO, taxPaidAbroad)`
- 35 unit tests covering parsers + rates
- Import-vs-manual override workflow with diff dialog

### ❌ Real gaps to close (sorted by impact)

| # | Gap | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | ~~Refund (dif_de_restituit) never shown~~ | High — real money | Low | ✅ DONE (commit 65cdcaa) |
| 2 | ~~yd.priorLosses collected but not applied to tax~~ | High — real money | Low | ✅ DONE (commit, this one) |
| 3 | **No explicit per-country, per-category grouping** in UI. cap14 needs one row per (country, category). | Med | Med | open |
| 4 | **No `str_categ_venit` code emission.** Parsers know `2012` and `2018`, but generic API users can't pick codes. | Med | Low | open |
| 5 | **Loss carryforward not split foreign vs RO.** D212 requires separate `cap11.pierdere_precedenta` and `cap14.str_pierdere_precedenta` rows. App tracks one global pool. | Med | Med | open |
| 6 | ~~**Romanian-source investment income via XTB/etc. not declared on cap11.**~~ Capital gains side now emits a structured `cap11Rows[]` (categ_venit=`1012`) with Rd.1..Rd.9 fields visible on the Calcul Impozite page. Dividends + interest (impozit final) intentionally remain out of cap11 — they have no entry in Nomenclator_venituri_RO for individuals and feed the CASS base directly. | High — could cause under-declaration | Med | ✅ DONE — capital gains side (commit, this one). Remaining work: D-7 XML emitter consumes `cap11Rows[]`. |
| 7 | ~~**No D212 XML export.**~~ Skeleton + CASS investments shipped: cap11 + cap14 + oblig_realizat blocks emitted byte-for-byte matching the ANAF DUF output; personal data placeholders the user fills in the ANAF tool. `lib/d212-xml-builder.js` + `lib/d212-oblig-realizat.js` + POST `/api/d212-xml/:year` + button on Calcul Impozite tab. Full multi-country (D-3) and schematron re-validation still open. | High — UX | High | ✅ DONE — etapa 1 (DUF conformance) + etapa 2 (oblig_realizat). Remaining work: D-3 multi-country wiring, schematron pre-flight, etapa 3 import-merge. |
| 8 | **No personal data collection** for `nume_c`/`cif`/`cont_bancar`. By design, but means we can never produce a fully complete XML. Could add an optional "fill personal data" step that stays local. | Low | Low | open |
| 9 | ~~**XTB/BT foreign dividends taxed at 8% but never emitted to any D212 chapter row.**~~ Parsers now extract country per dividend row (BT: ISIN[0..2]; XTB: `din <Country>` suffix). Resolver splits into local (RO ISIN), foreign-by-country, and unknown-country buckets. `cap14Rows` emission merges per (country × 2018) across all sources (Fidelity 1042-S + XTB + BT). Country codes validated against ANAF ISO list (CD-D212-011). D205 matcher classifies RO-ISIN dividends as expecting a D205 match and foreign-ISIN as expected-not-in-d205. **Foreign withholding interpretation confirmed by user (2026-05-25):** XTB and Fidelity both withhold 10% via W-8BEN treaty rate (US-RO Art. 10 portfolio dividends), which is the foreign tax credit (`str_impozit_platit`); credit fiscal is capped at 8% RO (`min(8%, 10%) = 8%`), so the user owes 0 RON RO tax on these dividends and the 2% excess foreign tax is fiscally lost (not refundable through ANAF). | High — under-declaration | Med | ✅ DONE — commits 28611b7, a205f46, b46a269 (this work). Remaining: per-bucket country override UI for ADR edge cases. |

### 🗑️ Over-collected fields (data we save but never use)

| App field | Note |
|---|---|
| `yd.exchangeRate` | We accept user-entered FX rate, but BNR rate already exists for the year |
| `yd.eurRate` | Same as above |
| `usBroker`, `roBroker` (free text) | Only displayed in labels; never used for any computation |
| `taxRates` overrides | User can override rates per year — useful only when ANAF changes mid-year |

---

## 10. Platform & DX gaps (non-D212 but tracked here)

These are not D212 compliance gaps but real improvements that surfaced during day-to-day usage and review.

| # | Gap | Impact | Effort | Status |
|---|---|---|---|---|
| P1 | **No loading screen between Start.bat and dashboard.** Browser opens to a blank page for several seconds while Node starts the server. A simple "Loading D212 Tax Helper..." splash (served from a static file before the SPA loads) would close the UX gap. | Med — first-impression UX | Low | open |
| P2 | **No "rules and references" page for accountants.** A Romanian fiscal accountant should be able to verify every computation by reading one document: which Cod fiscal article justifies the rate; which D212 instruction paragraph defines the formula; which BNR series provides the exchange rate; which Cass tier applies and why. The page should also have a clearly-marked "Add a rule we missed" section so contributors (especially accountants) can submit additions via PR. Structure example: per income type → applicable law citation → formula → app implementation citation (`server.js:LINE`, `app.js:LINE`). | High — gives the tool authority + makes review by professionals viable | Med | open |
| P3 | **No ANAF audit-package export.** Generates a zip containing every supporting document (broker raw statements, parsed XML, computed values per category, the methodology page, the BNR rates used). Filename pattern: `D212-audit-pack-{year}-{YYYYMMDD}.zip`. The package would be the user's defensive bundle if ANAF requests proof of declared amounts. | High — real money / legal | Med | open |
| P4 | **No focused Claude/AI skill for the ANAF tax computation module.** Currently when working with AI on this repo, all changes — UI, parsers, server, CSS — happen in one shared mental space. A dedicated skill file at `.github/skills/anaf-tax-engine/SKILL.md` would scope AI changes to `lib/rates.js`, `lib/parsers/*`, the relevant computation paths in `app.js`, and the related test files, with explicit "don't touch UI styling" and "don't touch portable build" guardrails. | Low — DX | Low | open |
| P5 | **Official ANAF reference documents not in the repo.** Today the XSD, schematron rules, technical structure docs, and the filling instructions live outside the repo (in `~/Downloads/d212/` and `\\192.168.0.120\home\Stocks\anaf\`). Including them under `docs/anaf/{vYYYY-MM-DD}/` with a README explaining provenance lets contributors verify mappings against authoritative sources, and lets us diff against new ANAF releases when they ship. | Med — reproducibility, audit trail | Low | open |

### Recommendations for next milestone

1. ~~**Refund flow**~~ — done (commit `65cdcaa`).
2. ~~**Prior-loss application**~~ — done (commit `255dcca`).
3. **Per-country/per-category in cap14 generation** — restructure the "Adăugă Date" tab around an array of cap14-like rows (country dropdown + category dropdown + amounts). *Estimate: medium task, 5-7 commits + tests.*
4. **D212 XML export button** — emit a partial XML conforming to `D212.xsd` (validated client-side or against the schematron rules). User downloads `D212-2025.xml` and imports into ANAF tool. *Estimate: large task, 10+ commits.*
5. **Schematron validators in JS** — implement subset of BR-D212-* rules so user gets warnings about incomplete/inconsistent data BEFORE export. *Estimate: medium.*
6. **P5 — bring ANAF reference docs into the repo** — tiny, unblocks audit-trail. Recommended as low-hanging fruit before the next big change.
7. **P2 — Accountant rules page** — high authority value; can be built incrementally.
8. **P3 — Audit-pack zip** — once methodology page exists, becomes natural to bundle it with raw statements.

---

## Appendix: how to regenerate this document

The XSD structure was extracted via:

```bash
node scripts/parse-d212-xsd.js > /tmp/d212-xsd.json
```

By default the script reads `docs/anaf/d212-2025/D212.xsd` (the in-repo copy). Pass an explicit path argument to point it at a newer ANAF release that hasn't been added to the repo yet.

Reference documents (all already in-tree under `docs/anaf/d212-2025/`):

- `D212.xsd` — schema v1.0.4 (24.11.2025)
- `business/d212-business*.sch` — 4 files, BR-D212-0017..0076 validation rules
- `codes/d212-codes.sch` — income category code allow-list
- `syntax/d212-syntax.sch`
- `structura_D212_v1.0.8_17042026.pdf` — human-readable structure doc
- `d212_docTehnica_v1.0.8_17042026.xls` — machine-readable structure doc (includes category labels)
- `Instructiuni_D212_OMF_2736_2025.pdf` — official filling instructions

See `docs/anaf/README.md` and `docs/anaf/d212-2025/README.md` for provenance, versioning policy, and how to handle new ANAF releases.

/**
 * D212 Cap. I §2.1 — `cap14` (Foreign-source income) row builder.
 *
 * Mirrors the cap11 builder in lib/d212-cap11.js. Produces structured rows
 * that map 1:1 onto the `cap14` element defined in docs/anaf/d212-2025/D212.xsd
 * (BG-05000). The eventual D-7 XML emitter consumes the rows directly.
 *
 * Scope of this first pass (paired with gap D-7)
 * ----------------------------------------------
 * - US-source dividends (categ_venit = 2018) — Fidelity, Morgan Stanley,
 *   form 1042-S federal withholding. Foreign tax credit via str_credit_fiscal.
 * - US-source capital gains (categ_venit = 2012) — RSU/ESPP sale proceeds
 *   minus cost basis minus BIK already taxed as salary in RO.
 *
 * Per-country grouping (gap D-3) and multi-jurisdiction support are NOT yet
 * implemented — all foreign income is assumed `US` with `dubla_impunere=1`
 * (credit method, US-RO treaty). When D-3 lands, this module will accept
 * a list of country buckets instead of inferring from US-only fields.
 *
 * Schematron rule CD-D212-016 restricts str_categ_venit to a fixed list
 * (2001, 2003, 2006, 2009, 2010, 2011, 2012, 2015, 2016, 2017, 2018, 2019,
 *  2020, 2021, 2022, 2023, 2024, 2025, 2026). We use only 2012 and 2018.
 */

'use strict';

/**
 * Build cap14 rows from the computed `data` object returned by
 * `computeYearData`. Emits 0..2 rows in the current implementation.
 *
 * @param {object} data  Output of computeYearData(year).
 * @returns {Array<object>}
 */
function buildCap14Rows(data) {
  if (!data) return [];
  const rows = [];
  const warnings = [];

  const exchangeRate = data.exchangeRate || 1;
  const dividendsRON = data.dividendsRON || 0;
  const divTaxRate = data.divTaxRate || 0;
  const capGainsTaxRate = data.capGainsTaxRate || 0;
  const usForeignTaxRON = data.usDivForeignTaxRON || 0;
  const capGainsSaleRON = (data.capitalGainsSaleUSD || 0) * exchangeRate;
  const capGainsCostRON = (data.capitalGainsCostUSD || 0) * exchangeRate;
  const salaryTaxedRON = data.salaryTaxedRON || 0;
  const usNetGainsRON = data.usNetGainsRON || 0;

  // ---------------------------------------------------------------
  // Foreign-source dividends (categ_venit=2018) — merged per country.
  //
  // Sources:
  //   1. US 1042-S dividends (data.dividendsRON + data.usDivForeignTaxRON)
  //   2. RO-broker foreign dividends (data.roBrokerForeignDividendsByCountry)
  //
  // Per docs/d212-mapping.md § 4 the cap14 element repeats once per
  // (country × category) tuple, so we accumulate in a single map keyed
  // by country and emit one row per key. Schematron rule CD-D212-011
  // restricts str_stat_realiz_v to the ISO 3166-1 Alpha-2 list +
  // {XI, XK}; countries outside this list trigger a warning and the
  // bucket is dropped from the XML (the user must fix it manually).
  // ---------------------------------------------------------------
  const { D212_ALLOWED_COUNTRY_CODES, COUNTRY_CODE_TO_RO } = require('./rates');
  const dividendBuckets = new Map();
  const addDividendBucket = (country, grossRON, foreignTaxRON, source) => {
    if (!grossRON && !foreignTaxRON) return;
    const b = dividendBuckets.get(country) || {
      country, grossRON: 0, foreignTaxRON: 0, sources: [],
    };
    b.grossRON += grossRON;
    b.foreignTaxRON += foreignTaxRON;
    b.sources.push(source);
    dividendBuckets.set(country, b);
  };
  // US 1042-S contribution.
  if (dividendsRON > 0 || usForeignTaxRON > 0) {
    addDividendBucket('US', dividendsRON, usForeignTaxRON, '1042-S');
  }
  // RO-broker foreign dividends contribution (per resolver split).
  for (const c of (data.roBrokerForeignDividendsByCountry || [])) {
    addDividendBucket(c.country, c.grossRON || 0, c.taxRON || 0,
      (c.sources || []).map(s => s.broker).join('+') || 'RO broker');
  }
  for (const b of dividendBuckets.values()) {
    if (!D212_ALLOWED_COUNTRY_CODES.has(b.country)) {
      warnings.push({
        kind: 'invalid_country',
        country: b.country,
        message: `Dividende cap14 cu cod de țară "${b.country}" omis din XML (nu e ISO Alpha-2 valid pentru ANAF).`,
      });
      continue;
    }
    const Rd1 = b.grossRON;
    const Rd3 = Rd1;
    const Rd7 = Rd3;
    const Rd8 = Rd7 * divTaxRate;
    const Rd9 = b.foreignTaxRON;
    const Rd10 = Math.min(Rd8, Rd9);
    const Rd11 = Math.max(0, Rd8 - Rd10);
    rows.push({
      str_stat_realiz_v: b.country,
      den_stat: COUNTRY_CODE_TO_RO[b.country] || b.country,
      str_categ_venit: '2018',
      den_categ_venit: 'Dividende',
      dubla_impunere: '1',
      str_venit_brut: Math.round(Rd1),
      str_chelt_deduc: 0,
      str_venit_net_anual: Math.round(Rd3),
      str_pierdere_anuala: 0,
      str_pierdere_precedenta: 0,
      str_pierdere_compensata: 0,
      str_venit_recalculat: Math.round(Rd7),
      str_impozit_datorat_Ro: Math.round(Rd8),
      str_impozit_platit: Math.round(Rd9),
      str_credit_fiscal: Math.round(Rd10),
      str_dif_impozit_datorat: Math.round(Rd11),
    });
  }

  // Surface manual EUR/USD dividends without country info as a warning.
  if ((data.roBrokerUnknownCountryDividendsRON || 0) > 0) {
    warnings.push({
      kind: 'unknown_country',
      grossRON: data.roBrokerUnknownCountryDividendsRON,
      message: 'Există venituri din dividende fără țară identificată (intrări manuale EUR/USD). Re-introdu-le cu țara emitentului pentru a fi incluse în XML cap14.',
    });
  }

  // Capital gains row (categ_venit=2012). Emitted when there are sale proceeds
  // or a positive taxable net. capGainsCost includes BIK that was already
  // taxed as salary in Romania (deductible per Cod fiscal art. 76 + § 7.4).
  if (capGainsSaleRON > 0 || usNetGainsRON > 0) {
    const Rd1 = capGainsSaleRON;
    const Rd2 = capGainsCostRON + salaryTaxedRON;
    const Rd3 = Math.max(0, Rd1 - Rd2);
    // For US capgains the RO resident typically owes no US tax (US-RO treaty
    // art. 13). We don't track US capgains withholding separately.
    const Rd9 = 0;
    const Rd7 = Rd3;
    const Rd8 = Rd7 * capGainsTaxRate;
    const Rd10 = Math.min(Rd8, Rd9);
    const Rd11 = Math.max(0, Rd8 - Rd10);
    rows.push({
      str_stat_realiz_v: 'US',
      den_stat: 'Statele Unite ale Americii',
      str_categ_venit: '2012',
      den_categ_venit: 'Câștiguri din transferul titlurilor de valoare',
      dubla_impunere: '1',
      str_venit_brut: Math.round(Rd1),
      str_chelt_deduc: Math.round(Rd2),
      str_venit_net_anual: Math.round(Rd3),
      str_pierdere_anuala: 0,
      str_pierdere_precedenta: 0,
      str_pierdere_compensata: 0,
      str_venit_recalculat: Math.round(Rd7),
      str_impozit_datorat_Ro: Math.round(Rd8),
      str_impozit_platit: Math.round(Rd9),
      str_credit_fiscal: Math.round(Rd10),
      str_dif_impozit_datorat: Math.round(Rd11),
    });
  }

  // Interest row (categ_venit=2010). Emitted for US-source interest reported
  // on 1042-S code 01. US typically withholds 0% under the IRC §871(h)
  // portfolio interest exemption, so the foreign tax credit is usually 0 and
  // the RO resident owes the full RO interest tax (10% in 2025, 16% from 2026).
  const usIntRON = data.usForeignInterestRON || 0;
  const usIntTaxRON = data.usForeignInterestTaxRON || 0;
  if (usIntRON > 0 || usIntTaxRON > 0) {
    const Rd1 = usIntRON;
    const Rd3 = Rd1;
    const Rd7 = Rd3;
    const Rd8 = data.usForeignInterestTaxDueRON || (Rd7 * (data.interestTaxRate || 0));
    const Rd9 = usIntTaxRON;
    const Rd10 = data.usForeignInterestCreditRON != null ? data.usForeignInterestCreditRON : Math.min(Rd8, Rd9);
    const Rd11 = data.usForeignInterestTaxToPayRON != null ? data.usForeignInterestTaxToPayRON : Math.max(0, Rd8 - Rd10);
    rows.push({
      str_stat_realiz_v: 'US',
      den_stat: 'Statele Unite ale Americii',
      str_categ_venit: '2010',
      den_categ_venit: 'Dobânzi',
      dubla_impunere: '1',
      str_venit_brut: Math.round(Rd1),
      str_chelt_deduc: 0,
      str_venit_net_anual: Math.round(Rd3),
      str_pierdere_anuala: 0,
      str_pierdere_precedenta: 0,
      str_pierdere_compensata: 0,
      str_venit_recalculat: Math.round(Rd7),
      str_impozit_datorat_Ro: Math.round(Rd8),
      str_impozit_platit: Math.round(Rd9),
      str_credit_fiscal: Math.round(Rd10),
      str_dif_impozit_datorat: Math.round(Rd11),
    });
  }

  // Attach the warnings array as a non-enumerable property so existing
  // callers (and existing `assert.deepEqual(rows, [...])` tests) are not
  // affected, while new callers can inspect `rows.warnings` for issues
  // that prevented some entries from being emitted (invalid country code,
  // missing country information for manual entries, etc.).
  Object.defineProperty(rows, 'warnings', { value: warnings, enumerable: false });
  return rows;
}

module.exports = { buildCap14Rows };

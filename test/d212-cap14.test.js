/**
 * Unit tests for lib/d212-cap14.js — foreign-income row builder.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCap14Rows } = require('../lib/d212-cap14');

test('empty data → zero rows', () => {
  assert.deepEqual(buildCap14Rows({}), []);
  assert.deepEqual(buildCap14Rows(null), []);
  assert.deepEqual(buildCap14Rows(undefined), []);
});

test('US dividends only → single row with categ_venit=2018 + credit fiscal cap', () => {
  // 1000 USD dividends, 150 USD withheld (15% per 1042-S). At rate 4.5:
  //   Rd.1 = 4500, Rd.8 = 450 (10%), Rd.9 = 675. Rd.10 = min(450, 675) = 450.
  //   Rd.11 = max(0, 450 - 450) = 0 (excess 225 RON not recoverable via D212).
  const rows = buildCap14Rows({
    exchangeRate: 4.5,
    dividendsRON: 4500,
    divTaxRate: 0.10,
    usDivForeignTaxRON: 675,
    usDivCreditRON: 450,
  });
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.str_stat_realiz_v, 'US');
  assert.equal(r.str_categ_venit, '2018');
  assert.equal(r.dubla_impunere, '1');
  assert.equal(r.str_venit_brut, 4500);
  assert.equal(r.str_chelt_deduc, 0);
  assert.equal(r.str_venit_net_anual, 4500);
  assert.equal(r.str_impozit_datorat_Ro, 450);
  assert.equal(r.str_impozit_platit, 675);
  assert.equal(r.str_credit_fiscal, 450);
  assert.equal(r.str_dif_impozit_datorat, 0);
});

test('US capital gains only → single row with categ_venit=2012 + BIK in chelt_deduc', () => {
  // 10000 USD sale, 6000 USD cost, 2000 RON BIK already taxed as salary.
  // At rate 4.5: sale=45000, cost=27000, BIK=2000, net = max(0, 45000-29000) = 16000.
  // Rd.8 = 1600 (10%), Rd.9 = 0 (no US capgains tax for RO resident).
  const rows = buildCap14Rows({
    exchangeRate: 4.5,
    capitalGainsSaleUSD: 10000,
    capitalGainsCostUSD: 6000,
    salaryTaxedRON: 2000,
    capGainsTaxRate: 0.10,
    usNetGainsRON: 16000,
  });
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.str_categ_venit, '2012');
  assert.equal(r.str_venit_brut, 45000);
  assert.equal(r.str_chelt_deduc, 29000);
  assert.equal(r.str_venit_net_anual, 16000);
  assert.equal(r.str_impozit_datorat_Ro, 1600);
  assert.equal(r.str_impozit_platit, 0);
  assert.equal(r.str_credit_fiscal, 0);
  assert.equal(r.str_dif_impozit_datorat, 1600);
});

test('combined dividends + capital gains → two rows in stable order', () => {
  // Order matters for golden XML tests: dividends always before capgains.
  const rows = buildCap14Rows({
    exchangeRate: 4.5,
    dividendsRON: 2000,
    divTaxRate: 0.10,
    usDivForeignTaxRON: 300,
    usDivCreditRON: 200,
    capitalGainsSaleUSD: 1000,
    capitalGainsCostUSD: 500,
    salaryTaxedRON: 0,
    capGainsTaxRate: 0.10,
    usNetGainsRON: 2250,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].str_categ_venit, '2018');
  assert.equal(rows[1].str_categ_venit, '2012');
});

test('credit fiscal never exceeds Romanian tax due (US-RO treaty)', () => {
  // 1000 RON dividends with 500 RON withheld in US (clearly over-withheld).
  // Rd.8 = 100, Rd.10 should cap at 100.
  const rows = buildCap14Rows({
    dividendsRON: 1000,
    divTaxRate: 0.10,
    usDivForeignTaxRON: 500,
    usDivCreditRON: 100,
  });
  assert.equal(rows[0].str_credit_fiscal, 100);
  assert.equal(rows[0].str_dif_impozit_datorat, 0); // nothing more owed
});

// --- Per-country RO-broker foreign dividends (XTB / BT Capital Partners) ---

test('roBrokerForeignDividendsByCountry merges per (country, 2018)', () => {
  // XTB and Fidelity both contribute to the same US:2018 bucket: must produce
  // exactly ONE cap14 row with combined amounts. Per docs/d212-mapping.md § 4,
  // cap14 element repeats once per (country × category) tuple.
  const rows = buildCap14Rows({
    dividendsRON: 1000, // Fidelity 1042-S
    usDivForeignTaxRON: 150,
    divTaxRate: 0.08,
    roBrokerForeignDividendsByCountry: [
      { country: 'US', grossRON: 500, taxRON: 75, sources: [{ broker: 'XTB' }] },
      { country: 'DE', grossRON: 400, taxRON: 100, sources: [{ broker: 'BT Capital Partners' }] },
    ],
  });
  // 2 dividend rows: US (merged) + DE
  const usDiv = rows.find(r => r.str_categ_venit === '2018' && r.str_stat_realiz_v === 'US');
  const deDiv = rows.find(r => r.str_categ_venit === '2018' && r.str_stat_realiz_v === 'DE');
  assert.ok(usDiv);
  assert.ok(deDiv);
  assert.equal(usDiv.str_venit_brut, 1500); // 1000 + 500 merged
  assert.equal(usDiv.str_impozit_platit, 225); // 150 + 75 merged
  assert.equal(deDiv.str_venit_brut, 400);
  assert.equal(deDiv.str_impozit_platit, 100);
  // Ensure no duplicate US row
  const usCount = rows.filter(r => r.str_categ_venit === '2018' && r.str_stat_realiz_v === 'US').length;
  assert.equal(usCount, 1);
});

test('invalid country code (XS) is dropped with a warning', () => {
  const rows = buildCap14Rows({
    divTaxRate: 0.08,
    roBrokerForeignDividendsByCountry: [
      { country: 'XS', grossRON: 500, taxRON: 50, sources: [{ broker: 'XTB' }] },
      { country: 'US', grossRON: 1000, taxRON: 150, sources: [{ broker: 'BT Capital Partners' }] },
    ],
  });
  // Only US emitted; XS dropped.
  const dividendRows = rows.filter(r => r.str_categ_venit === '2018');
  assert.equal(dividendRows.length, 1);
  assert.equal(dividendRows[0].str_stat_realiz_v, 'US');
  assert.equal(rows.warnings.length, 1);
  assert.equal(rows.warnings[0].kind, 'invalid_country');
  assert.equal(rows.warnings[0].country, 'XS');
});

test('unknown-country manual entries surface a warning', () => {
  const rows = buildCap14Rows({
    divTaxRate: 0.08,
    roBrokerUnknownCountryDividendsRON: 250,
  });
  assert.equal(rows.length, 0);
  assert.equal(rows.warnings.length, 1);
  assert.equal(rows.warnings[0].kind, 'unknown_country');
});

test('den_stat is populated from COUNTRY_CODE_TO_RO for known codes', () => {
  const rows = buildCap14Rows({
    divTaxRate: 0.08,
    roBrokerForeignDividendsByCountry: [
      { country: 'DE', grossRON: 100, taxRON: 26, sources: [] },
      { country: 'NL', grossRON: 100, taxRON: 15, sources: [] },
      { country: 'GB', grossRON: 100, taxRON: 0, sources: [] },
    ],
  });
  const de = rows.find(r => r.str_stat_realiz_v === 'DE');
  const nl = rows.find(r => r.str_stat_realiz_v === 'NL');
  const gb = rows.find(r => r.str_stat_realiz_v === 'GB');
  assert.equal(de.den_stat, 'Germania');
  assert.equal(nl.den_stat, 'Olanda');
  assert.equal(gb.den_stat, 'Marea Britanie');
});

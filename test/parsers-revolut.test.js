/**
 * Unit tests for lib/parsers/revolut.js.
 *
 * Fixtures are SYNTHETIC — different stock, different ISIN, different
 * amounts, different dates compared to any real client statement. None of
 * the values here match real Rheinmetall / RHM / DE0007030009 numbers from
 * the actual sample PDF; the symbols/ISINs here are fictional placeholders
 * that don't correspond to real securities.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRevolutStatement } = require('../lib/parsers/revolut');

const SINGLE_SHORT_FIXTURE = `
Consolidated statement
Jan 1, 2025 - Dec 31, 2025
SOMEONE EXAMPLE
EXAMPLE STREET 1
000000
SOMEWHERE
Summary for Brokerage Account - EUR
Sells summary Amount
Gross proceeds €1,200
Cost basis €1,000
Realised gross PnL €200
Other Income and Fees summary Amount
Dividends €0
Withholding tax $0
Amount €0

Transactions for Brokerage Account — Sells - EUR
Date
of Purchase
of Sale
Security name
Symbol /
ISIN
Country Qty. Cost basis Gross proceeds
Gross
PnL
Fees
Mar 10, 2025
Mar 20, 2025
Synthetic Holdings Plc SYN
IE0000000001
IE 10.00000000€1,000
5,000 RON
Rate: 5.000
€1,200
6,012 RON
Rate: 5.010
€200
1,012 RON
€0
0 RON
Information about Brokerage Account statement
This statement is provided by Revolut Securities Europe UAB...
`;

const TWO_TRANSACTIONS_FIXTURE = `
Summary for Brokerage Account - EUR
Sells summary Amount
Gross proceeds €3,500
Cost basis €3,200
Realised gross PnL €300
Other Income and Fees summary Amount
Dividends €0
Withholding tax $0
Amount €0

Transactions for Brokerage Account — Sells - EUR
Mar 10, 2024
Mar 20, 2025
Synthetic Holdings Plc SYN
IE0000000001
IE 10.00000000€1,000
4,950 RON
Rate: 4.950
€1,400
7,000 RON
Rate: 5.000
€400
2,050 RON
€0
0 RON
Aug 01, 2025
Aug 10, 2025
Fake Industries SA FKE
FR0000000002
FR 5.50000000€2,200
11,000 RON
Rate: 5.000
€2,100
10,500 RON
Rate: 5.000
€-100
-500 RON
€0
0 RON
Information about Brokerage Account statement
`;

// ---- Summary parsing ----

test('parseRevolutStatement: summary section extracted', () => {
  const r = parseRevolutStatement(SINGLE_SHORT_FIXTURE, 2025);
  assert.equal(r.summary.grossProceedsEUR, 1200);
  assert.equal(r.summary.costBasisEUR, 1000);
  assert.equal(r.summary.realisedPnLEUR, 200);
  assert.equal(r.summary.dividendsEUR, 0);
  assert.equal(r.summary.withholdingTaxUSD, 0);
});

test('parseRevolutStatement: broker + source identifiers set', () => {
  const r = parseRevolutStatement(SINGLE_SHORT_FIXTURE, 2025);
  assert.equal(r.source, 'Revolut');
  assert.equal(r.broker, 'Revolut Securities Europe UAB');
  assert.equal(r.foreignBroker, true);
});

// ---- Sales parsing ----

test('parseRevolutStatement: single-sale fixture extracts one row with all fields', () => {
  const r = parseRevolutStatement(SINGLE_SHORT_FIXTURE, 2025);
  assert.equal(r.sales.length, 1);
  const s = r.sales[0];
  assert.equal(s.symbol, 'SYN');
  assert.equal(s.isin, 'IE0000000001');
  assert.equal(s.country, 'IE');
  assert.equal(s.quantity, 10);
  assert.equal(s.purchaseDate, 'Mar 10, 2025');
  assert.equal(s.saleDate, 'Mar 20, 2025');
  assert.equal(s.costBasisEUR, 1000);
  assert.equal(s.costBasisRON, 5000);
  assert.equal(s.costBasisRate, 5.0);
  assert.equal(s.proceedsEUR, 1200);
  assert.equal(s.proceedsRON, 6012);
  assert.equal(s.proceedsRate, 5.01);
  assert.equal(s.pnlEUR, 200);
  assert.equal(s.pnlRON, 1012);
  assert.equal(s.feesEUR, 0);
});

test('parseRevolutStatement: holding period correctly bucketed as short (<365 days)', () => {
  const r = parseRevolutStatement(SINGLE_SHORT_FIXTURE, 2025);
  const s = r.sales[0];
  assert.equal(s.holdingDays, 10);
  assert.equal(s.bucket, 'short');
});

test('parseRevolutStatement: long bucket when purchase-to-sale ≥ 365 days', () => {
  const r = parseRevolutStatement(TWO_TRANSACTIONS_FIXTURE, 2025);
  const synSale = r.sales.find(s => s.symbol === 'SYN');
  // Mar 10, 2024 → Mar 20, 2025 = 375 days → long.
  assert.ok(synSale.holdingDays >= 365);
  assert.equal(synSale.bucket, 'long');
});

test('parseRevolutStatement: multi-transaction fixture extracts all rows', () => {
  const r = parseRevolutStatement(TWO_TRANSACTIONS_FIXTURE, 2025);
  assert.equal(r.sales.length, 2);
  const syn = r.sales.find(s => s.symbol === 'SYN');
  const fke = r.sales.find(s => s.symbol === 'FKE');
  assert.ok(syn && fke);
  assert.equal(syn.country, 'IE');
  assert.equal(fke.country, 'FR');
});

test('parseRevolutStatement: negative PnL is captured (loss)', () => {
  const r = parseRevolutStatement(TWO_TRANSACTIONS_FIXTURE, 2025);
  const fke = r.sales.find(s => s.symbol === 'FKE');
  assert.equal(fke.pnlEUR, -100);
  assert.equal(fke.pnlRON, -500);
});

// ---- Per-country aggregates ----

test('parseRevolutStatement: aggregates per country and per holding bucket', () => {
  const r = parseRevolutStatement(TWO_TRANSACTIONS_FIXTURE, 2025);
  assert.equal(r.countries.length, 2);
  const ie = r.countries.find(c => c.country === 'IE');
  const fr = r.countries.find(c => c.country === 'FR');

  // SYN is long-bucket (>365 days), PnL +400 EUR / +2050 RON
  assert.equal(ie.longGainRON, 2050);
  assert.equal(ie.longLossRON, 0);
  assert.equal(ie.shortGainRON, 0);

  // FKE is short-bucket, PnL -100 EUR / -500 RON → loss
  assert.equal(fr.shortGainRON, 0);
  assert.equal(fr.shortLossRON, 500);
  assert.equal(fr.longGainRON, 0);
});

test('parseRevolutStatement: long/short totals sum across countries', () => {
  const r = parseRevolutStatement(TWO_TRANSACTIONS_FIXTURE, 2025);
  assert.equal(r.longTerm.gainRON, 2050);
  assert.equal(r.longTerm.lossRON, 0);
  assert.equal(r.shortTerm.gainRON, 0);
  assert.equal(r.shortTerm.lossRON, 500);
});

test('parseRevolutStatement: totalGainRON = sum gains - sum losses', () => {
  const r = parseRevolutStatement(TWO_TRANSACTIONS_FIXTURE, 2025);
  // 2050 + 0 - 0 - 500 = 1550
  assert.equal(r.totalGainRON, 1550);
});

test('parseRevolutStatement: Revolut never withholds tax at source → totalTaxWithheldRON is 0', () => {
  // Critical regression: user explicitly noted "Revolut e broker extern
  // și nu s-a reținut impozit la sursă". This test pins that invariant.
  const r = parseRevolutStatement(TWO_TRANSACTIONS_FIXTURE, 2025);
  assert.equal(r.totalTaxWithheldRON, 0);
  for (const c of r.countries) {
    assert.equal(c.longTaxRON, 0);
    assert.equal(c.shortTaxRON, 0);
  }
});

// ---- CASS base: legal-reference test (D212 Instrucțiuni OMF 2736/2025 pct. 51) ----
//
// Per pct. 51 from the official ANAF instructions, the CASS threshold base
// uses the NET capital gain (gain - loss), NOT the gross proceeds from sale.
// This is the same rule for Revolut (foreign broker) as for any RO broker
// — the legal basis is art. 95 Cod Fiscal which defines "câștigul net din
// transferul titlurilor de valoare".
//
// This test pins the rule against accidental refactors that might confuse
// gross proceeds (~33,255 RON for the real RHM sample) with the gain
// (~2,913 RON, the actual CASS-base contribution).
test('parseRevolutStatement: CASS-base value is NET gain, NOT gross proceeds (pct.51 D212 instr.)', () => {
  // Synthetic fixture: sale of €1,200 proceeds with €1,000 cost basis,
  // so gross proceeds = 6,012 RON, gain = 1,012 RON. CASS base must use
  // 1,012 RON (the net gain), not 6,012 RON (the gross proceeds).
  const r = parseRevolutStatement(SINGLE_SHORT_FIXTURE, 2025);
  const sale = r.sales[0];

  // Sanity: gross proceeds and gain are different values in the fixture
  // so a confused implementation would visibly fail this assert.
  assert.notEqual(sale.proceedsRON, sale.pnlRON);

  // The per-country aggregate uses the gain, not the proceeds.
  const ie = r.countries.find(c => c.country === 'IE');
  assert.equal(ie.shortGainRON, sale.pnlRON);  // 1,012 RON
  assert.notEqual(ie.shortGainRON, sale.proceedsRON);  // ≠ 6,012 RON

  // totalGainRON aggregates net gains, not proceeds.
  assert.equal(r.totalGainRON, sale.pnlRON);
  assert.notEqual(r.totalGainRON, sale.proceedsRON);
});

// ---- Edge cases ----

test('parseRevolutStatement: empty input → no sales, zero totals', () => {
  const r = parseRevolutStatement('not a statement', 2025);
  assert.equal(r.sales.length, 0);
  assert.equal(r.countries.length, 0);
  assert.equal(r.totalGainRON, 0);
  assert.equal(r.totalTaxWithheldRON, 0);
});

test('parseRevolutStatement: summary-only PDF (no transactions section) still returns summary', () => {
  const fixture = `
Summary for Brokerage Account - EUR
Sells summary Amount
Gross proceeds €500
Cost basis €450
Realised gross PnL €50
`;
  const r = parseRevolutStatement(fixture, 2025);
  assert.equal(r.summary.grossProceedsEUR, 500);
  assert.equal(r.sales.length, 0);
});

/**
 * Unit tests for lib/parsers/bt.js (BT Capital Partners / bt-trade.ro).
 *
 * Fixtures are SYNTHETIC — derived from the structure of the real PDFs but
 * with placeholder tickers, ISINs and amounts. The real PDFs contain
 * CNP / address / fiscal-code PII that must not enter the repo.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBtDividends, parseBtPortfolio } = require('../lib/parsers/bt');

// --- parseBtDividends ---
//
// Fixture amounts are intentionally arbitrary and DO NOT match any real
// dividend payout. The structure mirrors the bt-trade.ro Fisa Dividende
// PDF but every gross/tax/net/per-unit/rate value is fictitious so the
// test cannot be reverse-engineered to reveal which stocks a user holds.
const DIV_FIXTURE = `
DIVIDENDE/DOBANZI INCASATE PE PIETE EXTERNE PRIN INTERMEDIUL BT CAPITAL PARTNERS SA IN ANUL 2025
SIMBOL MONEDA ISIN CANTITATE DATA PLATII
BRUT PE
UNITATE
COTA
IMPOZIT
BRUT IMPOZIT ALTE TAXE NET DATA INCASARII
SYM1 EUR NL0000000001 7 01.02.2025 0.50000000 12.00 % 3.50 0.42 0.00 3.08 02.02.2025
SYM2 EUR DE0000000002 3 14.07.2025 1.00000000 20.00 % 3.00 0.60 0.00 2.40 14.07.2025
SYM3 USD US0000000003 11 22.09.2025 0.10000000 5.00 % 1.10 0.06 0.00 1.04 22.09.2025
`;

test('parseBtDividends: extracts all dividend rows with symbol/ISIN/currency', () => {
  const r = parseBtDividends(DIV_FIXTURE, 2025);
  assert.equal(r.dividendRows.length, 3);
  assert.equal(r.broker, 'BT Capital Partners');

  const sym1 = r.dividendRows.find(x => x.symbol === 'SYM1');
  assert.equal(sym1.isin, 'NL0000000001');
  assert.equal(sym1.currency, 'EUR');
  assert.equal(sym1.quantity, 7);
  assert.equal(sym1.payDate, '01.02.2025');
  assert.equal(sym1.gross, 3.5);
  assert.equal(sym1.tax, 0.42);
  assert.equal(sym1.net, 3.08);
  assert.equal(sym1.withholdingRate, 12);
});

test('parseBtDividends: converts EUR + USD to RON using BNR annual rates', () => {
  const r = parseBtDividends(DIV_FIXTURE, 2025);
  // Each row should be non-zero in RON; we don't pin exact BNR rates here
  // (rates.js owns those) but we verify the conversion sign + non-zero.
  for (const row of r.dividendRows) {
    assert.ok(row.grossRON > 0, `${row.symbol} grossRON > 0`);
    assert.ok(row.taxRON >= 0, `${row.symbol} taxRON >= 0`);
    assert.ok(row.netRON > 0, `${row.symbol} netRON > 0`);
  }
});

test('parseBtDividends: sums all rows into totals on result.dividends', () => {
  const r = parseBtDividends(DIV_FIXTURE, 2025);
  const sumGross = r.dividendRows.reduce((s, x) => s + x.grossRON, 0);
  const sumTax = r.dividendRows.reduce((s, x) => s + x.taxRON, 0);
  const sumNet = r.dividendRows.reduce((s, x) => s + x.netRON, 0);
  assert.ok(Math.abs(r.dividends.grossRON - sumGross) < 0.01);
  assert.ok(Math.abs(r.dividends.taxWithheldRON - sumTax) < 0.01);
  assert.ok(Math.abs(r.dividends.netRON - sumNet) < 0.01);
});

test('parseBtDividends: skips rows where gross + tax + net are all zero', () => {
  // Use clearly synthetic, non-real-PDF values here too.
  const fixture = `
SYM1 EUR NL0000000001 0 01.02.2025 0.00 0.00 % 0.00 0.00 0.00 0.00 01.02.2025
SYM2 EUR DE0000000002 4 14.07.2025 2.00 10.00 % 8.00 0.80 0.00 7.20 14.07.2025
`;
  const r = parseBtDividends(fixture, 2025);
  assert.equal(r.dividendRows.length, 1);
  assert.equal(r.dividendRows[0].symbol, 'SYM2');
});

test('parseBtDividends: empty input → no rows, no totals', () => {
  const r = parseBtDividends('not a dividend statement', 2025);
  assert.equal(r.dividendRows.length, 0);
  assert.equal(r.dividends.grossRON, 0);
  assert.equal(r.dividends.taxWithheldRON, 0);
});

test('parseBtDividends: tags each row with ISO country code from ISIN prefix', () => {
  const r = parseBtDividends(DIV_FIXTURE, 2025);
  const byIsin = Object.fromEntries(r.dividendRows.map(x => [x.isin, x.country]));
  assert.equal(byIsin['NL0000000001'], 'NL');
  assert.equal(byIsin['DE0000000002'], 'DE');
  assert.equal(byIsin['US0000000003'], 'US');
});

test('parseBtDividends: aggregates per-country buckets in dividendsByCountry', () => {
  const r = parseBtDividends(DIV_FIXTURE, 2025);
  assert.equal(r.dividendsByCountry.length, 3);
  const nl = r.dividendsByCountry.find(c => c.country === 'NL');
  const de = r.dividendsByCountry.find(c => c.country === 'DE');
  const us = r.dividendsByCountry.find(c => c.country === 'US');
  assert.ok(nl && nl.grossRON > 0 && nl.isRomanian === false);
  assert.ok(de && de.grossRON > 0 && de.isRomanian === false);
  assert.ok(us && us.grossRON > 0 && us.isRomanian === false);
  // Per-country sums equal total
  const sumGross = r.dividendsByCountry.reduce((s, c) => s + c.grossRON, 0);
  assert.ok(Math.abs(sumGross - r.dividends.grossRON) < 0.01);
});

test('parseBtDividends: flags Romanian dividends (RO ISIN) with isRomanian=true', () => {
  const fixture = `
SYM1 RON ROXXX00ABCD9 100 01.06.2025 0.10 8.00 % 10.00 0.80 0.00 9.20 01.06.2025
SYM2 EUR DE0000000999 5 14.07.2025 2.00 26.00 % 10.00 2.60 0.00 7.40 14.07.2025
`;
  const r = parseBtDividends(fixture, 2025);
  const ro = r.dividendsByCountry.find(c => c.country === 'RO');
  const de = r.dividendsByCountry.find(c => c.country === 'DE');
  assert.ok(ro && ro.isRomanian === true);
  assert.ok(de && de.isRomanian === false);
});

// --- parseBtPortfolio ---

const PORT_FIXTURE = `
FISA DE PORTOFOLIU
ANUL FISCAL 2025
Transferul titlurilor de valoare detinute in portofoliu, altele decat titlurile de participare
Nr.
crt.
Tara de provenienta a
castigului/pierderii
Moneda realizarii
>= 365 zile < 365 zile
Castig Pierdere Impozit Castig Pierdere Impozit
1 ROMANIA / BVB RON 0.00 0.00 0.00 100.00 50.00 0.00
2 GERMANIA / XETRA Frankfurt RON 0.00 0.00 0.00 5,000.00 1,000.00 200.00
3 FRANTA / Euronext Paris RON 1,200.00 0.00 12.00 800.00 200.00 16.00
`;

test('parseBtPortfolio: extracts all country rows with long+short buckets', () => {
  const r = parseBtPortfolio(PORT_FIXTURE, 2025);
  assert.equal(r.countries.length, 3);

  const ro = r.countries.find(c => c.country.startsWith('ROMANIA'));
  assert.equal(ro.currency, 'RON');
  assert.equal(ro.shortGain, 100);
  assert.equal(ro.shortLoss, 50);
  assert.equal(ro.shortTax, 0);

  const de = r.countries.find(c => c.country.startsWith('GERMANIA'));
  assert.equal(de.shortGain, 5000);
  assert.equal(de.shortLoss, 1000);
  assert.equal(de.shortTax, 200);

  const fr = r.countries.find(c => c.country.startsWith('FRANTA'));
  assert.equal(fr.longGain, 1200);
  assert.equal(fr.longTax, 12);
  assert.equal(fr.shortGain, 800);
});

test('parseBtPortfolio: sums long + short buckets across countries', () => {
  const r = parseBtPortfolio(PORT_FIXTURE, 2025);
  // Long: only Franta has long_gain 1200
  assert.equal(r.longTerm.gainRON, 1200);
  assert.equal(r.longTerm.taxWithheldRON, 12);
  // Short: 100 + 5000 + 800 = 5900 gain; 50 + 1000 + 200 = 1250 loss
  assert.equal(r.shortTerm.gainRON, 5900);
  assert.equal(r.shortTerm.lossRON, 1250);
  // Tax: 0 + 200 + 16 = 216
  assert.equal(r.shortTerm.taxWithheldRON, 216);
});

test('parseBtPortfolio: totalGainRON = (long+short gain) - (long+short loss)', () => {
  const r = parseBtPortfolio(PORT_FIXTURE, 2025);
  // 1200 + 5900 - 0 - 1250 = 5850
  assert.equal(r.totalGainRON, 5850);
  // 12 + 216 = 228
  assert.equal(r.totalTaxWithheldRON, 228);
});

test('parseBtPortfolio: skips fully-zero rows (BT prints placeholders)', () => {
  const fixture = `
1 ROMANIA / BVB RON 0.00 0.00 0.00 0.00 0.00 0.00
2 GERMANIA RON 0.00 0.00 0.00 100.00 0.00 10.00
`;
  const r = parseBtPortfolio(fixture, 2025);
  assert.equal(r.countries.length, 1);
  assert.equal(r.countries[0].country.startsWith('GERMANIA'), true);
});

test('parseBtPortfolio: detects single currency vs MIXED', () => {
  const allRon = parseBtPortfolio(PORT_FIXTURE, 2025);
  assert.equal(allRon.currency, 'RON');

  const mixed = parseBtPortfolio(`
1 GERMANIA RON 0.00 0.00 0.00 100.00 0.00 10.00
2 FRANTA EUR 0.00 0.00 0.00 50.00 0.00 5.00
`, 2025);
  assert.equal(mixed.currency, 'MIXED');
});

test('parseBtPortfolio: empty input → no countries, no totals', () => {
  const r = parseBtPortfolio('not a portfolio statement', 2025);
  assert.equal(r.countries.length, 0);
  assert.equal(r.totalGainRON, 0);
  assert.equal(r.totalTaxWithheldRON, 0);
});

test('parseBtPortfolio: preserves exchange suffix in country label', () => {
  // "ROMANIA / BVB" vs "GERMANIA / XETRA Frankfurt" — the exchange name
  // disambiguates same-country labels and is kept by the parser.
  const r = parseBtPortfolio(PORT_FIXTURE, 2025);
  assert.ok(r.countries[1].country.includes('XETRA'));
  assert.ok(r.countries[2].country.includes('Euronext'));
});

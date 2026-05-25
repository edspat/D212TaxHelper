/**
 * Unit tests for the XTB report parsers in lib/parsers/xtb.js.
 * Run with: npm test
 *
 * Fixtures under test/fixtures/ are SYNTHETIC (round amounts, generic names).
 * They mirror the layout produced by pdf-parse on real XTB PDFs but contain
 * no personal data.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseXtbDividends, parseXtbPortfolio } = require('../lib/parsers/xtb');

const FIXTURES = path.join(__dirname, 'fixtures');

function loadFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

// ============ parseXtbDividends ============

test('parseXtbDividends: captures all dividend rows in RON', () => {
  const text = loadFixture('xtb-dividends-ron.txt');
  const result = parseXtbDividends(text, 2025);
  assert.equal(result.dividendRows.length, 2, 'should capture both dividend rows');
  // Row 1: Statele Unite — 1000.00 / 100.00 / 900.00
  assert.equal(result.dividendRows[0].gross, 1000.00);
  assert.equal(result.dividendRows[0].tax, 100.00);
  assert.equal(result.dividendRows[0].net, 900.00);
  assert.equal(result.dividendRows[0].currency, 'RON');
  assert.match(result.dividendRows[0].category, /Statele Unite/);
  // Row 2: Germania — 500.50 / 50.05 / 450.45
  assert.equal(result.dividendRows[1].gross, 500.50);
  assert.equal(result.dividendRows[1].tax, 50.05);
  assert.match(result.dividendRows[1].category, /Germania/);
});

test('parseXtbDividends: aggregates totals in RON across rows', () => {
  const text = loadFixture('xtb-dividends-ron.txt');
  const result = parseXtbDividends(text, 2025);
  assert.equal(result.dividends.grossRON, 1000 + 500.50);
  assert.equal(result.dividends.taxWithheldRON, 100 + 50.05);
  assert.equal(result.dividends.netRON, 900 + 450.45);
});

test('parseXtbDividends: separates dividends from interest section', () => {
  const text = loadFixture('xtb-dividends-ron.txt');
  const result = parseXtbDividends(text, 2025);
  assert.equal(result.interestRows.length, 1, 'should capture interest row');
  assert.equal(result.interestRows[0].gross, 200);
  assert.equal(result.interestRows[0].tax, 20);
  assert.equal(result.interestRows[0].net, 180);
  assert.match(result.interestRows[0].payer, /XTB/);
});

test('parseXtbDividends: dividend rows are NOT captured as interest rows', () => {
  const text = loadFixture('xtb-dividends-ron.txt');
  const result = parseXtbDividends(text, 2025);
  // The interest section should not contain rows like "Instrumente..."
  for (const row of result.interestRows) {
    assert.doesNotMatch(row.payer, /Instrumente/);
  }
});

test('parseXtbDividends: empty/junk input does not throw', () => {
  const result = parseXtbDividends('', 2025);
  assert.equal(result.dividendRows.length, 0);
  assert.equal(result.interestRows.length, 0);
  assert.equal(result.dividends.grossRON, 0);
});

test('parseXtbDividends: extracts ISO country from "din <Country>" suffix', () => {
  const text = require('fs').readFileSync('test/fixtures/xtb-dividends-ron.txt', 'utf8');
  const result = parseXtbDividends(text, 2025);
  const us = result.dividendRows.find(r => /Statele Unite/i.test(r.category));
  const de = result.dividendRows.find(r => /Germania/i.test(r.category));
  assert.equal(us && us.country, 'US');
  assert.equal(de && de.country, 'DE');
});

test('parseXtbDividends: aggregates per-country buckets in dividendsByCountry', () => {
  const text = require('fs').readFileSync('test/fixtures/xtb-dividends-ron.txt', 'utf8');
  const result = parseXtbDividends(text, 2025);
  assert.equal(result.dividendsByCountry.length, 2);
  const us = result.dividendsByCountry.find(c => c.country === 'US');
  const de = result.dividendsByCountry.find(c => c.country === 'DE');
  assert.ok(us && us.grossRON > 0 && us.isRomanian === false);
  assert.ok(de && de.grossRON > 0 && de.isRomanian === false);
  // Per-country sums equal total
  const sumGross = result.dividendsByCountry.reduce((s, c) => s + c.grossRON, 0);
  assert.ok(Math.abs(sumGross - result.dividends.grossRON) < 0.01);
});

test('parseXtbDividends: dividends without "din X" suffix yield country=null', () => {
  const text = `
DIVIDENDE
1 100.00 10.00 90.00 Instrumente actiuni
`;
  const result = parseXtbDividends(text, 2025);
  assert.equal(result.dividendRows.length, 1);
  assert.equal(result.dividendRows[0].country, null);
  const bucket = result.dividendsByCountry[0];
  assert.equal(bucket.country, null);
});

// ============ parseXtbPortfolio ============

test('parseXtbPortfolio: captures multiple country rows (regression: only first was captured)', () => {
  const text = loadFixture('xtb-portfolio-mixed-currency.txt');
  const result = parseXtbPortfolio(text, 2025);
  assert.equal(result.countries.length, 3, 'should capture Irlanda + Statele Unite + Germania');
});

test('parseXtbPortfolio: cleans country name (removes instrument prefix)', () => {
  const text = loadFixture('xtb-portfolio-mixed-currency.txt');
  const result = parseXtbPortfolio(text, 2025);
  const names = result.countries.map(c => c.country);
  assert.deepEqual(names, ['Irlanda', 'Statele Unite', 'Germania']);
});

test('parseXtbPortfolio: preserves each row currency', () => {
  const text = loadFixture('xtb-portfolio-mixed-currency.txt');
  const result = parseXtbPortfolio(text, 2025);
  assert.equal(result.countries[0].currency, 'RON');
  assert.equal(result.countries[1].currency, 'RON');
  assert.equal(result.countries[2].currency, 'EUR');
});

test('parseXtbPortfolio: aggregates long/short gain and loss across countries', () => {
  const text = loadFixture('xtb-portfolio-mixed-currency.txt');
  const result = parseXtbPortfolio(text, 2025);
  // Long-term:
  //   Irlanda RON +0, Statele Unite RON +100, Germania EUR +50 (× 5.0415 = 252.075)
  //   gain = 100 + 252.075 = 352.075
  //   loss = 0
  //   tax = 0 + 1 + 0.5*5.0415 = 3.52075
  assert.ok(Math.abs(result.longTerm.gainRON - (100 + 50 * 5.0415)) < 0.01);
  assert.equal(result.longTerm.lossRON, 0);
  // Short-term:
  //   Irlanda RON loss 5000, Statele Unite RON +10000 -1000 tax 300, Germania EUR +200 -0 tax 6
  //   gain = 0 + 10000 + 200*5.0415 = 11008.30
  //   loss = 5000 + 1000 = 6000
  assert.ok(Math.abs(result.shortTerm.gainRON - (10000 + 200 * 5.0415)) < 0.01);
  assert.equal(result.shortTerm.lossRON, 6000);
});

test('parseXtbPortfolio: converts EUR amounts to RON using BNR 2025', () => {
  const text = loadFixture('xtb-portfolio-mixed-currency.txt');
  const result = parseXtbPortfolio(text, 2025);
  const germany = result.countries[2];
  assert.equal(germany.currency, 'EUR');
  assert.equal(germany.longGain, 50);
  assert.equal(germany.longGainRON, 50 * 5.0415);
  assert.equal(germany.shortGain, 200);
  assert.equal(germany.shortGainRON, 200 * 5.0415);
});

test('parseXtbPortfolio: currency field reflects mixed currencies', () => {
  const text = loadFixture('xtb-portfolio-mixed-currency.txt');
  const result = parseXtbPortfolio(text, 2025);
  // Two countries are RON, one is EUR → MIXED
  assert.equal(result.currency, 'MIXED');
});

test('parseXtbPortfolio: empty input returns no countries and zero totals', () => {
  const result = parseXtbPortfolio('', 2025);
  assert.equal(result.countries.length, 0);
  assert.equal(result.longTerm.gainRON, 0);
  assert.equal(result.shortTerm.gainRON, 0);
  assert.equal(result.totalGainRON, 0);
});

test('parseXtbPortfolio: filters out header row false positives', () => {
  // Headers like "Câștig Pierdere Impozit" with numbers should not be parsed as a country.
  const text = loadFixture('xtb-portfolio-mixed-currency.txt');
  const result = parseXtbPortfolio(text, 2025);
  for (const c of result.countries) {
    assert.doesNotMatch(c.country, /^Câ?știg|^Pierdere|^Impozit|^Moneda|^Nr/i);
  }
});

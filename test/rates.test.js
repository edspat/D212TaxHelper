/**
 * Unit tests for the BNR rates / currency helpers in lib/rates.js.
 * Run with: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { BNR_EXCHANGE_RATES, toRON, parseNumber, detectCurrency, D212_ALLOWED_COUNTRY_CODES, COUNTRY_CODE_TO_RO, roCountryNameToIso, isinToCountryCode } = require('../lib/rates');

test('BNR_EXCHANGE_RATES contains all years 2019-2025', () => {
  for (const year of [2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
    assert.ok(BNR_EXCHANGE_RATES[year], `Missing year ${year}`);
    assert.ok(BNR_EXCHANGE_RATES[year].usdRon > 0, `Missing usdRon for ${year}`);
    assert.ok(BNR_EXCHANGE_RATES[year].eurRon > 0, `Missing eurRon for ${year}`);
  }
});

test('BNR_EXCHANGE_RATES official BNR values for 2025', () => {
  assert.equal(BNR_EXCHANGE_RATES[2025].usdRon, 4.4705);
  assert.equal(BNR_EXCHANGE_RATES[2025].eurRon, 5.0415);
});

test('BNR_EXCHANGE_RATES has correct 2021 EUR (4.9204, not 4.9207)', () => {
  // Regression: an earlier version of the codebase had 4.9207 (from a third-party
  // aggregator). The authoritative BNR series shows 4.9204.
  assert.equal(BNR_EXCHANGE_RATES[2021].eurRon, 4.9204);
});

test('BNR_EXCHANGE_RATES has correct 2023 EUR (4.9465, not 4.9456)', () => {
  assert.equal(BNR_EXCHANGE_RATES[2023].eurRon, 4.9465);
});

test('toRON: returns RON amounts unchanged', () => {
  assert.equal(toRON(1000, 'RON', 2025), 1000);
  assert.equal(toRON(0, 'RON', 2025), 0);
});

test('toRON: converts EUR using BNR eurRon for the year', () => {
  assert.equal(toRON(100, 'EUR', 2025), 100 * 5.0415);
  assert.equal(toRON(100, 'EUR', 2023), 100 * 4.9465);
});

test('toRON: converts USD using BNR usdRon for the year', () => {
  assert.equal(toRON(100, 'USD', 2025), 100 * 4.4705);
  assert.equal(toRON(100, 'USD', 2019), 100 * 4.2379);
});

test('toRON: case-insensitive currency code', () => {
  assert.equal(toRON(100, 'eur', 2025), 100 * 5.0415);
  assert.equal(toRON(100, 'Usd', 2025), 100 * 4.4705);
});

test('toRON: falsy amount returns 0', () => {
  assert.equal(toRON(0, 'EUR', 2025), 0);
  assert.equal(toRON(null, 'EUR', 2025), 0);
  assert.equal(toRON(undefined, 'EUR', 2025), 0);
});

test('toRON: unknown year leaves amount unchanged', () => {
  assert.equal(toRON(100, 'EUR', 1999), 100);
  assert.equal(toRON(100, 'USD', 2099), 100);
});

test('toRON: unknown currency leaves amount unchanged', () => {
  assert.equal(toRON(100, 'GBP', 2025), 100);
  assert.equal(toRON(100, 'JPY', 2025), 100);
});

test('parseNumber: simple numeric strings', () => {
  assert.equal(parseNumber('1234.56'), 1234.56);
  assert.equal(parseNumber('9999.99'), 9999.99);
});

test('parseNumber: strips thousand separators', () => {
  // The XTB / Fidelity reports use US-style "1,234.56" thousand separators.
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber('12,345,678.90'), 12345678.9);
});

test('parseNumber: returns 0 for empty/null/undefined', () => {
  assert.equal(parseNumber(''), 0);
  assert.equal(parseNumber(null), 0);
  assert.equal(parseNumber(undefined), 0);
});

test('parseNumber: returns NaN for non-numeric input', () => {
  // NaN propagation is part of the original behavior — callers use `value || 0`.
  assert.ok(Number.isNaN(parseNumber('abc')));
});

test('detectCurrency: explicit currency token wins', () => {
  assert.equal(detectCurrency('Sum in EUR', ''), 'EUR');
  assert.equal(detectCurrency('Amount USD only', ''), 'USD');
  assert.equal(detectCurrency('RON total', ''), 'RON');
});

test('detectCurrency: defaults to RON when no hint', () => {
  assert.equal(detectCurrency('Some random text', ''), 'RON');
  assert.equal(detectCurrency('', ''), 'RON');
});

test('detectCurrency: falls back to document-level header', () => {
  // Row text without currency, document header says "în EUR" but not "în RON"
  assert.equal(detectCurrency('Plain row', 'Sume în EUR pentru tot raportul'), 'EUR');
  // If both EUR and RON appear in fullText, RON wins (default)
  assert.equal(detectCurrency('Plain row', 'în RON, în EUR'), 'RON');
});

// --- Country helpers (cap14 / D212 emission) ---

test('D212_ALLOWED_COUNTRY_CODES contains US/DE/RO + XI/XK and excludes XS/XX', () => {
  assert.ok(D212_ALLOWED_COUNTRY_CODES.has('US'));
  assert.ok(D212_ALLOWED_COUNTRY_CODES.has('DE'));
  assert.ok(D212_ALLOWED_COUNTRY_CODES.has('RO'));
  assert.ok(D212_ALLOWED_COUNTRY_CODES.has('XI'));
  assert.ok(D212_ALLOWED_COUNTRY_CODES.has('XK'));
  assert.ok(!D212_ALLOWED_COUNTRY_CODES.has('XS'));
  assert.ok(!D212_ALLOWED_COUNTRY_CODES.has('XX'));
  assert.ok(!D212_ALLOWED_COUNTRY_CODES.has('ZZ'));
});

test('COUNTRY_CODE_TO_RO maps common codes to Romanian names', () => {
  assert.equal(COUNTRY_CODE_TO_RO.US, 'Statele Unite ale Americii');
  assert.equal(COUNTRY_CODE_TO_RO.DE, 'Germania');
  assert.equal(COUNTRY_CODE_TO_RO.NL, 'Olanda');
  assert.equal(COUNTRY_CODE_TO_RO.GB, 'Marea Britanie');
  assert.equal(COUNTRY_CODE_TO_RO.RO, 'România');
});

test('roCountryNameToIso: handles XTB description suffixes', () => {
  assert.equal(roCountryNameToIso('Statele Unite ale Americii'), 'US');
  assert.equal(roCountryNameToIso('Statele Unite'), 'US');
  assert.equal(roCountryNameToIso('din Germania'), 'DE');
  assert.equal(roCountryNameToIso('din Marea Britanie'), 'GB');
  assert.equal(roCountryNameToIso('Olanda'), 'NL');
  assert.equal(roCountryNameToIso('Tarile de Jos'), 'NL');
  assert.equal(roCountryNameToIso('Franta'), 'FR');
  assert.equal(roCountryNameToIso('Franța'), 'FR');
});

test('roCountryNameToIso: handles BT portfolio "COUNTRY / Exchange" suffix', () => {
  assert.equal(roCountryNameToIso('ROMANIA / BVB'), 'RO');
  assert.equal(roCountryNameToIso('GERMANIA / XETRA Frankfurt'), 'DE');
  assert.equal(roCountryNameToIso('FRANTA / Euronext Paris'), 'FR');
});

test('roCountryNameToIso: returns null for unknown names', () => {
  assert.equal(roCountryNameToIso('Mauretania'), null);
  assert.equal(roCountryNameToIso(''), null);
  assert.equal(roCountryNameToIso(null), null);
});

test('isinToCountryCode: extracts prefix from valid ISIN', () => {
  assert.equal(isinToCountryCode('US0378331005'), 'US');
  assert.equal(isinToCountryCode('ROTLVAACNOR1'), 'RO');
  assert.equal(isinToCountryCode('DE0007236101'), 'DE');
  assert.equal(isinToCountryCode('IE00B4L5Y983'), 'IE');
});

test('isinToCountryCode: returns null for malformed input', () => {
  assert.equal(isinToCountryCode(''), null);
  assert.equal(isinToCountryCode(null), null);
  assert.equal(isinToCountryCode('not-an-isin'), null);
  assert.equal(isinToCountryCode('US123'), null);
  assert.equal(isinToCountryCode('US0378331005A'), null); // 13 chars
});

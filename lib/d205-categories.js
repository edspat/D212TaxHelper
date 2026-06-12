/**
 * D205 income category catalog — maps the 1-2 digit codes used by Romanian
 * payers when they file form D205 (informative declaration on withholding
 * income paid to individuals) to human-readable categories, the tax rate
 * actually withheld at source, and the type of income for our local
 * accounting.
 *
 * Source: ANAF Order 2738/2019 + subsequent updates, cross-checked against
 * a real DUF "Toate sursele" report containing live D205 entries from XTB,
 * BT Capital, SALT BANK, ING BANK BUCURESTI (May 2026).
 *
 * Why we need this
 * ----------------
 * The DUF portal aggregates every D205 a payer filed for the taxpayer in
 * the previous year. Each entry carries a numeric `Categoria de venit`
 * code that decides:
 *   - whether the income is subject to CASS (some codes are excluded);
 *   - which Cap. I sub-block of D212 should declare it (cap11 if RO, cap14
 *     if foreign source);
 *   - what tax rate the broker withheld at source (used by our cross-check
 *     to confirm the broker math matches what they reported to ANAF).
 *
 * Validation logic (next commit) compares: code → expected rate → reported
 * (baza × rate ≈ impozit reported?). When the broker rounded differently
 * we flag with ⚠ near; when the rate is wrong we flag with ✗ mismatch.
 */

'use strict';

/**
 * @typedef {object} D205Category
 * @property {string} code            The 2-digit code as it appears in D205.
 * @property {string} label           Romanian description (matches DUF UI).
 * @property {number|null} rate       Statutory rate withheld at source (0.10 etc.). null if rate depends on context.
 * @property {string} kind            'interest' | 'capgains-long' | 'capgains-short' | 'dividends-ro' | 'rent' | 'other'
 * @property {string} d212Block       'cap11' | 'cap14' (always cap11 for these RO-payer codes)
 * @property {string} appField        Which `computeYearData` field this maps to ('interestIncomeRON', 'roLongTermGainRON', etc.)
 */

/** @type {Record<string, D205Category>} */
const D205_CATEGORIES = {
  '09': {
    code: '09',
    label: 'Venituri din dobânzi',
    rate: 0.10,
    kind: 'interest',
    d212Block: 'cap11',
    appField: 'interestIncomeRON',
  },
  '20': {
    code: '20',
    label: 'Venituri din dividende',
    rate: null,          // 8% in 2024, 10% in 2025+, 16% in 2026+ — set per-year by the caller
    kind: 'dividends-ro',
    d212Block: 'cap11',
    appField: 'dividendsRON_ro',
  },
  '26': {
    code: '26',
    label: 'Câștiguri din transferul titlurilor de valoare deținute ≥1 an',
    rate: 0.01,
    kind: 'capgains-long',
    d212Block: 'cap11',
    appField: 'roLongTermGainRON',
  },
  '27': {
    code: '27',
    label: 'Câștiguri din transferul titlurilor de valoare deținute <1 an',
    rate: 0.03,
    kind: 'capgains-short',
    d212Block: 'cap11',
    appField: 'roShortTermGainRON',
  },
  '29': {
    code: '29',
    label: 'Venituri din cedarea folosinței bunurilor (chirie)',
    rate: 0.10,
    kind: 'rent',
    d212Block: 'cap11',
    appField: 'rentalIncome',
  },
};

/**
 * Look up a D205 category by code. Returns `null` for unknown codes
 * (the UI will then render a "cod necunoscut" badge — better than
 * crashing on a category we haven't catalogued yet).
 */
function getCategory(code) {
  if (code == null) return null;
  const k = String(code).padStart(2, '0');
  return D205_CATEGORIES[k] || null;
}

/**
 * Resolve the per-year tax rate for codes where the statutory rate is
 * year-dependent (dividends are the main one — 8% / 10% / 16%).
 */
function resolveRate(code, year) {
  const cat = getCategory(code);
  if (!cat) return null;
  if (cat.rate != null) return cat.rate;
  if (cat.code === '20') {
    if (year >= 2026) return 0.16;
    if (year >= 2025) return 0.10;
    if (year >= 2023) return 0.08;
    return 0.05;
  }
  return null;
}

module.exports = {
  D205_CATEGORIES,
  getCategory,
  resolveRate,
};

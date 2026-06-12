/**
 * Unit tests for lib/d205-categories.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { getCategory, resolveRate, D205_CATEGORIES } = require('../lib/d205-categories');

test('getCategory: known codes resolve to the expected shape', () => {
  const c09 = getCategory('09');
  assert.ok(c09);
  assert.equal(c09.kind, 'interest');
  assert.equal(c09.rate, 0.10);
  assert.equal(c09.appField, 'interestIncomeRON');

  const c26 = getCategory('26');
  assert.equal(c26.kind, 'capgains-long');
  assert.equal(c26.rate, 0.01);

  const c27 = getCategory('27');
  assert.equal(c27.kind, 'capgains-short');
  assert.equal(c27.rate, 0.03);
});

test('getCategory: pads single-digit codes to 2 digits', () => {
  assert.equal(getCategory('9').code, '09');
  assert.equal(getCategory(9).code, '09');
});

test('getCategory: unknown codes return null', () => {
  assert.equal(getCategory('99'), null);
  assert.equal(getCategory(null), null);
  assert.equal(getCategory(undefined), null);
});

test('resolveRate: dividends category 20 picks year-correct rate', () => {
  assert.equal(resolveRate('20', 2023), 0.08);
  assert.equal(resolveRate('20', 2024), 0.08);
  assert.equal(resolveRate('20', 2025), 0.10);
  assert.equal(resolveRate('20', 2026), 0.16);
});

test('resolveRate: returns statutory rate for fixed-rate codes regardless of year', () => {
  assert.equal(resolveRate('09', 2025), 0.10);
  assert.equal(resolveRate('26', 2025), 0.01);
  assert.equal(resolveRate('27', 2025), 0.03);
});

test('D205_CATEGORIES carries the full set we currently support', () => {
  // Regression guard — adding a code without updating tests is loud.
  assert.deepEqual(Object.keys(D205_CATEGORIES).sort(), ['09', '20', '26', '27', '29']);
});

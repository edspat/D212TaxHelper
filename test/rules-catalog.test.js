/**
 * Unit tests for the rules catalog (P2).
 *
 * Ensures the catalog data has the expected shape so the rendering code
 * in public/js/app.js: renderRulesPage() doesn't crash on malformed
 * entries. This is a lightweight schema test — semantic correctness of
 * the legal citations is verified manually against the ANAF PDFs.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RULES, CATEGORIES, getRulesByCategory } = require('../lib/rules-catalog');

test('RULES is a non-empty array', () => {
  assert.ok(Array.isArray(RULES));
  assert.ok(RULES.length >= 10, `Expected at least 10 rules, got ${RULES.length}`);
});

test('every rule has the required fields', () => {
  const required = ['id', 'category', 'title', 'taxRates', 'lawArticle', 'instructionParagraph', 'formula', 'codeRef', 'lastVerified'];
  for (const r of RULES) {
    for (const field of required) {
      assert.ok(r[field], `Rule ${r.id || '(no id)'} missing field: ${field}`);
    }
    assert.ok(Array.isArray(r.taxRates), `Rule ${r.id}: taxRates must be array`);
    assert.ok(Array.isArray(r.formula), `Rule ${r.id}: formula must be array`);
  }
});

test('rule ids are unique kebab-case slugs', () => {
  const seen = new Set();
  const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (const r of RULES) {
    assert.ok(slug.test(r.id), `Rule id "${r.id}" is not kebab-case`);
    assert.ok(!seen.has(r.id), `Duplicate rule id: ${r.id}`);
    seen.add(r.id);
  }
});

test('every rule category exists in CATEGORIES', () => {
  const catKeys = new Set(Object.keys(CATEGORIES));
  for (const r of RULES) {
    assert.ok(catKeys.has(r.category), `Rule ${r.id} has unknown category: ${r.category}`);
  }
});

test('seeAlso references point to existing rule ids', () => {
  const ids = new Set(RULES.map(r => r.id));
  for (const r of RULES) {
    for (const ref of (r.seeAlso || [])) {
      assert.ok(ids.has(ref), `Rule ${r.id}: seeAlso "${ref}" does not exist`);
    }
  }
});

test('lastVerified is a valid YYYY-MM-DD date', () => {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  for (const r of RULES) {
    assert.ok(dateRe.test(r.lastVerified), `Rule ${r.id}: lastVerified "${r.lastVerified}" must be YYYY-MM-DD`);
    assert.ok(!Number.isNaN(Date.parse(r.lastVerified)), `Rule ${r.id}: lastVerified is not parseable`);
  }
});

test('codeRef points to a path inside the repo', () => {
  for (const r of RULES) {
    assert.ok(/^(public|lib|server)/.test(r.codeRef), `Rule ${r.id}: codeRef "${r.codeRef}" should start with public/, lib/, or server`);
  }
});

test('getRulesByCategory groups rules correctly', () => {
  const grouped = getRulesByCategory();
  let totalGrouped = 0;
  for (const cat of Object.keys(grouped)) {
    for (const r of grouped[cat]) {
      assert.equal(r.category, cat);
      totalGrouped += 1;
    }
  }
  assert.equal(totalGrouped, RULES.length, 'Every rule should appear exactly once in groups');
});

test('catalog covers minimum viable rule set (per ROADMAP P2)', () => {
  // The minimum 15 rules listed in ROADMAP.md § P2.
  const requiredIds = [
    'dividends-foreign-source',
    'dividends-ro-source',
    'capgains-ro-source',
    'capgains-foreign-source',
    'interest-ro',
    'interest-foreign-us',
    'salary-bik',
    'losses-carryforward',
    'cass-thresholds',
    'cass-base-investment',
    'fx-bnr',
  ];
  const ids = new Set(RULES.map(r => r.id));
  for (const required of requiredIds) {
    assert.ok(ids.has(required), `Missing required rule: ${required}`);
  }
});

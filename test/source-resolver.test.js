/**
 * Unit tests for lib/source-resolver.js primitives.
 *
 * These primitives are the foundation of the upcoming per-category resolvers
 * (resolveUsDividends, resolveRoBrokerGains, resolveInterest, ...) that will
 * replace the inline `||` priority chains in `_computeYearDataImpl`. The
 * tests pin the semantics around the trickier cases:
 *   - 0 from a parsed document MUST be present (not "no document")
 *   - empty string / undefined / null are absent
 *   - tier ordering: OVERRIDE > ANAF_DOC > DOCUMENT > MANUAL > DERIVED
 *   - sumPresent contributes all present sources
 *   - detectConflicts only fires above abs+rel thresholds
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../lib/source-resolver');

// ---------- isPresent / asNumber ----------

test('isPresent: undefined / null / empty string / NaN are absent', () => {
  assert.equal(R.isPresent(undefined), false);
  assert.equal(R.isPresent(null), false);
  assert.equal(R.isPresent(''), false);
  assert.equal(R.isPresent('   '), false);
  assert.equal(R.isPresent(NaN), false);
});

test('isPresent: 0 is PRESENT (zero is a valid answer)', () => {
  // This is the key invariant that distinguishes "parsed doc says 0"
  // from "no doc / no manual entry". The naive `||` chain conflates them.
  assert.equal(R.isPresent(0), true);
  assert.equal(R.isPresent('0'), true);
  assert.equal(R.isPresent(-1), true);
});

test('asNumber: coerces strings with thousand separators', () => {
  assert.equal(R.asNumber('1,234.56'), 1234.56);
  assert.equal(R.asNumber('1.234,56'.replace(',', '.').replace(/\.(?=.*\.)/g, '')), 1234.56);
  assert.equal(R.asNumber(42), 42);
  assert.equal(R.asNumber('0'), 0);
});

test('asNumber: returns null for absent / unparseable', () => {
  assert.equal(R.asNumber(undefined), null);
  assert.equal(R.asNumber(''), null);
  assert.equal(R.asNumber('not a number'), null);
});

// ---------- source() ----------

test('source(): builds a presence-aware descriptor with tier and label', () => {
  const s = R.source(100, R.TIER.DOCUMENT, 'Fidelity statement');
  assert.equal(s.value, 100);
  assert.equal(s.present, true);
  assert.equal(s.tier, R.TIER.DOCUMENT);
  assert.equal(s.label, 'Fidelity statement');
});

test('source(): absent input produces present=false and value=null', () => {
  const s = R.source(undefined, R.TIER.MANUAL, 'Add Data form');
  assert.equal(s.present, false);
  assert.equal(s.value, null);
});

test('source(): 0 input is present with value 0', () => {
  // Regression: this is the case that motivated the rewrite.
  const s = R.source(0, R.TIER.DOCUMENT, '1042-S Interest');
  assert.equal(s.present, true);
  assert.equal(s.value, 0);
});

test('source({present: true}): forces presence even when value is empty', () => {
  // Used for: "we know this document was uploaded, even if the value it
  // reports for THIS sub-field is 0 / undefined".
  const s = R.source(undefined, R.TIER.DOCUMENT, '1042-S file', { present: true });
  assert.equal(s.present, true);
  assert.equal(s.value, 0);
});

test('source({present: false}): forces absence even when value looks present', () => {
  // Used for: "the field exists in the YAML, but we want to ignore it
  // because some other condition disqualifies the source".
  const s = R.source(100, R.TIER.MANUAL, 'noop', { present: false });
  assert.equal(s.present, false);
  assert.equal(s.value, null);
});

test('source(): unknown tier throws (catches typos at call site)', () => {
  assert.throws(() => R.source(1, 'not-a-tier', 'x'), /unknown tier/);
});

// ---------- pickFirst() ----------

test('pickFirst: returns highest-priority present source', () => {
  const r = R.pickFirst([
    R.source(100, R.TIER.MANUAL, 'manual'),
    R.source(200, R.TIER.DOCUMENT, 'parsed'),
    R.source(300, R.TIER.OVERRIDE, 'override'),
  ]);
  assert.equal(r.value, 300);
  assert.equal(r.tier, R.TIER.OVERRIDE);
  assert.equal(r.label, 'override');
  assert.equal(r.alternates.length, 2);
});

test('pickFirst: ignores absent sources entirely', () => {
  const r = R.pickFirst([
    R.source(undefined, R.TIER.OVERRIDE, 'override'),
    R.source(50, R.TIER.DOCUMENT, 'parsed'),
    R.source('', R.TIER.MANUAL, 'manual'),
  ]);
  assert.equal(r.value, 50);
  assert.equal(r.tier, R.TIER.DOCUMENT);
  assert.equal(r.label, 'parsed');
});

test('pickFirst: all-absent → present=false, value=0, no tier', () => {
  const r = R.pickFirst([
    R.source(undefined, R.TIER.MANUAL, 'm'),
    R.source('', R.TIER.DOCUMENT, 'd'),
  ]);
  assert.equal(r.value, 0);
  assert.equal(r.present, false);
  assert.equal(r.tier, null);
  assert.equal(r.label, null);
  assert.equal(r.alternates.length, 0);
});

test('pickFirst: 0 from a document wins over 100 from manual', () => {
  // Regression: this is the case that motivated the presence-aware design.
  // The user's parsed Fidelity statement legitimately reports 0 dividends;
  // the old `||` chain would fall through to a stale manual entry of 100.
  const r = R.pickFirst([
    R.source(100, R.TIER.MANUAL, 'manual'),
    R.source(0, R.TIER.DOCUMENT, 'Fidelity'),
  ]);
  assert.equal(r.value, 0);
  assert.equal(r.tier, R.TIER.DOCUMENT);
  assert.equal(r.label, 'Fidelity');
});

test('pickFirst: sources are sorted by tier regardless of input order', () => {
  const r = R.pickFirst([
    R.source(50, R.TIER.MANUAL, 'm'),
    R.source(70, R.TIER.DOCUMENT, 'd'),
    R.source(60, R.TIER.ANAF_DOC, 'anaf'),
    R.source(80, R.TIER.OVERRIDE, 'ov'),
  ]);
  assert.equal(r.value, 80);
  // Alternates in priority order after the chosen.
  assert.deepEqual(r.alternates.map(a => a.tier), [R.TIER.ANAF_DOC, R.TIER.DOCUMENT, R.TIER.MANUAL]);
});

// ---------- sumPresent() ----------

test('sumPresent: sums every present source', () => {
  const r = R.sumPresent([
    R.source(100, R.TIER.DOCUMENT, 'XTB'),
    R.source(200, R.TIER.DOCUMENT, 'Tradeville'),
    R.source(50, R.TIER.MANUAL, 'manual EUR'),
  ]);
  assert.equal(r.value, 350);
  assert.equal(r.present, true);
  assert.equal(r.contributors.length, 3);
});

test('sumPresent: composite label joins non-zero contributors', () => {
  const r = R.sumPresent([
    R.source(100, R.TIER.DOCUMENT, 'XTB'),
    R.source(200, R.TIER.DOCUMENT, 'Tradeville'),
  ]);
  assert.equal(r.label, 'XTB + Tradeville');
});

test('sumPresent: zero contributors still counted as present', () => {
  // Regression: a document that reports 0 should still claim ownership
  // of the field (so the UI badge reflects "📄 parsed: 0" instead of
  // "✋ manual default").
  const r = R.sumPresent([
    R.source(0, R.TIER.DOCUMENT, 'Fidelity'),
  ]);
  assert.equal(r.value, 0);
  assert.equal(r.present, true);
  assert.equal(r.contributors.length, 1);
});

test('sumPresent: all-absent → present=false, value=0', () => {
  const r = R.sumPresent([
    R.source(undefined, R.TIER.MANUAL, 'a'),
    R.source('', R.TIER.DOCUMENT, 'b'),
  ]);
  assert.equal(r.value, 0);
  assert.equal(r.present, false);
  assert.equal(r.contributors.length, 0);
});

test('sumPresent: tier reports the strongest contributor', () => {
  // Used by the UI to pick the badge color: "any document wins over manual".
  const r = R.sumPresent([
    R.source(10, R.TIER.MANUAL, 'm'),
    R.source(5, R.TIER.DOCUMENT, 'd'),
  ]);
  assert.equal(r.value, 15);
  assert.equal(r.tier, R.TIER.DOCUMENT);
});

// ---------- deriveValue() ----------

test('deriveValue: marks the result as derived with a formula label', () => {
  const usd = R.source(100, R.TIER.DOCUMENT, '1042-S USD');
  const ron = R.deriveValue(490, [usd], 'USD × BNR 4.90');
  assert.equal(ron.value, 490);
  assert.equal(ron.tier, R.TIER.DERIVED);
  assert.equal(ron.label, 'USD × BNR 4.90');
  assert.equal(ron.derivedFrom.length, 1);
  assert.equal(ron.derivedFrom[0].label, '1042-S USD');
});

test('deriveValue: non-finite value falls back to 0', () => {
  const r = R.deriveValue(NaN, [], 'broken');
  assert.equal(r.value, 0);
  // But it's still marked present + derived so the UI knows it was attempted.
  assert.equal(r.present, true);
});

// ---------- detectConflicts() ----------

test('detectConflicts: flags material doc-vs-manual mismatches', () => {
  const r = R.pickFirst([
    R.source(1350, R.TIER.DOCUMENT, 'Fidelity'),
    R.source(1200, R.TIER.MANUAL, 'manual entry'),
  ]);
  const c = R.detectConflicts(r, { absEps: 1, relEps: 0.01 });
  assert.equal(c.length, 1);
  assert.equal(c[0].chosen.label, 'Fidelity');
  assert.equal(c[0].alternative.label, 'manual entry');
  assert.ok(c[0].delta > 100);
});

test('detectConflicts: ignores small differences under both thresholds', () => {
  // Rounding-level differences should not nag the user.
  const r = R.pickFirst([
    R.source(1000, R.TIER.DOCUMENT, 'doc'),
    R.source(1000.50, R.TIER.MANUAL, 'manual'),
  ]);
  const c = R.detectConflicts(r, { absEps: 1, relEps: 0.01 });
  assert.equal(c.length, 0);
});

test('detectConflicts: returns empty when no alternates', () => {
  const r = R.pickFirst([R.source(100, R.TIER.DOCUMENT, 'doc')]);
  assert.deepEqual(R.detectConflicts(r), []);
});

test('detectConflicts: returns empty when nothing is present', () => {
  const r = R.pickFirst([R.source(undefined, R.TIER.MANUAL, 'm')]);
  assert.deepEqual(R.detectConflicts(r), []);
});

test('detectConflicts: works with two documents disagreeing', () => {
  // Less common, but possible if e.g. Fidelity YTD and 1042-S differ.
  const r = R.pickFirst([
    R.source(1500, R.TIER.DOCUMENT, 'Fidelity YTD'),
    R.source(1450, R.TIER.DOCUMENT, '1042-S'),
  ]);
  // YTD wins (same tier, first in tier-rank order kept by sort stability).
  // The 50-RON delta is > 1 absEps AND ~3% > 1% relEps → conflict.
  const c = R.detectConflicts(r, { absEps: 1, relEps: 0.01 });
  assert.equal(c.length, 1);
});
